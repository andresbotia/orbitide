# M4B — Campaign Expansion, Worlds 4–6, and Shielded

Branch `milestone/1-core-prototype`. This milestone expands the production
campaign from 30 to 60 levels and implements one new gameplay modifier:
**Shielded**. It does not add backend, economy, ads, IAP, boosters, or a new game
model. Work remains local: no merge and no push.

Implementation commits:

- `7557cd6` — M4B.1 Shielded gameplay, traces, presentation, feedback, and tests
- `5c26ca9` — M4B.2–4 production Worlds 4–6 and campaign tests
- final M4B.5 documentation/verification commit (this document)

## Campaign structure

| World | ID | Levels | Theme | Gameplay role |
|---|---|---:|---|---|
| CURIO CABINET | `curio-cabinet` | 31–40 | keepsakes, instruments, treasures under glass | dense core-rule mastery with selected Frozen callbacks |
| PRISM WORKS | `prism-works` | 41–50 | luminous glass, optics, spectral objects | Shielded introduction and escalation |
| FROSTGLASS FORGE | `frostglass-forge` | 51–60 | enchanted tools and frostglass machinery | mixed Frozen + Shielded mastery |

All 30 additions have unique titles, recognizable authored pixel art, discovery
reveals derived from the silhouette, exact per-color capacity budgets, and a
single campaign assignment. L40/L50/L60 are deliberate visual and mechanical
finales. World 5 uses Shielded without Frozen; every World 6 board uses both
mechanics, but no cell stacks modifiers.

## Shielded gameplay contract

A Shielded pixel keeps its base color under a separate energy membrane.

1. A matching encounter spends one capacity and collapses one shield layer.
2. That encounter does **not** clear the pixel; the cell remains solid and its
   base color is unchanged.
3. Production levels use one layer. The next legal matching encounter clears the
   now-broken Shielded pixel normally.
4. Exposure, clockwise targeting, capacity rules, Holding, epoch scheduling,
   deterministic arbitration, win/loss checks, and the five-charge rail remain
   shared engine behavior.
5. A cursor cannot hit the same cell twice in one lap. Concurrent charges are
   arbitrated by the existing deterministic epoch resolver.

The resolver emits `shieldBreak` / `shieldBreakPixelIds`, distinct from both a
normal clear and `frozenBreak`. Presentation turns that into `shieldHit`; sound
and haptics consume the semantic event. The engine fingerprint distinguishes
normal (`N`), Frozen intact (`F#`), Frozen broken (`FB`), Shielded intact (`S#`),
Shielded broken (`SB`), and cleared (`C`) cells. Solver, replay, trace, Studio,
and runtime therefore operate on the same serializable state.

L41 is the only Shielded teaching cue: **“Shielded pixels need an extra hit.”**
It dismisses on the first Shield break; the existing bounded-launch fallback
still prevents a tutorial from lingering if the player avoids the mechanic.

## Presentation

Shielded reuses the existing special-material membrane model, now driven by live
engine state. The shell is larger than the cube and has a visible inner boundary
so the air gap reads clearly. A translucent body, energy-colored perimeter,
facet seam, specular highlight, and density-gated micro-arc provide volume. The
break uses the shared one-shot shield-collapse/ripple motion hook; broken state
removes the membrane and leaves the base pixel. Reduced-motion and board-density
detail rules remain in force, and the existing idle-animation budget is not
expanded.

## L31–60 solver and pressure report

This table comes from the production analyzer at a 300,000-node cap. Every row
completed in sequential-compat and concurrent modes, produced a winning witness,
and replayed it through the real engine. `peak` is minimum winning Holding
occupancy; `active` is maximum concurrent charges on the selected winning
witness; `held` is held-charge relaunches. Warnings are advisory, not hidden
retunes: `diff` difficulty mismatch, `no-fail`, `no-hold`, `trivial`, and `nodes`
solver-node pressure.

| L | Title | px | F/S | authored→suggested | score | win | peak | first | active | fail | held | nodes | warnings |
|---:|---|---:|---:|---|---:|---:|---:|---:|---:|:---:|---:|---:|---|
| 31 | Old Hourglass | 35 | 0/0 | medium→easy | 12 | 6 | 0 | 3/3 | 1 | N | 0 | 3,911 | no-hold, diff, no-fail |
| 32 | Silver Key | 35 | 0/0 | medium→medium | 23 | 5 | 1 | 3/3 | 1 | N | 1 | 528 | no-fail |
| 33 | Music Box | 50 | 0/0 | medium→hard | 59 | 10 | 2 | 3/3 | 1 | Y | 2 | 11,105 | diff |
| 34 | True Compass | 39 | 0/0 | medium→easy | 19 | 7 | 0 | 3/3 | 1 | N | 0 | 34,235 | no-hold, diff, no-fail |
| 35 | Keepsake Lantern | 35 | 2/0 | medium→medium | 35 | 8 | 2 | 3/3 | 1 | N | 2 | 8,129 | no-fail |
| 36 | Pocket Watch | 54 | 0/0 | medium→medium | 34 | 8 | 2 | 3/3 | 5 | Y | 1 | 38,691 | — |
| 37 | Snow Globe | 60 | 0/0 | medium→hard | 43 | 7 | 2 | 3/3 | 3 | Y | 1 | 19,354 | diff |
| 38 | Moonlit Potion | 38 | 3/0 | medium→hard | 43 | 10 | 2 | 3/3 | 1 | Y | 3 | 9,281 | diff |
| 39 | Velvet Crown | 58 | 0/0 | hard→medium | 39 | 9 | 2 | 3/3 | 1 | Y | 2 | 103,360 | nodes, diff |
| 40 | The Curio Chest | 84 | 4/0 | hard→super-hard | 63 | 13 | 2 | 3/3 | 1 | Y | 5 | 11,914 | diff |
| 41 | Glass Seed | 40 | 0/1 | medium→medium | 32 | 6 | 1 | 3/3 | 1 | N | 2 | 232 | no-fail |
| 42 | Light Bulb | 54 | 0/2 | medium→medium | 34 | 7 | 1 | 3/3 | 1 | N | 2 | 15,805 | no-fail |
| 43 | Crystal Drop | 40 | 0/3 | medium→medium | 39 | 9 | 2 | 3/3 | 1 | N | 3 | 3,481 | no-fail |
| 44 | Prism Kite | 40 | 0/3 | medium→medium | 29 | 10 | 1 | 3/3 | 1 | N | 2 | 49,743 | trivial, no-fail |
| 45 | Stained Rose | 61 | 0/3 | medium→medium | 40 | 8 | 2 | 3/3 | 5 | N | 3 | 7,679 | no-fail |
| 46 | Neon Mirror | 65 | 0/4 | medium→hard | 48 | 9 | 3 | 3/3 | 4 | N | 4 | 1,573 | diff, no-fail |
| 47 | Sun Catcher | 40 | 0/4 | medium→hard | 42 | 11 | 2 | 3/3 | 1 | N | 4 | 96,639 | nodes, diff, no-fail |
| 48 | Spectrum Vase | 49 | 0/4 | medium→medium | 30 | 9 | 2 | 3/3 | 3 | N | 3 | 27,535 | no-fail |
| 49 | Aurora Lens | 65 | 0/5 | hard→hard | 45 | 12 | 3 | 3/3 | 1 | Y | 6 | 64,538 | nodes |
| 50 | The Grand Prism | 41 | 0/6 | hard→medium | 33 | 12 | 3 | 3/3 | 1 | N | 6 | 59,812 | diff, no-fail |
| 51 | Frostglass Bell | 52 | 1/1 | medium→hard | 44 | 10 | 2 | 3/3 | 1 | Y | 3 | 70,468 | nodes, diff |
| 52 | Arcane Shears | 45 | 2/2 | medium→medium | 23 | 7 | 2 | 3/3 | 1 | N | 2 | 557 | no-fail |
| 53 | Enchanter Flask | 48 | 1/1 | medium→medium | 35 | 8 | 2 | 3/3 | 1 | N | 2 | 21,276 | no-fail |
| 54 | Runed Anvil | 54 | 3/3 | medium→hard | 46 | 11 | 2 | 3/3 | 1 | Y | 5 | 14,021 | diff |
| 55 | Gilded Gear | 67 | 2/2 | medium→medium | 41 | 10 | 3 | 3/3 | 5 | N | 4 | 20,280 | no-fail |
| 56 | Crystal Hammer | 65 | 3/3 | hard→hard | 59 | 12 | 3 | 3/3 | 1 | Y | 5 | 54,970 | — |
| 57 | Frostbound Violin | 46 | 2/3 | hard→medium | 40 | 9 | 2 | 3/3 | 1 | N | 3 | 20,491 | diff, no-fail |
| 58 | The Rune Engine | 70 | 2/3 | hard→hard | 48 | 10 | 3 | 3/3 | 5 | N | 4 | 7,176 | no-fail |
| 59 | Prismatic Reliquary | 69 | 2/2 | hard→hard | 61 | 11 | 3 | 3/3 | 2 | Y | 4 | 69,833 | nodes |
| 60 | The Frostglass Crown | 68 | 3/3 | hard→hard | 44 | 10 | 3 | 3/3 | 2 | Y | 4 | 52,992 | — |

### Curve observations

- World 4 moves from two low-pressure breathers into repeated peak-2 play and
  genuine fail paths; L40 is the campaign's densest board and a super-hard
  solver suggestion.
- World 5 grows from one shield/peak 1 to six shields/peak 3. L46 establishes
  tray saturation before the hard L49–50 close; the finale requires six held
  relaunches even though exact budgets make its calm line non-losing.
- World 6 alternates pressure profiles instead of forming a flat ramp, then holds
  peak 3 for L55–60 except L57. Three of the last five levels have proven fail
  paths, and L58 demonstrates all five active-charge slots on a winning witness.
- Suggested-tier mismatches never exceed one tier. They remain explicit because
  the analyzer is advisory and art/theme pacing is also part of authored
  difficulty. No label was silently changed merely to suppress a warning.

The measured L31–60 analysis took **343.0 s** on the development machine:
76.5 s for World 4, 134.0 s for World 5, and 132.4 s for World 6. Shield state
adds one finite intermediate board state per protected pixel, so node pressure is
visible on L47/L49/L50 and mixed L51/L59, but it is not a new runtime loop or
parallel solver. The shared resolver, compact fingerprint, one-hit-per-lap guard,
and existing node caps contain it. Frame performance was not claimed from this
headless run; device profiling remains appropriate before release.

## Validation matrix

The milestone is checked through:

- all 60 production definitions: structure, density bands, exact capacity,
  campaign assignment, unique titles, reveal geometry, and modifier legality;
- sequential-compat and concurrent solver completion with zero boosters;
- deterministic winning-witness replay and admission consistency;
- Shielded unit coverage for capacity spend, non-clear first hit, second-hit
  clear, exposure, same-lap exclusion, concurrent arbitration, traces, state
  fingerprints, presentation events, haptics, and Studio budgeting;
- full Jest, TypeScript, ESLint, Expo Doctor, and static Expo exports for web,
  iOS, and Android.

Final verification on the completed tree:

| Gate | Result |
|---|---|
| Full Jest | **49 suites / 828 tests passed**, 0 failures, 1,550.4 s |
| TypeScript | `tsc --noEmit` passed |
| ESLint | `eslint .` passed |
| Expo Doctor | **21/21 checks passed** |
| Expo static export | web, iOS, and Android passed via `--platform all` |

Export artifacts are in ignored local directory `dist/m4b-all`: web 3.0 MB JS,
iOS 4.4 MB Hermes, and Android 4.6 MB Hermes. The Jest console still contains
React 19's existing `react-test-renderer` deprecation notices; they are warnings,
not failures. No simulator/device claim is made.

## Known deviations and follow-up

1. Several exact-budget levels intentionally have no losing branch. Holding,
   relaunch count, solve length, and concurrency still provide pressure; a
   guaranteed fail path would require changing the established capacity model.
2. L40 exceeds the usual board-density target (84 pixels) as an intentional
   finale tableau. Several other silhouettes sit near the high end to remain
   recognizable.
3. Solver-node warnings are performance signals, not incomplete searches: all
   reported rows completed under the 300,000-node cap.
4. Shield break audio/haptics are semantically wired and test-covered, but
   subjective loudness, contrast, and feel still need physical-device QA.
5. No modifier stacking is supported or authored. Future combinations should
   preserve the current one-modifier-per-cell model unless the engine contract
   is deliberately redesigned.
