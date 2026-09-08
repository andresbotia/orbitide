# ORBITIDE — Product Milestones

## M0 — Brand + Product Foundation
**Goal:** Freeze the initial product thesis and establish the repository.

Deliverables:
- ORBITIDE working brand
- product/game-design baseline
- architecture rules
- launch roadmap
- private GitHub repository on `main`

Exit criteria:
- another developer can read the repo docs and explain the core loop accurately

---

## M1 — Core Playable Prototype
**Goal:** Prove that the core interaction is understandable and satisfying.

Deliverables:
- Expo/React Native/TypeScript project
- portrait mobile layout
- home/play flow
- pure TypeScript game-state engine
- Skia-rendered orbital board
- central Core + target color/count
- 3-slot holding tray
- tap-to-resolve gameplay
- automatic held-orb resolution
- win/fail/restart/next-level flow
- 10 handcrafted deterministic levels
- local unlocked-level persistence
- basic haptics
- dev/debug state readout

Explicitly excluded:
- ads
- IAP
- backend/accounts
- procedural generation
- daily rewards
- currencies
- collections
- analytics SDKs
- final art/audio

Exit criteria:
- a new player can understand Level 1 without written instructions
- Levels 1–10 are playable repeatedly without state corruption
- game rules can be unit tested without rendering
- no impossible state is caused by animation timing

---

## M2 — Level System + Solver
**Goal:** Make large-scale content possible without hand-authoring thousands of boards.

Deliverables:
- canonical serializable `LevelDefinition`
- seeded deterministic generator
- solver/validator for solvability
- difficulty scoring
- generation test harness
- first 100 validated levels
- first 3 advanced mechanics
- automated regression tests for every generated level

Exit criteria:
- any generated level accepted into the campaign is solver-verified
- same seed always recreates the same board
- difficulty trends upward without sharp random spikes

---

## M3 — Campaign + 5,000-Level Content Pipeline
**Goal:** Turn the prototype into a retention-oriented game.

Deliverables:
- 5,000 deterministic campaign levels
- worlds/chapters and level-select progression
- mechanic introduction schedule
- constellation/collection meta progression
- polished transitions and completion feedback
- hint/restart UX
- sound-effects foundation
- robust save schema with versioning/migration

Exit criteria:
- campaign can regenerate and validate all 5,000 levels in tooling
- progression survives upgrade/reinstall scenarios supported by local storage strategy
- no mechanic appears before its tutorial/introduction level

---

## M4 — Monetization + Measurement
**Goal:** Add revenue without damaging the active game loop.

Deliverables:
- interstitial ad cadence after every 2 completed levels, never during active play
- rewarded continue/help flow
- one-time Remove Ads IAP
- purchase restore
- analytics event schema
- funnel events: launch, level_start, level_complete, level_fail, retry, hint, rewarded_ad, interstitial, remove_ads_view, purchase
- remote/configurable ad cadence if practical without introducing a heavy backend
- consent/privacy handling required by ad stack

Exit criteria:
- purchased ad-free state is restored correctly
- an ad can never cover or interrupt an unresolved move
- analytics can measure completion/fail/retry by level

---

## M5 — Internal Alpha
**Goal:** Make a build safe enough for daily use by us and close testers.

Deliverables:
- EAS production-style build profile
- App Store Connect app record
- internal TestFlight build
- crash/error reporting
- device testing across representative iPhones
- battery/performance pass
- save migration tests

Exit criteria:
- no P0/P1 gameplay blockers
- smooth target frame rate on supported devices
- clean cold launch, background, resume, kill/relaunch behavior

---

## M6 — External Beta + Balance
**Goal:** Validate retention and difficulty with people who did not build the game.

Deliverables:
- external TestFlight cohort
- feedback form/path
- difficulty tuning from real fail/retry data
- ad-frequency tuning
- onboarding polish
- accessibility pass (color differentiation, reduced motion considerations, haptics/sound toggles)

Primary questions:
- Do players understand Level 1 immediately?
- Where is the first major drop-off?
- Which levels create repeated failure?
- Do players voluntarily continue past 10, 25, and 50?
- Does the ad cadence cause exits?

Exit criteria:
- critical difficulty spikes fixed
- onboarding does not require a text wall
- monetization does not create obvious session-ending friction

---

## M7 — App Store Release Candidate
**Goal:** Produce everything Apple review and the store listing need.

Deliverables:
- final icon
- screenshots/app previews
- App Store title/subtitle/keywords/description
- privacy policy/support URL
- App Privacy answers
- age rating
- IAP metadata
- review notes
- production ad IDs
- production purchase product
- final TestFlight RC

Exit criteria:
- release checklist clean
- IAP and ads tested in production-like configuration
- no debug UI/logging exposed

---

## M8 — iOS 1.0 Launch
**Goal:** Submit, pass review, and launch ORBITIDE publicly.

Launch target:
- Level 1–5000 campaign available
- interstitial + rewarded ads
- one-time Remove Ads purchase
- polished offline-first gameplay
- no mandatory account

Post-launch first week:
- monitor crashes
- monitor Level 1/5/10/25 completion
- monitor ad-related exits
- respond to reviews
- ship only high-confidence fixes

---

## M9 — Post-Launch Growth
Potential work only after real usage data exists:
- daily challenge
- additional worlds/mechanics
- Game Center achievements/leaderboards
- Android release
- cloud saves
- events
- additional cosmetics/themes
- pricing/ad-cadence experiments
