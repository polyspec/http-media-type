//! Media types: the reader (MT-4), the comparison of values (MT-5) and the writer (MT-6).

use crate::grammar::{is_quotable, is_token, lowercase, trim_ows, Cursor, Ending, Malformed};
use crate::Error;

/// A parameter of a media type: its name and its value without quoting (MT-3.4). The reader gives the name in
/// lowercase (MT-1.2).
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct Parameter {
    pub name: String,
    pub value: Vec<u8>,
}

/// A media type: its type and subtype and its parameters in order (MT-4.4). The reader gives the names in lowercase.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct MediaType {
    pub r#type: String,
    pub subtype: String,
    pub parameters: Vec<Parameter>,
}

/// The weight name of a media range, which no media type has (MT-4.3).
const WEIGHT: &str = "q";

/// Reads a media type value (MT-4).
pub fn parse(value: &[u8]) -> Result<MediaType, Error> {
    read(trim_ows(value)).map_err(|Malformed| Error::MalformedMediaType)
}

fn read(value: &[u8]) -> Result<MediaType, Malformed> {
    let mut cursor = Cursor::new(value);
    let r#type = cursor.token()?;
    if !cursor.eat(b'/') {
        return Err(Malformed);
    }
    let subtype = cursor.token()?;
    // MT-4.2: `*` is the wildcard of a range, not a type.
    if r#type == b"*" || subtype == b"*" {
        return Err(Malformed);
    }
    let (parameters, ending) = cursor.parameters(WEIGHT)?;
    // MT-4.3: a parameter named q fails; MT-4.1: nothing follows the parameters.
    if ending == Ending::Stop || !cursor.at_end() {
        return Err(Malformed);
    }
    Ok(MediaType { r#type: lowercase(r#type), subtype: lowercase(subtype), parameters })
}

/// Whether two values of the parameter `name` are equal (MT-5).
pub fn same_value(name: &str, left: &[u8], right: &[u8]) -> bool {
    if name.eq_ignore_ascii_case("charset") {
        // MT-5.2
        left.eq_ignore_ascii_case(right)
    } else {
        // MT-5.3, MT-5.4
        left == right
    }
}

/// Writes a media type (MT-6).
pub fn format(media_type: &MediaType) -> Result<Vec<u8>, Error> {
    let mut text = Vec::new();
    text.extend(name(&media_type.r#type)?.bytes());
    text.push(b'/');
    text.extend(name(&media_type.subtype)?.bytes());
    let mut names: Vec<String> = Vec::with_capacity(media_type.parameters.len());
    for parameter in &media_type.parameters {
        let parameter_name = name(&parameter.name)?;
        // MT-6.4: the name q (MT-4.3) and a name given twice (MT-3.5).
        if parameter_name == WEIGHT || names.contains(&parameter_name) {
            return Err(Error::InvalidMediaType);
        }
        // MT-6.1
        text.extend(b"; ");
        text.extend(parameter_name.bytes());
        text.push(b'=');
        value(&parameter.value, &mut text)?;
        names.push(parameter_name);
    }
    Ok(text)
}

/// A type, subtype or parameter name in lowercase (MT-6.2), or a failure when it is no token or is `*` (MT-6.4).
fn name(text: &str) -> Result<String, Error> {
    if is_token(text.as_bytes()) && text != "*" {
        Ok(lowercase(text.as_bytes()))
    } else {
        Err(Error::InvalidMediaType)
    }
}

/// Writes a value as a token or a quoted string (MT-6.3), or fails on a byte no quoted string carries (MT-6.4).
fn value(bytes: &[u8], text: &mut Vec<u8>) -> Result<(), Error> {
    if is_token(bytes) {
        text.extend(bytes);
        return Ok(());
    }
    text.push(b'"');
    for &byte in bytes {
        if !is_quotable(byte) {
            return Err(Error::InvalidMediaType);
        }
        if byte == b'"' || byte == b'\\' {
            text.push(b'\\');
        }
        text.push(byte);
    }
    text.push(b'"');
    Ok(())
}
