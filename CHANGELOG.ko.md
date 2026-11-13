<!-- doc-id: changelog -->
<!-- source-sha256: 1de38ec908fdba24fcc0acbf0f24bfe05f0d11f986bb35b22718fb9dfe6e0bc7 -->

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
