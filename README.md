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
[contracts/interface.json](contracts/interface.json). The core is the Rust crate in `packages/rust`; the PHP, Python and
Node bindings are generated from the interface contract and do not exist yet.

```sh
make test
make lint
```
