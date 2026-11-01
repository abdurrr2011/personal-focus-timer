# Building and releasing Focus Tracker

## Platform packages

Electron Builder produces these x64/universal packages on native GitHub-hosted runners:

| Runner | Package artifacts |
| --- | --- |
| Windows | NSIS `.exe` installer (x64) |
| macOS | Universal `.dmg` and `.zip` (Intel and Apple silicon) |
| Linux | `.AppImage` and `.deb` (x64) |

Use the matching local command to build on a supported host: `npm run dist:win`, `npm run dist:mac`, or `npm run dist:linux`. Each command runs syntax checks and the test suite before packaging. The macOS command generates its `.icns` from the checked-in PNG using the macOS `sips` and `iconutil` tools.

The `Cross-platform builds and releases` workflow builds on pull requests and can be run manually with **Actions → Cross-platform builds and releases → Run workflow**. These runs upload temporary workflow artifacts and do not create a release. Pull-request and manual builds do not receive signing secrets.

## Create a release draft

1. Update `version` in `package.json` using a semantic version. Keep `package-lock.json` in sync (for example, `npm version 1.0.1 --no-git-tag-version`).
2. Merge the version change to `main`.
3. Create and push a matching annotated tag from the merged commit:

   ```sh
   git tag -a v1.0.1 -m "Focus Tracker v1.0.1"
   git push origin v1.0.1
   ```

4. The tag workflow verifies that the tag matches `package.json`, builds and tests all platforms, generates `SHA256SUMS.txt`, and creates a **draft** GitHub Release with release notes.
5. Review the build logs, signing disclosure, checksums, and installer assets. Publish the release manually in GitHub only after approving it.

The workflow never publishes a release automatically. Pull requests, manual runs, and release tags all start native platform builds. Do not open a PR or push a release tag until you intend to start these builds; GitHub-hosted macOS runners may consume paid Actions minutes depending on the repository plan and remaining quota. Review billing before running workflows.

## Optional signing secrets

Add credentials under **Repository Settings → Secrets and variables → Actions → New repository secret**. Never commit certificates, passwords, Apple credentials, or `.env` files. Release workflow environments receive these secrets only for tagged version builds; pull-request and manual builds remain unsigned.

### Windows

- `WINDOWS_CSC_LINK`: base64-encoded PFX/PKCS#12 code-signing certificate.
- `WINDOWS_CSC_KEY_PASSWORD`: password for that certificate.

When both are configured, electron-builder is required to sign the Windows installer; a signing failure fails the release build. Without them, the installer is unsigned and Windows SmartScreen may display an unknown-publisher warning.

### macOS

- `MACOS_CSC_LINK`: base64-encoded Developer ID Application `.p12` certificate.
- `MACOS_CSC_KEY_PASSWORD`: certificate password.
- `APPLE_API_KEY_P8_BASE64`: base64-encoded App Store Connect API `.p8` key.
- `APPLE_API_KEY_ID`: key ID for that API key.
- `APPLE_API_ISSUER`: App Store Connect issuer ID.

The macOS build is required to code-sign when the certificate pair is present. Notarization is enabled only when the certificate and all three API-key secrets are configured. The workflow writes the decoded key to the ephemeral runner's temporary directory and never logs or commits it. Direct distribution requires an Apple Developer Program account for Developer ID signing/notarization. Without signing, Gatekeeper may block the app; a signed but unnotarized build can still show warnings or be blocked.

### Linux

Linux packages are not code-signed by this pipeline. `SHA256SUMS.txt` detects accidental or malicious modification only when the checksum itself is obtained from a trusted release channel; it does not prove publisher identity.

## Release workflow permissions

The build jobs use `contents: read`. Only the final draft-release job receives `contents: write`, through the workflow-scoped `GITHUB_TOKEN`. No personal access token or third-party publishing service is required.
