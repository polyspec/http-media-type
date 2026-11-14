# The tools of the checkout: the utilities of the installed @polyspec/kit (node_modules/@polyspec/kit) install the
# toolchains of mise.toml, rust-toolchain.toml and .php-version into var/tools, as the recipes of binding do.
KIT := $(CURDIR)/node_modules/@polyspec/kit/dist
KIT_TOOLS := $(CURDIR)/var/tools
NODE := $(KIT_TOOLS)/bin/node
NPM := $(KIT_TOOLS)/bin/npm
# The bootstrap installs the node of var/tools, so it starts with the Node.js of the machine.
BOOTSTRAP_NODE := node
# The mise that make install-tools TOOLS=npm installs keeps its data, cache, state and configuration in var/tools/mise and reads
# mise.toml as its global configuration, whose [settings] state that it runs only what mise.lock pins; the shims of
# var/tools/mise read these directories, so every recipe runs with them, and with var/tools/bin and the shims first on PATH.
export MISE_DATA_DIR := $(KIT_TOOLS)/mise
export MISE_CACHE_DIR := $(KIT_TOOLS)/mise/cache
export MISE_STATE_DIR := $(KIT_TOOLS)/mise/state
export MISE_CONFIG_DIR := $(KIT_TOOLS)/mise/config
export MISE_GLOBAL_CONFIG_FILE := $(CURDIR)/mise.toml
export MISE_GLOBAL_CONFIG_ROOT := $(CURDIR)
export PATH := $(KIT_TOOLS)/bin:$(KIT_TOOLS)/mise/shims:$(PATH)
# rustup installs no toolchain on first use, so a toolchain that make install-tools did not install fails instead of
# being fetched.
export RUSTUP_AUTO_INSTALL := 0
# The recipes that download run their command with $(ONLINE); the repository sets no offline setting, so it lifts none.
ONLINE :=

CARGO := cargo
# Extra arguments of every cargo build, for example --ignore-rust-version on a machine without the pinned release.
CARGOFLAGS ?=
CORE := polyspec-http-media-type
BINDING := $(NODE) scripts/binding.mts
CASES := $(CURDIR)/contracts/media-type.json
VAR := $(CURDIR)/var
export CARGO_TARGET_DIR ?= $(CURDIR)/target
# The language runtimes. PHP is the binary whose headers the extension is built against (PHP_CONFIG) and that loads it.
# Both are paths, because ext-php-rs reads PHP as the path of a file: the wrappers of var/tools/bin that make
# install-tools writes for the PHP of .php-version. PYTHON is the Python of mise.toml, whose shim PATH names first.
PYTHON ?= python3.14
PHP ?= $(KIT_TOOLS)/bin/php
PHP_CONFIG ?= $(KIT_TOOLS)/bin/php-config
PHPUNIT ?= vendor/bin/phpunit
# The maturin of mise.toml, which make install-tools installs at the digest of mise.lock.
MATURIN ?= $(KIT_TOOLS)/mise/shims/maturin
# The Go of the go directive of packages/go/go.mod and the wasm-bindgen CLI of the release of the wasm-bindgen crate of
# packages/ts/wasm/Cargo.toml (binding GN-15, GN-18), both of mise.toml, which make install-tools installs into
# var/tools/mise; test-go and node-package compare both releases before they use them.
GO ?= $(KIT_TOOLS)/mise/shims/go
GOFMT ?= $(KIT_TOOLS)/mise/shims/gofmt
WASM_BINDGEN ?= $(KIT_TOOLS)/mise/shims/wasm-bindgen
# ext-php-rs reads them when it builds the extension.
export PHP PHP_CONFIG
# The file name extension of a library that Cargo builds as a cdylib: dylib on macOS, so on Linux (AGENTS.md,
# "Platforms").
CDYLIB := $(if $(filter Darwin,$(shell uname -s)),dylib,so)

.PHONY: bootstrap install install-tools install-packages toolchain-lock install-binding check test lint lint-rust fmt-check bindings-check bindings test-bindings lint-bindings test-python test-node test-php \
	test-wasm test-go node-package check-declarations install-php-tools test-scripts ci-targets ci-summary ci-passed release-tag release-checkout \
	release-prepare release-tools release-tools-path release-assets release-publish release-undraft release-coverage

# The npm that devEngines of package.json names installs the lock, @polyspec/kit included, before the tools of the checkout
# exist. It runs outside the checkout with --prefix, since an npm of another release refuses a folder whose devEngines names
# npm 12.2.0 (EBADDEVENGINES); npm reads allow-remote of the .npmrc of the checkout.
BOOTSTRAP_NPM := $(abspath $(shell command -v npm))
bootstrap:
	root="$$PWD"; version="$$(node -p 'require("./package.json").devEngines.packageManager.version')"; \
	cd "$${TMPDIR:-/tmp}" && npm_config_cache="$$root/var/bootstrap/npm-cache" "$(BOOTSTRAP_NPM)" exec --yes --package="npm@$$version" -- npm --prefix "$$root" ci --ignore-scripts

# install installs, in order, the mise, node and npm of mise.toml, the packages of package-lock.json and the other tools:
# those of mise.toml at the digests of mise.lock, the Rust toolchain of rust-toolchain.toml with its targets and the PHP
# of the machine (.php-version), all into var/tools of this checkout.
install:
	$(MAKE) --no-print-directory install-tools TOOLS=npm
	$(MAKE) --no-print-directory install-packages
	$(MAKE) --no-print-directory install-tools
	$(MAKE) --no-print-directory install-binding

# TOOLS=npm runs the bootstrap of kit, which imports only Node.js built-ins, with the Node.js of the machine; any other TOOLS
# names tools of kit, such as go or rust, and no TOOLS installs every declared tool.
install-tools:
ifeq ($(TOOLS),npm)
	$(ONLINE) $(BOOTSTRAP_NODE) $(KIT)/bootstrap/bootstrap.mjs
else
	$(ONLINE) $(NODE) $(KIT)/install-tools.mjs --no-self-update $(TOOLS)
endif

install-packages:
	$(ONLINE) $(NPM) ci

# install-binding fetches the crates of Cargo.lock and installs binding at the commit that Cargo.lock pins into
# var/binding (scripts/binding.mts); bindings-check and bindings read it offline and fail while it is missing.
install-binding:
	$(ONLINE) $(NODE) scripts/binding.mts install

# toolchain-lock writes mise.lock with the mise of var/tools for the platforms of the deployment targets.
TOOLCHAIN_LOCK_PLATFORMS := linux-x64,linux-arm64,macos-arm64
toolchain-lock:
	$(ONLINE) $(KIT_TOOLS)/bin/mise lock --global --platform $(TOOLCHAIN_LOCK_PLATFORMS)

# The core and the contract; none of them needs the generator (binding design L-2).
check: lint-rust fmt-check test bindings-check test-scripts

# The tests of the tracked files, on node --test.
test-scripts:
	$(NODE) --test tests/scripts/*.test.mts

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

# The TypeScript compiler of package-lock.json, which make install-packages installs, checks the generated declarations
# of the Node binding.
check-declarations: bindings
	node_modules/.bin/tsc --noEmit --strict packages/ts/generated/index.d.ts
	node_modules/.bin/tsc --noEmit --strict packages/ts/wasm/generated/index.d.ts

# The wheel that the maturin of mise.toml builds, installed into a virtual environment without an index; the generated tests (G-5) and the contract cases (MT-1 to MT-8).
test-python: bindings
	$(PYTHON) -m venv --clear $(VAR)/venv
	rm -rf $(VAR)/wheels
	cd packages/python && $(MATURIN) build --locked --interpreter $(VAR)/venv/bin/python --features panic-test --out $(VAR)/wheels $(CARGOFLAGS)
	$(VAR)/venv/bin/pip install -q --no-index --force-reinstall $(VAR)/wheels/*.whl
	cd $(VAR) && venv/bin/python -m unittest discover -s $(CURDIR)/packages/python/generated/tests -t $(CURDIR)/packages/python/generated/tests
	cd $(VAR) && HTTP_MEDIA_TYPE_CASES=$(CASES) venv/bin/python -m unittest discover -s $(CURDIR)/packages/python/tests -t $(CURDIR)/packages/python/tests

# The package and the platform package of the addon, packed and installed into var/node. T-2: the addon is the npm
# package of this machine's platform, which a release names in optionalDependencies of the manifest that it packs
# (binding GN-3c); the recipe packs it as a release does and installs both tarballs, without the other platforms'
# packages. The package also holds the WASM module and its glue, which wasm-bindgen writes into
# packages/ts/wasm/generated before the package is packed (binding GN-18, P-5).
PLATFORM := $(shell $(NODE) -p 'process.platform + "-" + process.arch + (process.platform === "linux" ? "-gnu" : "")')
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
	$(NODE) -e 'const p = require("./packages/ts/package.json"); require("fs").writeFileSync("$(VAR)/node-platform/package.json", JSON.stringify({ name: p.name + "-$(PLATFORM)", version: p.version, os: [process.platform], cpu: [process.arch], main: "$(NODE_ADDON)", files: ["$(NODE_ADDON)"] }, null, 2) + "\n")'
	cd $(VAR)/node-platform && $(NPM) pack --pack-destination $(VAR)/node
	cd packages/ts && $(NPM) pack --pack-destination $(VAR)/node
	echo '{ "private": true }' > $(VAR)/node/package.json
	cd $(VAR)/node && $(NPM) install --offline --no-audit --no-fund --omit=optional ./*.tgz

# The generated tests and the contract cases of the Node binding on node --test, against the installed package.
test-node: node-package
	cp packages/ts/generated/tests/generated.test.mjs packages/ts/tests/cases.test.mjs $(VAR)/node/
	cd $(VAR)/node && HTTP_MEDIA_TYPE_CASES=$(CASES) $(NODE) --test generated.test.mjs cases.test.mjs

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
	cd $(VAR)/node && HTTP_MEDIA_TYPE_CASES=$(CASES) $(NODE) --expose-gc --test generated.wasm.test.mjs cases.wasm.test.mjs

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

# PHPUnit of composer.json, installed into vendor/ by the Composer of mise.toml from composer.lock; the PHP of
# var/tools/bin runs it.
COMPOSER := $(KIT_TOOLS)/mise/shims/composer
install-php-tools:
	$(ONLINE) $(COMPOSER) install --no-interaction --no-progress

# ---- CI (.github/workflows/ci.yml) -------------------------------------------------------------------------------------
# ci-targets runs TARGETS past failures with the utility of kit and writes CI_REPORT: the log of each target, record.json
# and summary.md; ci-summary writes summary.md again, also for a run that stopped; ci-passed, the last job of the
# workflow, fails unless every job of RESULTS, the JSON of toJSON(needs), has the result success.
CI_REPORT ?= var/report/ci-targets
ci-targets:
	$(NODE) $(KIT)/ci-targets.mjs -k $(CI_REPORT) $(TARGETS)

ci-summary:
	$(NODE) $(KIT)/ci-targets.mjs --summary $(CI_REPORT)

ci-passed:
	$(NODE) $(KIT)/ci-passed.mjs

# ---- Release (config/release.json, .github/workflows/release.yml) -----------------------------------------------------
# The steps of release.yml, in this order: release-tag tags the commit of the successful CI run RUN of ci.yml on main with
# vX.Y.Z of the top section of CHANGELOG.md and appends TAG and VERSION to GITHUB_ENV; release-checkout checks that tag
# out; release-prepare and release-tools install what the packages of config/release.json need, and release-tools-path
# puts var/tools/bin and the shims of mise on the PATH of the later steps; release-assets builds the archive of every
# package into var/release/assets; release-publish creates the draft GitHub Release and release-undraft makes it public.
# release-coverage requires every package file of the checkout to be classified in config/release.json.
release-tag:
	@test -n "$$RUN" || { echo "release-tag: RUN is required, for example make release-tag RUN=123"; exit 1; }
	RELEASE_MAIN=origin/main $(NODE) $(KIT)/release-run.mjs tag "$$RUN"$(if $(AUTO), --auto)

release-checkout:
	@test -n "$$TAG" || { echo "release-checkout: TAG is required, for example make release-checkout TAG=v0.0.1"; exit 1; }
	git checkout --quiet "$$TAG"

# config/release.json releases no archive (see AGENTS.md, "Release"), so the release installs nothing before its tools.
release-prepare:
	@echo 'release-prepare: config/release.json releases no archive, so the release installs no dependency'

release-tools:
	$(ONLINE) $(NODE) $(KIT)/release-tools.mjs

release-tools-path:
	@test -n "$$GITHUB_PATH" && test -n "$$GITHUB_ENV" || { echo 'release-tools-path: GITHUB_PATH and GITHUB_ENV are set only between the steps of a workflow'; exit 1; }
	printf '%s\n%s\n' "$(KIT_TOOLS)/bin" "$(KIT_TOOLS)/mise/shims" >> "$$GITHUB_PATH"
	printf 'MISE_DATA_DIR=%s\nMISE_CACHE_DIR=%s\nMISE_STATE_DIR=%s\nMISE_CONFIG_DIR=%s\nMISE_GLOBAL_CONFIG_FILE=%s\nMISE_GLOBAL_CONFIG_ROOT=%s\n' \
		"$(MISE_DATA_DIR)" "$(MISE_CACHE_DIR)" "$(MISE_STATE_DIR)" "$(MISE_CONFIG_DIR)" "$(MISE_GLOBAL_CONFIG_FILE)" "$(MISE_GLOBAL_CONFIG_ROOT)" >> "$$GITHUB_ENV"

release-assets:
	@test -n "$$TAG" || { echo "release-assets: TAG is required, for example make release-assets TAG=v0.0.1"; exit 1; }
	RELEASE_ASSETS=var/release/assets $(ONLINE) $(NODE) $(KIT)/release.mjs assets "$$TAG"

release-publish:
	@test -n "$$TAG" || { echo "release-publish: TAG is required, for example make release-publish TAG=v0.0.1"; exit 1; }
	RELEASE_ASSETS=var/release/assets RELEASE_RECORDS=var/release $(NODE) $(KIT)/release.mjs publish "$$TAG"

release-undraft:
	@test -n "$$TAG" || { echo "release-undraft: TAG is required, for example make release-undraft TAG=v0.0.1"; exit 1; }
	RELEASE_RECORDS=var/release $(NODE) $(KIT)/release.mjs undraft "$$TAG"

release-coverage:
	$(NODE) $(KIT)/release.mjs coverage
