import { describe, it } from "node:test";
import assert from "node:assert";
import { resolve } from "node:path";
import { extractArgumentHint, extractArgumentHintFromContent } from "../../src/hint-extractor.ts";

const FIXTURES_DIR = resolve(import.meta.dirname, "../../fixtures/skills");

describe("extractArgumentHint", () => {
  it("extracts double-quoted bracketed hint verbatim (talking-points)", () => {
    const hint = extractArgumentHint(resolve(FIXTURES_DIR, "talking-points/SKILL.md"));
    assert.strictEqual(hint, "[--edit] [--days N]");
  });

  it("extracts double-quoted angle bracket hint verbatim (execute-plan)", () => {
    const hint = extractArgumentHint(resolve(FIXTURES_DIR, "execute-plan/SKILL.md"));
    assert.strictEqual(hint, "<plan-path>");
  });

  it("extracts unquoted options hint verbatim (tech-docs)", () => {
    const hint = extractArgumentHint(resolve(FIXTURES_DIR, "tech-docs/SKILL.md"));
    assert.strictEqual(hint, "--new <topic> | --improve <file>");
  });

  it("extracts single-quoted bracketed hint verbatim (decide)", () => {
    const hint = extractArgumentHint(resolve(FIXTURES_DIR, "decide/SKILL.md"));
    assert.strictEqual(hint, "[short description of the decision]");
  });

  it("extracts unquoted free text hint verbatim (teach-with-slides)", () => {
    const hint = extractArgumentHint(resolve(FIXTURES_DIR, "teach-with-slides/SKILL.md"));
    assert.strictEqual(hint, "Optional topic to teach");
  });

  it("extracts unquoted parenthetical hint verbatim (recap)", () => {
    const hint = extractArgumentHint(resolve(FIXTURES_DIR, "recap/SKILL.md"));
    assert.strictEqual(hint, "(optional) a specific thread or task to recap");
  });

  it("returns undefined when argument-hint is missing (clarify)", () => {
    const hint = extractArgumentHint(resolve(FIXTURES_DIR, "clarify/SKILL.md"));
    assert.strictEqual(hint, undefined);
  });

  it("returns undefined when argument-hint is a number", () => {
    const hint = extractArgumentHint(resolve(FIXTURES_DIR, "invalid-number/SKILL.md"));
    assert.strictEqual(hint, undefined);
  });

  it("returns undefined when argument-hint is an object", () => {
    const hint = extractArgumentHint(resolve(FIXTURES_DIR, "invalid-object/SKILL.md"));
    assert.strictEqual(hint, undefined);
  });

  it("returns undefined when argument-hint is empty or whitespace", () => {
    const hint = extractArgumentHint(resolve(FIXTURES_DIR, "empty-hint/SKILL.md"));
    assert.strictEqual(hint, undefined);
  });

  it("returns undefined on malformed frontmatter without throwing", () => {
    const hint = extractArgumentHint(resolve(FIXTURES_DIR, "malformed/SKILL.md"));
    assert.strictEqual(hint, undefined);
  });

  it("returns undefined for a non-existent file without throwing", () => {
    const hint = extractArgumentHint(resolve(FIXTURES_DIR, "does-not-exist/SKILL.md"));
    assert.strictEqual(hint, undefined);
  });
});

describe("extractArgumentHintFromContent", () => {
  it("extracts valid string hints", () => {
    const content = "---\nname: demo\nargument-hint: '<item>'\n---\n# Demo";
    assert.strictEqual(extractArgumentHintFromContent(content), "<item>");
  });

  it("returns undefined when frontmatter has no argument-hint", () => {
    const content = "---\nname: demo\n---\n# Demo";
    assert.strictEqual(extractArgumentHintFromContent(content), undefined);
  });

  it("returns undefined when content has no frontmatter", () => {
    assert.strictEqual(extractArgumentHintFromContent("# Plain Markdown"), undefined);
  });

  it("returns undefined on malformed content without throwing", () => {
    assert.strictEqual(extractArgumentHintFromContent("---\n{: unclosed\n---\n"), undefined);
  });
});
