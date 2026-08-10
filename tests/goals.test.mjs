import test from 'node:test';
import assert from 'node:assert/strict';
import {
  goalStats, habitStats, isDayDone, longestDailyStreak, openToday, projectStats, weekCount,
} from '../src/lib/goals.js';

const TODAY = '2026-08-13'; // een donderdag
const A = 'user-a';
const B = 'user-b';

const habit = (over = {}) => ({
  id: 'g1', kind: 'habit', title: 'Sporten', ownerId: A,
  cadence: { type: 'daily' }, checkins: {}, ...over,
});

test('een dag telt alleen mee als de eigenaar heeft afgevinkt', () => {
  const goal = habit({ checkins: { [TODAY]: [B] } });
  assert.ok(!isDayDone(goal, TODAY));
  assert.ok(isDayDone(habit({ checkins: { [TODAY]: [A] } }), TODAY));
});

test('bij een samen-doel telt de dag zodra één van tweeën afvinkt', () => {
  const goal = habit({ ownerId: 'both', checkins: { [TODAY]: [B] } });
  assert.ok(isDayDone(goal, TODAY));
});

test('dezelfde dag door beiden afgevinkt telt één keer, niet dubbel', () => {
  const goal = habit({ ownerId: 'both', checkins: { [TODAY]: [A, B] } });
  assert.equal(weekCount(goal, TODAY), 1);
});

test('de reeks loopt door tot de eerste gemiste dag', () => {
  const goal = habit({
    checkins: {
      '2026-08-13': [A], '2026-08-12': [A], '2026-08-11': [A], '2026-08-09': [A],
    },
  });
  assert.equal(habitStats(goal, TODAY).streak, 3);
});

test('een nog niet afgevinkte dag van vandaag breekt de reeks niet', () => {
  const goal = habit({ checkins: { '2026-08-12': [A], '2026-08-11': [A] } });
  const stats = habitStats(goal, TODAY);
  assert.equal(stats.doneToday, false);
  assert.equal(stats.streak, 2);
});

test('een gemiste dag van gisteren zet de reeks wel op nul', () => {
  const goal = habit({ checkins: { '2026-08-11': [A], '2026-08-10': [A] } });
  assert.equal(habitStats(goal, TODAY).streak, 0);
});

test('de langste reeks onthoudt ook wat langer geleden is', () => {
  const goal = habit({
    checkins: {
      '2026-07-01': [A], '2026-07-02': [A], '2026-07-03': [A], '2026-07-04': [A],
      '2026-08-12': [A], '2026-08-13': [A],
    },
  });
  assert.equal(longestDailyStreak(goal), 4);
});

test('een weekdoel telt per week en houdt de weekreeks bij', () => {
  const goal = habit({
    cadence: { type: 'weekly', timesPerWeek: 3 },
    checkins: {
      // deze week (ma 10 aug t/m zo 16 aug)
      '2026-08-10': [A], '2026-08-11': [A], '2026-08-13': [A],
      // vorige week: ook drie
      '2026-08-03': [A], '2026-08-05': [A], '2026-08-07': [A],
      // week daarvoor: te weinig
      '2026-07-28': [A],
    },
  });
  const stats = habitStats(goal, TODAY);
  assert.equal(stats.weekDone, 3);
  assert.equal(stats.weekTarget, 3);
  assert.equal(stats.streak, 2);
  assert.equal(stats.streakUnit, 'weken');
});

test('een weekdoel dat deze week nog niet af is, houdt de reeks van vorige week', () => {
  const goal = habit({
    cadence: { type: 'weekly', timesPerWeek: 3 },
    checkins: { '2026-08-03': [A], '2026-08-05': [A], '2026-08-07': [A] },
  });
  assert.equal(habitStats(goal, TODAY).streak, 1);
});

test('de geschiedenis loopt van maandag tot zondag, zodat de heatmap klopt', () => {
  const stats = habitStats(habit(), TODAY);
  assert.equal(stats.history.length % 7, 0);
  assert.equal(stats.history[0].date, '2026-05-18'); // een maandag
  assert.equal(stats.history.at(-1).date, '2026-08-16'); // de zondag van deze week
});

test('projectvoortgang telt bijdragen van beiden op', () => {
  const goal = {
    id: 'g2', kind: 'project', title: 'Sparen voor de reis', ownerId: 'both',
    target: 3000, unit: '€', deadline: '2026-12-31', startDate: '2026-01-01',
    entries: [
      { id: 'e1', date: '2026-03-01', userId: A, amount: 800 },
      { id: 'e2', date: '2026-05-01', userId: B, amount: 700 },
    ],
  };
  const stats = projectStats(goal, TODAY);
  assert.equal(stats.total, 1500);
  assert.equal(stats.pct, 50);
  assert.equal(stats.remaining, 1500);
  assert.deepEqual(stats.perPerson, { [A]: 800, [B]: 700 });
  assert.equal(stats.daysLeft, 140);
});

test('achterlopen op schema wordt gesignaleerd', () => {
  const shared = {
    kind: 'project', target: 1200, unit: '€', deadline: '2026-12-31', startDate: '2026-01-01',
  };
  // Ruim over de helft van het jaar heen: 200 is te weinig, 900 ligt voor.
  assert.equal(projectStats({ ...shared, entries: [{ amount: 200, userId: A, date: '2026-02-01' }] }, TODAY).onTrack, false);
  assert.equal(projectStats({ ...shared, entries: [{ amount: 900, userId: A, date: '2026-02-01' }] }, TODAY).onTrack, true);
});

test('een project zonder streefdatum zegt niets over schema', () => {
  const stats = projectStats({ kind: 'project', target: 100, entries: [], deadline: null }, TODAY);
  assert.equal(stats.onTrack, null);
  assert.equal(stats.pct, 0);
});

test('goalStats kiest zelf de juiste soort', () => {
  assert.equal(goalStats(habit(), TODAY).kind, 'habit');
  assert.equal(goalStats({ kind: 'project', target: 10, entries: [] }, TODAY).kind, 'project');
});

test('openToday laat zien wat vandaag nog aandacht vraagt', () => {
  const goals = [
    habit({ id: 'klaar', checkins: { [TODAY]: [A] } }),
    habit({ id: 'open' }),
    habit({ id: 'archief', archived: true }),
    { kind: 'project', id: 'project', target: 10, entries: [] },
  ];
  const open = openToday(goals, TODAY);
  assert.deepEqual(open.map((o) => o.goal.id), ['open']);
  assert.equal(open[0].urgent, true);
});

test('een weekdoel is pas dringend als de week te kort wordt', () => {
  // Donderdag: nog 4 dagen te gaan deze week.
  const rustig = habit({ cadence: { type: 'weekly', timesPerWeek: 2 }, checkins: {} });
  const krap = habit({ cadence: { type: 'weekly', timesPerWeek: 5 }, checkins: {} });
  assert.equal(openToday([rustig], TODAY)[0].urgent, false);
  assert.equal(openToday([krap], TODAY)[0].urgent, true);
});
