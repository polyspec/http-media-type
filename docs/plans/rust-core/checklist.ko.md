<!-- doc-id: checklist-rust-core -->
<!-- source-sha256: ecbdae217d0b650625d07e2c8813af9941bff76e9ef5f0159cbaff3f8ed32bee -->
# Rust 코어 체크리스트

| ID | Task | Deliverables | Verification | State |
|---|---|---|---|---|
| T1.1 | plan과 이 checklist를 한국어 쌍과 함께 두고 문서를 검사한다. `make docs-check`가 `config/documents.json`의 문서와 `config/checklist.json`의 행을 가진 checklist를 읽고, `make check`와 CI의 항목 `core`가 그것을 실행하며, `make documents-stamp`가 검토된 한국어 쌍의 `source-sha256`을 쓴다. 전에는 어떤 검사도 문서를 읽지 않아서 한국어 쌍이 영어 파일보다 뒤처져도 보이지 않았다 | `docs/plans/rust-core/`, `config/documents.json`, `config/checklist.json`, `Makefile`, `.github/workflows/ci.yml`, `AGENTS.md` | `make docs-check` | [o] |
| T1.2 | 추적 파일은 Git commit을 적지 않는다. commit id는 저장소가 없는 독자에게 아무것도 가리키지 않으므로, 그 규칙을 `AGENTS.md` "Commit과 변경"에 적고 검사한다 | `AGENTS.md`, `tests/scripts/commits.test.mts` | `make test-scripts` | [o] |
| T1.3 | binding의 release에 의존한다. 코어와 바인딩 crate의 `polyspec-binding-core`가 `branch = "v1/rust-core"` 대신 binding 저장소의 `tag = "v0.0.2"`를 적고, binding scaffold가 바인딩 crate를 다시 쓰고, `Cargo.lock`이 그 tag의 commit을 고정하고, `AGENTS.md` "Bindings"가 그 tag를 적는다. binding 0.0.2의 release를 기다린다 | `packages/rust/Cargo.toml`, `packages/*/Cargo.toml`, `Cargo.lock`, `AGENTS.md` | `make install-binding bindings-check` | [v] |
| T1.4 | 바인딩 패키지를 플랫폼별로 release한다. abi3 wheel, PHP 확장, platform package를 가진 npm package, Go 정적 라이브러리가 `config/release.json`의 행이고, `package.json`이 고정하는 kit 0.0.111 이후가 그것을 묶는다. binding이 이 패키지의 release recipe를 생성하므로(binding B2.262) 이 저장소는 자기 recipe를 쓰지 않는다. 브랜치 `lane/release-wasm`의 `config/release.json` 행과 napi CLI를 그 `make release-wasm` 없이 가져오고 브랜치를 지운다. 그 binding 행과 T1.3을 기다린다 | `config/release.json`, `package.json`, `package-lock.json`, `Makefile` | `make release-coverage` | [ ] |
| T1.5 | `main`에서 `ci.yml`의 모든 job을 통과하고, 코어의 tag `vX.Y.Z`, Go module의 tag `packages/go/vX.Y.Z`, http-negotiation과 http-form이 읽는 wheel과 PHP 확장으로 첫 version을 release한다. release는 `main`이 없는 `origin`에 `v1/rust-core`를 `main`으로 push하고 `main`을 기본 브랜치로 만든다. 선행 조건: T1.3과 T1.4 | `main`의 CI 실행, release의 tag | `make ci-passed` | [ ] |
