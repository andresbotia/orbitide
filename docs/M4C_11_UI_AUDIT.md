# M4C.11.1 — Pixel Arcadia UI/UX Audit

Audit pass ahead of the M4C.11 design polish milestone. Scope: every consumer-facing
screen/surface at 100-level / 10-world scale. Studio (`/studio`, dev+web only) is
explicitly out of scope — it must not drive consumer UI direction, and it doesn't.

No code changed in this pass. Findings below inform `docs/DESIGN.md` (M4C.11.2+)
and the phase ordering in the M4C.11 report.

---

## 1. Headline findings

1. **The brand identity is genuinely good and should be preserved, not replaced.**
   `brand.ts`'s 11-token/4-gradient/5-motion-token discipline, the arch+core
   `LogoMark`, the live-text `PixelArcadiaWordmark`, and `PrimaryCta`'s
   materials (inset highlight / lip / warm glow) already read as a premium,
   restrained arcade artifact. M4C.11 is a polish and completion pass on top
   of this, not a rebrand.
2. **The single biggest structural gap: there is no world/campaign/level-select
   screen.** At 10 worlds / 100 levels, `Home → PLAY` still only ever launches
   `progress.highestUnlockedLevel`. Nothing lets a player see the 10-world
   structure, revisit a cleared level, or understand where they are in the
   campaign. This is the highest-priority redesign target in the whole
   milestone (Part 8).
3. **Three overlapping dark-UI color systems coexist** (`brandColor`,
   `palette`, `arcade`), each with its own near-black background and
   text-secondary gray, sometimes mixed within one component
   (`ResultOverlay.tsx`, `LevelBadge.tsx`). Not a bug — nothing looks broken —
   but it's the reason some surfaces feel slightly less unified than others.
   `DESIGN.md` assigns a clear "which system, where" rule rather than
   inventing a fourth.
4. **A real spacing/radius/typography scale exists (`theme/spacing.ts`) and is
   used consistently for gaps and padding**, but component *dimensions*
   (socket/charge sizes, border radii, glow-circle sizes) are still frequently
   local magic numbers. Not a rewrite — a discipline gap to close as touched.
5. **Several fully-built components are unused or dead**: `BrandEmptyState`,
   `BrandLoader` (Home's `loading` prop only disables PLAY, never shows a
   loader), and `ResultOverlay`'s won-state branch (win is actually owned by
   `DiscoveryOverlay`/`DiscoveryReveal`; `GameScreen` never passes
   `status="won"` to `ResultOverlay`). These are craft opportunities, not
   bugs — wire the good work that already exists before building new.
6. **Several surfaces are intentionally-placeholder and correctly labelled as
   such in code**: Settings (two stub gear buttons, "(coming soon)"),
   `ToolBar` (Undo/Scan/Slot, fully inert), `HoldingTray`'s booster slot. These
   read as prototype because they *are* prototype by design — M2A scoped them
   out. M4C.11 should make their *placeholder-ness* intentional and premium
   (a designed "coming soon" state) rather than leaving them looking
   unfinished, without adding real functionality (that's economy/M5 work).
7. **Modifier presentation (Frozen/Shielded/Linked) is the strongest system in
   the app.** Density-adaptive detail, a shared z-order contract
   (`MATERIAL_LAYERS`), an idle-animation budget (max 6 concurrent, so 5
   simultaneous charges never overwhelm), deterministic per-pixel decoration.
   This should be treated as the reference bar for craft elsewhere, and
   left essentially alone (Part 11 confirms: preserve semantics exactly).

---

## 2. Per-surface audit

Legend for **priority**: 🔴 high (redesign this milestone) · 🟡 medium (polish
pass) · 🟢 low (largely fine, light touch only) · ⚪ N/A (doesn't exist yet).

### Splash
- **Exists**: static `splash-icon.png` (stacked lockup) on `#07060D`, no
  animation, held only until the one bundled font resolves/errors.
- **Works**: fast, on-brand, doesn't block startup.
- **Placeholder feel**: none — this is finished work for what it is.
- **Priority**: 🟢 low. `CorePulse`'s "post-mount splash continuation" was
  scoped out for lack of a safe host surface — worth revisiting only if a
  real loading gap ever appears between splash and Home.

### Onboarding
- **Exists**: none as a screen. The only "teaching" surface is a single
  in-board tutorial pill in `GameScreen`, hardcoded to whichever level's
  `LevelDefinition.tutorial` field is set, firing only for Frozen / Shielded /
  Linked based on the level's initial board contents.
- **Works**: unobtrusive, non-blocking, disappears after real progress.
- **Placeholder feel**: it's a one-level hook, not a system — fine as scoped
  (M1 rule: no forced tutorial wall), but doesn't scale gracefully if a
  future world introduces another new mechanic.
- **Priority**: 🟢 low — in scope only if Part 12/13 motion or accessibility
  work touches it; not a redesign target on its own.

### Home
- **Exists**: `StarfieldBackdrop` → `TopUtility` → wordmark + rationed glow
  wash + `HomeCenterpiece` (Skia orbital housing rendering the *real* current
  level board as a preview) + `FloatingFragments` (dropped on small phones /
  reduced motion) → `LevelBadge` → `PlayButton` → reward-count text.
- **Works**: restrained arch budget (explicitly capped, not wallpapered),
  live board preview is a genuinely clever "premium artifact" touch, PLAY CTA
  is unambiguous, reduced-motion is threaded through every child correctly.
- **Placeholder feel**: `TopUtility`'s settings gear and coin pill are
  honestly-labelled stubs ("Settings (coming soon)", "no economy" comment).
- **Hierarchy problems**: none major — wordmark / preview / PLAY read in the
  right order.
- **Spacing problems**: Home's glow-wash circle sizes (460/300/230/150) are
  hardcoded rather than scale-derived; minor.
- **Component inconsistencies**: none significant.
- **Weak interaction states**: PLAY's press feedback is a 160ms activation
  ramp + a 300ms `setTimeout`-gated navigation — functionally fine, but a
  `setTimeout` bridging animation-to-navigation is a motion-craft smell worth
  revisiting under Part 12 (prefer an animation callback/completion signal).
- **What should remain untouched**: the centerpiece's live-board preview
  concept, the arch-budget discipline, PLAY's position and treatment.
- **Priority**: 🟡 medium — mostly a "campaign progress needs to be legible"
  problem (see next item) rather than a Home-visuals problem.

### World/campaign selection
- **Exists**: nothing. No screen, no route.
- **Priority**: 🔴 **highest priority in the milestone.** This is the Part 8
  deliverable — see §1.2 above.

### Level selection
- **Exists**: nothing standalone; implied only by `progress.highestUnlockedLevel`.
- **Priority**: 🔴 high — bundled with world selection (Part 8); a 100-level
  flat list is explicitly the wrong shape (task brief: "do not make the user
  scroll through 100 giant cards").

### Gameplay HUD
- **Exists** (`Hud.tsx`): settings stub (left) — level eyebrow + progress
  track + `DifficultyGate` (center) — restart (right, functional).
- **Works**: clear three-zone layout, restart is real and accessible,
  `DifficultyGate`'s Skia machined-frame icon communicates difficulty without
  relying on color alone.
- **Placeholder feel**: settings stub again (consistent with Home — same
  honest labelling, same "coming soon").
- **Weak states**: none notable; icon buttons have a real pressed state.
- **Priority**: 🟡 medium — mostly benefits from Part 6/9 chrome-reduction
  pass (make sure HUD doesn't compete with the board) rather than a rebuild.

### Board framing
- **Exists** (`OrbitBoard.tsx`): Skia background gradient + starfield +
  orbit rail + `LaunchHubMarker`, RN-view pixels layered on top for cheap
  shared-clock animation, independent per-flight UI-thread clocks (up to 5
  concurrent), lane-offset nudging so simultaneous charges don't overlap,
  a `CALM_TRAILS_AT = 3` noise-reduction rule.
- **Works**: this is the most technically considered surface in the app —
  concurrency-aware, density-aware, perf-budgeted.
- **Priority**: 🟢 low — this is the hero and should stay the hero;
  Part 9's job is to make sure *nothing else* competes with it, not to
  change it.

### Launch tunnels
- **Exists** (`TunnelBar.tsx`): 3 "magazine" tiles, decorative 2-plate depth
  indicator (implies queue without revealing it), circular port with front
  charge or empty state, `T{n}` label, real pressed/empty/disabled states,
  strong a11y labels.
- **Works**: reads as a dispenser, not a button. Capacity, color, and
  emptiness are all instantly legible.
- **Placeholder feel**: none.
- **Priority**: 🟢 low — already close to the Part 10 "launch bay" brief;
  candidate for a light material-parity pass with Holding (§ below) rather
  than a rebuild.

### Charge presentation
- **Exists**: shared orb rendering (`orbColors`/`orbGlow` fill+border+gloss)
  reused identically across board, Holding, and Tunnels; `ColorAssistMark`
  overlay reused identically everywhere a charge appears.
- **Works**: one visual language for "a charge," used everywhere a charge
  appears — genuinely consistent.
- **Priority**: 🟢 low.

### Holding
- **Exists** (`HoldingTray.tsx`): fixed sockets with 3D-bevel deck border,
  empty/occupied/useful/pressure/overflow states, real pressed feedback, a
  `boosterSlot` prop for an unshipped "Extra Slot" that renders an inert
  dashed `[+]` when passed (currently never passed by `GameScreen`).
- **Works**: pressure/overflow escalation (`arcade.warn` → `arcade.danger`)
  gives a legible "you're in trouble" read without panic-inducing clutter,
  matching the brief.
- **Placeholder feel**: the unused `boosterSlot` affordance is fine to leave
  dormant (unwired, not rendered) rather than removed — it's forward-built
  for M5, not currently on-screen.
- **Priority**: 🟢 low — candidate for the same light material-parity pass as
  Tunnels (both should read as one hardware family: dispensers above,
  docking slots below) but not a functional rebuild.

### Boosters / available-charges surfaces
- **Exists** (`ToolBar.tsx`): Undo / Scan / Slot, `opacity:0.55`, fully
  disabled, every label suffixed "(coming soon)".
- **Placeholder feel**: correctly and honestly placeholder — this is
  M5 (economy) scope, not M4C.11.
- **Priority**: 🟡 medium, narrowly — not "build boosters" but "make the
  inert state itself look like a designed, premium 'not yet' rather than an
  unfinished row of low-opacity icons." See Part 15 of `DESIGN.md`.

### Tutorial callouts
- Covered under Onboarding above. 🟢 low.

### Frozen presentation
- **Exists** (`specialPixels.ts` + `SpecialPixelLayer.tsx`): 6-stage state
  machine, translucent ice slab, frost-cloud halo, rim light, stage-scaled
  crack count, deterministic chip/bubble decoration, idle crack/shatter
  motion, and a correct handoff — when `broken`, the shell disappears and the
  base `Pixel` cube takes over as a normal pixel.
- **Works**: exactly matches the brief ("physical translucent ice, brittle
  crack, heavy break"). Reference-quality.
- **Priority**: 🟢 low — preserve exactly (Part 16: do not touch mechanic
  semantics; this is presentation-only and already strong).

### Shielded presentation
- **Exists**: outer glow-tinted membrane, inner "air gap" boundary rect,
  diagonal facet + curved highlight + micro-arc spark at full detail, ripple
  → collapse idle motion, shell always collapses before the base pixel
  (comment-confirmed design rule).
- **Works**: matches the brief ("energy membrane, visible air gap,
  elastic/ripple collapse") closely.
- **Priority**: 🟢 low — same as Frozen.

### Linked presentation
- **Exists**: socket nubs on opposite cell edges + a genuine cross-pixel
  tether — a `Path` drawn between every linked pair's centers, colored by
  primed/idle state, deduped so each pair draws once.
- **Works**: the tether is the clearest "designed relationship" visual in the
  app — readable circuitry, not just paired color coincidence.
- **Priority**: 🟢 low — verify tether legibility on the densest Linked boards
  during Part 12/13 (dense-board readability is the brief's stated risk for
  this mechanic specifically), but no structural change expected.

### Pause / settings
- **Exists**: nothing as a screen. Two independent gear-icon stub buttons
  (Home's `TopUtility`, in-game `Hud`), both non-functional, both correctly
  labelled "(coming soon)" in their a11y strings. No pause overlay exists at
  all — only Restart (immediate) and Home/Retry via the result surfaces.
- **Priority**: 🟡 medium — M4C.11 should not build a real settings *screen*
  (that's out of scope / a future milestone per `Hud.tsx`'s own comment), but
  should make the two stub buttons visually consistent with each other and
  with the rest of the honest-placeholder language established for ToolBar.

### Win state
- **Exists**: `DiscoveryOverlay` + board-level `DiscoveryReveal` Skia
  constellation animation, sequenced via `revealTimeline` milestones (title →
  reward chip → NEXT visible → NEXT interactive), `useAnimatedReaction`
  bridging the UI-thread clock to two one-time haptic/state side effects.
- **Works**: genuinely celebratory without being blocking; NEXT's
  visible-then-interactive split protects against accidental early taps.
- **Placeholder feel**: the "◈ REWARD PENDING" chip is static, unwired to any
  economy (consistent with the rest of the app's honest no-economy state).
- **Priority**: 🟡 medium — mostly a Part 12 motion-craft pass (verify the
  `useAnimatedReaction` timing feels causal, not just choreographed) rather
  than a visual rebuild.

### Fail state
- **Exists**: `ResultOverlay` (scrim + card, `FadeIn`/`FadeInDown`
  entrance), "Try Again" / "Back to Home" via `PrimaryCta`.
- **Works**: fast, no punitive delay, immediate retry path per the brief.
- **Weak spots**: mixes `brandColor` (card chrome) and `palette` (text) in
  one component — the token-fragmentation issue from §1.3, visible here
  specifically. The won-state branch is dead code given current wiring
  (`GameScreen` never passes `status="won"`) — worth removing or explicitly
  documenting as reserved, not left ambiguous.
- **Priority**: 🟡 medium — token consolidation + dead-branch cleanup, not a
  visual rebuild (the fail experience itself already matches the brief).

### Next-level flow
- **Exists**: `DiscoveryOverlay`'s NEXT button, `app/game.tsx`'s
  `handleAdvance` (`router.setParams` in place — no screen transition).
- **Works**: no navigation flash between levels, momentum preserved.
- **Priority**: 🟢 low.

### Loading
- **Exists**: `BrandLoader`/`CorePulse` are fully built, token-driven, a11y
  labelled — and currently **called from nowhere** in Home/Game. There is no
  blocking loading surface in the app today (levels are bundled, not
  fetched), so this isn't a visible bug, but it means real async work
  (e.g. Part 8's campaign screen, if it ever reads anything asynchronously)
  should reach for this before inventing a new spinner.
- **Priority**: ⚪ N/A today / 🟢 low — no visible gap, but flag for reuse.

### Empty states
- **Exists**: `BrandEmptyState` is fully built (unlit-portal mark + stray
  pixel debris + title/message/optional button) and, like `BrandLoader`, has
  no confirmed call site.
- **Priority**: ⚪ N/A today — becomes relevant the moment Part 8 needs an
  empty/locked-world state; reuse rather than rebuild.

---

## 3. Redesign priority (rollup)

| Priority | Surfaces |
| --- | --- |
| 🔴 High | World/campaign selection, level selection (do not exist — Part 8) |
| 🟡 Medium | Home (progress legibility only), HUD chrome-reduction, Holding/Tunnel material parity pass, fail-state token cleanup, win-state motion-craft pass, pause/settings stub consistency, ToolBar/booster "designed not-yet" treatment |
| 🟢 Low / preserve | Board framing, charge presentation, Frozen/Shielded/Linked presentation, splash, next-level flow, tutorial pill |
| ⚪ Reuse, don't rebuild | Loading (`BrandLoader`), empty states (`BrandEmptyState`) — wire into Part 8's new screen instead of inventing new primitives |

## 4. What should remain untouched

- Board rendering architecture (`OrbitBoard.tsx`, `Pixel.tsx`,
  `SpecialPixelLayer.tsx`) — concurrency model, density-adaptive detail
  system, idle-animation budget, deterministic decoration.
- Frozen / Shielded / Linked visual semantics and state machines.
- `PrimaryCta`, `LogoMark`, `PixelArcadiaWordmark`, `geometry.ts` — the brand
  anchor is correct as built; this milestone polishes around it.
- All engine/solver/level-content/campaign-tuning code (per Part 16 — not
  touched in this audit and not in scope for M4C.11 at all).

## 5. Design skills used

This audit was informed by the Impeccable and Emil Kowalski skill sets
installed for this milestone (see the M4C.11 final report for install
details) — applied as review lenses (hierarchy, restraint, motion causality,
material honesty) against the existing Pixel Arcadia brand direction, not as
a replacement aesthetic.
