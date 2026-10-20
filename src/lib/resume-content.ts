import { parseDocument } from "yaml";

const numberedFilename = /^(\d+)\.\s+(.+)\.md$/u;

export interface ResumeSection {
  filename: string;
  order: number;
  id: string;
  title: string;
  body: string;
  date?: string;
}

export function isResumeDocument(filename: string): boolean {
  return numberedFilename.test(filename);
}

function calendarDate(
  value: unknown,
  field: string,
  filename: string,
): string | undefined {
  if (value === undefined) return undefined;
  const match =
    typeof value === "string" &&
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2})(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)?)?$/.exec(
      value,
    );
  if (!match)
    throw new Error(
      `${filename}: ${field} must be an ISO calendar date or timestamp`,
    );
  const [, year, month, day, hour = "0", minute = "0", second = "0"] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (
    !Number(year) ||
    Number.isNaN(date.valueOf()) ||
    date.getUTCMonth() + 1 !== Number(month) ||
    date.getUTCDate() !== Number(day) ||
    Number(hour) > 23 ||
    Number(minute) > 59 ||
    Number(second) > 59
  ) {
    throw new Error(`${filename}: invalid ${field}`);
  }
  return value;
}

export function parseSection(filename: string, raw: string): ResumeSection {
  const name = numberedFilename.exec(filename);
  if (!name) throw new Error(`Not a numbered Markdown document: ${filename}`);
  const frontmatter = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(raw);
  if (!frontmatter)
    throw new Error(`${filename}: YAML frontmatter is required`);
  const yaml = parseDocument(frontmatter[1], {
    schema: "core",
    uniqueKeys: true,
  });
  if (yaml.errors.length)
    throw new Error(`${filename}: ${yaml.errors[0].message}`);
  const metadata: unknown = yaml.toJS();
  if (
    !metadata ||
    typeof metadata !== "object" ||
    Array.isArray(metadata) ||
    !("title" in metadata) ||
    typeof metadata.title !== "string" ||
    !metadata.title.trim()
  ) {
    throw new Error(
      `${filename}: frontmatter title must be a non-empty string`,
    );
  }
  const order = Number(name[1]);
  const title = metadata.title.replace(/^\d+\.\s*/, "").trim();
  if (!Number.isSafeInteger(order) || order < 1 || !title)
    throw new Error(`${filename}: invalid section number/title`);
  const body = raw.slice(frontmatter[0].length);
  if (!body.trim())
    throw new Error(`${filename}: document body must not be empty`);
  return {
    filename,
    order,
    id: `section-${order}`,
    title,
    body,
    date: calendarDate(
      "date" in metadata ? metadata.date : undefined,
      "date",
      filename,
    ),
  };
}

export function sortAndValidateSections(
  sections: ResumeSection[],
): ResumeSection[] {
  const sorted = [...sections].sort((a, b) => a.order - b.order);
  sorted.forEach((section, index) => {
    if (section.order !== index + 1)
      throw new Error(
        "Document numbers must be unique and consecutive, starting at 1",
      );
  });
  return sorted;
}
