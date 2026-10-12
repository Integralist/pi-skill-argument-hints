# pi-skill-argument-hints

A [Pi](https://pi.dev) extension that displays Claude-compatible `argument-hint`
metadata from loaded `SKILL.md` frontmatter as muted, non-editable inline hint text
while composing skill slash commands.

## How it works

When you compose a canonical skill command (e.g. `/skill:talking-points`), the
extension looks up the skill's frontmatter and renders its `argument-hint` as
muted inline placeholder text right after the cursor.

- **Display-only**: The hint is purely visual. It is never inserted into the
  editor buffer, submitted to the agent, or used for argument validation or
  parsing.
- **Exact matching**: The hint only appears when the editor contains the exact
  complete skill command (`/skill:<name>`) and the cursor is at the end.
- **Auto-hiding**: The hint immediately disappears when typing any arguments,
  a trailing space, or when moving the cursor.
- **Live reload**: Skill hint caches are rebuilt automatically on startup and on
  `/reload`.
- **TUI-only**: The extension only installs in interactive TUI mode; non-TUI
  modes (RPC, print, JSON) remain unaffected.

## Frontmatter specification

Skills define argument hints in their `SKILL.md` YAML frontmatter using the
`argument-hint` key:

```yaml
---
name: talking-points
description: Rank recurring topics for a retro or 1:1.
argument-hint: "[--edit] [--days N]"
---
```

Both Claude Code and this Pi extension read the `argument-hint` field verbatim:
- In Claude Code, it provides placeholder argument hints for slash commands.
- In Pi, it displays the inline hint when typing `/skill:<name>`.

Other frontmatter keys (such as `user-invocable`, `allowed-tools`, etc.) remain
Claude-specific and are ignored by Pi.

### Examples

| Skill | `argument-hint` | Rendered hint |
| --- | --- | --- |
| `talking-points` | `"[--edit] [--days N]"` | `/skill:talking-points [--edit] [--days N]` |
| `execute-plan` | `"<plan-path>"` | `/skill:execute-plan <plan-path>` |
| `tech-docs` | `--new <topic> \| --improve <file>` | `/skill:tech-docs --new <topic> \| --improve <file>` |
| `decide` | `'[short description of the decision]'` | `/skill:decide [short description of the decision]` |
| `teach-with-slides` | `Optional topic to teach` | `/skill:teach-with-slides Optional topic to teach` |
| `recap` | `(optional) a specific thread or task to recap` | `/skill:recap (optional) a specific thread or task to recap` |

## Installation

Install using Pi's package manager:

```bash
pi install git:github.com/Integralist/pi-skill-argument-hints
```

Or load during development:

```bash
pi -e path/to/pi-skill-argument-hints/src/index.ts
```

## Development

```bash
# Run unit and Cucumber.js acceptance tests
make test

# Type-check TypeScript sources
make typecheck

# Run test suite and type check
make verify

# Launch a live Pi session with this extension and sample skills
make try
```

## License

MIT
