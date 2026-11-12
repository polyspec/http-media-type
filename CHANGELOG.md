# Changelog

[한국어](CHANGELOG.ko.md)

## Unreleased

- Add the spec MT-1 to MT-9: media types (RFC 9110, section 8.3.1), tokens, parameters and quoted strings (5.6.2,
  5.6.4, 5.6.6), the comparison of parameter values (8.3.2 for `charset`), the writer, the grammar module for the
  readers of other fields, the error kinds and the table of inputs ignored.
- Add the contract cases `contracts/media-type.json` (groups `parse`, `format`, `sameValue`).
- Add the Rust core `polyspec-http-media-type` with `parse`, `format`, `same_value` and the module `grammar`, its
  contract, citation, random and runtime tests, and the lints that deny `unwrap`, `expect` and the methods that turn a
  failure or an absence into a value.
- Add the draft interface contract `contracts/interface.json` for the PHP, Python and Node bindings.
- Move the interface contract to `packages/rust/interface.json` and add it to the `include` of the crate, so that a
  repository that depends on the crate reads the contract from the package that Cargo resolved. The category error
  classes are named `MediaType<Category>Error` in every language (`MediaTypeValueError` and so on), apart from the
  built-in classes such as Python `ValueError`.
- The Python module of the contract is `polyspec.http_media_type`, the one form of the package names of polyspec.
- The repository is one Cargo workspace with the binding crates `packages/python`, `packages/ts` and `packages/php-ext`
  that `bindgen scaffold` writes. The core depends on `polyspec-bindgen-core` and implements `Kinds` for its error.
  `make bindings` generates the PHP, Python and Node bindings, and `make test-bindings` builds, installs and tests each
  with the generated tests and the contract cases. The cases follow the case convention of bindgen: `mediaType` is
  `media_type` and a parameter is `{"name", "value"}`.
