//! Media types of HTTP (RFC 9110, section 8.3.1): their reader, their writer, the comparison of parameter values and
//! the grammar of tokens, quoted strings and parameters. The rules are `docs/spec/media-type.md`, MT-1 to MT-9.
//!
//! Every function is pure (MT-9): it reads its arguments and returns a value or an [`Error`] with a kind (MT-8).

mod error;
pub mod grammar;
mod media_type;

pub use error::Error;
pub use media_type::{format, parse, same_value, MediaType, Parameter};
