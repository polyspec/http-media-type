# 변경 기록

[English](CHANGELOG.md)

## Unreleased

- spec MT-1~MT-9를 더한다: media type(RFC 9110 8.3.1절), token, parameter와 quoted string(5.6.2, 5.6.4, 5.6.6절),
  parameter 값의 비교(`charset`은 8.3.2절), 쓰기, 다른 field의 reader를 위한 문법 모듈, 오류 kind, 무시하는 입력 표.
- contract case `contracts/media-type.json`(group `parse`, `format`, `sameValue`)을 더한다.
- Rust 코어 `polyspec-http-media-type`(`parse`, `format`, `same_value`, 모듈 `grammar`)과 그 contract·인용·무작위·런타임
  시험, `unwrap`, `expect`와 실패나 부재를 값으로 바꾸는 메서드를 금지하는 lint를 더한다.
- PHP, Python, Node 바인딩을 위한 인터페이스 계약 초안 `contracts/interface.json`을 더한다.
