const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const assets = path.join(__dirname, '..', 'assets');
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test('Windows icon assets provide a 256-by-256 PNG-backed ICO entry', () => {
  const icon = fs.readFileSync(path.join(assets, 'focus-mark.ico'));
  const png = fs.readFileSync(path.join(assets, 'focus-mark.png'));
  assert.equal(icon.readUInt16LE(0), 0, 'ICO reserved header must be zero');
  assert.equal(icon.readUInt16LE(2), 1, 'ICO image type must be icon');
  assert.equal(icon.readUInt16LE(4), 1, 'ICO must contain one image entry');
  assert.equal(icon.readUInt8(6), 0, 'ICO width byte zero denotes 256 pixels');
  assert.equal(icon.readUInt8(7), 0, 'ICO height byte zero denotes 256 pixels');

  const imageOffset = icon.readUInt32LE(18);
  assert.deepEqual(icon.subarray(imageOffset, imageOffset + 8), PNG_SIGNATURE);
  assert.equal(icon.readUInt32BE(imageOffset + 16), 256);
  assert.equal(icon.readUInt32BE(imageOffset + 20), 256);
  assert.equal(png.readUInt32BE(16), 256);
  assert.equal(png.readUInt32BE(20), 256);
});

test('the bundled default alert is an MP3 asset', () => {
  const sound = fs.readFileSync(path.join(assets, 'faceit_accept_sound_epic_-8962405019821701368.mp3'));
  assert.ok(sound.length > 3, 'MP3 asset must not be empty');
  assert.equal(sound.toString('ascii', 0, 3), 'ID3', 'MP3 asset must contain an ID3 header');
});
