# M4C - Campaign Expansion to Level 100 and Linked

Branch `milestone/1-core-prototype`. M4C expands Pixel Arcadia from 60 to 100
production levels and adds Linked as the third production modifier. It does not
add backend, economy, ads, IAP, boosters, or a second gameplay model. The work
remains local: no merge and no push.

Implementation commits:

- `3795499` - M4C.1 Linked engine, solver, trace, presentation, tutorial, and Studio support
- `3cb3c7f` - M4C.2 World 7, Skybound (L61-70)
- `e575f22` - M4C.3 World 8, Tidal Depths (L71-80)
- `0aa99aa` - M4C.4 World 9, Arcane Relics (L81-90)
- `b2116c9` - M4C.5 World 10, Starforge (L91-100)
- final M4C.6 campaign-hardening, performance, and documentation commit

## Worlds 7-10

| World | ID | Levels | Theme | Gameplay role |
|---|---|---:|---|---|
| SKYBOUND | `skybound` | 61-70 | aviation, flight, airport silhouettes | Frozen + Shielded mastery and richer queues |
| TIDAL DEPTHS | `tidal-depths` | 71-80 | marine life, vessels, deep-sea artifacts | formal Linked introduction and pair sequencing |
| ARCANE RELICS | `arcane-relics` | 81-90 | enchanted objects, runes, fantasy relics | Linked and mixed-modifier mastery |
| STARFORGE | `starforge` | 91-100 | ancient cosmic machinery and celestial artifacts | first Super Hard rollout and mastery landmark |

Every addition has unique authored pixel art, exact per-color capacity, reveal
metadata, one world assignment, and a zero-booster solution in both play modes.
The campaign manifest is deterministic and contains exactly 10 worlds and 100
contiguous, unique level IDs. Finale reveals are authored for L70, L80, L90,
and L100.

## Linked gameplay contract

Linked is relational, not durability:

1. Production groups contain exactly two authored cells. Each cell retains its
   own base color, and partners may use different colors.
2. A matching encounter spends normal capacity and primes that member. It does
   not clear the cell.
3. A primed member remains physically solid for exposure and cannot be selected
   again as progress by the same or a later charge.
4. When the final unprimed member is hit, the resolver clears the complete group
   atomically. Group completion itself costs no additional capacity.
5. Epoch arbitration uses canonical charge/event ordering. Concurrent final
   hits produce one prime and one group clear, with no duplicate clear, duplicate
   spend, or spend against a vanished target.

Runtime hydration derives canonical `linkId`, group membership, and symmetric
`linkedPixelIds` from the authored modifier map. The compact fingerprint records
modifier kind, link-group identity, and primed state. Therefore normal, Frozen
intact/broken, Shielded intact/broken, Linked unprimed/primed, and different link
assignments are distinct cache states. Solver, runtime, trace, replay, and Studio
all use the same resolver; there is no Linked solver approximation.

A partially primed group remains live when any accepted progress-making partner
action exists, including a join action. It is a deadlock only when the remaining
member can never be legally hit and no other progress action exists. Insufficient
partner-color budgets are unsolvable.

## Presentation and tutorial

Linked cells retain cube identity and use a port/connector motif rather than an
ice crack or shield membrane. Unprimed ports show pair identity; priming energizes
the port and tether cue while the cube remains solid. `linkPrime` pulses the pair,
and `linkGroupClear` drives a synchronized discharge/pop for every member. Both
are semantic presentation events with distinct haptic feedback and density-aware
detail; no permanent board-spanning animation is required.

L71 is the only Linked tutorial: **"Linked pixels clear together - activate
both."** It is non-modal, dismisses on the first completed group, and falls back
after four launches. Frozen and Shielded tutorials remain confined to L21 and
L41.

## Modifier and Studio authoring rules

A cell has at most one modifier: normal, Frozen, Shielded, or Linked. Mixed boards
are supported; stacking two modifiers on one coordinate is rejected by the M4C
authoring helper. L100 uses all three modifier types on different coordinates.

Studio can paint Linked cells, assign and inspect group IDs, playtest through the
production engine, solve/analyze, duplicate, and JSON export/import. Validation
rejects invalid group IDs, single-member groups, unsupported group sizes,
duplicate member references, mismatched references, metadata on missing pixels,
and malformed raw relationship metadata. Import canonicalization may add
`linkId`; coordinate-to-group identity is preserved through duplication and
export/import.

## L61-100 production analysis

This is the completed production analyzer run at a 300,000-node cap. All rows
completed and solved. `F/S/L(G)` gives Frozen, Shielded, Linked-pixel, and group
counts. `first` is viable first moves, `active` the maximum concurrent count on
the selected winning witness, `fail` the shortest losing witness (`-` means none),
and `held` explicit held-charge relaunches. Warning abbreviations: `diff`,
`no-fail`, `no-hold`, `trivial`, and `nodes`.

| L | Title | World | px | F/S/L(G) | authored->suggested | score | win | peak | first | active | fail | held | nodes | warnings |
|---:|---|---|---:|---:|---|---:|---:|---:|---:|---:|:---:|---:|---:|---|
| 61 | Paper Glider | Skybound | 45 | 1/1/0(0) | medium->medium | 34 | 8 | 2 | 3 | 1 | - | 2 | 3,218 | no-fail |
| 62 | Sunrise Balloon | Skybound | 50 | 1/1/0(0) | medium->hard | 46 | 11 | 2 | 3 | 1 | 5 | 2 | 39,357 | diff |
| 63 | Cloud Windsock | Skybound | 46 | 1/1/0(0) | medium->medium | 26 | 9 | 2 | 3 | 1 | - | 2 | 12,551 | no-fail |
| 64 | Brass Biplane | Skybound | 45 | 1/1/0(0) | medium->medium | 41 | 10 | 3 | 3 | 1 | - | 4 | 12,385 | no-fail |
| 65 | Coral Parachute | Skybound | 49 | 1/1/0(0) | medium->hard | 46 | 9 | 2 | 3 | 1 | 4 | 2 | 21,891 | diff |
| 66 | Kite Squadron | Skybound | 46 | 1/1/0(0) | medium->medium | 26 | 9 | 2 | 3 | 1 | - | 2 | 10,424 | no-fail |
| 67 | Radar Spire | Skybound | 45 | 1/1/0(0) | medium->hard | 46 | 9 | 3 | 3 | 3 | 4 | 3 | 11,376 | diff |
| 68 | Rescue Helicopter | Skybound | 46 | 1/1/0(0) | medium->medium | 36 | 9 | 2 | 3 | 1 | - | 2 | 26,951 | no-fail |
| 69 | Midnight Jetliner | Skybound | 45 | 1/1/0(0) | hard->medium | 41 | 10 | 2 | 3 | 1 | - | 3 | 27,346 | diff, no-fail |
| 70 | The Skybound Airship | Skybound | 62 | 2/2/0(0) | hard->hard | 46 | 11 | 1 | 3 | 1 | 5 | 2 | 62,541 | nodes |
| 71 | Twin Diving Bell | Tidal Depths | 62 | 0/0/2(1) | easy->easy | 8 | 7 | 0 | 3 | 1 | - | 0 | 1,102 | trivial |
| 72 | Azure Manta | Tidal Depths | 45 | 0/0/2(1) | medium->easy | 8 | 7 | 0 | 3 | 1 | - | 0 | 1,102 | trivial, no-hold, diff, no-fail |
| 73 | Coral Crown | Tidal Depths | 59 | 0/0/2(1) | medium->easy | 8 | 7 | 0 | 3 | 1 | - | 0 | 796 | trivial, no-hold, diff, no-fail |
| 74 | Pocket Submarine | Tidal Depths | 54 | 0/0/2(1) | medium->easy | 8 | 7 | 0 | 3 | 1 | - | 0 | 1,102 | trivial, no-hold, diff, no-fail |
| 75 | Lantern Angler | Tidal Depths | 49 | 0/0/2(1) | medium->easy | 8 | 7 | 0 | 3 | 1 | - | 0 | 1,102 | trivial, no-hold, diff, no-fail |
| 76 | Emerald Sea Turtle | Tidal Depths | 58 | 0/0/2(1) | medium->easy | 8 | 7 | 0 | 3 | 1 | - | 0 | 1,102 | trivial, no-hold, diff, no-fail |
| 77 | Moon Pearl Oyster | Tidal Depths | 54 | 0/0/2(1) | medium->easy | 8 | 7 | 0 | 3 | 1 | - | 0 | 1,102 | trivial, no-hold, diff, no-fail |
| 78 | Crimson Kraken | Tidal Depths | 61 | 0/0/4(2) | medium->easy | 8 | 7 | 0 | 3 | 1 | - | 0 | 1,102 | trivial, no-hold, diff, no-fail |
| 79 | Sunken Admiral Helm | Tidal Depths | 72 | 0/0/4(2) | hard->easy | 8 | 7 | 0 | 3 | 1 | - | 0 | 1,102 | trivial, no-hold, diff, no-fail |
| 80 | The Leviathan Gate | Tidal Depths | 75 | 0/0/6(3) | hard->easy | 8 | 7 | 0 | 3 | 1 | - | 0 | 1,102 | trivial, no-hold, diff, no-fail |
| 81 | Starlit Potion | Arcane Relics | 57 | 0/0/2(1) | medium->easy | 10 | 9 | 0 | 3 | 1 | - | 0 | 4,096 | trivial, no-hold, diff, no-fail |
| 82 | Living Spellbook | Arcane Relics | 68 | 0/0/4(2) | medium->easy | 10 | 9 | 0 | 3 | 1 | - | 0 | 3,411 | trivial, no-hold, diff, no-fail |
| 83 | Moon Mage Hat | Arcane Relics | 51 | 1/0/2(1) | medium->medium | 21 | 9 | 1 | 3 | 1 | - | 1 | 2,740 | trivial, no-fail |
| 84 | Ember Dragon Egg | Arcane Relics | 57 | 0/1/2(1) | medium->medium | 22 | 9 | 1 | 3 | 1 | - | 1 | 5,549 | trivial, no-fail |
| 85 | Runebound Sword | Arcane Relics | 50 | 0/0/4(2) | medium->easy | 8 | 7 | 0 | 3 | 1 | - | 0 | 2,841 | no-hold, diff, no-fail |
| 86 | Verdant Crystal Staff | Arcane Relics | 50 | 1/1/2(1) | medium->medium | 29 | 12 | 2 | 3 | 1 | - | 2 | 48,046 | no-fail |
| 87 | Phoenix Sigil | Arcane Relics | 52 | 0/1/4(2) | hard->medium | 22 | 9 | 1 | 3 | 1 | - | 1 | 5,549 | trivial, diff, no-fail |
| 88 | Gilded Griffin | Arcane Relics | 68 | 2/0/4(2) | hard->medium | 20 | 8 | 1 | 3 | 1 | - | 1 | 1,604 | trivial, diff, no-fail |
| 89 | The Arcane Portal | Arcane Relics | 80 | 1/1/4(2) | hard->medium | 22 | 9 | 1 | 3 | 1 | - | 1 | 5,549 | trivial, diff, no-fail |
| 90 | Throne of Relics | Arcane Relics | 80 | 2/2/4(2) | hard->medium | 27 | 11 | 2 | 3 | 1 | - | 2 | 6,096 | diff, no-fail |
| 91 | Signal Satellite | Starforge | 56 | 0/1/2(1) | medium->medium | 22 | 9 | 1 | 3 | 1 | - | 1 | 5,549 | trivial, no-fail |
| 92 | Aurora Rocket | Starforge | 56 | 1/0/2(1) | hard->medium | 21 | 9 | 1 | 3 | 1 | - | 1 | 3,072 | trivial, diff, no-fail |
| 93 | Ringed World | Starforge | 66 | 0/2/2(1) | hard->medium | 23 | 11 | 1 | 3 | 1 | - | 1 | 11,289 | trivial, diff, no-fail |
| 94 | Lunar Rover | Starforge | 68 | 1/0/4(2) | hard->medium | 21 | 9 | 1 | 3 | 1 | - | 1 | 2,740 | trivial, diff, no-fail |
| 95 | Nebula Turbine | Starforge | 73 | 0/1/4(2) | hard->medium | 22 | 10 | 1 | 3 | 1 | - | 1 | 5,028 | trivial, diff, no-fail |
| 96 | Celestial Compass | Starforge | 55 | 1/1/2(1) | hard->medium | 21 | 9 | 1 | 3 | 1 | - | 1 | 2,740 | trivial, diff, no-fail |
| 97 | Orbital Citadel | Starforge | 72 | 1/1/4(2) | hard->medium | 22 | 10 | 1 | 3 | 1 | - | 1 | 5,028 | trivial, diff, no-fail |
| 98 | Helios Engine | Starforge | 78 | 2/2/4(2) | super-hard->medium | 28 | 11 | 2 | 3 | 1 | - | 2 | 27,002 | diff, no-fail |
| 99 | Galactic Core | Starforge | 76 | 1/1/4(2) | super-hard->medium | 22 | 9 | 1 | 3 | 1 | - | 1 | 6,688 | trivial, diff, no-fail |
| 100 | The Starforge | Starforge | 90 | 2/2/6(3) | super-hard->medium | 27 | 10 | 2 | 3 | 1 | - | 2 | 45,741 | diff, no-fail |

The L61-100 run took **476.3 s** (the analyzer body: 473.2 s). L100 was
slowest at 76.0 s, followed by L98 at 63.5 s and L70 at 51.2 s. The top ten
state-space hotspots by explored nodes were L70 (62,541), L86 (48,046), L100
(45,741), L62 (39,357), L69 (27,346), L98 (27,002), L68 (26,951), L65
(21,891), L63 (12,551), and L64 (12,385). Only L70 crossed the configured
60,000-node warning threshold. All searches completed below the production cap.

No L61-100 level received `CONCURRENCY_TRIVIALIZES_LEVEL`. The optimal witness
uses three active charges on L67 and one elsewhere. This does not prove that
joining lacks tactical value; it shows that the current shortest/calmest witness
selection usually prefers an equivalent sequential ordering.

## Difficulty curve and Super Hard assessment

| World | Authored curve | Campaign role |
|---|---|---|
| W1 First Light | E x8, M, H | onboarding |
| W2 Wild Garden | E x3, M x6, H | easy-to-medium expansion |
| W3 Deep Frost | E x2, M x6, H x2 | Frozen introduction and progression |
| W4 Curio Cabinet | M x8, H x2 | core mastery |
| W5 Prism Works | M x8, H x2 | Shielded introduction |
| W6 Frostglass Forge | M x5, H x5 | Frozen/Shielded mastery |
| W7 Skybound | M x8, H x2 | aviation mastery |
| W8 Tidal Depths | E, M x7, H x2 | Linked introduction |
| W9 Arcane Relics | M x6, H x4 | Linked/mixed mastery |
| W10 Starforge | M, H x6, SH x3 | first major mastery landmark |

L98-100 are authored Super Hard because they are the densest premium machinery
silhouettes, combine all learned relationship/durability concepts across multiple
board locations, and culminate in the largest board and three Linked groups.
However, the analyzer suggests **Medium**, not Super Hard. Their optimal lines
reach only peak Holding 2/1/2, have no fail witness, and use one active charge.
The milestone does not fake scores or change global weights to erase this result.
The labels preserve the requested campaign landmark, while the mismatch remains
a known balancing risk requiring future queue/exposure tuning and playtesting.

L100 is a 90-pixel monumental forge silhouette with 8 readable gameplay colors,
two Frozen cells, two Shielded cells, and three different Linked pairs with no
stacking. It has three viable openings, a deterministic zero-booster solution,
and two held relaunches on the analyzed witness. It introduces no new mechanic.

## Validation and risk record

The final gate covers all 100 definitions, `validateManifest`, Studio
`batchValidate`, sequential-compat and concurrent solves, winning witness replay,
full Jest, TypeScript, ESLint, Expo Doctor, and static Expo exports for web, iOS,
and Android.

| Gate | Result |
|---|---|
| L61-100 production analysis | 40/40 complete and solvable; 476.3 s |
| L1-100 production analysis | 100/100 complete and solvable; 744.4 s |
| L61-100 dual-mode world check | 75/75 tests passed; 409.9 s |
| Focused Linked/Studio checks | 38/38 tests passed |
| Affected round-trip/M4B/attachment regressions | 110/110 tests passed |
| Full Jest | 51 suites passed, 1 report-only suite skipped; 1,161 passed, 2 report-only tests skipped; 3,807.9 s |
| TypeScript | `tsc --noEmit` passed |
| ESLint | `eslint .` passed |
| Expo Doctor | 21/21 checks passed |
| Expo static export | web, iOS, and Android passed via `--platform all` |

The final aggregate Jest process completed just as cancellation was requested;
it is recorded here but should not be treated as an acceptable inner-loop gate.
It required `NODE_OPTIONS=--max-old-space-size=8192` and 63.5 minutes. An earlier
default-heap run exposed an obsolete 600-second audit timeout and then exhausted
Node's roughly 4 GB default heap after 1,506.7 seconds. The audit timeout now
allows slower 100-level CI hosts without changing production node caps. Future
milestones should rely on sharded/isolated production audits and address retained
solver cache memory before requiring aggregate Jest again.

Known risks and remaining warnings:

1. The advisory difficulty formula has no Linked-topology feature. Easy-suggested
   Linked boards can still require relational reasoning that its numerical score
   does not represent.
2. Exact-budget, highly vented W8-W10 silhouettes produce many calm openings and
   no proven fail paths. This is most material on authored Hard/Super Hard levels.
3. W10's chosen witnesses do not demonstrate the intended 3-5-charge concurrency
   opportunity; subjective play may differ, but this needs future tuning rather
   than a stronger claim.
4. Linked state increases the state space, but this run cannot isolate its cost
   from board density, queue order, and mixed modifiers. L70, which has no Linked
   cells, is the only node-warning level, so no Linked-specific explosion is
   evident.
5. Connector readability, haptic distinction, animation timing, and late-world
   difficulty still require physical-device and human playtest validation. No
   device testing is claimed.
6. Aggregate Jest is no longer operationally cheap: the passing M4C run took
   3,807.9 seconds and needed an 8 GB heap. Test sharding, cache lifecycle, and
   separate production-audit CI jobs are M4D technical debt.

Deferred M4D work should focus on measured queue/exposure rebalancing for
L79-100, a topology-aware advisory difficulty feature, representative losing
witnesses for late finales, device accessibility/performance QA, and content
polish informed by playtest data. These are not reasons to weaken deterministic
correctness, production node caps, or the shared runtime/solver model.
