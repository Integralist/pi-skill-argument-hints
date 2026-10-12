import {
  CustomEditor,
  type CustomEditorOptions,
  type ExtensionUIContext,
  type KeybindingsManager,
} from "@earendil-works/pi-coding-agent";
import {
  type EditorTheme,
  type TUI,
  truncateToWidth,
  visibleWidth,
} from "@earendil-works/pi-tui";

export class ArgumentHintsEditor extends CustomEditor {
  private hints: Map<string, string>;
  private uiContext?: ExtensionUIContext;

  constructor(
    tui: TUI,
    theme: EditorTheme,
    keybindings: KeybindingsManager,
    hints: Map<string, string>,
    uiContext?: ExtensionUIContext,
    options?: CustomEditorOptions,
  ) {
    super(tui, theme, keybindings, options);
    this.hints = hints;
    this.uiContext = uiContext;
  }

  private styleMuted(text: string): string {
    const activeTheme = this.uiContext?.theme;
    if (activeTheme && typeof activeTheme.fg === "function") {
      return activeTheme.fg("muted", text);
    }
    return `\x1b[90m${text}\x1b[39m`;
  }

  override render(width: number): string[] {
    const lines = super.render(width);

    // Only single-line exact commands with cursor immediately after the command
    const text = this.getText();
    const cursor = this.getCursor();

    if (cursor.line !== 0 || cursor.col !== text.length) {
      return lines;
    }

    if (this.getLines().length !== 1) {
      return lines;
    }

    const commandKey = text.endsWith(" ") ? text.trimEnd() : text;
    const hint = this.hints.get(commandKey);
    if (!hint) {
      return lines;
    }

    if (lines.length < 3) {
      return lines;
    }

    // line 0 is top border, line 1 is single-line content
    const line = lines[1];
    if (line === undefined) {
      return lines;
    }

    const cursorStr = "\x1b[7m \x1b[0m";
    let cursorIdx = line.indexOf(cursorStr);
    let afterCursorIdx = cursorIdx !== -1 ? cursorIdx + cursorStr.length : -1;

    if (afterCursorIdx === -1) {
      const textIdx = line.indexOf(text);
      if (textIdx !== -1) {
        afterCursorIdx = textIdx + text.length;
      }
    }

    if (afterCursorIdx === -1) {
      return lines;
    }

    const before = line.slice(0, afterCursorIdx);
    const after = line.slice(afterCursorIdx);
    const paddingSpaces = visibleWidth(after);
    const paddingX = typeof this.getPaddingX === "function" ? this.getPaddingX() : 0;
    const availableWidth = Math.max(0, paddingSpaces - paddingX);

    if (availableWidth <= 0) {
      return lines;
    }

    const displayHint =
      visibleWidth(hint) <= availableWidth
        ? hint
        : truncateToWidth(hint, availableWidth, "");

    if (!displayHint) {
      return lines;
    }

    const styledHint = this.styleMuted(displayHint);
    const remainingSpaces = Math.max(0, paddingSpaces - visibleWidth(displayHint));
    lines[1] = before + styledHint + " ".repeat(remainingSpaces);

    return lines;
  }
}
