# M3A — Level Studio Foundation

Branch `milestone/1-core-prototype`. Three commits — M2B regression hardening,
Studio foundation, solver promotion + Play + Solve (hashes in §16). Builds on
M2B `9f780b7`. **Not merged, not pushed.**

M3A delivers an **internal, dev-only, web-only** Level Studio. It does not
redesign the game, add backend/economy, add special-pixel mechanics, or rename
the app.

---

## 1. Exit condition

> A developer can create or load a normal ORBITIDE level, paint the board,
> author all three deterministic tunnel queues, validate it, play it using the
> real game, run the real solver, and export/save the canonical production level
> definition without hand-editing the level source code.

Met. Route: `npm run web` → open `/studio`.

---

## 2. Architecture

### One source of truth

| concern | owner | the Studio… |
|---|---|---|
| level schema | `engine/types.ts` `LevelDefinition` | serialises to/from it exactly — no second format |
| art parsing | `engine/art.ts` `parsePixelArt` | reuses it in `fromLevelDefinition` |
| game rules | `engine/**` | `validate` calls the real `createGame`; playtest runs the real `GameScreen`/`useGameSession` |
| solver | `engine/solver.ts` (promoted this milestone) | calls it via `studio/analyze.ts` |

The Studio's own code (`src/game/studio/**`) is **pure** — no React / RN imports —
so it runs in the existing ts-jest harness (`roots: src/game`).

### Where it lives — and why

**A dev-only Expo Router web route**, not a separate app:

- `app/studio.tsx` — the single `/studio` route. Renders `<StudioEntry/>` **only
  when `__DEV__ === true && Platform.OS === 'web'`**; otherwise `<Redirect
  href="/" />` (so a production *web* export is gated too).
- `StudioEntry` is a **platform-split module**: `src/screens/studioEntry.web.tsx`
  re-exports the real `LevelStudioScreen`; `src/screens/studioEntry.tsx` is a
  `null` stub. Metro resolves the `.web` file on web and the stub on native, so
  `LevelStudioScreen`, every `src/components/studio/*` module, and the web
  CanvasKit loader are **never bundled into an iOS or Android build**. (An
  earlier `app/studio.web.tsx` route split was dropped — expo-router's app-dir
  `require.context` pulled the `.web.tsx` route into the native graph; a plain
  `src/` platform import does not.)

Rationale: zero new build system (react-native-web is the standard Expo web
runtime, same Metro bundler), direct TypeScript imports of the shared
engine/schema/solver, and the playtest can embed the **real** `GameScreen`.
A standalone Vite app was rejected — it could import the pure engine but not
reuse the RN gameplay screen without duplication.

### New runtime dependencies

`react-dom`, `react-native-web`, `@expo/metro-runtime` (Expo-managed versions).
Standard Expo web support — not a second build system.

---

## 3. Level schema integration

`LevelDefinition` is used verbatim. The Studio working document (`StudioLevel`)
is a lossless superset: the only structural difference is a sparse
`cells: Record<"x,y", OrbColor>` map for cheap paint/erase, folded into
`pixelArt` rows + an optional `legend` on serialize.

- **Grid sizes**: the schema imposes no size limit. The Studio treats
  `4–17` as legal and *warns* outside the renderer-tuned `7/9/11/13/15`
  (Levels 1–10 include 6×6, 7×7, 7×9, 8×8 — all load and validate with zero
  errors).
- **Colours**: the 15 `OrbColor` ids are the only palette. The nine in the
  shared default art legend keep their historical characters
  (`B C W P K Y O R G`); the other six get stable extra characters
  (`gold→A coral→D magenta→M indigo→N teal→T lime→L`) and force an explicit
  `legend` entry on export.
- **Holding capacity**: fixed at 3, surfaced but not edited (a non-3 value is a
  warning).
- `reveal` and any authored `legend` are preserved verbatim across a round-trip.

---

## 4. Editor features

| area | implemented |
|---|---|
| metadata | level id, title, theme/artwork name, difficulty (5 tiers), grid W×H (steppers + tuned presets) |
| canvas | paint / erase / clear, click **and** click-drag painting, undo/redo (snapshot stack, bounded 100), dev coordinate rulers |
| palette | all 15 real `OrbColor`s + erase; non-default-legend colours flagged |
| tunnels | all 3 queues; per charge: colour picker, capacity stepper, move up/down, duplicate, delete; add charge; visual queue with "front first" |
| load / new | New (next free id), Load 1–10 |
| export preview | live canonical TS **and** JSON, deterministic, read-only |

Undo/redo, all board ops and all tunnel ops are pure functions in
`studio/model.ts`.

---

## 5. Validation rules (`studio/validate.ts`)

Shared utility; the UI renders the `ValidationReport`, never re-derives a rule.

**Errors (block export):** empty board · board colour with no matching charge ·
non-positive / non-integer charge capacity · wrong tunnel count · pixel outside
the grid · duplicate pixel · invalid difficulty / non-positive level id · grid
dimension outside 4–17 · engine `createGame` rejection.

**Warnings (do not block):** per-colour capacity below pixel count
("cannot be completed") · per-colour capacity above pixel count · empty tunnel
queue · grid size legal but off the renderer-tuned set · charge colour absent
from the board · missing title / theme · holding capacity ≠ 3.

No hard-coded pixel maximum — a 15×15 / 90-pixel board validates clean
(test: `validate.test.ts`).

---

## 6. Play integration

`PLAY LEVEL` → `StudioPlaytest`:

- `useGameSession` and `GameScreen` gained an optional `level?: LevelDefinition`
  (used only here; campaign play is unchanged). The playtest passes
  `toLevelDefinition(studioLevel)`.
- The **real** `GameScreen` is mounted — real session, real concurrent engine,
  real Holding, real Discovery/fail overlays. `Reset` = remount with a fresh
  key. `Back to editor` returns.
- On web the Skia board needs CanvasKit; `StudioPlaytest` loads
  `canvaskit-wasm@0.41.0` from the jsDelivr CDN via a plain `<script>` tag and
  publishes `global.CanvasKit` (which Skia's web renderer reads) — no `public/`
  setup step, and **no static `canvaskit-wasm` import** (that pulls Node `fs`
  into the graph and breaks the native bundle, which is why `<WithSkiaWeb>` is
  not used). A `StudioErrorBoundary` + a load-failed state keep a CanvasKit
  problem from taking down the editor.
- Playable only when the level is export-valid (no errors).

Exercises: tunnel launches, concurrent charges, Holding, manual held-charge
relaunch, win, fail — all through the shipped code paths.

---

## 7. Solver integration

### Promotion

`solve` / `audit` / `stateKey` / `enumerateActions` / `SolveMode` / `SolveResult`
moved from `engine/__tests__/solver.ts` to a real module **`engine/solver.ts`**
(production-neutral, no test imports, exported from `engine/index.ts`).
`engine/__tests__/solver.ts` is now a one-line re-export shim, so every existing
test import still resolves and `metrics.test` / `levelDefinitions.test` are
unchanged. Added: `SolverCancelled` + an optional `signal: { cancelled }` for
cooperative cancellation.

### Studio surface

`studio/analyze.ts` → `analyzeStudioLevel(level)` runs the shared solver on
`toLevelDefinition(level)` (`mode: 'metrics'`, `nodeCap: 200 000`). `SolverPanel`:

- **SOLVABLE YES / NO**
- explored node count + elapsed ms, viable first moves (/3)
- shortest win length, peak Holding on witness, minimum possible peak Holding,
  held relaunches on witness, max active charges on witness
- max active charges / max Holding across the whole explored graph
- loss probability under uniform play
- fail witness length, and a printed representative winning (or fail) line

Runs off the next tick so the busy state paints; **Cancel** flips the signal;
never runs on a brush stroke (manual button only); a stale result is hidden
after any edit. `nodeCap` overflow is shown as an error, editor stays usable.

The full analytics dashboard (path visualisation, difficulty scoring, batch
runs, Holding-pressure charts) is **M3B** and deliberately not built here.

---

## 8. Save / export workflow

No backend. Bottom action bar:

- **Copy as TS** → `navigator.clipboard` with `serializeToTS(level)` — a
  paste-ready object literal in the exact style of `levelDefinitions.ts`.
- **Download JSON** → `level-<id>.json` (Blob download) — canonical
  `LevelDefinition` JSON.

Both disabled while the level has errors. Tradeoff: the developer pastes / drops
the file and commits it to Git like any other level — the simplest reliable
path, no new infra, and the campaign stays a reviewed TypeScript array.
Output is deterministic: the same logical level always serialises identically
(fixed field order, row-major cells, sorted legend keys, no timestamps).

---

## 9. Levels 1–10 round-trip

`studio/__tests__/roundTrip.test.ts`, per level:

- `toLevelDefinition(fromLevelDefinition(def))` →
  `createGame(back)` **deep-equals** `createGame(def)`
- `back.pixelArt`, `back.tunnels`, `back.reveal`, `back.legend`,
  `difficulty`, `holdingCapacity`, `themeId` all **equal** the originals
  (Levels 1–10 re-serialise byte-for-byte — no legend, identical rows)
- idempotent (a second round-trip is a fixed point)
- the original solver winning witness replays move-for-move on the
  round-tripped level and still wins; witness length + loss probability
  unchanged.

Result: **all 10 pass** — no semantic edit, no engine behaviour change.

---

## 10. Tests

**8 new suites / 71 new tests → 246 tests / 25 suites total** (was 175 / 17).
No existing M2B assertion weakened; `metrics.test` / `session.test` /
`levelDefinitions.test` untouched (they import the solver through the unchanged
shim path).

| suite | covers |
|---|---|
| `engine/__tests__/holding-manual.test.ts` | REGRESSION A — manual Holding only |
| `engine/__tests__/encounter-targeting.test.ts` | REGRESSION B — physical encounter targeting |
| `engine/__tests__/solver-module.test.ts` | solver promotion (shim identity) + cooperative cancellation |
| `studio/__tests__/model.test.ts` | blank/load, paint/erase/clear/resize, tunnel add/update/remove/move/duplicate, undo/redo |
| `studio/__tests__/serialize.test.ts` | board→pixelArt, non-default-colour legend synthesis, deterministic TS/JSON |
| `studio/__tests__/validate.test.ts` | every error + warning rule, Levels 1–10 zero errors, dense 15×15/90px accepted |
| `studio/__tests__/roundTrip.test.ts` | Levels 1–10 load→serialize→`createGame` deep-equal + witness replay + idempotence |
| `studio/__tests__/analyze.test.ts` | solvable / unsolvable / cancelled / node-cap-error paths |

---

## 11. Regression-hardening status

### A — Manual Holding only: **already correct, now pinned**

The only held-charge relaunch path is an explicit `{ kind: 'holding', id }`
action (`resolveHolding.ts` → `resolveAction`). New tests prove a held charge
does not auto-launch when a target becomes exposed, survives unrelated tunnel
launches (Holding stays reference-identical), survives epoch settlement and
several independent concurrent epochs, that `simulateEpoch` has no channel to
Holding, and that the solver only wins Holding-dependent levels via explicit
holding moves. **No engine change.**

### B — Physical encounter targeting: **already correct, now pinned**

The engine (`simulateEpoch` / `pickEncounter`) owns target selection; the
presentation script (`buildLaunchScript`) copies engine encounters verbatim and
`EnergyShot` fires from `flightPosition(pass, layout, shot.fireAt)` — the
charge's real computed orbit position. New tests prove, on the **concurrent**
path: projectile target ids == engine encounter target ids; shot origin == the
charge orbit position at the encounter along the canonical direction; a
late-exposed target is acquired by another charge; two charges never consume the
same pixel; no capacity spent on a vanished target; identical action sequence →
identical engine state and flight script. **No engine change.**

---

## 12. Verification

- `npx jest` — **246 passed / 25 suites** (was 175 / 17; +71 / +8)
- `npx tsc --noEmit` (strict, `noUncheckedIndexedAccess`, `noImplicitOverride`) — **clean**
- `npx eslint .` — **clean**
- `npx expo-doctor` — **21 / 21** (expo + expo-router patch-bumped to the SDK-57
  expected versions as part of this milestone)
- `npx expo export -p web` — **succeeds** (`dist/m3a-web`) — Studio route + editor
  bundled (dev-gated at runtime)
- `npx expo export -p ios` — **succeeds** (`dist/m3a-ios`)
- `npx expo export -p android` — **succeeds** (`dist/m3a-android`)
- **Studio inaccessible outside dev-web** — grepping the exported bundles for
  Studio marker strings (`ORBITIDE Level Studio`, `Canonical export`,
  `Tunnel queues`, `useLevelStudio`, `PLAYTEST ·`) and for `canvaskit`:
  - iOS Hermes bytecode: **0 Studio hits, 0 canvaskit refs**
  - Android Hermes bytecode: **0 Studio hits, 0 canvaskit refs**
  - web JS: Studio present (expected — redirect-gated at runtime by
    `__DEV__ && Platform.OS === 'web'`)

Not run: interactive browser session / on-device play (standing project
caveat — no simulator/device in this environment).

---

## 13. Performance concerns

- The solver is synchronous and unbounded in theory; the Studio caps it at
  200 000 nodes and runs it only on an explicit button, off the UI tick, with
  cancellation. A very dense / very open board can still take seconds — that is
  expected and surfaced as a busy state.
- `validateStudioLevel` runs on every edit; it is cheap (one `createGame`, a
  couple of board scans) — but it does build a full `GameState`. Fine for
  authoring-scale boards (≤ ~225 cells); revisit if batch validation lands in
  M3C.
- The web playtest pulls CanvasKit (~2 MB wasm) from a CDN on first Play.

---

## 14. Known risks

- **Skia on web**: CanvasKit loads from jsDelivr; offline / CSP-restricted dev
  environments see the "could not load CanvasKit" state instead of the board
  (the editor stays fully usable). A local `npx setup-skia-web` + `public/` copy
  is the fallback (documented, not wired).
- The web *production* export still bundles `studioEntry.web.tsx` /
  `LevelStudioScreen` (dead code, redirect-gated at runtime). Native (iOS /
  Android) builds resolve the `null` stub and bundle **none** of the Studio —
  verified by grepping the exported bundles (see §12).
- `react-native-web` is pinned `^0.21.2` by `expo install`; a future
  `expo-doctor` may prefer a tilde range.
- Studio component render paths are not in the jest harness (node env,
  `roots: src/game`) — consistent with M2A/M2B; the pure model/validation/
  serialize/solver layers that carry the logic are fully covered.

---

## 15. Deferred to M3B / M3C

**M3B**: full solver analytics, difficulty scoring, winning/failure path
visualisation, Holding-pressure + concurrency metrics over a run, first-move
quality, batch solver.

**M3C**: Frozen / Shielded / Armor / Locked / Hidden / Bomb / Wild / Linked
pixels, `revealNodes` / `revealLines` / `accentNodes` editing, world/set
grouping, level duplication / variation tooling, thumbnails, batch validation,
mass campaign authoring.

The schema (`ModifierInstance` already on `Pixel`), the `StudioLevel` superset,
the issue-list validation shape and the `analyze` wrapper are all built to
extend without rework.

---

## 16. Commit hashes

- `1a6ac50` — M2B regression hardening (manual Holding + encounter targeting)
- `a1566ff` — M3A Level Studio foundation (editor, validation, serialization)
- `<amended>` — M3A solver promotion + Studio Play + Solve integration
  (this commit also carries the native-isolation fix and this report)

**Do not merge. Do not push.**
