const assert = require('node:assert/strict');

const endpoint = process.env.FOCUS_TRACKER_DEBUG_URL || 'http://127.0.0.1:9224/json/list';
const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function main() {
  const targets = await fetch(endpoint).then((response) => response.json());
  const page = targets.find((target) => target.type === 'page' && target.url.endsWith('/renderer/index.html'));
  assert.ok(page, 'Focus Tracker renderer must be open with remote debugging enabled');

  const socket = new WebSocket(page.webSocketDebuggerUrl);
  let nextId = 0;
  const pending = new Map();
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject, timer } = pending.get(message.id);
    clearTimeout(timer);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  };
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = () => reject(new Error('Could not connect to the renderer debugging endpoint'));
  });

  function send(method, params = {}) {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 5000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    }
    return result.result.value;
  }

  async function getSnapshot() {
    return evaluate('window.focusTracker.getSnapshot()');
  }

  async function click(selector) {
    await evaluate(`(() => { const button = document.querySelector(${JSON.stringify(selector)}); if (!button) throw new Error('Missing UI control: ' + ${JSON.stringify(selector)}); button.click(); return true; })()`);
    await pause(180);
  }

  try {
    let snapshot = await getSnapshot();
    assert.equal(snapshot.timer.mode, 'focus');
    assert.equal(snapshot.timer.status, 'idle');
    assert.equal(snapshot.settings.alwaysOnTop, true);
    assert.equal(snapshot.runtime.windowMode, 'dashboard');
    assert.equal(await evaluate('document.body.classList.contains("compact")'), false);
    assert.equal(await evaluate('document.querySelector(\'[data-action="micro"]\').textContent.trim()'), '━ Micro Mode');
    assert.match(snapshot.settings.soundAlertUrl, /assets\/faceit_accept_sound_epic_-8962405019821701368\.mp3$/);
    assert.equal(await evaluate('document.querySelector("#preview-sound").disabled'), false);
    assert.equal(await evaluate('document.querySelector("#sound-file-label").textContent'), 'Built-in MP3');
    console.log('PASS initial focus state and default always-on-top setting');

    await click('[data-action="toggle-timer"]');
    snapshot = await getSnapshot();
    assert.equal(snapshot.timer.status, 'running');
    await pause(1100);
    const afterOneSecond = await getSnapshot();
    assert.ok(afterOneSecond.timer.remainingMs < snapshot.timer.remainingMs, 'deadline timer must advance in the main process');
    await click('[data-action="toggle-timer"]');
    const paused = await getSnapshot();
    assert.equal(paused.timer.status, 'paused');
    console.log('PASS start, elapsed deadline countdown, and pause');

    await click('[data-action="reset"]');
    await click('[data-mode="shortBreak"]');
    snapshot = await getSnapshot();
    assert.equal(snapshot.timer.mode, 'shortBreak');
    assert.equal(snapshot.timer.remainingMs, snapshot.settings.shortBreakMinutes * 60_000);
    await click('[data-view="settings"]');
    assert.equal(await evaluate('!document.querySelector("#view-settings").hidden'), true);
    assert.equal(await evaluate('document.querySelector(\'[name="focusMinutes"]\').value'), '25');
    await evaluate(`(() => {
      window.__previewCalls = [];
      window.Audio = class {
        constructor(source) { this.source = source; window.__previewCalls.push(this); }
        addEventListener() {}
        play() { this.played = true; return Promise.resolve(); }
        pause() { this.paused = true; }
      };
      playCompletionSound({
        settings: { ...state.settings, soundAlerts: true },
      });
      return true;
    })()`);
    await click('[data-action="preview-sound"]');
    assert.deepEqual(await evaluate('({ source: window.__previewCalls[0].source, played: window.__previewCalls[0].played })'), {
      source: snapshot.settings.soundAlertUrl,
      played: true,
    });
    assert.deepEqual(await evaluate('({ source: window.__previewCalls[1].source, played: window.__previewCalls[1].played })'), {
      source: snapshot.settings.soundAlertUrl,
      played: true,
    });
    await evaluate(`(() => {
      render({
        timer: state.timer,
        settings: { ...state.settings, soundAlertUrl: 'file:///preview.wav' },
        runtime: { packaged: false },
      });
      return true;
    })()`);
    await click('[data-action="preview-sound"]');
    assert.deepEqual(await evaluate('({ source: window.__previewCalls[2].source, played: window.__previewCalls[2].played })'), {
      source: 'file:///preview.wav',
      played: true,
    });
    await click('[data-action="reset-sound"]');
    snapshot = await getSnapshot();
    assert.equal(snapshot.settings.soundAlertFile, null);
    assert.match(snapshot.settings.soundAlertUrl, /assets\/faceit_accept_sound_epic_-8962405019821701368\.mp3$/);
    assert.equal(await evaluate('document.querySelector("#sound-file-label").textContent'), 'Built-in MP3');
    assert.equal(await evaluate('window.__previewCalls[2].paused'), true);
    console.log('PASS bundled default MP3, custom preview, restore default, and settings view');

    await evaluate(`(() => {
      document.querySelector('[name="sessionsUntilLongBreak"]').value = '3';
      return true;
    })()`);
    await click('[data-action="save-settings"]');
    snapshot = await getSnapshot();
    assert.equal(snapshot.settings.sessionsUntilLongBreak, 3);
    await click('[data-view="settings"]');
    await evaluate(`(() => {
      document.querySelector('[name="sessionsUntilLongBreak"]').value = '4';
      return true;
    })()`);
    await click('[data-action="save-settings"]');
    console.log('PASS configurable long-break interval');

    await click('[data-view="statistics"]');
    assert.equal(await evaluate('document.querySelectorAll("#weekly-chart .weekly-day").length'), 7);
    assert.equal(await evaluate('document.querySelector("#stat-completed").textContent'), '0');
    await click('[data-view="timer"]');

    await click('[data-action="toggle-timer"]');
    assert.equal((await getSnapshot()).timer.status, 'running');
    await click('[data-action="micro"]');
    assert.equal(await evaluate('document.body.classList.contains("micro")'), true);
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".micro-hud")).webkitAppRegion'), 'drag');
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".micro-toggle")).webkitAppRegion'), 'no-drag');
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".micro-mode-switch")).webkitAppRegion'), 'no-drag');
    snapshot = await getSnapshot();
    assert.equal(snapshot.timer.status, 'running');
    await click('[data-action="expand"]');
    assert.equal(await evaluate('document.body.classList.contains("micro")'), false);
    assert.equal((await getSnapshot()).timer.status, 'running');
    await click('[data-action="toggle-timer"]');
    assert.equal((await getSnapshot()).timer.status, 'paused');
    await click('[data-action="expand"]');
    await click('[data-mode="focus"]');
    await click('[data-action="reset"]');
    snapshot = await getSnapshot();
    assert.equal(snapshot.timer.mode, 'focus');
    assert.equal(snapshot.timer.status, 'idle');
    console.log('PASS Micro Mode preserves the active timer and returns to the dashboard');
  } finally {
    socket.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
