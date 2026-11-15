<!-- doc-id: agents -->
# Development

The working principles of every polyspec repository are in `PRINCIPLES.md` of polyspec; this file states only the
rules of this repository.

## Scope

- This library reads and writes the media types of HTTP, compares the values of their parameters and owns the grammar
  of tokens, quoted strings and parameters (`docs/spec/media-type.md`, MT-1 to MT-9). A reader of another field that
  uses that grammar, such as a media range of `Accept`, reads it through the public module `grammar` (MT-7) and does
  not define it again. Which field a media type comes from and the status of a failure are decisions of the caller
  (MT-8.1).

## Rules and order of work

- The rules are the statements of `docs/spec/media-type.md`. A change of a rule changes the spec first, then the cases
  of `contracts/media-type.json`, then the code. Every case and every test names the statements that it checks, and
  `tests/contracts.rs` fails a statement that no case or test cites and a citation of no statement.
- A statement keeps its id only while its meaning stays; a change of meaning retires the id and adds a new statement.
- A text of `contracts/media-type.json` is bytes, one character per byte (U+0000 to U+00FF). A failure is the object
  `raises` with `kind`, `status`, `category` and `message`, and a case that fails has no result key.
- Every rule is in the Rust core `packages/rust`. A binding converts types and holds no rule; the bindings are
  generated from the interface contract `packages/rust/interface.json` and are not written by hand (see Bindings). The contract is
  in the crate package (`include` of `packages/rust/Cargo.toml`), so that a repository that depends on the crate reads
  it through Cargo.
- An input that changes no result is a row of the table "Inputs ignored" of the spec, with its standard clause and a
  case that shows it. An input ignored without such a row is a defect.
- A record of this repository (spec, comment, test, changelog, commit message) states rules and their reasons by rule
  id and standard clause. It names no source of a rule and no person who decided it.

## Rust

- `rust-toolchain.toml` pins the toolchain and `Cargo.lock` the dependencies.
- `[profile.release]` of `Cargo.toml` sets `lto = false` and `codegen-units = 1` (binding GN-15i, CK-91). The Go
  static library is built with the release profile, and LTO would put the standard library and `binding_core` into
  its one object, so a Go program that links it beside the static library of another polyspec repository, as the Go module of http-negotiation links it, would fail with
  duplicate symbols such as `rust_eh_personality`. Cargo sets `lto` for a whole profile and not for one package, and
  binding builds the Go static library with `[profile.release]`, so the profile itself keeps LTO off, and the PHP
  extension, the Node addon and the wheel of a release are built without it too; `codegen-units = 1` keeps the
  optimization across the units of each crate. `tests/scripts/profile.test.mts` requires the profile.
- The workspace lints deny every warning, unsafe code, `unwrap`, `expect`, `as` conversions and discarded results;
  `clippy.toml` disallows the methods that turn a failure or an absence into a value (`Option::unwrap_or` and its
  family, `Result::ok`, `map_or`, `map_or_else`). A use that a rule needs carries `#[allow(..., reason = "<rule id>")]`.
- No function performs I/O, keeps state or waits (MT-9).

## Bindings

- The repository is one Cargo workspace: the core `packages/rust` and the binding crates of the five targets
  (binding BD-27) `packages/python`, `packages/ts`, `packages/ts/wasm`, `packages/php-ext` and
  `packages/go/internal/ffi` (with `packages/go/go.mod`), which `binding scaffold` writes and `make bindings-check`
  compares; their `generated/` is not tracked. `Cargo.lock` at the root pins every dependency.
- `polyspec-binding-core` is a Git dependency of the core and of the binding crates on the tag `v0.0.8` of the binding
  repository, its release; `Cargo.lock` pins the commit of that tag. The core implements `binding_core::Kinds` for its
  error (MT-8).
- binding itself is the npm package `@polyspec/binding` of the same release, which `package.json` names by the URL of
  its release asset and `package-lock.json` pins by its integrity, so that the generator and `binding_core` are one
  version (G-6); binding check takes the tag of `Cargo.lock` as its own (CK-20). The recipes run
  `node_modules/@polyspec/binding/dist/cli.js` with the node of `var/tools/bin`. The bootstrap and `make
  install-packages` install it, and `make install-binding` fetches the crates of `Cargo.lock` (`cargo fetch
  --locked`), which binding reads with `cargo metadata --locked --offline`; `make bindings-check` and `make bindings`
  download nothing and fail while they are missing, because a check that downloads depends on the network.
  `tests/scripts/binding.test.mts` requires the tag, the asset, its integrity and these recipes.
- A case of `contracts/media-type.json` follows the case convention of binding (G-5): its keys are the parameter names
  in snake_case (`media_type`), and a record is the object of its fields (a parameter is `{"name", "value"}`).
- `make bindings` generates; every make target that builds or tests a binding runs it first. `make test-bindings` runs
  clippy on the whole workspace, `make check-declarations`, then `make test-python`, `make test-node`, `make
  test-wasm`, `make test-php` and `make test-go`, one for each of the five targets of the contract, each of which runs
  the tests that binding generates and the contract cases of the binding on the standard runner of its language:
  unittest, node --test (Node and WASM, the WASM binding through the subpath `./wasm` of the same installed package),
  PHPUnit and go test. The contract cases are `packages/python/tests`, `packages/ts/tests/cases.test.mjs`,
  `packages/ts/tests/cases.wasm.test.mjs`, `packages/php-ext/tests` and `packages/go/tests`. A target that the
  generator cannot take stays a failing target with its cause; no target is left out or skipped (binding BD-27).
- In the Go module binding owns the files `zz_generated_*.go` (binding GN-3), which `make bindings` writes. They are
  not tracked, and neither is a static library of `packages/go/internal/ffi/lib/<platform>`: a release adds both in the
  commit of its Go tag, because Go fetches a module as the source of a tag (binding GN-15g, CK-19), and a tracked copy
  would differ from what the pinned binding writes after every change of the pin. `packages/ts/wasm/generated` and
  `packages/go/internal/ffi/generated` are not tracked; wasm-bindgen writes the module and its glue into the first.
  The variables `PYTHON` (3.14 or later), `PHP`, `PHP_CONFIG`, `PHPUNIT`, `GO`, `GOFMT` and `WASM_BINDGEN` name the
  runtimes. `make test-go` fails a Go of another release than the go directive of `packages/go/go.mod` and runs it with
  `GOTOOLCHAIN=local`, so that it fetches no toolchain, and `make test-wasm` fails a wasm-bindgen CLI of another release
  than the `wasm-bindgen` crate of `packages/ts/wasm/Cargo.toml`, because the CLI reads only a module of its own
  release (binding GN-18). `CARGOFLAGS` adds
  arguments to every cargo build. On macOS a PHP extension and a Node addon take the symbols of their runtime when it
  loads them, so the linker must leave them undefined: the `build.rs` that binding scaffold writes for each of the two
  crates says so for its library alone (binding GN-3d), and no tracked file gives a link setting in `RUSTFLAGS` or
  `.cargo/config.toml`. The recipes name the library that Cargo builds by the extension of the platform (`dylib` on
  macOS, `so` on Linux).
- The tools are pinned in tracked files and installed into `var/tools` of the checkout, as in binding: `mise.toml`
  names Node.js, npm, Go, Python, Composer, the wasm-bindgen CLI, maturin and uv at the releases of binding and `mise.lock` their
  digests, `config/toolchain.json` the release of mise and its digests and the major release of LLVM, `rust-toolchain.toml` the Rust toolchain with
  the component `llvm-tools` and the targets `wasm32-unknown-unknown`, `x86_64-unknown-linux-musl` and `aarch64-unknown-linux-musl`, and `.php-version` the PHP of the machine, which the wrappers of `var/tools/bin`
  run. A fresh checkout runs `make bootstrap`, which installs `package-lock.json` with the npm of `devEngines` of
  `package.json`, then `make install`, which runs the installers of `@polyspec/kit` (`make install-tools`). Every recipe
  runs with `var/tools/bin` and the shims of mise first on `PATH`; `GO`, `GOFMT` and `WASM_BINDGEN` name the shims of
  mise and `PHP` and `PHP_CONFIG` the wrappers of `var/tools/bin`.
- The development tools are dependencies of the repository: TypeScript and `@polyspec/kit` in `package.json`, pinned by
  `package-lock.json`, and PHPUnit in `require-dev` of `composer.json`, installed into `vendor/` by `composer install`
  and pinned by `composer.lock`.

## Checks

- `make test` runs the contract cases, the citation checks, the random tests and the runtime properties of the core.
- `make lint` runs `cargo fmt --check` and clippy of the core with every warning denied; `make check` runs both,
  `make bindings-check`, `make docs-check` and `make test-scripts`.
- `make docs-check` reads each document that `config/documents.json` selects, with its links, anchors and fences and
  the `doc-id` and `source-sha256` of each Korean twin, and the checklist `docs/plans/rust-core/checklist.md`, whose
  rows `config/checklist.json` declares. The plan of the repository is `docs/plans/rust-core/plan.md`; a task is a row
  of that checklist, marked `[o]` only after its verification command passed on the committed tree. Run it before a
  commit. Every tracked document is an English file `X.md` and its Korean twin `X.ko.md`, and `make documents-stamp
  PATHS=<twin>` writes the `source-sha256` of a twin after its translation is reviewed; no marker is written by hand.

## CI and release

- Every job of a workflow that CI runs (`ci.yml`, `assets.yml` and any workflow that they call) is one recipe
  `ci-<job>` of the Makefile. The job has exactly one run step, `make ci-<job>` with make variables alone; a matrix
  value or an input of the called workflow is passed as `NAME=${{ matrix.key }}` or `NAME=${{ inputs.key }}`, and no
  other expression appears in a run line. Every other step is a `uses:` step that provisions the runner or carries a
  result: the checkout, `setup-php`, the bootstrap action, the upload of a report or an asset. A condition `if:` is
  allowed only on a `uses:` step, and no run step, job or workflow sets an environment. The recipe holds the order and
  the conditions of the job: its installs first, which stop it at their failure, then its checks, each run to its end
  (`make ci-targets`, or the goals of one `make -k`), then its report always, and its status is that of the checks;
  the values that the YAML held, such as the targets of a matrix entry, are variables of the Makefile. The reason: a
  job whose content is in YAML steps, step conditions and expressions runs only on the runner of GitHub, so a local
  run could not be the run of CI; with the content in the recipe, `make ci-<job> NAME=value` is the same call locally
  and in CI. The judgement job `ci-passed` reads the results of the other jobs and exists only in CI: its one run step
  is `make ci-passed RESULTS='${{ toJSON(needs) }}'`, the only other expression. The jobs `tag` and `release` of `release.yml` follow
  the rule too, as `make ci-tag` and `make ci-release`; they take the values of their run, such as the token, the id
  of the CI run, the actor and the outputs of `needs`, through the `env:` of the job, so that their run line stays
  `make ci-<job>`, and the job `release` downloads the assets of each platform before its run step.
  `make test-scripts` checks it (`tests/scripts/workflows.test.mts`).
- `assets.yml` keeps the non-PHP builds in `platform` once per platform and gives `php` the complete
  platform by `phpExtension.minors` matrix. Each PHP entry has one setup of `matrix.php`, one
  `make ci-php EXPECTED_PHP_MINOR=${{ matrix.php }}`, whose recipe builds the extension once with `make release-php-ext
  PHP=php EXPECTED_PHP_MINOR=$(EXPECTED_PHP_MINOR)`, and the distinct artifact
  `assets-php-${{ matrix.platform }}-${{ matrix.php }}`. Both jobs use the runner of their platform. The release merges
  `assets-*` artifacts. This ownership prevents one minor from replacing another and lets a local run select one
  real runtime. Workflow tests establish the declared structure; native proof waits for the published binding
  recipe with its expected-minor check (B2.275), regeneration and actual execution. A skipped setup action proves no
  runtime selection.
- `.github/workflows/ci.yml` runs on the push of `main` and on a manual run, one job per matrix entry: `core` runs
  `lint-rust`, `fmt-check`, `test`, `bindings-check`, `docs-check`, `test-scripts` and `release-coverage`, and `bindings` runs the targets of `make
  test-bindings`. Each job runs `make ci-check NAME=<name>`, whose recipe installs the tools of the entry
  (`CI_CHECK_INSTALLS_<name>`), runs its targets (`CI_CHECK_TARGETS_<name>`) with `make ci-targets`, which runs every
  target to its end and writes the report `var/ci/<name>/`, and writes the summary of the job with `make ci-summary`. The job `assets` calls `.github/workflows/assets.yml`, which builds the assets of each platform as a
  release does, so that an asset that does not build stops the release before a tag exists. The last job `ci-passed`
  passes only when every other job passed. The jobs run on `ubuntu-26.04-arm`, but for the jobs `platform` and `php` of
  `assets.yml`, which runs on `ubuntu-26.04`, `ubuntu-26.04-arm` and `macos-15`, because the asset of a platform is
  built and loaded only on that platform and no tool of the release compiles for another (binding GN-19a). The jobs pin
  every action by its commit, set no `timeout-minutes` and run every command of a step as one make target, so that the
  settings of the Makefile apply to it; `make test-scripts` checks these rules
  (`tests/scripts/workflows.test.mts`). `.github/actions/bootstrap` is the bootstrap of every job, and `make
  install-php-tools` installs PHPUnit of `composer.lock` into `vendor/` with the Composer of `mise.toml`.
- binding writes the release recipes of the contract (binding GN-19h): `make release-recipes` runs `binding
  release-recipes --root .`, which writes `packages/release.mk`, and the Makefile includes that file after it defines
  `BINDING_RUN`, `NODE`, `NPM`, `UV` and `BINDING_DEP`. The file is generated and not tracked, so it cannot drift from the
  pinned binding, and the repository writes no release recipe of its own: `binding check` reports a Makefile without the
  include or with a recipe of its own for a target of the file (CK-94). The recipes need the napi CLI `@napi-rs/cli` of
  `package.json`, the major release of LLVM of `config/toolchain.json` (`make install-llvm` installs it), the component
  `llvm-tools` and the musl targets of `rust-toolchain.toml`, and the uv of `mise.toml`.
- `config/release.json` classifies every package file, which `make release-coverage` checks. A tag `vX.Y.Z` releases the
  core crate `packages/rust` as a Git tag, which a Cargo dependency names with `tag = "vX.Y.Z"`, and it is the version
  of the binding manifests, which binding scaffold writes from the version of the core. kit packs the Composer package
  of the PHP extension `packages/php-ext`, whose `composer.json` tells PIE to download a pre-packaged binary. The
  workflow `assets.yml` builds the assets of each platform with the recipes of binding: the static library of the Go
  module, the abi3 wheel, the PHP extension for each PHP minor of `phpExtension.minors` of `config/toolchain.json` (8.4
  and 8.5; `make test-scripts` compares the PHP matrix of `assets.yml` with the list), the npm platform package, and the npm package itself
  with the WASM module. The Go module `packages/go` is not in `goModules`: `make release-go-module` makes the commit
  that adds the generated files and the static libraries to the tree of the tag, proves it with a consumer and tags it
  `packages/go/vX.Y.Z` (binding GN-19f), because a Go module whose tag holds neither cannot be built by a consumer.
- A release is the commit of a successful push or manual run of `ci.yml` on `main`. The version-bump commit
  `chore(release): Release X.Y.Z` sets the version of the core (`version` of `[workspace.package]` of the root
  `Cargo.toml`), writes the binding manifests again with binding scaffold (`node node_modules/@polyspec/binding/dist/cli.js scaffold --contract
  packages/rust/interface.json`), updates the versions of the local packages in `Cargo.lock` and renames `## Unreleased`
  of both changelogs to `## X.Y.Z`, with a new empty `## Unreleased` above it. When the CI run of that push succeeds,
  `.github/workflows/release.yml` starts by itself, and `gh workflow run release.yml -f run=<id>` starts it again: `make
  release-tag` creates and pushes the annotated tag `vX.Y.Z` at that commit, `assets.yml` builds the assets of each
  platform from the tag after `make release-binding-check`, `make release-publish` creates the draft GitHub Release with
  the archives of kit, `make release-go-module` carries the Go module, `make release-platform-assets` uploads the assets
  of each platform under the label `polyspec-http-media-type-<runtime>-<version>-<platform>` (binding GN-19g), and `make
  release-undraft` makes the release public. No tag is created by hand.

## Commits and changes

- A commit message is `type(scope): Subject` with a type of feat, fix, docs, style, refactor, test or chore, a Subject
  of at most 50 characters that starts with a capital letter and ends without a period, a blank line and a body
  wrapped at 72 characters.
- A behavior change, its spec, its cases and its entry under `## Unreleased` of `CHANGELOG.md` and `CHANGELOG.ko.md`
  are one change.
- No tracked file names a Git commit, of this repository or of another: a record states what changed and what a
  check gave, and names a dependency by what `Cargo.lock` pins ("the pinned binding") or by its release. A commit id
  says nothing to a reader without the repository, and it names nothing after a history is joined with another or
  written again, as the move of `v1/rust-core` onto `main` does. The files that pin by a commit are the exceptions:
  the lock files and the actions of the workflows. `make test-scripts` runs `tests/scripts/commits.test.mts`, which
  fails a tracked file that holds a commit id.
