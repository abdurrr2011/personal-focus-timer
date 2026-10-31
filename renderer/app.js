const MODE_INFO = {
  focus: { title: 'FOCUS SESSION', short: 'FOCUS', caption: 'TIME TO MAKE IT COUNT', color: 'focus' },
  shortBreak: { title: 'SHORT BREAK', short: 'SHORT BREAK', caption: 'REST. RESET. RECHARGE.', color: 'break' },
  longBreak: { title: 'LONG BREAK', short: 'LONG BREAK', caption: 'SLOW DOWN. BREATHE. RESET.', color: 'long-break' },
};
const state = { timer: null, settings: null, toastTimeout: null, compact: false, previewAudio: null };
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function formatTime(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function durationForCurrentMode() {
  const key = { focus: 'focusMinutes', shortBreak: 'shortBreakMinutes', longBreak: 'longBreakMinutes' }[state.timer.mode];
  return (state.settings?.[key] || 25) * 60_000;
}

function render(snapshot) {
  if (!snapshot?.timer || !snapshot?.settings) return;
  const previousSoundUrl = state.settings?.soundAlertUrl;
  state.timer = snapshot.timer;
  state.settings = snapshot.settings;
  if (previousSoundUrl !== state.settings.soundAlertUrl) stopSoundPreview();
  const previewButton = $('#preview-sound');
  if (previewButton) previewButton.disabled = !state.settings.soundAlertUrl;
  const soundFileLabel = $('#sound-file-label');
  if (soundFileLabel) soundFileLabel.textContent = state.settings.soundAlertFile ? 'Custom sound selected' : 'System beep';
  const startupSetting = $('#launch-setting');
  const startupInput = startupSetting.querySelector('input');
  const packaged = Boolean(snapshot.runtime?.packaged);
  startupInput.disabled = !packaged;
  startupSetting.classList.toggle('is-disabled', !packaged);
  startupSetting.querySelector('small').textContent = packaged ? 'Open Focus Tracker when you sign in.' : 'Available in the installed Windows app.';
  const timer = state.timer;
  const info = MODE_INFO[timer.mode] || MODE_INFO.focus;
  document.body.classList.remove('break-mode', 'long-break-mode');
  if (timer.mode !== 'focus') document.body.classList.add(`${info.color}-mode`);

  const remaining = Math.max(0, timer.remainingMs);
  const duration = durationForCurrentMode();
  const progress = Math.min(100, Math.max(0, (1 - remaining / duration) * 100));
  const percentage = Math.floor(progress);
  const isRunning = timer.status === 'running';

  $('#timer-value').textContent = formatTime(remaining);
  $('#timer-status').textContent = isRunning ? 'SESSION IN MOTION' : timer.status === 'paused' ? 'SESSION PAUSED' : 'READY WHEN YOU ARE';
  $('#session-title').textContent = info.title;
  $('#timer-caption').textContent = info.caption;
  $('#session-indicator').classList.toggle('is-running', isRunning);
  $('#session-number').textContent = String(timer.completedSessions + 1).padStart(2, '0');
  $('#total-sessions').textContent = String(timer.completedSessions).padStart(2, '0');
  $('#timer-orbit').style.setProperty('--progress', `${progress}%`);
  $('#progress-percent').textContent = `${percentage}%`;
  $('#pixel-progress').setAttribute('aria-valuenow', String(percentage));

  const filledSegments = Math.round(progress / 100 * 32);
  $$('.progress-segment').forEach((segment, index) => segment.classList.toggle('filled', index < filledSegments));
  const cycleLength = state.settings.sessionsUntilLongBreak;
  const cycle = timer.focusInCycle % cycleLength;
  $('#cycle-label').textContent = `${cycle} of ${cycleLength} focus sessions complete`;
  $('#cycle-blocks').innerHTML = Array.from({ length: cycleLength }, (_, index) => `<span class="cycle-unit${index < cycle ? ' done' : ''}" aria-label="Focus session ${index + 1}${index < cycle ? ' completed' : ' upcoming'}">${index < cycle ? '✓' : `0${index + 1}`}</span>`).join('');
  $('#next-break-label').textContent = timer.mode === 'focus' && cycle === cycleLength - 1 ? 'LONG BREAK' : timer.mode === 'focus' ? 'SHORT BREAK' : 'FOCUS SESSION';
  $('#play-symbol').textContent = isRunning ? 'Ⅱ' : '▶';
  $('#toggle-label').textContent = isRunning ? 'PAUSE SESSION' : timer.status === 'paused' ? `RESUME ${info.short}` : `START ${info.short}`;
  $('#top-status-text').textContent = isRunning ? `${info.short} IN PROGRESS` : timer.status === 'paused' ? 'SESSION PAUSED' : 'READY TO FOCUS';
  $$('.mode-tab, .side-mode').forEach((button) => button.classList.toggle('active', button.dataset.mode === timer.mode));
  $$('.side-mode').forEach((button) => button.classList.toggle('selected', button.dataset.mode === timer.mode));
  $$('[data-duration]').forEach((label) => {
    const value = state.settings[label.dataset.duration];
    label.textContent = `${String(value).padStart(2, '0')}m`;
  });
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(state.toastTimeout);
  state.toastTimeout = setTimeout(() => toast.classList.remove('visible'), 2800);
}

function openSettings() {
  if (!state.settings) return;
  const modal = $('#settings-modal');
  for (const [key, value] of Object.entries(state.settings)) {
    const input = modal.querySelector(`[name="${key}"]`);
    if (input) input.type === 'checkbox' ? input.checked = value : input.value = String(value);
  }
  modal.hidden = false;
  modal.querySelector('input').focus();
}

function closeSettings() {
  stopSoundPreview();
  $('#settings-modal').hidden = true;
}

async function saveSettings() {
  const form = $('#settings-modal');
  const values = {};
  for (const input of form.querySelectorAll('input[name]')) {
    values[input.name] = input.type === 'checkbox' ? input.checked : Math.min(120, Math.max(1, Number.parseInt(input.value, 10) || 1));
  }
  try {
    const snapshot = await window.focusTracker.saveSettings(values);
    render(snapshot);
    closeSettings();
    showToast('SETTINGS SAVED ON THIS DEVICE');
  } catch {
    showToast('COULD NOT SAVE SETTINGS');
  }
}

async function command(action, value) {
  try {
    const snapshot = await window.focusTracker.command(action, value);
    if (snapshot) render(snapshot);
  } catch {
    showToast('THAT ACTION COULD NOT BE COMPLETED');
  }
}

async function toggleTimer() {
  if (!state.timer) return;
  if (state.timer.status === 'running') return command('pause');
  if (state.timer.status === 'paused') return command('resume');
  return command('start');
}

async function doWindowAction(action) {
  try {
    const result = await window.focusTracker.windowAction(action);
    if (action === 'compact' && typeof result === 'boolean') {
      state.compact = result;
      document.body.classList.toggle('compact', result);
    }
  } catch {
    showToast('WINDOW ACTION UNAVAILABLE');
  }
}

async function chooseAlertSound() {
  try {
    const snapshot = await window.focusTracker.chooseAlertSound();
    if (!snapshot) return;
    render(snapshot);
    showToast('CUSTOM ALERT SOUND SAVED');
  } catch (error) {
    console.error('Could not select alert sound:', error);
    showToast('COULD NOT SELECT ALERT SOUND');
  }
}

async function resetAlertSound() {
  try {
    const snapshot = await window.focusTracker.resetAlertSound();
    render(snapshot);
    showToast('SYSTEM BEEP RESTORED');
  } catch (error) {
    console.error('Could not restore system alert sound:', error);
    showToast('COULD NOT RESTORE SYSTEM BEEP');
  }
}

function stopSoundPreview() {
  if (!state.previewAudio) return;
  state.previewAudio.pause();
  state.previewAudio = null;
}

function previewAlertSound() {
  const soundUrl = state.settings?.soundAlertUrl;
  if (!soundUrl) {
    showToast('CHOOSE A CUSTOM SOUND FIRST');
    return;
  }

  stopSoundPreview();
  const audio = new Audio(soundUrl);
  state.previewAudio = audio;
  audio.addEventListener('ended', () => {
    if (state.previewAudio === audio) state.previewAudio = null;
  }, { once: true });
  audio.play().catch((error) => {
    if (state.previewAudio === audio) state.previewAudio = null;
    console.error('Alert sound preview failed:', error);
    showToast('COULD NOT PLAY ALERT SOUND');
  });
}

function playCompletionSound(snapshot) {
  if (!snapshot.settings?.soundAlerts || !snapshot.settings.soundAlertUrl) return;
  const audio = new Audio(snapshot.settings.soundAlertUrl);
  audio.play().catch((error) => console.error('Custom alert sound failed:', error));
}

function bindInteractions() {
  $('#pixel-progress').replaceChildren(...Array.from({ length: 32 }, () => {
    const segment = document.createElement('span');
    segment.className = 'progress-segment';
    return segment;
  }));
  document.addEventListener('click', (event) => {
    const modeButton = event.target.closest('[data-mode]');
    if (modeButton) {
      command('mode', modeButton.dataset.mode);
      return;
    }
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;
    const actions = {
      'toggle-timer': toggleTimer,
      reset: () => command('reset'),
      stop: () => { command('reset'); showToast('SESSION STOPPED'); },
      'open-settings': openSettings,
      'close-settings': closeSettings,
      'save-settings': saveSettings,
      'choose-sound': chooseAlertSound,
      'preview-sound': previewAlertSound,
      'reset-sound': resetAlertSound,
      minimize: () => doWindowAction('minimize'),
      close: () => doWindowAction('hide'),
      compact: () => doWindowAction('compact'),
    };
    actions[actionButton.dataset.action]?.();
  });

  $('#settings-modal').addEventListener('click', (event) => {
    if (event.target === $('#settings-modal')) closeSettings();
  });
  document.addEventListener('keydown', (event) => {
    const modalOpen = !$('#settings-modal').hidden;
    const isTyping = event.target.matches('input, textarea, select, [contenteditable="true"]');
    if (event.key === 'Escape' && modalOpen) closeSettings();
    if (modalOpen || isTyping || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.code === 'Space') { event.preventDefault(); toggleTimer(); }
    if (event.key.toLowerCase() === 'r') command('reset');
  });

  window.focusTracker.onTick(render);
  window.focusTracker.onComplete((snapshot) => {
    render(snapshot);
    playCompletionSound(snapshot);
    const completedMode = snapshot.completedMode || snapshot.timer.mode;
    const completedLabel = completedMode === 'longBreak' ? 'LONG BREAK' : completedMode === 'shortBreak' ? 'SHORT BREAK' : 'FOCUS';
    showToast(`${completedLabel} COMPLETE — ${completedMode === 'focus' ? 'TIME FOR A BREAK' : 'TIME TO FOCUS'}`);
  });
}

function updateClock() {
  const now = new Date();
  $('#local-time').textContent = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  $('#local-date').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(now);
}

async function initialize() {
  bindInteractions();
  updateClock();
  setInterval(updateClock, 30_000);
  try {
    const snapshot = await window.focusTracker.getSnapshot();
    render(snapshot);
  } catch {
    showToast('COULD NOT LOAD SAVED SESSION');
  }
}

initialize();
