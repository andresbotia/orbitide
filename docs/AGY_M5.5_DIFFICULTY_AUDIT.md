# PIXEL ARCADIA — M5.5 AGY REVIEW
## Difficulty + Mechanic Progression Audit / Handoff

### Agent
AGY

### Task Type
Design-spec review and implementation-readiness audit.

This is **not** a gameplay implementation task.

Do not modify engine rules.
Do not rebuild campaign levels.
Do not update solver behavior.
Do not change UI.
Do not touch economy/items/boosters.

Your job is to review the locked M5.5 design specification against the current repository and produce a precise handoff for M5.6.

---

# INPUT SPEC

Primary design contract:

`M5.5_DIFFICULTY_MECHANIC_PROGRESSION.md`

Treat that file as the source of truth for the intended Core V2 difficulty model.

Current branch:

`milestone/1-core-prototype`

Current M5 status:

- M5.1 complete
- M5.2 complete
- M5.3 complete
- M5.4B complete
- M5.4C complete or in final checkpointing
- M5.5 is now being audited
- M5.6 will be Solver / Authoring Pipeline V2

---

# PURPOSE OF THIS REVIEW

We need to know:

1. Which M5.5 difficulty/authoring metrics already exist in the repo.
2. Which existing analyzer/solver metrics are reusable.
3. Which metrics are missing and must be added in M5.6.
4. Which Legacy V1 assumptions conflict with Core V2.
5. Which acceptance criteria can already be checked automatically.
6. Which criteria still require human/device playtesting.
7. What exact implementation work Grok should receive for M5.6.

Do not turn this into a broad architecture rewrite.

---

# LOCKED M5.5 DESIGN POINTS TO REVIEW

At minimum, account for these:

## First 10 Levels
- Level 1 only = core gameplay tutorial
- Level 2 starts real gameplay immediately
- By Level 5, meaningful decision density should already exist
- 4 tunnels are normal by Level 6
- Level 9 = first Hard
- Level 10 = Hard capstone

## Difficulty Sources
- geometry
- directional visibility
- tunnel sequencing
- hidden queue depth
- Holding pressure
- Active-capacity pressure
- color distribution
- multi-orb interaction
- special mechanics later

## Anti-Spam
Hard/Super Hard levels must not be reliably solvable by blind tunnel tapping.

## Palette Variety
Adjacent levels should avoid repeating the same dominant color combinations.

## Holding / Active
Need measurable support for:
- Holding entries
- max Holding occupancy
- manual relaunches
- max simultaneous Active count

## Queue / Choice
Need measurable support for:
- queue depth
- front-of-queue options
- decision points / meaningful tunnel-choice moments where practical

## Geometry
Need measurable support for:
- directional exposure
- front/rear layering
- geometry-dependent vulnerability
- non-global targetability under Core V2 rules

## Density / Color
Need:
- occupied cell count
- board density
- unique color count
- dominant palette distribution

## Witness / Solvability
Need:
- deterministic winning witness
- witness length/action count
- solvable without boosters/items

## Campaign Variety
Need:
- adjacent-level palette similarity or other useful repetition indicator

---

# REPO AREAS TO INSPECT

Inspect the current implementation and follow references as needed.

At minimum review:

- solver
- trace / witness execution
- analyzer / analysis modules
- Holding-pressure analysis
- level definitions
- authoring schema
- authoring validation
- Studio analysis tooling
- Core V2 ruleset handling
- tunnel queue data structures
- Holding / Active selectors or metrics
- directional targeting helpers
- current campaign tests around density / analyzer expectations
- any existing difficulty score or level score logic

Do not assume filenames if code moved.

---

# REQUIRED QUESTIONS

Answer all of these.

## Existing Metrics
1. Which M5.5 metrics already exist today?
2. Where are they calculated?
3. Are they Legacy V1-only, ruleset-neutral, or Core V2-aware?
4. Which ones can be reused unchanged?

## Missing Metrics
5. Which required metrics do not exist?
6. Which are straightforward to add in M5.6?
7. Which are expensive or ambiguous to calculate automatically?

## Anti-Spam
8. Can the current tooling simulate or approximate blind tunnel spam?
9. If not, what is the smallest deterministic anti-spam check M5.6 could add?
10. How should a Hard-level anti-spam result be represented without pretending it is a perfect difficulty score?

## Directional Geometry
11. Does current analysis understand Core V2 directional visibility?
12. Can it measure exposure/layer depth meaningfully?
13. What additional data would be useful for authoring front/rear layered puzzles?

## Holding / Active
14. Which Holding-pressure metrics already exist?
15. Is max Holding occupancy available?
16. Is manual relaunch count available?
17. Is max simultaneous Active count available?
18. Are these computed from actual deterministic witness execution?

## Queue Choice
19. What queue metrics currently exist?
20. Can tooling identify points where multiple tunnel actions are legal/useful?
21. What practical “choice point” metric would be robust enough for M5.6?

## Palette / Density
22. Which density and color metrics already exist?
23. Is dominant palette distribution available?
24. How would adjacent-level palette similarity be implemented simply and deterministically?

## Solver / Witness
25. What assumptions in the current solver are still Legacy V1-specific?
26. What must change for Core V2 directional targeting + one-pass lifecycle?
27. Can current witness format represent Holding relaunch and multiple simultaneous Active Pals correctly?
28. What must be added or changed?

## Automation vs Human Review
29. Which M5.5 acceptance criteria can be automated?
30. Which must remain human design review?
31. Which must wait for M5.8 physical-device validation?

---

# IMPORTANT GUIDANCE

Do not recommend one magic “difficulty score.”

M5.5 explicitly requires multi-factor analysis.

A useful analyzer can expose several signals such as:

- action count
- Holding pressure
- Active pressure
- layer depth
- queue choice
- density
- color count
- palette similarity

But final difficulty remains a design judgment.

---

# ANTI-SPAM AUDIT IDEA

Evaluate whether M5.6 can include a deterministic naive-policy comparison.

Example concept:

- run a simple fixed tunnel-tapping policy
- compare it against the winning witness
- report whether the naive policy wins, loses, deadlocks, or creates severe Holding pressure

Do NOT implement this in M5.5.

Just assess whether it is practical and useful.

Do not use randomness.

---

# LEGACY V1

Legacy V1 must remain supported.

Your report must clearly separate:

- changes needed only for Core V2
- reusable shared analyzer improvements
- anything that risks breaking Legacy V1 tests/content

Do not suggest deleting Legacy V1 tooling yet.

---

# NO CODE CHANGES

This task is primarily an audit.

Do NOT modify code unless a tiny doc-only clarification is absolutely necessary.

Prefer zero code changes.

Do NOT commit or push.

---

# TESTING

No full suite is required for this review.

If you run any verification commands:

- use targeted tests only
- use `--runInBand`
- do not run default-parallel Jest
- do not trigger heavy solver sweeps unnecessarily

This machine has already experienced RAM exhaustion from parallel Jest.

---

# FINAL REPORT FORMAT

Return:

## 1. Executive Summary

## 2. Existing Metrics Matrix
For each M5.5 metric:
- metric
- exists?
- file/module
- Core V2-aware?
- reusable?
- notes

## 3. Missing Metrics Matrix
For each missing metric:
- metric
- recommended implementation
- complexity: low / medium / high
- M5.6 priority

## 4. Current Solver / Witness Gaps

## 5. Current Analyzer Gaps

## 6. Anti-Spam Feasibility
Include a concrete recommendation.

## 7. Directional-Geometry Analysis Recommendation

## 8. Holding / Active Analysis Recommendation

## 9. Queue-Choice Analysis Recommendation

## 10. Palette / Density Analysis Recommendation

## 11. Automated Acceptance Criteria
List what M5.6 can enforce/check.

## 12. Human Review Criteria
List what should remain manual.

## 13. M5.8 Device-Validation Criteria
List what cannot be proven from code/solver.

## 14. Legacy V1 Risk Assessment

## 15. Exact M5.6 Implementation Handoff
Provide a prioritized, implementation-ready sequence for Grok.

## 16. Exact Files / Modules Likely to Change in M5.6

## 17. Files / Modules That Should Stay Untouched

## 18. Remaining Product Ambiguities
Only include genuine blockers.

Then STOP.

Do not implement M5.6.
