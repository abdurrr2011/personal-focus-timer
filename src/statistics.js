function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function hasActivity(activity, key) {
  return Number.isInteger(activity?.[key]?.completedSessions) && activity[key].completedSessions > 0;
}

function addFocusSession(activity, completedAt, focusMinutes) {
  const key = dateKey(completedAt);
  const day = activity[key] || { completedSessions: 0, focusMinutes: 0 };
  return {
    ...activity,
    [key]: {
      completedSessions: day.completedSessions + 1,
      focusMinutes: day.focusMinutes + focusMinutes,
    },
  };
}

function buildStatistics(activity = {}, now = new Date()) {
  const todayKey = dateKey(now);
  const today = activity[todayKey] || { completedSessions: 0, focusMinutes: 0 };
  const totalFocusMinutes = Object.values(activity).reduce((total, day) => total + day.focusMinutes, 0);

  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysSinceMonday = (weekStart.getDay() + 6) % 7;
  weekStart.setDate(weekStart.getDate() - daysSinceMonday);
  const week = Array.from({ length: 7 }, (_unused, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    const key = dateKey(date);
    return {
      date: key,
      label: new Intl.DateTimeFormat('en', { weekday: 'short' }).format(date),
      focusMinutes: activity[key]?.focusMinutes || 0,
      isToday: key === todayKey,
    };
  });

  let streakDays = 0;
  const streakCursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!hasActivity(activity, todayKey)) streakCursor.setDate(streakCursor.getDate() - 1);
  while (hasActivity(activity, dateKey(streakCursor))) {
    streakDays += 1;
    streakCursor.setDate(streakCursor.getDate() - 1);
  }

  return {
    completedToday: today.completedSessions,
    focusMinutesToday: today.focusMinutes,
    totalFocusMinutes,
    streakDays,
    week,
  };
}

module.exports = { dateKey, addFocusSession, buildStatistics };
