/**
 * M2B active-orbit concurrency constants. Every value here is a gameplay
 * TUNABLE — they are collected in one module so a designer can find them.
 *
 * The unit for all logical-time values is one **orbit lap** (a full trip around
 * the rail). 1 lap == `FEEL.ORBIT_DURATION` ms is a presentation fact only; the
 * engine never reads wall-clock time.
 */

/** Default concurrent-pass capacity. Call sites should read `GameState.activeCapacity`. */
export const DEFAULT_ACTIVE_CAPACITY = 5;

/** Back-compat alias of {@link DEFAULT_ACTIVE_CAPACITY}. Prefer `state.activeCapacity`. */
export const MAX_ACTIVE_CHARGES = DEFAULT_ACTIVE_CAPACITY;

/**
 * Logical laps between the insertion points of two consecutive launches in the
 * same epoch. Fixed on purpose: only launch **order** and **count** affect the
 * outcome, never how fast the player taps.
 *
 * ## Why this is exactly one lap — FIRST LAUNCHED, FIRST SERVED
 *
 * One lap gives each launch its own, non-overlapping window of logical time:
 * launch `i` owns `[i, i+1]` and has flown its whole lap before launch `i+1`
 * acts, so **every event of launch `i` strictly precedes every event of launch
 * `i+1`**. The engine therefore resolves each launch exactly once, when it
 * launches, against the board the earlier ones left (`resolveEpochLaunch`), and
 * never re-simulates an earlier one. Joining the open epoch and launching after
 * the board settles resolve identically; the join only adds epoch bookkeeping.
 *
 * That property is the engine half of the product rule:
 *
 *   A later Pal may participate in future gameplay, but it may never rewrite
 *   the logical history of an earlier Pal.
 *
 * It is what makes observable history safe. A Pal's encounters are fully
 * resolved when it launches and can never change afterwards, so whatever the
 * player has already been shown stays true no matter when — or whether — they
 * tap again. Presentation is not consulted and supplies no commit data, so the
 * engine stays pure and the outcome stays independent of tap cadence.
 *
 * A smaller spacing (this was 0.18) interleaves the laps, which lets a join
 * insert a clear *behind* a Pal the player is already watching. See
 * `session.retroactive-join.test.ts` for the regression that pins this.
 *
 * Consequences, all deliberate:
 *   - an earlier Pal still exposes targets for a later one (forward help);
 *   - a later Pal never helps an earlier one (that is the rewrite);
 *   - contested pixels go to the earlier launch, always.
 *
 * Do not lower this value to "restore concurrency". Concurrency is presentation
 * (Pals share the rail, Active-slot pressure); it is not, and must not be,
 * retroactive re-resolution. `simulateEpoch` refuses overlapping windows.
 */
export const LAUNCH_SPACING = 1;
