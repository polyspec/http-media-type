// binding is a released dependency (AGENTS.md, "Bindings"): the crate polyspec-binding-core of the core and of every
// binding crate is the tag of a release, Cargo.lock pins the commit of that tag, and the tool @polyspec/binding is the
// archive of the same release, which package.json names by the URL of its release asset and package-lock.json pins
// by its integrity. The generator and binding_core are then one version (G-6), and binding check takes the tag of
// Cargo.lock as its own (CK-20). The recipes run the installed tool by its path, and only make install-binding
// downloads: cargo fetch --locked, because the tool reads the crates with cargo metadata --locked --offline.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const root = resolve(import.meta.dirname, '../..');
const VERSION = '0.0.2';
const ASSET = `https://github.com/polyspec/binding/releases/download/v${VERSION}/polyspec-binding-${VERSION}.tgz`;
const read = (file: string): string => readFileSync(join(root, file), 'utf8');
const dryRun = (...goals: string[]): string[] =>
  execFileSync('make', ['--dry-run', '--no-print-directory', ...goals], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, MAKEFLAGS: '', MAKELEVEL: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
    .split('\n')
    .filter((line) => line !== '');

test('every Cargo manifest names polyspec-binding-core by the tag of the release', () => {
  const manifests = execFileSync('git', ['ls-files', '*Cargo.toml'], { cwd: root, encoding: 'utf8' }).split('\n').filter((file) => file !== '');
  const lines = manifests.flatMap((file) => read(file).split('\n').filter((line) => /^polyspec-binding-core\s*=/.test(line)).map((line) => ({ file, line })));
  assert.ok(lines.length > 0, 'no manifest names polyspec-binding-core');
  for (const { file, line } of lines) {
    assert.match(line, new RegExp(`tag = "v${VERSION.replaceAll('.', '\\.')}"`), `${file}: ${line}`);
    assert.doesNotMatch(line, /branch\s*=|rev\s*=/, `${file}: ${line}`);
  }
});

test('Cargo.lock pins polyspec-binding-core at the tag of the release', () => {
  const sources = read('Cargo.lock').split('\n').filter((line) => line.startsWith('source = "git+https://github.com/polyspec/binding.git'));
  assert.ok(sources.length > 0, 'Cargo.lock has no source of binding');
  for (const source of sources) assert.match(source, new RegExp(`\\?tag=v${VERSION.replaceAll('.', '\\.')}#[0-9a-f]{40}"$`), source);
});

test('package.json names the release asset of the tool and package-lock.json pins its integrity', () => {
  const manifest = JSON.parse(read('package.json')) as { devDependencies?: Record<string, string> };
  assert.equal(manifest.devDependencies?.['@polyspec/binding'], ASSET);
  const lock = JSON.parse(read('package-lock.json')) as { packages: Record<string, { resolved?: string; integrity?: string; version?: string }> };
  const entry = lock.packages['node_modules/@polyspec/binding'];
  assert.equal(entry?.resolved, ASSET);
  assert.equal(entry?.version, VERSION);
  assert.match(entry?.integrity ?? '', /^sha512-[A-Za-z0-9+/]+=*$/);
});

test('the recipes run the installed tool, and make install-binding fetches the crates of Cargo.lock', () => {
  const check = dryRun('bindings-check');
  assert.ok(check.some((line) => line.endsWith('node_modules/@polyspec/binding/dist/cli.js check packages/rust/interface.json')), check.join('\n'));
  const install = dryRun('install-binding');
  assert.ok(install.some((line) => / fetch --locked( |$)/.test(line)), install.join('\n'));
});
