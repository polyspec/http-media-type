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
- The workspace lints deny every warning, unsafe code, `unwrap`, `expect`, `as` conversions and discarded results;
  `clippy.toml` disallows the methods that turn a failure or an absence into a value (`Option::unwrap_or` and its
  family, `Result::ok`, `map_or`, `map_or_else`). A use that a rule needs carries `#[allow(..., reason = "<rule id>")]`.
- No function performs I/O, keeps state or waits (MT-9).

## Bindings

- The repository is one Cargo workspace: the core `packages/rust` and the binding crates of the five targets
  (binding BD-27) `packages/python`, `packages/ts`, `packages/ts/wasm`, `packages/php-ext` and
  `packages/go/internal/ffi` (with `packages/go/go.mod`), which `binding scaffold` writes and `make bindings-check`
  compares; their `generated/` is not tracked. `Cargo.lock` at the root pins every dependency.
- `polyspec-binding-core` is a Git dependency of the core and of the binding crates (branch `v1/rust-core` of the
  binding repository) until binding is released; `Cargo.lock` pins its commit. The core implements
  `binding_core::Kinds` for its error (MT-8).
- binding itself is the TypeScript tool of the same repository, which no registry holds yet. `scripts/binding.mts` takes
  it from the checkout that Cargo made of the commit that `Cargo.lock` pins, clones it into `var/binding/<commit>` and
  installs its dependencies there by its `package-lock.json`, so that the generator and `binding_core` are one version.
  The clone is a Git checkout of binding at that commit: binding check reads its own commit from it and compares it with
  the commit of `Cargo.lock` (CK-20), which a copy of the files alone fails. This holds only until the first release of
  binding.
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
- In the Go module binding owns the files `zz_generated_*.go` (binding GN-3); they are tracked, because a Go module is
  fetched as source, and `make bindings` writes them again. `packages/ts/wasm/generated` and
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
  names Node.js, npm, Go, Python, Composer and the wasm-bindgen CLI at the releases of binding and `mise.lock` their
  digests, `config/toolchain.json` the release of mise and its digests, `rust-toolchain.toml` the Rust toolchain with
  the target `wasm32-unknown-unknown` and `.php-version` the PHP of the machine, which the wrappers of `var/tools/bin`
  run. A fresh checkout runs `make bootstrap`, which installs `package-lock.json` with the npm of `devEngines` of
  `package.json`, then `make install`, which runs the installers of `@polyspec/kit` (`make install-tools`). Every recipe
  runs with `var/tools/bin` and the shims of mise first on `PATH`; `GO`, `GOFMT` and `WASM_BINDGEN` name the shims of
  mise and `PHP` and `PHP_CONFIG` the wrappers of `var/tools/bin`.
- The development tools are dependencies of the repository: TypeScript and `@polyspec/kit` in `package.json`, pinned by
  `package-lock.json`, and PHPUnit in `require-dev` of `composer.json`, installed into `vendor/` by `composer install`
  and pinned by `composer.lock`.

## Checks

- `make test` runs the contract cases, the citation checks, the random tests and the runtime properties of the core.
- `make lint` runs `cargo fmt --check` and clippy of the core with every warning denied; `make check` runs both and
  `make bindings-check`.

## Commits and changes

- A commit message is `type(scope): Subject` with a type of feat, fix, docs, style, refactor, test or chore, a Subject
  of at most 50 characters that starts with a capital letter and ends without a period, a blank line and a body
  wrapped at 72 characters.
- A behavior change, its spec, its cases and its entry under `## Unreleased` of `CHANGELOG.md` and `CHANGELOG.ko.md`
  are one change.
