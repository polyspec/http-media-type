<!-- doc-id: plan-rust-core -->
# Rust core

[한국어](plan.ko.md)

http-media-type reads and writes the media types of HTTP and owns the grammar of tokens, quoted strings and parameters
by the rules of [the specification](../../spec/media-type.md). Every rule is written once, in the Rust crate
`polyspec-http-media-type` of `packages/rust`, and tested once, by the cases of `contracts/media-type.json`. The
packages of PHP, Python, Node, the browser (WASM) and Go hold no code of their own: binding generates each of them from
the interface contract `packages/rust/interface.json`, and binding scaffold writes their binding crates.

The core, the interface contract, the workspace of the binding crates and the tests of the five targets are in the
tree. The version of the current release tree is 0.0.3, whose generator and core dependency are binding 0.0.5. The
[checklist](checklist.md) preserves the earlier release tasks and their recorded verification states; this planning
update establishes no additional verification of those tasks.

The planned next version is 0.0.4 (T1.8), not a published release. Its dependencies determine the order:

1. Binding 0.0.7 must be public before its generator asset and core release tag can be pinned together (T1.8-1).
   G-6 and CK-20 require one core graph that matches the generator; retaining the older core source does not meet
   that condition. Every generated target and native package call needs its own recorded result.
2. The PHP asset workflow changes after binding GN-19i defines independently selectable platform and PHP-minor
   combinations (T1.8-2). A job must record the actual PHP and php-config that built and loaded its extension. An
   external setup action skipped by a local run cannot prove that a runtime changed.
3. The version commit follows those changes and their verification (T1.8-3). Its complete local CI job results must
   precede the main push; successful CI, release assets, the Go module tag tree and native install evidence must
   precede completion of the release. Existing release tags remain unchanged.
