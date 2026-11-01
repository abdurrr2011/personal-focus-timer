const test = require('node:test');
const assert = require('node:assert/strict');
const { createSessionRecord, sanitizeSessionHistory } = require('../src/session-history');

test('records completed focus and break sessions with mode, time, and duration', () => {
  const completedAt = new Date('2026-10-31T12:00:00.000Z');
  for (const mode of ['focus', 'shortBreak', 'longBreak']) {
    const record = createSessionRecord(mode, completedAt, 25 * 60_000);
    assert.match(record.id, /^[\da-f-]{36}$/i);
    assert.equal(record.mode, mode);
    assert.equal(record.completedAt, completedAt.toISOString());
    assert.equal(record.durationMinutes, 25);
  }
});

test('history validation retains every record and orders newest first', () => {
  const older = createSessionRecord('focus', new Date('2026-10-30T12:00:00.000Z'), 25 * 60_000);
  const newer = createSessionRecord('longBreak', new Date('2026-10-31T12:00:00.000Z'), 15 * 60_000);
  const history = sanitizeSessionHistory([older, newer, older]);
  assert.deepEqual(history, [newer, older, older]);
});

test('session records reject invalid mode, time, and duration', () => {
  assert.throws(() => createSessionRecord('other', new Date(), 60_000), RangeError);
  assert.throws(() => createSessionRecord('focus', new Date(NaN), 60_000), TypeError);
  assert.throws(() => createSessionRecord('focus', new Date(), 30_000), RangeError);
});

test('stored history rejects malformed records rather than silently dropping them', () => {
  assert.throws(() => sanitizeSessionHistory([{ mode: 'focus' }]), /record 0 is invalid/);
  assert.throws(() => sanitizeSessionHistory([{
    id: 'record',
    mode: 'focus',
    completedAt: 'not a date',
    durationMinutes: 25,
  }]), /invalid completion time/);
});
