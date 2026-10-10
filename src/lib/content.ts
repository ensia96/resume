import { execFileSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseDocument } from 'yaml';

const numberedFile = /^(\d+)\.\s+(.+)\.md$/u;

export interface ResumeSection {
  filename: string;
  order: number;
  id: string;
  title: string;
  body: string;
  date?: string;
  updatedAt?: string;
}

export interface ContentSource {
  mode: 'git' | 'directory';
  ref?: string;
  sha: string | null;
  dirty: boolean | null;
}

function git(cwd: string, args: string[]) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 10 * 1024 * 1024 });
}

function calendarDate(value: unknown, field: string, filename: string): string | undefined {
  if (value === undefined) return undefined;
  // YAML core schema keeps dates as strings; do not infer timestamps or time zones.
  const match = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2})(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)?)?$/.exec(value);
  if (!match) throw new Error(`${filename}: ${field} must be an ISO calendar date or timestamp`);
  const [, year, month, day, hour = '0', minute = '0', second = '0'] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (!Number(year) || Number.isNaN(date.valueOf()) || date.getUTCMonth() + 1 !== Number(month)
    || date.getUTCDate() !== Number(day) || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) {
    throw new Error(`${filename}: invalid ${field}`);
  }
  return value;
}

export function parseSection(filename: string, raw: string): ResumeSection {
  const name = numberedFile.exec(filename);
  if (!name) throw new Error(`Not a numbered Markdown document: ${filename}`);
  const frontmatter = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(raw);
  if (!frontmatter) throw new Error(`${filename}: YAML frontmatter is required`);
  const yaml = parseDocument(frontmatter[1], { schema: 'core', uniqueKeys: true });
  if (yaml.errors.length) throw new Error(`${filename}: ${yaml.errors[0].message}`);
  const metadata: unknown = yaml.toJS();
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)
    || !('title' in metadata) || typeof metadata.title !== 'string' || !metadata.title.trim()) {
    throw new Error(`${filename}: frontmatter title must be a non-empty string`);
  }
  const order = Number(name[1]);
  const title = metadata.title.replace(/^\d+\.\s*/, '').trim();
  if (!Number.isSafeInteger(order) || order < 1 || !title) throw new Error(`${filename}: invalid section number/title`);
  const body = raw.slice(frontmatter[0].length);
  if (!body.trim()) throw new Error(`${filename}: document body must not be empty`);
  return {
    filename, order, id: `section-${order}`, title, body,
    date: calendarDate('date' in metadata ? metadata.date : undefined, 'date', filename),
    updatedAt: calendarDate('updatedAt' in metadata ? metadata.updatedAt : undefined, 'updatedAt', filename),
  };
}

export async function loadResume(options: { cwd?: string; directory?: string; ref?: string } = {}): Promise<{
  sections: ResumeSection[];
  source: ContentSource;
}> {
  // npm runs from the app root; import.meta.url moves when Astro bundles this module.
  const cwd = options.cwd ?? process.cwd();
  const directory = options.directory ?? process.env.RESUME_CONTENT_DIR;
  const ref = options.ref ?? process.env.RESUME_CONTENT_REF ?? 'main';
  let filenames: string[];
  let read: (filename: string) => string | Promise<string>;
  let source: ContentSource;
  if (directory) {
    const root = resolve(cwd, directory);
    filenames = await readdir(root);
    read = (filename) => readFile(resolve(root, filename), 'utf8');
    source = { mode: 'directory', sha: null, dirty: null };
    try {
      // A checkout root supplies provenance. Plain directories remain supported.
      if (resolve(git(root, ['rev-parse', '--show-toplevel']).trim()) === root) {
        source.sha = git(root, ['rev-parse', '--verify', 'HEAD^{commit}']).trim();
        const tracked = git(root, ['ls-files', '-z']).split('\0');
        const docs = [...new Set([...filenames, ...tracked].filter((filename) => numberedFile.test(filename)))];
        source.dirty = docs.length > 0 && Boolean(git(root, ['status', '--porcelain', '--untracked-files=normal', '--', ...docs]).trim());
      }
    } catch {
      // Do not publish partially verified provenance for plain/inaccessible checkouts.
      source = { mode: 'directory', sha: null, dirty: null };
    }
  } else {
    if (!ref || ref.startsWith('-')) throw new Error('RESUME_CONTENT_REF must be a Git commit/ref, not an option');
    const sha = git(cwd, ['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`]).trim();
    filenames = git(cwd, ['ls-tree', '--full-tree', '-z', '--name-only', sha]).split('\0').filter(Boolean);
    read = (filename) => git(cwd, ['show', `${sha}:${filename}`]);
    source = { mode: 'git', ref, sha, dirty: false };
  }
  const documents = filenames.filter((filename) => numberedFile.test(filename));
  if (!documents.length) throw new Error('No numbered Markdown documents found in the content source');
  const sections = await Promise.all(documents.map(async (filename) => parseSection(filename, await read(filename))));
  sections.sort((a, b) => a.order - b.order);
  sections.forEach((section, index) => {
    if (section.order !== index + 1) throw new Error('Document numbers must be unique and consecutive, starting at 1');
  });
  return { sections, source };
}
