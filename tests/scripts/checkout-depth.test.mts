// The job check of ci.yml runs make ci-check NAME=core, whose rehearsal of the Go module runs git prune with the parents of
// HEAD: a shallow checkout has no parent commit, and the rehearsal fails with "Failed to traverse parents of commit". So the
// checkout of that job fetches the full history (fetch-depth: 0). The test reads ci.yml as text: the checkout step of the job
// check is followed by its with block, and that block holds fetch-depth: 0 before the next step.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const root = resolve(import.meta.dirname, '../..');
const lines = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8').split('\n');

test('the checkout of the job check fetches the full history', () => {
  const start = lines.findIndex((line) => /^ {2}check:$/.test(line));
  assert.notEqual(start, -1, 'ci.yml has no job check');
  const checkout = lines.findIndex((line, index) => index > start && /uses: actions\/checkout@/.test(line));
  assert.notEqual(checkout, -1, 'the job check has no checkout step');
  const step = lines.slice(checkout + 1).findIndex((line) => /^ {6}- /.test(line));
  const block = lines.slice(checkout + 1, step === -1 ? undefined : checkout + 1 + step);
  assert.ok(block.some((line) => /^ +fetch-depth: 0$/.test(line)), 'the checkout of the job check does not set fetch-depth: 0');
});
