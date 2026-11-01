const { buildStatistics } = require('./statistics');

const SESSION_LABELS = {
  focus: 'Focus Session',
  shortBreak: 'Short Break',
  longBreak: 'Long Break',
};

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function createCsv(rows) {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

function createHistoryCsv(history) {
  const rows = [['completed_at', 'session_type', 'duration_minutes']];
  for (const record of history) {
    rows.push([record.completedAt, SESSION_LABELS[record.mode], record.durationMinutes]);
  }
  return createCsv(rows);
}

function createStatisticsCsv(activity, now = new Date()) {
  const statistics = buildStatistics(activity, now);
  const weeklyFocusMinutes = statistics.week.reduce((total, day) => total + day.focusMinutes, 0);
  const rows = [
    ['record_type', 'date', 'completed_focus_sessions', 'focus_minutes', 'metric', 'value'],
    ['summary', '', '', '', 'completed_today', statistics.completedToday],
    ['summary', '', '', '', 'focus_minutes_today', statistics.focusMinutesToday],
    ['summary', '', '', '', 'total_focus_minutes', statistics.totalFocusMinutes],
    ['summary', '', '', '', 'streak_days', statistics.streakDays],
    ['summary', '', '', '', 'weekly_focus_minutes', weeklyFocusMinutes],
    ...Object.keys(activity).sort().map((date) => [
      'day',
      date,
      activity[date].completedSessions,
      activity[date].focusMinutes,
      '',
      '',
    ]),
  ];
  return createCsv(rows);
}

module.exports = { createHistoryCsv, createStatisticsCsv };
