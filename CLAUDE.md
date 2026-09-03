@AGENTS.md

# Claude Code routing for this repo

The org above is the LindaData executive layer. Two business units live in this repo:

- **World Cup 2026 Forecasting Hub** (repo root, `docs/`, `R/`, `apps/web/`) — routed by `AGENTS.md`.
- **PitchFlap Studio** (`apps/ios-flappy/`) — the iOS game studio. Its charter, org chart, gates, and KPIs are in `apps/ios-flappy/STUDIO.md`. Its agents are the `studio-*` entries in `.claude/agents/`. Start a studio sprint with `/studio`.

When a task touches `apps/ios-flappy/`, route it through the studio producer (`studio-producer`) rather than the forecasting lanes. The path-scoped rules in `.claude/rules/ios-flappy.md` apply automatically to any file under that directory.
