import { describe, it } from "node:test";
import assert from "node:assert";
import type { AutocompleteItem, AutocompleteProvider } from "@earendil-works/pi-tui";
import {
  createHintAutocompleteProvider,
  parseArgumentHint,
} from "../../src/argument-completion.ts";

function createMockBaseProvider(overrides?: Partial<AutocompleteProvider>): {
  provider: AutocompleteProvider;
  calls: Array<{ method: string; args: unknown[] }>;
} {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const provider: AutocompleteProvider = {
    triggerCharacters: ["#"],
    async getSuggestions(lines, cursorLine, cursorCol, options) {
      calls.push({ method: "getSuggestions", args: [lines, cursorLine, cursorCol, options] });
      if (options.force) {
        return {
          prefix: "",
          items: [{ value: "README.md", label: "README.md" }],
        };
      }
      return null;
    },
    applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
      calls.push({ method: "applyCompletion", args: [lines, cursorLine, cursorCol, item, prefix] });
      const line = lines[cursorLine] ?? "";
      const before = line.slice(0, cursorCol - prefix.length);
      const after = line.slice(cursorCol);
      const next = [...lines];
      next[cursorLine] = `${before}${item.value}${after}`;
      return {
        lines: next,
        cursorLine,
        cursorCol: before.length + item.value.length,
      };
    },
    shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
      calls.push({ method: "shouldTriggerFileCompletion", args: [lines, cursorLine, cursorCol] });
      return true;
    },
    ...overrides,
  };
  return { provider, calls };
}

describe("parseArgumentHint", () => {
  it("parses bracketed flags and value placeholders ([--edit] [--days N])", () => {
    const parsed = parseArgumentHint("[--edit] [--days N]");
    assert.strictEqual(parsed.expectsPath, false);
    assert.deepStrictEqual(parsed.flags, [
      { flag: "--edit", valueHint: undefined, expectsPath: false },
      { flag: "--days", valueHint: "N", expectsPath: false },
    ]);
  });

  it("parses pipe-separated flags and detects path value hints (--new <topic> | --improve <file>)", () => {
    const parsed = parseArgumentHint("--new <topic> | --improve <file>");
    assert.strictEqual(parsed.expectsPath, false);
    assert.deepStrictEqual(parsed.flags, [
      { flag: "--new", valueHint: "<topic>", expectsPath: false },
      { flag: "--improve", valueHint: "<file>", expectsPath: true },
    ]);
  });

  it("parses short and long flags without confusing hyphenated prose", () => {
    const parsed = parseArgumentHint("-f <file> [--verbose] [--dry-run]");
    assert.deepStrictEqual(parsed.flags, [
      { flag: "-f", valueHint: "<file>", expectsPath: true },
      { flag: "--verbose", valueHint: undefined, expectsPath: false },
      { flag: "--dry-run", valueHint: undefined, expectsPath: false },
    ]);
  });

  it("identifies path-only placeholders (<plan-path>, [file], <dir>)", () => {
    for (const hint of ["<plan-path>", "[file]", "<dir>", "<path/to/spec>"]) {
      const parsed = parseArgumentHint(hint);
      assert.deepStrictEqual(parsed.flags, [], `Expected no flags for ${hint}`);
      assert.strictEqual(parsed.expectsPath, true, `Expected expectsPath=true for ${hint}`);
    }
  });

  it("treats plain prose hints as display-only with no flags or path expectation", () => {
    for (const hint of [
      "Optional topic to teach",
      "(optional) a specific thread or task to recap",
      "[short description of the decision]",
      "[short-description of the dry-run]",
      "",
      "   ",
    ]) {
      const parsed = parseArgumentHint(hint);
      assert.deepStrictEqual(parsed.flags, [], `Expected no flags for "${hint}"`);
      assert.strictEqual(parsed.expectsPath, false, `Expected expectsPath=false for "${hint}"`);
    }
  });

  it("deduplicates repeated flags and ignores standalone --", () => {
    const parsed = parseArgumentHint("--edit --edit -- --days N");
    assert.deepStrictEqual(parsed.flags, [
      { flag: "--edit", valueHint: undefined, expectsPath: false },
      { flag: "--days", valueHint: "N", expectsPath: false },
    ]);
  });
});

describe("createHintAutocompleteProvider", () => {
  const hints = new Map<string, string>([
    ["/skill:talking-points", "[--edit] [--days N]"],
    ["/skill:tech-docs", "--new <topic> | --improve <file>"],
    ["/skill:execute-plan", "<plan-path>"],
    ["/skill:teach-with-slides", "Optional topic to teach"],
  ]);

  const signal = new AbortController().signal;

  it("offers all flags on Tab after /skill:<name> ", async () => {
    const { provider: base } = createMockBaseProvider();
    const wrapped = createHintAutocompleteProvider(base, hints);

    const line = "/skill:talking-points ";
    const result = await wrapped.getSuggestions([line], 0, line.length, { signal, force: true });

    assert.ok(result);
    assert.strictEqual(result.prefix, "");
    assert.deepStrictEqual(
      result.items.map((i) => i.value),
      ["--edit", "--days"],
    );
    assert.strictEqual(result.items[1]?.description, "N");
  });

  it("fuzzy-filters flags when force is true (Tab / open menu typing)", async () => {
    const { provider: base } = createMockBaseProvider();
    const wrapped = createHintAutocompleteProvider(base, hints);

    const lineEd = "/skill:talking-points ed";
    const resEd = await wrapped.getSuggestions([lineEd], 0, lineEd.length, { signal, force: true });
    assert.ok(resEd);
    assert.strictEqual(resEd.prefix, "ed");
    assert.deepStrictEqual(resEd.items.map((i) => i.value), ["--edit"]);

    const lineDy = "/skill:talking-points dy";
    const resDy = await wrapped.getSuggestions([lineDy], 0, lineDy.length, { signal, force: true });
    assert.ok(resDy);
    assert.strictEqual(resDy.prefix, "dy");
    assert.deepStrictEqual(resDy.items.map((i) => i.value), ["--days"]);
  });

  it("auto-suggests flags on live typing when token starts with -, but not for plain words", async () => {
    const { provider: base } = createMockBaseProvider();
    const wrapped = createHintAutocompleteProvider(base, hints);

    const dashLine = "/skill:talking-points -e";
    const dashRes = await wrapped.getSuggestions([dashLine], 0, dashLine.length, { signal, force: false });
    assert.ok(dashRes);
    assert.strictEqual(dashRes.prefix, "-e");
    assert.deepStrictEqual(dashRes.items.map((i) => i.value), ["--edit"]);

    const wordLine = "/skill:talking-points ed";
    const wordRes = await wrapped.getSuggestions([wordLine], 0, wordLine.length, { signal, force: false });
    assert.strictEqual(wordRes, null);
  });

  it("excludes flags already present earlier in the command", async () => {
    const { provider: base } = createMockBaseProvider();
    const wrapped = createHintAutocompleteProvider(base, hints);

    const line = "/skill:talking-points --edit ";
    const res = await wrapped.getSuggestions([line], 0, line.length, { signal, force: true });
    assert.ok(res);
    assert.deepStrictEqual(res.items.map((i) => i.value), ["--days"]);
  });

  it("delegates to base file completion when a flag expects a file path", async () => {
    const { provider: base, calls } = createMockBaseProvider();
    const wrapped = createHintAutocompleteProvider(base, hints);

    const line = "/skill:tech-docs --improve ";
    const res = await wrapped.getSuggestions([line], 0, line.length, { signal, force: true });
    assert.ok(res);
    assert.deepStrictEqual(res.items.map((i) => i.value), ["README.md"]);
    assert.ok(calls.some((c) => c.method === "getSuggestions"));
  });

  it("delegates to base provider for path-only hints and never inserts prose hints", async () => {
    const { provider: base } = createMockBaseProvider();
    const wrapped = createHintAutocompleteProvider(base, hints);

    const planLine = "/skill:execute-plan ";
    const planRes = await wrapped.getSuggestions([planLine], 0, planLine.length, { signal, force: true });
    assert.ok(planRes);
    assert.deepStrictEqual(planRes.items.map((i) => i.value), ["README.md"]);

    const proseLine = "/skill:teach-with-slides ";
    const proseRes = await wrapped.getSuggestions([proseLine], 0, proseLine.length, { signal, force: true });
    assert.ok(proseRes);
    assert.ok(!proseRes.items.some((i) => i.value.includes("Optional topic")));
  });

  it("delegates to base provider outside /skill:<name> argument context", async () => {
    const { provider: base, calls } = createMockBaseProvider();
    const wrapped = createHintAutocompleteProvider(base, hints);

    await wrapped.getSuggestions(["/skill:talk"], 0, 11, { signal, force: false });
    await wrapped.getSuggestions(["plain text "], 0, 11, { signal, force: true });
    await wrapped.getSuggestions(["/skill:talking-points", "line 2"], 1, 6, { signal, force: true });

    assert.strictEqual(calls.filter((c) => c.method === "getSuggestions").length, 3);
  });

  it("applies flag completion with a single trailing space and preserves existing text after cursor", () => {
    const { provider: base } = createMockBaseProvider();
    const wrapped = createHintAutocompleteProvider(base, hints);

    const item: AutocompleteItem = { value: "--edit", label: "--edit" };
    const applied = wrapped.applyCompletion(["/skill:talking-points ed"], 0, 24, item, "ed");
    assert.deepStrictEqual(applied, {
      lines: ["/skill:talking-points --edit "],
      cursorLine: 0,
      cursorCol: 29,
    });

    const withExistingSpace = wrapped.applyCompletion(["/skill:talking-points ed --days 3"], 0, 24, item, "ed");
    assert.deepStrictEqual(withExistingSpace, {
      lines: ["/skill:talking-points --edit --days 3"],
      cursorLine: 0,
      cursorCol: 28,
    });
  });

  it("enables shouldTriggerFileCompletion after trailing space for flag and path hints", () => {
    const { provider: base, calls } = createMockBaseProvider({
      shouldTriggerFileCompletion: () => false,
    });
    const wrapped = createHintAutocompleteProvider(base, hints);

    assert.strictEqual(wrapped.shouldTriggerFileCompletion?.(["/skill:talking-points "], 0, 22), true);
    assert.strictEqual(wrapped.shouldTriggerFileCompletion?.(["/skill:execute-plan "], 0, 20), true);
    assert.strictEqual(wrapped.shouldTriggerFileCompletion?.(["/skill:teach-with-slides "], 0, 25), false);
    assert.strictEqual(calls.length, 0);
  });

  it("delegates file applyCompletion and shouldTriggerFileCompletion to base provider", () => {
    const { provider: base, calls } = createMockBaseProvider();
    const wrapped = createHintAutocompleteProvider(base, hints);

    const fileItem: AutocompleteItem = { value: "README.md", label: "README.md" };
    wrapped.applyCompletion(["/skill:execute-plan RE"], 0, 22, fileItem, "RE");
    wrapped.shouldTriggerFileCompletion?.(["plain text "], 0, 11);

    assert.ok(calls.some((c) => c.method === "applyCompletion"));
    assert.ok(calls.some((c) => c.method === "shouldTriggerFileCompletion"));
  });
});
