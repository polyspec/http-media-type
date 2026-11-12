# http-media-type

[English](README.md)

HTTP의 media type(RFC 9110 8.3.1절)과 그것을 쓰는 문법인 token, quoted string, parameter(5.6.2, 5.6.4, 5.6.6절)를
다룬다.

- `parse(value)`는 media type을 type, subtype, parameter로 읽는다. 이름은 소문자로 돌려준다.
- `format(media_type)`은 media type을 쓴다. 이름은 소문자로, 각 parameter 앞에 `; `를 두고, 값은 token이면 그대로,
  아니면 따옴표로 싸서 쓴다.
- `same_value(name, left, right)`는 한 parameter의 두 값을 비교한다. `charset`만 대소문자를 무시한다.
- Rust 모듈 `grammar`는 `Accept`의 media range처럼 같은 문법을 쓰는 다른 field의 reader에 같은 token, quoted string,
  parameter reader를 준다.

모든 실패는 kind를 가진 오류(`malformed_media_type`, `invalid_media_type`)이며 HTTP 상태는 없다. 상태는 호출자가
정한다.

규칙은 [docs/spec/media-type.md](docs/spec/media-type.md), case는 [contracts/media-type.json](contracts/media-type.json),
바인딩의 공개 API는 crate 패키지에 들어가는 [packages/rust/interface.json](packages/rust/interface.json)에 있다. 코어는
`packages/rust`의 Rust crate이며, PHP, Python, Node 바인딩은 binding이 인터페이스 계약에서 생성한다: Composer 패키지
`polyspec/http-media-type`(PHP 확장 `polyspec_http_media_type`), PyPI 패키지 `polyspec-http-media-type`(모듈
`polyspec.http_media_type`, Python 3.14 이상), npm 패키지 `@polyspec/http-media-type`. 각각 `parse`, `format`,
`sameValue`/`same_value`, record `MediaType`과 `Parameter`, `kind`와 `status`를 가진 오류 클래스
`HttpMediaType<Category>Error`를 가진다. 아직 배포하지 않는다.

```sh
make test            # 코어: contract case와 시험
make lint            # 코어: rustfmt --check와 clippy -D warnings
make bindings        # packages/*/generated에 바인딩 생성
make test-bindings   # workspace clippy, 그다음 언어마다 바인딩을 빌드, 설치, 시험
```
