const test = require('node:test');
const assert = require('node:assert/strict');
const { createHistoryCsv, createStatisticsCsv } = require('../src/csv-export');

test('history CSV includes every completed mode with timestamps and durations', () => {
  const csv = createHistoryCsv([
    { completedAt: '2026-10-31T12:05:00.000Z', mode: 'shortBreak', durationMinutes: 5 },
    { completedAt: '2026-10-31T12:00:00.000Z', mode: 'focus', durationMinutes: 25 },
    { completedAt: '2026-10-31T12:30:00.000Z', mode: 'longBreak', durationMinutes: 15 },
  ]);
  assert.equal(csv, '\uFEFFcompleted_at,session_type,duration_minutes\r\n'
    + '2026-10-31T12:05:00.000Z,Short Break,5\r\n'
    + '2026-10-31T12:00:00.000Z,Focus Session,25\r\n'
    + '2026-10-31T12:30:00.000Z,Long Break,15\r\n');
});

test('statistics CSV includes displayed summaries and all daily totals', () => {
  const csv = createStatisticsCsv({
    '2026-10-29': { completedSessions: 1, focusMinutes: 25 },
    '2026-10-30': { completedSessions: 2, focusMinutes: 50 },
  }, new Date(2026, 9, 30, 12));
  assert.match(csv, /record_type,date,completed_focus_sessions,focus_minutes,metric,value/);
  assert.match(csv, /summary,,,,completed_today,2/);
  assert.match(csv, /summary,,,,focus_minutes_today,50/);
  assert.match(csv, /summary,,,,total_focus_minutes,75/);
  assert.match(csv, /summary,,,,streak_days,2/);
  assert.match(csv, /summary,,,,weekly_focus_minutes,75/);
  assert.match(csv, /day,2026-10-29,1,25,,\r\nday,2026-10-30,2,50,,/);
});

test('CSV fields containing quotes or commas are escaped', () => {
  const csv = createHistoryCsv([
    { completedAt: '2026-10-31T12:00:00.000Z', mode: 'focus', durationMinutes: '25,"test"' },
  ]);
  assert.match(csv, /"25,""test"""/);
});
