// The recipes of the binding targets (AGENTS.md, "Bindings"): they run the node and the npm of var/tools by their paths
// and download nothing, because only the install targets download (make install-packages installs binding from its
// release asset and make install-binding fetches the crates of Cargo.lock; tests/scripts/binding.test.mts). The test reads a dry run of the recipes (make --dry-run), so no recipe runs.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

const root = resolve(import.meta.dirname, '../..');
const dryRun = (...goals: string[]): string[] =>
  execFileSync('make', ['--dry-run', '--no-print-directory', ...goals], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, MAKEFLAGS: '', MAKELEVEL: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
    .split('\n')
    .filter((line) => line !== '');

const GOALS = ['bindings-check', 'check-declarations', 'test-python', 'test-node', 'test-wasm', 'test-php', 'test-go', 'lint-bindings'];

test('the binding recipes run the tools of var/tools and download nothing', () => {
  const lines = dryRun(...GOALS);
  assert.ok(lines.length > 0, 'the dry run printed no line');
  const bare = lines.filter((line) => /(^|&& |; )(node|npm|npx) /.test(line));
  assert.deepEqual(bare, [], 'a recipe runs the node or the npm of the PATH');
  const downloads = lines.filter((line) => / ci( |$)|pip install(?!.* --no-index)|npm install(?!.* --offline)/.test(line));
  assert.deepEqual(downloads, [], 'a recipe downloads');
});

// binding 0.0.17 writes each generated Go test under the build tag polyspec_<package>_<feature>, the name of the core
// with `_` for `-`, so go test builds the panic and codec tests only with the tag of each feature of the
// Go crate.
test('make test-go gives go test the build tag polyspec_http_media_type_<feature> of each feature of the Go crate', () => {
  const manifest = readFileSync(resolve(root, 'packages/go/internal/ffi/Cargo.toml'), 'utf8');
  const table = /\n\[features\]\n([\s\S]*?)(?:\n\[|$)/.exec(manifest)?.[1] ?? '';
  const features = [...table.matchAll(/^([a-z][a-z0-9-]*) = /gm)].map((m) => m[1] ?? '').filter((name) => name !== 'default');
  assert.ok(features.length > 0, 'the Go crate declares no feature');
  const expected = features.map((name) => `polyspec_http_media_type_${name.replaceAll('-', '_')}`).sort();
  const goTest = dryRun('test-go').filter((line) => / test -count=1 /.test(line));
  assert.equal(goTest.length, 1, `go test runs ${String(goTest.length)} times`);
  const tags = /GOFLAGS=-tags=(\S+)/.exec(goTest[0] ?? '')?.[1]?.split(',').sort() ?? [];
  assert.deepEqual(tags, expected, `go test runs with the tags ${tags.join(',')}`);
});
