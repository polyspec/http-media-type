# The tasks of this repository. The Rust toolchain is the one that rust-toolchain.toml pins.
.PHONY: test lint test-rust lint-rust

test: test-rust

lint: lint-rust

# The contract cases, the rule citations, the random tests and the runtime properties (MT-1 to MT-9).
test-rust:
	cargo test --locked --offline

# R-1 lints of Cargo.toml and clippy.toml; every warning fails.
lint-rust:
	cargo fmt --check
	cargo clippy --locked --offline --all-targets -- -D warnings
