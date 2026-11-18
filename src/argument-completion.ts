import {
  type AutocompleteProvider,
  fuzzyFilter,
} from "@earendil-works/pi-tui";

export interface ParsedFlag {
  flag: string;
  valueHint: string | undefined;
  expectsPath: boolean;
}

export interface ParsedArgumentHint {
  flags: ParsedFlag[];
  expectsPath: boolean;
}

const PATH_HINT_PATTERN = /path|file|dir|folder|directory/i;
const FLAG_PATTERN =
  /(?:^|[\s\[(|,])(--[a-zA-Z0-9][a-zA-Z0-9_-]*|-[a-zA-Z0-9])(?:(?:[ \t]+|=)(<[^>]+>|\[(?![-\s])[^\]]+\]|[A-Z][A-Z0-9_-]*))?/g;
const PATH_PLACEHOLDER_ONLY_PATTERN =
  /^(?:<[^>]+>|\[[^\s\]]+\])(?:\s+(?:<[^>]+>|\[[^\s\]]+\]))*$/;
const SKILL_ARGS_LINE_PATTERN = /^\s*(\/skill:[^\s]+)\s+(.*)$/;

export function parseArgumentHint(hint: string): ParsedArgumentHint {
  const trimmed = hint.trim();
  if (!trimmed) {
    return { flags: [], expectsPath: false };
  }

  const flags: ParsedFlag[] = [];
  const seen = new Set<string>();

  for (const match of trimmed.matchAll(FLAG_PATTERN)) {
    const flag = match[1];
    if (!flag || seen.has(flag)) {
      continue;
    }
    seen.add(flag);
    const valueHint = match[2];
    const expectsPath = valueHint !== undefined && PATH_HINT_PATTERN.test(valueHint);
    flags.push({ flag, valueHint, expectsPath });
  }

  const expectsPath =
    flags.length === 0 &&
    PATH_PLACEHOLDER_ONLY_PATTERN.test(trimmed) &&
    PATH_HINT_PATTERN.test(trimmed);

  return { flags, expectsPath };
}

function getSkillArgContext(
  lines: string[],
  cursorLine: number,
  cursorCol: number,
  hints: ReadonlyMap<string, string>,
): {
  parsed: ParsedArgumentHint;
  currentToken: string;
  priorTokens: string[];
} | null {
  if (cursorLine !== 0) {
    return null;
  }

  const line = lines[0] ?? "";
  const beforeCursor = line.slice(0, cursorCol);
  const match = beforeCursor.match(SKILL_ARGS_LINE_PATTERN);
  if (!match) {
    return null;
  }

  const commandKey = match[1];
  const argText = match[2] ?? "";
  if (!commandKey) {
    return null;
  }

  const rawHint = hints.get(commandKey);
  if (!rawHint) {
    return null;
  }

  const parsed = parseArgumentHint(rawHint);
  const trailingMatch = argText.match(/(?:^|\s)([^\s]*)$/);
  const currentToken = trailingMatch?.[1] ?? "";
  const priorText = argText.slice(0, argText.length - currentToken.length).trim();
  const priorTokens = priorText ? priorText.split(/\s+/) : [];

  return { parsed, currentToken, priorTokens };
}

export function createHintAutocompleteProvider(
  current: AutocompleteProvider,
  hints: ReadonlyMap<string, string>,
): AutocompleteProvider {
  return {
    ...(current.triggerCharacters && { triggerCharacters: current.triggerCharacters }),

    async getSuggestions(lines, cursorLine, cursorCol, options) {
      const ctx = getSkillArgContext(lines, cursorLine, cursorCol, hints);
      if (!ctx) {
        return current.getSuggestions(lines, cursorLine, cursorCol, options);
      }

      const { parsed, currentToken, priorTokens } = ctx;
      if (parsed.flags.length === 0) {
        return current.getSuggestions(lines, cursorLine, cursorCol, options);
      }

      const prevToken = priorTokens[priorTokens.length - 1];
      const prevFlag = prevToken
        ? parsed.flags.find((f) => f.flag === prevToken)
        : undefined;
      if (prevFlag?.expectsPath && !currentToken.startsWith("-")) {
        return current.getSuggestions(lines, cursorLine, cursorCol, options);
      }

      if (!options.force && !currentToken.startsWith("-")) {
        return current.getSuggestions(lines, cursorLine, cursorCol, options);
      }

      const usedFlags = new Set(priorTokens.map((t) => t.split("=")[0]));
      const unusedFlags = parsed.flags.filter((f) => !usedFlags.has(f.flag));
      if (unusedFlags.length === 0) {
        return current.getSuggestions(lines, cursorLine, cursorCol, options);
      }

      const matched = fuzzyFilter(unusedFlags, currentToken, (f) => f.flag);
      if (matched.length === 0) {
        return current.getSuggestions(lines, cursorLine, cursorCol, options);
      }

      return {
        prefix: currentToken,
        items: matched.map((f) => ({
          value: f.flag,
          label: f.flag,
          ...(f.valueHint !== undefined && { description: f.valueHint }),
        })),
      };
    },

    applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
      const ctx = getSkillArgContext(lines, cursorLine, cursorCol, hints);
      if (
        ctx &&
        !prefix.startsWith("@") &&
        !prefix.includes("/") &&
        ctx.parsed.flags.some((f) => f.flag === item.value)
      ) {
        const line = lines[cursorLine] ?? "";
        const beforePrefix = line.slice(0, cursorCol - prefix.length);
        const afterCursor = line.slice(cursorCol);
        const needsSpace = afterCursor.length === 0 || !/^\s/.test(afterCursor);
        const inserted = needsSpace ? `${item.value} ` : item.value;
        const nextLines = [...lines];
        nextLines[cursorLine] = `${beforePrefix}${inserted}${afterCursor}`;
        return {
          lines: nextLines,
          cursorLine,
          cursorCol: beforePrefix.length + inserted.length,
        };
      }

      return current.applyCompletion(lines, cursorLine, cursorCol, item, prefix);
    },

    shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
      const ctx = getSkillArgContext(lines, cursorLine, cursorCol, hints);
      if (ctx && (ctx.parsed.flags.length > 0 || ctx.parsed.expectsPath)) {
        return true;
      }
      return current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ?? true;
    },
  };
}
