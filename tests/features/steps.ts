import { Given, When, Then, After, setWorldConstructor } from "@cucumber/cucumber";
import assert from "node:assert";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import extensionFactory from "../../src/index.ts";
import { ArgumentHintsEditor } from "../../src/editor.ts";
import {
  type AutocompleteProvider,
  CombinedAutocompleteProvider,
  visibleWidth,
} from "@earendil-works/pi-tui";

interface MockCommand {
  name: string;
  source: string;
  sourceInfo?: {
    path?: string;
  };
}

class TestWorld {
  tempDir: string = "";
  commands: MockCommand[] = [];
  eventHandlers: Map<string, Array<(event: any, ctx: any) => void>> = new Map();
  lastRegisteredCommand: string = "";
  lastExpectedHint: string = "";
  editor?: ArgumentHintsEditor;
  editorFactory?: (tui: any, theme: any, kb: any) => ArgumentHintsEditor;
  autocompleteProvider?: AutocompleteProvider;
  autocompleteWrapperCount: number = 0;
  cwdDir: string = "";
  renderedLines: string[] = [];
  savedInitialText: string = "";
  savedInitialCursor: { line: number; col: number } = { line: 0, col: 0 };
  customEditorInstalled: boolean = false;
  mode: "tui" | "rpc" | "print" = "tui";
  hasUI: boolean = true;
  mockTheme = {
    fg: (color: string, text: string) => `\x1b[90m${text}\x1b[39m`,
  };

  createSkillFile(skillName: string, hint?: string): string {
    if (!this.tempDir) {
      this.tempDir = join(tmpdir(), `pi-hints-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      mkdirSync(this.tempDir, { recursive: true });
    }
    const skillDir = join(this.tempDir, skillName);
    mkdirSync(skillDir, { recursive: true });
    const skillPath = join(skillDir, "SKILL.md");

    let frontmatter = `name: ${skillName}\ndescription: Test skill`;
    if (hint !== undefined) {
      frontmatter += `\nargument-hint: ${hint}`;
    }
    writeFileSync(skillPath, `---\n${frontmatter}\n---\n# ${skillName}\n`);
    return skillPath;
  }

  ensureCwdDir(): string {
    if (!this.cwdDir) {
      this.cwdDir = join(tmpdir(), `pi-hints-cwd-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      mkdirSync(this.cwdDir, { recursive: true });
    }
    return this.cwdDir;
  }

  cleanup() {
    if (this.tempDir) {
      try {
        rmSync(this.tempDir, { recursive: true, force: true });
      } catch {}
    }
    if (this.cwdDir) {
      try {
        rmSync(this.cwdDir, { recursive: true, force: true });
      } catch {}
    }
  }

  getMockExtensionAPI() {
    return {
      getCommands: () => this.commands,
      on: (event: string, handler: (event: any, ctx: any) => void) => {
        const list = this.eventHandlers.get(event) ?? [];
        list.push(handler);
        this.eventHandlers.set(event, list);
      },
    };
  }

  getMockContext() {
    return {
      hasUI: this.hasUI,
      mode: this.mode,
      ui: {
        theme: this.mockTheme,
        addAutocompleteProvider: (wrapper: (current: AutocompleteProvider) => AutocompleteProvider) => {
          this.autocompleteWrapperCount += 1;
          const base = new CombinedAutocompleteProvider(
            this.commands.map((c) => ({ name: c.name })),
            this.ensureCwdDir(),
          );
          this.autocompleteProvider = wrapper(this.autocompleteProvider ?? base);
        },
        setEditorComponent: (factory: any) => {
          this.customEditorInstalled = true;
          this.editorFactory = factory;
        },
      },
    };
  }

  startExtension() {
    const api = this.getMockExtensionAPI();
    extensionFactory(api as any);
    const handlers = this.eventHandlers.get("session_start") ?? [];
    const ctx = this.getMockContext();
    for (const h of handlers) {
      h({ reason: "startup" }, ctx);
    }
    if (this.editorFactory) {
      const tui = { terminal: { rows: 24, columns: 80 }, requestRender: () => {} };
      const identity = (s: string) => s;
      const theme = {
        borderColor: identity,
        selectList: {
          selectedPrefix: identity,
          selectedText: identity,
          description: identity,
          scrollInfo: identity,
          noMatch: identity,
        },
      };
      const kb = { matches: () => false, getKeys: () => [] };
      this.editor = this.editorFactory(tui, theme, kb);
      this.editor.focused = true;
      if (this.autocompleteProvider) {
        this.editor.setAutocompleteProvider(this.autocompleteProvider);
      }
    }
  }

  reloadResources() {
    const handlers = this.eventHandlers.get("session_start") ?? [];
    const ctx = this.getMockContext();
    for (const h of handlers) {
      h({ reason: "reload" }, ctx);
    }
    assert.strictEqual(
      this.autocompleteWrapperCount,
      1,
      "Autocomplete provider should only be registered once across session_start events",
    );
  }
}

setWorldConstructor(TestWorld);

After(function (this: TestWorld) {
  this.cleanup();
});

Given("a loaded skill declares argument-hint: {string}", function (this: TestWorld, hintValue: string) {
  let skillName = "talking-points";
  if (hintValue.includes("<topic>")) {
    skillName = "topic-skill";
  }
  const filePath = this.createSkillFile(skillName, `"${hintValue}"`);
  this.commands = [
    {
      name: `skill:${skillName}`,
      source: "skill",
      sourceInfo: { path: filePath },
    },
  ];
  this.lastRegisteredCommand = `/skill:${skillName}`;
  this.lastExpectedHint = hintValue;
  this.hasUI = true;
  this.startExtension();
});

Given("a loaded skill declares an argument hint", function (this: TestWorld) {
  const filePath = this.createSkillFile("talking-points", `"[--edit] [--days N]"`);
  this.commands = [
    {
      name: "skill:talking-points",
      source: "skill",
      sourceInfo: { path: filePath },
    },
  ];
  this.lastRegisteredCommand = "/skill:talking-points";
  this.lastExpectedHint = "[--edit] [--days N]";
  this.hasUI = true;
  this.startExtension();
});

Given("a loaded skill has no string argument-hint value", function (this: TestWorld) {
  const filePath = this.createSkillFile("no-hint-skill"); // no hint
  this.commands = [
    {
      name: "skill:no-hint-skill",
      source: "skill",
      sourceInfo: { path: filePath },
    },
  ];
  this.lastRegisteredCommand = "/skill:no-hint-skill";
  this.lastExpectedHint = "";
  this.hasUI = true;
  this.startExtension();
});

Given("a loaded skill's argument-hint value changes", function (this: TestWorld) {
  const filePath = this.createSkillFile("dynamic-skill", `"v1-hint"`);
  this.commands = [
    {
      name: "skill:dynamic-skill",
      source: "skill",
      sourceInfo: { path: filePath },
    },
  ];
  this.lastRegisteredCommand = "/skill:dynamic-skill";
  this.lastExpectedHint = "v1-hint";
  this.hasUI = true;
  this.startExtension();

  // Now change the file
  writeFileSync(filePath, `---\nname: dynamic-skill\nargument-hint: "v2-updated-hint"\n---\n# dynamic\n`);
  this.lastExpectedHint = "v2-updated-hint";
});

Given("Pi starts in a non-TUI mode", function (this: TestWorld) {
  this.hasUI = false;
  this.mode = "rpc";
});

When("the editor contains the exact command {string}", function (this: TestWorld, command: string) {
  assert.ok(this.editor, "Editor must be initialized");
  this.editor.setText(command);
  this.renderedLines = this.editor.render(80);
});

When("the editor contains that skill's exact command without arguments", function (this: TestWorld) {
  assert.ok(this.editor, "Editor must be initialized");
  this.editor.setText(this.lastRegisteredCommand);
  this.renderedLines = this.editor.render(80);
});

When("the editor contains that skill's exact command", function (this: TestWorld) {
  assert.ok(this.editor, "Editor must be initialized");
  this.editor.setText(this.lastRegisteredCommand);
  this.renderedLines = this.editor.render(80);
});

When("the editor contains a partial skill command or any argument text", function (this: TestWorld) {
  assert.ok(this.editor, "Editor must be initialized");

  // Test 1: partial command
  this.editor.setText("/skill:talk");
  let lines = this.editor.render(80);
  assert.ok(!lines.some(l => l.includes(this.lastExpectedHint)), "Partial command should not show hint");

  // Test 2: command with arguments
  this.editor.setText("/skill:talking-points --edit");
  this.savedInitialText = this.editor.getText();
  this.savedInitialCursor = this.editor.getCursor();
  this.renderedLines = this.editor.render(80);
});

When("the user reloads Pi resources", function (this: TestWorld) {
  this.reloadResources();
  assert.ok(this.editor, "Editor must be initialized");
  this.editor.setText(this.lastRegisteredCommand);
  this.renderedLines = this.editor.render(80);
});

When("the extension starts", function (this: TestWorld) {
  this.startExtension();
});

Then("Pi displays {string} as muted inline hint text", function (this: TestWorld, expectedHint: string) {
  assert.ok(this.renderedLines.length >= 2, "Expected rendered lines");
  const contentLine = this.renderedLines[1]!;
  assert.ok(contentLine.includes(expectedHint), `Line "${contentLine}" should contain "${expectedHint}"`);
  assert.strictEqual(visibleWidth(contentLine), 80, "Visible width should match terminal width");
});

Then("the editor's submitted text remains {string}", function (this: TestWorld, expectedText: string) {
  assert.ok(this.editor, "Editor must be initialized");
  assert.strictEqual(this.editor.getText(), expectedText);
});

Then("Pi displays {string} without interpreting it", function (this: TestWorld, expectedHint: string) {
  assert.ok(this.renderedLines.length >= 2, "Expected rendered lines");
  const contentLine = this.renderedLines[1]!;
  assert.ok(contentLine.includes(expectedHint), `Line "${contentLine}" should contain literal "${expectedHint}"`);
});

Then("Pi displays no argument hint", function (this: TestWorld) {
  const contentLine = this.renderedLines[1] ?? "";
  if (this.lastExpectedHint) {
    assert.ok(
      !contentLine.includes(this.lastExpectedHint),
      `Expected line not to contain hint "${this.lastExpectedHint}", got "${contentLine}"`
    );
  }
});

Then("the editor text and cursor position remain unchanged", function (this: TestWorld) {
  assert.ok(this.editor, "Editor must be initialized");
  assert.strictEqual(this.editor.getText(), this.savedInitialText);
  const cursor = this.editor.getCursor();
  assert.strictEqual(cursor.line, this.savedInitialCursor.line);
  assert.strictEqual(cursor.col, this.savedInitialCursor.col);
});

Then("the editor remains usable", function (this: TestWorld) {
  assert.ok(this.editor, "Editor must be initialized");
  this.editor.insertTextAtCursor(" --help");
  assert.ok(this.editor.getText().endsWith("--help"));
});

Then("the editor displays the updated hint", function (this: TestWorld) {
  assert.ok(this.renderedLines.length >= 2, "Expected rendered lines");
  const contentLine = this.renderedLines[1]!;
  assert.ok(
    contentLine.includes("v2-updated-hint"),
    `Content line "${contentLine}" should contain updated hint "v2-updated-hint"`
  );
  assert.ok(
    !contentLine.includes("v1-hint"),
    `Content line "${contentLine}" should not contain old hint "v1-hint"`
  );
});

Then("it does not install a custom terminal editor", function (this: TestWorld) {
  assert.strictEqual(this.customEditorInstalled, false, "Custom editor should not be installed in non-TUI mode");
});

Given("the working directory contains a file {string}", function (this: TestWorld, fileName: string) {
  const dir = this.ensureCwdDir();
  writeFileSync(join(dir, fileName), `# ${fileName}\n`);
});

When("the user types {string} and presses Tab", async function (this: TestWorld, text: string) {
  assert.ok(this.editor, "Editor must be initialized");
  this.editor.setText(text);
  this.editor.handleInput("\t");
  await new Promise((r) => setTimeout(r, 15));
  this.renderedLines = this.editor.render(80);
});

When("the user fuzzy-types {string} and presses Tab", async function (this: TestWorld, text: string) {
  assert.ok(this.editor, "Editor must be initialized");
  for (const ch of text) {
    this.editor.handleInput(ch);
  }
  await new Promise((r) => setTimeout(r, 15));
  this.editor.handleInput("\t");
  await new Promise((r) => setTimeout(r, 15));
  this.renderedLines = this.editor.render(80);
});

Then("the autocomplete menu lists {string} and {string}", function (this: TestWorld, first: string, second: string) {
  assert.ok(this.editor?.isShowingAutocomplete(), "Expected autocomplete menu to be open");
  const joined = this.renderedLines.join("\n");
  assert.ok(joined.includes(first), `Expected autocomplete menu to include "${first}"`);
  assert.ok(joined.includes(second), `Expected autocomplete menu to include "${second}"`);
});

Then("the editor text becomes {string}", function (this: TestWorld, expected: string) {
  assert.ok(this.editor, "Editor must be initialized");
  assert.strictEqual(this.editor.getText(), expected);
});

Then("the editor completes or suggests {string} instead of {string}", function (
  this: TestWorld,
  expectedFile: string,
  placeholder: string,
) {
  assert.ok(this.editor, "Editor must be initialized");
  const text = this.editor.getText();
  const joined = this.renderedLines.join("\n");
  assert.ok(!text.includes(placeholder), `Editor text must not insert "${placeholder}"`);
  assert.ok(
    text.includes(expectedFile) || joined.includes(expectedFile),
    `Expected file "${expectedFile}" to be completed or listed`,
  );
});

Then("the editor does not insert {string}", function (this: TestWorld, proseHint: string) {
  assert.ok(this.editor, "Editor must be initialized");
  assert.ok(
    !this.editor.getText().includes(proseHint),
    `Editor text must not insert prose hint "${proseHint}"`,
  );
});
