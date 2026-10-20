import {
  readContentSource,
  type ContentSourceOptions,
} from "./content-source.ts";
import { parseSection, sortAndValidateSections } from "./resume-content.ts";

export type { ContentSource } from "./content-source.ts";
export type { ResumeSection } from "./resume-content.ts";

export async function loadResume(options: ContentSourceOptions = {}) {
  const { documents, source } = await readContentSource(options);
  if (!documents.length)
    throw new Error(
      "No numbered Markdown documents found in the content source",
    );
  const sections = sortAndValidateSections(
    documents.map(({ filename, body }) => parseSection(filename, body)),
  );
  return { sections, source };
}
