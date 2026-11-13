<!-- doc-id: readme -->
# http-media-type

[한국어](README.ko.md)

Media types of HTTP (RFC 9110, section 8.3.1) and the grammar they are written in: tokens, quoted strings and
parameters (sections 5.6.2, 5.6.4 and 5.6.6).

- `parse(value)` reads a media type into its type, subtype and parameters, names in lowercase.
- `format(media_type)` writes a media type: names in lowercase, `; ` before each parameter, a value unquoted when it is
  a token and quoted otherwise.
- `same_value(name, left, right)` compares two values of a parameter; only `charset` compares without case.
- The Rust module `grammar` gives the readers of other fields, such as a media range of `Accept`, the same readers of
  tokens, quoted strings and parameters.

Every failure is an error with a kind (`malformed_media_type`, `invalid_media_type`) and no HTTP status: the caller
decides it.

The rules are in [docs/spec/media-type.md](docs/spec/media-type.md), the cases in
[contracts/media-type.json](contracts/media-type.json) and the public API of the bindings in
[packages/rust/interface.json](packages/rust/interface.json), which the crate package holds. The core is the Rust crate
in `packages/rust`; the PHP, Python, Node, browser (WASM) and Go bindings, the five targets that every contract names
(binding BD-27), are generated from the interface contract by binding: the Composer package `polyspec/http-media-type`
(the PHP extension `polyspec_http_media_type`), the PyPI package `polyspec-http-media-type` (module
`polyspec.http_media_type`, Python 3.14 or later), the npm package `@polyspec/http-media-type`, whose WASM entry the
browser takes (the condition `browser` and the subpath `./wasm`), and the Go module
`github.com/polyspec/http-media-type/packages/go`. Each has `parse`, `format` and `sameValue`/`same_value`, the records
`MediaType` and `Parameter`, and the error classes `HttpMediaType<Category>Error` with `kind` and `status`. No release
is published yet.

```sh
make bootstrap       # package-lock.json, @polyspec/kit included, with the npm of devEngines
make install         # the tools of mise.toml, rust-toolchain.toml and .php-version into var/tools
make test            # the core: the contract cases and the tests
make lint            # the core: rustfmt --check and clippy -D warnings
make bindings        # generate the bindings into packages/*/generated
make test-bindings   # clippy of the workspace, then the bindings built, installed and tested in each language
```
