# Research 04 — Analytics, experimentation, and live ops

*Compiled 2026-09-03 for a statistician-founder. Every claim carries a URL. Claims verified only through search snippets are marked **[snippet]**; evidence gaps are **[THIN]**.*

## 1. Instrument from day one

Vendors converge on the same skeleton: a session pair, a progression event with start/fail/complete carrying score and attempt, a custom design event, plus business/ads/error events ([GameAnalytics event types](https://docs.gameanalytics.com/events-metrics-and-filtering/event-types/event-types-introduction/); [Unity Standard Events](https://docs.unity3d.com/2019.4/Documentation/Manual/com.unity.standardevents.html) [snippet]). Amplitude: object-action naming, snake_case, a written tracking plan with an owner per event; "skipping the tracking plan is one of the most expensive mistakes" ([Amplitude](https://amplitude.com/blog/analytics-tracking-practices) [snippet]).

For a Flappy-style game a "level" is a *run* and the "gate" is the unit of difficulty. The non-obvious addition is a **tuning snapshot per run**; without it a score distribution cannot be attributed to the constants that produced it.

| Event | Properties | Priority |
|---|---|---|
| `session_start` | `session_id`, `install_id` (random UUID, not IDFV), `session_num`, `app_version`, `build`, `os_version`, `device_class`, `locale`, `schema_version` | P0 |
| `session_end` | `session_id`, `duration_s`, `runs_in_session`, `best_score_in_session`, `reason` | P0 |
| `run_start` | `run_id`, `session_id`, `run_num_lifetime`, `run_num_session`, `ms_since_last_run_end` (retry latency), `config_hash` | P0 |
| `run_end` | `run_id`, `score`, `duration_ms`, `taps`, `cause_of_death` (post_top/post_bottom/ground/ceiling), `death_gate_index`, `death_y_offset_px` (signed distance from gap centre), `max_score_at_start`, `config_hash` | P0 |
| `config_snapshot` | `config_hash`, full tuning dict, `experiment_assignments` {exp_id: variant} | P0 |
| `first_session_milestone` | `milestone` (first_tap, first_death, first_score_1, first_score_5, first_retry, first_10_runs), `t_since_install_s` | P0 |
| `gate_passed` | `run_id`, `gate_index`, `t_ms`, `y_offset_px` | P1 (sample, or gates ≤10 only) |
| `perf_sample` | `fps_bucket`, `hitch_ratio` (MetricKit), `thermal_state` | P1 |
| crash / hang | MetricKit + App Store Connect, no SDK | P1 |
| `ui_action` | `screen`, `action` (share, leaderboard, settings) | P2 |
| `ad_impression`, `ad_reward`, `purchase` | placement, format, revenue | P2 |

Signed miss distance turns each death into a continuous measurement instead of a binary, which makes difficulty fitting tractable. Frame-rate and hitch data come free from `MXAnimationMetric` ([Apple](https://developer.apple.com/documentation/metrickit/mxanimationmetric)).

**Versioning.** Integer `schema_version` on every event; additive changes are non-breaking; removing or retyping a property bumps the version with a migration window ([pathtoproject](https://www.pathtoproject.com/blog/20260413-cdp-event-schema-versioning-without-breaking-activation); [Segment Protocols](https://segment.com/docs/protocols/tracking-plan/create/) [snippet]). The tracking plan lives in the repo and is reviewed like code.

## 2. Modelling retention and difficulty

- **Gates passed is approximately geometric.** A 2014 analysis found Flappy Bird scores "geometrically distributed" ([pappubahry](https://pappubahry.livejournal.com/584538.html) [snippet]). First model: discrete-time hazard *h(k)* on gate index with deaths as events and mid-run quits as censoring; a geometric fit gives one number, a gate-varying hazard reveals warm-up and ramp effects. With config snapshots, fit *h(k | gap, speed)* directly with a discrete-time hazard GLM.
- **Survival for churn.** Survival ensembles beat Cox on censored churn ([Periáñez et al., arXiv 1710.02264](https://arxiv.org/abs/1710.02264)); playtime is well described by Weibull curves and the survival curve doubles as an A/B statistic ([Viljanen et al., arXiv 1701.02359](https://arxiv.org/abs/1701.02359)). **[THIN]:** no 2024–2026 survival paper specific to arcade.
- **Which first-session metric predicts D7?** Simple first-session heuristics predict short-term retention comparably to ML ([Drachen et al., AIIDE 2016](https://ojs.aaai.org/index.php/AIIDE/article/view/12856)). Level progression correlated −0.49 with churn; time per session mattered more than session count ([Countly](https://countly.com/blog/player-retention-analytics-the-metrics-that-predict-long-term-game-success) [snippet]). Cookie Cats (90,189 installs) shows how small real effects are: moving a gate from level 30 to 40 moved D1 44.8% → 44.2% and D7 by 0.82 pp ([repo](https://github.com/akthammomani/AB-Testing-cookie-CATS)). **Recommendation:** in the first weeks regress D7 on first-session `runs`, `best_score`, `duration`, and `returned within 24h`, and adopt the single best-AUC feature as the fast proxy; prior favourite is runs/progress in session 1.
- **Target success rate.** The "85% rule" gives an optimal error rate ≈15.9% for gradient-descent-like learning ([Wilson et al., Nat. Comms 2019](https://www.nature.com/articles/s41467-019-12552-4)). Per-gate survival 0.85 gives expected score ≈5.7. A CHI 2019 DDA study converging on 50% success found players enjoyed the adapted condition more ([Constant & Levieux](https://dl.acm.org/doi/10.1145/3290605.3300693) [snippet]).
- **DDA and retention.** EA's engagement-maximising DDA gave up to 9% engagement lift, monetisation neutral ([Xue et al., WWW 2017](https://dl.acm.org/doi/10.1145/3041021.3054170)); a large RCT found easing difficulty cuts in-round purchases but raises long-run revenue ([Ascarza, Netzer & Runge](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4653319) [snippet]). **[THIN]** for endless games. **Assessment:** in a score-chasing game DDA breaks score comparability; prefer static difficulty tuned by experiment plus a fixed warm-up ramp; reserve adaptation for the first 3–5 gates.
- **Bayesian and sequential at small n.** Bayesian A/B suits continuous iteration ([Swrve, GDC 2014](https://www.gdcvault.com/play/1020473/A-B-Testing-for-Game)) but flat-prior Bayesian rules are not immune to optional stopping ([Molas 2025](https://www.alexmolas.com/2025/10/30/bayesian-ab-test-peeking.html) [snippet]); use informative priors or always-valid sequential tests ([PEAK, arXiv 2402.06122](https://arxiv.org/pdf/2402.06122)).

## 3. Difficulty and first-session numbers

**Original constants** **[THIN: no decompiled source].** Original ran ~288×512 logical px; video analysis measured a roughly constant downward acceleration ([Action-Reaction](https://fnoschese.wordpress.com/2014/01/30/flappy-bird-when-reality-seems-unrealistic/) [snippet]). Faithful clones give concrete units:

| Constant | FlapPyBird (Python, 288×512) | floppybird (JS) |
|---|---|---|
| Gap | 120 px | flyArea − 90 − 2×80 |
| Scroll | −5 px/frame @ 30 fps | pipe every 1400 ms @ 60 fps |
| Gravity | 1 px/frame² | 0.25 |
| Flap | −9, clamped [−8, +10] | −4.6 |
| Pipe width | — | 52 px |

([FlapPyBird pipe.py](https://github.com/sourabhv/FlapPyBird/blob/master/src/entities/pipe.py), [player.py](https://github.com/sourabhv/FlapPyBird/blob/master/src/entities/player.py); [floppybird main.js](https://github.com/nebez/floppybird/blob/master/js/main.js)). **In PitchFlap's units** (ball radius 17 pt on a ~393×852 screen): FlapPyBird's 120 px gap on a 512 px canvas is ≈23% of height; PitchFlap's starting 235 pt on 852 is ≈28%, floor 155 pt ≈18%. So PitchFlap starts easier than the original and ends harder.

**Score distributions** **[THIN: 2014 self-reports].** Averages of 17.85 and 15.8 from two players' logs; FlapMMO logged 29% of players dying at the first obstacle ([UCL](https://ng.cs.ucl.ac.uk/?p=154) [snippet]); beginners score 1–5 for several attempts. No population-level first-run death-rate data is public: **the studio will produce the first credible dataset.**

**Hyper-casual "good":** see Research 01 §3. GameAnalytics says D1 < 40% "probably isn't doing well" for hyper-casual ([GA report](https://www.gameanalytics.com/blog/the-metrics-behind-hyper-casual-games-industry-report) [snippet]). **[THIN]:** no public "score N in three tries" benchmark.

## 4. A/B testing and live ops for a solo indie

**Tooling.** Firebase Remote Config + A/B Testing is free, 12 h default fetch (real-time on SDK ≥10.7); its inference switched to frequentist p-values in Nov 2023 and "does not require the identification of a minimum sample size" — a peeking trap ([Firebase blog](https://firebase.blog/posts/2023/11/introducing-frequentist-inference-firebase-a-b-testing/)). PostHog: flags + experiments, Bayesian or frequentist, 1M flag requests/mo free ([PostHog](https://posthog.com/docs/experiments) [snippet]). Apple provides no remote config; App Store Connect gives opt-in D1/D7/D28 and peer benchmarks with differential privacy ([retention](https://developer.apple.com/help/app-store-connect-analytics/engagement/app-retention/)). **Simplest robust option for a statistician:** a versioned JSON on a CDN plus deterministic client assignment `hash(install_id, exp_id) mod k`, logged in `config_snapshot`.

**Power (two-sided α=0.05, power 0.8, per arm; two-proportion z):**

| Metric | Baseline → target | n per arm |
|---|---|---|
| D1 | 30% → 32% | 8,394 |
| D1 | 30% → 33% | 3,763 |
| D1 | 30% → 35% | 1,377 |
| D7 | 8% → 10% | 3,213 |
| D7 | 8% → 9% | 12,208 |
| First-run gate-1 pass | 50% → 60% | 388 |
| First-run gate-1 pass | 50% → 55% | 1,565 |
| Continuous (log runs, session 1) | d = 0.2 | 393 |
| Continuous | d = 0.1 | 1,570 |

If ~15–20% of DAU are new installs (assumption), 500 DAU ≈ 75–100 installs/day: a +3 pp D1 test takes ~10 weeks and D7 tests are unpowered; at 5,000 DAU a +3 pp D1 test needs ~10 days. **Only first-session behavioural metrics are powered at indie scale.**

**Peeking.** Continuous checking at p<0.05 inflates false positives to ~26% ([Evan Miller](https://www.evanmiller.org/how-not-to-run-an-ab-test.html)). Fixes: pre-register n; sequential methods (mSPRT, confidence sequences) ([Statsig](https://www.statsig.com/perspectives/sequential-testing-ab-peek), [Eppo](https://www.geteppo.com/blog/sequential-testing) [snippets]); or Bayesian with informative priors and a pre-declared expected-loss threshold.

## 5. Stack under privacy constraints

Volume assumption: ~4 sessions × ~8 runs × ~2 events ≈ 35 events/DAU/day → 1k DAU ≈ 1M events/mo; 10k DAU ≈ 10M/mo.

| Option | Cost 0–10k DAU | Manifest / label | SDK | Raw export | Batching |
|---|---|---|---|---|---|
| TelemetryDeck | 100k free; 10M/mo exceeds indie tiers | Product Interaction + Device ID, no tracking | Swift-native, mature | TQL/JSON on paid | Yes |
| Aptabase | 20k free; $10/200k | Product Interaction | Young Swift SDK | Paid | Undocumented |
| PostHog Cloud | 1M events + 1M flags + 1M export rows free | Product Interaction + Other Usage | Mature, flags | S3 JSONL/Parquet | Yes |
| Firebase | Free | IDFA unless `AnalyticsWithoutAdIdSupport`; you own label accuracy | Mature | BigQuery | Yes |
| GameAnalytics | Free core; raw export paid | **[THIN]** | Mature | Paid | Yes |
| Amplitude | 50k MTU free | **[THIN]** | Mature | API/S3 | Yes |
| **Roll-your-own (Supabase + DuckDB)** | Supabase free 500 MB / Pro $25; Parquet in object storage is cents | You write it: Product Interaction, not linked, no tracking, no accessed-API reasons | ~200 lines of Swift (queue, batch, retry) | Native Parquet → R/Python | Yours |

**Recommendation: roll-your-own as the system of record; PostHog only if managed experiments are wanted later.** (1) The founder already operates Supabase and DuckDB. (2) Per-run granularity at 5–10k DAU exceeds every free tier except Firebase and GameAnalytics, which withhold or complicate raw export. (3) A home-grown pipeline yields the cleanest label: random install UUID, no device IDs, no accessed-API reasons. Pipeline: Swift queue → gzip JSON batches → Supabase Edge Function → Postgres `events_raw` buffer → nightly `COPY` to Parquet → DuckDB/R. Supabase Storage hosts the remote-config JSON. MetricKit for hitches and crashes; App Store Connect for opt-in retention benchmarks.

## 6. Dashboards and the morning review

**Daily (5 min):** DAU, new installs, crash-free sessions (target ≥99.5%; 2025 average 99.95% — [Luciq](https://www.luciq.ai/blog/benchmarking-crash-free-sessions-for-mobile-apps-whats-a-good-crash-free-rate) [snippet]), D1 for the cohort installed two days ago, runs/session, median run duration, median and P90 score, first-run gate-1 pass rate, fps<50 share, anomaly flags vs a 7-day baseline. **Weekly:** D1/D7 by cohort and version, sessions/DAU (~4 average), DAU/MAU (20% good, 30% world-class — [GGA](https://gamegrowthadvisor.com/blog/2026-03-17-mobile-game-kpis-benchmarks-2026/) [snippet]), per-gate hazard curve, score-fit diagnostics, experiment readouts with sequential bounds, later ARPDAU.

**Open-source dashboards:** [game-insights](https://github.com/efeecllk/game-insights) (MIT, local-first), [Talo](https://github.com/TaloDev/frontend), [RedMetrics](https://github.com/CyberCRI/RedMetrics), [Quix game-telemetry](https://github.com/quixio/template-game-telemetry). For a DuckDB-native workflow, a Quarto page over Parquet — which this repo already renders — is less work than any of them.

## 7. First 30 days of data: pre-registered experiments

Assign by `hash(install_id, exp_id)`; analyse with a sequential test or fixed n; **never read D7 before day 37**.

| # | Experiment | Primary metric | MDE | n/arm | 500 / 5,000 DAU |
|---|---|---|---|---|---|
| 1 | Warm-up: first two gates at wider gap vs uniform | First-run gate-1 pass | 50%→60% | 388 | days / days |
| 2 | Gap width A vs B (all gates) | log(runs in first session) | d=0.2 | 393 | yes / yes; D1 secondary, underpowered at 500 |
| 3 | Retry latency: instant vs 1.0 s card | Runs/session | d=0.15 | 698 | ~2 wk / days |
| 4 | Speed ramp: +2%/gate vs flat | D1 | 30%→35% | 1,377 | ~5 wk / ~1 wk |
| 5 | Observational: geometric vs gate-varying hazard by config_hash; D7 ~ first-session features | AUC of proxy | — | all | yes |

Anything targeting +2–3 pp D1 or any D7 movement is not powered in 30 days below ~5k DAU.

**Evidence gaps:** original constants (clones and video only); population score distributions (2014 blog samples); hyper-casual first-session benchmarks; DDA in endless games; GameAnalytics/Amplitude manifests; Firebase and TelemetryDeck pricing pages unreachable.
