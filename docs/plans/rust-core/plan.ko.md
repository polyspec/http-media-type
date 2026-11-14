<!-- doc-id: plan-rust-core -->
<!-- source-sha256: 1a7c19897c4b69970adf4fb1cddccc5b8248d04be16cec249edac39a3d02ecdb -->
# Rust 코어

[English](plan.md)

http-media-type은 [명세](../../spec/media-type.ko.md)의 규칙으로 HTTP의 media type을 읽고 쓰며 token, quoted string,
parameter의 문법을 가진다. 모든 규칙은 `packages/rust`의 Rust crate `polyspec-http-media-type`에 한 번 쓰이고,
`contracts/media-type.json`의 case로 한 번 시험된다. PHP, Python, Node, 브라우저(WASM), Go 패키지는 자기 코드를 갖지
않는다. binding이 인터페이스 계약 `packages/rust/interface.json`에서 각 패키지를 생성하고, binding scaffold가 그 바인딩
crate를 쓴다.

core, interface contract, binding crate의 workspace, 다섯 target의 test는 tree에 있다. 현재 release tree의 버전은
0.0.3이고 generator와 core 의존성은 binding 0.0.5다. [checklist](checklist.ko.md)는 이전 release task와 기록된 검증
상태를 보존한다. 이 계획 갱신은 그 task의 추가 검증을 증명하지 않는다.

계획한 다음 버전은 0.0.4(T1.8)이며 공개된 release가 아니다. 의존성이 다음 순서를 정한다.

1. binding 0.0.7이 공개되어야 그 generator asset과 core release tag를 함께 고정할 수 있다(T1.8-1).
   G-6과 CK-20은 generator와 일치하는 core graph 하나를 요구한다. 이전 core source를 남기면 이 조건을 충족하지
   못한다. 생성된 모든 target과 native package 호출은 각각 기록된 결과가 필요하다.
2. binding GN-19i가 platform과 PHP minor의 조합을 독립 선택하도록 정의한 뒤 PHP asset workflow를 바꾼다(T1.8-2).
   job은 확장을 빌드하고 load한 실제 PHP와 php-config를 기록해야 한다. local run이 건너뛴 외부 setup action은
   runtime이 바뀌었음을 증명할 수 없다.
3. 그 변경과 검증 뒤에 version commit을 만든다(T1.8-3). main push 전에 그 commit의 local CI job 결과가 모두
   있어야 한다. CI 성공, release asset, Go module tag tree, native 설치 증거를 확인해야 release를 완료할 수 있다.
   기존 release tag는 유지한다.
