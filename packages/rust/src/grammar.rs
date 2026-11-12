//! The grammar of tokens, whitespace, quoted strings and parameters (MT-1 to MT-3), public for the readers of other
//! fields that use it (MT-7).

use crate::Parameter;

/// A `tchar` (MT-2.1, RFC 9110, section 5.6.2).
pub fn is_tchar(byte: u8) -> bool {
    byte.is_ascii_alphanumeric()
        || matches!(
            byte,
            b'!' | b'#' | b'$' | b'%' | b'&' | b'\'' | b'*' | b'+' | b'-' | b'.' | b'^' | b'_' | b'`' | b'|' | b'~'
        )
}

/// A token: one or more `tchar` (MT-2.1).
pub fn is_token(bytes: &[u8]) -> bool {
    !bytes.is_empty() && bytes.iter().all(|&byte| is_tchar(byte))
}

/// SP or HTAB, the bytes of `OWS` (RFC 9110, section 5.6.3; MT-1.3).
pub fn is_ows(byte: u8) -> bool {
    byte == b' ' || byte == b'\t'
}

/// A `qdtext` byte (MT-3.3).
fn is_qdtext(byte: u8) -> bool {
    byte == b'\t'
        || byte == b' '
        || byte == 0x21
        || (0x23..=0x5B).contains(&byte)
        || (0x5D..=0x7E).contains(&byte)
        || byte >= 0x80
}

/// A byte that a quoted string can carry, alone or after a backslash: HTAB, SP, VCHAR and `obs-text` (MT-3.3).
pub fn is_quotable(byte: u8) -> bool {
    byte == b'\t' || byte == b' ' || (0x21..=0x7E).contains(&byte) || byte >= 0x80
}

/// The value without the SP and HTAB around it (MT-1.3).
pub fn trim_ows(bytes: &[u8]) -> &[u8] {
    let mut inner = bytes;
    while let [first, rest @ ..] = inner {
        if !is_ows(*first) {
            break;
        }
        inner = rest;
    }
    while let [rest @ .., last] = inner {
        if !is_ows(*last) {
            break;
        }
        inner = rest;
    }
    inner
}

/// A token as lowercase text (MT-1.2, MT-2.2). The caller has checked that the bytes are a token, so they are ASCII.
pub fn lowercase(token: &[u8]) -> String {
    token.iter().map(|&byte| char::from(byte.to_ascii_lowercase())).collect()
}

/// The bytes do not follow the grammar (MT-7.3). It has no kind: each reader turns it into the kind of its field.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Malformed;

/// Where the parameter reader stopped (MT-7.2).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Ending {
    /// After the last parameter, before the whitespace and the byte that follow it, or at the end.
    Parameters,
    /// After the `=` of the parameter that the caller named; its value is unread.
    Stop,
}

/// A reading position over the bytes of one value: the bytes not read yet.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Cursor<'a> {
    rest: &'a [u8],
}

impl<'a> Cursor<'a> {
    pub fn new(bytes: &'a [u8]) -> Self {
        Cursor { rest: bytes }
    }

    /// The bytes not read yet.
    pub fn rest(&self) -> &'a [u8] {
        self.rest
    }

    pub fn peek(&self) -> Option<u8> {
        self.rest.first().copied()
    }

    pub fn at_end(&self) -> bool {
        self.rest.is_empty()
    }

    /// Consumes the next byte when `accept` takes it.
    fn advance_if(&mut self, accept: impl Fn(u8) -> bool) -> Option<u8> {
        match self.rest {
            [first, rest @ ..] if accept(*first) => {
                self.rest = rest;
                Some(*first)
            }
            _ => None,
        }
    }

    /// Consumes the SP and HTAB that come next (`OWS`).
    pub fn skip_ows(&mut self) {
        while self.advance_if(is_ows).is_some() {}
    }

    /// Consumes `byte` when it is next.
    pub fn eat(&mut self, byte: u8) -> bool {
        self.advance_if(|next| next == byte).is_some()
    }

    /// Consumes the longest run of bytes that `accept` takes, which may be empty.
    pub fn run(&mut self, accept: impl Fn(u8) -> bool) -> &'a [u8] {
        let length = self.rest.iter().take_while(|&&byte| accept(byte)).count();
        let (run, rest) = self.rest.split_at(length);
        self.rest = rest;
        run
    }

    /// Consumes the longest run of `tchar`; fails when it is empty (MT-2.1).
    pub fn token(&mut self) -> Result<&'a [u8], Malformed> {
        match self.run(is_tchar) {
            [] => Err(Malformed),
            token => Ok(token),
        }
    }

    /// Consumes a quoted string at a `"` and returns its value (MT-3.3, MT-3.4).
    pub fn quoted_string(&mut self) -> Result<Vec<u8>, Malformed> {
        if !self.eat(b'"') {
            return Err(Malformed);
        }
        let mut value = Vec::new();
        loop {
            if self.eat(b'"') {
                return Ok(value);
            }
            let byte = if self.eat(b'\\') { self.advance_if(is_quotable) } else { self.advance_if(is_qdtext) };
            match byte {
                Some(byte) => value.push(byte),
                // MT-3.3: a byte that is no qdtext, or the end before the closing quote, fails.
                None => return Err(Malformed),
            }
        }
    }

    /// Reads `parameters` (MT-3) up to the parameter named `stop` (MT-7.2), compared without case (MT-2.2).
    ///
    /// The cursor stops after the last parameter, before the whitespace that follows it, or, on `stop`, after its `=`.
    pub fn parameters(&mut self, stop: &str) -> Result<(Vec<Parameter>, Ending), Malformed> {
        let mut parameters: Vec<Parameter> = Vec::new();
        loop {
            let before = self.rest;
            self.skip_ows();
            if !self.eat(b';') {
                self.rest = before;
                return Ok((parameters, Ending::Parameters));
            }
            self.skip_ows();
            match self.peek() {
                // MT-3.2: an empty parameter gives nothing; `,` ends a list element of the caller's field.
                None | Some(b';') | Some(b',') => continue,
                Some(_) => {}
            }
            let name = lowercase(self.token()?);
            // MT-3.1: no whitespace before or after `=`.
            if !self.eat(b'=') {
                return Err(Malformed);
            }
            if name.eq_ignore_ascii_case(stop) {
                return Ok((parameters, Ending::Stop));
            }
            let value = if self.peek() == Some(b'"') { self.quoted_string()? } else { self.token()?.to_vec() };
            // MT-3.5: a parameter given twice fails.
            if parameters.iter().any(|parameter| parameter.name == name) {
                return Err(Malformed);
            }
            parameters.push(Parameter { name, value });
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{is_quotable, trim_ows, Cursor, Ending, Malformed};
    use crate::Parameter;

    fn parameter(name: &str, value: &[u8]) -> Parameter {
        Parameter { name: name.to_owned(), value: value.to_vec() }
    }

    #[test]
    fn the_parameter_reader_stops_on_the_named_parameter() {
        // MT-7.2: the value of the stop parameter is left for the caller.
        let mut cursor = Cursor::new(b";a=1; Q=0.5;b=2");
        assert_eq!(cursor.parameters("q"), Ok((vec![parameter("a", b"1")], Ending::Stop)));
        assert_eq!(cursor.rest(), b"0.5;b=2");
    }

    #[test]
    fn the_parameter_reader_stops_before_what_starts_no_parameter() {
        // MT-7.2, MT-3.2: `, ` is the caller's; the empty parameter before it gives nothing.
        let mut cursor = Cursor::new(b";a=1 ; , text/plain");
        assert_eq!(cursor.parameters("q"), Ok((vec![parameter("a", b"1")], Ending::Parameters)));
        assert_eq!(cursor.rest(), b", text/plain");
        let mut cursor = Cursor::new(b" x");
        assert_eq!(cursor.parameters("q"), Ok((Vec::new(), Ending::Parameters)));
        assert_eq!(cursor.rest(), b" x");
    }

    #[test]
    fn a_grammar_failure_is_malformed() {
        // MT-7.3
        for bytes in [&b";a"[..], b";a=", b";a=\"b", b";a=1;A=2", b"; =1"] {
            assert_eq!(Cursor::new(bytes).parameters("q"), Err(Malformed), "{bytes:?}");
        }
    }

    #[test]
    fn byte_classes() {
        // MT-1.3, MT-3.3
        assert_eq!(trim_ows(b" \t a \t"), b"a");
        assert_eq!(trim_ows(b"\xa0a\n"), b"\xa0a\n");
        assert!((0u8..=255)
            .filter(|&byte| !is_quotable(byte))
            .all(|byte| byte != b'\t' && (byte < 0x20 || byte == 0x7F)));
        assert_eq!((0u8..=255).filter(|&byte| !is_quotable(byte)).count(), 32);
    }
}
