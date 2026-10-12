import { existsSync, readFileSync } from "node:fs";
import { parseFrontmatter } from "@earendil-works/pi-coding-agent";

/**
 * Extract argument-hint string from raw markdown content with frontmatter.
 * Returns the non-empty string verbatim, or undefined if missing, invalid, or malformed.
 */
export function extractArgumentHintFromContent(content: string): string | undefined {
  try {
    const { frontmatter } = parseFrontmatter<Record<string, unknown>>(content);
    if (!frontmatter || typeof frontmatter !== "object") {
      return undefined;
    }
    const hint = frontmatter["argument-hint"];
    if (typeof hint === "string") {
      const trimmed = hint.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Read a skill file from disk and extract its argument-hint.
 * Returns undefined on any read, parse, or type error without throwing.
 */
export function extractArgumentHint(filePath: string): string | undefined {
  try {
    if (!existsSync(filePath)) {
      return undefined;
    }
    const content = readFileSync(filePath, "utf-8");
    return extractArgumentHintFromContent(content);
  } catch {
    return undefined;
  }
}
