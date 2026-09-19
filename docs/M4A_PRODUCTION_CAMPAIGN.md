# M4A — Production Campaign Foundation + Levels 1–30

Branch `milestone/1-core-prototype`. Builds on M3.6B `3488c93`. **Not merged, not
pushed.**

M4A replaces the prototype-first campaign with the first production Pixel Arcadia
campaign: three themed worlds of ten handcrafted levels, denser recognisable
artwork, a solver-backed difficulty curve, discovery reveals, and the **first
implemented special mechanic — Frozen** — introduced and tutorialised in World 3.
No gameplay redesign, no engine-rule change beyond adding Frozen, no
backend/ads/IAP/economy.

Commits: `13f3168` (M4A.1 Frozen) · `a069aae` (M4A.2 World 1) · `a2416af`
(M4A.3 World 2) · `7dd8e74` (M4A.4 World 3 + Frozen rollout) · this docs commit.

> **Engine note (updated after `ef8b240` / `7ca8c75`).** M4A was authored and
> measured on the original M2B engine, which arbitrated concurrent launches
> logically and solved every level twice (sequential vs concurrent). That engine
> is gone. The current engine is **FIRST LAUNCHED, FIRST SERVED**: each Pal is
> resolved exactly once when it launches, against the board earlier launches
> committed, and a later launch never rewrites an earlier Pal's history.
> Concurrency is presentation only (pacing, Active-slot pressure, convoy
> presentation, Holding arrival timing). See `M2B_CONCURRENT_ORBITS.md` §2 / §8.
> The metric table in §2 is the **M4A ship-time snapshot** and is kept for
> history; engine-mechanic prose below describes the current engine.

---

## 1. The three worlds

| world | id | levels | theme | purpose |
|---|---|---|---|---|
| **FIRST LIGHT** | `first-light` | 1–10 | celestial — moon, stars, sun, Saturn, comet, eclipse, nebula | teach the core game cleanly |
| **WILD GARDEN** | `wild-garden` | 11–20 | nature — ladybird, tulip, bee, toadstool, dragonfly, monarch, koi, hummingbird, fox, oak | deeper queue sequencing, richer colour |
| **DEEP FROST** | `deep-frost` | 21–30 | winter — frost, snowdrop, icicles, pond, hare, lantern, aurora, crystal, owl, crown | the Frozen mechanic |

`src/game/levels/campaign.ts` builds the `CampaignManifest` from a world
blueprint, filtered to the levels that exist — deterministic order, three worlds,
every level assigned to exactly one, no duplicates, no `orbitide` branding.

## 2. Level progression & difficulty curve

Authored difficulty is validated against the M3B advisory solver score
(`analysis/difficulty.ts`): `easy < 20 ≤ medium < 42 ≤ hard`. **Every level's
authored tier matches its suggested tier, except L5** (authored `easy`, suggests
`medium`) — a deliberate onboarding call (Part 17): L5 is the first level with a
real fail path, and its 14 % random-play loss is the teaching moment, not a
difficulty spike.

| L | title | world | px | frozen | authored | suggested | score | shortest win | peak Holding | viable 1st | max active | fail path | held relaunch | solver nodes | warnings |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | First Light | first-light | 20 | – | easy | easy | 3 | 3 | 0 | 3/3 | 1 | N | 0 | 16 | trivial-first-moves(i) |
| 2 | The Guiding Star | first-light | 21 | – | easy | easy | 10 | 4 | 0 | 3/3 | 1 | N | 0 | 49 | trivial-first-moves(i) |
| 3 | Sunrise | first-light | 29 | – | easy | easy | 5 | 4 | 0 | 3/3 | 1 | N | 0 | 71 | trivial-first-moves(i) |
| 4 | Saturn | first-light | 39 | – | easy | easy | 16 | 5 | 1 | 3/3 | 2 | N | 0 | 340 | — |
| 5 | The Long Comet | first-light | 33 | – | easy | **medium** | 30 | 7 | 1 | 3/3 | 2 | **Y** | 0 | 18 407 | difficulty-mismatch(i) |
| 6 | Solar Halo | first-light | 31 | – | easy | easy | 16 | 5 | 2 | 3/3 | 4 | N | 0 | 359 | — |
| 7 | The Pole Star | first-light | 25 | – | easy | easy | 16 | 5 | 0 | 3/3 | 1 | N | 0 | 277 | — |
| 8 | Falling Star | first-light | 37 | – | easy | easy | 16 | 5 | 1 | 3/3 | 4 | N | 0 | 524 | — |
| 9 | Total Eclipse | first-light | 31 | – | medium | medium | 26 | 6 | 2 | 3/3 | 4 | N | 0 | 3 804 | no-fail-path(w) |
| 10 | Ring Nebula | first-light | 44 | – | **hard** | hard | 58 | 9 | 2 | 3/3 | 3 | **Y** | 2 | 7 444 | — |
| 11 | Ladybird | wild-garden | 37 | – | easy | easy | 7 | 5 | 0 | 3/3 | 1 | N | 0 | 1 798 | — |
| 12 | Tulip | wild-garden | 30 | – | easy | easy | 5 | 4 | 0 | 3/3 | 1 | N | 0 | 49 | trivial-first-moves(i) |
| 13 | Honeybee | wild-garden | 33 | – | easy | easy | 6 | 5 | 0 | 3/3 | 1 | N | 0 | 235 | trivial-first-moves(i) |
| 14 | Toadstool | wild-garden | 46 | – | medium | medium | 22 | 6 | 1 | 3/3 | 1 | N | 1 | 1 396 | no-fail-path(w) |
| 15 | Dragonfly | wild-garden | 49 | – | medium | medium | 23 | 6 | 1 | 3/3 | 1 | N | 1 | 346 | trivial-first-moves(i), no-fail-path(w) |
| 16 | Monarch | wild-garden | 59 | – | medium | medium | 20 | 6 | 1 | 3/3 | 2 | N | 1 | 2 855 | no-fail-path(w) |
| 17 | Koi Pond | wild-garden | 54 | – | medium | medium | 28 | 6 | 1 | 3/3 | 1 | N | 1 | 360 | trivial-first-moves(i), no-fail-path(w) |
| 18 | Hummingbird | wild-garden | 41 | – | medium | medium | 28 | 6 | 1 | 3/3 | 1 | N | 1 | 441 | trivial-first-moves(i), no-fail-path(w) |
| 19 | Red Fox | wild-garden | 54 | – | medium | medium | 27 | 5 | 1 | 3/3 | 4 | N | 0 | 3 905 | concurrency-trivializes(i), no-fail-path(w) |
| 20 | The Great Oak | wild-garden | 43 | – | **hard** | hard | 42 | 8 | 3 | 3/3 | 2 | N | 2 | 1 940 | no-fail-path(w) |
| 21 | First Frost | deep-frost | 21 | 4 | easy | easy | 16 | 4 | 1 | 3/3 | 1 | N | 1 | 31 | trivial-first-moves(i) |
| 22 | Snowdrop | deep-frost | 29 | 3 | easy | easy | 16 | 4 | 1 | 3/3 | 1 | N | 1 | 34 | trivial-first-moves(i) |
| 23 | Icicles | deep-frost | 34 | 4 | medium | medium | 22 | 6 | 2 | 3/3 | 1 | N | 2 | 174 | no-fail-path(w) |
| 24 | Frozen Pond | deep-frost | 59 | 3 | medium | medium | 34 | 7 | 2 | 3/3 | 1 | N | 2 | 4 061 | no-fail-path(w) |
| 25 | Winter Hare | deep-frost | 52 | 3 | easy | easy | 15 | 4 | 0 | 3/3 | 1 | N | 0 | 264 | — |
| 26 | The Frozen Lantern | deep-frost | 25 | 5 | **hard** | hard | 46 | 9 | 2 | 3/3 | 1 | N | 4 | 1 717 | no-fail-path(w) |
| 27 | Aurora Veil | deep-frost | 49 | 3 | medium | medium | 26 | 6 | 3 | 3/3 | 1 | N | 3 | 264 | no-fail-path(w) |
| 28 | Ice Crystal | deep-frost | 25 | 5 | medium | medium | 26 | 6 | 1 | 3/3 | 1 | N | 2 | 372 | trivial-first-moves(i), no-fail-path(w) |
| 29 | Snow Owl | deep-frost | 52 | 4 | **hard** | hard | 46 | 8 | 2 | 3/3 | 1 | N | 3 | 2 163 | no-fail-path(w) |
| 30 | The Frost Crown | deep-frost | 62 | 6 | **hard** | hard | 47 | 9 | 2 | 3/3 | 1 | N | 4 | 3 241 | no-fail-path(w) |

`(i)` info · `(w)` warn. **Snapshot caveat:** these numbers were measured at M4A
ship time on the retired arbitration engine. The `max active` column and the
`concurrency-trivializes` warning come from the retired sequential-vs-concurrent
comparison and no longer exist; the current solver reports one canonical solve
per level, and scores, node counts and fail paths may differ. Re-measure through
the Studio / canonical `solve` rather than trusting this table.

At ship time all 30 were **solvable, deterministic and winnable with zero
boosters**, and every winning witness replayed through the real runtime and won
(`levelDefinitions.test.ts`, `metrics.test.ts`); the tray never exceeded 3 on any
calm line.

### World milestones (L10 / L20 / L30)

- **L10 Ring Nebula** — a concentric 4-colour ring (yellow / white / orange /
  pink core) with two pink dead-charges stacked in front of the outer ring; peak
  2, held 2, **74 % random-play loss**, a genuine fail path, an authored reveal.
- **L20 The Great Oak** — a topiary crown (green / coral / gold / lime) with two
  buried accents funnelled ahead of the whole canopy in one tunnel; peak 3,
  held 2, an 8-move solve, THE WORLD TREE reveal.
- **L30 The Frost Crown** — the densest board (62 px, 6 Frozen), gold spire under
  ice, a 9-move solve, 4 held relaunches, THE FROST CROWN reveal.

## 3. Holding curve (Part 6)

- **L1–3 / L11–13 / L21–22, 25** — no meaningful Holding on the calm line
  (`minWinningPeak = 0`).
- **L4** — a buried gold nucleus strands the first charge: the player learns the
  manual relaunch.
- **L5** — the first level where a greedy line can lose.
- **L6–10** — Holding is part of the intended solution (peak 1–2).
- **L14–20** — a buried accent behind the dominant colour forces one held
  relaunch on every winning line; peak 1 typical, peak 3 on the L20 finale.
- **L21–30** — Frozen drives Holding: cracking an iced pixel spends the charge's
  one encounter with it that lap, so the thawed pixel *must* be cleared by a
  later launch or manual relaunch (held 1–4). 3/3 saturation is never routine
  on an Easy level.

## 4. Concurrency (Part 7)

The 5-charge rail is a presentation feature, not a logical mechanic. Under FIRST
LAUNCHED, FIRST SERVED a launch made while Pals are still orbiting resolves
exactly like the same launch made after the rail settles, so concurrency can
neither shorten nor break a solution. It still matters for game feel: visual
pacing, Active-slot pressure (at most `activeCapacity` Pals airborne), convoy
presentation and when a leftover visibly lands in Holding.

Historical: M4A originally reported that the concurrent epoch resolved nested
single-colour cascades in one lap, capping World 2's difficulty at Medium. That
was a property of the retired arbitration engine, not of the current one — see
§8.

## 5. Frozen — first implemented special mechanic

### Engine rule (`src/game/engine/frozen.ts`, M4A.1)

A Frozen pixel keeps its base colour under a thick ice shell. `modifier.level` is
the ice-layer count (**production durability = 1**).

1. A matching-colour charge that reaches a Frozen pixel spends **one capacity**.
2. If ice remains: `level → level − 1`, `state → 'broken'` when it hits 0. The
   base pixel is **not cleared** and stays on the board (`frozenBreak`).
3. If no ice remains: the pixel clears normally.
4. **One encounter per pixel per charge-pass** — a `pickEncounter` `exclude` set
   / per-cursor `hitPixelIds` stop a charge cracking then clearing on the same
   lap. A second hit (any later launch or manual relaunch) does the clear.
5. **Exposure is unchanged** — a Frozen cell (iced or thawed) is solid until the
   pixel itself clears; the flood fill never treats it as empty.
6. The clockwise clear order is unchanged. Each launch is resolved once, in
   launch order, against the committed board (FIRST LAUNCHED, FIRST SERVED), so
   no two charges ever claim the same pixel — a contested pixel goes to the
   earlier launch.

Memo keys (`solver.stateKey`, `epoch.simKey`) encode modifier state via
`boardFingerprint`: cleared `C`, iced `F<layers>`, thawed Frozen `FB` (Shielded /
Linked have their own tokens). Iced, thawed and plain pixels never alias.

### Frozen exposure / targeting (Part 9)

- A Frozen pixel is targetable whenever its base cell is legally exposed.
- Breaking ice is **not** a pixel clear — the win condition counts it uncleared.
- Capacity is spent on the break.
- `legalActions` still offers a matching charge while only ice remains; when
  capacity for that colour runs out with ice intact the runtime marks a deadlock
  exactly as for a normal shortfall (proven unsolvable, never silently "won").

### Solver support (Part 10)

The solver drives the real engine, so it models Frozen for free: the extra
required hit lengthens winning lines, raises capacity pressure and forces held
relaunches, all reflected in the M3B difficulty score. `stateKey` distinguishes
ice states so the search never conflates them.

### Trace events (Part 10)

`TraceStep` gains `frozenBreakPixelIds` alongside `clearedPixelIds` — a
`FROZEN_HIT` and a `PIXEL_CLEAR` for the same pixel are separate events on
separate steps; the trace visualiser can explain each.

### Presentation (Part 12)

- `frozenHit` playback event (`buildScript`) fires at the encounter beat;
  `useGameSession` mirrors the engine's updated modifier into the lagged view,
  emits an `iceCrack` sound/haptic (light, brittle), and never marks the pixel
  cleared.
- `SpecialPixelLayer`'s `ice` shell is a thicker translucent slab (filled body +
  bright inner bevel + heavier outer edge, simplified on dense boards) over the
  still-readable base colour — not a flat snowflake overlay. Once thawed
  (`state: 'broken'`) the shell renders nothing and the base pixel shows through.
- `OrbitBoard` reads live `pixel.modifier`; a cracked pixel stays on the static
  layer with its shell, so only real clears are handed to the flight actor.
- No heavy per-frame effects — the shell is static Skia; the crack is a
  one-shot.

### Tutorial timing (Part 11)

`LevelDefinition.tutorial` (new optional field, carried through the Studio
serializer). **Level 21 only:** *"Frozen pixels take an extra hit — crack the
ice, then clear."* rendered as a small non-modal pill above the board. It hides
on the first successful ice break or the fourth launch, whichever comes first;
no other level shows it and it never re-appears.

## 6. Solver metrics summary

Current solver model (see `M2B_CONCURRENT_ORBITS.md` §8):

- One canonical solve per level over **logical player choices** — one launch per
  tunnel front and per held charge the runtime admits. Joins are not separate
  branches.
- Memo identity is the committed logical state (board progress, queues,
  Holding); open-epoch presentation residue is not part of it.
- A held-Pal relaunch that loops back to a state already on the line is a no-op,
  not a losing choice; a state whose every choice is such a loop is a
  deadlock / loss. `failPath` is always a real losing continuation.
- `heldRelaunches` on a witness equals the count of explicit `holding` actions
  (no implicit relaunch anywhere).
- Difficulty: `concurrencyGap` is retired; the remaining weights intentionally
  total 0.95 and are **not** renormalised until a dedicated recalibration.

At M4A ship time (retired engine): all 30 levels solvable and complete, node
counts 16 – 18 407 (L5 the hotspot from its long fail tree), and `NO_FAIL_PATH`
firing on most Medium levels because the generous 3-slot tray always left a
non-losing line. That warning is advisory, not a gate — noted for M4B (§8).

## 7. Validation

### Testing philosophy (current)

- **Campaign levels are content, not permanent engine regression fixtures.**
  Engine invariants (launch ordering, no retroactive rewrite, caching, solver
  loop / deadlock handling) are pinned with small **synthetic** fixtures.
- **New mechanics / modifiers** get targeted regression tests of their own.
- **Normal new levels** get structural validation (`batchValidate` /
  `validateManifest`) plus solver / witness validation: solvable, and the
  witness replays through the real runtime to a win.
- **Broad all-campaign sweeps** are reserved for major engine-semantic changes
  (such as the FIRST LAUNCHED, FIRST SERVED rewrite).

### M4A ship-time results

- `npx jest` — **45 suites / 582 tests, all pass** (was 454 at M3.6B: +13
  `frozen.test.ts`, +1 haptics `iceCrack`, +campaign frozen test, campaign tests
  rewritten for 30 levels). No mechanic assertion weakened.
- `npx tsc --noEmit` (strict, `noUncheckedIndexedAccess`, `noImplicitOverride`) —
  clean.
- `npx eslint .` — clean.
- `npx expo-doctor` — **21 / 21**, no issues.
- `npx expo export -p web` — succeeds (`dist/m4a-web`).
- `npx expo export -p ios` — succeeds (`dist/m4a-ios`).
- `npx expo export -p android` — succeeds (`dist/m4a-android`).
- Studio stays dev-web-only: grepping the exported iOS + Android bundles for
  `Level Studio`, `MODIFIER_SPECS`, `thumbnailSVG`, `batchValidate` — **0 hits**.
  The Frozen engine (`frozen.ts`) is in the native bundle (it is real gameplay).
- Batch validation (`batchValidate` over all 30 + manifest): **ok, 0 errors, 9
  advisory warnings**; `validateManifest` clean.
- No device testing (standing project caveat — no simulator in this environment).
  Frozen shell art, the `iceCrack` cue and the tutorial pill are unproven on
  device.

## 8. Known risks / M4B work

1. **Flat single-colour subjects top out at Medium.** At M4A this was blamed on
   the M2B epoch resolving nested cascades in one lap; that arbitration no
   longer exists (launches now resolve one at a time, in order), so re-measure
   World 2 on the canonical solver before retuning. If they still read Medium,
   retune with playtest fail/retry data — e.g. lower `holdingCapacity` on select
   levels or add a second substantial colour to the flatter subjects.
2. **`NO_FAIL_PATH` on Medium levels.** The 3-slot tray is forgiving; several
   Mediums have no losing line under optimal play. Acceptable for a first
   campaign; M4B may tighten budgets or trays.
3. **World 1 runs gentle.** L1–8 score 3–30 — a deliberate onboarding ramp
   (Part 17), safe under Part 18 (nothing Easy-labelled plays Hard). The old
   prototype's inverse mistake (L6–8 `easy` but scoring 54–60) is fixed.
4. **Density deviations.** L16 Monarch (59 px) and L24 Frozen Pond (59 px) sit
   just above the 30–50 target; L21/22/26/28 (Frozen teaching / tight crystal)
   sit below 35 for readability. All stay recognisable.
5. **`Solver/runtime admission mismatch`** surfaced once during authoring on an
   over-tight L19 draft (double dead-charge front + full tray). The shipped L19
   does not trigger it, but it is a latent solver/`actionRejection` edge worth a
   dedicated repro + fix in M4B.
6. **First-move variety on the hardest levels.** L14–18 and the Frozen hards
   funnel the dominant colour through one tunnel, so `viableFirstMoves` is 3/3
   but the *strong* opening is narrow — intended for a finale, flagged as a
   pattern to vary in M4B.

## 9. Deferred to M4B

Playtest-calibrated retuning of the whole curve; Super Hard / Extreme tiers;
Worlds 4+; the other seven modifier mechanics (Shielded / Armored / Locked /
Hidden / Bomb / Wild / Linked — still inert); multi-layer Frozen; a world-select
screen; the collection system keyed on `reveal.collectionId`; sound assets for
`iceCrack` and the rest.

**Do not merge. Do not push.**
