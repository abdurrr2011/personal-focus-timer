<div align="center">
  <a href="https://www.electronjs.org/"><img src="assets/electron-logo.svg" alt="Electron logo" width="96" height="96"></a>
  <h1>Focus Tracker</h1>
  <p><strong>A little more focus. A lot more flow.</strong></p>
  <p>A neon-pixel Pomodoro timer for Windows 11, with sessions, breaks, and your preferences kept on your device.</p>
</div>

## What it does

- Focus, short-break, and long-break sessions, with a configurable long break after 2–8 completed focus sessions (four by default).
- Start, pause, resume, reset, and switch session type; session totals and cycle progress are saved.
- Deadline-based countdowns continue accurately when the window is hidden, the PC is busy, or the app is reopened.
- Frameless, draggable window; optional always-on-top; starts in the compact HUD (375×195, minimum 242×125), with a labeled Micro Mode button for the 320×52 timer strip (minimum 208×38).
- Windows desktop notifications, optional completion sound (the bundled MP3 by default, or a custom WAV, MP3, OGG, or M4A file), system-tray controls, and optional launch at sign-in.
- Settings are written locally to the app's user-data folder. No network requests, accounts, analytics, or cloud sync.

## Install the Windows app

Download the Windows installer from the project's [latest GitHub release](https://github.com/abdurrr2011/focus-tracker/releases/latest). If there is no published release yet, download the `focus-tracker-windows-x64` artifact from a successful run on the [Actions page](https://github.com/abdurrr2011/focus-tracker/actions/workflows/windows.yml). The installer offers a choice of installation directory and adds Start-menu and desktop shortcuts. No separate Node.js installation is needed to run the installed app.

The installer is currently unsigned. Windows SmartScreen may show an unknown-publisher warning; verify that the installer came from a trusted build before allowing it to run.

## Develop locally

Requirements: Windows 11 x64, Node.js 22.12 or newer, npm 11 or newer, and Git. The Windows installer is built on Windows; the development scripts and timer unit tests use Node.js.

```powershell
git clone https://github.com/abdurrr2011/focus-tracker.git
cd focus-tracker
npm ci
npm start
```

For an existing local checkout, skip `git clone` and run the commands from the project folder.

### Checks and build

```powershell
npm run check    # syntax-check main, preload, timer, storage, and renderer code
npm test         # unit tests for timer behavior and durable settings
npm run dist     # checks, tests, then create the Windows x64 NSIS installer
```

For a local interactive smoke test, start Electron with a loopback-only debugging port and an isolated data folder, then run `npm run smoke` in another terminal:

```powershell
$env:FOCUS_TRACKER_USER_DATA_DIR = "$env:LOCALAPPDATA\FocusTracker-Smoke"
npm start -- --remote-debugging-port=9224
# In a second terminal, from the repository folder:
npm run smoke
```

The smoke test exercises the compact startup view, start, countdown, pause, reset, mode selection, preferences, and switching between compact, micro, and dashboard layouts while a timer runs. It leaves the development data under `FocusTracker-Smoke` so normal app preferences are untouched.

Build output goes to `release/`. `npm run dist` uses electron-builder to package Electron and produce an NSIS setup executable. CI runs the same checks and uploads the installer as a build artifact.

## Using the app

- **Start / pause / resume:** the main button or `Space`.
- **Reset:** the reset button or `R`.
- **Stop:** the square button resets the active session; it does not count as completed.
- **Change mode:** select Focus, Short Break, or Long Break. Selecting a mode resets the timer to that mode's configured length.
- **Compact HUD:** the app opens in its 375 × 195 floating timer by default; it can shrink to 242 × 125. Use **Expand** to open the dashboard, or **COMPACT HUD** in the dashboard to return.
- **Micro mode:** choose **MICRO MODE** for a slim 320 × 52 timer strip with start/pause and mode controls; it can shrink to 208 × 38. Expand returns to the dashboard without interrupting the timer.
- **Always on top:** enabled by default; turn it off in Preferences.
- **Close button:** hides the window to the system tray so an active timer is not lost. Use the tray menu's **Quit Focus Tracker** to exit.
- **Start with Windows:** available in the installed Windows app. It is disabled when running from source because a development checkout is not a stable sign-in target.

Session lengths can be configured from 1 to 120 minutes. Changing a duration resets the current session to the new configured length. Choose 2–8 focus sessions before a long break in Preferences; changing this interval starts a fresh cycle without changing your lifetime completed-session count.

The bundled MP3 in `assets/` is the default completion alert. Enable **Sound alert** in **Preferences** to hear it when a session ends; use **Preview** to listen at any time. To use a different sound, select **Choose file** and choose a WAV, MP3, OGG, or M4A file smaller than 10 MB. The custom sound is copied into the app's local user-data folder. Select **Use default** to restore the bundled MP3.

## Architecture

- **Electron main process:** owns the timer, native notifications, tray, window behavior, and Windows sign-in integration.
- **Renderer:** a local HTML/CSS/JavaScript dashboard with no external runtime dependencies.
- **Preload bridge:** narrow, validated IPC surface; renderer has no Node.js access.
- **Timer:** a deadline timestamp rather than decrementing tick counters, so missed UI frames cannot add time to the session.
- **Persistence:** small atomic JSON file in Electron's per-user app-data folder.

Electron was chosen over a Rust-based wrapper because this Windows environment has Node/npm available but no Rust toolchain. Electron provides the required native desktop features directly and avoids making users install a runtime. The UI itself has no framework dependency.

## Repository map

```text
src/                 Electron main process, preload bridge, timer, storage
renderer/            Dashboard UI and styles
assets/              Original Focus Tracker icon assets
 test/                Node built-in test suite
 tools/               Icon-generation utility (Python standard library)
 .github/workflows/   Windows CI and installer artifact
 README.md
 PROJECT_STATUS.md
 TROUBLESHOOTING.md
```

## Security and privacy

The renderer runs with context isolation, sandboxing, and Node integration disabled. A restrictive Content Security Policy blocks network connections and remote scripts. The only IPC functions are exposed by the preload bridge. User settings and timer state stay in the local app-data directory.

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common Windows setup and notification issues, and [PROJECT_STATUS.md](PROJECT_STATUS.md) for verification state and remaining limitations.
