import {
  createMarkdownProcessor,
  rehypeHeadingIds,
} from "@astrojs/markdown-remark";
import { rehypeResumeHeadings } from "./markdown/headings.ts";
import { rehypeResumeLinks } from "./markdown/links.ts";
import { rehypeResumeStructure } from "./markdown/structure.ts";

export async function renderSection(
  section: { body: string; id: string; title: string },
  base: string,
) {
  const processor = await createMarkdownProcessor({
    gfm: true,
    smartypants: false,
    syntaxHighlight: false,
    rehypePlugins: [
      rehypeHeadingIds,
      rehypeResumeHeadings({ sectionId: section.id, title: section.title }),
      rehypeResumeLinks(base),
      rehypeResumeStructure(section.title),
    ],
  });
  return (await processor.render(section.body)).code;
}
