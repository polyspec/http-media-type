// The rules of the GitHub workflows (AGENTS.md, "CI and release"), checked on the tracked files of .github and on the
// Makefile:
//
//   - every job runs on ubuntu-26.04-arm, except the job platform of assets.yml, which runs on the runner of each platform
//     of the release, ubuntu-26.04, ubuntu-26.04-arm or macos-15, because the asset of a platform is built and loaded only
//     on that platform: no tool of the release compiles for another platform (binding GN-19a);
//   - every action is a local action of .github/actions or a workflow of .github/workflows, or is pinned by its full
//     commit;
//   - no job and no step sets timeout-minutes;
//   - every run step is one make target that the Makefile defines, or that the release recipes define that it includes
//     (packages/release.mk, which binding release-recipes writes and which is not tracked, binding GN-19h), with
//     arguments NAME=value or expressions alone;
//   - the workflows ci and release call assets.yml (binding GN-19i), and the release job of release.yml downloads the
//     assets of each platform and runs release-go-module and release-platform-assets after release-publish has created
//     the draft release, and release-undraft last.
//
// The test reads the files as text, line by line: the workflows hold one key on a line.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const root = resolve(import.meta.dirname, '../..');
const read = (file: string): string => readFileSync(join(root, file), 'utf8');
const RUNNER = 'ubuntu-26.04-arm';
const ASSETS = '.github/workflows/assets.yml';
const CI = '.github/workflows/ci.yml';
const RELEASE = '.github/workflows/release.yml';
// The runner of each platform of the release (binding GN-19a).
const PLATFORM_RUNNERS: Record<string, string> = { 'linux-x64-gnu': 'ubuntu-26.04', 'linux-arm64-gnu': 'ubuntu-26.04-arm', 'darwin-arm64': 'macos-15' };
// The targets of packages/release.mk for a contract with the targets go, python, php, node and wasm (binding GN-19h).
const RECIPE_TARGETS = ['release-go-static', 'release-wheel', 'release-php-ext', 'release-npm-platform', 'release-npm', 'release-go-module', 'release-binding-check', 'release-platform-assets', 'install-llvm', 'install-wasm-bindgen'];
const EXPRESSION = String.raw`\$\{\{[^}]*\}\}`;
const VALUE = String.raw`(?:(?:[A-Za-z0-9_./-]|${EXPRESSION})+|"(?:[A-Za-z0-9_. -]|${EXPRESSION})+"|'${EXPRESSION}')`;
const RUN = new RegExp(String.raw`^make ([a-z][a-z0-9-]*)((?: (?:[A-Z][A-Z0-9_]*=${VALUE}|${EXPRESSION}))*)$`);
const PINNED = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@[0-9a-f]{40}$/;

const files = (): string[] =>
  execFileSync('git', ['ls-files', '.github'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter((file) => /\.ya?ml$/.test(file));

function makeTargets(): Set<string> {
  const targets = new Set<string>(RECIPE_TARGETS);
  for (const line of read('Makefile').split('\n')) {
    const names = /^([a-z][A-Za-z0-9_.-]*(?: +[a-z][A-Za-z0-9_.-]*)*) *:(?!=)/.exec(line)?.[1];
    if (names !== undefined) for (const name of names.split(/ +/)) targets.add(name);
  }
  return targets;
}

const valueOf = (line: string, key: string): string | undefined => new RegExp(`^ *(?:- )?${key}: *(.*)$`).exec(line)?.[1]?.trim();

function findings(file: string, targets: Set<string>): string[] {
  const found: string[] = [];
  const lines = read(file).split('\n');
  lines.forEach((line, index) => {
    if (line.trim().startsWith('#')) return;
    const at = `${file}:${String(index + 1)}`;
    if (/^ *(?:- )?timeout-minutes:/.test(line)) found.push(`${at}: sets timeout-minutes`);
    const runner = valueOf(line, 'runs-on');
    if (runner !== undefined && runner !== RUNNER && !(file === ASSETS && runner === '${{ matrix.runner }}')) found.push(`${at}: runs on ${runner}, not on ${RUNNER}`);
    const uses = valueOf(line, 'uses')?.replace(/ +#.*$/, '');
    if (uses !== undefined && !uses.startsWith('./.github/') && !PINNED.test(uses)) found.push(`${at}: uses ${uses}, which is not pinned by a full commit`);
    const run = valueOf(line, 'run');
    const next = lines.slice(index + 1).find((later) => later.trim() !== '' && !later.trim().startsWith('#'));
    const deeper = next !== undefined && next.search(/\S/) > line.indexOf('run:');
    // A key `run:` with no value whose deeper lines are keys is the input `run` of a dispatch, no run step.
    if (run !== undefined && !(run === '' && deeper && /^ *[A-Za-z_-]+:(?: |$)/.test(next))) {
      const target = RUN.exec(run)?.[1];
      if (target === undefined) found.push(`${at}: the run step is not one make target: ${run}`);
      else if (!targets.has(target)) found.push(`${at}: the Makefile defines no target ${target}`);
    }
  });
  return found;
}

test('every workflow runs on its runner, pins its actions, sets no time limit and runs one make target per step', () => {
  const targets = makeTargets();
  const list = files();
  assert.ok(list.includes(CI) && list.includes(RELEASE), list.join('\n'));
  assert.deepEqual(list.flatMap((file) => findings(file, targets)), []);
});

test('assets.yml builds each platform on its runner and the job npm, and ci and release call it', () => {
  const text = read(ASSETS);
  assert.match(text, /^ {2}workflow_call:$/m);
  for (const [platform, runner] of Object.entries(PLATFORM_RUNNERS))
    assert.match(text, new RegExp(`- platform: ${platform}\\n +runner: ${runner.replaceAll('.', '\\.')}\\n`), `${platform} on ${runner}`);
  for (const target of ['release-recipes', 'release-binding-check', 'release-go-static', 'release-wheel', 'install-llvm', 'release-php-ext', 'release-npm-platform', 'install-wasm-bindgen', 'release-npm'])
    assert.match(text, new RegExp(`run: make ${target}( |$)`, 'm'), target);
  for (const file of [CI, RELEASE]) assert.match(read(file), /^ {4}uses: \.\/\.github\/workflows\/assets\.yml$/m, file);
  assert.match(read(CI), /needs: \[[^\]]*\bassets\b[^\]]*\]/);
});

test('release.yml uploads the assets of each platform to the draft release before it makes the release public', () => {
  const steps = read(RELEASE).split('\n').flatMap((line) => {
    const run = valueOf(line, 'run');
    if (run !== undefined) return [RUN.exec(run)?.[1] ?? run];
    return /uses: actions\/download-artifact@/.test(line) ? ['download-artifact'] : [];
  });
  const order = ['release-publish', 'download-artifact', 'release-go-module', 'release-platform-assets', 'release-undraft'];
  const at = order.map((step) => steps.indexOf(step));
  assert.ok(at.every((index) => index >= 0), `missing: ${order.filter((_, index) => at[index] < 0).join(', ')}`);
  assert.deepEqual([...at].sort((a, b) => a - b), at, steps.join(', '));
});
