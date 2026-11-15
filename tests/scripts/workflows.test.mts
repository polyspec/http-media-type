// The rules of the GitHub workflows (AGENTS.md, "CI and release"), checked on the tracked files of .github and on the
// Makefile:
//
//   - every job runs on ubuntu-26.04-arm, except the jobs platform and php of assets.yml, which run on the runner of each platform
//     of the release, ubuntu-26.04, ubuntu-26.04-arm or macos-15, because the asset of a platform is built and loaded only
//     on that platform: no tool of the release compiles for another platform (binding GN-19a);
//   - every action is a local action of .github/actions or a workflow of .github/workflows, or is pinned by its full
//     commit;
//   - no job and no step sets timeout-minutes;
//   - every run step is one make target that the Makefile defines, or that the release recipes define that it includes
//     (packages/release.mk, which binding release-recipes writes and which is not tracked, binding GN-19h), with
//     arguments NAME=value or expressions alone;
//   - platform builds each non-PHP asset once; php selects each platform and supported minor independently, with one
//     setup, one expected-minor build and an artifact whose name includes both selections (T1.8-2, binding GN-19i);
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

const jobOf = (text: string, name: string): string => {
  const lines = text.split('\n');
  const start = lines.indexOf(`  ${name}:`);
  if (start < 0) return '';
  const end = lines.findIndex((line, index) => index > start && /^ {2}[a-z][a-z0-9_-]*:$/.test(line));
  return lines.slice(start, end < 0 ? undefined : end).join('\n');
};

/** Explicit include entries preserve duplicate combinations, which a map keyed by platform would hide. */
function entriesOf(job: string): Record<string, string>[] {
  const matrix = job.split('        include:\n')[1]?.split(/^ {4}runs-on:/m)[0] ?? '';
  return matrix.split(/(?=^ {10}- )/m).filter(block => /^ {10}- /.test(block)).map(block => Object.fromEntries(block.trim().split('\n').map(line => {
    const match = /^\s*(?:- )?([a-z]+):\s*'?([^'\n]+)'?\s*$/.exec(line);
    return match === null ? ['invalid', line] : [match[1] as string, match[2] as string];
  })));
}

/** The declared workflow uses one key per line; unexpected matrix keys and duplicate entries are findings. */
function assetFindings(text: string, minors: readonly string[]): string[] {
  const found: string[] = [];
  const platform = jobOf(text, 'platform');
  const php = jobOf(text, 'php');
  const expectedPlatforms = Object.entries(PLATFORM_RUNNERS).map(([platform, runner]) => ({ platform, runner }));
  const canonical = (entries: readonly Record<string, string>[]): string[] => entries.map(entry => JSON.stringify(Object.fromEntries(Object.entries(entry).sort()))).sort();
  for (const [name, body, expected] of [
    ['platform', platform, expectedPlatforms],
    ['php', php, expectedPlatforms.flatMap(entry => minors.map(minor => ({ ...entry, php: minor })))],
  ] as const) {
    if (!body) { found.push(`missing job ${name}`); continue; }
    if (valueOf(body.split('\n').find(line => /^ {4}runs-on:/.test(line)) ?? '', 'runs-on') !== '${{ matrix.runner }}') found.push(`${name}: wrong runner selection`);
    const matrix = /^ {6}matrix:\n([\s\S]*?)(?=^ {4}\S)/m.exec(body)?.[1] ?? '';
    const keys = matrix.split('\n').filter(line => /^ {8}\S/.test(line));
    if (JSON.stringify(keys) !== JSON.stringify(['        include:'])) found.push(`${name}: matrix must contain only explicit include entries`);
    if (JSON.stringify(canonical(entriesOf(body))) !== JSON.stringify(canonical(expected))) found.push(`${name}: matrix differs from required combinations`);
  }
  for (const name of [...text.matchAll(/^ {2}([a-z][a-z0-9_-]*):$/gm)].map(match => match[1] as string)) {
    if (!['platform', 'php'].includes(name) && /^ {4}runs-on: \$\{\{ matrix.runner \}\}$/m.test(jobOf(text, name))) found.push(`${name}: unexpected platform runner`);
  }
  const steps = (body: string): string[] => body.split(/(?=^ {6}- )/m).slice(1);
  const runs = (body: string): string[] => steps(body).flatMap(step => [...step.matchAll(/^ {8}run: (.*)$/gm)].map(match => match[1] as string));
  const isSetup = (step: string): boolean => /^(?: {6}- | {8})uses: shivammathur\/setup-php@/m.test(step);
  const setups = (body: string): string[] => steps(body).filter(isSetup);
  const artifacts = (body: string): string[] => steps(body).filter(step => /^(?: {6}- | {8})uses: actions\/upload-artifact@/m.test(step)).flatMap(step => [...step.matchAll(/^ {10}name: (.*)$/gm)].map(match => match[1] as string));
  for (const match of (text.split(/^jobs:\n/m)[1] ?? '').matchAll(/^ {2}([a-z][a-z0-9_-]*):$/gm)) {
    const name = match[1] as string;
    const body = jobOf(text, name);
    if (name !== 'php' && (setups(body).length > 0 || runs(body).some(run => run.startsWith('make release-php-ext')))) found.push(`${name}: PHP belongs to its own job`);
    if (name !== 'platform' && runs(body).some(run => /^make release-(?:go-static|wheel|npm-platform)( |$)/.test(run))) found.push(`${name}: non-PHP platform assets belong to platform`);
  }
  const platformRuns = runs(platform);
  for (const target of ['release-go-static', 'release-wheel', 'release-npm-platform']) {
    if (platformRuns.filter(run => run === `make ${target}`).length !== 1) found.push(`platform: ${target} must run once`);
    if (runs(php).some(run => run.startsWith(`make ${target}`))) found.push(`php: repeats ${target}`);
  }
  if (setups(platform).length !== 0 || platformRuns.some(run => run.startsWith('make release-php-ext'))) found.push('platform: PHP belongs to its own job');
  const phpSetups = setups(php);
  if (phpSetups.length !== 1 || !/^ {10}php-version: \$\{\{ matrix.php \}\}$/m.test(phpSetups[0] ?? '') || /php-version-file:/.test(phpSetups[0] ?? '')) found.push('php: select one matrix runtime');
  const builds = runs(php).filter(run => run.startsWith('make release-php-ext'));
  if (builds.length !== 1 || builds[0] !== 'make release-php-ext PHP=php EXPECTED_PHP_MINOR=${{ matrix.php }}') found.push('php: build once with the expected minor');
  const phpSteps = steps(php);
  if (phpSteps.findIndex(isSetup) > phpSteps.findIndex(step => /^ {8}run: make release-php-ext( |$)/m.test(step))) found.push('php: setup must precede the build');
  if (JSON.stringify(artifacts(platform)) !== JSON.stringify(['assets-${{ matrix.platform }}'])) found.push('platform: wrong artifact identity');
  if (JSON.stringify(artifacts(php)) !== JSON.stringify(['assets-php-${{ matrix.platform }}-${{ matrix.php }}'])) found.push('php: wrong artifact identity');
  return found;
}

test('T1.8-2: assets.yml selects every platform and PHP minor independently', () => {
  const minors = (JSON.parse(read('config/toolchain.json')) as { phpExtension?: { minors?: unknown } }).phpExtension?.minors;
  assert.ok(Array.isArray(minors) && minors.length > 0 && minors.every((minor): minor is string => typeof minor === 'string' && /^[0-9]+\.[0-9]+$/.test(minor)), `config/toolchain.json: invalid PHP minors ${JSON.stringify(minors)}`);
  assert.equal(new Set(minors).size, minors.length, 'supported PHP minors must be distinct');
  assert.deepEqual(assetFindings(read(ASSETS), minors), []);
  assert.match(read(RELEASE), /pattern: assets-\*/);
  assert.match(read(RELEASE), /merge-multiple: true/);
});

test('T1.8-2: asset ownership rejects missing, duplicate and misidentified jobs', () => {
  const text = read(ASSETS);
  const minors = ['8.4', '8.5'];
  assert.deepEqual(assetFindings(text, minors), []);
  const php = jobOf(text, 'php');
  const entry = "          - platform: darwin-arm64\n            runner: macos-15\n            php: '8.5'\n";
  const mutations: [string, string, string][] = [
    ['      matrix:\n', "      matrix:\n        php: ['8.4', '8.5']\n", 'only explicit include'],
    ['      matrix:\n', '      matrix:\n        exclude: []\n', 'only explicit include'],
    ['      matrix:\n', '      matrix: {exclude: []}\n', 'only explicit include'],
    [entry, '', 'matrix differs'],
    [entry, entry + entry, 'matrix differs'],
    [entry, entry.replace('macos-15', 'ubuntu-26.04'), 'matrix differs'],
    [entry, entry.replace('8.5', '8.6'), 'matrix differs'],
    ['php-version: ${{ matrix.php }}', "php-version: '8.4'", 'select one matrix runtime'],
    [' EXPECTED_PHP_MINOR=${{ matrix.php }}', '', 'expected minor'],
    ['assets-php-${{ matrix.platform }}-${{ matrix.php }}', 'assets-${{ matrix.platform }}', 'artifact identity'],
    ['run: make release-php-ext PHP=php EXPECTED_PHP_MINOR=${{ matrix.php }}', 'run: make release-wheel', 'expected minor'],
  ];
  for (const [from, to, message] of mutations) {
    assert.ok(php.includes(from), `the PHP fixture contains ${from}`);
    const changed = text.replace(php, php.replace(from, to));
    assert.ok(assetFindings(changed, minors).some(finding => finding.includes(message)), `the workflow accepted ${from} -> ${to}`);
  }
  const build = '      - name: build the PHP extension\n        if: ${{ !cancelled() }}\n        run: make release-php-ext PHP=php EXPECTED_PHP_MINOR=${{ matrix.php }}\n';
  assert.ok(php.includes(build));
  assert.ok(assetFindings(text.replace(php, php.replace(build, build + build)), minors).some(finding => finding.includes('expected minor')));
  const setup = php.split(/(?=^ {6}- )/m).find(step => step.includes('uses: shivammathur/setup-php@'));
  assert.ok(setup);
  assert.ok(assetFindings(text.replace(php, php.replace(setup, setup + setup)), minors).some(finding => finding.includes('select one matrix runtime')));
  assert.ok(assetFindings(text.replace(php, php.replace(setup, '') + setup), minors).some(finding => finding.includes('setup must precede')));
  const misplacedVersion = php.replace('          php-version: ${{ matrix.php }}\n', '').replace(build, build + '          php-version: ${{ matrix.php }}\n');
  assert.ok(assetFindings(text.replace(php, misplacedVersion), minors).some(finding => finding.includes('select one matrix runtime')));
  assert.ok(assetFindings(text.replace('  npm:\n    runs-on: ubuntu-26.04-arm', '  npm:\n    runs-on: ${{ matrix.runner }}'), minors).some(finding => finding.includes('unexpected platform runner')));
  const wheel = '        run: make release-wheel';
  assert.ok(assetFindings(text.replace(wheel, wheel + '\n      - name: duplicated wheel\n' + wheel), minors).some(finding => finding.includes('release-wheel must run once')));
  for (const target of ['release-wheel', 'release-php-ext']) {
    const extra = text + `\n  duplicate:\n    runs-on: ubuntu-26.04-arm\n    steps:\n      - name: duplicate asset\n        run: make ${target}\n`;
    assert.ok(assetFindings(extra, minors).some(finding => finding.startsWith('duplicate:')), `an extra job must not repeat ${target}`);
  }
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
