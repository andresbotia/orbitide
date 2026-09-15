PIXEL ARCADIA — FINAL GAMEPLAY UI POLISH + ITEM DOCK + WIN SCREEN + LOSS BUG FIX

ROLE

You are implementing the final gameplay-shell cleanup before this work is committed and we move on to real coins/items/economy.

Do NOT start the real item system yet.
Do NOT start coins, shop, purchases, or economy yet.

This pass has FOUR goals:

Finish the gameplay UI

relocate the placeholder item buttons

simplify the item visual language

finish the control-deck hierarchy

polish early/small-board presentation

make empty holding wells clearer

Polish the win screen

keep the current flow and behavior

make the victory presentation match Pixel Arcadia Home/gameplay

improve hierarchy without turning it into a large redesign

Investigate and FIX the current loss-condition / holding bug

user reports that the game currently does not lose properly

holding appears to "eat" incoming items/Pals rather than producing the expected failure/deadlock/loss outcome

this is a functional bug and takes priority over visual polish

Verify, then commit-ready

do not move into coin/item implementation until this pass is stable

CURRENT PRODUCT STATE

Already implemented:

compact gameplay HUD

board sizes to puzzle geometry

larger Pals

unified bottom control deck

Home + Restart

cabinet lighting / cyan + gold polish

placeholder item rack

performance pass for concurrent Pals

holdingCapacity remains engine-driven

ACTIVE n/5 remains concurrent-orbit capacity

item placeholder counts are not real inventory

Important rule distinction:

ACTIVE n/5 = concurrent orbit capacity

holdingCapacity = holding tray capacity (Core V2 currently 4)

Do not conflate these.

REQUIRED REFERENCES

Use these visual references if supplied:

latest gameplay screenshot/recording

current Home screen

Pixel Flow screenshots supplied by the user

current win screen:

REF_current_win_screen.png

Use:

Pixel Flow for control density / booster placement / simple utility icon language

Pixel Arcadia Home/gameplay for palette, cabinet materials, glow, typography, spacing, and identity

Do NOT copy Pixel Flow branding or exact art.

PART A — ITEM PLACEMENT FINALIZATION

PROBLEM

The current item rack sits on the same row as ACTIVE n/5.

That makes:

ACTIVE compete with items

the row visually top-heavy

the item buttons feel attached rather than built into the control deck

The user does NOT want the items beside ACTIVE.

FINAL DIRECTION

Move the three placeholder items into a dedicated compact footer dock at the bottom of the control deck.

Preferred hierarchy:

ACTIVE n/5

ready/launch Pals

holding wells

item dock

The item dock should be:

centered horizontally

visually secondary to ready Pals

clearly part of the same cabinet

compact

no giant separate panel

no large visible item labels

Do not increase overall screen height unnecessarily.

If needed on small phones:

reduce vertical gaps/padding before reducing important Pal sizes

item dock may be slightly tighter at 360px width

no scrolling

PART B — MINIMAL ITEM ICON LANGUAGE

The current item art is too decorative / app-icon-like.

We want simple arcade utility symbols.

Do not use emoji.
Do not use huge illustrated frames.
Do not use generic purple booster circles.

The button shell provides most of the Pixel Arcadia styling.

Button shell

Each item button:

dark navy recessed button

cyan hardware rim

very subtle inner glow

small count badge

pressed state

disabled/zero state

optional tiny gold accent

same visual family as Home/Restart

Directional size:

~44–48pt visual button

=44pt touch target

Icon 1 — Extra Slot

Minimal symbol:

simple cyan +

inside a thin slot/well outline

optional tiny gold corner/node

no extra decorative frame

The concept should read instantly as:
add another slot

Icon 2 — Pixel Bomb

Minimal symbol:

dark round bomb silhouette

cyan edge/rim

tiny warm-gold/orange fuse spark

no detailed texture

no giant explosion art

The concept should read instantly as:
bomb / destructive power-up

Icon 3 — Scanner

Minimal symbol:

cyan target/reticle OR concentric scan rings

one central dot

no radar map clutter

optional tiny gold center point

The concept should read instantly as:
scan / hint / locate

IMPORTANT

If the currently supplied item PNGs do not match this simplified direction:

do NOT force the old detailed artwork into the final UI

replace them with simple local vector/SVG/path-based icons or lightweight in-app drawing

keep them consistent with Pixel Arcadia

do not rely on a third-party icon pack unless the project already does

The icon language should be cleaner than the previous placeholder images.

PART C — SMALL-BOARD / EARLY-LEVEL POLISH

The screenshot shows that early/small levels can still look undersized inside the rail.

Goal

A small authored puzzle should not look lost inside a huge board.

Do NOT change level geometry.

Adjust presentation rules so small boards have a stronger minimum perceived scale.

Possible approaches:

raise minimum cell size when grid dimensions are small

cap the amount of empty rail interior

center the puzzle without giant blank margins

allow board container dimensions to shrink more aggressively around tiny grids

preserve rail clearance for moving Pals

Do NOT:

stretch cells

distort puzzle aspect ratio

rewrite level data

make the board so small that orbit path readability suffers

Visually, the puzzle should feel intentional even on Level 1–5.

PART D — HOLDING WELL VISUAL CLEANUP

Current empty holding wells are visually heavy / very dark.

Improve them so they read as:
recessed inactive sockets

Use:

slightly lighter inner border

subtle cyan edge at very low intensity

shallow inner shadow

occupied state stronger than empty state

no giant black holes

Keep the actual number of wells driven by engine holdingCapacity.

PART E — WIN SCREEN POLISH

The current win screen works, but it still feels slightly detached from the newer gameplay/Home visual language.

Reference:
REF_current_win_screen.png

Current flow should remain:

win state

restored art / board remains visible

title / world-level info

NEXT

Home

Do NOT change progression behavior.

Goals

Make the win screen feel like:
the cabinet celebrating the restored image

Keep

restored artwork as the hero

RESTORED

artwork name

world / level label

NEXT as primary action

Home as secondary action

Improve

Victory panel integration

use a darker cabinet-style sheet

cyan top edge / subtle gold highlight

avoid plain modal-sheet feel

NEXT button

keep warm gold/orange primary CTA

match Home CTA material

slight cyan/gold edge lighting

strong pressed state

RESTORED treatment

small cyan label is good

may add a tiny gold completion accent

do not overdecorate

Artwork title

keep large and centered

make spacing feel premium

no extra unnecessary copy

World / Level pill

keep secondary

reduce purple feel if it conflicts with current Pixel Arcadia palette

use navy/cyan with restrained gold accent if practical

Home

clearly secondary

simple text or small cabinet button

do not compete with NEXT

Transition

if existing animation system makes it cheap:

win sheet rises cleanly

restored artwork gets a short cyan/gold celebration pulse

no giant particles

do not add expensive full-screen confetti

PART F — CRITICAL LOSS / HOLDING BUG

USER-REPORTED BUG

The game currently does not appear to lose correctly.

Observed symptom:

holding appears to "eat" items/Pals

instead of reaching an expected fail/deadlock/loss state, pieces can disappear or be absorbed

this may be easiest to notice on easier levels because the fail case is rare

Do not assume the root cause.

Investigate the engine + presentation flow.

LOSS-BUG INVESTIGATION CHECKLIST

Trace the full path for a Pal/pixel that cannot immediately resolve:

launch/request begins

Pal enters active/orbit state

matching/clear attempt

unresolved Pal attempts holding

holding capacity check

holding insertion

subsequent retry/release behavior

no legal destination / full holding behavior

loss/deadlock evaluation

session status transition

loss presentation / UI

Search for:

holding insertion that silently drops overflow

array slice / truncation

replacement of old held item by new held item

capacity checks after mutation instead of before mutation

filter/dedupe logic removing same-color/ID entries unexpectedly

UI using keys that make a held item visually disappear while state still exists

reducer paths that consume a charge before confirming successful placement

auto-release logic that removes a holding item without spawning it back

mismatch between holdingCapacity and rendered wells

fail evaluation that only checks queues/active but ignores blocked holding

deadlock condition that is never re-evaluated after a failed hold

background/win transition incorrectly swallowing failure

one event being marked consumed twice

engine vs presentation state drifting

EXPECTED SAFETY INVARIANTS

Do not encode these blindly if the game rules differ, but verify equivalent invariants exist.

Invariant A — no silent deletion

A Pal/item cannot simply disappear.

Every consumed/removed unit must have a valid destination/outcome:

resolved/cleared

active/orbiting

queued

held

explicitly spent by a game rule

terminally accounted for by win/loss transition

If none applies, that is a bug.

Invariant B — holding capacity is respected

Before adding to holding:

if a slot is available, insert exactly once

if no slot is available, execute the intended failure/deadlock behavior

Never:

insert then truncate

overwrite another held item

silently discard overflow

Invariant C — holding count matches state

holding.length <= holdingCapacity

If the rules allow temporary exceptions later for Extra Slot, those are not active yet.

Current behavior must remain strict.

Invariant D — no duplicate consumption

A unit that moves to holding should not also be marked consumed/cleared unless a rule explicitly says so.

Invariant E — fail status is stable

Once session enters loss/fail:

do not continue launching new normal gameplay actions

do not auto-win in the same tick

do not silently recover unless there is an explicit retry/continue mechanic

DEFINE THE REAL LOSS CONDITION FROM EXISTING RULES

Do NOT invent a new loss rule.

Find the intended existing contract from:

engine code

tests

current session state enums

earlier milestone code

game design comments/docs

The likely possibilities include:

attempting to park/hold when holding is full

no legal move / deadlock

active+holding state cannot progress

all remaining queues blocked

But verify the actual intended rule.

If the intended loss condition is underspecified in code:

choose the smallest implementation consistent with existing tests/design

document it clearly

do not redesign the game

ADD REGRESSION TESTS FOR THE LOSS BUG

This fix is not complete without targeted tests.

At minimum create deterministic tests for:

Test 1 — holding fills normally

place items until holding.length === holdingCapacity

confirm nothing disappears

confirm all IDs/counts remain accounted for

Test 2 — next unresolved item with full holding

trigger the exact fail/deadlock path

assert expected session status

assert incoming item was not silently dropped

Test 3 — no overwrite

fill holding with known distinct IDs

attempt overflow

assert previous held items are unchanged

Test 4 — no duplicate consumption

item moved to holding

confirm it is not also counted as cleared/spent

Test 5 — fail presentation event

once engine/session enters loss

presentation receives the correct terminal event/state

Test 6 — normal win still works

fix must not break normal successful levels

Test 7 — concurrency + holding

multiple active Pals resolving near the same frame

two or more may attempt holding

capacity decision remains deterministic

no race-like silent loss

If existing tests already cover some of these, extend them instead of duplicating unnecessarily.

PRESENTATION VS ENGINE

Be careful because the previous performance pass introduced:

rAF-coalesced presentation commits

concurrent independent Reanimated clocks

The loss bug may be:

engine

presentation

or state synchronization between them

Do not blame the rAF batching without evidence.

Verify source of truth.

If engine state is correct but UI visually "eats" an item:

fix presentation reconciliation / keys / batching

If engine state itself drops the item:

fix engine/session logic

Do not paper over an engine bug by rendering a fake held Pal.

LOSS UI

If a proper loss state already has UI, ensure it triggers.

If a loss state exists but has no polished presentation:

keep scope small

make it functional first

a basic Pixel Arcadia loss sheet is acceptable

do NOT spend most of this pass designing a huge new failure screen

Priority:

correct failure logic

correct terminal state

clear Retry / Home affordance if already part of product

polish later if necessary

If there is already a loss screen component, reuse and wire it correctly.

CRITICAL REPRO — FULL HOLDING MUST NOT BLOCK A TUNNEL TAP

The newest device screenshot gives us a concrete reproduction of the loss bug.

Observed state:

Core V2 gameplay

holding is currently full / has no free holding destination

a ready tunnel Pal is still tappable conceptually (example shown: the large green 13)

tapping that ready Pal currently does NOTHING except show:
Free a Holding slot first.

This behavior is WRONG for the intended game design.

Intended behavior

A full holding tray must NOT pre-emptively disable a legal tunnel/ready-Pal tap.

The player must be allowed to make the risky move.

The correct flow is:

Player taps a ready tunnel Pal even while holding is full.

Normal launch/engine resolution begins.

If that Pal can resolve/clear without needing holding, gameplay continues normally.

If that Pal eventually needs to park in holding and there is no free holding slot:

do NOT silently delete it

do NOT refuse the original tap

do NOT overwrite an existing held Pal

transition to the intended LOSS / fail state.

This is important because the player must be allowed to make a losing decision.

The UI must not protect the player from failure by blocking the move.

What to find

Search for any pre-launch guard equivalent to:

if (holding.length >= holdingCapacity) {
showMessage('Free a Holding slot first.')
return
}

or:

disabled = holdingFull

or any selector/canLaunch calculation that includes free holding capacity as a requirement before the engine has determined that the launched Pal actually needs holding.

Also inspect:

tunnel button disabled props

ready-Pal onPress guards

canLaunch / canRequest selectors

session controller validation

presentation-only guards

toast/banner code that emits Free a Holding slot first.

Required fix

Remove the pre-emptive full-holding launch block.

Do NOT simply remove all validation.

The launch must still respect legitimate rules such as:

tunnel has a ready Pal

game is not already terminal

concurrent active/orbit capacity allows the launch

any other real engine rule already in place

But free holding capacity is not a prerequisite to STARTING the launch.

Holding capacity is only relevant later if the launched Pal actually needs to enter holding.

Loss timing

Do NOT auto-lose immediately when the user taps while holding is full.

That would also be wrong.

The player loses only when the newly launched/unresolved Pal reaches the point where the engine requires a holding destination and none exists.

Example:

holding full
↓
player taps green 13
↓
green 13 launches normally
↓
engine attempts its normal clear/resolution
↓
IF green 13 resolves:
continue
ELSE IF green 13 needs holding and no slot exists:
enter LOSS

This preserves player agency and the actual puzzle consequence.

Remove the current protective message

The current Free a Holding slot first. behavior should NOT fire merely because holding is full before launch.

If that message is useful elsewhere, keep it only for an action whose actual rule truly requires choosing a free holding slot.

For the ready-tunnel tap shown in the screenshot, it must not block input.

Regression tests for this exact bug

Add deterministic coverage:

Test A — full holding does not disable ready tunnel

fill holding to holdingCapacity

ensure a ready tunnel Pal exists

assert the ready tunnel action is still considered launchable if all other launch rules allow it

Test B — tap is accepted while holding full

full holding

tap/launch ready Pal

assert launch event begins

assert no Free a Holding slot first. rejection occurs

Test C — launched Pal resolves successfully

full holding

launch a Pal that can clear/resolve without parking

assert game does NOT lose solely because holding was full

assert holding remains unchanged

Test D — launched Pal eventually requires holding

full holding

launch a Pal that cannot resolve and must park

assert session transitions to intended LOSS state

assert incoming Pal is not silently deleted

assert existing holding contents are not overwritten

Test E — concurrent case

full holding

one or more Pals already active

launch another legal ready Pal

if it later requires holding with no slot, loss is deterministic

no race-like disappearance / duplicate consumption

Test F — terminal lockout still works

after loss is entered

further tunnel taps are blocked as expected

Acceptance criterion for the exact screenshot

Reproduce the state represented in the provided screenshot.

When the user taps the green 13:

the tap must be accepted

the Pal must launch if active-capacity and other real launch rules allow it

the UI must not say Free a Holding slot first. merely because holding is full

if that launch later cannot resolve and needs holding, the player must lose.

This behavior is REQUIRED before the gameplay shell is considered stable.

PART G — DO NOT START REAL ITEM IMPLEMENTATION

This pass must NOT implement:

Extra Slot gameplay

bomb targeting

bomb clearing

scanner/hint logic

inventory persistence

coin balances

currency rewards

item purchases

shop UI

monetization hooks

The item dock is only reserving final UI space.

We will commit the stable gameplay shell first.

PART H — IMPLEMENTATION ORDER

Follow this order.

PHASE 0 — AUDIT

Before edits, identify:

holding reducer / state transitions

loss state contract

game session status

fail evaluator

presentation event path

holding UI

current ItemRack

win screen component

board geometry sizing rules

Summarize likely loss bug before changing code.

PHASE 1 — FIX LOSS BUG FIRST

reproduce the exact device case where a full holding tray blocks tapping the ready green 13

find and remove the pre-launch Free a Holding slot first. safety guard

keep all legitimate launch guards such as terminal state and active/orbit capacity

write/extend failing regression tests

allow the launch to begin even with full holding

only trigger LOSS later if the launched Pal actually requires holding and no slot exists

verify no silent item deletion

verify no holding overwrite/truncation

verify loss transition

run relevant engine/session tests

Do not proceed to cosmetic work until this passes.

PHASE 2 — ITEM DOCK RELOCATION

move item rack from ACTIVE row

put compact 3-button dock at bottom of control deck

keep ACTIVE clean

preserve all placeholder-only behavior

PHASE 3 — MINIMAL ICON PASS

simplify Extra Slot / Bomb / Scanner visual symbols

clean cabinet button shell

small count badge

zero-count state

PHASE 4 — SMALL-BOARD + HOLDING POLISH

improve early-level scale

improve empty holding wells

no gameplay geometry changes

PHASE 5 — WIN SCREEN POLISH

cabinet-style victory panel

Home-consistent NEXT

reduced purple

restored art stays hero

preserve behavior

PHASE 6 — FINAL QA

gameplay

loss

win

restart

Home

multiple active Pals

full holding

small board

item dock at 360/390/430 width

PART I — ACCEPTANCE CRITERIA

Loss bug

full holding does NOT pre-emptively disable a legal ready-tunnel tap

the current Free a Holding slot first. rejection is removed from this launch path

a Pal that resolves successfully can still be launched while holding is full

a Pal that later needs holding with no free slot triggers LOSS

deterministic repro exists

regression test fails before fix / passes after

no item/Pal silently disappears

holding never overwrites or truncates silently

full holding follows intended fail/deadlock rule

session enters correct loss state

loss UI/event occurs

normal win still works

concurrency does not create inconsistent holding state

Item dock

items no longer share the ACTIVE row

item dock is at bottom of control deck

three buttons are centered and compact

counts still render

zero-count state still works

no item gameplay implemented

no coins/economy implemented

Item icon style

Extra Slot is simple and readable

Bomb is simple and readable

Scanner is simple and readable

no over-rendered app-icon style

no giant booster circles

visually matches Pixel Arcadia

Gameplay UI

small early boards feel less lost

puzzle remains crisp

holding wells read as recessed sockets

ready Pals remain dominant

no new scrolling/clipping

360/390/430 widths work

Win screen

progression behavior unchanged

NEXT remains primary

Home remains secondary

panel matches Pixel Arcadia cabinet language

purple is reduced where appropriate

restored art remains hero

no expensive celebration effect

PART J — TESTS / VALIDATION

Run:

npx tsc --noEmit

eslint on touched files

holding tests

session tests

concurrency tests

gameplay shell/layout tests

board geometry tests

any win/progression tests

build/Expo validation normally used in this repo

Known pre-existing failures must be clearly separated from new failures.

IMPORTANT:
Earlier session.test.ts failures included holding/win-background/chargeConsumed cases.
Because this pass explicitly touches the loss/holding contract, do NOT automatically dismiss those now.
Re-investigate any holding-related session failure and determine whether it is actually connected.

PART K — FINAL RESPONSE

When complete, report:

exact root cause of the loss/holding bug

exact behavior before vs after

regression tests added

item dock changes

icon simplification changes

small-board/holding-well changes

win-screen changes

files changed

test results

anything still intentionally deferred

Do not start the next milestone automatically.

FINAL NORTH STAR

Before coins or real items, lock a stable gameplay shell: no silent holding losses, a proper fail state, clean bottom-docked utility items, stronger small-level presentation, and a victory screen that feels unmistakably Pixel Arcadia.
