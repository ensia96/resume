import type { Element, Root, RootContent } from "hast";
import { visitElements } from "./visit.ts";

function plainText(node: RootContent): string {
  if (node.type === "text") return node.value;
  return "children" in node ? node.children.map(plainText).join("") : "";
}

export function rehypeResumeHeadings(options: {
  sectionId: string;
  title: string;
}) {
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
        anchors.set(String(opening.properties.id), options.sectionId);
      tree.children.splice(first, 1);
    }

    visitElements(tree, (element) => {
      if (!/^h[1-6]$/.test(element.tagName) || !element.properties.id) return;
      const original = String(element.properties.id);
      const id = `${options.sectionId}-heading-${original}`;
      anchors.set(original, id);
      element.properties.id = id;
    });

    visitElements(tree, (element: Element) => {
      for (const property of ["href", "src"] as const) {
        const value = element.properties[property];
        if (typeof value !== "string" || !value.startsWith("#")) continue;
        const fragment = decodeURIComponent(value.slice(1));
        element.properties[property] = `#${anchors.get(fragment) ?? fragment}`;
      }
    });
  };
}
