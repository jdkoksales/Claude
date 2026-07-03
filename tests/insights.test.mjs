import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activeDays, comebackDays, stats, detectTrigger, buildCoachPayload,
} from '../src/lib/insights.js';

const L = (goal_id, day, level) => ({ goal_id, day, level });

test('activeDays: minimum en target tellen, skip niet', () => {
  const logs = [
    L(1, '2026-07-01', 'minimum'),
    L(1, '2026-07-02', 'target'),
    L(1, '2026-07-03', 'skip'),
    L(2, '2026-07-02', 'target'), // zelfde dag ander doel → 1x
  ];
  assert.deepEqual(activeDays(logs), ['2026-07-01', '2026-07-02']);
});

test('comeback: actieve dag na ≥2 volledig gemiste dagen', () => {
  const logs = [
    L(1, '2026-07-01', 'target'),
    L(1, '2026-07-02', 'minimum'),
    // 3-4 juli gemist (gat van 2 dagen)
    L(1, '2026-07-05', 'minimum'), // comeback!
    L(1, '2026-07-06', 'target'),
    // 7 juli gemist (gat van 1 dag) → géén comeback
    L(1, '2026-07-08', 'target'),
  ];
  assert.deepEqual(comebackDays(logs), ['2026-07-05']);
  assert.deepEqual(stats(logs), { daysActive: 5, comebacks: 1 });
});

test('eerste actieve dag ooit is geen comeback', () => {
  assert.deepEqual(comebackDays([L(1, '2026-07-05', 'minimum')]), []);
});

const GOALS = [{ id: 1 }];

test('trigger: comeback vandaag wint van alles', () => {
  const logs = [
    L(1, '2026-07-01', 'target'),
    L(1, '2026-07-10', 'minimum'), // comeback op "vandaag"
  ];
  const t = detectTrigger(logs, GOALS, '2026-07-10');
  assert.equal(t.type, 'comeback');
});

test('trigger: gat van 3+ dagen zonder enige log', () => {
  const logs = [L(1, '2026-07-05', 'target')];
  const t = detectTrigger(logs, GOALS, '2026-07-10');
  assert.equal(t.type, 'gap');
  assert.equal(t.missedDays, 5);
});

test('trigger: target→minimum-drift over 14 dagen', () => {
  // Week 1 (1-7 juli): 4x target. Week 2 (8-14): 1x target, 4x minimum.
  const logs = [
    L(1, '2026-07-01', 'target'), L(1, '2026-07-03', 'target'),
    L(1, '2026-07-05', 'target'), L(1, '2026-07-07', 'target'),
    L(1, '2026-07-08', 'minimum'), L(1, '2026-07-09', 'minimum'),
    L(1, '2026-07-11', 'target'), L(1, '2026-07-12', 'minimum'),
    L(1, '2026-07-14', 'minimum'),
  ];
  const t = detectTrigger(logs, GOALS, '2026-07-14');
  assert.equal(t.type, 'drift');
  assert.equal(t.goalId, 1);
});

test('trigger: oplopende skips (zonder comeback of drift ertussen)', () => {
  const logs = [
    L(1, '2026-07-04', 'minimum'), L(1, '2026-07-05', 'target'),
    L(1, '2026-07-08', 'skip'), L(1, '2026-07-09', 'skip'), L(1, '2026-07-10', 'skip'),
    L(1, '2026-07-11', 'target'), L(1, '2026-07-13', 'target'), L(1, '2026-07-14', 'target'),
  ];
  const t = detectTrigger(logs, GOALS, '2026-07-14');
  assert.equal(t.type, 'skips');
  assert.equal(t.goalId, 1);
});

test('trigger: weekly alleen als er niets dringenders is', () => {
  const logs = [
    L(1, '2026-07-13', 'target'),
    L(1, '2026-07-14', 'target'),
  ];
  assert.equal(detectTrigger(logs, GOALS, '2026-07-14', true).type, 'weekly');
  assert.equal(detectTrigger(logs, GOALS, '2026-07-14', false), null);
});

test('trigger: stabiel patroon → geen interventie', () => {
  const logs = [];
  for (let d = 1; d <= 14; d++) {
    logs.push(L(1, `2026-07-${String(d).padStart(2, '0')}`, 'target'));
  }
  assert.equal(detectTrigger(logs, GOALS, '2026-07-14'), null);
});

test('gloednieuwe gebruiker zonder logs → geen interventie', () => {
  assert.equal(detectTrigger([], GOALS, '2026-07-14'), null);
});

test('buildCoachPayload: compacte JSON met alleen data', () => {
  const logs = [L(1, '2026-07-13', 'minimum')];
  const goals = [{ id: 1, action: 'lezen', minimum: '1 blz', target: '30 min' }];
  const p = buildCoachPayload({
    trigger: { type: 'drift', goalId: 1 },
    goals, logs,
    today: '2026-07-14',
    lastReview: { week: '2026-W28', skipped: false, answers: { q1: 'ging ok' } },
  });
  assert.equal(p.vandaag, '2026-07-14');
  assert.equal(p.doelen.length, 1);
  assert.equal(p.doelen[0].laatste_14_dagen.length, 1);
  assert.equal(p.laatste_weekreview.week, '2026-W28');
  assert.ok(JSON.stringify(p).length < 2000);
});
