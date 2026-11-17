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
# The tool of the release of binding that Cargo.lock pins, which package.json names and npm installs (make
# install-packages); the generator and binding_core are one version (G-6).
BINDING := $(NODE) $(CURDIR)/node_modules/@polyspec/binding/dist/cli.js
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

.PHONY: bootstrap install install-tools install-packages toolchain-lock install-binding check test lint lint-rust fmt-check bindings-check docs-check documents-stamp bindings test-bindings lint-bindings test-python test-node test-php \
	test-wasm test-go node-package check-declarations install-php-tools test-scripts ci-targets ci-summary ci-passed release-tag \
	release-prepare release-tools release-tools-path release-assets release-publish release-undraft release-coverage release-tag-output

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

# install-binding fetches the crates of Cargo.lock, which binding reads with cargo metadata --locked --offline;
# bindings-check and bindings fail while they are missing.
install-binding:
	$(ONLINE) $(CARGO) fetch --locked

# toolchain-lock writes mise.lock with the mise of var/tools for the platforms of the deployment targets.
TOOLCHAIN_LOCK_PLATFORMS := linux-x64,linux-arm64,macos-arm64
toolchain-lock:
	$(ONLINE) $(KIT_TOOLS)/bin/mise lock --global --platform $(TOOLCHAIN_LOCK_PLATFORMS)

# The core and the contract; none of them needs the generator (binding design L-2).
check: lint-rust fmt-check test bindings-check docs-check test-scripts

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

# The documents of config/documents.json, each on its own (links, anchors, fences and the doc-id and source-sha256 of each
# Korean twin), and the checklists of docs/plans, whose rows config/checklist.json declares.
docs-check:
	$(NODE) $(KIT)/check-documents.mjs --checklist-place --private-path /Users/ --private-path /home/ --kit-rows

# Writes the source-sha256 of each Korean twin of PATHS from its English file, after the translation is reviewed.
documents-stamp:
	$(NODE) $(KIT)/documents-stamp.mjs $(PATHS)

# The contract check and the comparison of the tracked binding packages with what binding writes (L-2 (c)).
bindings-check:
	$(BINDING) check packages/rust/interface.json --cargo "$(CARGO)"

# Writes the generated sources into packages/{php-ext,python,ts}/generated, which are not tracked (G-6, L-1).
bindings:
	$(BINDING) generate --root . --cargo "$(CARGO)"

# The test features of a binding crate are the names of the [features] table of its manifest, which binding scaffold
# writes (binding GN-5): a crate built without one has no entry point that a generated test calls. Their union is the
# features of the lint of the workspace.
comma := ,
space := $(subst ,, )
features_of = $(subst $(space),$(comma),$(strip $(shell sed -n '/^\[features\]$$/,/^\[/s/^\([a-z][a-z0-9-]*\) = .*/\1/p' $(1))))
PYTHON_FEATURES = $(call features_of,packages/python/Cargo.toml)
NODE_FEATURES = $(call features_of,packages/ts/Cargo.toml)
WASM_FEATURES = $(call features_of,packages/ts/wasm/Cargo.toml)
PHP_FEATURES = $(call features_of,packages/php-ext/Cargo.toml)
GO_FEATURES = $(call features_of,packages/go/internal/ffi/Cargo.toml)
TEST_FEATURES = $(subst $(space),$(comma),$(sort $(subst $(comma),$(space),$(PYTHON_FEATURES),$(NODE_FEATURES),$(WASM_FEATURES),$(PHP_FEATURES),$(GO_FEATURES))))

test-bindings: lint-bindings check-declarations test-python test-node test-wasm test-php test-go

lint-bindings: bindings
	$(CARGO) clippy $(CARGOFLAGS) --workspace --locked --all-targets --features $(TEST_FEATURES) -- -D warnings

# The TypeScript compiler of package-lock.json, which make install-packages installs, checks the generated declarations
# of the Node binding.
check-declarations: bindings
	node_modules/.bin/tsc --noEmit --strict packages/ts/generated/index.d.ts
	node_modules/.bin/tsc --noEmit --strict packages/ts/wasm/generated/index.d.ts

# The wheel that the maturin of mise.toml builds, installed into a virtual environment without an index; the generated tests (G-5) and the contract cases (MT-1 to MT-8).
test-python: bindings
	$(PYTHON) -m venv --clear $(VAR)/venv
	rm -rf $(VAR)/wheels
	cd packages/python && $(MATURIN) build --locked --interpreter $(VAR)/venv/bin/python --features $(PYTHON_FEATURES) --out $(VAR)/wheels $(CARGOFLAGS)
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
	$(CARGO) build $(CARGOFLAGS) -p $(CORE)-wasm --locked --target wasm32-unknown-unknown --features $(WASM_FEATURES)
	$(WASM_BINDGEN) --target web --out-dir packages/ts/wasm/generated --out-name http_media_type_wasm \
		$(CARGO_TARGET_DIR)/wasm32-unknown-unknown/debug/polyspec_http_media_type_wasm.wasm
	$(CARGO) build $(CARGOFLAGS) -p $(CORE)-node --locked --features $(NODE_FEATURES)
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
	$(CARGO) build $(CARGOFLAGS) -p $(CORE)-php-ext --locked --features $(PHP_FEATURES)
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
# then the generated tests and the contract cases of packages/go/tests on go test, with the build tag
# polyspec_http_media_type_<feature> of each feature of the Go crate, under which binding writes the generated tests.
# GOTOOLCHAIN=local: a go of another release than the go directive fails instead of fetching that release.
GO_RELEASE := $(shell sed -n 's/^go \(.*\)$$/\1/p' packages/go/go.mod)
GO_TAGS = $(subst -,_,$(subst $(comma),$(comma)polyspec_http_media_type_,polyspec_http_media_type_$(GO_FEATURES)))
GO_ENV = GOTOOLCHAIN=local CGO_LDFLAGS=-L$(CARGO_TARGET_DIR)/debug GOFLAGS=-tags=$(GO_TAGS)
test-go: bindings
	test "$$($(GO_ENV) $(GO) env GOVERSION)" = "go$(GO_RELEASE)"
	$(CARGO) build $(CARGOFLAGS) -p $(CORE)-go --locked --features $(GO_FEATURES)
	test -z "$$(cd packages/go && $(GOFMT) -l .)"
	cd packages/go && $(GO_ENV) $(GO) vet ./...
	cd packages/go && $(GO_ENV) HTTP_MEDIA_TYPE_CASES=$(CASES) $(GO) test -count=1 -v ./...

# PHPUnit of composer.json, installed into vendor/ by the Composer of mise.toml from composer.lock; the PHP of
# var/tools/bin runs it.
COMPOSER := $(KIT_TOOLS)/mise/shims/composer
install-php-tools:
	$(ONLINE) $(COMPOSER) install --no-interaction --no-progress

# ---- CI (.github/workflows/ci.yml, .github/workflows/assets.yml) -------------------------------------------------------
# Each job of a workflow that CI runs is one recipe ci-<job>, which the one run step of the job calls with make variables
# alone, a matrix value or an input of the called workflow as NAME=value (AGENTS.md, "CI and release"). The recipe holds
# the order and the conditions of the job: its installs first, which stop the job at their failure, then its checks, each
# run to its end, then its report; its status is that of the checks. A local run is the same call, for example make
# ci-check NAME=core or make ci-php EXPECTED_PHP_MINOR=8.4.
#
# ci-targets runs TARGETS past failures with the utility of kit and writes CI_REPORT: the log of each target, record.json
# and summary.md; ci-summary writes summary.md again, also for a run that stopped, and names each install of CI_STEPS
# that did not succeed; ci-passed, the last job of the workflow, fails unless every job of RESULTS, the JSON of
# toJSON(needs), has the result success, and a skipped job fails it too (FAIL_SKIPPED).
CI_REPORT ?= var/report/ci-targets
ci-targets:
	$(NODE) $(KIT)/ci-targets.mjs -k $(CI_REPORT) $(TARGETS)

ci-summary:
	$(NODE) $(KIT)/ci-targets.mjs --summary $(CI_REPORT)

ci-passed:
	FAIL_SKIPPED=1 $(NODE) $(KIT)/ci-passed.mjs

# The entries of the job check of ci.yml by NAME: the installs and the targets of each. Together the entries run every
# target of make check and make test-bindings, each once, and make release-coverage; the entry bindings also installs
# PHPUnit of composer.lock.
CI_CHECK_NAMES := core bindings
CI_CHECK_INSTALLS_core := install-tools install-binding
CI_CHECK_TARGETS_core := lint-rust fmt-check test bindings-check docs-check test-scripts release-coverage
CI_CHECK_INSTALLS_bindings := install-tools install-binding install-php-tools
CI_CHECK_TARGETS_bindings := lint-bindings check-declarations test-python test-node test-wasm test-php test-go

# ci-check runs the installs of the entry NAME in order and stops at the first that fails, then its targets with
# ci-targets into var/ci/NAME, then ci-summary always, with the outcome of each install as CI_STEPS.
.PHONY: ci-check ci-platform ci-php ci-npm
ci-check:
	@test -n "$(filter $(NAME),$(CI_CHECK_NAMES))" || { echo 'ci-check: NAME is one of $(CI_CHECK_NAMES), for example make ci-check NAME=core' >&2; exit 2; }
	@status=0; steps=; \
	for install in $(CI_CHECK_INSTALLS_$(NAME)); do \
		if $(MAKE) --no-print-directory $$install; then outcome=success; else outcome=failure; status=1; fi; \
		steps="$$steps$${steps:+,}\"$$install\":{\"outcome\":\"$$outcome\"}"; \
		test $$status -eq 0 || break; \
	done; \
	test $$status -ne 0 || $(MAKE) --no-print-directory ci-targets TARGETS="$(CI_CHECK_TARGETS_$(NAME))" CI_REPORT=var/ci/$(NAME) || status=1; \
	CI_STEPS="{$$steps}" $(MAKE) --no-print-directory ci-summary CI_REPORT=var/ci/$(NAME) || status=1; \
	exit $$status

# The jobs of assets.yml. RELEASE=true, which the workflow release passes, runs the release check of binding before a
# job builds. Each recipe line stops the job at its failure; the builds of ci-platform are the goals of one make -k, which
# builds each to its end and fails after the last when one failed.
ci-platform:
	$(MAKE) --no-print-directory install-tools TOOLS="rust uv python"
	$(MAKE) --no-print-directory install-binding
	$(MAKE) --no-print-directory release-recipes
	$(if $(filter true,$(RELEASE)),$(MAKE) --no-print-directory release-binding-check)
	$(MAKE) --no-print-directory -k release-go-static release-wheel release-npm-platform

# ci-php builds the extension for the PHP minor EXPECTED_PHP_MINOR with the php of PATH, which the job selects with
# setup-php for its matrix entry before the recipe runs. The job provisions the LLVM of config/toolchain.json before this
# recipe (binding GN-19i): the ubuntu-26.04 images hold it at /usr/lib/llvm-<major>, the default LLVM_ROOT of
# packages/release.mk, and on macOS install-llvm-action installs it and sets LLVM_PATH, which the build takes as LLVM_ROOT (defined
# before the include of packages/release.mk). install-llvm-action appends DYLD_LIBRARY_PATH and LD_LIBRARY_PATH with
# /usr/lib first to GITHUB_ENV, and the PHP of Homebrew then loads the libsqlite3 of the system and aborts, so the recipe
# and its sub-makes run with both empty and the build reads LLVM through LLVM_ROOT alone.
ci-php: DYLD_LIBRARY_PATH :=
ci-php: LD_LIBRARY_PATH :=
ci-php:
	@test -n "$(EXPECTED_PHP_MINOR)" || { echo 'ci-php: EXPECTED_PHP_MINOR is required, for example make ci-php EXPECTED_PHP_MINOR=8.4' >&2; exit 2; }
	$(MAKE) --no-print-directory install-tools TOOLS=rust
	$(MAKE) --no-print-directory install-binding
	$(MAKE) --no-print-directory release-recipes
	$(if $(filter true,$(RELEASE)),$(MAKE) --no-print-directory release-binding-check)
	$(MAKE) --no-print-directory release-php-ext PHP=php EXPECTED_PHP_MINOR=$(EXPECTED_PHP_MINOR)

ci-npm:
	$(MAKE) --no-print-directory install-tools TOOLS=rust
	$(MAKE) --no-print-directory install-binding
	$(MAKE) --no-print-directory release-recipes
	$(MAKE) --no-print-directory install-wasm-bindgen
	$(if $(filter true,$(RELEASE)),$(MAKE) --no-print-directory release-binding-check)
	$(MAKE) --no-print-directory release-npm

# The jobs of release.yml, each one recipe like the jobs of CI, which read the values of the run from the env of the job.
# ci-tag tags the commit of the CI run RUN; when the release starts by itself (EVENT workflow_run) it tags only the
# version commit (AUTO). release-tag
# writes TAG and VERSION into the file that GITHUB_ENV names; the recipe gives it a file of its own, reads TAG and VERSION
# from it in the same step and gives them to the later jobs (release-tag-output). Both are empty when the run releases
# nothing.
.PHONY: ci-tag ci-release
ci-tag:
	@test -n "$(RUN)" || { echo 'ci-tag: RUN is required, for example make ci-tag RUN=123' >&2; exit 2; }
	mkdir -p var/release && : > var/release/tag.env
	GITHUB_ENV=$(CURDIR)/var/release/tag.env $(MAKE) --no-print-directory release-tag RUN=$(RUN)$(if $(filter workflow_run,$(EVENT)), AUTO=1)
	set -a && . var/release/tag.env && set +a && $(MAKE) --no-print-directory release-tag-output

# ci-release releases TAG: it builds the archives and creates the draft release, then adds the assets of each platform,
# which the job downloaded into var/release/platform-assets before the recipe runs, carries the Go module with the
# identity of ACTOR, the actor of the run, uploads the assets of each platform and makes the release public. The tools
# of var/tools are on the PATH of every recipe, so the release needs no step that puts them there.
ci-release:
	@test -n "$(TAG)" || { echo 'ci-release: TAG is required, for example make ci-release TAG=v0.0.1 VERSION=0.0.1 ACTOR=<login>' >&2; exit 2; }
	$(MAKE) --no-print-directory release-prepare
	$(MAKE) --no-print-directory release-tools
	$(MAKE) --no-print-directory release-assets
	$(MAKE) --no-print-directory release-publish
	mkdir -p var/release/assets && cp -R var/release/platform-assets/. var/release/assets/
	$(MAKE) --no-print-directory install-tools TOOLS="rust go"
	$(MAKE) --no-print-directory install-binding
	$(MAKE) --no-print-directory release-recipes
	GIT_AUTHOR_NAME=$(ACTOR) GIT_AUTHOR_EMAIL=$(ACTOR)@users.noreply.github.com GIT_COMMITTER_NAME=$(ACTOR) GIT_COMMITTER_EMAIL=$(ACTOR)@users.noreply.github.com $(MAKE) --no-print-directory release-go-module
	$(MAKE) --no-print-directory release-platform-assets
	$(MAKE) --no-print-directory release-undraft

# ---- Release recipes of the bindings (binding GN-19h) --------------------------------------------------------------------
# binding release-recipes writes the recipes that build the assets of each platform (the Go static library, the abi3 wheel,
# the PHP extension, the npm package with its platform packages) and that carry the Go module and upload the assets into
# packages/release.mk, which is generated and not tracked; make release-recipes writes it again from the contract, and
# binding check reports a Makefile that does not include it or that holds a recipe of its own for one of its targets
# (CK-94). The recipes read BINDING_RUN, the command that starts binding, NODE and NPM, defined above, and UV, the uv of
# mise.toml. BINDING_DEP is empty: the bootstrap installs binding from package-lock.json before any recipe runs, and a
# prerequisite that installs it would download in a recipe that builds.
BINDING_RUN := $(BINDING)
BINDING_DEP :=
UV := $(KIT_TOOLS)/mise/shims/uv
# LLVM_PATH, which install-llvm-action sets on macOS, is the LLVM_ROOT of the recipes of packages/release.mk; without it
# the file takes its default (binding GN-19i).
ifdef LLVM_PATH
LLVM_ROOT ?= $(LLVM_PATH)
endif
.PHONY: release-recipes
release-recipes:
	$(BINDING_RUN) release-recipes --root .
# The file is missing in a checkout until make release-recipes writes it, so the include is optional.
-include packages/release.mk

# ---- Release (config/release.json, .github/workflows/release.yml) -----------------------------------------------------
# The steps of release.yml, in this order: release-tag tags the commit of the successful CI run RUN of ci.yml on main with
# vX.Y.Z of the top section of CHANGELOG.md and appends TAG and VERSION to GITHUB_ENV, and release-tag-output gives them
# to the later jobs; the workflow assets.yml builds the assets of each platform from the tag; release-prepare and
# release-tools install what the packages of config/release.json need, and release-tools-path puts var/tools/bin and the
# shims of mise on the PATH of the later steps; release-assets builds the archive of every package into
# var/release/assets; release-publish creates the draft GitHub Release; release-go-module and release-platform-assets of
# packages/release.mk carry the Go module and upload the assets of each platform; release-undraft makes it public.
# release-coverage requires every package file of the checkout to be classified in config/release.json.
release-tag:
	@test -n "$$RUN" || { echo "release-tag: RUN is required, for example make release-tag RUN=123"; exit 1; }
	RELEASE_MAIN=origin/main $(NODE) $(KIT)/release-run.mjs tag "$$RUN"$(if $(AUTO), --auto)

# release-tag-output gives the later jobs of the release workflow the tag and the version that release-tag wrote into the
# environment of its job (TAG, VERSION), through the outputs of the step (GITHUB_OUTPUT); both are empty when the run
# releases nothing.
release-tag-output:
	@test -n "$$GITHUB_OUTPUT" || { echo 'release-tag-output: GITHUB_OUTPUT is set only in a step of a workflow' >&2; exit 2; }
	printf 'tag=%s\nversion=%s\n' "$$TAG" "$$VERSION" >> "$$GITHUB_OUTPUT"

# The one archive of config/release.json is the Composer package of the PHP extension, whose composer.json requires no
# package, so the release installs no dependency before its tools.
release-prepare:
	@echo 'release-prepare: the Composer package of config/release.json requires no package, so the release installs no dependency'

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
