CARGO := cargo
# Extra arguments of every cargo build, for example --ignore-rust-version on a machine without the pinned release.
CARGOFLAGS ?=
CORE := polyspec-http-media-type
BINDING := node scripts/binding.mts
CASES := $(CURDIR)/contracts/media-type.json
VAR := $(CURDIR)/var
export CARGO_TARGET_DIR ?= $(CURDIR)/target
# The language runtimes. PHP is the binary whose headers the extension is built against (PHP_CONFIG) and that loads it.
# Both are paths, because ext-php-rs reads PHP as the path of a file.
PYTHON ?= python3.14
PHP ?= $(shell command -v php)
PHP_CONFIG ?= $(shell command -v php-config)
PHPUNIT ?= vendor/bin/phpunit
MATURIN := maturin==1.16.0
# The Go of the go directive of packages/go/go.mod and the wasm-bindgen CLI of the release of the wasm-bindgen crate of
# packages/ts/wasm/Cargo.toml (binding GN-15, GN-18); test-go and node-package compare both releases before they use
# them.
GO ?= go
GOFMT ?= gofmt
WASM_BINDGEN ?= wasm-bindgen
# ext-php-rs reads them when it builds the extension.
export PHP PHP_CONFIG
# The file name extension of a library that Cargo builds as a cdylib: dylib on macOS, so on Linux (AGENTS.md,
# "Platforms").
CDYLIB := $(if $(filter Darwin,$(shell uname -s)),dylib,so)

.PHONY: check test lint lint-rust fmt-check bindings-check bindings test-bindings lint-bindings test-python test-node test-php \
	test-wasm test-go node-package check-declarations

# The core and the contract; none of them needs the generator (binding design L-2).
check: lint-rust fmt-check test bindings-check

lint: lint-rust fmt-check

test:
	$(CARGO) test $(CARGOFLAGS) -p $(CORE) --locked

lint-rust:
	$(CARGO) clippy $(CARGOFLAGS) -p $(CORE) --locked --all-targets -- -D warnings

fmt-check:
	$(CARGO) fmt --all --check

# The contract check and the comparison of the tracked binding packages with what binding writes (L-2 (c)).
bindings-check:
	$(BINDING) check packages/rust/interface.json

# Writes the generated sources into packages/{php-ext,python,ts}/generated, which are not tracked (G-6, L-1).
bindings:
	$(BINDING) generate --root .

test-bindings: lint-bindings check-declarations test-python test-node test-wasm test-php test-go

lint-bindings: bindings
	$(CARGO) clippy $(CARGOFLAGS) --workspace --locked --all-targets --features panic-test -- -D warnings

# The TypeScript compiler of package-lock.json checks the generated declarations of the Node binding.
node_modules/.package-lock.json: package-lock.json
	npm ci --no-audit --no-fund

check-declarations: bindings node_modules/.package-lock.json
	node_modules/.bin/tsc --noEmit --strict packages/ts/generated/index.d.ts
	node_modules/.bin/tsc --noEmit --strict packages/ts/wasm/generated/index.d.ts

# The wheel, installed into a virtual environment; the generated tests (G-5) and the contract cases (MT-1 to MT-8).
test-python: bindings
	$(PYTHON) -m venv --clear $(VAR)/venv
	$(VAR)/venv/bin/pip install -q $(MATURIN)
	rm -rf $(VAR)/wheels
	cd packages/python && $(VAR)/venv/bin/maturin build --locked --features panic-test --out $(VAR)/wheels $(CARGOFLAGS)
	$(VAR)/venv/bin/pip install -q --force-reinstall $(VAR)/wheels/*.whl
	cd $(VAR) && venv/bin/python -m unittest discover -s $(CURDIR)/packages/python/generated/tests -t $(CURDIR)/packages/python/generated/tests
	cd $(VAR) && HTTP_MEDIA_TYPE_CASES=$(CASES) venv/bin/python -m unittest discover -s $(CURDIR)/packages/python/tests -t $(CURDIR)/packages/python/tests

# The package and the platform package of the addon, packed and installed into var/node. T-2: the addon is the npm
# package of this machine's platform, which the package names in optionalDependencies; the recipe packs it as a release
# does and installs both tarballs, without the other platforms' packages. The package also holds the WASM module and its
# glue, which wasm-bindgen writes into packages/ts/wasm/generated before the package is packed (binding GN-18, P-5).
PLATFORM := $(shell node -p 'process.platform + "-" + process.arch + (process.platform === "linux" ? "-gnu" : "")')
NODE_ADDON := http-media-type.$(PLATFORM).node
WASM_BINDGEN_RELEASE := $(shell sed -n 's/^wasm-bindgen = "=\(.*\)"$$/\1/p' packages/ts/wasm/Cargo.toml)
node-package: bindings
	test "$$($(WASM_BINDGEN) --version)" = "wasm-bindgen $(WASM_BINDGEN_RELEASE)"
	$(CARGO) build $(CARGOFLAGS) -p $(CORE)-wasm --locked --target wasm32-unknown-unknown --features panic-test
	$(WASM_BINDGEN) --target web --out-dir packages/ts/wasm/generated --out-name http_media_type_wasm \
		$(CARGO_TARGET_DIR)/wasm32-unknown-unknown/debug/polyspec_http_media_type_wasm.wasm
	$(CARGO) build $(CARGOFLAGS) -p $(CORE)-node --locked --features panic-test
	rm -rf $(VAR)/node $(VAR)/node-platform && mkdir -p $(VAR)/node $(VAR)/node-platform
	cp $(CARGO_TARGET_DIR)/debug/libpolyspec_http_media_type_node.$(CDYLIB) $(VAR)/node-platform/$(NODE_ADDON)
	node -e 'const p = require("./packages/ts/package.json"); require("fs").writeFileSync("$(VAR)/node-platform/package.json", JSON.stringify({ name: p.name + "-$(PLATFORM)", version: p.version, os: [process.platform], cpu: [process.arch], main: "$(NODE_ADDON)", files: ["$(NODE_ADDON)"] }, null, 2) + "\n")'
	cd $(VAR)/node-platform && npm pack --pack-destination $(VAR)/node
	cd packages/ts && npm pack --pack-destination $(VAR)/node
	echo '{ "private": true }' > $(VAR)/node/package.json
	cd $(VAR)/node && npm install --no-audit --no-fund --omit=optional ./*.tgz

# The generated tests and the contract cases of the Node binding on node --test, against the installed package.
test-node: node-package
	cp packages/ts/generated/tests/generated.test.mjs packages/ts/tests/cases.test.mjs $(VAR)/node/
	cd $(VAR)/node && HTTP_MEDIA_TYPE_CASES=$(CASES) node --test generated.test.mjs cases.test.mjs

# The extension built against PHP_CONFIG and loaded into PHP; the stub is linted, then the generated tests and the
# contract cases run on PHPUnit.
test-php: bindings
	$(CARGO) build $(CARGOFLAGS) -p $(CORE)-php-ext --locked --features panic-test
	$(PHP) -l packages/php-ext/generated/polyspec_http_media_type.stub.php
	$(PHP) -d extension=$(CARGO_TARGET_DIR)/debug/libpolyspec_http_media_type.$(CDYLIB) $(PHPUNIT) packages/php-ext/generated/tests
	HTTP_MEDIA_TYPE_CASES=$(CASES) $(PHP) -d extension=$(CARGO_TARGET_DIR)/debug/libpolyspec_http_media_type.$(CDYLIB) $(PHPUNIT) packages/php-ext/tests

# The generated tests and the contract cases of the WASM binding through the subpath ./wasm of the installed package
# (binding P-5); --expose-gc serves the generated tests that collect instances (binding GN-18a).
test-wasm: node-package
	cp packages/ts/wasm/generated/tests/generated.test.mjs $(VAR)/node/generated.wasm.test.mjs
	cp packages/ts/tests/cases.wasm.test.mjs $(VAR)/node/
	cd $(VAR)/node && HTTP_MEDIA_TYPE_CASES=$(CASES) node --expose-gc --test generated.wasm.test.mjs cases.wasm.test.mjs

# The static library with the test features (binding GN-13b), which Go links through CGO_LDFLAGS; gofmt and go vet,
# then the generated tests and the contract cases of packages/go/tests on go test. GOTOOLCHAIN=local: a go of another
# release than the go directive fails instead of fetching that release.
GO_RELEASE := $(shell sed -n 's/^go \(.*\)$$/\1/p' packages/go/go.mod)
GO_ENV := GOTOOLCHAIN=local CGO_LDFLAGS=-L$(CARGO_TARGET_DIR)/debug GOFLAGS=-tags=polyspec_panic_test,polyspec_codec_test
test-go: bindings
	test "$$($(GO_ENV) $(GO) env GOVERSION)" = "go$(GO_RELEASE)"
	$(CARGO) build $(CARGOFLAGS) -p $(CORE)-go --locked --features panic-test,codec-test
	test -z "$$(cd packages/go && $(GOFMT) -l .)"
	cd packages/go && $(GO_ENV) $(GO) vet ./...
	cd packages/go && $(GO_ENV) HTTP_MEDIA_TYPE_CASES=$(CASES) $(GO) test -count=1 -v ./...
