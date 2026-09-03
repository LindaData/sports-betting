# Research 01 — Studio structure, pipeline gates, and benchmarks

*Compiled 2026-09-03 for PitchFlap Studio. Web research, 2024–2026 sources preferred. Most numbers come from indexed excerpts because the research sandbox could not fetch full pages on many publisher domains; treat every figure as order-of-magnitude and verify before spending money.*

## 1. Roles in a real hyper-casual studio, and what survives for a solo founder

Hyper-casual studios are tiny. The "big studio" org chart is split between a 2–4 person *studio* and a *publisher* that supplies the rest. Voodoo's publishing manager: they "prototype hybrid-casual games in six weeks and test them for ten days with only a three-person team" ([PocketGamer.biz](https://www.pocketgamer.biz/corentin-selz-voodoo-from-hypercasual-to-hybrid-casual/)). A typical outsourced team is "project manager, producer, 2 front-end developers, UI/UX designer, and QA" ([Game-Ace](https://game-ace.com/hyper-casual-game-development/)).

| Role | Owns day to day | Deliverables |
|---|---|---|
| Producer | Budget, schedule, allocation, "ensuring that the game meets its financial and quality targets" ([BOSS Magazine](https://thebossmagazine.com/post/key-roles-in-video-game-development-in-2024/)) | Milestone plan, go/no-go memos, risk log |
| Game designer | "Creating, balancing and tuning game mechanics, game difficulty and UI flow" ([Lowpixel via gamejobs.co](https://gamejobs.co/Game-Designer-with-hypercasual-experience-Remote-at-Lowpixel-Studios)) | One-page GDD, difficulty-curve spec, tuning tables |
| Level / economy designer | Folds into game designer in HC; 1–3 levels for a CPI test, 4–10 for retention ([Kwalee](https://www.kwalee.com/blog/how-get-your-game-published-kwalee-guide)) | Level list, reward/skin sheet |
| Gameplay engineer | Core loop, physics, feel; prototype in "3 to 7 days" ([Game-Ace](https://game-ace.com/hyper-casual-game-development/)) | Playable build, tuning hooks |
| Build/release engineer | Certificates, TestFlight, submission. A Claude-Code-built iOS app needed "3 Apple rejections and 5 hours of certificate debugging" ([Świderski, dev.to](https://dev.to/asvid/look-at-me-im-the-ios-developer-now-icj)) | Signed builds, release checklist, store listing |
| QA | Test strategy, regression, device matrix; global-launch guides cite <1% crash rate as a gate ([Game-Ace](https://game-ace.com/blog/game-development-stages/)) | Test plan, bug DB, crash report |
| Art director / UI-UX | Readability of the one-tap loop; Crossy Road's success credited to "clarity and consistency in all facets of the game" ([Game Developer](https://www.gamedeveloper.com/design/what-design-lessons-can-we-learn-from-crossy-road-)) | Sprites, icon, screenshots, store video |
| Audio | Tap/score/death SFX; rarely a dedicated HC hire | SFX pack |
| Analytics / data scientist | Funnels install → first session → core loop; retention session 1 → D1 → D7 → D30; where players fail and retry ([GeneralistProgrammer](https://generalistprogrammer.com/tutorials/game-analytics-complete-data-tracking-guide-2025), [devtodev](https://docs.devtodev.com/scenarios-and-best-practices/hypercasual)) | Event schema, dashboards, cohort reports |
| Monetization / live-ops | Ad placement, frequency caps, A/B tests; HC content cadence "every two to four weeks" ([Game-Ace](https://game-ace.com/blog/game-development-stages/)) | Ad config, event calendar, A/B results |
| UA / growth | Daily campaign iteration ([East Side Games](https://www.eastsidegames.com/ua-manager/)) | CPI tests, creative briefs, ROAS |
| ASO / marketing | Store text/graphics, keywords, Custom Product Pages ([Original Games](https://originalgames.io/aso-manager)) | Keyword set, screenshot variants |
| Publishing manager | "Own the publishing lifecycle… soft launch, global launch, live operations" plus P&L ([Voodoo listing](https://pitchmeai.com/jobs/voodoo/senior-publishing-manager-south-korea-t534h6wd2t)) | Gate decisions |
| Legal / compliance | ATT prompt, privacy manifest, GDPR consent via UMP, under-age tagging ([Secure Privacy](https://secureprivacy.ai/blog/mobile-app-consent-ios-2025), [AdMob GDPR](https://developers.google.com/admob/ios/privacy/gdpr)) | Privacy labels, consent flow |
| Finance | $99/yr program; 15% commission under Small Business Program below $1M ([SplitMetrics](https://splitmetrics.com/blog/google-play-apple-app-store-fees/), [Apple](https://developer.apple.com/app-store/small-business-program/)) | P&L, LTV:CPI model |

**Collapse for a solo founder + agents:** five functions. (a) Producer/gatekeeper. (b) Designer + tuner. (c) Gameplay + build engineer. (d) QA + release. (e) Analytics + monetization. Skip dedicated audio, community, UA-at-scale, and finance beyond a spreadsheet. Level design folds into design because a Flappy-style game has one level. ASO is a deliverable, not a role.

**Human-only work** (from practitioners who shipped with agents): playtesting *feel*, final gate decisions, App Store review correspondence, and simulator GUI verification. Agents "cannot decide if [mechanics] deserve to exist, and cannot feel qualitative feedback from playtesting" ([Josh English](https://medium.com/@jengas/shipping-games-with-ai-coding-agents-7676c69f85f8)).

## 2. Pipeline and cadence

- **Ideation.** Rollic "tests hundreds of prototypes monthly" ([PocketGamer.biz](https://www.pocketgamer.biz/how-rollic-scored-a-100m-hybridcasual-hit-by-ideating-1000-games-a-month/)). Voodoo "tests around 1,000 prototypes each year, but only about 0.4% — approximately four games per year — make it to full launch" ([Udonis](https://www.blog.udonis.co/mobile-marketing/mobile-games/voodoo)).
- **Prototype: 3–7 days** HC, ~6 weeks hybrid ([Game-Ace](https://game-ace.com/hyper-casual-game-development/)).
- **CPI / marketability test: ~6 days.** "The learning phase on Facebook takes 3-4 days before CPIs stabilize" ([Supersonic](https://supersonic.com/learn/blog/how-to-run-a-cpi-test-the-facebook-edition/)). The three test KPIs are CPI, D1 retention, playtime; target "CPI under $0.30" ([Supersonic](https://supersonic.com/learn/blog/the-3-most-important-kpis-for-testing-your-hyper-casual-prototype)). Voodoo extends support at "$0.20 CPI and 30% D1 retention on Android or 30¢ and 30% D1 on iOS" ([Vectra Play](https://vectraplay.com/blog/what-voodoo-looks-for-prototype)); an older figure was "45% D1, 13% D7, and $0.20 CPI" ([GameAnalytics](https://www.gameanalytics.com/blog/how-voodoo-diversified-and-lowered-game-product-kpis)), so thresholds loosened 2021–2024 as the genre went hybrid. A "$0.50" CPI prototype "failed to launch" ([Supersonic](https://supersonic.com/learn/blog/why-your-hyper-casual-prototype-failed-the-marketability-test-and-how-to-improve-the-next-iteration)).
- **Iteration: 5–10 working days** per loop, adding gameplay and first monetisation ([Kwalee](https://www.kwalee.com/blog/how-get-your-game-published-kwalee-guide)).
- **Soft launch: 2–8 weeks.** "Fourteen continuous days is the floor" ([Game-Ace](https://game-ace.com/blog/game-development-stages/)); for D30 cohorts "budget at least 60 days"; "D1 below 25% on Android triggers a stop-and-fix cycle"; "projected LTV should support a CPI at 30% to 70% of it" ([Game Growth Advisor](https://gamegrowthadvisor.com/blog/2025-12-16-mobile-soft-launch-complete-guide/)). Voodoo's bar: "a sustainable ROAS of at least 150%" ([Udonis](https://www.blog.udonis.co/mobile-marketing/mobile-games/voodoo)).
- **Global + live ops.** Gates cited: "steady 40% Day 1 retention rate and keeping crash rates below 1%"; "an event designed today will not ship for two to four weeks" ([Game-Ace](https://game-ace.com/blog/game-development-stages/)).

## 3. Benchmarks

| Metric | Value | Segment / date | Source |
|---|---|---|---|
| D1, all HC | ~24% iOS / 23% Android | Q4 2022 | [Tenjin & GameAnalytics via GWO](https://gameworldobserver.com/2023/02/01/tenjin-and-gameanalytics-release-q4-hyper-casual-games-benchmark-report) |
| D1 / D7, top-2% HC | 45% / 19% iOS; 38% / 14% Android | Q4 2022 | same |
| D1, all mobile (11,600 apps) | 22% median; top quartile 31–33% iOS | 2025 | [GameAnalytics 2025](https://www.gameanalytics.com/reports/2025-mobile-gaming-benchmarks), [via Segwise](https://segwise.ai/blog/mobile-gaming-app-user-retention-strategies) |
| D7, all mobile | median 3.4–3.9%; top quartile 7–8% | 2024/25 | [GameAnalytics via gamedevreports](https://gamedevreports.substack.com/p/gameanalytics-mobile-gaming-benchmarks) |
| Arcade genre | leads D1, "problems with long-term retention" | 2025 | [GameAnalytics 2025](https://www.gameanalytics.com/reports/2025-mobile-gaming-benchmarks) |
| HC "timing" sub-genre (closest to Flappy) | D1 44%; ARPDAU $0.15; IAP conv 0.94% | top-5%, ~2021 | [GameAnalytics](https://www.gameanalytics.com/blog/the-metrics-behind-hyper-casual-games-industry-report) |
| HC D1/D7/D30 (generic) | 25–35% / 5–10% / 1–3% | 2026 | [Game Growth Advisor](https://gamegrowthadvisor.com/blog/2026-03-17-mobile-game-retention-strategies-2026/) |
| Hybrid-casual publisher bar | D1 30–35% viable, 40% strong, 45%+ excellent; D7 15–20% | 2025 | [Tap Nation](https://www.tap-nation.io/blog/kpis-that-matter-metrics-to-track-in-hybrid-casual-games/) |
| Session length | median 5–6 min; top-25% 8–9 min | 2024 | [gamedevreports](https://gamedevreports.substack.com/p/gameanalytics-mobile-gaming-benchmarks) |
| Sessions/day | ~4 | 2024 | same |
| Playtime gate (prototype) | 600–1300 s/day | 2020–24 | [Supersonic case studies](https://supersonic.com/learn/case-studies/bazooka-boy/) |
| Ad ARPDAU, HC blended | $0.03–$0.08 | 2025 | [Gamesforum Intelligence](https://investgame.net/wp-content/uploads/2025/07/Gamesforum-Intelligence-Hypercasual-Gaming-Report.pdf) |
| Lifetime ARPU, HC | $0.86 | 2025 | [Appodeal via ADM](https://appdevelopermagazine.com/mobile-casual-benchmarks-report-2025/) |
| CPI, HC prototype target | <$0.30 | 2024 | [Supersonic](https://supersonic.com/learn/blog/the-3-most-important-kpis-for-testing-your-hyper-casual-prototype) |
| CPI, HC median | $0.42 iOS / $0.20 Android | Q4 2022 | [Tenjin via GWO](https://gameworldobserver.com/2023/02/01/tenjin-and-gameanalytics-release-q4-hyper-casual-games-benchmark-report) |
| CPI, HC at scale | $2.50 iOS / $1.50 Android vs LTV ≈ $2.80 | 2025 | [Gamesforum](https://investgame.net/wp-content/uploads/2025/07/Gamesforum-Intelligence-Hypercasual-Gaming-Report.pdf) |
| CPI, all mobile games | $4.22 iOS / $2.97 Android | 2026 | [Game Growth Advisor](https://gamegrowthadvisor.com/blog/2026-03-17-user-acquisition-cpi-benchmarks-2026/) |

**Contradictions.** CPI differs 10× between a prototype test (Facebook → Android, $0.20–0.40) and scaled iOS UA ($1.41–$4.22). HC genre retention has not been broadly republished since 2022 ([Segwise](https://segwise.ai/blog/mobile-gaming-app-user-retention-strategies)). No published retention data exists for Flappy Bird itself; the GameAnalytics "timing" sub-genre is the nearest proxy.

**Synthesised thresholds.** Publishable: CPI ≤ $0.30–0.40, D1 ≥ 35%, playtime ≥ 10 min/day, D7 ≥ 10–13%. Kill: CPI ≥ $0.50 with no creative fix, D1 < 25%, or two of {D7 well under target, CPI > LTV, no trajectory change}.

## 4. Why tap-to-flap games work or fail

- **Original's scale.** 50M+ downloads and "$50,000 a day" by Feb 2014 ([Game Developer](https://www.gamedeveloper.com/design/lessons-learned-from-flappy-bird), [CBS](https://www.cbsnews.com/news/flappy-bird-creator-finally-speaks/)). Design intent: "something that people could play with one hand."
- **Honest difficulty, instant retry.** "If you die, it's because you missed with no hidden mechanics" ([Rice](https://dev-housing.rice.edu/tutorials/the-flappy-bird-flappy-bird-myth-everyone-refuses-to-believe-3322083)). "A retry is only two taps away" ([Yoyo Design](https://yoyodesign.com/latest/news/in-a-flap-with-flappy-bird/)). Crossy Road's only death-to-restart friction was "0.5-to-1 second" ([Mobile Dev Memo](https://mobiledevmemo.com/crossy-road-a-case-study-in-mobile-ad-monetization/)).
- **Near-miss.** Well documented in gambling ([PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7214505/)) but "controlled experiments… failed to support the near-miss effect hypothesis" in some settings ([Wikipedia](https://en.wikipedia.org/wiki/Near-miss_effect)). **Contested: instrument it, don't assume it.**
- **Flow, not learning.** The loop "doesn't appear to improve with repetitions" ([Mauro Usability Science](https://www.maurousabilityscience.com/blog/why-flappy-bird-is-was-so-successful-and-popular-but-so-difficult-to-learn-a-cognitive-teardown-of-the-user-experience-ux/)); framed as skill/challenge balance ([SciAm](https://www.scientificamerican.com/article/be-one-with-flappy-bird-the-science-of-flow-in-game-design/)).
- **Virality.** Score sharing to Twitter/Facebook/SMS; low-score screenshots became meme culture; streamers' rage videos were the catalyst ([cpscount](https://cpscount.com/blogs/the-history-of-flappy-bird/), [Academia](https://www.academia.edu/6495540/Flappy_Bird_a_short_viral_marketing_success)).
- **First session.** "Understand the core mechanic within 3 to 5 seconds"; "if the aha moment takes more than 90 seconds, a significant share of users never return"; defer permissions until after first play ([Playio](https://blog.playio.co/mobile-game-onboarding-retention)).
- **Ads.** Death screens are "the single best-performing placement"; "1-2 interstitials per session after the first few sessions"; rewarded revive "increases retention 15-30%" ([AdReact](https://adreact.com/blog/interstitial-ad-best-practices-mobile-games/)). Crossy Road made $3M of its first $10M from *optional* rewarded video only ([Game Developer](https://www.gamedeveloper.com/business/how-i-crossy-road-i-made-1-million-from-video-ads)).
- **Clone risk.** "Over sixty Flappy Bird clones a day" ([Forbes](https://www.forbes.com/sites/insertcoin/2014/03/06/over-sixty-flappy-bird-clones-hit-apples-app-store-every-single-day/)). Apple rejected apps that "leverage a popular app"; "Flappy Dragon" was refused ([MacRumors](https://www.macrumors.com/2014/02/17/flappy-bird-clones-rejected/), [TechCrunch](https://techcrunch.com/2014/02/15/apple-google-begin-rejecting-games-with-flappy-in-the-title/)). **Relevant to the name "PitchFlap": keep branding, art, and store copy distinct from Flappy Bird.** Ketchapp proved the format repeats (ZigZag was #1 iOS game Feb 2015 — [VentureBeat](https://venturebeat.com/2015/03/25/how-one-studio-is-finding-repeated-success-with-flappy-bird-style-games)).

## 5. Solo and AI-assisted game dev, 2025–2026

- **fly.pieter.com**: built in ~3 hours with Cursor/Claude/Grok, "$1M ARR in 17 days", then DDoSed after adding microtransactions, then $0/mo by mid-2026 as attention lapsed ([Coding Beauty](https://medium.com/coding-beauty/vibe-coding-1m-arr-17-days-079cd7fd707a), [Promptway](https://promptway.com/blog/pieter-levels-flight-sim-to-zero), [404 Media](https://www.404media.co/this-game-created-by-ai-vibe-coding-makes-50-000-a-month-yours-probably-wont/)).
- **Void Balls** (2026): 29k lines in 10 days with "8 parallel Claude Code agents… architecture, implementation, game balance, and testing"; the enabler was an MCP that let agents run play mode ([BigDevSoon](https://bigdevsoon.me/blog/building-games-with-ai-indie-game-dev-workflow/)).
- **5-agent studio** shipped a roguelite from "a JSON file and… a directory of JSON files" ([dev.to/yurukusa](https://dev.to/yurukusa/i-ran-a-5-agent-game-studio-with-claude-code-teams-2lpk)). A 49-agent template exists ([GitHub](https://github.com/donchitos/claude-code-game-studios)) — the practitioner consensus is that fewer, well-scoped agents beat many.
- **Native iOS specifics.** Agents "cannot interact with the iOS Simulator GUI"; SwiftUI previews can't render; XcodeBuildMCP / Xcode 26.3's native MCP cut a 24K-token build log to ~600 ([Spaceport](https://spaceport.build/blog/claude-code-ios-development), [FlowDeck](https://flowdeck.studio/blog/2026/04/01/three-ways-to-close-the-ios-agent-loop/)). "A meaningful fraction of AI-driven apps fail review due to privacy or design violations" ([Stanford CodeX](https://law.stanford.edu/2026/04/08/when-claude-code-meets-apples-app-store/)).

## 6. Implications adopted by PitchFlap Studio

1. **Five agents, not fifteen.** Producer/gatekeeper; designer/tuner; gameplay+build engineer; QA+release; analytics+monetization. (The studio adds a compliance reviewer and an art/store agent as narrow specialists because App Store rejection is the single most-cited failure mode for AI-built apps.)
2. **Gates with numbers** (see `STUDIO.md`): G1 prototype ≤7 days and 20 clean runs; G2 CPI test 6 days, pass ≤$0.40, kill ≥$0.50; G3 retention 10 days, D1 ≥35%, playtime ≥600 s/day, stop-and-fix <25%; G4 soft launch ≥14 days, D7 ≥10–13%, ARPDAU ≥$0.05, crash <1%; G5 global at LTV ≥1.5× CPI with 3 months of updates pre-planned.
3. **Instrument from day one**: `run_start`, `first_tap_latency`, `score`, `death_cause`, `gate_index_at_death`, `near_miss_count`, `time_to_retry_ms`, ad and share events; sessions/day, session length, D1/D7/D30, first-session runs-before-quit.
4. **Expectation setting.** Voodoo launches ~4 of ~1,000 prototypes; HC lifetime ARPU is $0.86. The studio is designed for cheap kills and reuse of engine, analytics, and release pipeline across several one-tap prototypes, not for one game succeeding.
