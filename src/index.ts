import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { ArgumentHintsEditor } from "./editor.ts";
import { extractArgumentHint } from "./hint-extractor.ts";

export { ArgumentHintsEditor } from "./editor.ts";
export { extractArgumentHint, extractArgumentHintFromContent } from "./hint-extractor.ts";

export function buildHintCache(pi: ExtensionAPI): Map<string, string> {
  const hints = new Map<string, string>();
  try {
    const commands = pi.getCommands();
    for (const cmd of commands) {
      if (cmd.source !== "skill") continue;

      const skillPath = cmd.sourceInfo?.path;
      if (!skillPath) continue;

      try {
        const hint = extractArgumentHint(skillPath);
        if (hint) {
          const skillName = cmd.name.startsWith("skill:")
            ? cmd.name.slice("skill:".length)
            : cmd.name;
          const invocation = `/skill:${skillName}`;
          hints.set(invocation, hint);
        }
      } catch {
        // Ignore single skill read error
      }
    }
  } catch {
    // Ignore command collection error
  }
  return hints;
}

export default function (pi: ExtensionAPI): void {
  const hintCache = new Map<string, string>();

  pi.on("session_start", (_event, ctx) => {
    // Rebuild cache on startup and reload
    const updated = buildHintCache(pi);
    hintCache.clear();
    for (const [cmd, hint] of updated) {
      hintCache.set(cmd, hint);
    }

    // Only install custom editor in TUI mode
    if (!ctx.hasUI || typeof ctx.ui?.setEditorComponent !== "function") {
      return;
    }

    ctx.ui.setEditorComponent((tui, theme, kb) => {
      return new ArgumentHintsEditor(tui, theme, kb, hintCache, ctx.ui);
    });
  });
}
