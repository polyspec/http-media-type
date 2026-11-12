// The contract cases of http-media-type run against the installed Node package (MT-1 to MT-8).
// HTTP_MEDIA_TYPE_CASES is the path of contracts/media-type.json; make test-node sets it. A text of the cases is latin1
// (MT-1.1), which the package takes and gives as a string of U+0000 to U+00FF.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as mediaTypes from '@polyspec/http-media-type';

const cases = JSON.parse(readFileSync(process.env.HTTP_MEDIA_TYPE_CASES, 'utf8'));

const plain = (mediaType) => ({
  type: mediaType.type,
  subtype: mediaType.subtype,
  parameters: [...mediaType.parameters].map((p) => ({ name: p.name, value: p.value })),
});

function check(kase, call, expected) {
  if (kase.raises !== undefined) {
    const category = kase.raises.category[0].toUpperCase() + kase.raises.category.slice(1);
    assert.throws(call, (error) =>
      error.constructor === mediaTypes[`MediaType${category}Error`] &&
      error.kind === kase.raises.kind &&
      error.status === kase.raises.status &&
      (kase.raises.message === null || error.message === kase.raises.message), kase.id);
  } else {
    assert.deepEqual(expected(call()), kase.expected, kase.id);
  }
}

test('parse', () => {
  assert.ok(cases.parse.length > 0);
  for (const kase of cases.parse) {
    check({ ...kase, expected: kase.media_type }, () => mediaTypes.parse(kase.value), plain);
  }
});

test('format', () => {
  assert.ok(cases.format.length > 0);
  for (const kase of cases.format) {
    check({ ...kase, expected: kase.text }, () => mediaTypes.format(kase.media_type), (text) => text);
  }
});

test('sameValue', () => {
  assert.ok(cases.sameValue.length > 0);
  for (const kase of cases.sameValue) {
    assert.equal(mediaTypes.sameValue(kase.name, kase.left, kase.right), kase.same, kase.id);
  }
});
