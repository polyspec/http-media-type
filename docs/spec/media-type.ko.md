<!-- doc-id: spec-media-type -->
<!-- source-sha256: dcfdf9e2576fa98765fe24f172725dc9bddbb09b3b74435bf831343843c74e80 -->
# http-media-type 명세

이 라이브러리는 HTTP의 media type(RFC 9110 8.3.1절)과 그것을 쓰는 문법인 token(5.6.2절),
quoted string(5.6.4절), parameter(5.6.6절)를 읽고 쓴다. 이 라이브러리는 한 parameter의 값들을
비교하고, 같은 문법을 쓰는 다른 field의 reader, 예를 들어 `Accept`의 media range를 읽는 reader에
token, quoted string, parameter의 reader를 준다(MT-7). 이 라이브러리는 message에서 field를 꺼내지 않고 상태를 정하지 않는다.
그 결정은 호출자의 것이다. 아래의 모든 규칙은 Rust 코어 `packages/rust`에 있다. 바인딩은 type을 변환하고 규칙을
갖지 않는다.

표준은 RFC 9110(HTTP Semantics)이고, media type registry의 규칙에는 RFC 6838(Media Type Specifications and Registration
Procedures)을 쓰며, 규칙마다 자기가 따르는 절을 밝힌다. 규칙은 목록 항목 `**MT-n**`이다. 규칙의
번호 붙은 statement는 `MT-n.m`이고, 시험은 자기가 검사하는 statement를 밝힌다.

## Text

- **MT-1** 입력 text와 출력 text.
  1. MT-1.1 media type 값과 parameter 값은 byte이며, 한 byte가 한 문자다(인터페이스 계약의
     `latin1`). byte 0x80부터 0xFF까지는 `obs-text`다(RFC 9110 5.5절).
  2. MT-1.2 type, subtype, parameter 이름은 token이므로 ASCII다. reader는 그것들을 소문자로 돌려준다.
  3. MT-1.3 media type 값에서 SP와 HTAB이 아닌 첫 byte의 앞과 마지막 byte의 뒤에 있는 SP와 HTAB은 값의 일부가 아니며
     (RFC 9110 5.5절) 무시된다. 다른 어떤 byte도 whitespace가 아니다. 값의 둘레에 line feed, NUL, byte 0xA0이
     있으면 실패한다.

- **MT-2** token과 대소문자.
  1. MT-2.1 token은 하나 이상의 `tchar`다(RFC 9110 5.6.2절). `tchar`는 ASCII 글자와 숫자, 그리고
     ``!#$%&'*+-.^_`|~``다.
  2. MT-2.2 type, subtype, parameter 이름은 ASCII 대소문자를 구별하지 않고 비교한다(RFC 9110 8.3.1절과
     5.6.6절).

- **MT-3** parameter(RFC 9110 5.6.6절).
  1. MT-3.1 `parameters = *( OWS ";" OWS [ parameter ] )`, `parameter = parameter-name "=" parameter-value`,
     `parameter-value = ( token / quoted-string )`. `=`의 앞과 뒤에는 whitespace가 오지 않는다.
  2. MT-3.2 parameter는 비어 있을 수 있다. 빈 parameter는 `;` 뒤에 또 `;`가 오거나 parameter들의 끝이 오는 것이다. parameter들의 끝은
     값의 끝이거나, list field의 reader에서는 list 원소를 끝내는 `,`다(RFC 9110 5.6.6절과
     부록 B.3). 빈 parameter와 `;` 둘레의 whitespace는 아무것도 내지 않는다.
  3. MT-3.3 quoted string은 `DQUOTE *( qdtext / quoted-pair ) DQUOTE`이고, `qdtext = HTAB / SP / %x21 / %x23-5B /
     %x5D-7E / obs-text`, `quoted-pair = "\" ( HTAB / SP / VCHAR / obs-text )`다(RFC 9110 5.6.4절).
     닫는 `"`가 없는 quoted string은 실패한다. quoted string은 text의 끝에서 끝나지 않는다.
     HTAB이 아닌 제어 byte(0x00부터 0x08까지, 0x0A부터 0x1F까지, 0x7F)는 quoted string 안에 단독으로도, backslash 뒤에도 올 수 없다. 그래서 어떤
     parameter 값도 그런 byte를 갖지 않는다.
  4. MT-3.4 parameter의 값은 따옴표를 없애고 각 quoted pair를 그 backslash 뒤의 byte로 바꾼
     byte다. 그래서 따옴표로 싼 값은 따옴표 없는 같은 값과 같다(RFC 9110 5.6.4절과 5.6.6절).
  5. MT-3.5 한 media type에서 MT-2.2로 비교해 이름이 같은 두 parameter는 실패한다. 두 번 주어진 parameter는
     media type의 오류이고(RFC 6838 4.3절) 어느 쪽을 쓸지 정하는 규칙이 없기 때문이다.
  6. MT-3.6 parameter는 값이 그것들을 준 순서를 유지한다.

## 읽기

- **MT-4** `parse(value)`는 media type을 읽는다(RFC 9110 8.3.1절).
  1. MT-4.1 MT-1.3을 적용한 뒤 `media-type = type "/" subtype parameters`다. 값에 그 밖의 것이 있으면 실패하며,
     media type 뒤의 `,`도 실패한다. media type 값은 하나의 media type이지 list가 아니다.
  2. MT-4.2 type이나 subtype이 `*`이면 실패한다. `*`는 media range에서 임의의 type이나 subtype을 뜻하고(RFC 9110
     12.5.1절) media type은 range가 아니기 때문이다. type이나 subtype은 그 한 byte뿐일 때에만 `*`다.
     `*`를 포함하는 다른 token은 type의 이름이다.
  3. MT-4.3 MT-2.2로 비교해 이름이 `q`인 parameter는 실패한다. media type registry가 그 이름을 허용하지 않기 때문이다
     (RFC 9110 12.5.1절의 note).
  4. MT-4.4 결과는 type, subtype, parameter들이다(MT-1.2, MT-3.4, MT-3.6). 실패는 kind
     `malformed_media_type`이다(MT-8).

## 값 비교

- **MT-5** `same_value(name, left, right)`는 parameter `name`의 두 값이 같은지를 알려 준다.
  1. MT-5.1 두 값은 MT-3.4를 적용한 뒤의 byte가 같을 때 같다. 따옴표로 쌌는지는 상관이 없다.
  2. MT-5.2 이름을 MT-2.2로 비교해 `charset`인 parameter의 값은 ASCII 대소문자를 구별하지 않고 비교한다.
     charset은 대소문자를 구별하지 않는 token이기 때문이다(RFC 9110 8.3.2절). 0x7F보다 큰 byte의 대소문자는
     ASCII 대소문자가 아니므로 구별한다.
  3. MT-5.3 이 라이브러리는 다른 어떤 parameter의 뜻도 알지 못하므로 다른 모든 값의 byte를 정확히 비교한다
     (RFC 9110 5.6.6절: 값의 대소문자를 구별하는지는 그 parameter에 달려 있다).
  4. MT-5.4 이 함수는 두 값을 판정한다. 이 함수는 이름도 값도 검사하지 않으며, 그것들은 reader(MT-4)나
     writer(MT-6)가 검사했다. 어떤 대소문자로 쓰든 `charset`이 아닌 이름은 MT-5.3의 정확한 비교를 낸다.

## 쓰기

- **MT-6** `format(media_type)`은 media type을 쓴다.
  1. MT-6.1 text는 type, `/`, subtype이고, 그 뒤에 각 parameter마다 순서대로(MT-3.6) `; `, 그 이름, `=`,
     그 값이 온다. 다른 whitespace는 쓰지 않는다. `;` 뒤의 SP 하나는 RFC 9110의 예(8.3절과
     8.3.1절)를 따른다. `;`만 써도 똑같이 읽힌다(MT-3.1).
  2. MT-6.2 type, subtype, parameter 이름은 소문자로 쓴다. 그것들은 대소문자를 구별하지 않고
     비교하므로(MT-2.2), 쓰는 형태를 하나로 두면 같은 이름이 같은 byte가 되고, field의 digest가 그것에 의존한다.
  3. MT-6.3 token인 값(MT-2.1)은 그대로 쓴다. 빈 값을 포함한 다른 모든 값은
     quoted string(MT-3.3)으로 쓰며, 각 `"`와 `\` 앞에만 backslash를 두고 다른 byte 앞에는 두지 않는다.
     sender는 그 두 byte를 인용해야 하는 곳에서만 quoted pair를 만들기 때문이다(RFC 9110 5.6.4절).
     값의 byte는 대소문자를 포함해 그대로 쓴다(MT-5.3). `charset` 값도 다시 쓰지
     않는다. 그 값은 어떤 대소문자로 쓰든 같은 charset을 가리키기 때문이다(MT-5.2).
  4. MT-6.4 쓰기는 다음의 경우에 kind `invalid_media_type`(MT-8)으로 실패한다. type이나 subtype이 token이 아니거나 `*`일 때
     (MT-2.1, MT-4.2), parameter 이름이 token이 아니거나 어떤 대소문자로든 `q`일 때(MT-4.3), 두 이름이
     MT-2.2로 같을 때(MT-3.5), 값이 quoted string이 담을 수 없는 byte를 가질 때(MT-3.3). 그때는 아무것도 쓰지 않는다.
     writer는 reader가 거부하는 media type을 쓰지 않는다.
  5. MT-6.5 writer가 쓰는 모든 media type의 text는 다시 읽으면(MT-4) 이름이 소문자인(MT-6.2)
     그 media type이 되고, reader가 돌려주는 모든 media type은 다시 읽으면 그 media type이 되는 text로 쓰인다.

## 다른 reader를 위한 문법

- **MT-7** Rust crate는 MT-1부터 MT-3까지의 문법을 모듈 `grammar`로 공개한다. 그 모듈은 값 위의 byte cursor와
  byte class를 준다. cursor는 whitespace, token, quoted string, parameter를 읽고, byte class는 `tchar`, `OWS`, 그리고
  quoted string이 담을 수 있는 byte다.
  1. MT-7.1 문법이 token, quoted string, parameter를 쓰는 다른 field의 reader, 예를 들어 `Accept`의 media range를
     읽는 reader는 이 모듈을 통해 그것들을 읽는다. 그래서 MT-2와 MT-3의 규칙은 구현이 하나다. 이 모듈은
     Rust API의 일부이고 바인딩 인터페이스의 일부가 아니다. 다른 언어의 프로그램은 `parse`(MT-4)로
     media type을 읽는다.
  2. MT-7.2 parameter reader는 parameter들을 끝내는 한 parameter의 이름을 받고, 그 이름을 MT-2.2로 비교한다.
     그 이름을 만나면 parameter reader는 그 `=` 뒤에서 멈추고 값을 읽지 않은 채 호출자에게 남기며, 호출자는 자기 규칙으로 그 값을 읽는다.
     media type의 reader는 이름 `q`를 주고, parameter reader가 멈추면 실패한다(MT-4.3). parameter reader는 `,`처럼
     parameter를 시작하지 않는 것의 앞에서도 멈춘다. parameter들 뒤에 무엇이 올 수 있는지는 호출자의
     문법이다.
  3. MT-7.3 이 모듈의 문법 실패는 값 `Malformed`이며, 이 값에는 kind가 없다. 각 reader가 그것을
     자기 field의 kind로 바꾼다(media type은 MT-4.4).

## 오류와 런타임

- **MT-8** 모든 실패는 kind를 가진 오류다. 어떤 함수도 실패를 대신하는 값을 돌려주지 않는다.

  | Kind | Status | Category | When |
  |---|---|---|---|
  | `malformed_media_type` | 없음 | value | MT-4, 문법을 따르지 않는 값 |
  | `invalid_media_type` | 없음 | value | MT-6.4, 쓸 수 없는 media type |

  1. MT-8.1 어떤 실패도 HTTP 상태를 갖지 않는다. media type 값은 요청이나 응답의 field에서 오거나
     호출자에게서 오며, 어느 쪽인지 아는 호출자가 상태를 정한다.
  2. MT-8.2 오류의 message는 그 kind의 고정된 문장이며 입력을 밝히지 않는다.

- **MT-9** 모든 함수는 순수하다. I/O가 없고, 호출 사이에 상태가 없고, 기다리지 않는다(인터페이스 계약의 `wait: none`).
  1. MT-9.1 모든 type은 `Send + Sync`이고 정렬은 최대 16 byte가 필요하다.
  2. MT-9.2 여기서는 입력 크기를 제한하지 않는다. 이 라이브러리는 주어진 모든 byte를 읽고 쓰며, 걸리는 시간은
     값의 길이에 선형이다. 다만 각 parameter 이름은 그 앞의 이름들과 비교된다(MT-3.5). field의 크기는
     host가 제한한다.

## 무시되는 입력

각 행은 어떤 결과도 바꾸지 않는 입력이다. 마지막 열에 적힌 case가 그것을 보여 준다.

| Rule | Bytes ignored | Basis | Case |
|---|---|---|---|
| MT-1.3 | media type 값 둘레의 SP와 HTAB | RFC 9110, 5.5 | `parse/white_space_around_the_value_is_ignored` |
| MT-3.2 | 빈 parameter와 `;` 둘레의 whitespace | RFC 9110, 5.6.6 and B.3 | `parse/a_trailing_semicolon_is_an_empty_parameter`, `parse/empty_parameters_and_the_white_space_around_semicolons_give_nothing` |
| MT-3.4 | 따옴표로 싼 값의 따옴표와 quoted pair의 backslash | RFC 9110, 5.6.4 and 5.6.6 | `parse/a_quoted_value_unquotes_its_pairs`, `parse/a_quoted_token_reads_as_the_token` |
| MT-2.2 | type, subtype, parameter 이름의 대소문자 | RFC 9110, 8.3.1 and 5.6.6 | `parse/a_media_type_gives_its_type_subtype_and_parameters`, `format/names_are_written_in_lower_case` |
| MT-5.2 | `charset` 값의 대소문자 | RFC 9110, 8.3.2 | `sameValue/charset_values_compare_without_case` |

## 표준이 열어 둔 선택

다음 규칙은 RFC 9110이 정하지 않은 것을 정하며, 각각의 이유는 그 규칙이 적는다. MT-3.5(두 번 주어진 parameter는
실패한다), MT-5.2와 MT-5.3(`charset`만 대소문자 규칙이 알려져 있다), MT-6.1(`;` 뒤에 SP 하나), MT-6.2(이름은
소문자로 쓴다), MT-6.3(값은 자기 byte와 대소문자를 유지한다).
