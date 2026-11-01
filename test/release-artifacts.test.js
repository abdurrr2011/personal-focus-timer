const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createReleaseArtifacts } = require('../tools/release-artifacts.cjs');

function withReleaseDirectory(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'focus-tracker-release-'));
  try {
    fs.writeFileSync(path.join(directory, 'Focus-Tracker-1.0.0-test.zip'), 'test artifact');
    run(directory);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('release manifest writes SHA-256 checksums and signing disclosures', () => {
  withReleaseDirectory((directory) => {
    const notes = createReleaseArtifacts(directory, {
      version: '1.0.0',
      tag: 'v1.0.0',
      windowsSigned: false,
      macSigned: true,
      macNotarized: false,
    });
    const digest = crypto.createHash('sha256').update('test artifact').digest('hex');
    assert.equal(fs.readFileSync(path.join(directory, 'SHA256SUMS.txt'), 'utf8'),
      `${digest}  Focus-Tracker-1.0.0-test.zip\n`);
    assert.match(notes, /Windows: unsigned/);
    assert.match(notes, /macOS: signed, but not notarized/);
    assert.match(notes, /prepared as a draft/);
  });
});

test('release manifest refuses mismatched tags and empty artifact directories', () => {
  withReleaseDirectory((directory) => {
    assert.throws(() => createReleaseArtifacts(directory, {
      version: '1.0.0',
      tag: 'v2.0.0',
    }), /must match package version/);
  });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'focus-tracker-release-empty-'));
  try {
    assert.throws(() => createReleaseArtifacts(directory, {
      version: '1.0.0',
      tag: 'v1.0.0',
    }), /No release artifacts/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('release manifest rejects notarization without macOS signing', () => {
  withReleaseDirectory((directory) => {
    assert.throws(() => createReleaseArtifacts(directory, {
      version: '1.0.0',
      tag: 'v1.0.0',
      macSigned: false,
      macNotarized: true,
    }), /macOS build must also be signed/);
  });
});
