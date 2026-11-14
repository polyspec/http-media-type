<!-- doc-id: agents -->
<!-- source-sha256: caa00a59a3e20315aac0f32c49c86af4e7edde6837b552e1da271fd14f326017 -->
# 개발

모든 polyspec 저장소의 작업 원칙은 polyspec의 `PRINCIPLES.md`에 있다. 이 파일은 이 저장소의 규칙만
적는다.

## 범위

- 이 라이브러리는 HTTP의 media type을 읽고 쓰고, 그 parameter의 값을 비교하며, token, quoted string, parameter의
  문법을 소유한다(`docs/spec/media-type.md`, MT-1부터 MT-9까지). 그 문법을 쓰는 다른 field의 reader, 예를 들어
  `Accept`의 media range를 읽는 reader는 공개 모듈 `grammar`를 통해 그 문법을 읽고(MT-7) 그 문법을 다시
  정의하지 않는다. media type이 어느 field에서 오는지와 실패의 상태는 호출자가 정한다
  (MT-8.1).

## 규칙과 작업 순서

- 규칙은 `docs/spec/media-type.md`의 statement다. 규칙을 바꾸는 변경은 spec을 먼저 바꾸고, 그다음
  `contracts/media-type.json`의 case, 그다음 코드를 바꾼다. 모든 case와 모든 시험은 자기가 검사하는 statement를 밝히고,
  `tests/contracts.rs`는 어떤 case나 시험도 인용하지 않는 statement와, 없는 statement를 가리키는 인용을 실패시킨다.
- statement는 그 뜻이 유지되는 동안에만 자기 id를 지킨다. 뜻을 바꾸는 변경은 그 id를 폐기하고 새 statement를 더한다.
- `contracts/media-type.json`의 text는 byte이며, 한 byte가 한 문자다(U+0000부터 U+00FF까지). 실패는 `kind`,
  `status`, `category`, `message`를 가진 객체 `raises`이고, 실패하는 case에는 결과 key가 없다.
- 모든 규칙은 Rust 코어 `packages/rust`에 있다. 바인딩은 type을 변환하고 규칙을 갖지 않는다. 바인딩은 인터페이스
  계약 `packages/rust/interface.json`에서 생성하고 손으로 쓰지 않는다(Bindings 절을 본다). 그 계약은
  crate 패키지에 들어 있다(`packages/rust/Cargo.toml`의 `include`). 그래서 이 crate에 의존하는 저장소는 Cargo를 통해
  그 계약을 읽는다.
- 어떤 결과도 바꾸지 않는 입력은 spec의 표 "Inputs ignored"의 한 행이며, 그 행은 표준의 조항과 그 입력을 보여 주는
  case를 가진다. 그런 행 없이 무시되는 입력은 결함이다.
- 이 저장소의 기록(spec, comment, 시험, changelog, commit message)은 규칙과 그 이유를 규칙 id와 표준의 조항으로
  적는다. 기록은 규칙의 출처와 그 규칙을 정한 사람을 밝히지 않는다.

## Rust

- `rust-toolchain.toml`이 toolchain을 고정하고 `Cargo.lock`이 의존성을 고정한다.
- workspace lint는 모든 경고, unsafe 코드, `unwrap`, `expect`, `as` 변환, 버려지는 결과를 거부한다.
  `clippy.toml`은 실패나 부재를 값으로 바꾸는 method(`Option::unwrap_or`와 그 계열,
  `Result::ok`, `map_or`, `map_or_else`)를 금지한다. 규칙이 필요로 하는 사용에는 `#[allow(..., reason = "<rule id>")]`를 붙인다.
- 어떤 함수도 I/O를 하지 않고, 상태를 유지하지 않고, 기다리지 않는다(MT-9).

## Bindings

- 이 저장소는 하나의 Cargo workspace다. 코어 `packages/rust`와 다섯 target(binding BD-27)의 바인딩 crate `packages/python`,
  `packages/ts`, `packages/ts/wasm`, `packages/php-ext`, `packages/go/internal/ffi`(와 `packages/go/go.mod`)로 이루어지며, 바인딩 crate는 `binding scaffold`가 쓰고 `make bindings-check`가 비교한다.
  바인딩 crate의 `generated/`는 추적하지 않는다. 루트의 `Cargo.lock`이 모든 의존성을 고정한다.
- `polyspec-binding-core`는 binding이 릴리스될 때까지 코어와 바인딩 crate의 Git 의존성이다(binding 저장소의
  `v1/rust-core` 브랜치). `Cargo.lock`이 그 커밋을 고정한다. 코어는 자기 오류에
  `binding_core::Kinds`를 구현한다(MT-8).
- binding 자체는 같은 저장소의 TypeScript 도구이며, 아직 어떤 registry에도 없다. `scripts/binding.mts`는
  `Cargo.lock`이 고정한 커밋으로 Cargo가 만든 checkout에서 binding을 가져와 `make install-binding`이 그것을
  `var/binding/<commit>`에 clone하고 거기에 binding의 `package-lock.json`대로 의존성을 설치한다. 그래서 생성기와
  `binding_core`가 한 판이 된다. 내려받는 것은 `make install-binding`뿐이다(`Cargo.lock`의 crate와 binding의 package).
  `make bindings-check`와 `make bindings`는 그것을 offline으로 읽고 없으면 실패한다. 내려받는 검사는 network에 기대기
  때문이다.
  그 clone은 그 커밋의 binding Git checkout이다. binding check는 그 clone에서 자기 커밋을 읽어
  `Cargo.lock`의 커밋과 비교하며(CK-20), 파일만 복사한 것은 이 비교에서 실패한다. 이 방식은 binding의 첫 릴리스까지만
  유지된다.
- `contracts/media-type.json`의 case는 binding의 case 규약(G-5)을 따른다. case의 key는 snake_case로 쓴 parameter
  이름(`media_type`)이고, record는 그 field들의 객체다(parameter는 `{"name", "value"}`다).
- `make bindings`가 생성한다. 바인딩을 빌드하거나 시험하는 모든 make target은 그것을 먼저 실행한다. `make test-bindings`는
  workspace 전체에 clippy를 실행하고, `make check-declarations`를 실행하고, 그다음 계약의 다섯 target마다 하나씩
  `make test-python`, `make test-node`, `make test-wasm`, `make test-php`, `make test-go`를 실행한다. 각각은 binding이
  생성한 시험과 그 바인딩의 contract case를 그 언어의 표준 runner로 실행한다. runner는 unittest, node --test(Node와
  WASM, WASM 바인딩은 같은 설치 패키지의 subpath `./wasm`으로), PHPUnit, go test다. contract case는
  `packages/python/tests`, `packages/ts/tests/cases.test.mjs`, `packages/ts/tests/cases.wasm.test.mjs`,
  `packages/php-ext/tests`, `packages/go/tests`다. 생성기가 받지 못하는 target은 원인과 함께 실패하는 target으로
  남는다. 어떤 target도 빠지거나 건너뛰지 않는다(binding BD-27).
- Go 모듈에서 binding은 파일 `zz_generated_*.go`를 소유하고(binding GN-3), `make bindings`가 그 파일들을 쓴다. 이
  파일들과 `packages/go/internal/ffi/lib/<platform>`의 정적 라이브러리는 추적하지 않는다. Go는 모듈을 tag의 소스로
  받으므로 release가 둘을 Go tag의 commit에 더하고(binding GN-15g, CK-19), 추적한 사본은 pin이 바뀔 때마다 pin된
  binding이 쓰는 것과 달라지기 때문이다. `packages/ts/wasm/generated`와 `packages/go/internal/ffi/generated`는 추적하지
  않는다. wasm-bindgen은 모듈과 그 glue를 앞의 디렉터리에 쓴다.
  변수 `PYTHON`(3.14 이상), `PHP`, `PHP_CONFIG`, `PHPUNIT`, `GO`, `GOFMT`, `WASM_BINDGEN`이 런타임을 가리킨다.
  `make test-go`는 `packages/go/go.mod`의 go 지시문과 다른 판의 Go를 실패시키고, toolchain을 받지 않도록
  `GOTOOLCHAIN=local`로 실행한다. `make test-wasm`은 `packages/ts/wasm/Cargo.toml`의 `wasm-bindgen` crate와 다른 판의
  wasm-bindgen CLI를 실패시킨다. 그 CLI는 자기 판의 모듈만 읽기 때문이다(binding GN-18). `CARGOFLAGS`는 모든 cargo build에
  인자를 더한다. macOS에서 PHP 확장과 Node addon은 자기 런타임이 그것을 로드할 때 런타임의 기호를
  받는다. 그래서 링커는 그 기호를 정의하지 않은 채 두어야 한다. binding scaffold가 두 crate마다 쓰는 `build.rs`가 자기
  라이브러리에만 그렇게 지시하고(binding GN-3d), 추적되는 어떤 파일도 `RUSTFLAGS`나 `.cargo/config.toml`로 링크 설정을
  주지 않는다. recipe는 Cargo가 만든 라이브러리를 플랫폼의 확장자(macOS `dylib`, Linux `so`)로 가리킨다.
- 도구는 추적되는 파일에 고정되고, binding처럼 checkout의 `var/tools`에 설치된다. `mise.toml`은 Node.js, npm, Go,
  Python, Composer, wasm-bindgen CLI, maturin을 binding의 판으로 적고 `mise.lock`은 그 digest를 적는다. `config/toolchain.json`은
  mise의 판과 digest를, `rust-toolchain.toml`은 target `wasm32-unknown-unknown`을 가진 Rust toolchain을, `.php-version`은
  `var/tools/bin`의 wrapper가 실행하는 기계의 PHP를 적는다. 새 checkout은 `make bootstrap`을 실행해 `package.json`의
  `devEngines`가 적는 npm으로 `package-lock.json`을 설치하고, 그다음 `@polyspec/kit`의 설치기를 실행하는 `make install`
  (`make install-tools`)을 실행한다. 모든 recipe는 `var/tools/bin`과 mise의 shim을 `PATH` 앞에 두고 실행한다. `GO`,
  `GOFMT`, `WASM_BINDGEN`은 mise의 shim을, `PHP`와 `PHP_CONFIG`는 `var/tools/bin`의 wrapper를 가리킨다.
- 개발 도구는 이 저장소의 의존성이다. TypeScript와 `@polyspec/kit`은 `package.json`에 있고 `package-lock.json`이 고정한다.
  PHPUnit은 `composer.json`의 `require-dev`에 있고, `composer install`이 `vendor/`에 설치하며,
  `composer.lock`이 고정한다.

## 검사

- `make test`는 코어의 contract case, 인용 검사, 무작위 시험, 런타임 속성을 실행한다.
- `make lint`는 `cargo fmt --check`와, 모든 경고를 거부하는 코어의 clippy를 실행한다. `make check`는 그 둘과
  `make bindings-check`를 실행한다.

## CI와 release

- `.github/workflows/ci.yml`은 `main`의 push와 수동 실행에서 돈다. matrix 항목마다 job 하나다. `core`는 `lint-rust`,
  `fmt-check`, `test`, `bindings-check`, `release-coverage`를 실행하고, `bindings`는 `make test-bindings`의 대상을 실행한다.
  각 job은 그 대상을 `make ci-targets`로 실행한다. `make ci-targets`는 모든 대상을 끝까지 실행하고 보고서
  `var/ci/<name>/`을 쓴다. 마지막 job `ci-passed`는 다른 모든 job이 통과했을 때만 통과한다. job은 `ubuntu-26.04-arm`에서
  돌고, 모든 action을 commit으로 고정하며, `timeout-minutes`를 두지 않고, step의 모든 명령을 make target 하나로
  실행한다. 그래야 Makefile의 설정이 그 명령에 적용되기 때문이다. `.github/actions/bootstrap`은 모든 job의 bootstrap이고,
  `make install-php-tools`는 `mise.toml`의 Composer로 `composer.lock`의 PHPUnit을 `vendor/`에 설치한다.
- `config/release.json`은 모든 package 파일을 분류하고, `make release-coverage`가 그것을 검사한다. tag `vX.Y.Z`는 코어
  crate `packages/rust`를 Git tag로 release한다. Cargo 의존은 그것을 `tag = "vX.Y.Z"`로 가리킨다. 그 tag는 binding
  manifest의 version이기도 하며, binding scaffold가 코어의 version으로 그 manifest를 쓴다. release는 release commit에 Go module
  `packages/go`를 `packages/go/vX.Y.Z`로도 tag한다(`config/release.json`의 `goModules`). Go는 저장소 루트 아래의 module을
  그 형태의 tag로 가져오고, Go 바인딩이 이 저장소의 record를 가리키는 저장소는 그 module을 그 version으로 요구하기
  때문이다(binding GN-15g). tag는 아직 archive를 release하지 않는다. 바인딩은 플랫폼마다 빌드되는데(abi3 wheel, PHP 확장,
  npm package와 그 플랫폼 package, Go 정적 라이브러리), kit 0.0.109의 release 도구는 npm package, Composer 소스 archive, 순수
  Python wheel만 묶기 때문이다.
- release는 `main`에서 성공한 `ci.yml`의 push 실행이나 수동 실행의 commit이다. version-bump commit `chore(release):
  Release X.Y.Z`는 코어의 version(루트 `Cargo.toml`의 `[workspace.package]`의 `version`)을 정하고, binding scaffold(`node scripts/binding.mts scaffold --contract
  packages/rust/interface.json`)로 binding manifest를 다시 쓰며, `Cargo.lock`의 로컬 package version을 맞추고, 두
  changelog의 `## Unreleased`를 `## X.Y.Z`로 바꾸고 그 위에 빈 `## Unreleased`를 둔다. 그 push의 CI 실행이 성공하면
  `.github/workflows/release.yml`이 스스로 시작하고, `gh workflow run release.yml -f run=<id>`가 그것을 다시 시작한다.
  `make release-tag`가 그 commit에 annotated tag `vX.Y.Z`를 만들어 push하고, `make release-publish`와 `make
  release-undraft`가 GitHub Release를 만든다. tag를 손으로 만들지 않는다.
- 첫 release 전에 열려 있는 일이며, 이것 없이는 release가 끝난 것이 아니다. `origin`에 `main`이 없으므로 release는
  `v1/rust-core`를 `main`으로 push하고 `main`을 기본 브랜치로 만든다. 바인딩의 package(abi3 wheel, PHP 확장, npm package와
  그 플랫폼 package)는 kit 0.0.111과 binding의 release가 있어야 `config/release.json`의 행이 된다. kit 0.0.109가 그 kind를
  거부하기 때문이다. 브랜치 `lane/release-wasm`이 그 행, npm 플랫폼 package의 napi CLI, `make release-wasm`을 가진다. 이 브랜치는
  같은 두 release를 기다리는 일이며 그때 merge한다. kit 0.0.109와 고정된 binding으로는 그 `make bindings-check`와
  `make release-coverage`가 실패하기 때문이다.

## Commit과 변경

- commit message는 `type(scope): Subject`다. type은 feat, fix, docs, style, refactor, test, chore 중 하나이고, Subject는
  50자 이하이며 대문자로 시작하고 마침표 없이 끝난다. 그 뒤에 빈 줄과 72자에서 줄을 바꾼
  본문이 온다.
- 동작 변경, 그 spec, 그 case, 그리고 `CHANGELOG.md`와 `CHANGELOG.ko.md`의 `## Unreleased` 아래에 넣는 그 항목은
  하나의 변경이다.
