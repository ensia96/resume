import {
  createMarkdownProcessor,
  rehypeHeadingIds,
} from "@astrojs/markdown-remark";
import type { Element, Root, RootContent } from "hast";

function plainText(node: RootContent): string {
  if (node.type === "text") return node.value;
  return "children" in node ? node.children.map(plainText).join("") : "";
}

function resumeMarkup(options: { id: string; title: string; base: string }) {
  return () => (tree: Root) => {
    const anchors = new Map<string, string>();
    const first = tree.children.findIndex(
      (node) => node.type !== "text" || node.value.trim(),
    );
    const opening = tree.children[first];
    if (
      opening?.type === "element" &&
      opening.tagName === "h2" &&
      plainText(opening) === options.title
    ) {
      if (opening.properties.id)
        anchors.set(String(opening.properties.id), options.id);
      tree.children.splice(first, 1);
    }

    function visit(
      node: Root | Element,
      transform: (element: Element) => void,
    ) {
      for (const child of node.children) {
        if (child.type === "element") {
          transform(child);
          visit(child, transform);
        }
      }
    }
    visit(tree, (node) => {
      if (/^h[1-6]$/.test(node.tagName) && node.properties.id) {
        const original = String(node.properties.id);
        const id = `${options.id}-heading-${original}`;
        anchors.set(original, id);
        node.properties.id = id;
      }
    });
    visit(tree, (node) => {
      if (node.tagName === "th") node.properties.scope = "col";
      for (const property of ["href", "src"] as const) {
        const value = node.properties[property];
        if (typeof value !== "string") continue;
        if (value.startsWith("#")) {
          const fragment = decodeURIComponent(value.slice(1));
          node.properties[property] = `#${anchors.get(fragment) ?? fragment}`;
        } else if (!/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value)) {
          const path = value.startsWith(options.base)
            ? value
            : value.replace(/^\//, "");
          const url = new URL(path, `https://resume.invalid${options.base}`);
          if (!url.pathname.startsWith(options.base))
            throw new Error(
              `Local asset/link escapes the Pages base: ${value}`,
            );
          node.properties[property] = `${url.pathname}${url.search}${url.hash}`;
        } else if (/^(?:javascript|vbscript|data):/i.test(value)) {
          throw new Error(`Unsafe Markdown URL: ${value}`);
        }
      }
    });

    const grouped: RootContent[] = [];
    let entry: Element | undefined;
    for (const node of tree.children) {
      if (node.type === "element" && node.tagName === "h3") {
        entry = {
          type: "element",
          tagName: "div",
          properties: { className: ["resume-entry"] },
          children: [node],
        };
        grouped.push(entry);
      } else if (node.type === "element" && /^h[12]$/.test(node.tagName)) {
        entry = undefined;
        grouped.push(node);
      } else if (entry) {
        entry.children.push(node as Element["children"][number]);
      } else {
        grouped.push(node);
      }
    }
    tree.children = grouped;
    function wrapTables(node: Root | Element) {
      node.children = node.children.map((child) => {
        if (child.type !== "element") return child;
        if (child.tagName === "table") {
          return {
            type: "element",
            tagName: "div",
            properties: {
              className: ["table-scroll"],
              role: "region",
              tabIndex: 0,
              ariaLabel: `${options.title} 표 (가로 스크롤 가능)`,
            },
            children: [child],
          } as Element;
        }
        wrapTables(child);
        return child;
      }) as typeof node.children;
    }
    wrapTables(tree);
  };
}

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
      resumeMarkup({ id: section.id, title: section.title, base }),
    ],
  });
  return (await processor.render(section.body)).code;
}
