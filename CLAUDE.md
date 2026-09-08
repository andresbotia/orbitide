# ORBITIDE development rules

## Product priorities

1. Gameplay clarity before feature count.
2. Input must remain one-thumb and tap-first.
3. Active gameplay must never be interrupted by ads.
4. The game must remain deterministic and testable.
5. Visual polish, haptics, responsiveness, and animation are part of the gameplay, not optional decoration.

## Engineering rules

- TypeScript strict mode.
- Keep gameplay rules independent from rendering.
- Do not store core game state inside animation components.
- Level definitions must be serializable data.
- The same level number/seed must always produce the same level.
- A future solver/generator must be able to operate on the pure game-state layer without React Native.
- Prefer small focused modules over large screen files.
- Avoid backend/account work until a milestone explicitly requests it.
- Do not add ads, IAP, analytics, authentication, cloud sync, daily rewards, currencies, or social systems during Milestone 1.

## Git rules

- Work on a milestone branch.
- Make focused commits.
- Do not merge to `main` unless explicitly requested.
- Finish each milestone with a concise implementation report, changed files, verification commands, and known limitations.
