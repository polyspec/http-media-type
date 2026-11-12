
- 레포는 binding 레포(bindgen의 새 이름)의 `polyspec-binding-core`(`binding_core`, `Cargo.lock`이 고정하는 Git 의존
  `https://github.com/polyspec/binding.git`)에 의존하고 그 도구를 `scripts/binding.mts`로 실행한다. 바인딩 package는
  `binding scaffold`가 쓰는 것이다. Python 오류 클래스는 Python의 클래스 형식으로 쓴 레포 이름인
  `HTTPMediaType<Category>Error`다(설계 N-2: 약어 낱말은 Python에서 모두 대문자, PHP와 Node에서 첫 글자만 대문자이며 두
  언어는 `HttpMediaType<Category>Error`를 유지한다).
