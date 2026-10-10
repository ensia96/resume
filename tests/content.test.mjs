import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { loadResume, parseSection } from '../src/lib/content.ts';
import { renderSection } from '../src/lib/markdown.ts';

const doc = (title, body = `## ${title}\n\n원문 본문입니다.\n`, metadata = '') => `---\ntitle: "${title}"\n${metadata}---\n\n${body}`;

async function fixture(run) {
  const directory = await mkdtemp(join(tmpdir(), 'resume-content-test-'));
  try { await run(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}

test('separates metadata and preserves body bytes without inventing updatedAt', () => {
  const body = '\n## 개요\n\n안녕하세요.  \n\n- 43.99%\n';
  const parsed = parseSection('1. 개요.md', `---\ntitle: "1. 개요"\ndate: 2026-10-04 11:39:54\n---\n${body}`);
  assert.equal(parsed.title, '개요');
  assert.equal(parsed.body, body);
  assert.equal(parsed.date, '2026-10-04 11:39:54');
  assert.equal(parsed.updatedAt, undefined);
  assert.equal(parsed.id, 'section-1');
});

test('validates metadata, duplicate YAML keys, calendar dates and explicit updatedAt', () => {
  assert.equal(parseSection('1. 개요.md', doc('개요', '본문', 'updatedAt: 2024-02-29T12:00:00Z\n')).updatedAt, '2024-02-29T12:00:00Z');
  for (const invalid of [
    'title: 123\n', 'title: ""\n', 'title: []\n',
    'title: 개요\ntitle: 중복\n', 'title: 개요\ndate: 2023-02-29\n',
    'title: 개요\ndate: 2026-10-04 24:00:00\n', 'title: 개요\nupdatedAt: yesterday\n',
  ]) assert.throws(() => parseSection('1. 개요.md', `---\n${invalid}---\n본문`));
  assert.throws(() => parseSection('1. 개요.md', '## 개요'));
  assert.throws(() => parseSection('1. 개요.md', doc('개요', '  ')));
});

test('reads immutable Git fixture content and records exact commit SHA', async () => {
  await fixture(async (directory) => {
    // Keep Git identity, config and hooks independent of the developer/CI checkout.
    const git = (args) => execFileSync('git', args, {
      cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        PATH: process.env.PATH,
        GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
        GIT_AUTHOR_NAME: 'Resume test', GIT_AUTHOR_EMAIL: 'resume-test@example.invalid',
        GIT_COMMITTER_NAME: 'Resume test', GIT_COMMITTER_EMAIL: 'resume-test@example.invalid',
      },
    });
    const documents = [
      ['1. 첫번째.md', doc('1. 첫번째', '## 첫번째\n\n첫 번째 원문입니다.\n', 'date: 2026-10-04 11:39:54\n')],
      ['2. 두번째.md', doc('2. 두번째', '## 두번째\n\n- 두 번째 원문입니다.\n')],
    ];
    git(['init', '--initial-branch=main', '--template=']);
    for (const [filename, raw] of documents) await writeFile(join(directory, filename), raw);
    git(['add', '--', ...documents.map(([filename]) => filename)]);
    assert.match(git(['status', '--short']), /^A /m);
    assert.equal(git(['diff']), '');
    assert.match(git(['diff', '--cached']), /첫 번째 원문입니다/);
    assert.equal(git(['log', '--oneline', '-10', '--all']), '');
    git(['commit', '-m', 'test: add content fixture']);
    const sha = git(['rev-parse', 'HEAD']).trim();
    assert.equal(git(['status', '--short']), '');

    // Git-ref input must ignore an uncommitted working-copy change.
    await writeFile(join(directory, documents[0][0]), doc('바뀐 작업 문서', '미커밋 본문'));
    const resume = await loadResume({ cwd: directory, directory: '', ref: 'main' });
    assert.deepEqual(resume.sections, documents.map(([filename, raw]) => parseSection(filename, raw)));
    assert.deepEqual(resume.source, { mode: 'git', ref: 'main', sha, dirty: false });
    assert.deepEqual(await loadResume({ cwd: directory, directory: '', ref: sha }), {
      ...resume, source: { ...resume.source, ref: sha },
    });
    const subdirectory = join(directory, 'app');
    await mkdir(subdirectory);
    assert.deepEqual(await loadResume({ cwd: subdirectory, directory: '', ref: 'main' }), resume);
    await assert.rejects(loadResume({ cwd: directory, directory: '', ref: '--help' }), /not an option/);
    await assert.rejects(loadResume({ cwd: directory, directory: '', ref: 'not-a-real-content-ref' }));
  });
});

test('accepts standalone content directory, sorts numerically and rejects gaps/duplicates', async () => {
  await fixture(async (directory) => {
    await writeFile(join(directory, '2. 두번째.md'), doc('두번째'));
    await writeFile(join(directory, '1. 첫번째.md'), doc('첫번째'));
    await writeFile(join(directory, 'README.md'), 'ignored');
    const resume = await loadResume({ directory });
    assert.deepEqual(resume.sections.map((item) => item.title), ['첫번째', '두번째']);
    assert.equal(resume.source.sha, null);
    await writeFile(join(directory, '2. 중복.md'), doc('중복'));
    await assert.rejects(loadResume({ directory }), /unique and consecutive/);
    await rm(join(directory, '2. 중복.md'));
    await rm(join(directory, '1. 첫번째.md'));
    await assert.rejects(loadResume({ directory }), /unique and consecutive/);
  });
  await fixture(async (directory) => await assert.rejects(loadResume({ directory }), /No numbered/));
});

test('renders original body, removes only duplicate title and namespaces anchors', async () => {
  const html = await renderSection({
    id: 'section-2', title: '경력',
    body: '## 경력\n\n### 어드바이저\n\n- 43.99%\n\n[이동](#어드바이저)\n\n[영역](#경력)\n\n[외부](https://example.com/a)\n\n[로컬](/guide/)\n\n[기존 base](/resume/guide/)\n\n![이미지](images/profile.png)\n\n| 기간 | 내용 |\n| --- | --- |\n| 2023 | 원문 |',
  }, '/resume/');
  assert.doesNotMatch(html, /<h2/);
  assert.match(html, /id="section-2-heading-어드바이저"/);
  assert.match(html, /href="#section-2-heading-어드바이저"/);
  assert.match(html, /href="#section-2"/);
  assert.match(html, /43\.99%/);
  assert.match(html, /href="https:\/\/example.com\/a"/);
  assert.match(html, /href="\/resume\/guide\/"/);
  assert.doesNotMatch(html, /\/resume\/resume\//);
  assert.match(html, /src="\/resume\/images\/profile.png"/);
  assert.match(html, /class="resume-entry"/);
  assert.match(html, /class="table-scroll"/);
  assert.match(html, /<th scope="col">기간<\/th>/);
  const mismatch = await renderSection({ id: 'section-1', title: '개요', body: '## 다른 제목\n\n본문' }, '/resume/');
  assert.match(mismatch, /<h2/);
});
