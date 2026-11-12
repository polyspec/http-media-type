//! Runs every case of `contracts/media-type.json` and checks that the cases and the tests cite the rules of
//! `docs/spec/media-type.md`.
//!
//! A text of the cases is bytes, one character per byte (MT-1.1): a character above U+00FF in a case is a defect of
//! the case. A failure is the object `raises` (kind, status, category, message).

use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};

use polyspec_http_media_type::{format, parse, same_value, Error, MediaType, Parameter};
use serde_json::{json, Value};

const GROUPS: [&str; 3] = ["parse", "format", "sameValue"];

fn root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../..")
}

fn read_text(path: &Path) -> Result<String, String> {
    fs::read_to_string(path).map_err(|error| format!("{}: {error}", path.display()))
}

fn cases() -> Result<Value, String> {
    let path = root().join("contracts/media-type.json");
    serde_json::from_str(&read_text(&path)?).map_err(|error| format!("{}: {error}", path.display()))
}

fn spec() -> Result<String, String> {
    read_text(&root().join("docs/spec/media-type.md"))
}

fn group<'a>(cases: &'a Value, name: &str) -> Result<&'a Vec<Value>, String> {
    cases.get(name).and_then(Value::as_array).ok_or(format!("no group {name}"))
}

fn field<'a>(value: &'a Value, name: &str) -> Result<&'a Value, String> {
    value.get(name).ok_or(format!("no field {name} in {value}"))
}

fn string<'a>(value: &'a Value, name: &str) -> Result<&'a str, String> {
    field(value, name)?.as_str().ok_or(format!("{name} is no string in {value}"))
}

fn array<'a>(value: &'a Value, name: &str) -> Result<&'a Vec<Value>, String> {
    field(value, name)?.as_array().ok_or(format!("{name} is no array in {value}"))
}

fn latin1(value: &Value) -> Result<Vec<u8>, String> {
    let text = value.as_str().ok_or(format!("{value} is no string"))?;
    text.chars().map(|c| u8::try_from(u32::from(c)).map_err(|error| format!("{c:?} in {text:?}: {error}"))).collect()
}

fn text(bytes: &[u8]) -> String {
    bytes.iter().map(|&byte| char::from(byte)).collect()
}

/// The category of a kind (MT-8).
fn category(error: Error) -> &'static str {
    match error {
        Error::MalformedMediaType | Error::InvalidMediaType => "value",
    }
}

fn raises(error: Error) -> Value {
    json!({"kind": error.kind(), "status": error.status(), "category": category(error), "message": null})
}

fn media_type_of(media_type: &MediaType) -> Value {
    let parameters: Vec<Value> =
        media_type.parameters.iter().map(|parameter| json!([parameter.name, text(&parameter.value)])).collect();
    json!({"type": media_type.r#type, "subtype": media_type.subtype, "parameters": parameters})
}

/// The media type of a case. Its texts are latin1 too, so a name of the case may hold any byte that `format` must
/// refuse.
fn media_type_from(value: &Value) -> Result<MediaType, String> {
    let parameters = array(value, "parameters")?
        .iter()
        .map(|pair| {
            let name = pair.get(0).ok_or(format!("no name in {pair}"))?;
            let value = pair.get(1).ok_or(format!("no value in {pair}"))?;
            Ok(Parameter { name: text(&latin1(name)?), value: latin1(value)? })
        })
        .collect::<Result<Vec<_>, String>>()?;
    Ok(MediaType {
        r#type: text(&latin1(field(value, "type")?)?),
        subtype: text(&latin1(field(value, "subtype")?)?),
        parameters,
    })
}

/// Compares the one result key of a case, `raises` or `expected_key`, with the outcome.
fn compare<T>(
    failures: &mut Vec<String>,
    case: &Value,
    expected_key: &str,
    outcome: Result<T, Error>,
    to_json: impl Fn(&T) -> Value,
) -> Result<(), String> {
    let id = string(case, "id")?;
    let (key, actual) = match &outcome {
        Ok(value) => (expected_key, to_json(value)),
        Err(error) => ("raises", raises(*error)),
    };
    for other in [expected_key, "raises"] {
        if other != key && case.get(other).is_some() {
            failures.push(format!("{id}: expected {other} {}, got {key} {actual}", field(case, other)?));
            return Ok(());
        }
    }
    let expected = field(case, key)?;
    if *expected != actual {
        failures.push(format!("{id}: {key}: expected {expected}, got {actual}"));
    }
    Ok(())
}

#[test]
fn parse_cases() -> Result<(), String> {
    let cases = cases()?;
    let mut failures = Vec::new();
    for case in group(&cases, "parse")? {
        let outcome = parse(&latin1(field(case, "value")?)?);
        compare(&mut failures, case, "mediaType", outcome, media_type_of)?;
    }
    assert!(failures.is_empty(), "{}", failures.join("\n"));
    Ok(())
}

#[test]
fn format_cases() -> Result<(), String> {
    let cases = cases()?;
    let mut failures = Vec::new();
    for case in group(&cases, "format")? {
        let media_type = media_type_from(field(case, "mediaType")?)?;
        let outcome = format(&media_type);
        compare(&mut failures, case, "text", outcome.clone(), |bytes| Value::String(text(bytes)))?;
        // MT-6.5: what is written reads back to the media type with its names in lowercase.
        if let Ok(bytes) = outcome {
            let mut lowered = media_type.clone();
            lowered.r#type = lowered.r#type.to_ascii_lowercase();
            lowered.subtype = lowered.subtype.to_ascii_lowercase();
            for parameter in &mut lowered.parameters {
                parameter.name = parameter.name.to_ascii_lowercase();
            }
            if parse(&bytes) != Ok(lowered) {
                failures.push(format!("{}: {} does not read back", string(case, "id")?, text(&bytes)));
            }
        }
    }
    assert!(failures.is_empty(), "{}", failures.join("\n"));
    Ok(())
}

#[test]
fn same_value_cases() -> Result<(), String> {
    let cases = cases()?;
    let mut failures = Vec::new();
    for case in group(&cases, "sameValue")? {
        let name = string(case, "name")?;
        let left = latin1(field(case, "left")?)?;
        let right = latin1(field(case, "right")?)?;
        let expected = field(case, "same")?.as_bool().ok_or("same is no bool")?;
        // MT-5: the comparison is symmetric.
        for (one, other) in [(&left, &right), (&right, &left)] {
            if same_value(name, one, other) != expected {
                failures.push(format!("{}: expected {expected}", string(case, "id")?));
            }
        }
    }
    assert!(failures.is_empty(), "{}", failures.join("\n"));
    Ok(())
}

/// The rule and statement ids that the spec defines: `**MT-n**` and the numbered `MT-n.m`.
fn defined_ids() -> Result<BTreeSet<String>, String> {
    let mut ids = BTreeSet::new();
    for line in spec()?.lines() {
        let line = line.trim_start();
        if let Some(rest) = line.strip_prefix("- **") {
            if let Some((id, _)) = rest.split_once("**") {
                ids.insert(id.to_owned());
            }
        } else if let Some((number, rest)) = line.split_once(". ") {
            if !number.is_empty() && number.chars().all(|c| c.is_ascii_digit()) && rest.starts_with("MT-") {
                if let Some((id, _)) = rest.split_once(' ') {
                    ids.insert(id.to_owned());
                }
            }
        }
    }
    Ok(ids)
}

/// Every `MT-n` or `MT-n.m` in a text.
fn cited_ids(text: &str) -> BTreeSet<String> {
    let mut ids = BTreeSet::new();
    let bytes = text.as_bytes();
    let mut start = 0;
    while let Some(offset) = text.get(start..).and_then(|rest| rest.find("MT-")) {
        let begin = start + offset;
        let mut end = begin + 3;
        let mut seen_point = false;
        while let Some(&byte) = bytes.get(end) {
            let next_is_digit = bytes.get(end + 1).is_some_and(u8::is_ascii_digit);
            if byte.is_ascii_digit() || (byte == b'.' && !seen_point && next_is_digit) {
                seen_point |= byte == b'.';
                end += 1;
            } else {
                break;
            }
        }
        if end > begin + 3 {
            if let Some(id) = text.get(begin..end) {
                ids.insert(id.to_owned());
            }
        }
        start = end;
    }
    ids
}

#[test]
fn cases_cite_the_rules_of_the_spec() -> Result<(), String> {
    let defined = defined_ids()?;
    let cases = cases()?;
    let mut failures = Vec::new();
    let names: Vec<&String> = cases.as_object().ok_or("the cases are no object")?.keys().collect();
    if names.iter().any(|name| !GROUPS.contains(&name.as_str())) || names.len() != GROUPS.len() {
        failures.push(format!("the groups are {names:?}, not {GROUPS:?}"));
    }
    let mut ids = BTreeSet::new();
    for name in GROUPS {
        for case in group(&cases, name)? {
            let id = string(case, "id")?;
            if !ids.insert(format!("{name}/{id}")) {
                failures.push(format!("{name}/{id}: the id is not unique"));
            }
            let rules = array(case, "rules")?;
            if rules.is_empty() {
                failures.push(format!("{name}/{id}: no rule"));
            }
            for rule in rules {
                let rule = rule.as_str().ok_or(format!("{name}/{id}: a rule is no string"))?;
                if !defined.contains(rule) {
                    failures.push(format!("{name}/{id}: {rule} is not in the spec"));
                }
            }
        }
    }
    // The table of ignored inputs names its cases as `<group>/<id>`.
    let spec = spec()?;
    let table = spec.split("## Inputs ignored").nth(1).and_then(|rest| rest.split("\n## ").next()).ok_or("no table")?;
    for cell in table.split('`').skip(1).step_by(2).filter(|cell| cell.contains('/') && cell.contains('_')) {
        if !ids.contains(cell) {
            failures.push(format!("the table of ignored inputs names {cell}, which is no case"));
        }
    }
    assert!(failures.is_empty(), "{}", failures.join("\n"));
    Ok(())
}

#[test]
fn every_statement_is_cited() -> Result<(), String> {
    let defined = defined_ids()?;
    let mut cited = cited_ids(&read_text(&root().join("contracts/media-type.json"))?);
    for folder in ["packages/rust/src", "packages/rust/tests"] {
        for entry in fs::read_dir(root().join(folder)).map_err(|error| error.to_string())? {
            let path = entry.map_err(|error| error.to_string())?.path();
            if path.extension().is_some_and(|extension| extension == "rs") {
                cited.extend(cited_ids(&read_text(&path)?));
            }
        }
    }
    let statements = defined.iter().filter(|id| id.contains('.'));
    let missing: Vec<&String> = statements.filter(|id| !cited.contains(*id)).collect();
    assert!(missing.is_empty(), "no case or test cites {missing:?}");
    let unknown: Vec<&String> = cited.iter().filter(|id| !defined.contains(*id)).collect();
    assert!(unknown.is_empty(), "the cases or tests cite {unknown:?}, which the spec does not define");
    Ok(())
}
