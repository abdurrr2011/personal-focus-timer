const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStore, sanitizeSettings, sanitizeActivity } = require('../src/store');
const { createSessionRecord } = require('../src/session-history');

function withStore(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'focus-tracker-'));
  try { run(createStore(directory)); } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}

test('a missing settings file loads usable defaults', () => {
  withStore((store) => {
    const data = store.load();
    assert.equal(data.settings.focusMinutes, 25);
    assert.equal(data.settings.alwaysOnTop, true);
    assert.equal(data.timer, null);
    assert.deepEqual(data.activity, {});
  });
});

test('daily focus activity survives a store reload', () => {
  withStore((store) => {
    const activity = { '2026-10-31': { completedSessions: 3, focusMinutes: 75 } };
    store.save({ settings: {}, activity });
    assert.deepEqual(createStore(store.directory).load().activity, activity);
  });
});

test('malformed daily activity is ignored and valid totals are sanitized', () => {
  assert.deepEqual(sanitizeActivity({
    '2026-02-30': { completedSessions: 1, focusMinutes: 25 },
    'not-a-date': { completedSessions: 2, focusMinutes: 50 },
    '2026-10-31': { completedSessions: '1', focusMinutes: 25 },
    '2026-10-30': { completedSessions: 2, focusMinutes: 50 },
  }), {
    '2026-10-30': { completedSessions: 2, focusMinutes: 50 },
  });
});

test('completed-session history is stored separately and survives reloads', () => {
  withStore((store) => {
    const history = [
      createSessionRecord('shortBreak', new Date('2026-10-31T12:05:00.000Z'), 5 * 60_000),
      createSessionRecord('focus', new Date('2026-10-31T12:00:00.000Z'), 25 * 60_000),
    ];
    store.save({ settings: {}, activity: { '2026-10-31': { completedSessions: 1, focusMinutes: 25 } } });
    store.saveSessionHistory(history);
    const loaded = createStore(store.directory);
    assert.notEqual(store.historyFilePath, store.filePath);
    assert.deepEqual(loaded.loadSessionHistory(), history);
    assert.deepEqual(loaded.load().activity, { '2026-10-31': { completedSessions: 1, focusMinutes: 25 } });
  });
});

test('clearing session history persists an empty list without changing statistics', () => {
  withStore((store) => {
    const activity = { '2026-10-31': { completedSessions: 2, focusMinutes: 50 } };
    store.save({ settings: {}, activity });
    store.saveSessionHistory([
      createSessionRecord('focus', new Date('2026-10-31T12:00:00.000Z'), 25 * 60_000),
    ]);

    store.saveSessionHistory([]);
    const reloaded = createStore(store.directory);
    assert.deepEqual(reloaded.loadSessionHistory(), []);
    assert.deepEqual(reloaded.load().activity, activity);
  });
});

test('a missing session-history file starts with an empty history', () => {
  withStore((store) => {
    assert.deepEqual(store.loadSessionHistory(), []);
  });
});

test('corrupt session-history data is reported instead of silently discarded', () => {
  withStore((store) => {
    fs.writeFileSync(store.historyFilePath, '{invalid json');
    assert.throws(() => store.loadSessionHistory(), SyntaxError);
  });
});

test('session history retains more than 500 records', () => {
  withStore((store) => {
    const history = Array.from({ length: 600 }, (_unused, index) => (
      createSessionRecord('focus', new Date(Date.UTC(2026, 9, 31, 12, index)), 25 * 60_000)
    ));
    store.saveSessionHistory(history);
    assert.equal(store.loadSessionHistory().length, 600);
  });
});

test('an empty session-history file is reported as corrupt', () => {
  withStore((store) => {
    fs.writeFileSync(store.historyFilePath, '');
    assert.throws(() => store.loadSessionHistory(), SyntaxError);
  });
});

test('settings and timer state survive a store reload', () => {
  withStore((store) => {
    store.save({ settings: { focusMinutes: 40, notifications: false }, timer: { mode: 'focus', status: 'paused', remainingMs: 42_000 } });
    const loaded = createStore(store.directory).load();
    assert.equal(loaded.settings.focusMinutes, 40);
    assert.equal(loaded.settings.notifications, false);
    assert.equal(loaded.settings.shortBreakMinutes, 5);
    assert.equal(loaded.timer.remainingMs, 42_000);
  });
});

test('malformed settings are clamped and unknown keys are ignored', () => {
  const settings = sanitizeSettings({
    focusMinutes: 0,
    longBreakMinutes: 900,
    alwaysOnTop: 'yes',
    soundAlertFile: 'C:\\private\\sound.wav',
    surprise: true,
  });
  assert.equal(settings.focusMinutes, 1);
  assert.equal(settings.longBreakMinutes, 120);
  assert.equal(settings.alwaysOnTop, true);
  assert.equal(settings.soundAlertFile, null);
  assert.equal('surprise' in settings, false);
});

test('long-break interval defaults and clamps to two through eight sessions', () => {
  assert.equal(sanitizeSettings().sessionsUntilLongBreak, 4);
  assert.equal(sanitizeSettings({ sessionsUntilLongBreak: 1 }).sessionsUntilLongBreak, 2);
  assert.equal(sanitizeSettings({ sessionsUntilLongBreak: 99 }).sessionsUntilLongBreak, 8);
  assert.equal(sanitizeSettings({ sessionsUntilLongBreak: 'invalid' }).sessionsUntilLongBreak, 4);
});

test('a selected alert sound filename survives a store reload', () => {
  withStore((store) => {
    const soundAlertFile = 'alert-12345678-1234-1234-1234-123456789abc.wav';
    store.save({ settings: { soundAlerts: true, soundAlertFile } });
    assert.equal(createStore(store.directory).load().settings.soundAlertFile, soundAlertFile);
  });
});

test('corrupt saved data safely falls back to defaults', () => {
  withStore((store) => {
    fs.writeFileSync(store.filePath, '{not valid json');
    assert.equal(store.load().settings.focusMinutes, 25);
  });
});
