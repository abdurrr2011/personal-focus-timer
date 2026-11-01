# Project status

**Current stage:** Cross-platform package builds and draft-release automation are implemented and verified on native GitHub runners. Release publication remains manual.

## Milestones

- [x] Inspect the supplied design reference and Windows development environment.
- [x] Choose the stack and initialize an isolated Git repository.
- [x] Implement and test deadline-based timer transitions and settings persistence.
- [x] Build the dashboard, settings, Micro Mode, and keyboard controls.
- [x] Add persistent daily focus history, statistics, and weekly activity chart.
- [x] Add a local History view for completed focus and break sessions.
- [x] Add confirmed History clearing and CSV exports for History and Statistics.
- [x] Configure native Windows, macOS, and Linux release builds.
- [x] Add tag-version validation, SHA-256 manifests, signing status, and draft GitHub Releases.
- [x] Build Windows, macOS, and Linux packages on native GitHub runners.
- [ ] Install and launch the packaged app on each operating system.
- [x] Integrate native notifications, tray controls, always-on-top, and Windows sign-in setting.
- [x] Add documentation, Git configuration, automated tests, and Windows CI.
- [x] Build and verify the Windows x64 NSIS installer artifact.
- [x] Run the desktop source smoke test for timer controls, mode selection, settings, and Micro Mode.
- [x] Complete the final code/build review and commit the verified release state.

## Technical decisions

- **Electron + plain JavaScript:** selected for native Windows tray, notifications, frameless windows, and packaging with the available Node/npm toolchain. No Rust compiler was available during environment inspection.
- **Main-process timer:** an absolute deadline is authoritative; UI polling is presentation only. This prevents timer drift while the renderer is backgrounded or busy and permits accurate restoration after relaunch.
- **Local JSON settings:** persisted under Electron's app-data directory with a temporary-file rename to avoid partial writes.
- **Security boundary:** sandboxed, context-isolated renderer; Node integration disabled; restrictive Content Security Policy; IPC limited to explicit timer/settings/window operations.
- **Packaging:** Electron Builder targets Windows NSIS x64, macOS universal DMG/ZIP, and Linux x64 AppImage/DEB.

## Verification record

- **Environment inspected:** Windows 11 (build 26200), Node.js 24.18.1, npm 11.16.0, Git 2.53.0; no Rust toolchain or Python `pip` in the selected Python environment.
- **Automated tests:** 43 Node built-in tests pass, covering timer state, session history, CSV exports, release checksums, signing disclosures, persistence, settings, and platform-specific UI behavior.
- **Docker verification:** Node.js 24.22.2 / npm 11.19.1; `npm run check`, all 15 tests, and `npm audit` passed inside a Docker container limited to 2 CPUs and 2 GiB, with the repository mounted read-only and Linux `node_modules` isolated in a named volume.
- **Windows installer:** `npm run dist:win` passed and produced the x64 NSIS installer. It is unsigned because no certificate is configured.
- **Native CI package builds:** PR #12 built and uploaded the Windows x64 NSIS installer, universal macOS DMG/ZIP, and Linux x64 AppImage/DEB. All three native build jobs passed. The packages have not been installed and launched on each OS.
- **Release pipeline:** workflow YAML, release-tag matching, and checksum generation were tested locally. The tag-triggered draft-release job has not been run; no release was created or published.
- **Desktop source smoke-test:** passed timer controls, mode selection, Settings, Statistics, History controls, and switching to Micro Mode without interrupting the timer. A separate startup test confirmed that a restored paused-at-zero break is recorded in history. The production installer has not yet been installed/launched for a separate end-to-end check.

## Known limitations

- Signing and notarization credentials are not present in the local environment; unsigned package warnings and limitations are documented.
- macOS and Linux packages require native GitHub-hosted runners and have not yet been built in this Windows environment.
- GitHub release automation creates drafts only; publishing a release remains a manual action.
- Windows startup integration is active only for the installed, packaged app; it is intentionally disabled in source/development mode.
- Notifications are subject to Windows notification settings, Focus Assist, and device policy.
- There is no automated visual regression suite or cross-OS packaged-install smoke test.

Update this file when the build/test state changes. Do not mark packaging or a desktop test complete until actual tool output confirms it.
