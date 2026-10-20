import assert from "node:assert/strict";
import test from "node:test";
import { renderSection } from "../src/lib/markdown.ts";

test("preserves resume heading, link, entry, and table markup", async () => {
  const html = await renderSection(
    {
      id: "section-2",
      title: "경력",
      body: `## 경력

[섹션](#경력) [항목](#회사) [파일](/files/resume.pdf) [외부](https://example.com)

### 회사

설명

#### 업무

| 기간 | 내용 |
| --- | --- |
| 2026 | 개발 |
`,
    },
    "/resume/",
  );

  assert.doesNotMatch(html, /<h2/);
  assert.match(html, /href="#section-2"/);
  assert.match(html, /href="#section-2-heading-회사"/);
  assert.match(html, /href="\/resume\/files\/resume\.pdf"/);
  assert.match(html, /href="https:\/\/example\.com"/);
  assert.match(
    html,
    /<div class="resume-entry"><h3 id="section-2-heading-회사">/,
  );
  assert.match(html, /<h4 id="section-2-heading-업무">/);
  assert.match(
    html,
    /<div class="table-scroll" role="region" tabindex="0" aria-label="경력 표">\s*<table>/,
  );
  assert.match(html, /<th scope="col">기간<\/th>/);
});

test("rejects unsafe and base-escaping Markdown URLs", async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    await assert.rejects(
      renderSection(
        {
          id: "section-1",
          title: "소개",
          body: "[위험](javascript:alert(1))",
        },
        "/resume/",
      ),
      /Unsafe Markdown URL/,
    );
    await assert.rejects(
      renderSection(
        { id: "section-1", title: "소개", body: "[탈출](../outside)" },
        "/resume/",
      ),
      /escapes the Pages base/,
    );
  } finally {
    console.error = originalError;
  }
});
