# Pixel Arcadia — Product Milestones

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
- procedural campaign generation
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


## M1.5 — Competitive UX Research
**Goal:** Turn competitor praise, complaints, and feature requests into explicit ORBITIDE product requirements before visual design and economy decisions harden.

Research targets:
- Pixel Flow
- Car Sort
- Gems Match
- additional adjacent color-sort / one-thumb puzzle games as useful

Research categories:
- what players love
- what causes quitting or uninstalling
- ad timing and ad fatigue
- rewarded-ad requests
- difficulty fairness
- booster usefulness and pay-to-win complaints
- coin/reward economy
- progress loss / restore failures
- resume-current-level behavior
- offline play
- accessibility / color readability
- performance / heat / battery
- onboarding / mechanic explanation
- content freshness and update cadence

Product rules established from initial research:
- never show a forced interstitial immediately after a failed level
- automatic interstitials occur only at natural post-success breaks
- begin testing around one interstitial every 3 completed levels, with no forced ads during the first 5–10 levels
- rewarded ads are voluntary and exchange clear value: coins, hint, temporary extra slot, or similar assistance
- boosters make levels easier; they must never be required to make a campaign level solvable
- every shipped campaign level must be solvable with standard rules and zero boosters
- Hard/Super Hard means deeper reasoning and tighter sequencing, not hidden randomness or unknowable information
- coin rewards and booster prices must allow useful boosters to be earned through normal play
- gameplay remains offline-first
- an interrupted active level must be resumable without losing puzzle state
- cross-device restoration is required before 1.0
- Remove Ads must reliably suppress all automatic/interstitial ads and restore across devices
- color cannot be the only gameplay signal; support secondary symbols/patterns or a color-assist mode
- gameplay effects must respect a performance budget and be tested in long sessions for heat/battery issues
- provide a persistent reference for mechanics and booster behavior after their initial introduction

Deliverable:
- `docs/COMPETITIVE_RESEARCH.md` containing evidence, observations, ORBITIDE decisions, implementation milestone, and test criteria for each adopted lesson

Research cadence:
- initial pass now
- refresh before economy/store implementation
- refresh before TestFlight
- refresh before App Store release
- after launch, Pixel Arcadia's own reviews and telemetry take priority over competitor feedback

Exit criteria:
- meaningful competitor feedback is converted into an actionable requirement, explicit non-goal, or documented experiment
- ad, difficulty, save/restore, economy, accessibility, and performance rules are represented in later milestones

---

## M2 — Visual Identity, UI/UX, Motion + Haptic Language
**Goal:** Decide what ORBITIDE looks, sounds, moves, and feels like before scaling content.

Pixel Flow is a structural reference for clarity and commercial polish, not a template to clone. ORBITIDE should use its own visual identity, assets, geometry, motion, and brand language.

Design direction:
- bright, tactile mobile-puzzle readability
- cosmic/orbital theme unique to ORBITIDE
- toy-like dimensional UI where useful, without copying Pixel Flow artwork or trade dress
- one-handed portrait layout
- game board remains the visual priority

Deliverables:
- Claude Design exploration with at least 3 visual directions
- approved ORBITIDE design direction
- design tokens: color, typography, spacing, radii, depth/shadow, icon rules
- core screen designs:
  - home
  - gameplay
  - hard/super-hard level intro
  - level complete
  - fail/retry
  - level/map progression
  - rotating booster store
  - settings
- top HUD pattern: settings / level / coin balance
- booster bar pattern
- Core/orb/holding-slot visual states
- motion specification for all major interactions
- haptic specification for all major interactions
- reduced-motion and haptics-off behavior
- design playground/component gallery inside the app
- first-pass app icon direction

Motion quality targets:
- tap acknowledgement feels immediate
- matching orb travel into Core is short, readable, and satisfying
- held-orb travel clearly communicates why it did not clear
- target completion produces a stronger Core response than a normal clear
- win animation is celebratory but quick enough to preserve "Next Level" momentum
- failure communicates pressure without feeling punitive

Haptic language:
- exposed-orb selection: light tactile tick
- successful Core absorption: light impact
- orb sent to holding: distinct softer/warning tick
- Core target completed: medium pulse or short double pulse
- near-full holding tray: restrained warning feedback
- booster use: medium confirmation
- level complete: success pattern
- level fail: failure pattern
- store purchase: success confirmation

Exit criteria:
- screenshots of all core screens look like the same commercial product
- motion/haptics have a documented hierarchy rather than ad-hoc calls
- gameplay remains legible without relying on color alone
- no screen materially resembles copied Pixel Flow artwork/assets
- M1 gameplay can be reskinned into the approved visual system without changing game rules

---

## M3 — Level Studio + Handcrafted Campaign Framework
**Goal:** Make thousands of intentionally designed levels practical without shipping random/generated campaign puzzles.

Product rule:
- campaign levels are hand-authored and explicitly approved
- generation may assist designers internally, but generated output never enters the campaign without review
- a solver/validator verifies our designs; it does not decide the campaign for us

Deliverables:
- canonical serializable `LevelDefinition`
- difficulty metadata: `easy | medium | hard | super-hard`
- theme-set metadata
- layout-family/silhouette metadata
- visual developer level editor/studio
- duplicate/variation tooling for designers
- solver/validator for solvability
- optimal/near-optimal solution diagnostics
- difficulty diagnostics such as holding pressure and decision points
- developer level selector
- level validation test harness
- themed 10-level set support
- 50-level world/chapter support

Initial difficulty cadence:
- Levels 1–8: Easy
- Level 9: Medium
- Level 10: Hard
- later sets deliberately mix Easy, Medium, Hard, and Super Hard
- Easy/breather levels continue to appear late in the campaign

Theme structure:
- every 10 levels = a distinct themed set
- every 50 levels = a larger world/chapter
- silhouettes are intentional and readable rather than random blobs
- puzzle logic is designed first, silhouette/theme second

Initial set direction:
- 1–10: First Light
- 11–20: Comet Trail
- 21–30: Satellite Field
- 31–40: Nebula Bloom
- 41–50: Eclipse Run

Exit criteria:
- designers can create/edit/test/save a level without manually editing large arrays
- every accepted level is solver-verified
- difficulty is explicit and intentional
- every level belongs to a theme set and layout family
- campaign data is deterministic, serializable, versionable, and testable

---

## M4 — Mechanics + First 100-Level Campaign
**Goal:** Establish the real content grammar and prove the handcrafted campaign approach at meaningful scale.

Deliverables:
- first 100 approved campaign levels
- level-by-level difficulty schedule
- first advanced mechanics introduced gradually
- potential mechanics:
  - frozen/locked orb
  - mystery orb
  - wildcard
  - linked orbs
  - blocker
  - portal
- 10-level themed sets across the first two worlds
- special Level 10/20/30/etc. presentation
- Hard and Super Hard level intro treatment
- level reward metadata
- manual playtest checklist for every Hard/Super Hard level
- solver regression tests for all campaign levels

Exit criteria:
- no mechanic appears before its introduction level
- no accidental difficulty spikes
- Levels 1–100 have a deliberate rhythm of challenge and recovery
- all levels are playable offline from bundled campaign data
- every accepted campaign level is solver-verified as beatable with standard holding capacity and zero boosters

---

## M5 — Economy + Booster Store
**Goal:** Add progression value and helpful consumables without making the base puzzle intentionally frustrating.

Deliverables:
- coin economy
- first-clear level rewards by difficulty
- booster inventory
- rotating 3-item store
- booster purchase with coins
- initial boosters such as:
  - Undo
  - Reveal/Hint
  - Extra Holding Slot
  - Clear Holding Orb (only if balance-safe)
- first-try/streak reward rules if retained after testing
- local transaction ledger/cache architecture
- store UI integrated with M2 design language
- economy simulation/balance spreadsheet or test harness

Economy principles:
- Medium/Hard/Super Hard award more coins than Easy
- replay farming should not trivialize the economy
- boosters help but should not be required to beat normally designed levels
- no dark-pattern forced purchase walls

Exit criteria:
- coin earnings/spending are deterministic and testable
- booster use cannot corrupt puzzle state
- store rotation can be reproduced deterministically in development
- the game remains beatable without spending money

---

## M6 — Cloud Identity + Cross-Device Save
**Goal:** Make progress, wallet, and inventory restorable before any public release.

Backend direction:
- Cloudflare Workers
- Cloudflare D1
- offline-first local cache on device

Identity direction:
- immediate guest play with locally generated player identity
- Sign in with Apple before launch for durable cross-device restoration
- account linking must preserve existing guest progress

Cloud-synced data:
- highest unlocked level / campaign progress
- completed levels and meaningful result metadata
- active-level checkpoint/state for resume where schema-compatible
- coin ledger/balance
- booster inventory
- cloud-save schema/version

Deliverables:
- Worker API
- D1 schema + migrations
- Sign in with Apple account linking
- conflict-resolution rules
- local-first sync queue
- reinstall restoration test
- second-device restoration test
- account-link migration test
- backend rate limiting / basic abuse safeguards

Exit criteria:
- signing in on another device restores progress, coins, and inventory
- reinstall + Sign in with Apple restores durable state
- offline gameplay remains functional
- sync failure cannot block active gameplay
- duplicate requests cannot duplicate coin grants or inventory

---

## M7 — RevenueCat + In-App Purchases
**Goal:** Add durable purchases safely before ads and public beta.

Deliverables:
- RevenueCat integration
- one-time Remove Ads entitlement
- consumable coin packs
- restore purchases
- RevenueCat webhook -> Cloudflare Worker -> D1 purchase ledger
- idempotent purchase processing
- transaction/audit history
- account-link expectation before consumable coin purchases
- sandbox purchase testing

Exit criteria:
- Remove Ads restores on reinstall/device change
- verified consumable purchases credit coins exactly once
- client cannot grant itself purchased coins
- failed/retried webhook delivery cannot duplicate currency

---

## M8 — AdMob + Rewarded Monetization
**Goal:** Add ad revenue without interrupting active puzzle resolution.

Deliverables:
- Google AdMob integration
- interstitial ads only at natural breaks after successful level completion; never immediately after failure
- no forced interstitials during the first 5–10 levels
- starting cadence experiment around every 3 completed levels
- rewarded ads for explicit user-selected value exchanges
- candidate rewarded placements:
  - double level coin reward
  - earn a small coin amount
  - temporary extra slot after failure
  - reveal/hint
- Remove Ads suppresses automatic/interstitial ads
- optional rewarded ads remain available to Remove Ads owners if clearly communicated
- consent/privacy flow
- ATT/UMP handling as applicable
- `app-ads.txt`
- ad test IDs/dev safety

Exit criteria:
- no ad can interrupt an unresolved move
- failing repeatedly (including 10 consecutive failures) produces zero forced interstitial ads
- rewards are granted only after verified rewarded-ad completion callbacks
- rewarded ad failure never consumes the offered reward/opportunity incorrectly
- ad-free entitlement reliably suppresses forced ads

---

## M9 — Campaign Expansion + Retention Polish
**Goal:** Grow from the first 100 levels into a launch-sized campaign while preserving quality.

Deliverables:
- expand handcrafted campaign toward 500–1,000 high-quality launch levels
- additional worlds/theme sets
- curated difficulty cadence
- level progression/map polish
- collection/meta layer if it improves retention in testing
- final sound-effects pass
- animation/haptic polish pass across all mechanics and boosters
- save migrations for content/economy revisions

Important:
- 5,000 remains the long-term campaign target, not a requirement to ship version 1.0
- quality and balance take priority over hitting an arbitrary level count

Exit criteria:
- launch campaign length feels effectively substantial to testers
- Hard/Super Hard labels match observed playtest difficulty reasonably well
- all campaign levels are solver-verified and manually curated

---

## M10 — Internal Alpha
**Goal:** Make a build safe enough for daily use by us and close testers.

Deliverables:
- EAS production-style build profile
- App Store Connect app record
- internal TestFlight build
- crash/error reporting
- device testing across representative iPhones
- battery/performance pass
- sustained 30+ minute gameplay thermal/performance test
- particle/effect budget verification and background render suspension
- save migration tests
- purchase/ad sandbox end-to-end testing
- cross-device restore testing

Exit criteria:
- no P0/P1 gameplay blockers
- smooth target frame rate on supported devices
- clean cold launch, background, resume, kill/relaunch behavior
- account restore + commerce flows pass on real devices

---

## M11 — External Beta + Balance
**Goal:** Validate retention, difficulty, economy, and monetization with people who did not build the game.

Deliverables:
- external TestFlight cohort
- refreshed competitor-review research focused on difficulty, ads, economy, and retention
- feedback path
- difficulty tuning from real fail/retry data
- economy tuning
- ad-frequency tuning
- rewarded-ad value tuning
- onboarding polish
- accessibility pass: color differentiation, reduced motion, haptic/sound toggles

Primary questions:
- Do players understand Level 1 immediately?
- Do they voluntarily continue past 10, 25, 50, and 100?
- Where is the first major drop-off?
- Which levels are mislabeled in difficulty?
- Do Hard/Super Hard levels feel challenging rather than unfair?
- Are boosters useful without feeling mandatory?
- Does the ad cadence cause exits?
- Do players understand how to restore progress/purchases?

Exit criteria:
- critical difficulty spikes fixed
- onboarding does not require a text wall
- economy does not create obvious paywalls
- monetization does not create obvious session-ending friction

---

## M12 — App Store Release Candidate
**Goal:** Produce everything Apple review and the store listing need.

Deliverables:
- final icon
- screenshots/app previews
- App Store title/subtitle/keywords/description
- privacy policy/support URL
- App Privacy answers
- age rating
- Sign in with Apple configuration
- IAP metadata
- review notes
- production AdMob IDs
- production RevenueCat products/entitlements
- production Cloudflare environment
- final TestFlight RC

Exit criteria:
- release checklist clean
- cross-device save/restore verified
- IAP and ads tested in production-like configuration
- no debug UI/logging exposed

---

## M13 — iOS 1.0 Launch
**Goal:** Submit, pass review, and launch Pixel Arcadia publicly.

Launch requirements:
- substantial handcrafted campaign (target 500–1,000+ polished levels; expand toward 5,000 over time)
- themed 10-level sets and larger worlds
- Easy/Medium/Hard/Super Hard cadence
- Cloudflare-backed cross-device progress/wallet/inventory restoration
- Sign in with Apple account linking
- interstitial + rewarded AdMob
- RevenueCat Remove Ads + coin packs
- rotating booster store
- polished animation, haptics, audio, and accessibility controls

Post-launch first week:
- monitor crashes
- monitor Level 1/5/10/25/50/100 completion
- monitor difficulty by level label
- monitor booster usage
- monitor rewarded/interstitial engagement and ad-related exits
- monitor purchase failures/restore failures
- respond to reviews
- ship only high-confidence fixes

---

## M14 — Post-Launch Growth
Potential work only after real usage data exists:
- continue toward 5,000 handcrafted campaign levels
- daily challenge
- new worlds/mechanics
- Game Center achievements/leaderboards
- Android release
- seasonal store rotations/events
- cosmetics/themes
- pricing/ad-cadence experiments
- live difficulty/economy tuning where appropriate
