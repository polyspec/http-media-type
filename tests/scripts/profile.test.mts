// The release profile turns on no link-time optimization (AGENTS.md; binding GN-15i, CK-91): the Go
// static library is built with [profile.release], and LTO puts the standard library and binding_core into its one
// object, so a Go program that links it with the static library of another polyspec repository fails with duplicate
// symbols such as rust_eh_personality. Cargo sets lto for a whole profile and not for one package, so the profile
// itself keeps it off. The test reads the tracked Cargo.toml and .cargo/config.toml.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const root = resolve(import.meta.dirname, '../..');

/** The value of lto in the table [profile.release] of a TOML text, or undefined when the table or the key is absent. */
function releaseLto(text: string): string | undefined {
  const table = /^\[profile\.release\]\n([\s\S]*?)(?=^\[|(?![\s\S]))/m.exec(text)?.[1];
  return table === undefined ? undefined : /^lto\s*=\s*(.+?)\s*(?:#.*)?$/m.exec(table)?.[1];
}

test('the release profile reads lto from its table and ignores other tables', () => {
  assert.equal(releaseLto('[profile.release]\nlto = true\ncodegen-units = 1\n'), 'true');
  assert.equal(releaseLto('[profile.release]\ncodegen-units = 1\n\n[profile.dev]\nlto = true\n'), undefined);
  assert.equal(releaseLto('[workspace]\n'), undefined);
});

test('the release profile turns on no LTO, so the Go static library links beside another (binding GN-15i)', () => {
  for (const file of ['Cargo.toml', '.cargo/config.toml']) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    const lto = releaseLto(readFileSync(path, 'utf8'));
    assert.ok(lto === undefined || lto === 'false' || lto === '"off"', `${file}: [profile.release] sets lto = ${lto ?? ''}`);
  }
});
