const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_SETTINGS,
  createTimerState,
  startTimer,
  pauseTimer,
  resumeTimer,
  resetTimer,
  remainingMs,
  finishSession,
  durationFor,
} = require('../src/timer');

const settings = { ...DEFAULT_SETTINGS };

 test('a new tracker starts idle with the configured focus duration', () => {
  const state = createTimerState(settings);
  assert.equal(state.mode, 'focus');
  assert.equal(state.status, 'idle');
  assert.equal(state.remainingMs, 25 * 60_000);
  assert.equal(state.completedSessions, 0);
});

test('a running timer derives remaining time from its deadline, not tick counts', () => {
  const running = startTimer(createTimerState(settings), 10_000, settings);
  assert.equal(remainingMs(running, 10_000), 25 * 60_000);
  assert.equal(remainingMs(running, 40_000), 25 * 60_000 - 30_000);
  assert.equal(remainingMs(running, 99_999_999), 0);
});

test('pausing freezes the remaining time and resuming builds a new deadline', () => {
  const running = startTimer(createTimerState(settings), 1000, settings);
  const paused = pauseTimer(running, 31_000);
  assert.equal(paused.status, 'paused');
  assert.equal(paused.remainingMs, 25 * 60_000 - 30_000);
  const resumed = resumeTimer(paused, 100_000);
  assert.equal(resumed.deadlineAt, 100_000 + paused.remainingMs);
});

test('reset returns a paused timer to its configured full duration', () => {
  const running = startTimer(createTimerState(settings), 0, settings);
  const reset = resetTimer(pauseTimer(running, 60_000), settings);
  assert.equal(reset.status, 'idle');
  assert.equal(reset.remainingMs, durationFor('focus', settings));
  assert.equal(reset.deadlineAt, null);
});

test('focus completion increments the count and schedules a short break before cycle four', () => {
  const next = finishSession({ ...createTimerState(settings), status: 'running', mode: 'focus' }, settings);
  assert.equal(next.mode, 'shortBreak');
  assert.equal(next.completedSessions, 1);
  assert.equal(next.focusInCycle, 1);
  assert.equal(next.status, 'idle');
  assert.equal(next.remainingMs, 5 * 60_000);
});

test('every fourth completed focus session schedules the long break', () => {
  const state = { ...createTimerState(settings), focusInCycle: 3, completedSessions: 3 };
  const next = finishSession({ ...state, mode: 'focus', status: 'running' }, settings);
  assert.equal(next.mode, 'longBreak');
  assert.equal(next.focusInCycle, 0);
  assert.equal(next.completedSessions, 4);
  assert.equal(next.remainingMs, 15 * 60_000);
});

test('finishing a break returns to a fresh focus session without changing the focus count', () => {
  const state = { ...createTimerState(settings), mode: 'shortBreak', status: 'running', completedSessions: 2, focusInCycle: 2 };
  const next = finishSession(state, settings);
  assert.equal(next.mode, 'focus');
  assert.equal(next.completedSessions, 2);
  assert.equal(next.focusInCycle, 2);
  assert.equal(next.remainingMs, 25 * 60_000);
});

test('durations are clamped to a usable range when settings are malformed', () => {
  assert.equal(durationFor('focus', { focusMinutes: 0 }), 60_000);
  assert.equal(durationFor('shortBreak', { shortBreakMinutes: 999 }), 120 * 60_000);
});

test('pausing after the deadline completes the session instead of freezing at zero', () => {
  const running = startTimer(createTimerState(settings), 5000, settings);
  const completed = pauseTimer(running, running.deadlineAt + 1, settings);
  assert.equal(completed.status, 'idle');
  assert.equal(completed.mode, 'shortBreak');
  assert.equal(completed.completedSessions, 1);
  assert.equal(completed.remainingMs, durationFor('shortBreak', settings));
});

test('resuming a legacy paused-at-zero timer finalizes it instead of restarting it', () => {
  const expired = { ...createTimerState(settings), status: 'paused', remainingMs: 0 };
  const completed = resumeTimer(expired, 20_000, settings);
  assert.equal(completed.status, 'idle');
  assert.equal(completed.mode, 'shortBreak');
  assert.equal(completed.completedSessions, 1);
  assert.equal(completed.remainingMs, durationFor('shortBreak', settings));
});
