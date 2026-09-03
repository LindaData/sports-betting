# PitchFlap Studio — Charter

PitchFlap Studio is a business unit of LindaData that builds, tunes, and ships one-tap arcade games for iPhone, starting with PitchFlap. It runs as a company of Claude Code agents under the LindaData executive layer in `AGENTS.md`. This file is the studio's operating system: who decides what, what the stage gates are, what gets measured, and what a sprint looks like.

The design is grounded in `studio/research/01`–`04`. Where a number below has a source, it is there.

## 1. Owner and decision rights

**ChefHands / Sergio Mora** owns the studio and makes every gate decision, every spend decision, and every App Store submission. Agents prepare decisions; they do not make them.

Human-only work, by evidence from teams that shipped with agents: playtesting *feel* on a real device, gate sign-off, App Store review correspondence, and anything that costs money.

## 2. Org chart

| Agent | Owns | Reports into (LindaData lane) | May edit |
|---|---|---|---|
| `studio-producer` | Sprint briefs, task sizing, gate memos, go/no-go prep, risk log | Chief of Staff, COO | `studio/sprints/`, `studio/gates/` |
| `studio-designer` | Feel, difficulty curve, mechanics, first-session design, design notes | CDO (models the game as a system) | `Tuning.swift`, `studio/design/` |
| `studio-engineer` | All Swift, SpriteKit, SwiftUI, Xcode project, event plumbing | CTO | `apps/ios-flappy/**` in a worktree |
| `studio-reviewer` | Adversarial code review, on-device test plans; the last check before a build is spent | CTO, CSO/CIO | nothing (read-only) |
| `studio-release` | Signing steps, TestFlight, App Store Connect, privacy manifest and label, review-risk assessment, SDK gate | CTO, CSO/CIO | `project.pbxproj`, `project.yml`, `PrivacyInfo.xcprivacy`, `studio/releases/` |
| `studio-analyst` | Event schema, experiments, power, gate metrics, retention and difficulty models, morning KPI review, later monetisation economics | CDO, CFO | `studio/analytics/`, `studio/experiments/` |
| `studio-art` | Palette, procedural art specs, icon, screenshots, store listing and keywords, distinctness from Flappy Bird | CMO/PRO | `Palette.swift`, `studio/art/`, `studio/store/` |

Seven agents. The research (01 §1, §6) collapses fifteen industry roles into five functions for a solo founder; the studio adds a read-only reviewer because builds are the scarcest resource, and a release/compliance specialist because App Store rejection is the single most-cited failure mode for AI-built apps.

Orchestration lives in the `/studio` skill, which runs in the owner's main session: it asks the producer for a brief, fans tasks out to the other agents in parallel where the brief allows, routes every code change through the reviewer, and closes with a gate memo. Subagents cannot spawn subagents, so nothing else orchestrates.

## 3. Stage gates

Each gate has numeric exit criteria. The producer will not write "advance" in a gate memo without the numbers, and "not measured" is an acceptable and honest value.

| Gate | Name | Exit criteria | Money | Source |
|---|---|---|---|---|
| **G0** | Buildable | Compiles on the owner's Mac; runs on device; `PrivacyInfo.xcprivacy` and export-compliance key in place; no "Flappy" anywhere user-facing | $0 | research 03 |
| **G1** | Prototype | Owner plays 20 runs without a bug; first-session milestones instrumented locally (`first_tap`, `first_death`, `first_score_1`, `first_score_5`, `first_retry`); reviewer test plan passed | $99 Developer Program | research 01 §6 |
| **G2** | Marketability | 6-day CPI test on Facebook/TikTok: **pass ≤ $0.40 CPI, kill ≥ $0.50**; TestFlight external group live | ~$300–500 ad spend, owner-approved | Supersonic, Kwalee (01 §2) |
| **G3** | Retention | 10-day cohort: **D1 ≥ 35%, playtime ≥ 600 s/day**; stop-and-fix below 25% D1; crash-free sessions ≥ 99.5% | $0 beyond G2 | Supersonic, GGA (01 §2, 04 §6) |
| **G4** | Soft launch | ≥ 14 days, ideally 60: **D7 ≥ 10–13%**, ad ARPDAU ≥ $0.05 if ads are on, crash-free ≥ 99.5%; first pre-registered experiments read out | ad SDK decision; Small Business Program enrolled before any IAP | 01 §2–3, 03 §5 |
| **G5** | Global | LTV ≥ 1.5× CPI; three months of content updates pre-planned at a 2–4 week cadence | scaled UA, owner-approved | Voodoo 150% ROAS (01 §2) |

Expectation setting: Voodoo launches ~4 of ~1,000 prototypes; hyper-casual lifetime ARPU is $0.86. **The studio is built for cheap kills.** Killing at G2 or G3 is a normal outcome, and the engine, analytics pipeline, and release checklist are reused for the next one-tap prototype.

## 4. KPI board

Reviewed by the owner in the morning flow, prepared by `studio-analyst`, five minutes on a phone.

**Daily:** DAU, new installs, crash-free sessions (target ≥ 99.5%), D1 for the cohort installed two days ago, runs per session, median run duration, median and P90 score, first-run gate-1 pass rate, share of sessions under 50 fps, anomaly flags against a 7-day baseline.

**Weekly:** D1/D7 by install cohort and app version, sessions per DAU (industry ≈ 4), DAU/MAU (20% good, 30% excellent), per-gate hazard curve *h(k)* against the design intent, score-distribution fit diagnostics, experiment readouts with sequential bounds, ad ARPDAU once ads exist.

**The leading indicator the studio bets on:** first-session runs-before-quit and the fraction of players reaching score 5 within three attempts. The literature says first-session progress is the best simple predictor of D7; the analyst confirms or replaces it from our own data in the first weeks.

## 5. Measurement rules

- Every run is stamped with the full tuning dictionary (`config_snapshot`). No experiment without it.
- One variable per experiment. A design note that changes two goes back to the designer.
- Experiments are pre-registered on an experiment card (metric, MDE, n, stopping rule) before data arrives. Only first-session behavioural metrics are powered below ~5k DAU; D7 experiments are not, and the card must say so.
- Identity is a random install UUID. No IDFV, no IDFA, no accounts, no ATT prompt, no third-party tracking SDK. The App Privacy label stays at "Data Not Collected" (v1) or "Data Not Linked to You" (with telemetry).
- Median over mean for scores and run lengths.

## 6. Cost rules (CFO lane)

Everything is $0 until G1's Developer Program fee. G2's ad spend and any paid SDK or service require the owner's explicit approval in the sprint brief's owner-items list, with the amount. Native and free first: SpriteKit over an engine, MetricKit over a crash SDK, Supabase + DuckDB (already operated) over a paid analytics vendor.

## 7. Sprint shape

A sprint is up to five working days and drives toward exactly one gate.

1. Owner states a goal (or `/studio` with no arguments asks the producer for the next one).
2. `studio-producer` writes the brief: gate, tasks by agent, dependencies, owner items, non-goals.
3. Independent tasks run in parallel: design notes, art specs, analytics cards, release checklists.
4. `studio-engineer` implements from notes, in a worktree, reporting COMPILED or NOT COMPILED.
5. `studio-reviewer` reviews every diff and writes the device test plan. A `fix-first` verdict loops back to the engineer.
6. Owner builds once, plays the test plan, reports.
7. `studio-producer` writes the gate memo: numbers, evidence, advance / iterate / kill, biggest risk.

## 8. Definition of done for any change

- Reviewer verdict `ship`, and the owner has run the test plan on a device.
- Every constant in `Tuning.swift` with a unit; every colour in `Palette.swift`.
- PR body states whether the Swift was compiled and on what.
- No credential, team ID, or signing material in the diff (the repo hook enforces this).
- The word "Flappy" appears nowhere user-facing.
- `AGENTS.md`, `STUDIO.md`, and the agent files stay consistent with each other.

## 9. Standing risks

| Risk | Why it matters | Mitigation owner |
|---|---|---|
| 4.3(b) clone rejection | Expanded June 2026; original solo games have been refused | `studio-art` (distinct identity), `studio-release` (Notes for Review, authorship proof) |
| Unverified Swift from cloud sessions | No toolchain on Linux; a bad push wastes the owner's build | `studio-engineer` (honest COMPILED flag), `studio-reviewer` (compile-as-the-reviewer pass) |
| Underpowered experiments | Indie DAU cannot move D7 in a month | `studio-analyst` (power stated on every card) |
| Silent scope growth | One-tap games die of features | `studio-producer` (non-goals in every brief) |
| Attention-cliff revenue | Vibe-coded hits went to $0/mo when attention lapsed | `studio-analyst` (retention over downloads), G5's pre-planned update calendar |

## 10. Where things live

```
apps/ios-flappy/
  STUDIO.md                 this charter
  CLAUDE.md                 game context for Claude Code (loads when files here are read)
  PitchFlap/                the game
  studio/
    research/               01–04, the evidence
    templates/              sprint-brief, gate-memo, experiment-card, release-checklist
    sprints/  gates/        producer output
    design/                 designer notes
    art/  store/            art specs, listing copy
    analytics/  experiments/ schema, scripts, cards
    releases/               per-version checklists
.claude/
  agents/studio-*.md        the seven agents
  skills/studio/SKILL.md    /studio
  rules/ios-flappy.md       conventions, path-scoped
  hooks/check-secrets.sh    commit guard
```
