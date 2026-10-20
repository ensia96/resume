import type { Element, Root } from "hast";

export function visitElements(
  node: Root | Element,
  transform: (element: Element) => void,
): void {
  for (const child of node.children) {
    if (child.type !== "element") continue;
    transform(child);
    visitElements(child, transform);
  }
}
