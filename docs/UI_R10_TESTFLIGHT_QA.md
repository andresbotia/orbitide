# UI-R10 — TestFlight Real-Device QA Checklist

Consolidated from the UI-R2 through UI-R9 Pixel Arcadia redesign milestones.
This is the permanent repo checklist for this beta pass — do not shorten it,
and do not turn any item here into implementation work until it has actually
failed on a real device.

## Highest-priority items (test these first)

1. Primary CTA press/release feel (squash-in, spring-release — new in UI-R9)
2. Dense 28×28 gameplay board readability
3. Pixel-clear brightness-peak effect (new in UI-R9)
4. 3–5 simultaneous charge flights
5. Tunnel recoil/reload feel
6. Holding arrival pop + 2/3 + 3/3 pressure escalation
7. Long pixel-clear haptic cadence (rhythmic, not continuous buzzing)
8. World-specific ambience (all 10 identities)
9. Capstone win (any of Levels 10/20/…/90)
10. Level 100 — The Grand Masterpiece finale
11. Performance / frame rate under load
12. Rapid NEXT → next level flow
13. Small-screen layout
14. No dead/inert production controls
15. Reduced-motion behavior end to end

---

## A. Home

- Wordmark / centerpiece / CTA entry stagger timing feels fast, not sluggish
- Live level-preview inside the portal housing renders correctly for several different levels
- PLAY vs CONTINUE label switches correctly at the Level 1 boundary
- PrimaryCta press/release feel — squash + spring settle (UI-R9)
- Idle glow-breathe on PLAY reads as premium, not distracting
- Settings gear is hidden (UI-R9) — confirm the coin pill stays right-aligned, no layout jump
- Home → World Select transition feel (slide, timing)

## B. World Map

- All 10 world destination cards — motif legibility, accent contrast, locked/current/complete states
- World 10 (Masterpiece Gallery) premium card treatment
- Current-world breathing edge vs. completed (non-dimmed) vs. locked (muted, lock glyph) — clear at a glance
- World Select → World Levels transition feel
- Winding level path: node spacing/overlap on the narrowest supported phone, long world names in the header, capstone (larger, ring, seal) vs. normal node, Level 100's warm-energy distinct treatment vs. other capstones
- Auto-scroll-to-current-level on entering a world already in progress
- Back navigation (World Levels → World Select → Home) consistency
- Touch targets on path nodes at their varying horizontal offsets

## C. Gameplay

- Board frame (bevel, cyan edge, world-accent aura) legible without competing with dense artwork
- 28×28 / 700+ pixel board readability with the pixel brightness-peak on clear
- HUD (restart, difficulty gate, progress) — settings gear now hidden, confirm title stays centered
- ToolBar fully hidden (UI-R9) — confirm the board/controls reclaim that vertical space cleanly, no leftover gap or jump
- World Level Select → Gameplay transition feel (`fade_from_bottom`, 280ms)
- Low-intensity world ambience doesn't distract during active play, on the busiest boards

## D. Tunnels

- Front-charge capacity readability across all 15 gameplay colors (contrast fix from UI-R4)
- Launch recoil + reload feel on a single tap and on rapid repeated taps (no accumulating transform)
- Readiness breathe present only when loaded + available; blocked/empty states read clearly
- 3 tunnels showing different states simultaneously
- `EnergyShot`/`OrbitingCharge` calm-dimming at high concurrency (UI-R9) — confirm it reads as "calming down," not a rendering glitch

## E. Holding

- Arrival pop (scale + colour glow) reads as "landed," not glitchy — especially when a relaunch and an arrival happen close together
- Pressure escalation 1/3 → 2/3 → 3/3 (dots + edge light + label colour) — legible, not alarming
- Relaunch squash/release feel

## F. Win / Failure

- Normal win: timing from final clear → artwork visible → NEXT interactive
- Capstone (any of 10/20/…/90) vs. normal — visibly stronger, not just longer
- **Level 100 finale — the single most important thing to check.** Warm-energy palette, "CAMPAIGN FINALE" kicker, "THE GRAND MASTERPIECE" title, strongest board-frame pulse, `capstoneWin` haptic, largest (still bounded) particle count
- Real "WORLD · LEVEL N" info chip (replaces the old fake reward text)
- Failure: accurate reason text (Holding Full vs. No Moves Left), board-edge flash restrained, Retry immediate
- Rapid NEXT → next level → NEXT flow, checking for animation residue from the previous level's tier
- Result surface layout on the smallest supported phone

## G. Transitions

- Home → World Select, World Select → World Levels, World Levels → Gameplay, and every back-navigation — direction, timing, no flash/blank frame
- No double-animation feel where a route transition and a screen's own entry stagger overlap

## H. World ambience

- All 10 ambient identities (motion kind + shape + colour) distinct and on-theme, both in a static frame and in motion
- Cosmic Frontier's starfield/twinkle appears ONLY on that world — nowhere else, including gameplay for that world (still low-intensity there)
- Ambience visibly pauses when backgrounding the app or navigating away mid-loop
- Gameplay ambience (lowest tier) never distracts from board readability

## I. Haptics

- Tap-acknowledgment (select/heldRelaunch) firing immediately on tunnel/Holding press
- Pixel-clear cadence on a long (20–50 pixel) clear — should feel rhythmic, not like continuous buzzing
- Holding critical/full, chargeConsumed, discoveryResolve vs. capstoneWin — distinct weights
- Failure haptic feel paired with the board-edge flash
- Global haptics-off setting correctly silences everything, no direct-Expo-Haptics bypass

## J. Reduced Motion

- Full pass: Home, World Map (cards + path), Gameplay (board frame, ambience), Tunnels, Holding, Win (all 3 tiers), Failure, Transitions (should simplify to fade), PrimaryCta press/release (fade instead of spring)
- Win hierarchy and warning hierarchy stay legible without motion (colour/text carries the meaning, not animation)

## K. Performance

- 60fps target sustained with: dense board + up to 5 simultaneous flights + calm-dimming active + low ambience + the pixel brightness-peak on a multi-pixel clear
- No frame drop from PrimaryCta's shared-value press/release across rapid taps
- Battery impact of a longer play session with ambience running continuously

## L. Small-screen layout

- Home, World Map (cards + path), Gameplay HUD/board/controls (now shorter without ToolBar), Win/Fail result surfaces — all on the smallest supported phone

## M. Level 100

- Consolidated: node treatment on the World 10 path, World 10's card treatment on World Select, the finale win sequence (see F)
- Open decision carried over from UI-R8: Level 10 (World 1, "First Light") is titled "Ring Nebula" with a reveal name of "THE RING NEBULA" — cosmic language outside Cosmic Frontier, in live authored content. Not touched by any UI milestone (level content is out of scope for the redesign) — flagged for a product decision, not a bug.

## N. Regression / functionality

- Tunnel launch, Holding relaunch, restart, win/loss detection — all engine-facing behavior should be unchanged through every visual milestone; spot-check a full level playthrough end to end
- Settings gear and ToolBar correctly absent from production UI, with no dead tap targets left behind
- Confirm the known pre-existing test failures (8 legacy level-density failures + 1 session/haptics-mock failure) remain the *only* test failures — no new ones were introduced across UI-R1–UI-R9
