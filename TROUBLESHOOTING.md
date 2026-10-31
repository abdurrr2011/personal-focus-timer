# Troubleshooting

## The installer is blocked or says the publisher is unknown

The current installer is unsigned. SmartScreen can warn for an unsigned or newly built application. Only continue if the installer came from a build you trust. Code signing is not configured in this repository.

## Timer continues after I close the window

The title-bar close button hides Focus Tracker to the notification area (system tray) by design, so a running session is not stopped accidentally. Open the tray menu and select **Quit Focus Tracker** to exit. Reset or stop a timer before quitting if you do not want it restored later.

## I cannot find the system-tray icon

Look in the Windows notification-area overflow (the `^` arrow near the clock). Click the Focus Tracker icon to reopen the dashboard, or right-click it for timer controls and Quit.

## Desktop notifications do not appear

Check **Preferences → Desktop notifications** and Windows **Settings → System → Notifications**. Focus Assist / Do not disturb can suppress notifications. Notifications are shown only when supported by Windows and the option is enabled.

## The window is hidden behind another app

**Settings → Always on top** is enabled by default. Turn it on again if it was disabled. Micro Mode retains the same always-on-top setting.

## Start with Windows is unavailable

The sign-in option is enabled only in the installed, packaged Windows app. When developing from source, the control is intentionally disabled because the Electron development executable is not a reliable sign-in target. Install the NSIS build to use it.

## Settings or timer state reset

Settings live in Electron's per-user application-data directory (`%APPDATA%\focus-tracker` or the Electron-resolved equivalent). Avoid deleting that folder. If its JSON file is malformed, the app starts safely with defaults. An installer upgrade normally leaves this data intact.

## Build fails with a missing Windows packaging tool

Run `npm ci` from the repository root on Windows 11 x64, then `npm run dist`. electron-builder downloads its required packaging tools during the build. Keep network access available during the first build. The repository's CI uses a clean Windows runner to build and test the installer.

## The installer works but Windows blocks notifications or startup registration

Windows notification delivery and automatic sign-in behavior depend on local policy and app registration. The timer itself does not rely on either feature. You can still use the timer and tray menu if notifications or startup registration are restricted by your device administrator.

## Still stuck?

Capture the relevant error from the terminal when running `npm start`, include your Windows version and Node version, and file an issue in the repository. Do not attach the contents of the user-data settings file if it contains information you consider private.
