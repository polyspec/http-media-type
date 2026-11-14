<!-- doc-id: plan-rust-core -->
<!-- source-sha256: a9457d4709ecdb3641591f20dd75cae71c22eed582c963172a7f9cd311b887b5 -->
# Rust 코어

[English](plan.md)

http-media-type은 [명세](../../spec/media-type.ko.md)의 규칙으로 HTTP의 media type을 읽고 쓰며 token, quoted string,
parameter의 문법을 가진다. 모든 규칙은 `packages/rust`의 Rust crate `polyspec-http-media-type`에 한 번 쓰이고,
`contracts/media-type.json`의 case로 한 번 시험된다. PHP, Python, Node, 브라우저(WASM), Go 패키지는 자기 코드를 갖지
않는다. binding이 인터페이스 계약 `packages/rust/interface.json`에서 각 패키지를 생성하고, binding scaffold가 그 바인딩
crate를 쓴다.

코어, 인터페이스 계약, 바인딩 crate의 workspace, 다섯 target의 시험은 tree에 있다. http-negotiation과 http-form은 이
crate로 media type을 읽고 그 첫 release를 기다린다. [checklist](checklist.ko.md)는 그 release에 아직 필요한 것을 각 단계가
앞 단계를 필요로 하는 순서로 담는다.

1. 문서와 추적 파일의 검사(T1.1, T1.2).
2. binding의 branch 대신 release된 tag로 binding에 의존하는 것(T1.3). binding 0.0.2의 release를 기다린다.
3. release 0.0.2의 플랫폼별 바인딩 패키지(T1.4). binding이 그 release recipe를 생성하므로 이 저장소는 자기 recipe를
   쓰지 않고, workflow `assets.yml`이 각 플랫폼의 runner에서 그것을 빌드한다.
4. 첫 release(T1.5). `main`에서 `ci.yml`의 모든 job이 통과하고, 코어와 Go module의 tag가 정해진다.
