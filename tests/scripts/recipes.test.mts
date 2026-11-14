// The recipes of the binding targets (AGENTS.md, "Bindings"): they run the node and the npm of var/tools by their paths
// and download nothing, because only the install targets download (make install-packages installs binding from its
// release asset and make install-binding fetches the crates of Cargo.lock; tests/scripts/binding.test.mts). The test reads a dry run of the recipes (make --dry-run), so no recipe runs.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
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
