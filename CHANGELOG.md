<!-- doc-id: changelog -->

## Unreleased

- The historical binding 0.0.2 pin task T1.3 is withdrawn: the later pins select released binding 0.0.4
  (T1.4-1) and binding 0.0.5 (T1.7-1). The 0.0.2 asset release is not claimed complete. No work to restore the older pin is needed.
  This records supersession, without claiming a newly run verification of that old pin. T1.4 stays withdrawn and
  the planned 0.0.4 graph/native and final CI tasks remain waiting.

- Historical 0.0.3 release: T1.7 is complete. The [release workflow](https://github.com/polyspec/http-media-type/actions/runs/43638003353)
  succeeded and [v0.0.3](https://github.com/polyspec/http-media-type/releases/tag/v0.0.3) is public with 15 uploaded assets:
  three wheels, four npm packages, six PHP-minor/platform binaries, the Composer archive and packages.json.
  The Go module tag contains generated files and five native libraries; the release consumer test passed.
  The retained native verification record covers Mac Python, Node CJS/ESM, PHP 8.4.27/8.5.10 and Go calls. This audit
  did not find their original raw Mac logs and did not rerun them. All T1.7 sub-items are complete. This is historical
  release closure; the planned 0.0.4 still needs its graph, native and complete CI proof.

- Historical 0.0.3 verification: T1.7-3 is complete. The [release-tag CI run](https://github.com/polyspec/http-media-type/actions/runs/43637603260)
  and its [core job](https://github.com/polyspec/http-media-type/actions/runs/43637603260/job/132577751340) passed both
  `docs-check` and `release-coverage`, with all seven targets complete. The logged tree matches the immutable
  `v0.0.3` tree; the exact tree and run identifiers are retained in ignored
  `var/report/release-state-v0.0.3/audit.json`. This closes historical version verification, not native or complete
  CI verification of the planned 0.0.4.

- PHP extension assets have independent platform/minor jobs, each with one native setup, an expected-minor build
  argument and a distinct artifact. Non-PHP platform assets build once. The workflow owner passes five tests,
  including mutations of missing and duplicate combinations, runners, setup/build ownership and artifact identity.
  Red: the earlier workflow had no `php` job and built both minors inside `platform`. Native asset proof remains
  pending the published binding expected-minor recipe and its execution (T1.8-1, T1.8-3). The declared workflow
  verification also passed all five tests on the committed implementation; T1.8-2 records that source-level proof.

- The next release plan requires matching binding 0.0.7 generator and core dependencies and independently selectable
  PHP-minor asset jobs. The current release tree uses binding 0.0.5. The planned version is 0.0.4; dependency updates,
  generated target verification and publication remain waiting tasks.

## 0.0.3

- The PHP minors for which a release builds the PHP extension are `phpExtension.minors` of `config/toolchain.json`
  (8.4 and 8.5), and `tests/scripts/workflows.test.mts` requires one setup of each minor followed by one `make
  release-php-ext PHP=php` in the job `platform` of `assets.yml`, in the order of the list and for no other minor.
  Before, the minors were written only in `assets.yml`. Red: the new test failed while `config/toolchain.json` had no
  list, and fails for the list `["8.4"]` and for an `assets.yml` that sets up 8.6 in place of 8.5. Green: `make
  test-scripts` passes 12 tests.

- binding is the release 0.0.5 in place of 0.0.4: `package.json` names its release asset, `package-lock.json` pins its
  integrity, `polyspec-binding-core` of every Cargo manifest names the tag `v0.0.5`, binding scaffold of 0.0.5 wrote
  the binding crates again, and `Cargo.lock` pins the commit of the tag. The recipe `release-wheel` of binding 0.0.4
  built the wheels of the Linux runners with the tag `linux_<arch>`, and `release-platform-assets` refused them, so the
  release 0.0.2 stopped with `var/release/assets/wheel/<name>-0.0.2-cp314-abi3-linux_aarch64.whl is no wheel of a
  platform of the release` and stays a draft with the Composer package alone; binding 0.0.5 builds them for the policy
  `manylinux_2_34` (binding B2.267). Verified: `binding check --release` gives no finding, and `make bindings-check`,
  `make docs-check`, `make test-scripts` and `make release-coverage` pass.

## 0.0.2

- binding is the release 0.0.4 in place of 0.0.3: `package.json` names its release asset, `package-lock.json` pins its
  integrity, `polyspec-binding-core` of every Cargo manifest names the tag `v0.0.4`, binding scaffold of 0.0.4 wrote
  the binding crates again, and `Cargo.lock` pins the commit of the tag. The recipe `release-npm` of `packages/release.mk`
  that binding 0.0.3 writes read the list of `npm pack --dry-run --json` as an array, and the npm 12.2.0 of `devEngines`
  writes an object keyed by the name of the package, so the job `assets / npm` would fail at `release-npm` with
  `TypeError: Cannot read properties of undefined (reading 'files')`; binding 0.0.4 reads that object (binding B2.266).
  Verified: `binding check --release` gives no finding, and `make bindings-check`, `make docs-check`, `make
  test-scripts` and `make release-coverage` pass.

- The release holds the packages of the bindings per platform as assets of its GitHub Release. binding 0.0.3 writes
  the release recipes of the contract (binding GN-19h): `make release-recipes` runs `binding release-recipes --root .`,
  which writes the ignored file `packages/release.mk`, and the Makefile includes it after it defines `BINDING_RUN`,
  `NODE`, `NPM`, `UV` and `BINDING_DEP`, so the repository keeps no recipe of its own. The new workflow
  `.github/workflows/assets.yml` builds on `ubuntu-26.04`, `ubuntu-26.04-arm` and `macos-15` the static library of
  the Go module, the abi3 wheel, the PHP extension for PHP 8.4 and 8.5 and the npm platform package of each platform,
  and on `ubuntu-26.04-arm` the npm package with its WASM module (binding GN-19a, GN-19i). `ci.yml` calls it for every
  run, and `release.yml` calls it for the tag, creates the draft release with the Composer package of the PHP extension,
  carries the Go module with `make release-go-module`, uploads the assets with `make release-platform-assets` and makes
  the release public. `config/release.json` releases the Composer package of `packages/php-ext` and no longer names
  `packages/go` in `goModules`: the tag `packages/go/v0.0.1`, which kit set at the release commit, holds neither the
  generated files nor the static libraries, so a consumer of the Go module could not build it, and `make
  release-go-module` now tags the commit that adds them (binding GN-19f). The dependency on binding is the release
  0.0.3 (`package.json`, `package-lock.json`, the tag `v0.0.3` of `polyspec-binding-core` of every Cargo manifest, and
  `Cargo.lock`); `@napi-rs/cli` 3.10.12 is a devDependency, `config/toolchain.json` pins LLVM 21, `rust-toolchain.toml`
  names `llvm-tools` and the musl targets of the Linux arches, and `mise.toml` with `mise.lock` names uv 0.12.24. The
  target `release-checkout` is removed, since each job of the release checks out the tag. The new test
  `tests/scripts/workflows.test.mts` checks the runners, the pins, the run steps and the order of the release steps.
  Red: `binding check --release` reported `CK-94 includes no packages/release.mk` for the Makefile, and `make
  test-scripts` failed the three tests of `workflows.test.mts`. Green: `binding check --release` gives no finding, `make
  test-scripts` passes 11 tests, and `make docs-check` and `make release-coverage` pass.

## 0.0.1

- binding is a released dependency. `polyspec-binding-core` of the core and of the binding crates names the tag
  `v0.0.2` of the binding repository in place of the branch `v1/rust-core`, binding scaffold of 0.0.2 wrote the binding
  crates again, and `Cargo.lock` pins the commit of the tag. The tool is the npm package `@polyspec/binding` of the same
  release, which `package.json` names by the URL of its release asset and `package-lock.json` pins by its integrity;
  the recipes run its `dist/cli.js`, and `make install-binding` runs `cargo fetch --locked`, because binding reads the
  crates with `cargo metadata --locked --offline`. `scripts/binding.mts`, which cloned binding at the commit of
  `Cargo.lock` into `var/binding`, is removed. The new test `tests/scripts/binding.test.mts` failed its four tests on
  the branch dependency and passes with the release. `make bindings` generates the five targets, and `make
  bindings-check` and `binding check --release` give no finding.

- `AGENTS.md` states that no tracked file names a Git commit, and `make test-scripts` checks it
  (`tests/scripts/commits.test.mts`); the lock files, the workflows, the digests of `config/toolchain.json` and the
  contract cases are left out by name, because they pin by a commit or hold other hexadecimal data. Before, the rule
  was neither stated nor checked. The test passes on the tree and fails on a line that names a commit id.

- The repository has the plan `docs/plans/rust-core/plan.md` and its checklist `docs/plans/rust-core/checklist.md`, each
  with its Korean twin, in the form of the other polyspec repositories; the checklist holds what the first release
  still needs. `make docs-check` reads the documents of `config/documents.json` and the checklist with the rows of
  `config/checklist.json`, and `make check` and the entry `core` of CI run it; `make documents-stamp` writes the
  `source-sha256` of a reviewed Korean twin. Before, no check read the documents, so a Korean twin could fall behind its
  English file unseen. `AGENTS.md` states that binding generates the release recipes of the platform packages, so the
  rows of the branch `lane/release-wasm` are taken without its `make release-wasm`.

- `[profile.release]` sets `lto = false`; before, it set `lto = true`, with which a Go program that links the Go
  static library beside the static library of another polyspec repository, as the Go module of http-negotiation links it, fails with duplicate symbols such as
  `rust_eh_personality` (binding GN-15i, CK-91). Cargo sets `lto` for a whole profile, so the PHP extension, the Node
  addon and the wheel of a release are built without LTO too. `Cargo.lock` pins `polyspec-binding-core` at the head
  of the branch `v1/rust-core` of binding, whose scaffold writes the binding packages as they are and whose `binding
  check` reports CK-91 for a release profile with LTO: with `lto = true` `make bindings-check` fails with CK-91, with
  `lto = false` it passes. The new test
  `tests/scripts/profile.test.mts` reads the profile of `Cargo.toml` and `.cargo/config.toml`: before the change
  `make test-scripts` failed one test, with it every test passed. Verified: `make -k bindings-check test-scripts lint-bindings check-declarations test-python test-node test-wasm test-php test-go` passed.

- The recipes run the node and the npm of `var/tools/bin` by their paths, and only the install targets download. `make
  install-binding` installs binding at the commit of `Cargo.lock` and fetches the crates of `Cargo.lock`, and CI runs it
  in every job; `scripts/binding.mts` reads them offline and fails while they are missing. `mise.toml` and `mise.lock`
  pin maturin 1.16.0 at the digests of binding, which `make test-python` runs in place of a maturin that pip installed
  from PyPI, and the wheel is installed without an index. `make check-declarations` takes TypeScript from `make
  install-packages` and no longer runs `npm ci`, and `make node-package` installs its tarballs offline. Before,
  `scripts/binding.mts` and three recipes downloaded during a check, and `bindings-check`, `npm pack` and `node --test`
  ran the node and the npm that the `PATH` of the machine named. The new test `tests/scripts/recipes.test.mts` reads the
  dry run of the binding recipes and of `make install-binding`; `make test-scripts`, a target of `make check` and of the
  entry `core` of CI, runs it and gave 0 passed, 2 failed before the change and 2 passed, 0 failed with it.

- `Cargo.lock` pins `polyspec-binding-core` at the head of the branch `v1/rust-core` of binding, and the binding
  packages are the ones that binding scaffold of that binding writes, so `make bindings-check` reports no finding.
  Before, it reported the lock (CK-20) and nine files (CK-19). Each binding crate names the licence `MIT` of the core,
  and so does `packages/python/pyproject.toml` (CK-71). `packages/python/build.rs` is new: it declares the cfg
  `pyo3_disable_reference_pool`, with which the generated code refuses a build (binding GN-6u).
  `packages/ts/package.json` has `"type": "module"`, `napi.binaryName` and `napi.targets` and no
  `optionalDependencies`: a release writes the platform packages into the manifest that it packs, because a lock that
  named them could not be installed before that release (binding GN-3c). `packages/php-ext/composer.json` names
  `php-ext.download-url-method` `pre-packaged-binary`. The generated Go files `zz_generated_*.go` are no longer
  tracked, and `.gitignore` names them: a release adds them and the static library of each platform in the commit of
  its Go tag (binding GN-15g), and the tracked copies differed from what the pinned binding writes.

- The release tags the Go module `packages/go` with `packages/go/vX.Y.Z` at the release commit: `goModules` of
  `config/release.json` names the module. Before, `goModules` was empty and the rules said that a tag tags no Go
  module; Go takes a module below the root of a repository only by a tag of that form, so no other repository could
  require the module at a version (binding GN-15g). `make release-coverage` reports every package file classified.
  `AGENTS.md` states what is open before the first release: `main` on `origin`, and the packages of the bindings, which
  wait for kit 0.0.111 and a release of binding.

- CI and the release (AGENTS.md, "CI and release"): `.github/workflows/ci.yml` runs `make check`, `make test-bindings`
  and `make release-coverage` on `ubuntu-26.04-arm` for the push of `main` and a manual run, in the jobs `core` and
  `bindings`, and its last job `ci-passed` passes only when both passed. `.github/workflows/release.yml` tags the commit
  of such a run with the version of the top section of `CHANGELOG.md` and creates its GitHub Release.
  `config/release.json` classifies every package file: a tag releases the core crate `packages/rust` as a Git tag and is
  the version of the binding manifests, and it releases no archive, because a binding is built per platform and the
  release utility of kit 0.0.109 packs only npm packages, Composer source archives and pure Python wheels. The Makefile
  adds `install-php-tools`, `ci-targets`, `ci-summary`, `ci-passed`, `release-tag`, `release-checkout`,
  `release-prepare`, `release-tools`, `release-tools-path`, `release-assets`, `release-publish`, `release-undraft` and
  `release-coverage`. Before, the repository had no CI and no release.

- `Cargo.lock` pins `polyspec-binding-core` at a commit of the branch `v1/rust-core` of binding, and the binding crates
  are the ones that binding scaffold of that commit writes (binding BD-9, GN-3d): each crate takes the lints of the
  workspace through `[lints] workspace = true`, each allow attribute of `src/lib.rs` is one line that names its rule as
  the reason, with the reason in a comment above it, and the PHP crate has `build.rs`, which tells the macOS linker to
  leave the symbols of PHP undefined for its library alone, with `test = false` and `doctest = false` in `[lib]`.
  `.cargo/config.toml` is removed: it gave the same link setting to every crate of the workspace, the test executables
  of the core included. The Node addon takes it from `napi_build::setup()` of its `build.rs`. The tracked Go files
  `zz_generated_*.go` are the ones that `make bindings` of that commit writes. `make fmt-check` passes with the
  `rustfmt.toml` of this repository, which had failed on the attributes that binding wrote over several lines.

- The tools are pinned and installed into `var/tools` of the checkout as in binding: `mise.toml` and `mise.lock` pin
  Node.js 26.12.0, npm 12.2.0, Go 1.27.3, Python 3.14.8, Composer 2.10.3 and the wasm-bindgen CLI 0.2.130 with the
  digests of binding, `config/toolchain.json` pins mise 2026.10.10, `.php-version` names PHP 8.4, and
  `rust-toolchain.toml` adds the target `wasm32-unknown-unknown`. `package.json` names npm 12.2.0 in `devEngines` and
  adds `@polyspec/kit` 0.0.109, whose installers `make bootstrap`, `make install`, `make install-tools`, `make
  install-packages` and `make toolchain-lock` run, as the recipes of binding do. Every recipe runs with `var/tools/bin`
  and the shims of mise first on `PATH`, and `GO`, `GOFMT`, `WASM_BINDGEN`, `PHP` and `PHP_CONFIG` name the tools of
  `var/tools`. Before, every recipe ran the tools that the `PATH` of the machine named, at no pinned release.

- `make test-bindings` builds and tests every target of the contract (binding BD-27): `make test-wasm` and `make
  test-go` are added beside `make test-python`, `make test-node` and `make test-php`. `make test-wasm` runs the
  generated tests and the new contract cases `packages/ts/tests/cases.wasm.test.mjs` on node --test through the subpath
  `./wasm` of the installed package; the module and its glue are written by the wasm-bindgen CLI, whose release must be
  that of the `wasm-bindgen` crate, before the package is packed, so `make test-node` and `make test-wasm` share the
  step `node-package`. `make test-go` builds the static library with the features `panic-test` and `codec-test`, runs
  gofmt and go vet, then the generated tests and the new contract cases `packages/go/tests/cases_test.go` on go test,
  with the Go of the go directive of `packages/go/go.mod` and `GOTOOLCHAIN=local`. `make check-declarations` also
  checks the declarations of the WASM binding. The variables `GO`, `GOFMT` and `WASM_BINDGEN` name the two tools. The
  Go files `zz_generated_*.go` are tracked (binding GN-3), and `packages/ts/wasm/generated` and
  `packages/go/internal/ffi/generated` are ignored. Before, no make target built or tested the Go and WASM bindings.
  Every contract case passes on each of the five runners: unittest, node --test for Node and for WASM, PHPUnit and go
  test. `make fmt-check` still fails on `packages/go/internal/ffi/src/lib.rs`, the line of 125 characters that binding
  scaffold writes.

- The contract names the five targets of binding (BD-27): `targets` of `packages/rust/interface.json` is php, python,
  node, go and wasm, `packages.go` names the Go module `github.com/polyspec/http-media-type/packages/go`, the entry `.`
  of the npm package takes the conditions `{node: napi, browser: wasm}`, each error class names its WASM class, the
  Node one, and `errors.fixed` names `TypeError` for WASM as for Node. Before, the contract named php, python and
  node, so no Go or WASM binding was generated. The tracked binding packages gain what binding scaffold writes for the
  two targets (`packages/go/go.mod`, `packages/go/internal/ffi`, `packages/ts/wasm`, the browser exports of
  `packages/ts/package.json`), and both crates are members of the workspace. The contract check has no finding. No make
  target builds or tests the Go and WASM bindings yet. `make fmt-check` fails on `packages/go/internal/ffi/src/lib.rs`:
  binding scaffold writes its `allow` attribute in one line of 125 characters, beyond `max_width = 120` of
  `rustfmt.toml`, and the file is not edited by hand.

- `Cargo.lock` pins the binding whose generator holds the value aliases, the fault injection and the error units in one
  line of development (CK-20), and the binding packages are those that its scaffold writes: each binding crate takes
  `polyspec-binding-core` with the features `construct` and `lock`, and the lock gains `tokio` as a dependency of
  `polyspec-binding-core`. The contract check has no finding. The generated sources gain a compile-time proof that each
  error variant a member raises is a variant of `Error` (E-5), and the generated Node tests also check each raised error
  with `instanceof` of its class. The behavior of the three packages is the same.

- `make test-php` and `make lint-bindings` find PHP without an argument: the default of `PHP` and of `PHP_CONFIG` is
  the path that `command -v` gives. Before, the default was the bare name `php`, which ext-php-rs reads as a path of a
  file and fails with "php executable not found at php".

- Every tracked document is a pair of an English file `X.md` and a Korean file `X.ko.md`. `AGENTS.ko.md` and
  `docs/spec/media-type.ko.md` are added. Both files of a pair hold the same marker `doc-id` in their first line, and
  the Korean file holds `source-sha256`, the sha256 of its English file, in its second line.

- `composer.lock` is tracked, so `composer install` installs the PHPUnit that runs the tests of the PHP extension at one
  pinned version.

- The bindings build and load on macOS: `.cargo/config.toml` tells the macOS linker to leave the symbols of PHP and
  Node undefined, which the runtime gives when it loads the library, and `make test-node` and `make test-php` name the
  library that Cargo builds by the extension of the platform (`dylib` on macOS, `so` on Linux). Before, the PHP
  extension did not link on macOS and both recipes named a `.so` file that Cargo does not write there.

- `scripts/binding.mts` clones the checkout that Cargo made of the pinned binding commit into `var/binding/<commit>`
  and no longer copies its files. `binding check` reads its own commit from its Git checkout and compares it with the
  commit of `Cargo.lock` (CK-20); with a copy of the files it found no commit, and `make bindings-check` failed.

- `make test-node` packs the platform package of the addon of the machine as a release does and installs it with the Node
  package, which holds no addon (GN-3c).
