const test = require('node:test');
const assert = require('node:assert/strict');
const { addFocusSession, buildStatistics, dateKey } = require('../src/statistics');

test('completed focus sessions accumulate in the local date bucket', () => {
  const completedAt = new Date(2026, 9, 31, 23, 59);
  const first = addFocusSession({}, completedAt, 25);
  const second = addFocusSession(first, completedAt, 40);
  assert.deepEqual(second, {
    '2026-10-31': { completedSessions: 2, focusMinutes: 65 },
  });
});

test('statistics report today, all-time focus, week totals, and current-day status', () => {
  const now = new Date(2026, 9, 30, 12);
  const statistics = buildStatistics({
    '2026-10-26': { completedSessions: 2, focusMinutes: 50 },
    '2026-10-30': { completedSessions: 3, focusMinutes: 75 },
    '2026-10-29': { completedSessions: 1, focusMinutes: 25 },
  }, now);

  assert.equal(statistics.completedToday, 3);
  assert.equal(statistics.focusMinutesToday, 75);
  assert.equal(statistics.totalFocusMinutes, 150);
  assert.equal(statistics.streakDays, 2);
  assert.deepEqual(statistics.week.map(({ date }) => date), [
    '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01',
  ]);
  assert.equal(statistics.week.find((day) => day.isToday).focusMinutes, 75);
});

test('streak continues from yesterday when no focus session is completed today', () => {
  const statistics = buildStatistics({
    '2026-10-28': { completedSessions: 1, focusMinutes: 25 },
    '2026-10-29': { completedSessions: 2, focusMinutes: 50 },
  }, new Date(2026, 9, 30, 12));
  assert.equal(statistics.completedToday, 0);
  assert.equal(statistics.streakDays, 2);
});

test('streak is zero when neither today nor yesterday has focus activity', () => {
  const statistics = buildStatistics({
    '2026-10-28': { completedSessions: 1, focusMinutes: 25 },
  }, new Date(2026, 9, 30, 12));
  assert.equal(statistics.streakDays, 0);
});

test('date keys use local calendar dates', () => {
  assert.equal(dateKey(new Date(2026, 9, 31, 23, 59)), '2026-10-31');
});
