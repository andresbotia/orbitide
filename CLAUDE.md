# ORBITIDE development rules

## Product priorities

1. Gameplay clarity before feature count.
2. Input must remain one-thumb and tap-first.
3. Active gameplay must never be interrupted by ads.
4. The game must remain deterministic and testable.
5. Visual polish, haptics, responsiveness, and animation are part of gameplay, not optional decoration.
6. Campaign levels are hand-authored/curated. Do not replace the campaign with random procedural levels.
7. Puzzle design comes before decorative silhouette/theme choices.
8. ORBITIDE may use successful mobile puzzle games as structural references, but do not copy distinctive artwork, assets, mascots, exact UI geometry, or trade dress.

## Engineering rules

- TypeScript strict mode.
- Keep gameplay rules independent from rendering.
- Do not store core game state inside animation components.
- Level definitions must be serializable data.
- The same level definition must always recreate the same puzzle.
- Future solver/validator tooling must operate on the pure game-state layer without React Native.
- Prefer small focused modules over large screen files.
- Avoid backend/account work until a milestone explicitly requests it.
- Do not add ads, IAP, analytics, authentication, cloud sync, daily rewards, currencies, or social systems during Milestone 1.

## Motion + haptics rules

- Resolve game truth before starting the animation that represents it.
- Rapid taps must never mutate the same orb twice.
- Centralize haptics behind a service/module rather than scattering direct calls.
- Haptic events need semantic names, not arbitrary strengths at call sites.
- Provide a global haptics-off path.
- Motion/haptics must communicate state changes and remain fast enough to preserve "one more level" flow.
- Respect reduced-motion settings where practical.

## Campaign/content rules

- Every shipped level must have an explicit difficulty: Easy, Medium, Hard, or Super Hard.
- Levels are grouped into 10-level themed sets and larger 50-level worlds.
- Use intentional silhouette/layout families rather than random blob layouts.
- Solver output validates designer-authored levels; it does not automatically decide what ships.
- Difficulty labels and reward metadata are part of the level definition.

## Launch architecture direction

When their milestone arrives, the intended services are:
- Cloudflare Workers + D1 for durable cloud state and cross-device restoration
- Sign in with Apple for account linking
- RevenueCat for Remove Ads and coin IAP
- Google AdMob for interstitial + rewarded advertising

Cross-device restoration is required before iOS 1.0 launch.

## Git rules

- Work on a milestone branch.
- Make focused commits.
- Do not merge to `main` unless explicitly requested.
- Finish each milestone with a concise implementation report, changed files, verification commands, and known limitations.

## Competitive UX product rules
- Never show a forced interstitial immediately after a failed level.
- Rewarded ads are voluntary exchanges for clearly stated value.
- Every shipped campaign level must be solvable with standard rules and zero boosters. Boosters make levels easier, never possible.
- Hard/Super Hard difficulty comes from reasoning and sequencing pressure, not unknowable randomness.
- Active gameplay state must be resumable after interruption. Cross-device restoration is required before 1.0.
- Color must not be the only gameplay signal; preserve an accessibility path.
- Motion/haptic polish must stay within a real-device thermal/performance budget.
