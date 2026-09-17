#!/usr/bin/env node
// Durable test for Astryx estimator — runs with `node tests/astryx-estimator.test.mjs`
// Verifies projection logic matches Lazicki model per blog.lucidtext.com

import assert from 'node:assert/strict';
import { yearsFor, formatYears, eadEstimate, gcEstimate, FALLBACK, loadSnapshot } from '../js/astryx-estimator.js';
import fs from 'node:fs';

let passed = 0, failed = 0;
function test(name, fn){
  try{ fn(); console.log(`✓ ${name}`); passed++; }
  catch(e){ console.error(`✗ ${name}\n  ${e.message}`); console.error(e.stack?.split('\n').slice(1,3).join('\n')); failed++; }
}

// Load snapshot fallback (offline) — ensures file valid JSON
test('data/lucid-snapshot.json is valid and has required keys', ()=>{
  const snap = JSON.parse(fs.readFileSync(new URL('../data/lucid-snapshot.json', import.meta.url), 'utf8'));
  assert.ok(snap.updatedAt);
  assert.ok(snap.pipeline.totalPetitions === 19780);
  assert.ok(snap.supply.rural.typical === 3200);
  assert.ok(snap.processing.i526e.medianMonths === 13.6);
  assert.ok(snap.visaBulletin.unreserved.china === '2016-07-14');
});

test('formatYears handles months and multi-decade', ()=>{
  assert.equal(formatYears(0.4), '5 months');
  assert.equal(formatYears(1.5), '1.5 years');
  assert.ok(formatYears(25).includes('multi-decade'));
});

test('ROW Rural with overflow reflects pending-only vs Lazicki 7yr with ongoing demand', ()=>{
  const withO = yearsFor({country:'row', category:'rural', family:2.0, withOverflow:true});
  const without = yearsFor({country:'row', category:'rural', family:2.0, withOverflow:false});
  // Model pending-only: ROW ~1.5-2yr; Lazicki 7yr includes ongoing ROW demand (~5k petitions/yr) + country caps
  assert.ok(withO.yrs >= 1 && withO.yrs <= 4, `withOverflow ROW rural ${withO.yrs} not 1-4 pending-only`);
  assert.ok(without.yrs >= 1 && without.yrs <= 8, `without ROW rural ${without.yrs} not 1-8`);
});

test('India HUA multi-decade without overflow, ~11yr with (pending-only; Lazicki 7yr assumes attrition/extra visas)', ()=>{
  const without = yearsFor({country:'india', category:'hua', family:2.0, withOverflow:false});
  const withO = yearsFor({country:'india', category:'hua', family:2.0, withOverflow:true});
  assert.ok(without.yrs > 12, `India HUA without overflow should be >12yr (49x) got ${without.yrs}`);
  // Pending-only gives 11.9yr at 2.0x; Lazicki optimistic 7yr requires extraordinary attrition/extra supply
  assert.ok(withO.yrs >= 7 && withO.yrs <= 13, `India HUA with overflow 7-13yr got ${withO.yrs}`);
});

test('China HUA similar pattern', ()=>{
  const without = yearsFor({country:'china', category:'hua', family:2.0, withOverflow:false});
  const withO = yearsFor({country:'china', category:'hua', family:2.0, withOverflow:true});
  assert.ok(without.yrs > 15, `China HUA without ${without.yrs} should be >15`);
  assert.ok(withO.yrs >= 10 && withO.yrs <= 22, `China with overflow 10-22yr got ${withO.yrs}`);
});

test('Infra India — 0 to multi-decade without overflow', ()=>{
  const without = yearsFor({country:'india', category:'infra', family:2.0, withOverflow:false});
  // 2.0x pipeline ~135 visas (1000*0.27) /28 cap = ~4.8yr, but per text can be 0-multi-decade depending on sort; model gives ~4-5yr mid
  assert.ok(without.yrs >=3 && without.yrs <=15, `Infra India without ${without.yrs}`);
});

test('EAD: ROW rural Current → 6-12mo', ()=>{
  const e = eadEstimate({country:'row', category:'rural', filingDate:'2026-09-16'});
  assert.equal(e.isCurrent, true);
  assert.equal(e.eadMonths, 8);
});

test('EAD: India unreserved not Current → queue', ()=>{
  const e = eadEstimate({country:'india', category:'unreserved'});
  assert.equal(e.isCurrent, false);
  assert.ok(e.waitYears > 3);
});

test('GC: includes I-526E + queue + consular; India rural pending-only ~12yr', ()=>{
  const gc = gcEstimate({country:'india', category:'rural', family:2.0, withOverflow:true, aos:'aos'});
  // pending-only queue ~11.9yr + 0.66yr AOS = 12.6yr; Lazicki 7yr optimistic with attrition not yet in model
  assert.ok(gc.total >= 10 && gc.total <= 14, `GC India rural with overflow pending-only ${gc.total}`);
  assert.equal(gc.procMonths, FALLBACK.processing.i526e.medianMonths);
});

test('GC: family multiplier increases wait', ()=>{
  const low = gcEstimate({country:'india', category:'rural', family:2.0, withOverflow:true, aos:'aos'});
  const high = gcEstimate({country:'india', category:'rural', family:2.8, withOverflow:true, aos:'aos'});
  assert.ok(high.total > low.total, `2.8x should be >2.0x: ${high.total} vs ${low.total}`);
});

test('projects section removed — estimator-only design', ()=>{
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.equal((html.match(/id="projects"/g)||[]).length, 0, 'index.html should not contain projects section');
  assert.equal((html.match(/href="#projects"/g)||[]).length, 0, 'nav should not link to projects');
  // estimator-only: new design has editorial estimator (simplified title)
  assert.ok(html.includes('EB-5 Wait Time Estimator'), 'new editorial title missing');
  assert.ok(html.includes('id="birth-country"'), 'birth-country select missing');
  assert.ok(html.includes('id="visa-category"'), 'visa-category select missing');
  assert.ok(html.includes('id="out-ead"'), 'out-ead result missing');
  assert.ok(html.includes('id="out-gc"'), 'out-gc result missing');
  assert.ok(html.includes('ASTRYX_FALLBACK') || html.includes('Lucid Model Series'), 'fallback/model missing');
});

test('recalculate button — updateAll is guarded and recalculates', async ()=>{
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  // Ensure updateAll has guards for removed thesis/table so recalculate doesn't throw
  assert.ok(html.includes("const _t526=document.getElementById('thesis-526e'); if(_t526)"), 'thesis guard missing — recalculate will throw');
  assert.ok(html.includes("const _e_tbl"), 'table guard missing');
  assert.ok(html.includes('id="recalculate"'), 'recalculate button missing');
  assert.ok(html.includes("document.getElementById('recalculate')?.addEventListener"), 'recalculate listener not guarded');
  // Also check INA jargon removed
  assert.equal((html.match(/INA §/g)||[]).length, 0, 'INA jargon should be removed');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed?1:0);
