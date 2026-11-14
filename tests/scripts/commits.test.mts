// No tracked file names a Git commit (AGENTS.md, "Commits and changes"): a commit id says nothing to a reader without
// the repository and names nothing after a history is joined or written again, so a record states the fact. The files
// that pin by a commit or hold other hexadecimal data are left out by name: the lock files, the workflows, whose
// actions are pinned by commit, the digests of config/toolchain.json and the bytes of the contract cases.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const root = resolve(import.meta.dirname, '../..');
const LEFT_OUT = /(^|\/)(Cargo\.lock|package-lock\.json|composer\.lock|mise\.lock|aube-lock\.yaml)$|^\.github\/|^config\/toolchain\.json$|^contracts\//;
// An abbreviated or full commit id: 7 to 40 hexadecimal characters with a digit and a letter, not part of a longer word.
const COMMIT = /(?<![0-9A-Za-z/#"_.-])(?=[0-9a-f]*[0-9])(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}(?![0-9A-Za-z"_-])/g;

test('no tracked file names a Git commit', () => {
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter((file) => file !== '' && !LEFT_OUT.test(file));
  assert.ok(files.length > 0, 'git ls-files gave no file');
  const found: string[] = [];
  let read = 0;
  for (const file of files) {
    const bytes = readFileSync(join(root, file));
    if (bytes.includes(0)) continue;
    read += 1;
    bytes.toString('utf8').split('\n').forEach((line, index) => {
      // The marker of a Korean twin holds the sha256 of its English file.
      if (line.startsWith('<!-- source-sha256: ')) return;
      for (const match of line.matchAll(COMMIT)) found.push(`${file}:${index + 1}: ${match[0]}`);
    });
  }
  assert.ok(read > 0, 'no file was read');
  assert.deepEqual(found, [], 'tracked files name Git commits');
});
