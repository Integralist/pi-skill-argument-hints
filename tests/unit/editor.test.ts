import { describe, it } from "node:test";
import assert from "node:assert";
import { ArgumentHintsEditor } from "../../src/editor.ts";
import { visibleWidth } from "@earendil-works/pi-tui";

function createEditor(hints: Map<string, string>, paddingX = 0) {
  const tui = { terminal: { rows: 24, columns: 80 } };
  const theme = { borderColor: (s: string) => s, selectList: {} as any };
  const kb = { matches: () => false, getKeys: () => [] } as any;
  const mockUI = {
    theme: {
      fg: (_color: string, text: string) => `\x1b[90m${text}\x1b[39m`,
    },
  };
  const ed = new ArgumentHintsEditor(tui as any, theme, kb, hints, mockUI as any, { paddingX });
  ed.focused = true;
  return ed;
}

describe("ArgumentHintsEditor rendering", () => {
  const hints = new Map<string, string>([
    ["/skill:talking-points", "[--edit] [--days N]"],
    ["/skill:execute-plan", "<plan-path>"],
    ["/skill:tech-docs", "--new <topic> | --improve <file>"],
  ]);

  it("renders muted hint at ordinary width (80 cols)", () => {
    const ed = createEditor(hints);
    ed.setText("/skill:talking-points");
    const lines = ed.render(80);
    const content = lines[1]!;

    assert.ok(content.includes("[--edit] [--days N]"));
    assert.strictEqual(visibleWidth(content), 80);
  });

  it("truncates hint gracefully at narrow width (35 cols)", () => {
    const ed = createEditor(hints);
    ed.setText("/skill:talking-points");
    const lines = ed.render(35);
    const content = lines[1]!;

    assert.strictEqual(visibleWidth(content), 35);
    // Command is 21 cols + 1 cursor = 22 cols used. Remaining = 13 cols.
    // Full hint is 19 chars, so it should be truncated to 13 chars
    assert.ok(content.includes("[--edit] [--d"));
  });

  it("omits hint entirely when width cannot fit any hint text (22 cols)", () => {
    const ed = createEditor(hints);
    ed.setText("/skill:talking-points");
    const lines = ed.render(22);
    const content = lines[1]!;

    assert.strictEqual(visibleWidth(content), 22);
    assert.ok(!content.includes("[--edit]"));
  });

  it("does not render hint on multiline buffer", () => {
    const ed = createEditor(hints);
    ed.setText("/skill:talking-points\nanother line");
    const lines = ed.render(80);

    for (const line of lines) {
      assert.ok(!line.includes("[--edit] [--days N]"));
    }
  });

  it("does not render hint when cursor moves left (not at end)", () => {
    const ed = createEditor(hints);
    ed.setText("/skill:talking-points");
    // Move cursor 5 positions left
    ed.handleInput("\x1b[D");
    const lines = ed.render(80);
    const content = lines[1]!;

    assert.ok(!content.includes("[--edit] [--days N]"));
  });

  it("renders hint when skill command has trailing space from autocomplete", () => {
    const ed = createEditor(hints);
    ed.setText("/skill:talking-points ");
    const lines = ed.render(80);
    const content = lines[1]!;

    assert.ok(content.includes("[--edit] [--days N]"));
    assert.strictEqual(visibleWidth(content), 80);
  });

  it("does not render hint when arguments are entered", () => {
    const ed = createEditor(hints);
    ed.setText("/skill:talking-points --edit");
    const lines = ed.render(80);
    assert.ok(!lines[1]!.includes("[--edit] [--days N]"));
  });

  it("works with paddingX without overflowing width", () => {
    const ed = createEditor(hints, 2);
    ed.setText("/skill:talking-points");
    const lines = ed.render(80);
    const content = lines[1]!;

    assert.ok(content.includes("[--edit] [--days N]"));
    assert.strictEqual(visibleWidth(content), 80);
  });
});
