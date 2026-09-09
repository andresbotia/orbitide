# M3C — Production Content-Authoring Tools

Branch `milestone/1-core-prototype`. Builds on M3A / M3B. **Not merged, not pushed.**

M3C turns Level Studio from a normal-level editor into a production
content-authoring tool for a real ORBITIDE campaign: special-pixel metadata,
discovery reveals, world/set grouping, a campaign manifest, level
duplication/variation, thumbnails, a campaign-scale level browser, batch
validation, artwork transforms, and deterministic import/export.

It does **not** change core gameplay rules, add a backend / ads / IAP / economy,
or start M4 campaign tuning.

Commits: `d45edb8` (M3C.1) · `48752ff` (M3C.2) · `<this>` (M3C.3).

---

## 0. Authored metadata vs implemented gameplay mechanic

This is the single most important distinction in M3C.

| system | AUTHORED here (metadata + visual/config state) | IMPLEMENTED gameplay mechanic |
|---|---|---|
| Frozen / Shielded / Armored | kind + `layers` (crack-stage / shield / plate count) | **none** — no cracking / shielding / plating rule exists |
| Locked | kind + optional lock `group` | **none** — no key / unlock rule |
| Hidden | kind + `layers` (concealment stages) | **none** — no reveal-condition rule |
| Bomb | kind + inert placeholder `timer` | **none** — no countdown / detonation rule |
| Wild | kind only | **none** — no colour-matching rule |
| Linked | kind + link `group` (≥ 2 members) | **none** — no group-clear propagation rule |
| Discovery reveal | full `name / nodes / lines / accentNodes / collectionId` | rendered by `revealGeometry.ts` (already shipped in M2A) |
| World / set grouping | `CampaignManifest` worlds + order | consumed by a future world-select screen |
| Level provenance | `duplicate` / `variation` source tag | Studio-only — never in a `LevelDefinition` |

The engine attaches authored modifiers to pixels (so the existing
`SpecialPixelLayer` renders them) but **no gameplay rule reads
`pixel.modifier`** — proven by `engine/__tests__/modifier-attach.test.ts`. The
solver treats a special pixel exactly like a normal one.

When a real rule is decided it consumes the same fields — no re-authoring.
Portal / Rotating Layer / Color Converter / Gravity Well are **not** added:
they are not in `ModifierKind` and the schema does not cover them cleanly yet.

---

## 1. Modifier schema

### Engine (`engine/types.ts`) — additive

```ts
interface ModifierInstance {
  kind: ModifierKind;            // frozen|shielded|armored|locked|bomb|wild|linked|hidden
  state?: string;               // discrete state label (renderer state machines)
  progress?: number;            // 0..1
  level?: number;               // countable magnitude (layers / plate count / bomb stage)
  seed?: number;                // deterministic decorative seed
  group?: string;               // NEW — lock group / link group authoring id
  linkId?: string; linkedPixelIds?: string[]; linkProgress?: number;  // connection renderer
}

interface LevelDefinition {
  // …unchanged…
  modifiers?: Record<`${number},${number}`, ModifierInstance>;   // NEW — cell-keyed sidecar
}
```

`modifiers` is a **sidecar keyed by `"x,y"`**, not a change to `pixelArt`. The
picture's identity stays the compact string rows; a modifier layers on by
coordinate. The map is:

- **omitted entirely** when the level has no special pixels — every normal
  level (Levels 1–10 included) serialises byte-for-byte as before;
- **deterministic** — keys in row-major order, defined-key-only instances;
- attached to the matching `Pixel` by `createGame` via `attachModifiers` (pure,
  guarded — a no-op when `modifiers` is absent).

### Studio authoring shape (`studio/types.ts`)

```ts
interface StudioModifier { kind: ModifierKind; config: ModifierConfig; }
interface ModifierConfig {
  layers?: number;   // Frozen crack stages / Shielded strength / Armored plates / Hidden stages
  group?: string;    // Locked lock-group / Linked link-group
  timer?: number;    // Bomb — inert placeholder, no rule
  seed?: number;     // carried from a source level
}
```

`studio/modifiers.ts` maps `StudioModifier` ↔ `ModifierInstance` losslessly
(`layers → level`, `timer → level` for bomb, `group → group` (+ `linkId` for
linked)). Per-kind bounds (`MODIFIER_SPECS`):

| kind | field | bounds | default | rule status |
|---|---|---|---|---|
| frozen | `layers` (crack stages) | 1–4 | 1 | deferred |
| shielded | `layers` (shield layers) | 1–3 | 1 | deferred |
| armored | `layers` (plate count) | 1–4 | 2 | deferred (matches renderer clamp) |
| locked | `group` (optional) | — | — | deferred |
| hidden | `layers` (concealment stages) | 1–3 | 1 | deferred (placeholder) |
| bomb | `timer` (optional) | — | — | **placeholder — inert** |
| wild | — | — | — | deferred (placeholder) |
| linked | `group` (required) | — | — | deferred |

Where a gameplay rule is undecided the **smallest neutral representation** is
used: `wild` has no config; `bomb`'s timer is inert authoring metadata.

---

## 2. Modifier validation (`studio/validateModifiers.ts`)

Centralised — the UI renders issues, never re-derives a rule.

**Errors (block export):** unknown kind · modifier on an empty cell · modifier
off-grid · `layers` out of range for the kind · Linked with no group · a link
group with < 2 members · malformed map key.

**Warnings:** bomb has a timer (inert) · a placeholder kind (no rule yet) ·
config field the kind does not use.

Modifiers on empty / off-grid cells are also **dropped on export** (`toModifierMap`)
so the emitted `LevelDefinition` is always clean; the error still blocks the
Studio export button.

---

## 3. Reveal authoring (`studio/reveal.ts`)

Edits the ONE existing `LevelReveal` schema — no second model. Pure ops:
`ensureReveal` / `clearReveal`, `setRevealName`, `setRevealCollectionId`,
`addRevealNode` / `moveRevealNode` / `deleteRevealNode` / `reorderRevealNode`,
`addRevealLine` / `toggleRevealLine` / `deleteRevealLine`, `toggleAccentNode`.

Deleting or reordering a node **re-indexes every line and accent reference** and
drops lines that touch the removed node. An empty scaffold (no nodes, no lines)
**never serialises** — the deterministic silhouette fallback is used instead.

**Validation (`studio/validateReveal.ts`)** — errors: a line to a missing node ·
a self-line · a duplicate line · an accent pointing at a missing node.
Warnings: no name · < 2 nodes · duplicate node position · nodes with no lines ·
a node well outside the grid.

Studio UI: a REVEAL canvas mode (tap the board to drop a node), a graph editor
in the rail, and a live overlay of nodes + lines on the canvas.

---

## 4. Campaign manifest (`studio/campaign/`)

```ts
interface CampaignManifest {
  campaignVersion: number;
  worlds: CampaignWorld[];
  orderedLevelIds: number[];        // explicit global play order
}
interface CampaignWorld {
  id: string; title: string; order: number;
  levelIds: number[];               // play order within the world
  themeId?: string;
  display?: { subtitle?: string; accent?: string };
}
```

- **Not** a `LevelDefinition`; carries **no solver output**; the engine never
  reads it.
- Every op returns a **normalised** manifest — worlds sorted by `order` and
  re-indexed `0..n-1`, each level id in **at most one** world (first wins),
  `orderedLevelIds` recomputed (`worlds in order` then unassigned).
- Deterministic serialisation (`serializeManifest{JSON,TS}`) — logically equal
  manifests produce identical bytes regardless of array order; no timestamps.
- The shipped `src/game/levels/campaign.ts` groups Levels 1–10 as one
  "First Light" set.
- **Scale:** flat id lists, no per-level duplication. A 5 000-level campaign is
  ~5 000 integers per world list — trivial to hold, diff and serialise.

### World / set behaviour

`createManifest`, `addWorld`, `renameWorld`, `setWorldTheme`, `reorderWorld`,
`removeWorld` (unassigns its levels), `assignLevel` (moves between worlds,
optional index), `unassignLevel`, `moveLevelBetweenWorlds` (= `assignLevel`),
`reorderLevelInWorld`, `removeLevel`. Early campaign uses 10-level sets but
nothing hard-codes 10.

### Manifest validation (`studio/campaign/validate.ts`)

Errors: duplicate world id · duplicate level across worlds · a world referencing
a non-existent level · `orderedLevelIds` duplicate / unknown id · bad version.
Warnings: empty world · a known level assigned to no world · version ahead of
the Studio · stale `orderedLevelIds` (recomputed on save).

---

## 5. Duplication / variation (`studio/duplicate.ts`)

- `duplicateLevel(level, { id, title?, preserveArtwork?, preserveTunnels?,
  preserveReveal?, preserveModifiers? })` — deep copy, new id, `source:
  { kind: 'duplicate', sourceLevelId }`.
- `createVariation(level, { id, title?, note? })` — keeps artwork + theme +
  reveal, `source: { kind: 'variation', sourceLevelId, note? }`; the author is
  expected to change queues / capacities next.

`source` is **Studio-only** — `toLevelDefinition` builds a fresh object and never
writes it. Provenance is authoring information, not a gameplay field.

---

## 6. Thumbnails (`studio/thumbnail.ts`)

- `thumbnailModel(level)` — structured `{ width, height, cells: {x,y,color,marker?}[], colors }`.
- `thumbnailSVG(level, { cell?, markers?, background? })` — a flat grid of
  coloured squares. Deterministic bytes; no production 3D materials.
- `thumbnailDataUri(level)` — `data:image/svg+xml;charset=utf-8,…`
  (percent-encoded, not base64, so it stays diff-friendly).

Cheap enough to render a whole campaign at once. The browser caches by level
identity (React `useMemo`). No image service, ever.

---

## 7. Level browser (`studio/browser.ts`)

`buildBrowserRows(defs, manifest?, analyses?)` → one `BrowserRow` per level:
id, title, theme, authored difficulty, world + index, pixel count, special
count, has-reveal, Studio validation status + error/warning counts, and —
**only when the caller supplies an analysis slice** — suggested difficulty,
solvability, difficulty mismatch.

**No solver runs to build the browser.** Analysis is lazy / on-demand: the
`ANALYSIS` and `BATCH` tabs produce slices that the browser merges. Pure
`filterRows` (search / difficulty / world / status) and `sortRows`
(id / title / difficulty / world / pixels / warnings / status). Designed for
hundreds–thousands of rows; the UI renders lightweight rows, not editors.

---

## 8. Batch validation (`studio/batchValidate.ts`)

`batchValidate({ defs, manifest?, analyses?, scopeLevelIds? })` composes the ONE
level validator and the ONE manifest validator across the set and adds only the
whole-set checks:

- duplicate level ids across `defs`;
- manifest cross-references (missing levels, unassigned levels, dup assignment);
- invalid levels / reveals / modifiers / tunnels / unrepresented colours
  (from `validateStudioLevel`);
- orphan link groups (from `validateStudioLevel`);
- **unsolvable levels** and **difficulty mismatches** — only when an `analyses`
  slice is supplied (it never runs the solver itself).

`scopeLevelIds` restricts the run (validate all / selected world / selected
levels). Results are deterministic (levels sorted by id, issues in rule order).

---

## 9. Transforms (`studio/transforms.ts`)

All pure. Modifiers always move with their pixel (same `"x,y"` remap).

| transform | reveal geometry | notes |
|---|---|---|
| `mirrorHorizontal` / `mirrorVertical` | mirrored too (rigid) | involutions |
| `rotate90` | rotated too (rigid) | **square grids only** — non-square is a no-op + warning |
| `replaceColor(from, to, { tunnels? })` | untouched | remaps board + (default) matching charges |
| `copyArtwork` / `pasteArtwork` | target reveal kept | paste adopts the clip's grid size |
| `copyTunnelQueue` / `pasteTunnelQueue` | n/a | |
| `renumber(levels, startId)` / `withId` | n/a | sequential ids in list order |

When a transform cannot safely carry the reveal it returns
`{ level, revealWarning }` and **leaves the reveal untouched** for the author to
reset — mirror/rotate are rigid transforms so this only fires for a non-square
rotate today.

---

## 10. Import / export (`studio/io.ts`)

**Export** (deterministic, canonical, timestamp-free):
- `exportLevelsJSON(defs)` / `exportLevelsTS(defs)` — a selected set / world.
- `exportCampaignBundle(manifest, defs)` → `{ studioVersion, campaignVersion,
  manifest, levels }` JSON.
- single-level export stays on the M3A action bar (`Copy as TS` / `Download JSON`).

**Import** — `importStudioJSON(text)`:
- **JSON only.** Executable TS is never imported / evaluated.
- accepts a single level object, an array of levels, or a campaign bundle;
- every level must pass `createGame` **and** `validateStudioLevel` (no hard
  errors) before it is accepted; malformed entries are reported, not thrown;
- a bundle whose `studioVersion` / `campaignVersion` is newer than this Studio
  imports with a **warning**, not a rejection.

---

## 11. Schema versioning

```ts
STUDIO_SCHEMA_VERSION   = 1   // Studio export shapes (bundle, manifest wrapper)
CAMPAIGN_SCHEMA_VERSION = 1   // CampaignManifest.campaignVersion
```

**Compatibility policy:**
- The gameplay `LevelDefinition` is **not** versioned. It changes only
  additively (a new optional field), and old definitions keep loading forever.
  `modifiers?` is such an addition.
- `CAMPAIGN_SCHEMA_VERSION` bumps when the manifest shape changes
  incompatibly. A manifest with a higher `campaignVersion` loads with a warning.
- `STUDIO_SCHEMA_VERSION` bumps when the export-bundle wrapper changes. Same
  warn-don't-reject rule on import.
- Studio-only fields (`StudioLevel.source`, `StudioModifier` shape) are never
  persisted into production data, so they carry no compatibility burden.

---

## 12. Levels 1–10 compatibility

`studio/__tests__/roundTrip.test.ts` (unchanged from M3A) plus the new
`reveal.test.ts` / `modifiers.test.ts` / `campaign.test.ts` assert, per level:

- no `modifiers` field is emitted; `createGame` pixels carry no modifier;
- `toLevelDefinition(fromLevelDefinition(def))` still `createGame`-deep-equals
  and re-serialises **byte-for-byte** (`serializeToJSON` identical);
- `reveal` / `legend` / `tunnels` / `difficulty` unchanged;
- the shipped `CAMPAIGN_MANIFEST` validates clean against Levels 1–10;
- solver witness replay unchanged (M3A test still green).

No normal level definition was rewritten.

---

## 13. Scale / performance

- **Browser / manifest** designed for 500 levels comfortably and 5 000 without a
  structural rewrite: flat integer id lists, lightweight rows, no editor
  component per level, thumbnails cached by identity.
- **The solver never runs while browsing.** Analysis is on-demand
  (`ANALYSIS` single-level, `BATCH` explicit run) and merged into the browser as
  a slice.
- Thumbnail generation is O(pixels) string building — microseconds per level.
- `batchValidate` without an `analyses` slice is pure validation
  (`createGame` + board scans per level) — fast for the whole campaign.

---

## 14. Deferred gameplay mechanics

Everything in the right-hand column of §0: the actual behaviour of Frozen /
Shielded / Armored / Locked / Hidden / Bomb / Wild / Linked pixels; solver /
difficulty awareness of modifiers; Portal / Rotating Layer / Color Converter /
Gravity Well; a world-select screen; a collection system keyed on
`reveal.collectionId`; any persistence / backend for authored levels (the
developer still commits exported data to Git).

---

## 15. Tests

New suites (all pure, in the ts-jest harness):

| suite | covers |
|---|---|
| `engine/__tests__/modifier-attach.test.ts` | attach-by-cell, no rule change, Levels 1–10 unaffected |
| `studio/__tests__/modifiers.test.ts` | apply/remove/config, link groups, engine↔studio round-trip per kind, validation |
| `studio/__tests__/reveal.test.ts` | authoring ops, reference integrity on delete/reorder, validation, byte-for-byte L1–10 |
| `studio/__tests__/campaign.test.ts` | manifest ops + normalisation + validation + deterministic serialisation; shipped manifest valid |
| `studio/__tests__/thumbnail.test.ts` | deterministic SVG / data URI, markers, model |
| `studio/__tests__/duplicateBrowser.test.ts` | duplication deep-copy + provenance strip, browser rows / filter / sort |
| `studio/__tests__/transforms.test.ts` | mirror / rotate / replace-colour / clipboard / renumber, reveal safety |
| `studio/__tests__/batchIo.test.ts` | batch validation findings + scope, canonical export, import validation + version-ahead |

No existing assertion was weakened.

---

## 16. Verification

See the M3C section of the milestone report for the full run (jest / tsc /
eslint / expo-doctor / web+ios+android export). Studio remains **dev-web-only** —
`app/studio.tsx` still redirects outside `__DEV__ && Platform.OS === 'web'` and
native bundles resolve the `null` `studioEntry` stub.

**Do not merge. Do not push.**
