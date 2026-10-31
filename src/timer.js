const DEFAULT_SETTINGS = Object.freeze({
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsUntilLongBreak: 4,
  notifications: true,
  alwaysOnTop: true,
  soundAlerts: false,
  launchAtLogin: false,
});

const MODES = Object.freeze(['focus', 'shortBreak', 'longBreak']);
const MINUTES_MIN = 1;
const MINUTES_MAX = 120;

function durationFor(mode, settings = DEFAULT_SETTINGS) {
  const key = ({ focus: 'focusMinutes', shortBreak: 'shortBreakMinutes', longBreak: 'longBreakMinutes' })[mode];
  if (!key) throw new RangeError(`Unknown timer mode: ${mode}`);
  const raw = Number(settings[key]);
  const minutes = Number.isFinite(raw) ? Math.min(MINUTES_MAX, Math.max(MINUTES_MIN, Math.round(raw))) : DEFAULT_SETTINGS[key];
  return minutes * 60_000;
}

function createTimerState(settings = DEFAULT_SETTINGS) {
  return {
    mode: 'focus',
    status: 'idle',
    remainingMs: durationFor('focus', settings),
    deadlineAt: null,
    completedSessions: 0,
    focusInCycle: 0,
  };
}

function remainingMs(state, now = Date.now()) {
  if (state.status !== 'running' || !Number.isFinite(state.deadlineAt)) return Math.max(0, state.remainingMs);
  return Math.max(0, state.deadlineAt - now);
}

function startTimer(state, now, settings = DEFAULT_SETTINGS) {
  if (state.status === 'running') return state;
  const remaining = Math.max(0, Number(state.remainingMs) || durationFor(state.mode, settings));
  return { ...state, status: 'running', remainingMs: remaining, deadlineAt: now + remaining };
}

function pauseTimer(state, now = Date.now(), settings = DEFAULT_SETTINGS) {
  if (state.status !== 'running') return state;
  const remaining = remainingMs(state, now);
  if (remaining <= 0) return finishSession(state, settings);
  return { ...state, status: 'paused', remainingMs: remaining, deadlineAt: null };
}

function resumeTimer(state, now = Date.now(), settings = DEFAULT_SETTINGS) {
  if (state.status !== 'paused') return state;
  if (state.remainingMs <= 0) return finishSession(state, settings);
  return startTimer(state, now, settings);
}

function resetTimer(state, settings = DEFAULT_SETTINGS) {
  return { ...state, status: 'idle', remainingMs: durationFor(state.mode, settings), deadlineAt: null };
}

function selectMode(state, mode, settings = DEFAULT_SETTINGS) {
  if (!MODES.includes(mode)) throw new RangeError(`Unknown timer mode: ${mode}`);
  return { ...state, mode, status: 'idle', remainingMs: durationFor(mode, settings), deadlineAt: null };
}

function finishSession(state, settings = DEFAULT_SETTINGS) {
  if (state.mode === 'focus') {
    const completedSessions = state.completedSessions + 1;
    const cycleLength = Math.max(1, Number(settings.sessionsUntilLongBreak) || DEFAULT_SETTINGS.sessionsUntilLongBreak);
    const focusInCycle = (state.focusInCycle + 1) % cycleLength;
    const mode = focusInCycle === 0 ? 'longBreak' : 'shortBreak';
    return {
      ...state,
      mode,
      status: 'idle',
      remainingMs: durationFor(mode, settings),
      deadlineAt: null,
      completedSessions,
      focusInCycle,
    };
  }
  return {
    ...state,
    mode: 'focus',
    status: 'idle',
    remainingMs: durationFor('focus', settings),
    deadlineAt: null,
  };
}

function restoreTimerState(saved, settings = DEFAULT_SETTINGS, now = Date.now()) {
  if (!saved || !MODES.includes(saved.mode) || !['idle', 'running', 'paused'].includes(saved.status)) return createTimerState(settings);
  const cycleLength = Math.max(1, Number(settings.sessionsUntilLongBreak) || DEFAULT_SETTINGS.sessionsUntilLongBreak);
  const validCount = (value) => Number.isInteger(value) && value >= 0 ? value : 0;
  let state = {
    mode: saved.mode,
    status: saved.status,
    remainingMs: Math.max(0, Math.min(durationFor(saved.mode, settings), Number(saved.remainingMs) || 0)),
    deadlineAt: Number.isFinite(saved.deadlineAt) ? saved.deadlineAt : null,
    completedSessions: validCount(saved.completedSessions),
    focusInCycle: validCount(saved.focusInCycle) % cycleLength,
  };
  if (state.status === 'running' && state.deadlineAt === null) state = { ...state, status: 'paused' };
  if (state.status === 'running' && state.deadlineAt <= now) state = finishSession(state, settings);
  return state;
}

module.exports = {
  DEFAULT_SETTINGS,
  MODES,
  durationFor,
  createTimerState,
  remainingMs,
  startTimer,
  pauseTimer,
  resumeTimer,
  resetTimer,
  selectMode,
  finishSession,
  restoreTimerState,
};
