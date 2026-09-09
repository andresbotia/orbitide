# Pixel Arcadia — Competitive UX Research

## Purpose
This document captures actionable lessons from adjacent mobile puzzle games. We do not copy distinctive assets or trade dress. We use public player feedback to identify product risks, retention opportunities, and testable requirements.

## Decision format
Each finding should include:
- Competitor / source
- Player signal
- Pixel Arcadia decision
- Implementation milestone
- Acceptance test

## Initial findings

### Forced ads after failure
**Player signal:** Engaged puzzle players report that ads immediately after failed attempts feel punitive and can cause them to close/reopen the app. Some explicitly ask for voluntary ads that grant help instead.

**Pixel Arcadia decision:** Never show a forced interstitial immediately after failure. Failure screens may offer voluntary rewarded help.

**Milestone:** M8 — AdMob + Rewarded Monetization

**Acceptance test:** Fail 10 levels consecutively. Zero automatic interstitials are shown because of those failures.

### Rewarded help when stuck
**Player signal:** Players who are deeply engaged but stuck often ask for an ad-for-booster option rather than an unavoidable ad.

**Pixel Arcadia decision:** Offer optional rewarded placements such as Hint, temporary Extra Slot, or a small coin grant. The value exchange must be explicit before playback.

**Milestone:** M5 / M8

### Pay-to-win difficulty
**Player signal:** Later levels in competitor games are criticized when boosters or spending appear necessary rather than optional.

**Pixel Arcadia decision:** Boosters reduce friction; they never make an otherwise impossible campaign level possible. All shipped campaign levels must be solver-verified with standard rules and zero boosters.

**Milestone:** M3 / M4

### Hidden-information difficulty
**Player signal:** Players perceive difficulty as unfair when failure depends on unknowable hidden information instead of planning.

**Pixel Arcadia decision:** Hard and Super Hard levels increase sequencing pressure and tempting wrong paths, not arbitrary luck. Mystery mechanics, if used, must preserve fair decision-making.

**Milestone:** M3 / M4

### Free coin economy
**Player signal:** Tiny rewards paired with extremely expensive assists make players feel pushed toward purchases.

**Pixel Arcadia decision:** A regular player must be able to earn useful boosters through normal play. Purchases accelerate progress; they do not ransom it.

**Milestone:** M5

### Resume and restore trust
**Player signal:** Losing progress after reinstall is a major trust failure, while being able to resume an interrupted puzzle is specifically praised.

**Pixel Arcadia decision:** Save active puzzle state locally for exact resume. Cross-device cloud restoration of progress, wallet, and inventory is a 1.0 requirement. Durable purchase ownership is restored through RevenueCat/StoreKit.

**Milestone:** M6 / M7

### Offline play
**Player signal:** Offline availability is valued in casual puzzle games.

**Pixel Arcadia decision:** Core campaign gameplay and level data remain local/offline-first. Backend sync must never sit in the move-resolution path.

**Milestone:** M1 onward

### Accessibility / similar colors
**Player signal:** Similar hues can cause accidental failures and make color-only games inaccessible.

**Pixel Arcadia decision:** Color is never the only meaningful signal. Explore subtle symbols/patterns and a Color Assist setting while retaining the premium visual language.

**Milestone:** M2 / M11

### Performance / device heat
**Player signal:** Long-session players report overheating in visually active puzzle games.

**Pixel Arcadia decision:** Motion polish has a performance budget. Cap particles, avoid runaway animation loops, suspend unnecessary rendering in the background, and test sustained sessions on real devices.

**Milestone:** M2 / M10

### Persistent mechanic reference
**Player signal:** One-time tutorials are frustrating when players later forget a mechanic or booster.

**Pixel Arcadia decision:** Teach through level design first, but provide a lightweight persistent How It Works / Boosters reference once multiple mechanics exist.

**Milestone:** M4 / M5

### Content freshness
**Player signal:** Frequent new levels/features are praised by highly engaged players.

**Pixel Arcadia decision:** Use themed 10-level sets and larger worlds so future content drops have clear identity. Do not sacrifice level quality merely to increase the count.

**Milestone:** M3 / M9 / M14

## Ongoing research cadence
1. Initial product pass before M2 design is locked.
2. Revisit competitor ads/economies before M5 and M8.
3. Revisit difficulty/retention feedback before M11 external beta.
4. Revisit current competitor reviews before M12 release candidate.
5. After launch, prioritize Pixel Arcadia reviews, support feedback, and telemetry over competitor feedback.
