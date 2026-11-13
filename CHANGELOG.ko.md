<!-- doc-id: changelog -->
<!-- source-sha256: 9e3a47f6bda732e8d0196bd354c148b574302e12fc82f0eb13c58650ee058f05 -->

## Unreleased

- `Cargo.lock`은 `polyspec-binding-core`를 binding의 branch `v1/rust-core`의 head에 pin하고, 바인딩 package는 그
  binding의 scaffold가 쓰는 것과 같다. 그래서 `make bindings-check`는 finding을 보고하지 않는다. 전에는 lock(CK-20)과
  파일 아홉 개(CK-19)를 보고했다. 각 바인딩 crate는 코어의 licence `MIT`를 적고, `packages/python/pyproject.toml`도
  적는다(CK-71). `packages/python/build.rs`가 새로 생겼다. 이 파일은 cfg `pyo3_disable_reference_pool`을 선언하고,
  생성된 코드는 그 cfg가 있는 build를 거부한다(binding GN-6u). `packages/ts/package.json`에는 `"type": "module"`,
  `napi.binaryName`, `napi.targets`가 있고 `optionalDependencies`는 없다. release가 자신이 pack하는 manifest에 플랫폼
  package를 쓴다. 그 package를 적은 lock은 그 release 전에 설치할 수 없기 때문이다(binding GN-3c).
  `packages/php-ext/composer.json`은 `php-ext.download-url-method`로 `pre-packaged-binary`를 적는다. 생성된 Go 파일
  `zz_generated_*.go`는 더 이상 추적하지 않고 `.gitignore`가 그 파일들을 적는다. release가 그 파일들과 각 플랫폼의
  정적 라이브러리를 Go tag의 commit에 더하고(binding GN-15g), 추적한 사본은 pin된 binding이 쓰는 것과 달랐다.

- release는 release commit에 Go module `packages/go`를 `packages/go/vX.Y.Z`로 tag한다. `config/release.json`의
  `goModules`가 그 module을 가리킨다. 전에는 `goModules`가 비어 있었고 규칙은 tag가 Go module을 tag하지 않는다고 했다.
  Go는 저장소 루트 아래의 module을 그 형태의 tag로만 가져오므로, 다른 저장소가 그 module을 version으로 요구할 수
  없었다(binding GN-15g). `make release-coverage`는 모든 package 파일이 분류되었다고 보고한다. `AGENTS.md`는 첫 release
  전에 열려 있는 일을 적는다. `origin`의 `main`, 그리고 kit 0.0.111과 binding의 release를 기다리는 바인딩의 package다.

- CI와 release(AGENTS.md, "CI와 release"): `.github/workflows/ci.yml`은 `main`의 push와 수동 실행에서
  `ubuntu-26.04-arm`으로 `make check`, `make test-bindings`, `make release-coverage`를 job `core`와 `bindings`에서
  실행하고, 마지막 job `ci-passed`는 두 job이 통과했을 때만 통과한다. `.github/workflows/release.yml`은 그런 실행의
  commit에 `CHANGELOG.md`의 맨 위 절의 version으로 tag를 붙이고 GitHub Release를 만든다. `config/release.json`은 모든
  package 파일을 분류한다. tag는 코어 crate `packages/rust`를 Git tag로 release하고 binding manifest의 version이다.
  archive는 release하지 않는다. 바인딩은 플랫폼마다 빌드되는데 kit 0.0.109의 release 도구는 npm package, Composer 소스
  archive, 순수 Python wheel만 묶기 때문이다. Makefile은 `install-php-tools`, `ci-targets`, `ci-summary`, `ci-passed`,
  `release-tag`, `release-checkout`, `release-prepare`, `release-tools`, `release-tools-path`, `release-assets`,
  `release-publish`, `release-undraft`, `release-coverage`를 더한다. 전에는 이 저장소에 CI도 release도 없었다.

- `Cargo.lock`은 `polyspec-binding-core`를 binding의 branch `v1/rust-core`의 한 commit에 고정하고, binding crate는 그
  commit의 binding scaffold가 쓰는 것이다(binding BD-9, GN-3d). 각 crate는 `[lints] workspace = true`로 workspace의 lint를
  받고, `src/lib.rs`의 각 allow attribute는 자기 규칙을 reason으로 적는 한 줄이며 그 이유는 위의 주석에 있다. PHP crate는
  macOS 링커에게 자기 라이브러리에 한해 PHP의 기호를 정의하지 않은 채 두라고 지시하는 `build.rs`를 갖고 `[lib]`에
  `test = false`와 `doctest = false`를 갖는다. `.cargo/config.toml`은 지운다. 그 파일은 같은 링크 설정을 core의 시험 실행
  파일까지 workspace의 모든 crate에 주었다. Node addon은 그 설정을 자기 `build.rs`의 `napi_build::setup()`에서 받는다.
  추적되는 Go 파일 `zz_generated_*.go`는 그 commit의 `make bindings`가 쓰는 것이다. `make fmt-check`는 이 저장소의
  `rustfmt.toml`로 통과한다. 전에는 binding이 여러 줄로 쓴 attribute에서 실패했다.

- 도구가 binding처럼 고정되고 checkout의 `var/tools`에 설치된다. `mise.toml`과 `mise.lock`은 Node.js 26.12.0, npm
  12.2.0, Go 1.27.3, Python 3.14.8, Composer 2.10.3, wasm-bindgen CLI 0.2.130을 binding의 digest로 고정하고,
  `config/toolchain.json`은 mise 2026.10.10을 고정하며, `.php-version`은 PHP 8.4를 적고, `rust-toolchain.toml`은
  target `wasm32-unknown-unknown`을 더한다. `package.json`은 `devEngines`에 npm 12.2.0을 적고 `@polyspec/kit` 0.0.109를
  더한다. binding의 recipe처럼 `make bootstrap`, `make install`, `make install-tools`, `make install-packages`, `make
  toolchain-lock`이 그 설치기를 실행한다. 모든 recipe는 `var/tools/bin`과 mise의 shim을 `PATH` 앞에 두고 실행하며,
  `GO`, `GOFMT`, `WASM_BINDGEN`, `PHP`, `PHP_CONFIG`는 `var/tools`의 도구를 가리킨다. 전에는 모든 recipe가 기계의
  `PATH`가 가리키는 도구를 고정된 판 없이 실행했다.

- `make test-bindings`가 계약의 모든 target을 빌드하고 시험한다(binding BD-27). `make test-python`, `make test-node`,
  `make test-php` 곁에 `make test-wasm`과 `make test-go`가 더해진다. `make test-wasm`은 생성된 시험과 새 contract case
  `packages/ts/tests/cases.wasm.test.mjs`를 설치된 패키지의 subpath `./wasm`을 통해 node --test로 실행한다. 모듈과
  그 glue는 패키지를 묶기 전에 wasm-bindgen CLI가 쓰며, 그 CLI의 판은 `wasm-bindgen` crate의 판이어야 한다. 그래서
  `make test-node`와 `make test-wasm`은 단계 `node-package`를 함께 쓴다. `make test-go`는 feature `panic-test`와
  `codec-test`로 정적 라이브러리를 빌드하고, gofmt와 go vet을 실행한 다음, 생성된 시험과 새 contract case
  `packages/go/tests/cases_test.go`를 go test로 실행한다. Go는 `packages/go/go.mod`의 go 지시문의 판이고
  `GOTOOLCHAIN=local`로 실행한다. `make check-declarations`는 WASM 바인딩의 선언도 검사한다. 변수 `GO`, `GOFMT`,
  `WASM_BINDGEN`이 두 도구를 가리킨다. Go 파일 `zz_generated_*.go`는 추적되고(binding GN-3),
  `packages/ts/wasm/generated`와 `packages/go/internal/ffi/generated`는 무시된다. 전에는 Go와 WASM 바인딩을 빌드하거나
  시험하는 make target이 없었다. 모든 contract case가 다섯 runner(unittest, Node와 WASM의 node --test, PHPUnit, go
  test)에서 각각 통과한다. `make fmt-check`는 여전히 `packages/go/internal/ffi/src/lib.rs`에서 실패한다. binding
  scaffold가 쓰는 125자의 줄 때문이다.

- 계약이 binding의 다섯 target을 적는다(BD-27): `packages/rust/interface.json`의 `targets`는 php, python, node,
  go, wasm이고, `packages.go`는 Go 모듈 `github.com/polyspec/http-media-type/packages/go`를 적으며, npm 패키지의 entry
  `.`는 조건 `{node: napi, browser: wasm}`을 받고, 각 오류 클래스는 WASM 클래스로 Node의 것을 적으며,
  `errors.fixed`는 Node처럼 WASM에도 `TypeError`를 적는다. 전에는 계약이 php, python, node만 적어 Go와 WASM 바인딩이
  생성되지 않았다. 추적되는 바인딩 패키지에 binding scaffold가 두 target을 위해 쓰는 것(`packages/go/go.mod`,
  `packages/go/internal/ffi`, `packages/ts/wasm`, `packages/ts/package.json`의 브라우저 exports)이 더해지고, 두
  crate가 workspace의 member가 된다. 계약 검사의 finding은 없다. Go와 WASM 바인딩을 빌드하거나 시험하는 make target은
  아직 없다. `make fmt-check`는 `packages/go/internal/ffi/src/lib.rs`에서 실패한다: binding scaffold가 그 `allow`
  속성을 125자의 한 줄로 쓰는데 `rustfmt.toml`의 `max_width = 120`을 넘고, 이 파일은 손으로 고치지 않는다.

- `Cargo.lock`은 값 alias, 실패 주입, 오류 unit의 생성기를 한 개발 줄기에 가진 binding을 고정하고(CK-20), 바인딩
  package는 그 scaffold가 쓰는 것이다. 각 바인딩 crate는 `polyspec-binding-core`를 feature `construct`와 `lock`과 함께
  받고, lock에는 `polyspec-binding-core`의 의존으로 `tokio`가 더해진다. 계약 검사의 지적은 없다. 생성된 소스에는
  member가 내는 오류 variant가 모두 `Error`의 variant임을 컴파일할 때 증명하는 코드가 더해지고(E-5), 생성된 Node
  시험은 발생한 오류마다 그 class의 `instanceof`도 검사한다. 세 package의 동작은 같다.

- `make test-php`와 `make lint-bindings`가 인자 없이 PHP를 찾는다. `PHP`와 `PHP_CONFIG`의 기본값은 `command -v`가
  주는 경로다. 전에는 기본값이 이름 `php`뿐이었고, ext-php-rs는 그것을 파일의 경로로 읽어
  "php executable not found at php"로 실패했다.

- 추적하는 모든 문서는 영어 파일 `X.md`와 한국어 파일 `X.ko.md`의 쌍이다. `AGENTS.ko.md`와
  `docs/spec/media-type.ko.md`를 더한다. 쌍의 두 파일은 첫 줄에 같은 marker `doc-id`를 갖고,
  한국어 파일은 둘째 줄에 영어 파일의 sha256인 `source-sha256`을 갖는다.

- `composer.lock`을 추적한다. `composer install`이 PHP 확장의 시험을 돌리는 PHPUnit을 고정된 한 판으로 설치한다.

- 바인딩이 macOS에서 빌드되고 로드된다. `.cargo/config.toml`이 macOS 링커에게 PHP와 Node의 기호를 정의하지 않은 채
  두게 한다. 그 기호는 런타임이 라이브러리를 로드할 때 준다. `make test-node`와 `make test-php`는 Cargo가 만든
  라이브러리를 플랫폼의 확장자(macOS `dylib`, Linux `so`)로 가리킨다. 전에는 macOS에서 PHP 확장이 링크되지 않았고, 두
  recipe가 Cargo가 거기서 만들지 않는 `.so` 파일을 가리켰다.

- `scripts/binding.mts`는 Cargo가 고정 커밋으로 만든 binding checkout을 `var/binding/<commit>`에 clone하고, 이제 그 파일을
  복사하지 않는다. `binding check`는 자기 Git checkout에서 자기 커밋을 읽어 `Cargo.lock`의 커밋과 비교한다(CK-20). 파일
  복사본에서는 커밋을 찾지 못해 `make bindings-check`가 실패했다.

- `make test-node`는 이 기계의 addon 플랫폼 패키지를 릴리스처럼 묶어, addon을 담지 않는 Node 패키지와 함께 설치한다(GN-3c).
