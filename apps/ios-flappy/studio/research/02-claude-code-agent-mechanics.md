# Research 02 — Claude Code mechanics the studio is built on

*Compiled 2026-09-03 from the official Claude Code docs. This is the reference for why the studio's files live where they live. Where the docs are silent, it says so.*

## Subagents (`.claude/agents/<name>.md`)

Discovery precedence: managed settings → `--agents` flag → `.claude/agents/` (project) → `~/.claude/agents/` (user) → plugin agents. Project agents win on a name collision. ([sub-agents](https://code.claude.com/docs/en/sub-agents.md))

Required frontmatter: `name` (lowercase-hyphen), `description` (Claude reads this to decide when to delegate automatically, so it must say *when to use* the agent, not just what it is).

Optional frontmatter used by this studio:

| Field | Values | Studio use |
|---|---|---|
| `tools` | comma-separated allowlist; `Agent(name, …)` to permit spawning named agents | Every agent gets the minimum it needs |
| `disallowedTools` | denylist | Reviewers and compliance cannot `Write`/`Edit` |
| `model` | `sonnet`, `opus`, `haiku`, `fable`, full model ID, or omit to inherit | Engineering and review inherit; documentation agents use `sonnet` |
| `permissionMode` | `default`, `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`, `plan` | Left at default; the owner's session setting governs |
| `skills` | list of skill names preloaded into the agent | Release and analytics agents preload their checklists |
| `memory` | `user`, `project`, `local` | Producer keeps `project` memory of gate decisions |
| `maxTurns` | integer | Caps runaway agents |
| `isolation` | `worktree` | Engineer runs in a worktree so parallel edits don't collide |
| `effort` | `low`–`max` | Reviewer runs `high` |
| `hooks` | per-agent lifecycle hooks | Not used; repo-level hooks suffice |

**Undocumented:** whether `.claude/agents/` in a *subdirectory* (e.g. `apps/ios-flappy/.claude/agents/`) is loaded when Claude Code is opened at the repo root. The studio therefore keeps all agents at the repo root with a `studio-` prefix.

Subagents run in an isolated context, do not inherit conversation history, do load the CLAUDE.md hierarchy and MCP servers, and return a final report to the caller. Subagents cannot spawn subagents (docs list no such capability), so orchestration is the *parent session's* job — which is what the `/studio` skill does. A spawned agent can be continued with `SendMessage`. ([sub-agents](https://code.claude.com/docs/en/sub-agents.md), [best-practices](https://code.claude.com/docs/en/best-practices.md))

Agent Teams (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) add a shared task list and mailboxes between separate sessions. Disabled by default; the studio does not depend on it. ([agent-teams](https://code.claude.com/docs/en/agent-teams.md))

## Skills (`.claude/skills/<name>/SKILL.md`)

Required: `name`, `description`. Options: `disable-model-invocation: true` (user-only via `/name`), `allowed-tools`, `argument-hint`, `$ARGUMENTS` placeholder in the body, supporting files alongside `SKILL.md`. Skills load into the *calling* agent, or into a subagent via that agent's `skills:` field. ([skills](https://code.claude.com/docs/en/skills.md))

Directory-scoped skills (`apps/web:deploy` form) are mentioned but not documented; the studio uses a plain root-level `/studio` skill.

## Memory files

Claude Code loads `CLAUDE.md` from cwd and every ancestor, root first. **It does not read `AGENTS.md` natively**; the root `CLAUDE.md` therefore starts with `@AGENTS.md`. Subdirectory `CLAUDE.md` files load lazily when files in that directory are read — so `apps/ios-flappy/CLAUDE.md` is the right place for game-specific context. `.claude/rules/*.md` with a `paths:` frontmatter apply only to matching files. `@import` resolves relative to the importing file, max 4 hops. ([memory](https://code.claude.com/docs/en/memory.md))

## Hooks (`.claude/settings.json`)

Events: `SessionStart`, `UserPromptSubmit`, `PreToolUse` (can block, exit 2), `PostToolUse`, `Stop`, `SubagentStart`, `SubagentStop`, and team events. `matcher` is an exact tool name or regex (`Edit|Write`). A command hook receives the tool call as JSON on stdin; exit 2 blocks and returns stdout as feedback. Settings merge: `~/.claude/settings.json` → `.claude/settings.json` (shared) → `.claude/settings.local.json` (personal, gitignored). ([hooks](https://code.claude.com/docs/en/hooks.md), [settings](https://code.claude.com/docs/en/settings-reference.md))

The studio ships one hook: `check-secrets.sh` on `PreToolUse:Bash`, which inspects `git commit` calls and blocks credential files or credential-shaped diffs. A "build before commit" hook was considered and rejected: `xcodebuild` only exists on macOS, and a hook that fails on Linux sessions would block every commit from a cloud session.

## Layout adopted

```
CLAUDE.md                          @AGENTS.md + studio routing (loaded every session)
AGENTS.md                          LindaData executive routing (unchanged, + studio row)
.claude/
  settings.json                    hooks
  hooks/check-secrets.sh
  agents/studio-*.md               the company
  skills/studio/SKILL.md           /studio — run a sprint
  rules/ios-flappy.md              paths: apps/ios-flappy/** — Swift and game conventions
apps/ios-flappy/
  CLAUDE.md                        game context, loaded lazily when files here are read
  STUDIO.md                        charter: org, decision rights, gates, KPIs, cadence
  studio/research/*.md             the evidence behind the design
  studio/templates/*.md            gate memo, sprint brief, experiment card, release checklist
```
