<div align="center">
  <a href="https://www.electronjs.org/"><img src="assets/electron-logo.svg" alt="Electron logo" width="96" height="96"></a>
  <h1>Focus Tracker</h1>
  <p><strong>A little more focus. A lot more flow.</strong></p>
  <p>A minimal desktop Pomodoro timer, with sessions, breaks, and your preferences kept on your device.</p>
</div>

## What it does

- Focus, short-break, and long-break sessions, with a configurable long break after 2–8 completed focus sessions (four by default).
- Start, pause, resume, reset, and switch session type; timer state and focus-session history are saved locally.
- Statistics show sessions completed today, focus time today and overall, active-day streaks, and a weekly focus-time chart.
- A History screen lists completed focus and break sessions by date, with their completion time and duration. New individual records start accumulating after this feature is installed; previous daily totals cannot be converted into session records.
- Export History or Statistics to a UTF-8 CSV file using the native Save As dialog. Clearing History requires confirmation and does not change Statistics or previously exported files.
- Deadline-based countdowns continue accurately when the window is hidden, the PC is busy, or the app is reopened.
- Frameless, draggable dashboard window (1160×740, minimum 900×640); optional always-on-top, with an optional Micro Mode timer strip (320×52, minimum 208×38).
- Desktop notifications, optional completion sound (the bundled MP3 by default, or a custom WAV, MP3, OGG, or M4A file), system-tray controls, and optional Windows launch at sign-in.
- Settings are written locally to the app's user-data folder. No network requests, accounts, analytics, or cloud sync.

## Install the app

Download the latest installer from [GitHub Releases](https://github.com/abdurrr2011/personal-focus-timer-desk-app/releases/latest). Choose the package matching your operating system:

- **Windows x64:** run `Focus-Tracker-Setup-<version>.exe`. The installer lets you choose an installation folder and creates Start-menu and desktop shortcuts.
- **macOS (Intel and Apple silicon):** open `Focus-Tracker-<version>-mac-universal.dmg` and move Focus Tracker to Applications. The `.zip` contains the same universal app.
- **Linux x64:** make `Focus-Tracker-<version>-linux-x86_64.AppImage` executable (`chmod +x Focus-Tracker-<version>-linux-x86_64.AppImage`) and run it, or install `Focus-Tracker-<version>-linux-amd64.deb` on a Debian-based distribution with `sudo apt install ./Focus-Tracker-<version>-linux-amd64.deb`.

### Verify downloads

Download `SHA256SUMS.txt` and the installer from the same GitHub Release. Compare the hash of your downloaded file with the line for its exact filename in the checksum file:

```powershell
Get-FileHash .\Focus-Tracker-Setup-<version>.exe -Algorithm SHA256
```

```sh
shasum -a 256 Focus-Tracker-<version>-mac-universal.dmg
```

The command prints the file's SHA-256 hash; confirm it matches the corresponding entry in `SHA256SUMS.txt`. To verify every listed file automatically with `shasum -c SHA256SUMS.txt`, download all the release assets into the same folder first.

Checksums help detect changed or corrupted downloads, but because they are hosted alongside the installers, they do not independently prove who published them.

### Signing and security

Each release's notes state whether its Windows installer is signed and whether its macOS app is signed and notarized. Builds without signing credentials are unsigned:

- **Windows:** unsigned installers may show a SmartScreen unknown-publisher warning.
- **macOS:** unsigned or unnotarized apps may be blocked or show Gatekeeper warnings. Do not disable Gatekeeper to install an app.
- **Linux:** packages are unsigned; use the checksum to check file integrity, not publisher identity.

Only download releases from this project's GitHub repository. If a release is unsigned or macOS will not open it, do not bypass operating-system protections unless you can independently establish that the specific build is trustworthy.

## Develop locally

Requirements: Windows, macOS, or Linux; Node.js 22.12 or newer; npm 11 or newer; and Git. Build each platform on its matching operating-system runner; macOS builds also require Apple's `sips` and `iconutil` utilities.

```powershell
git clone https://github.com/abdurrr2011/personal-focus-timer-desk-app.git
cd focus-tracker
npm ci
npm start
```

For an existing local checkout, skip `git clone` and run the commands from the project folder.

### Checks and build

```powershell
npm run check    # syntax-check main, preload, timer, storage, statistics, exports, history, and renderer code
npm test         # unit tests for timer behavior, durable settings, statistics, CSV exports, and session history
npm run dist     # checks, tests, and build for the current host platform
npm run dist:win # Windows x64 NSIS installer
npm run dist:mac # universal macOS DMG and ZIP (requires macOS)
npm run dist:linux # Linux x64 AppImage and DEB (requires Linux)
```

For a local interactive smoke test, start Electron with a loopback-only debugging port and an isolated data folder, then run `npm run smoke` in another terminal:

```powershell
$env:FOCUS_TRACKER_USER_DATA_DIR = "$env:LOCALAPPDATA\FocusTracker-Smoke"
npm start -- --remote-debugging-port=9224
# In a second terminal, from the repository folder:
npm run smoke
```

The smoke test exercises the dashboard, timer controls, mode selection, settings, statistics and history views, History controls, and switching to Micro Mode while a timer runs. It leaves development data under `FocusTracker-Smoke` so normal app preferences are untouched.

Build output goes to `release/`. Electron Builder packages the app. The cross-platform workflow builds on native Windows, macOS, and Linux runners for pull requests and manual runs. Standard GitHub-hosted runners are free for public repositories; artifact storage and retention are subject to GitHub's plan limits. Version tags matching the package version build all targets, calculate SHA-256 checksums, and prepare an unpublished draft GitHub Release. A maintainer must review and publish that draft manually.

## Using the app

- **Start / pause / resume:** the main button or `Space`.
- **Reset:** the reset button or `R`.
- **Stop:** the square button resets the active session; it does not count as completed.
- **Change mode:** select Focus, Short Break, or Long Break, or press `1`, `2`, or `3` while the app window is focused. Selecting a mode resets the timer to that mode's configured length. Number shortcuts are ignored while typing in a field.
- **Navigation:** use the sidebar to switch between Timer, Statistics, and Settings.
- **Micro Mode:** choose **Micro Mode** for a slim 320 × 52 timer strip with start/pause and mode controls; it can shrink to 208 × 38. Expand returns to the dashboard without interrupting the timer.
- **Statistics:** completed focus sessions update daily activity, the weekly chart, and streaks. Only finished focus sessions count; resetting or stopping early does not. Use **Export CSV** to save the summary metrics and daily totals.
- **History:** completed focus and break sessions are kept locally in `session-history.json`, newest first. All records are retained unless you choose **Clear History** and confirm; clearing does not affect Statistics. Use **Export CSV** to save the session records.
- **Always on top:** enabled by default; turn it off in Settings.
- **Close button:** hides the window to the system tray so an active timer is not lost. Use the tray menu's **Quit Focus Tracker** to exit.
- **Start with Windows:** available in the installed Windows app only.

Session lengths can be configured from 1 to 120 minutes. Changing a duration resets the current session to the new configured length. Choose 2–8 focus sessions before a long break in Settings; changing this interval starts a fresh cycle without changing your lifetime completed-session count.

The bundled MP3 in `assets/` is the default completion alert. Enable **Sound alert** in **Settings** to hear it when a session ends; use **Preview** to listen at any time. To use a different sound, select **Choose file** and choose a WAV, MP3, OGG, or M4A file smaller than 10 MB. The custom sound is copied into the app's local user-data folder. Select **Use default** to restore the bundled MP3.

## Architecture

- **Electron main process:** owns the timer, native notifications, tray, window behavior, and Windows sign-in integration.
- **Renderer:** a local HTML/CSS/JavaScript dashboard with no external runtime dependencies.
- **Preload bridge:** narrow, validated IPC surface; renderer has no Node.js access.
- **Timer:** a deadline timestamp rather than decrementing tick counters, so missed UI frames cannot add time to the session.
- **Persistence:** atomic JSON files in Electron's per-user app-data folder for settings, daily focus aggregates, and the complete session history.

Electron was chosen over a Rust-based wrapper because this Windows environment has Node/npm available but no Rust toolchain. Electron provides the required native desktop features directly and avoids making users install a runtime. The UI itself has no framework dependency.

## Repository map

```text
src/                 Electron main process, preload bridge, timer, storage
                     and statistics/session-history/CSV-export helpers
renderer/            Dashboard UI and styles
assets/              Original Focus Tracker icon assets
 test/                Node built-in test suite
tools/               Icon and release-manifest utilities
.github/workflows/   Windows CI and cross-platform release pipeline
 README.md
 PROJECT_STATUS.md
 TROUBLESHOOTING.md
```

## Security and privacy

The renderer runs with context isolation, sandboxing, and Node integration disabled. A restrictive Content Security Policy blocks network connections and remote scripts. The only IPC functions are exposed by the preload bridge. User settings, timer state, statistics, and session history stay in the local app-data directory.

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common setup and notification issues, [docs/RELEASING.md](docs/RELEASING.md) for release and signing setup, and [PROJECT_STATUS.md](PROJECT_STATUS.md) for verification state and remaining limitations.

## License

This project is licensed under the [MIT License](LICENSE).
