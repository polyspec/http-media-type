<!-- doc-id: changelog -->

## Unreleased

- `Cargo.lock` pins `polyspec-binding-core` at the commit 1bf0025 of binding, and the binding crates are the ones
  that binding scaffold of that commit writes (binding BD-9, GN-3d): each crate takes the lints of the workspace through
  `[lints] workspace = true`, the attributes of `src/lib.rs` are formatted as `cargo fmt` writes them, and the PHP crate
  has `build.rs`, which tells the macOS linker to leave the symbols of PHP undefined for its library alone, with `test =
  false` and `doctest = false` in `[lib]`. `.cargo/config.toml` is removed: it gave the same link setting to every crate
  of the workspace, the test executables of the core included. The Node addon takes it from `napi_build::setup()` of
  its `build.rs`.

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
