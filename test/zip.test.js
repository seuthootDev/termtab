import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';
import { crc32, buildZip } from '../scripts/zip.mjs';

/** Minimal reader: walks the central directory and inflates each entry. */
function readZip(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(eocd >= 0, 'end of central directory found');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = [];
  for (let i = 0; i < count; i++) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50, 'central header signature');
    const flags = buf.readUInt16LE(p + 8);
    const method = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const csize = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28);
    const xlen = buf.readUInt16LE(p + 30);
    const clen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nlen).toString('utf8');
    assert.equal(buf.readUInt32LE(local), 0x04034b50, 'local header signature');
    const lnlen = buf.readUInt16LE(local + 26);
    const lxlen = buf.readUInt16LE(local + 28);
    assert.equal(buf.subarray(local + 30, local + 30 + lnlen).toString('utf8'), name, 'local name matches');
    const start = local + 30 + lnlen + lxlen;
    const raw = buf.subarray(start, start + csize);
    const data = method === 8 ? inflateRawSync(raw) : Buffer.from(raw);
    assert.equal(data.length, size, `${name} size`);
    assert.equal(crc32(data), crc, `${name} crc`);
    out.push({ name, data, flags, method });
    p += 46 + nlen + xlen + clen;
  }
  return out;
}

test('crc32 of "123456789" is the standard check value', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
  assert.equal(crc32(Buffer.alloc(0)), 0);
});

test('buildZip round-trips names and contents with deflate', () => {
  const big = Buffer.from('termtab '.repeat(500));
  const files = [
    { name: 'manifest.json', data: Buffer.from('{"manifest_version":3}') },
    { name: 'lib/store.js', data: big },
    { name: '_locales/ko/messages.json', data: Buffer.from('{"a":{"message":"새 탭"}}') },
    { name: 'empty.txt', data: Buffer.alloc(0) },
  ];
  const entries = readZip(buildZip(files));
  assert.deepEqual(entries.map((e) => e.name), files.map((f) => f.name));
  for (const [i, e] of entries.entries()) assert.ok(e.data.equals(files[i].data), e.name);
  const lib = entries.find((e) => e.name === 'lib/store.js');
  assert.equal(lib.method, 8, 'deflated');
  assert.ok(entries.every((e) => e.flags & 0x800), 'UTF-8 name flag set');
});

test('buildZip writes forward slashes and no top-level folder', () => {
  const entries = readZip(buildZip([{ name: 'icons\\icon-16.png', data: Buffer.from('x') }]));
  assert.equal(entries[0].name, 'icons/icon-16.png');
  assert.throws(() => buildZip([{ name: '/abs.js', data: Buffer.from('') }]));
  assert.throws(() => buildZip([{ name: '../up.js', data: Buffer.from('') }]));
});
