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

// The test features of each binding crate are the names of the [features] table of its manifest, which binding scaffold
// writes: a crate built without one has no entry point that a generated test calls, and a feature that the lint does
// not give is code that the lint does not read. The test reads what make would run, so no recipe runs.
const CRATES = [
  { manifest: 'packages/python/Cargo.toml', target: 'test-python', build: /^cd packages\/python && .*maturin build .*--features (\S+)/ },
  { manifest: 'packages/ts/Cargo.toml', target: 'node-package', build: / build .*-p polyspec-http-media-type-node .*--features (\S+)/ },
  { manifest: 'packages/ts/wasm/Cargo.toml', target: 'node-package', build: / build .*-p polyspec-http-media-type-wasm .*--features (\S+)/ },
  { manifest: 'packages/php-ext/Cargo.toml', target: 'test-php', build: / build .*-p polyspec-http-media-type-php-ext .*--features (\S+)/ },
  { manifest: 'packages/go/internal/ffi/Cargo.toml', target: 'test-go', build: / build .*-p polyspec-http-media-type-go .*--features (\S+)/ },
] as const;

// The names of the [features] table of a manifest, without default.
function featuresOf(manifest: string): string[] {
  const table = /\n\[features\]\n([\s\S]*?)(?:\n\[|$)/.exec(readFileSync(resolve(root, manifest), 'utf8'))?.[1] ?? '';
  return [...table.matchAll(/^([a-z][a-z0-9-]*) = /gm)].map((m) => m[1] ?? '').filter((name) => name !== 'default').sort();
}

test('each binding crate is built, and the workspace linted, with every feature of the manifests', () => {
  const lines = dryRun(...new Set(CRATES.map((crate) => crate.target)), 'lint-bindings');
  const union = new Set<string>();
  for (const crate of CRATES) {
    const declared = featuresOf(crate.manifest);
    assert.ok(declared.includes('panic-test'), `${crate.manifest} declares no feature panic-test`);
    for (const name of declared) union.add(name);
    const built = [...new Set(lines.map((line) => crate.build.exec(line)?.[1]).filter((found) => found !== undefined))];
    assert.equal(built.length, 1, `the recipes build ${crate.manifest} with ${String(built.length)} lists of features: ${built.join(' ')}`);
    assert.deepEqual(built[0]?.split(',').sort(), declared, `${crate.manifest} is built with the features ${built[0] ?? ''}, its manifest declares ${declared.join(',')}`);
  }
  const lint = [...new Set(lines.map((line) => / clippy .*--workspace .*--features (\S+)/.exec(line)?.[1]).filter((found) => found !== undefined))];
  assert.equal(lint.length, 1, `make lint-bindings lints the workspace with ${String(lint.length)} lists of features`);
  assert.deepEqual(lint[0]?.split(',').sort(), [...union].sort(), `make lint-bindings lints with ${lint[0] ?? ''}, the manifests declare ${[...union].sort().join(',')}`);
});

// binding writes each generated Go test under the build tag polyspec_<package>_<feature>, the name of the core with `_`
// for `-`, so go test builds the generated tests of a feature only with the tag of that feature of the Go crate.
test('make test-go gives go test the build tag polyspec_http_media_type_<feature> of each feature of the Go crate', () => {
  const expected = featuresOf('packages/go/internal/ffi/Cargo.toml').map((name) => `polyspec_http_media_type_${name.replaceAll('-', '_')}`).sort();
  const goTest = dryRun('test-go').filter((line) => / test -count=1 /.test(line));
  assert.equal(goTest.length, 1, `go test runs ${String(goTest.length)} times`);
  const tags = /GOFLAGS=-tags=(\S+)/.exec(goTest[0] ?? '')?.[1]?.split(',').sort() ?? [];
  assert.deepEqual(tags, expected, `go test runs with the tags ${tags.join(',')}`);
});

// A list of features that a recipe names itself is a second copy of the manifest, which a new feature of binding leaves
// behind: every recipe takes its features from a variable that reads a manifest.
test('no recipe of the Makefile names a feature itself', () => {
  const literal = readFileSync(resolve(root, 'Makefile'), 'utf8').split('\n').filter((line) => /--features (?!\$\()/.test(line) || /^[A-Z_]*FEATURES :?= *[a-z]/.test(line));
  assert.deepEqual(literal, [], 'a recipe or a variable of the Makefile names features itself');
});

// The release creates and pushes the tag before it builds the archives, so the job check of CI builds them from the
// commit with no tag (make release-candidate-assets); kit reads the version from the change log of HEAD (kit K1286), so
// the recipe names none.
test('the job check of CI builds the archives of the release from the commit with no tag', () => {
  const makefile = readFileSync(resolve(root, 'Makefile'), 'utf8');
  const core = /^CI_CHECK_TARGETS_core := (.*)$/m.exec(makefile)?.[1]?.split(' ') ?? [];
  assert.ok(core.includes('release-candidate-assets'), `the entry core of ci-check runs ${core.join(' ')}`);
  const recipe = dryRun('release-candidate-assets');
  assert.equal(recipe.length, 1, `make release-candidate-assets runs ${String(recipe.length)} lines`);
  assert.match(recipe[0] ?? '', /^RELEASE_ASSETS=var\/release-candidate\/assets +\S+\/node \S+\/release\.mjs candidate-assets$/);
});

// The job check of CI rehearses the Go module of the release on the committed HEAD with no tag and pushes nothing, so a
// failure of the Go module shows before the tag (T-row of the rehearsal, B2.539).
test('the job check of CI rehearses the Go module of the release with no tag', () => {
  const makefile = readFileSync(resolve(root, 'Makefile'), 'utf8');
  const core = /^CI_CHECK_TARGETS_core := (.*)$/m.exec(makefile)?.[1]?.split(' ') ?? [];
  assert.ok(core.includes('release-go-module-rehearsal'), `the entry core of ci-check runs ${core.join(' ')}`);
  assert.match(makefile, /^release-go-module-rehearsal:/m, 'the Makefile has no target release-go-module-rehearsal');
});

// The Python source of the release, generated/python (pyproject.toml, python-source), holds the native module beside its
// package, so a consumer that links the source folder imports it (T1.23). Read on the dry run of test-python: no build.
test('test-python puts the native module into the Python source of the release', () => {
  const dry = execFileSync('make', ['-n', 'test-python'], { cwd: root, encoding: 'utf8' });
  assert.match(dry, /_native\*\.so packages\/python\/generated\/python\/polyspec\/http_media_type\//, `test-python does not copy the native module into generated/python:\n${dry}`);
});
