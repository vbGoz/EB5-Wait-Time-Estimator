#!/usr/bin/env node
// Fetch-lucid: updates data/lucid-snapshot.json from live sources
// Runs in GitHub Actions (daily) and locally via `node scripts/fetch-lucid.js`
// Keeps existing pipeline/supply numbers; updates fetched dates, checks links, optionally pulls RSS

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SNAP_PATH = path.join(__dirname, '../data/lucid-snapshot.json');
const FEED_URL = 'https://blog.lucidtext.com/feed/';
const TIMING_URL = 'https://blog.lucidtext.com/eb-5-timing/';
const DROPBOX_URL = 'https://www.dropbox.com/scl/fi/xkbkaox1hgepg6nn6v3l9/EB5-Backlog-Analysis.xlsx?rlkey=iwnaj84r7apd0matmr0vagkq2&dl=0';

async function checkUrl(url, label){
  try{
    const controller = new AbortController();
    const t = setTimeout(()=> controller.abort(), 8000);
    const r = await fetch(url, { method:'HEAD', signal: controller.signal, headers:{'User-Agent':'eb5research-sync/1.0'} });
    clearTimeout(t);
    // Some hosts block HEAD; fallback to GET range
    if(!r.ok && r.status===405){
      const g = await fetch(url, { headers:{'Range':'bytes=0-1024','User-Agent':'eb5research-sync/1.0'}});
      return { label, url, ok: g.ok, status: g.status };
    }
    return { label, url, ok: r.ok, status: r.status };
  }catch(e){
    return { label, url, ok:false, status:0, error: String(e).slice(0,120) };
  }
}

async function fetchFeed(){
  try{
    const r = await fetch(FEED_URL, { headers:{'User-Agent':'eb5research-sync/1.0'}});
    if(!r.ok) return null;
    const text = await r.text();
    // crude parse: count items, extract latest post title/date
    const items = [...text.matchAll(/<item>[\s\S]*?<\/item>/g)].length;
    const latestTitle = (text.match(/<item>[\s\S]*?<title><!\[CDATA\[(.*?)\]\]><\/title>/)||[])[1] || '';
    const latestDate = (text.match(/<item>[\s\S]*?<pubDate>(.*?)<\/pubDate>/)||[])[1] || '';
    return { items, latestTitle, latestDate };
  }catch{ return null; }
}

async function main(){
  const snapRaw = fs.readFileSync(SNAP_PATH, 'utf8');
  const snap = JSON.parse(snapRaw);
  const before = snap.updatedAt;

  const checks = await Promise.all([
    checkUrl(FEED_URL, 'RSS feed'),
    checkUrl(TIMING_URL, 'EB-5 Timing'),
    checkUrl(DROPBOX_URL, 'Backlog Excel'),
    checkUrl('https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html', 'Visa Bulletin index'),
    checkUrl('https://www.uscis.gov/tools/reports-and-studies/immigration-and-citizenship-data', 'USCIS data'),
  ]);

  const feed = await fetchFeed();

  // Update timestamp if any check succeeded (means we synced)
  const today = new Date().toISOString().slice(0,10);
  const anyOk = checks.some(c=> c.ok);
  if(anyOk){
    snap.updatedAt = today;
    snap.generatedAt = new Date().toISOString();
    snap.lastSync = { date: today, checks, feed };
    // keep friendly fetched dates in sources
    snap.sources.forEach(s=>{
      const hit = checks.find(c=> s.url && c.url.includes(new URL(s.url).hostname) || s.url===c.url);
      if(hit) s.fetched = today;
      s.lastStatus = hit? (hit.ok? `${hit.status} OK` : `${hit.status} ${hit.error||'fail'}`) : 'not checked';
    });
    // Append feed note to provenance if fresh
    if(feed?.latestTitle){
      snap.feedLatest = { title: feed.latestTitle, date: feed.latestDate, items: feed.items };
    }
  } else {
    snap.lastSync = { date: today, checks, feed, note: 'no checks succeeded — kept previous data' };
  }

  // Write back only if changed
  const out = JSON.stringify(snap, null, 2) + '\n';
  if(out !== snapRaw){
    fs.writeFileSync(SNAP_PATH, out);
    console.log(`Updated ${SNAP_PATH}: ${before} → ${snap.updatedAt} (feed: ${feed?.latestTitle||'—'})`);
    checks.forEach(c=> console.log(` - ${c.label}: ${c.ok?'✓':'✗'} ${c.status} ${c.url}`));
  } else {
    console.log(`No change to ${SNAP_PATH} (${snap.updatedAt})`);
  }
}

main().catch(e=>{ console.error(e); process.exit(1); });
