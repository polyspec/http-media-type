use std::fmt;

/// A failure of this library (MT-8). Each variant has a kind that never changes and no HTTP status (MT-8.1).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Error {
    /// A media type value does not follow the grammar (MT-4).
    MalformedMediaType,
    /// A media type cannot be written (MT-6.4).
    InvalidMediaType,
}

impl Error {
    /// The kind of the failure (MT-8).
    pub fn kind(&self) -> &'static str {
        match self {
            Error::MalformedMediaType => "malformed_media_type",
            Error::InvalidMediaType => "invalid_media_type",
        }
    }

    /// The HTTP status of the failure: none, because the caller decides it (MT-8.1).
    pub fn status(&self) -> Option<u16> {
        match self {
            Error::MalformedMediaType | Error::InvalidMediaType => None,
        }
    }
}

impl fmt::Display for Error {
    /// The fixed sentence of the kind, which names no input (MT-8.2).
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Error::MalformedMediaType => "the value is not a media type of RFC 9110, section 8.3.1",
            Error::InvalidMediaType => {
                "the media type has a name that is no token, a wildcard, the parameter q, a parameter given twice or a \
                 value that a quoted string cannot carry"
            }
        })
    }
}

impl std::error::Error for Error {}

/// The kind interface that the generated bindings read (bindgen design E-1, E-3): the kind and the absent status of
/// MT-8.1, and no errno, since the library does no I/O (MT-9).
impl bindgen_core::Kinds for Error {
    fn kind(&self) -> &'static str {
        Error::kind(self)
    }

    fn status(&self) -> Option<u16> {
        Error::status(self)
    }

    fn errno(&self) -> Option<i32> {
        None
    }
}
