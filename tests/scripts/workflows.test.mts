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
//   - every job of a workflow that CI runs (ci.yml and the workflows that it calls) is one recipe of the Makefile: it has
//     one run step `make ci-<job>` with make variables alone, whose value is a word, a matrix value or an input of the
//     called workflow, and every other step is a uses step; a run step has no condition, environment or shell of its own,
//     and no job or workflow sets an environment. The job ci-passed passes the JSON of needs, `RESULTS='${{ toJSON(needs)
//     }}'`, because it judges the other jobs and exists only in CI;
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
// The one run step of a job of a workflow that CI runs: make ci-<job> with make variables whose value is a word, a matrix
// value or an input of the called workflow.
const JOB_RUN = /^make (ci-[a-z0-9-]+)((?: [A-Z][A-Z0-9_]*=(?:[A-Za-z0-9_./-]+|\$\{\{ (?:matrix|inputs)\.[a-z0-9_-]+ \}\}))*)$/;
const JUDGEMENT_RUN = "make ci-passed RESULTS='${{ toJSON(needs) }}'";

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

/** The workflows that CI runs: ci.yml and every workflow that a workflow of them calls. */
function ciWorkflows(): string[] {
  const found = [CI];
  for (let at = 0; at < found.length; at += 1)
    for (const match of read(found[at] as string).matchAll(/^ {4}uses: \.\/(\.github\/workflows\/[A-Za-z0-9_.-]+\.ya?ml)$/gm))
      if (!found.includes(match[1] as string)) found.push(match[1] as string);
  return found;
}

const jobNames = (text: string): string[] => [...(text.split(/^jobs:\n/m)[1] ?? '').matchAll(/^ {2}([a-z][a-z0-9_-]*):$/gm)].map((match) => match[1] as string);
const stepsOf = (job: string): string[] => (job.split(/^ {4}steps:\n/m)[1] ?? '').split(/(?=^ {6}- )/m).filter((step) => /^ {6}- /.test(step));
/** The keys of a step: those of its first line and of the lines at its own depth. */
const keysOf = (step: string): string[] =>
  step.split('\n').flatMap((line) => /^(?: {6}- | {8})([a-z][a-z-]*):/.exec(line)?.[1] ?? []);

/** The findings of the rule that every job of a workflow that CI runs is one recipe ci-<job> of the Makefile. */
function jobFindings(file: string, text: string, targets: Set<string>): string[] {
  const found: string[] = [];
  if (/^env:/m.test(text)) found.push(`${file}: sets an environment for its jobs`);
  for (const name of jobNames(text)) {
    const job = jobOf(text, name);
    const at = `${file}: job ${name}`;
    if (/^ {4}(?:env|defaults):/m.test(job)) found.push(`${at}: sets an environment or defaults for its steps`);
    if (/^ {4}uses: /m.test(job)) {
      if (/^ {4}steps:/m.test(job)) found.push(`${at}: calls a workflow and has steps`);
      continue;
    }
    const steps = stepsOf(job);
    const runs = steps.filter((step) => keysOf(step).includes('run'));
    if (runs.length !== 1) found.push(`${at}: has ${String(runs.length)} run steps, not one`);
    for (const step of steps) {
      const keys = keysOf(step);
      if (keys.includes('uses') === keys.includes('run')) {
        found.push(`${at}: a step is neither a uses step nor a run step: ${step.trim().split('\n')[0] ?? ''}`);
        continue;
      }
      if (keys.includes('uses')) continue;
      const extra = keys.filter((key) => !['run', 'name', 'id'].includes(key));
      if (extra.length > 0) found.push(`${at}: the run step sets ${extra.join(', ')}`);
      const run = /^(?: {6}- | {8})run: *(.*)$/m.exec(step)?.[1]?.trim() ?? '';
      if (name === 'ci-passed') {
        if (run !== JUDGEMENT_RUN) found.push(`${at}: the run step is not ${JUDGEMENT_RUN}: ${run}`);
        continue;
      }
      const target = JOB_RUN.exec(run)?.[1];
      if (target === undefined) found.push(`${at}: the run step is not make ci-${name} with make variables alone: ${run}`);
      else if (target !== `ci-${name}`) found.push(`${at}: the run step calls ${target}, not ci-${name}`);
      else if (!targets.has(target)) found.push(`${at}: the Makefile defines no target ${target}`);
    }
  }
  return found;
}

test('every job of a workflow that CI runs is one recipe ci-<job> of the Makefile, which its one run step calls', () => {
  const targets = makeTargets();
  const list = ciWorkflows();
  assert.ok(list.includes(ASSETS), list.join('\n'));
  assert.deepEqual(list.flatMap((file) => jobFindings(file, read(file), targets)), []);
});

test('the rule of one recipe per job rejects a second run step, a condition, an expression and a wrong target', () => {
  const targets = makeTargets();
  const text = read(CI);
  assert.deepEqual(jobFindings(CI, text, targets), []);
  const run = '      - run: make ci-check NAME=${{ matrix.name }}\n';
  assert.ok(text.includes(run), 'the job check runs make ci-check NAME=${{ matrix.name }}');
  const mutations: [string, string, string][] = [
    [run, run + '      - run: make ci-summary\n', 'has 2 run steps'],
    [run, '', 'has 0 run steps'],
    [run, run.replace('- run:', '- if: ${{ !cancelled() }}\n        run:'), 'the run step sets if'],
    [run, run.replace('- run:', '- env:\n          X: y\n        run:'), 'the run step sets env'],
    [run, run.replace('${{ matrix.name }}', '${{ github.ref }}'), 'with make variables alone'],
    [run, run.replace('NAME=${{ matrix.name }}', '"${{ matrix.name }}"'), 'with make variables alone'],
    [run, run.replace('ci-check', 'ci-targets'), 'calls ci-targets, not ci-check'],
    [run, run.replace('ci-check', 'ci-undefined'), 'calls ci-undefined'],
    [run, run.replace('make ci-check NAME=${{ matrix.name }}', '|\n          make ci-check'), 'with make variables alone'],
    ["RESULTS='${{ toJSON(needs) }}'", "RESULTS='${{ toJSON(needs) }}' X=${{ github.sha }}", 'the run step is not'],
    ['permissions:\n', 'env:\n  X: y\npermissions:\n', 'sets an environment for its jobs'],
  ];
  for (const [from, to, message] of mutations) {
    assert.ok(text.includes(from), `the fixture contains ${from}`);
    assert.ok(jobFindings(CI, text.replace(from, to), targets).some((finding) => finding.includes(message)), `the rule accepted ${from} -> ${to}`);
  }
});

test('assets.yml builds each platform on its runner and the job npm, and ci and release call it', () => {
  const text = read(ASSETS);
  assert.match(text, /^ {2}workflow_call:$/m);
  for (const [platform, runner] of Object.entries(PLATFORM_RUNNERS))
    assert.match(text, new RegExp(`- platform: ${platform}\\n +runner: ${runner.replaceAll('.', '\\.')}\\n`), `${platform} on ${runner}`);
  const runs = jobNames(text).flatMap((name) => runsOf(jobOf(text, name), read('Makefile')));
  for (const target of ['release-recipes', 'release-binding-check', 'release-go-static', 'release-wheel', 'install-llvm', 'release-php-ext', 'release-npm-platform', 'install-wasm-bindgen', 'release-npm'])
    assert.ok(runs.some((run) => run === `make ${target}` || run.startsWith(`make ${target} `)), target);
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

/** The recipe of `target` in the text of a Makefile: its lines, each with its continuation lines joined. */
function recipeOf(makefile: string, target: string): string[] {
  const lines = makefile.split('\n');
  const start = lines.findIndex((line) => new RegExp(`^${target.replaceAll('.', '\\.')} *:(?!=)`).test(line));
  if (start < 0) return [];
  const recipe: string[] = [];
  for (let at = start + 1; at < lines.length && (lines[at] as string).startsWith('\t'); at += 1) {
    let line = (lines[at] as string).slice(1);
    while (line.endsWith('\\') && at + 1 < lines.length) line = line.slice(0, -1) + ' ' + (lines[(at += 1)] as string).trim();
    recipe.push(line);
  }
  return recipe;
}

/**
 * The make calls of `recipe`, one for each goal of each `$(MAKE)`: `make <goal> <variables>`, without the options of the
 * call. A goal of one call with several goals is a call of its own, since make -k runs each of them.
 */
const makeCalls = (recipe: readonly string[]): string[] =>
  recipe.flatMap((line) => line.split('$(MAKE)').slice(1).flatMap((call) => {
    const words = (call.split(/;|&&|\|\|/)[0] ?? '').match(/[A-Z][A-Z0-9_]*=(?:"[^"]*"|\S+)|\S+/g) ?? [];
    // A word that ends the call of a function of make, such as release-binding-check) of $(if ...), loses the parentheses
    // that it does not open.
    const unwrap = (word: string): string => (word.endsWith(')') && word.split('(').length < word.split(')').length ? unwrap(word.slice(0, -1)) : word);
    const cleaned = words.map(unwrap).filter((word) => word !== '' && !word.startsWith('-'));
    const variables = cleaned.filter((word) => /^[A-Z][A-Z0-9_]*=/.test(word));
    return cleaned.filter((word) => !word.includes('=')).map((goal) => ['make', goal, ...variables].join(' '));
  }));

const stepRun = (step: string): string | undefined => /^(?: {6}- | {8})run: (.*)$/m.exec(step)?.[1];

/** What a job runs: each of its run steps, and the make calls of the recipe of the target of each, read from the Makefile. */
function runsOf(job: string, makefile: string): string[] {
  return stepsOf(job).flatMap((step) => {
    const run = stepRun(step);
    if (run === undefined) return [];
    const target = RUN.exec(run)?.[1];
    return [run, ...(target === undefined ? [] : makeCalls(recipeOf(makefile, target)))];
  });
}

/** The declared workflow uses one key per line; unexpected matrix keys and duplicate entries are findings. */
function assetFindings(text: string, makefile: string, minors: readonly string[]): string[] {
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
  const runs = (body: string): string[] => runsOf(body, makefile);
  const isSetup = (step: string): boolean => /^(?: {6}- | {8})uses: shivammathur\/setup-php@/m.test(step);
  const setups = (body: string): string[] => stepsOf(body).filter(isSetup);
  const artifacts = (body: string): string[] => stepsOf(body).filter(step => /^(?: {6}- | {8})uses: actions\/upload-artifact@/m.test(step)).flatMap(step => [...step.matchAll(/^ {10}name: (.*)$/gm)].map(match => match[1] as string));
  for (const name of jobNames(text)) {
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
  // The job passes the minor of its entry to its recipe, which builds the extension once with the php that setup-php selected.
  const phpRuns = stepsOf(php).flatMap(step => stepRun(step) ?? []);
  if (phpRuns.length !== 1 || !/^make ci-php .*\bEXPECTED_PHP_MINOR=\$\{\{ matrix\.php \}\}(?: |$)/.test(phpRuns[0] ?? '')) found.push('php: pass the expected minor of the entry');
  const builds = runs(php).filter(run => run.startsWith('make release-php-ext'));
  if (builds.length !== 1 || builds[0] !== 'make release-php-ext PHP=php EXPECTED_PHP_MINOR=$(EXPECTED_PHP_MINOR)') found.push('php: build once with the expected minor');
  const phpSteps = stepsOf(php);
  if (phpSteps.findIndex(isSetup) > phpSteps.findIndex(step => stepRun(step) !== undefined)) found.push('php: setup must precede the build');
  if (JSON.stringify(artifacts(platform)) !== JSON.stringify(['assets-${{ matrix.platform }}'])) found.push('platform: wrong artifact identity');
  if (JSON.stringify(artifacts(php)) !== JSON.stringify(['assets-php-${{ matrix.platform }}-${{ matrix.php }}'])) found.push('php: wrong artifact identity');
  return found;
}

test('T1.8-2: assets.yml selects every platform and PHP minor independently', () => {
  const minors = (JSON.parse(read('config/toolchain.json')) as { phpExtension?: { minors?: unknown } }).phpExtension?.minors;
  assert.ok(Array.isArray(minors) && minors.length > 0 && minors.every((minor): minor is string => typeof minor === 'string' && /^[0-9]+\.[0-9]+$/.test(minor)), `config/toolchain.json: invalid PHP minors ${JSON.stringify(minors)}`);
  assert.equal(new Set(minors).size, minors.length, 'supported PHP minors must be distinct');
  assert.deepEqual(assetFindings(read(ASSETS), read('Makefile'), minors), []);
  assert.match(read(RELEASE), /pattern: assets-\*/);
  assert.match(read(RELEASE), /merge-multiple: true/);
});

test('T1.8-2: asset ownership rejects missing, duplicate and misidentified jobs', () => {
  const text = read(ASSETS);
  const makefile = read('Makefile');
  const minors = ['8.4', '8.5'];
  assert.deepEqual(assetFindings(text, makefile, minors), []);
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
    ['run: make ci-php', 'run: make ci-platform', 'expected minor'],
  ];
  for (const [from, to, message] of mutations) {
    assert.ok(php.includes(from), `the PHP fixture contains ${from}`);
    const changed = text.replace(php, php.replace(from, to));
    assert.ok(assetFindings(changed, makefile, minors).some(finding => finding.includes(message)), `the workflow accepted ${from} -> ${to}`);
  }
  const build = stepsOf(php).find(step => stepRun(step) !== undefined);
  assert.ok(build);
  assert.ok(assetFindings(text.replace(php, php.replace(build, build + build)), makefile, minors).some(finding => finding.includes('expected minor')));
  const setup = stepsOf(php).find(step => step.includes('uses: shivammathur/setup-php@'));
  assert.ok(setup);
  assert.ok(assetFindings(text.replace(php, php.replace(setup, setup + setup)), makefile, minors).some(finding => finding.includes('select one matrix runtime')));
  assert.ok(assetFindings(text.replace(php, php.replace(setup, '') + setup), makefile, minors).some(finding => finding.includes('setup must precede')));
  const misplacedVersion = php.replace('          php-version: ${{ matrix.php }}\n', '').replace(build, build + '          php-version: ${{ matrix.php }}\n');
  assert.ok(assetFindings(text.replace(php, misplacedVersion), makefile, minors).some(finding => finding.includes('select one matrix runtime')));
  assert.ok(assetFindings(text.replace('  npm:\n    runs-on: ubuntu-26.04-arm', '  npm:\n    runs-on: ${{ matrix.runner }}'), makefile, minors).some(finding => finding.includes('unexpected platform runner')));
  // The recipes of the jobs: a build repeated or moved into another job is a finding.
  const builds = ' release-go-static release-wheel release-npm-platform';
  assert.ok(makefile.includes(builds), 'ci-platform builds release-go-static, release-wheel and release-npm-platform');
  assert.ok(assetFindings(text, makefile.replace(builds, builds + ' release-wheel'), minors).some(finding => finding.includes('release-wheel must run once')));
  assert.ok(assetFindings(text, makefile.replace(builds, ' release-go-static release-npm-platform'), minors).some(finding => finding.includes('release-wheel must run once')));
  const phpBuild = '\t$(MAKE) --no-print-directory release-php-ext PHP=php EXPECTED_PHP_MINOR=$(EXPECTED_PHP_MINOR)\n';
  assert.ok(makefile.includes(phpBuild), 'ci-php builds the extension');
  assert.ok(assetFindings(text, makefile.replace(phpBuild, phpBuild + phpBuild), minors).some(finding => finding.includes('expected minor')));
  assert.ok(assetFindings(text, makefile.replace(phpBuild, phpBuild.replace('PHP=php ', '')), minors).some(finding => finding.includes('expected minor')));
  for (const target of ['release-wheel', 'release-php-ext']) {
    const extra = text + `\n  duplicate:\n    runs-on: ubuntu-26.04-arm\n    steps:\n      - name: duplicate asset\n        run: make ${target}\n`;
    assert.ok(assetFindings(extra, makefile, minors).some(finding => finding.startsWith('duplicate:')), `an extra job must not repeat ${target}`);
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
