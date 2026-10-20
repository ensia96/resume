import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { isResumeDocument } from "./resume-content.ts";

export interface ContentSource {
  mode: "git" | "directory";
  ref?: string;
  sha: string | null;
  dirty: boolean | null;
}

export interface ContentDocument {
  filename: string;
  body: string;
}

export interface ContentSourceOptions {
  cwd?: string;
  directory?: string;
  ref?: string;
}

function git(cwd: string, args: string[]) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 10 * 1024 * 1024,
  });
}

async function readDirectory(root: string): Promise<{
  documents: ContentDocument[];
  source: ContentSource;
}> {
  const filenames = await readdir(root);
  let source: ContentSource = { mode: "directory", sha: null, dirty: null };
  try {
    if (resolve(git(root, ["rev-parse", "--show-toplevel"]).trim()) === root) {
      source.sha = git(root, [
        "rev-parse",
        "--verify",
        "HEAD^{commit}",
      ]).trim();
      const tracked = git(root, ["ls-files", "-z"]).split("\0");
      const documentNames = [
        ...new Set([...filenames, ...tracked].filter(isResumeDocument)),
      ];
      source.dirty =
        documentNames.length > 0 &&
        Boolean(
          git(root, [
            "status",
            "--porcelain",
            "--untracked-files=normal",
            "--",
            ...documentNames,
          ]).trim(),
        );
    }
  } catch {
    source = { mode: "directory", sha: null, dirty: null };
  }
  const documentNames = filenames.filter(isResumeDocument);
  const documents = await Promise.all(
    documentNames.map(async (filename) => ({
      filename,
      body: await readFile(resolve(root, filename), "utf8"),
    })),
  );
  return { documents, source };
}

function readGit(cwd: string, ref: string): {
  documents: ContentDocument[];
  source: ContentSource;
} {
  if (!ref || ref.startsWith("-"))
    throw new Error("RESUME_CONTENT_REF must be a Git commit/ref, not an option");
  const sha = git(cwd, [
    "rev-parse",
    "--verify",
    "--end-of-options",
    `${ref}^{commit}`,
  ]).trim();
  const filenames = git(cwd, [
    "ls-tree",
    "--full-tree",
    "-z",
    "--name-only",
    sha,
  ])
    .split("\0")
    .filter(isResumeDocument);
  return {
    documents: filenames.map((filename) => ({
      filename,
      body: git(cwd, ["show", `${sha}:${filename}`]),
    })),
    source: { mode: "git", ref, sha, dirty: false },
  };
}

export async function readContentSource(
  options: ContentSourceOptions = {},
): Promise<{ documents: ContentDocument[]; source: ContentSource }> {
  const cwd = options.cwd ?? process.cwd();
  const directory = options.directory ?? process.env.RESUME_CONTENT_DIR;
  if (directory) return readDirectory(resolve(cwd, directory));
  return readGit(
    cwd,
    options.ref ?? process.env.RESUME_CONTENT_REF ?? "main",
  );
}
