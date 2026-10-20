import assert from "node:assert/strict";
import test from "node:test";
import {
  parseSection,
  sortAndValidateSections,
} from "../src/lib/resume-content.ts";

function document(title: string, body = `## ${title}\n\n본문`, date?: string) {
  return `---\ntitle: "${title}"${date ? `\ndate: ${date}` : ""}\n---\n\n${body}\n`;
}

test("parses the existing filename and frontmatter contract", () => {
  const section = parseSection(
    "2. 경력.md",
    document("2. 경력", "## 경력\n\n내용", "2026-10-17 15:57:41"),
  );
  assert.deepEqual(section, {
    filename: "2. 경력.md",
    order: 2,
    id: "section-2",
    title: "경력",
    body: "\n## 경력\n\n내용\n",
    date: "2026-10-17 15:57:41",
  });
});

test("sorts sections and requires consecutive unique numbers", () => {
  const first = parseSection("1. 첫째.md", document("1. 첫째"));
  const second = parseSection("2. 둘째.md", document("2. 둘째"));
  assert.deepEqual(sortAndValidateSections([second, first]), [first, second]);
  assert.throws(
    () => sortAndValidateSections([first, { ...second, order: 3 }]),
    /unique and consecutive/,
  );
  assert.throws(
    () => sortAndValidateSections([first, { ...second, order: 1 }]),
    /unique and consecutive/,
  );
});

test("rejects invalid metadata, dates, filenames, and empty bodies", () => {
  assert.throws(() => parseSection("intro.md", document("소개")), /numbered/);
  assert.throws(
    () => parseSection("1. 소개.md", "---\ndate: 2026-10-20\n---\n본문"),
    /frontmatter title/,
  );
  assert.throws(
    () => parseSection("1. 소개.md", document("소개", "본문", "2026-02-30")),
    /invalid date/,
  );
  assert.throws(
    () => parseSection("1. 소개.md", document("소개", "   ")),
    /must not be empty/,
  );
});
