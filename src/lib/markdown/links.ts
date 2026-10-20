import type { Root } from "hast";
import { visitElements } from "./visit.ts";

export function rehypeResumeLinks(base: string) {
  return () => (tree: Root) => {
    visitElements(tree, (element) => {
      for (const property of ["href", "src"] as const) {
        const value = element.properties[property];
        if (typeof value !== "string" || value.startsWith("#")) continue;
        if (/^(?:javascript|vbscript|data):/i.test(value))
          throw new Error(`Unsafe Markdown URL: ${value}`);
        if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value)) continue;
        const path = value.startsWith(base) ? value : value.replace(/^\//, "");
        const url = new URL(path, `https://resume.invalid${base}`);
        if (!url.pathname.startsWith(base))
          throw new Error(`Local asset/link escapes the Pages base: ${value}`);
        element.properties[property] = `${url.pathname}${url.search}${url.hash}`;
      }
    });
  };
}
