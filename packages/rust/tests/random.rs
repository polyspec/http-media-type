//! Random inputs: every byte string reads to a media type or to its kind, a media type written in any style reads
//! back, the writer writes exactly the media types that the rules allow and they read back, and the comparison of
//! values follows MT-5. The expectations are computed here from the rules directly.

use polyspec_http_media_type::{format, parse, same_value, Error, MediaType, Parameter};
use proptest::prelude::*;
use proptest::test_runner::TestCaseError;

const TYPES: [&str; 4] = ["text", "application", "image", "te*t"];
const SUBTYPES: [&str; 4] = ["html", "plain", "vnd.x+json", "form-data"];
const NAMES: [&str; 5] = ["a", "level", "charset", "boundary", "qq"];
const TCHARS: &[u8] = b"!#$%&'*+-.^_`|~0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

fn fail(error: Error) -> TestCaseError {
    TestCaseError::fail(error.to_string())
}

fn is_token(bytes: &[u8]) -> bool {
    !bytes.is_empty() && bytes.iter().all(|byte| TCHARS.contains(byte))
}

/// A byte that a quoted string carries (MT-3.3), written from the rule.
fn is_quotable(byte: u8) -> bool {
    byte == b'\t' || byte >= 0x20 && byte != 0x7F
}

/// A value of any quotable bytes, often a token.
fn value() -> impl Strategy<Value = Vec<u8>> {
    prop_oneof![
        proptest::collection::vec(proptest::sample::select(TCHARS.to_vec()), 1..6),
        proptest::collection::vec(any::<u8>().prop_filter("quotable", |&byte| is_quotable(byte)), 0..8),
    ]
}

/// A media type that the reader could return: lowercase names, no `*`, no `q`, distinct names.
fn media_type() -> impl Strategy<Value = MediaType> {
    let parameters = proptest::collection::vec((0..NAMES.len(), value()), 0..4);
    (0..TYPES.len(), 0..SUBTYPES.len(), parameters).prop_map(|(r#type, subtype, parameters)| {
        let mut kept: Vec<Parameter> = Vec::new();
        for (name, value) in parameters {
            if !kept.iter().any(|parameter| parameter.name == NAMES[name]) {
                kept.push(Parameter { name: NAMES[name].to_owned(), value });
            }
        }
        MediaType { r#type: TYPES[r#type].to_owned(), subtype: SUBTYPES[subtype].to_owned(), parameters: kept }
    })
}

/// How a media type is written: the case of its names, whitespace, quoting and empty parameters.
#[derive(Debug, Clone)]
struct Style {
    upper: Vec<bool>,
    spaces: Vec<usize>,
    quote: Vec<bool>,
    pairs: Vec<bool>,
    empties: Vec<bool>,
}

fn style() -> impl Strategy<Value = Style> {
    (
        proptest::collection::vec(any::<bool>(), 8),
        proptest::collection::vec(0usize..3, 12),
        proptest::collection::vec(any::<bool>(), 4),
        proptest::collection::vec(any::<bool>(), 4),
        proptest::collection::vec(any::<bool>(), 5),
    )
        .prop_map(|(upper, spaces, quote, pairs, empties)| Style { upper, spaces, quote, pairs, empties })
}

fn flag(flags: &[bool], index: usize) -> bool {
    flags.get(index).copied().is_some_and(|value| value)
}

fn whitespace(style: &Style, index: usize) -> Vec<u8> {
    match style.spaces.get(index) {
        Some(1) => b" ".to_vec(),
        Some(2) => b" \t".to_vec(),
        _ => Vec::new(),
    }
}

fn cased(text: &str, upper: bool) -> Vec<u8> {
    if upper {
        text.to_ascii_uppercase().into_bytes()
    } else {
        text.as_bytes().to_vec()
    }
}

/// Writes a media type in the given style, as any sender may (MT-1.3, MT-2.2, MT-3.1 to MT-3.4).
fn write(media_type: &MediaType, style: &Style) -> Vec<u8> {
    let mut out = whitespace(style, 10);
    out.extend(cased(&media_type.r#type, flag(&style.upper, 0)));
    out.push(b'/');
    out.extend(cased(&media_type.subtype, flag(&style.upper, 1)));
    for (index, parameter) in media_type.parameters.iter().enumerate() {
        out.extend(whitespace(style, index * 2));
        out.push(b';');
        out.extend(whitespace(style, index * 2 + 1));
        if flag(&style.empties, index) {
            out.push(b';');
        }
        out.extend(cased(&parameter.name, flag(&style.upper, index + 2)));
        out.push(b'=');
        if is_token(&parameter.value) && !flag(&style.quote, index) {
            out.extend(&parameter.value);
        } else {
            out.push(b'"');
            for &byte in &parameter.value {
                if byte == b'"' || byte == b'\\' || flag(&style.pairs, index) {
                    out.push(b'\\');
                }
                out.push(byte);
            }
            out.push(b'"');
        }
    }
    if flag(&style.empties, 4) {
        out.push(b';');
    }
    out.extend(whitespace(style, 11));
    out
}

/// Whether the writer may write a media type, computed from MT-6.4.
fn writable(media_type: &MediaType) -> bool {
    let name = |text: &str| is_token(text.as_bytes()) && text != "*";
    let names_valid = media_type.parameters.iter().enumerate().all(|(index, parameter)| {
        name(&parameter.name)
            && !parameter.name.eq_ignore_ascii_case("q")
            && media_type.parameters.iter().take(index).all(|other| !other.name.eq_ignore_ascii_case(&parameter.name))
    });
    name(&media_type.r#type)
        && name(&media_type.subtype)
        && names_valid
        && media_type.parameters.iter().all(|parameter| parameter.value.iter().all(|&byte| is_quotable(byte)))
}

fn lowered(media_type: &MediaType) -> MediaType {
    MediaType {
        r#type: media_type.r#type.to_ascii_lowercase(),
        subtype: media_type.subtype.to_ascii_lowercase(),
        parameters: media_type
            .parameters
            .iter()
            .map(|parameter| Parameter { name: parameter.name.to_ascii_lowercase(), value: parameter.value.clone() })
            .collect(),
    }
}

/// A name of any bytes of a small alphabet that holds tchar, `*`, case, separators and a byte above 0x7F.
fn wild_name() -> impl Strategy<Value = String> {
    proptest::collection::vec(proptest::sample::select(b"aAqQ*-; =/\"".to_vec()), 0..3).prop_map(|bytes| {
        let mut text: String = bytes.into_iter().map(char::from).collect();
        if text.contains('/') {
            text.push('\u{e9}');
        }
        text
    })
}

fn wild_media_type() -> impl Strategy<Value = MediaType> {
    let parameter =
        (wild_name(), proptest::collection::vec(any::<u8>(), 0..4)).prop_map(|(name, value)| Parameter { name, value });
    (wild_name(), wild_name(), proptest::collection::vec(parameter, 0..3))
        .prop_map(|(r#type, subtype, parameters)| MediaType { r#type, subtype, parameters })
}

fn check_read(media_type: &MediaType) -> Result<(), TestCaseError> {
    // MT-1.2, MT-4.2, MT-4.3, MT-3.5, MT-3.3
    for name in [&media_type.r#type, &media_type.subtype] {
        prop_assert!(is_token(name.as_bytes()) && name.as_str() != "*" && *name == name.to_ascii_lowercase());
    }
    for (index, parameter) in media_type.parameters.iter().enumerate() {
        prop_assert!(is_token(parameter.name.as_bytes()) && parameter.name == parameter.name.to_ascii_lowercase());
        prop_assert!(parameter.name != "q");
        prop_assert!(media_type.parameters.iter().take(index).all(|other| other.name != parameter.name));
        prop_assert!(parameter.value.iter().all(|&byte| is_quotable(byte)));
    }
    // MT-6.5: what the reader returns is written to a text that reads back to it.
    let written = format(media_type).map_err(fail)?;
    prop_assert_eq!(&parse(&written).map_err(fail)?, media_type);
    Ok(())
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(3000))]

    #[test]
    fn any_bytes_read_to_a_media_type_or_its_kind(bytes in proptest::collection::vec(any::<u8>(), 0..40)) {
        // MT-4, MT-8
        match parse(&bytes) {
            Ok(media_type) => check_read(&media_type)?,
            Err(error) => prop_assert_eq!(error, Error::MalformedMediaType),
        }
    }

    #[test]
    fn grammar_bytes_read_to_a_media_type_or_its_kind(text in "[ \t,;=\"\\\\a-cqQ*/.0-9\u{e9}]{0,30}") {
        // MT-4.1, MT-3: bytes of the grammar reach the deep paths of the reader.
        let bytes = text
            .chars()
            .map(|c| u8::try_from(u32::from(c)))
            .collect::<Result<Vec<u8>, _>>()
            .map_err(|error| TestCaseError::fail(error.to_string()))?;
        match parse(&bytes) {
            Ok(media_type) => check_read(&media_type)?,
            Err(error) => prop_assert_eq!(error, Error::MalformedMediaType),
        }
    }

    #[test]
    fn a_media_type_written_in_any_style_reads_back(media_type in media_type(), style in style()) {
        // MT-1.3, MT-2.2, MT-3.1 to MT-3.4, MT-3.6, MT-4.4: case, whitespace, quoting, quoted pairs and empty
        // parameters change nothing.
        prop_assert_eq!(parse(&write(&media_type, &style)).map_err(fail)?, media_type);
    }

    #[test]
    fn the_writer_writes_what_the_rules_allow_and_it_reads_back(media_type in wild_media_type()) {
        // MT-6.4, MT-6.5
        match format(&media_type) {
            Ok(written) => {
                prop_assert!(writable(&media_type));
                prop_assert_eq!(parse(&written).map_err(fail)?, lowered(&media_type));
                // MT-6.1: one SP after each semicolon and no other whitespace outside a quoted string.
                prop_assert_eq!(format(&parse(&written).map_err(fail)?).map_err(fail)?, written);
            }
            Err(error) => {
                prop_assert_eq!(error, Error::InvalidMediaType);
                prop_assert!(!writable(&media_type));
            }
        }
    }

    #[test]
    fn a_readable_media_type_is_written_and_reads_back(media_type in media_type()) {
        // MT-6.2, MT-6.3, MT-6.5
        let written = format(&media_type).map_err(fail)?;
        prop_assert_eq!(parse(&written).map_err(fail)?, media_type);
    }

    #[test]
    fn values_compare_by_the_rules(name in prop_oneof![Just("charset"), Just("CHARSET"), Just("a")],
                                   left in proptest::collection::vec(any::<u8>(), 0..4),
                                   right in proptest::collection::vec(any::<u8>(), 0..4)) {
        // MT-5.1, MT-5.2, MT-5.3
        prop_assert!(same_value(name, &left, &left));
        prop_assert_eq!(same_value(name, &left, &right), same_value(name, &right, &left));
        let expected = if name.eq_ignore_ascii_case("charset") {
            // ASCII letters differ in case by the bit 0x20 only.
            left.len() == right.len()
                && left.iter().zip(&right).all(|(&one, &other)| one == other || one.is_ascii_alphabetic() && one ^ 0x20 == other)
        } else {
            left == right
        };
        prop_assert_eq!(same_value(name, &left, &right), expected);
    }
}
