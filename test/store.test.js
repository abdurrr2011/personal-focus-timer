const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStore, sanitizeSettings } = require('../src/store');

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
