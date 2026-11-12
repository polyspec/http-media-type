# 변경 기록

[English](CHANGELOG.md)

## Unreleased

- spec MT-1~MT-9를 더한다: media type(RFC 9110 8.3.1절), token, parameter와 quoted string(5.6.2, 5.6.4, 5.6.6절),
  parameter 값의 비교(`charset`은 8.3.2절), 쓰기, 다른 field의 reader를 위한 문법 모듈, 오류 kind, 무시하는 입력 표.
- contract case `contracts/media-type.json`(group `parse`, `format`, `sameValue`)을 더한다.
- Rust 코어 `polyspec-http-media-type`(`parse`, `format`, `same_value`, 모듈 `grammar`)과 그 contract·인용·무작위·런타임
  시험, `unwrap`, `expect`와 실패나 부재를 값으로 바꾸는 메서드를 금지하는 lint를 더한다.
- PHP, Python, Node 바인딩을 위한 인터페이스 계약 초안 `contracts/interface.json`을 더한다.
- 인터페이스 계약을 `packages/rust/interface.json`으로 옮기고 crate의 `include`에 넣는다. crate에 의존하는 레포가
  Cargo가 해석한 패키지에서 계약을 읽게 하기 위해서다. category 오류 클래스 이름은 모든 언어에서
  `MediaType<Category>Error`(`MediaTypeValueError` 등)이며 Python `ValueError` 같은 내장 클래스와 겹치지 않는다.
- 계약의 Python 모듈은 polyspec 패키지 이름의 한 형식인 `polyspec.http_media_type`이다.
