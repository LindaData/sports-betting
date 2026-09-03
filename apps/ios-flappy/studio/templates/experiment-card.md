# Experiment <id> — <slug>

*Pre-registered <yyyy-mm-dd>. Do not edit after data starts arriving; append an amendment instead.*

**Hypothesis:** <one sentence, directional>
**Variable:** exactly one. <constant or mechanic>, arms: <A vs B>
**Assignment:** `hash(install_id, "<id>") mod <k>`, stamped in `config_snapshot`

**Primary metric:** <name, definition, window>
**Guardrail metric:** <name, and the value at which we stop regardless>
**Baseline:** <value, source>
**Minimum detectable effect:** <absolute or d>
**Required n per arm:** <number> at α=0.05 two-sided, power 0.8 — <method>
**Expected time to n:** <days at current install rate>. **Powered at current DAU:** yes | no

**Stopping rule:** fixed n | sequential (<method, bound>) | Bayesian (<prior source, expected-loss threshold>)
**Analysis:** <model / test>, script at `studio/analytics/<file>`
**Read-out date:** not before <date> (D7 reads never before day 37)

**Result:** <estimate [interval]> | not measured
**Decision:** <what changed in Tuning.swift or the design, or "no change">

```
ANALYSIS: <id>  METRIC: <primary>  N: <required>/<actual>  RESULT: <estimate [interval]> | not measured  FILE: <this path>
```
