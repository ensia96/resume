import type { Element, Root, RootContent } from "hast";
import { visitElements } from "./visit.ts";

function groupEntries(tree: Root): void {
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
}

function wrapTables(node: Root | Element, title: string): void {
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
          ariaLabel: `${title} 표`,
        },
        children: [child],
      } as Element;
    }
    wrapTables(child, title);
    return child;
  }) as typeof node.children;
}

export function rehypeResumeStructure(title: string) {
  return () => (tree: Root) => {
    visitElements(tree, (element) => {
      if (element.tagName === "th") element.properties.scope = "col";
    });
    groupEntries(tree);
    wrapTables(tree, title);
  };
}
