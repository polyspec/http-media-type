<!-- doc-id: plan-rust-core -->
# Rust core

[한국어](plan.ko.md)

http-media-type reads and writes the media types of HTTP and owns the grammar of tokens, quoted strings and parameters
by the rules of [the specification](../../spec/media-type.md). Every rule is written once, in the Rust crate
`polyspec-http-media-type` of `packages/rust`, and tested once, by the cases of `contracts/media-type.json`. The
packages of PHP, Python, Node, the browser (WASM) and Go hold no code of their own: binding generates each of them from
the interface contract `packages/rust/interface.json`, and binding scaffold writes their binding crates.

The core, the interface contract, the workspace of the binding crates and the tests of the five targets are in the
tree. http-negotiation and http-form read media types through this crate and wait for its first release. [The
checklist](checklist.md) holds what that release still needs, in the order in which each step needs the one before it:

1. The checks of the documents and of the tracked files (T1.1, T1.2).
2. The dependency on binding by its released tag in place of its branch (T1.3), which waits for the release of binding
   0.0.2.
3. The packages of the bindings per platform in the release 0.0.3 (T1.4, T1.7): binding generates their release recipes, so
   this repository writes none of its own, and the workflow `assets.yml` builds them on the runner of each platform.
4. The first release (T1.5): every job of `ci.yml` passes on `main`, and the tags of the core and of the Go module are
   set.
