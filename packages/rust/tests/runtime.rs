//! The properties of the types and errors that a binding relies on (MT-8, MT-9).

use std::mem::align_of;

use polyspec_http_media_type::grammar::{Cursor, Ending, Malformed};
use polyspec_http_media_type::{format, parse, Error, MediaType, Parameter};

fn send_and_sync<T: Send + Sync>() {}

#[test]
fn types_are_send_and_sync_and_need_at_most_16_bytes_of_alignment() {
    // MT-9.1: a binding moves values between threads and places them in memory of its runtime's allocator, which
    // PHP and Python align to 16 bytes at least.
    send_and_sync::<MediaType>();
    send_and_sync::<Parameter>();
    send_and_sync::<Error>();
    send_and_sync::<Cursor<'static>>();
    send_and_sync::<Ending>();
    send_and_sync::<Malformed>();
    assert!(align_of::<MediaType>() <= 16);
    assert!(align_of::<Parameter>() <= 16);
    assert!(align_of::<Error>() <= 16);
}

#[test]
fn every_kind_has_no_status_and_a_fixed_message() {
    // MT-8, MT-8.1, MT-8.2
    for (error, kind) in
        [(Error::MalformedMediaType, "malformed_media_type"), (Error::InvalidMediaType, "invalid_media_type")]
    {
        assert_eq!(error.kind(), kind);
        assert_eq!(error.status(), None);
        assert!(!error.to_string().is_empty());
    }
    // MT-8.2: the message names no input.
    match parse(b"x-secret/") {
        Err(error) => assert!(!error.to_string().contains("secret")),
        Ok(media_type) => panic!("gave {media_type:?}"),
    }
    let media_type = MediaType {
        r#type: String::from("text"),
        subtype: String::from("plain"),
        parameters: vec![Parameter { name: String::from("secret"), value: b"\x00".to_vec() }],
    };
    match format(&media_type) {
        Err(error) => assert!(!error.to_string().contains("secret")),
        Ok(bytes) => panic!("gave {bytes:?}"),
    }
}

#[test]
fn no_size_is_limited() -> Result<(), Error> {
    // MT-9.2: every byte is read and written; the host bounds the field.
    let count = 2_000;
    let mut value = String::from("text/plain");
    for index in 0..count {
        value.push_str(&format!(" ; p{index}=\"{}\"", "v ".repeat(50)));
    }
    let media_type = parse(value.as_bytes())?;
    assert_eq!(media_type.parameters.len(), count);
    let written = format(&media_type)?;
    assert_eq!(parse(&written)?, media_type);
    let long = MediaType { r#type: "x".repeat(1_000_000), subtype: String::from("y"), parameters: Vec::new() };
    assert_eq!(format(&long)?.len(), 1_000_002);
    Ok(())
}

#[test]
fn another_reader_reads_the_grammar_through_the_public_module() -> Result<(), Malformed> {
    // MT-7.1, MT-7.2: a reader of a media range with its weight, outside the crate, uses the grammar as it is.
    let mut cursor = Cursor::new(b"Text/*; A=\"1\" ;q=0.5 , */*");
    let r#type = polyspec_http_media_type::grammar::lowercase(cursor.token()?);
    assert!(cursor.eat(b'/'));
    assert_eq!(cursor.token()?, b"*");
    let (parameters, ending) = cursor.parameters("q")?;
    assert_eq!(r#type, "text");
    assert_eq!(parameters, vec![Parameter { name: String::from("a"), value: b"1".to_vec() }]);
    assert_eq!(ending, Ending::Stop);
    assert_eq!(cursor.run(|byte| byte != b' ' && byte != b','), b"0.5");
    cursor.skip_ows();
    assert!(cursor.eat(b','));
    Ok(())
}
