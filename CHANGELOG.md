
- The repository depends on `polyspec-binding-core` of the repository binding (`binding_core`, the Git dependency
  `https://github.com/polyspec/binding.git`, which `Cargo.lock` pins), the new name of bindgen, and runs its tool with
  `scripts/binding.mts`; the binding packages are those that `binding scaffold` writes. The Python error classes are
  `HTTPMediaType<Category>Error`, the class form of the repository name in Python (design N-2: an acronym word is all
  capitals in Python and one capital word in PHP and Node, which keep `HttpMediaType<Category>Error`).
