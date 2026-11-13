<!-- doc-id: agents -->
<!-- source-sha256: fb2052c8c67d94c4b4608fbeb02c91e31589e0fb1c9096694c9493dc54274a1f -->
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

- 이 저장소는 하나의 Cargo workspace다. 코어 `packages/rust`와 바인딩 crate `packages/python`,
  `packages/ts`, `packages/php-ext`로 이루어지며, 바인딩 crate는 `binding scaffold`가 쓰고 `make bindings-check`가 비교한다.
  바인딩 crate의 `generated/`는 추적하지 않는다. 루트의 `Cargo.lock`이 모든 의존성을 고정한다.
- `polyspec-binding-core`는 binding이 릴리스될 때까지 코어와 바인딩 crate의 Git 의존성이다(binding 저장소의
  `v1/rust-core` 브랜치). `Cargo.lock`이 그 커밋을 고정한다. 코어는 자기 오류에
  `binding_core::Kinds`를 구현한다(MT-8).
- binding 자체는 같은 저장소의 TypeScript 도구이며, 아직 어떤 registry에도 없다. `scripts/binding.mts`는
  `Cargo.lock`이 고정한 커밋으로 Cargo가 만든 checkout에서 binding을 가져와 `var/binding/<commit>`에 clone하고,
  거기에 binding의 `package-lock.json`대로 의존성을 설치한다. 그래서 생성기와 `binding_core`가 한 판이 된다.
  그 clone은 그 커밋의 binding Git checkout이다. binding check는 그 clone에서 자기 커밋을 읽어
  `Cargo.lock`의 커밋과 비교하며(CK-20), 파일만 복사한 것은 이 비교에서 실패한다. 이 방식은 binding의 첫 릴리스까지만
  유지된다.
- `contracts/media-type.json`의 case는 binding의 case 규약(G-5)을 따른다. case의 key는 snake_case로 쓴 parameter
  이름(`media_type`)이고, record는 그 field들의 객체다(parameter는 `{"name", "value"}`다).
- `make bindings`가 생성한다. 바인딩을 빌드하거나 시험하는 모든 make target은 그것을 먼저 실행한다. `make test-bindings`는
  workspace 전체에 clippy를 실행하고, `make check-declarations`를 실행하고, 그다음 `make test-python`, `make test-node`, `make
  test-php`를 실행한다. 이 셋은 각각 binding이 생성한 시험과 `packages/<language>/tests`의 contract case를 실행한다.
  변수 `PYTHON`(3.14 이상), `PHP`, `PHP_CONFIG`, `PHPUNIT`이 런타임을 가리킨다. `CARGOFLAGS`는 모든 cargo build에
  인자를 더한다. macOS에서 PHP 확장과 Node addon은 자기 런타임이 그것을 로드할 때 런타임의 기호를
  받는다. 그래서 `.cargo/config.toml`이 링커에게 그 기호를 정의하지 않은 채 두게 하고, recipe는 Cargo가 만든
  라이브러리를 플랫폼의 확장자(macOS `dylib`, Linux `so`)로 가리킨다.
- 개발 도구는 이 저장소의 의존성이다. TypeScript는 `package.json`에 있고 `package-lock.json`이 고정한다.
  PHPUnit은 `composer.json`의 `require-dev`에 있고, `composer install`이 `vendor/`에 설치하며,
  `composer.lock`이 고정한다.

## 검사

- `make test`는 코어의 contract case, 인용 검사, 무작위 시험, 런타임 속성을 실행한다.
- `make lint`는 `cargo fmt --check`와, 모든 경고를 거부하는 코어의 clippy를 실행한다. `make check`는 그 둘과
  `make bindings-check`를 실행한다.

## Commit과 변경

- commit message는 `type(scope): Subject`다. type은 feat, fix, docs, style, refactor, test, chore 중 하나이고, Subject는
  50자 이하이며 대문자로 시작하고 마침표 없이 끝난다. 그 뒤에 빈 줄과 72자에서 줄을 바꾼
  본문이 온다.
- 동작 변경, 그 spec, 그 case, 그리고 `CHANGELOG.md`와 `CHANGELOG.ko.md`의 `## Unreleased` 아래에 넣는 그 항목은
  하나의 변경이다.
