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
# ext-php-rs reads them when it builds the extension.
export PHP PHP_CONFIG
# The file name extension of a library that Cargo builds as a cdylib: dylib on macOS, so on Linux (AGENTS.md,
# "Platforms").
CDYLIB := $(if $(filter Darwin,$(shell uname -s)),dylib,so)

.PHONY: check test lint lint-rust fmt-check bindings-check bindings test-bindings lint-bindings test-python test-node test-php \
	check-declarations

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

test-bindings: lint-bindings check-declarations test-python test-node test-php

lint-bindings: bindings
	$(CARGO) clippy $(CARGOFLAGS) --workspace --locked --all-targets --features panic-test -- -D warnings

# The TypeScript compiler of package-lock.json checks the generated declarations of the Node binding.
node_modules/.package-lock.json: package-lock.json
	npm ci --no-audit --no-fund

check-declarations: bindings node_modules/.package-lock.json
	node_modules/.bin/tsc --noEmit --strict packages/ts/generated/index.d.ts

# The wheel, installed into a virtual environment; the generated tests (G-5) and the contract cases (MT-1 to MT-8).
test-python: bindings
	$(PYTHON) -m venv --clear $(VAR)/venv
	$(VAR)/venv/bin/pip install -q $(MATURIN)
	rm -rf $(VAR)/wheels
	cd packages/python && $(VAR)/venv/bin/maturin build --locked --features panic-test --out $(VAR)/wheels $(CARGOFLAGS)
	$(VAR)/venv/bin/pip install -q --force-reinstall $(VAR)/wheels/*.whl
	cd $(VAR) && venv/bin/python -m unittest discover -s $(CURDIR)/packages/python/generated/tests -t $(CURDIR)/packages/python/generated/tests
	cd $(VAR) && HTTP_MEDIA_TYPE_CASES=$(CASES) venv/bin/python -m unittest discover -s $(CURDIR)/packages/python/tests -t $(CURDIR)/packages/python/tests

# The package and the platform package of the addon, packed and installed into var/node; the generated tests and the
# contract cases run there against the installed packages. T-2: the addon is the npm package of this machine's platform,
# which the package names in optionalDependencies; the recipe packs it as a release does and installs both tarballs,
# without the other platforms' packages.
PLATFORM := $(shell node -p 'process.platform + "-" + process.arch + (process.platform === "linux" ? "-gnu" : "")')
NODE_ADDON := http-media-type.$(PLATFORM).node
test-node: bindings
	$(CARGO) build $(CARGOFLAGS) -p $(CORE)-node --locked --features panic-test
	rm -rf $(VAR)/node $(VAR)/node-platform && mkdir -p $(VAR)/node $(VAR)/node-platform
	cp $(CARGO_TARGET_DIR)/debug/libpolyspec_http_media_type_node.$(CDYLIB) $(VAR)/node-platform/$(NODE_ADDON)
	node -e 'const p = require("./packages/ts/package.json"); require("fs").writeFileSync("$(VAR)/node-platform/package.json", JSON.stringify({ name: p.name + "-$(PLATFORM)", version: p.version, os: [process.platform], cpu: [process.arch], main: "$(NODE_ADDON)", files: ["$(NODE_ADDON)"] }, null, 2) + "\n")'
	cd $(VAR)/node-platform && npm pack --pack-destination $(VAR)/node
	cd packages/ts && npm pack --pack-destination $(VAR)/node
	echo '{ "private": true }' > $(VAR)/node/package.json
	cd $(VAR)/node && npm install --no-audit --no-fund --omit=optional ./*.tgz
	cp packages/ts/generated/tests/generated.test.mjs packages/ts/tests/cases.test.mjs $(VAR)/node/
	cd $(VAR)/node && HTTP_MEDIA_TYPE_CASES=$(CASES) node --test generated.test.mjs cases.test.mjs

# The extension built against PHP_CONFIG and loaded into PHP; the stub is linted, then the generated tests and the
# contract cases run on PHPUnit.
test-php: bindings
	$(CARGO) build $(CARGOFLAGS) -p $(CORE)-php-ext --locked --features panic-test
	$(PHP) -l packages/php-ext/generated/polyspec_http_media_type.stub.php
	$(PHP) -d extension=$(CARGO_TARGET_DIR)/debug/libpolyspec_http_media_type.$(CDYLIB) $(PHPUNIT) packages/php-ext/generated/tests
	HTTP_MEDIA_TYPE_CASES=$(CASES) $(PHP) -d extension=$(CARGO_TARGET_DIR)/debug/libpolyspec_http_media_type.$(CDYLIB) $(PHPUNIT) packages/php-ext/tests
