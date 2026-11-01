const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function createReleaseArtifacts(directory, options) {
  const { version, tag, windowsSigned, macSigned, macNotarized } = options;
  if (tag !== `v${version}`) {
    throw new Error(`Release tag ${tag} must match package version v${version}`);
  }
  if (macNotarized && !macSigned) throw new Error('A notarized macOS build must also be signed');

  const files = fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name !== 'SHA256SUMS.txt')
    .map((entry) => entry.name)
    .sort();
  if (files.length === 0) throw new Error('No release artifacts were found');

  const checksums = files.map((name) => {
    const contents = fs.readFileSync(path.join(directory, name));
    return `${crypto.createHash('sha256').update(contents).digest('hex')}  ${name}`;
  });
  fs.writeFileSync(path.join(directory, 'SHA256SUMS.txt'), `${checksums.join('\n')}\n`, 'utf8');

  const macSigning = macSigned
    ? macNotarized ? 'signed and notarized' : 'signed, but not notarized'
    : 'unsigned';
  return [
    `# Focus Tracker ${tag}`,
    '',
    '## Downloads',
    '',
    'Choose the installer for your operating system. Verify downloaded files against `SHA256SUMS.txt`.',
    '',
    '## Signing status',
    '',
    `- Windows: ${windowsSigned ? 'code-signed' : 'unsigned'}.`,
    `- macOS: ${macSigning}.`,
    '- Linux: unsigned packages; SHA-256 checksums are provided for integrity verification.',
    '',
    'Unsigned Windows installers can show a SmartScreen warning. Unsigned or unnotarized macOS builds can be blocked by Gatekeeper; users may need to explicitly allow the app in macOS Privacy & Security settings.',
    '',
    'This release was prepared as a draft. Review the assets and signing status before publishing.',
    '',
  ].join('\n');
}

if (require.main === module) {
  const directory = path.resolve(process.argv[2] || 'release-assets');
  const version = require('../package.json').version;
  const tag = process.env.GITHUB_REF_NAME || `v${version}`;
  const macSigned = process.env.MACOS_SIGNED === 'true';
  const macNotarized = process.env.MACOS_NOTARIZED === 'true';
  const notes = createReleaseArtifacts(directory, {
    version,
    tag,
    windowsSigned: process.env.WINDOWS_SIGNED === 'true',
    macSigned,
    macNotarized,
  });
  fs.writeFileSync(path.resolve('release-notes.md'), notes, 'utf8');
}

module.exports = { createReleaseArtifacts };
