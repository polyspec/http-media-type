<!-- doc-id: spec-media-type -->
# http-media-type specification

This library reads and writes the media types of HTTP (RFC 9110, section 8.3.1) and the grammar that they are written
in: tokens (section 5.6.2), quoted strings (section 5.6.4) and parameters (section 5.6.6). It compares the values of a
parameter, and it gives the readers of other fields that use the same grammar, such as a media range of `Accept`, the
readers of tokens, quoted strings and parameters (MT-7). It takes no field from a message and decides no status: the
caller owns those decisions. Every rule below is in the Rust core `packages/rust`; a binding converts types and holds
no rule.

The standard is RFC 9110 (HTTP Semantics), with RFC 6838 (Media Type Specifications and Registration Procedures) for
the rules of the media type registry, and the sections that each rule names. A rule is a list item `**MT-n**`; its
numbered statements are `MT-n.m`, and a test names the statements it checks.

## Text

- **MT-1** Input and output text.
  1. MT-1.1 A media type value and a parameter value are bytes, one character per byte (`latin1` of the interface
     contract). Bytes 0x80 to 0xFF are `obs-text` (RFC 9110, section 5.5).
  2. MT-1.2 A type, a subtype and a parameter name are tokens and so ASCII; the reader returns them in lowercase.
  3. MT-1.3 SP and HTAB before the first and after the last other byte of a media type value are not part of the value
     (RFC 9110, section 5.5) and are ignored. No other byte is whitespace: a line feed, a NUL or the byte 0xA0 around a
     value fails.

- **MT-2** Tokens and case.
  1. MT-2.1 A token is one or more `tchar` (RFC 9110, section 5.6.2): ASCII letters and digits and
     ``!#$%&'*+-.^_`|~``.
  2. MT-2.2 Types, subtypes and parameter names compare without regard to ASCII case (RFC 9110, sections 8.3.1 and
     5.6.6).

- **MT-3** Parameters (RFC 9110, section 5.6.6).
  1. MT-3.1 `parameters = *( OWS ";" OWS [ parameter ] )`, `parameter = parameter-name "=" parameter-value` and
     `parameter-value = ( token / quoted-string )`. No whitespace stands before or after `=`.
  2. MT-3.2 A parameter may be empty: `;` followed by another `;` or by the end of the parameters, which is the end of
     the value or, for a reader of a list field, the `,` that ends a list element (RFC 9110, section 5.6.6 and
     appendix B.3). An empty parameter and the whitespace around `;` give nothing.
  3. MT-3.3 A quoted string is `DQUOTE *( qdtext / quoted-pair ) DQUOTE` with `qdtext = HTAB / SP / %x21 / %x23-5B /
     %x5D-7E / obs-text` and `quoted-pair = "\" ( HTAB / SP / VCHAR / obs-text )` (RFC 9110, section 5.6.4). A
     quoted string without its closing `"` fails; it never ends at the end of the text. A control byte other than
     HTAB (0x00 to 0x08, 0x0A to 0x1F, 0x7F) can stand in a quoted string neither alone nor after a backslash, so no
     parameter value holds one.
  4. MT-3.4 The value of a parameter is its bytes with the quotes removed and each quoted pair replaced by the byte
     after its backslash; so a quoted value equals the same value unquoted (RFC 9110, sections 5.6.4 and 5.6.6).
  5. MT-3.5 Two parameters of one media type with the same name, compared by MT-2.2, fail, because a parameter given
     twice is an error of the media type (RFC 6838, section 4.3) and no rule says which one counts.
  6. MT-3.6 Parameters keep the order in which the value gives them.

## Reading

- **MT-4** `parse(value)` reads a media type (RFC 9110, section 8.3.1).
  1. MT-4.1 `media-type = type "/" subtype parameters`, after MT-1.3; anything else in the value fails, a `,` after
     the media type included: a media type value is one media type, not a list.
  2. MT-4.2 A type or subtype `*` fails, because `*` means any type or subtype in a media range (RFC 9110, section
     12.5.1) and a media type is no range. A type or subtype is `*` only when it is that one byte; another token that
     holds `*` names a type.
  3. MT-4.3 A parameter named `q`, compared by MT-2.2, fails, because the media type registry disallows that name
     (RFC 9110, section 12.5.1, note).
  4. MT-4.4 The result is the type, the subtype and the parameters (MT-1.2, MT-3.4, MT-3.6). A failure is kind
     `malformed_media_type` (MT-8).

## Comparing values

- **MT-5** `same_value(name, left, right)` tells whether two values of the parameter `name` are equal.
  1. MT-5.1 Two values are equal when their bytes, after MT-3.4, are equal: quoting does not matter.
  2. MT-5.2 The values of the parameter `charset`, its name compared by MT-2.2, compare without regard to ASCII case,
     because a charset is a case-insensitive token (RFC 9110, section 8.3.2). The case of a byte above 0x7F is not
     ASCII case and counts.
  3. MT-5.3 The library knows the meaning of no other parameter and compares the bytes of every other value exactly
     (RFC 9110, section 5.6.6: whether the case of a value counts depends on its parameter).
  4. MT-5.4 The function judges two values; it checks neither the name nor the values, which a reader (MT-4) or a
     writer (MT-6) has checked. A name other than `charset` in any case gives the exact comparison of MT-5.3.

## Writing

- **MT-6** `format(media_type)` writes a media type.
  1. MT-6.1 The text is the type, `/`, the subtype and, for each parameter in order (MT-3.6), `; `, its name, `=` and
     its value. No other whitespace is written. The one SP after `;` follows the examples of RFC 9110 (sections 8.3 and
     8.3.1); `;` alone reads the same (MT-3.1).
  2. MT-6.2 The type, the subtype and the parameter names are written in lowercase. They compare without regard to
     case (MT-2.2), so one written form gives equal names equal bytes, which a digest of a field relies on.
  3. MT-6.3 A value that is a token (MT-2.1) is written as it is. Every other value, the empty value included, is
     written as a quoted string (MT-3.3) with a backslash before each `"` and `\` and before no other byte, because a
     sender generates a quoted pair only where it is needed to quote those two bytes (RFC 9110, section 5.6.4). The
     bytes of a value are written as they are, their case included (MT-5.3); a `charset` value is not rewritten
     either, since any case of it names the same charset (MT-5.2).
  4. MT-6.4 Writing fails with kind `invalid_media_type` (MT-8) when the type or the subtype is not a token or is `*`
     (MT-2.1, MT-4.2), when a parameter name is not a token or is `q` in any case (MT-4.3), when two names are equal by
     MT-2.2 (MT-3.5), or when a value holds a byte that a quoted string cannot carry (MT-3.3). Nothing is written then:
     the writer writes no media type that the reader refuses.
  5. MT-6.5 The text of every media type that the writer writes reads back (MT-4) to that media type with its names in
     lowercase (MT-6.2), and every media type that the reader returns is written to a text that reads back to it.

## Grammar for other readers

- **MT-7** The Rust crate makes the grammar of MT-1 to MT-3 public in its module `grammar`: a byte cursor over a value
  that reads whitespace, tokens, quoted strings and parameters, and the byte classes `tchar`, `OWS` and the bytes that a
  quoted string can carry.
  1. MT-7.1 A reader of another field whose grammar uses tokens, quoted strings or parameters, such as a media range
     of `Accept`, reads them through this module, so that the rules of MT-2 and MT-3 have one implementation. The module
     is part of the Rust API and not of the binding interface: a program of another language reads a media type with
     `parse` (MT-4).
  2. MT-7.2 The parameter reader takes the name of one parameter that ends the parameters, compared by MT-2.2. On that
     name it stops after its `=` and leaves the value unread for the caller, which reads it by its own rule. The reader
     of a media type gives the name `q` and fails when it stops (MT-4.3). The parameter reader also stops before
     anything that does not start a parameter, such as a `,`; what may follow the parameters is the grammar of the
     caller.
  3. MT-7.3 A grammar failure of the module is the value `Malformed`, which has no kind: each reader turns it into the
     kind of its own field (MT-4.4 for a media type).

## Errors and runtime

- **MT-8** Every failure is an error with a kind; no function returns a placeholder value for a failure.

  | Kind | Status | Category | When |
  |---|---|---|---|
  | `malformed_media_type` | none | value | MT-4, a value that does not follow the grammar |
  | `invalid_media_type` | none | value | MT-6.4, a media type that cannot be written |

  1. MT-8.1 No failure carries an HTTP status: a media type value comes from a field of a request or a response, or
     from the caller, and the caller that knows which decides the status.
  2. MT-8.2 The message of an error is the fixed sentence of its kind and names no input.

- **MT-9** Every function is pure: no I/O, no state between calls, no wait (`wait: none` of the interface contract).
  1. MT-9.1 Every type is `Send + Sync` and needs at most 16 bytes of alignment.
  2. MT-9.2 No input size is limited here: the library reads and writes every byte that it is given, in time linear in
     the length of the value, except that each parameter name is compared with the names before it (MT-3.5). The host
     bounds the size of a field.

## Inputs ignored

Each row is an input that changes no result; the case named in the last column shows it.

| Rule | Bytes ignored | Basis | Case |
|---|---|---|---|
| MT-1.3 | SP and HTAB around a media type value | RFC 9110, 5.5 | `parse/white_space_around_the_value_is_ignored` |
| MT-3.2 | empty parameters and the whitespace around `;` | RFC 9110, 5.6.6 and B.3 | `parse/a_trailing_semicolon_is_an_empty_parameter`, `parse/empty_parameters_and_the_white_space_around_semicolons_give_nothing` |
| MT-3.4 | the quotes of a quoted value and the backslash of a quoted pair | RFC 9110, 5.6.4 and 5.6.6 | `parse/a_quoted_value_unquotes_its_pairs`, `parse/a_quoted_token_reads_as_the_token` |
| MT-2.2 | the case of a type, a subtype and a parameter name | RFC 9110, 8.3.1 and 5.6.6 | `parse/a_media_type_gives_its_type_subtype_and_parameters`, `format/names_are_written_in_lower_case` |
| MT-5.2 | the case of a `charset` value | RFC 9110, 8.3.2 | `sameValue/charset_values_compare_without_case` |

## Choices that the standard leaves open

These rules decide what RFC 9110 does not, each for the reason that its rule states: MT-3.5 (a parameter given twice
fails), MT-5.2 and MT-5.3 (only `charset` has a known case rule), MT-6.1 (one SP after `;`), MT-6.2 (names are written
in lowercase) and MT-6.3 (a value keeps its bytes and case).
