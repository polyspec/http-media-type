// Runs binding at the commit that Cargo.lock pins: node scripts/binding.mts <check|scaffold|generate> [arguments], after
// node scripts/binding.mts install (make install-binding) installed it.
//
// Before its first release binding is a Git dependency (binding design L-2), and only its crate polyspec-binding-core
// is a Cargo package; the command-line tool is the TypeScript package packages/ts of the same repository, which no
// package registry holds yet. So the tool comes from the checkout that Cargo made of the pinned commit: install clones
// that checkout into var/binding/<commit>, where npm installs the dependencies that the tool's package-lock.json pins.
// The clone is a Git checkout of binding at that commit, which is how binding check knows its own commit and compares it
// with the commit of Cargo.lock (CK-20); a copy of the files alone has no commit, and the check fails it. The commit
// is that of Cargo.lock, so the generator and binding_core are one version (G-6). Only install downloads: Cargo fetches
// the crates of Cargo.lock and npm the packages of the tool, and every other command reads them offline and fails while
// they are missing, so that no check depends on the network (AGENTS.md, "Bindings"). This is not the usual way to
// install a tool; it ends when binding is released.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const install = process.argv[2] === 'install';
// The npm of the checkout (var/tools/bin), which mise.toml and devEngines of package.json pin.
const npm = join(root, 'var/tools/bin/npm');
const metadata = JSON.parse(
  execFileSync('cargo', ['metadata', '--format-version', '1', '--locked', ...(install ? [] : ['--offline']), '--manifest-path', join(root, 'Cargo.toml')], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  }),
) as { packages: { name: string; source: string | null; manifest_path: string }[] };
const core = metadata.packages.find((p) => p.name === 'polyspec-binding-core');
if (core === undefined || core.source === null) throw new Error('Cargo.lock has no Git dependency polyspec-binding-core');
const commit = /#([0-9a-f]{40})$/.exec(core.source)?.[1];
if (commit === undefined) throw new Error(`polyspec-binding-core has no pinned commit: ${core.source}`);

// The crate is packages/core/rust of the binding repository; the tool is packages/ts beside it.
const checkout = resolve(dirname(core.manifest_path), '../../..');
const tool = join(root, 'var/binding', commit);
const packageDir = join(tool, 'packages/ts');
if (install) {
  if (!existsSync(join(packageDir, 'node_modules'))) {
    rmSync(tool, { recursive: true, force: true });
    execFileSync('git', ['clone', '--quiet', '--no-checkout', checkout, tool], { stdio: 'inherit' });
    execFileSync('git', ['-C', tool, '-c', 'advice.detachedHead=false', 'checkout', '--quiet', '--detach', commit], { stdio: 'inherit' });
    execFileSync(npm, ['ci', '--ignore-scripts', '--no-audit', '--no-fund', '--omit=dev'], { cwd: packageDir, stdio: 'inherit' });
  }
  process.exit(0);
}
if (!existsSync(join(packageDir, 'node_modules'))) {
  throw new Error(`binding ${commit} of Cargo.lock is not installed in ${tool}: run make install-binding`);
}

const result = spawnSync(process.execPath, [join(packageDir, 'src/cli.ts'), ...process.argv.slice(2)], { cwd: root, stdio: 'inherit' });
process.exit(result.status ?? 1);
