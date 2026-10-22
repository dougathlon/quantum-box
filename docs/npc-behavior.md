# Quantum Box NPC behavior

Code inspection: 2026-10-22. This describes the unified desktop/mobile release candidate. The policies are deterministic game code, not language models or remote AI. Recorded quantum data determines game conditions; it does not make the NPC's decisions.

## Current correction

Fluxball learns each scoring goal from its public recipients, processes goals even during a frozen movement clock, and immediately replaces an intent based on a disproven goal. That fixes the evidence-handling defect.

A separate physical defect let a CPU kick the ball the wrong way while walking straight through it toward a shooting position. Once it has learned STRIKE, it now checks that route, steps clear on one consistent side when necessary, gets behind the ball, and follows through to contact. Staging points respect the court edges. Pursuit of another carrier remains direct; movement speed, acceleration, input precision, collision physics and movement-inversion learning are unchanged. This does not make every kick perfect or eliminate ordinary own goals caused by opposition or uncertain rules.

The other three NPC policies described here are unchanged.

## Fluxball: try a rule, then revise it from consequences

Source: [FluxballCpuPolicy.ts](../src/games/fluxball/FluxballCpuPolicy.ts). Integration and the public information boundary: [FluxballSession.ts](../src/games/fluxball/FluxballSession.ts).

Each CPU has its own three beliefs. All begin UNKNOWN at the start of every round. CPUs do not pool private beliefs or cooperate as a team. Another CPU is pursued just like a human when it carries the ball.

| Question                            | Initial behavior                                                                                                               | Evidence that changes it                                                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Are my controls direct or inverted? | Try ordinary directional input.                                                                                                | Compare issued input with actual unobstructed displacement. Repeated motion in the opposite direction teaches INVERTED.                           |
| Do I carry or kick on contact?      | Approach the ball without a learned interaction rule.                                                                          | My own visible pickup/steal teaches CARRY; my own strike/dislodgement teaches STRIKE.                                                             |
| Which goal increases my score?      | Pick own or opposite from the round number and a seeded value. This assumption stays stable until a relevant goal is observed. | A visible goal that increases my score identifies that scoring goal. A goal on my axis that does not increase my score identifies the other goal. |

**Example:** CPU B initially expects the left goal to help it. A ball enters the left goal and only Player A gains a point. B now aims to score through the right goal. If a later rule change makes the right goal stop benefiting B, the next contradictory goal makes B switch back. The change notification alone supplies no knowledge of the new rules.

A goal that awards **both A and B** is still beneficial to B. That is intentional: the CPU pursues its own points, rather than rejecting shared points or trying to deny everyone else points. Who last touched the ball does not determine who receives the points. In four-competitor play, A/B learn from left/right goals and C/D from top/bottom goals; a goal on the other axis provides no information about their own scoring rule.

### What the CPU may see

Its input contains the current player and ball positions, visible motion, current scores, visible contact consequences, and public goal outcomes. The session strips out the actual per-player rules and the hidden goal mappings before calling the policy. Goal recipients are derived from the public scoreboard change, not passed in as a rule answer. It may learn from another player's visible goal. Each CPU separately processes that public event.

The policy knows the game's possible rule types: controls can be DIRECT/INVERTED, contact can be CARRY/STRIKE, and the scoring goal can be OWN/OPPOSITE. It does not discover an arbitrary new rule language. It does not inspect future rule states or QPU records.

A mid-round rule change retains the previous understanding until motion, contact or a goal contradicts it. A new round constructs fresh policies with no current-rule knowledge.

### How it moves

- With a loose ball and no learned kick behavior, it heads toward the ball's position projected 0.22 seconds ahead.
- If another player carries the ball, it pursues that player's position projected 0.36 seconds ahead. There is no CPU teammate exception.
- While carrying, it heads beyond its believed scoring goal. The pre-existing carrying code can choose a small sideways waypoint around a nearby player directly ahead; this is separate from the removed ball/carrier circling change.
- After learning STRIKE, it stages 60 court units behind the ball relative to its believed scoring goal. If the path would cross the ball, it uses a consistent side and a clearance waypoint, then proceeds behind it. Once aligned or close to a court-clipped staging point, it commits through the ball instead of braking back toward staging. Public contact or a goal resets this short shot preparation.
- It reverses its issued controls only after learning that its own movement is inverted.

Normal decisions update every 3 simulation ticks with two competitors (150 ms) or 4 ticks with four competitors (200 ms). A changed scoring belief now invalidates the old decision immediately. Story and Arcade currently use the same decision/evidence settings. The faster `CAPABLE_PUBLIC_POLICY_TUNING` is used by evaluation/tests, not the ordinary game.

Movement learning waits for a command to settle for 4 ticks (200 ms), then requires 3 consecutive clear displacement samples. Those thresholds are exposed in `FluxballPolicyTuning`. Walls, nearby players, goal freezes and body resets are excluded as evidence of inversion. This is purposeful movement followed by correction; there is no random wandering or stationary confusion timer. Congestion can delay learning because the code declines to treat a collision as evidence. Confidence values are fixed diagnostic labels, not calibrated probabilities.

### Limits and invariants

The CPU can still guess wrong before it has evidence, be obstructed or outplayed, or mis-kick a moving ball. The regression tests reproduce the original four repeated harmful-goal rounds and require useful goals without those repeated mistakes. Separate physical tests cover approaches toward all four goals and near sidelines, requiring an actual useful kick within twelve simulation seconds. They test purposeful progress as well as correct beliefs.

The one shared human-triggered change per round, simultaneous-input handling, shared round winners, game physics and recorded-data provenance are unchanged by this pass.

## Qong: a fresh guess until the rule is publicly revealed

Source: [QongCpuPolicy.ts](../src/games/qong/QongCpuPolicy.ts); runtime: [QongSession.ts](../src/games/qong/QongSession.ts).

At every new rally, the CPU makes a fresh seeded 50/50 choice between **defend** and **concede**. Repeated guesses can occur by chance. It does not count previous outcomes or predict repeat/flip patterns, and it holds that guess within the rally.

When the current rule becomes public, it waits 15 ticks (250 ms at 60 Hz), then uses the visible rule: OPPOSITE means defend its goal; OWN means move away to let the ball into its own goal. The CPU cannot see the unresolved rule.

Defending tracks the ball's current vertical position with a fixed per-rally aiming offset of up to 12 units in either direction. It does not calculate an exact future wall-bounce interception. Conceding moves toward the top or bottom, away from the ball. An 8-unit aiming dead zone prevents constant tiny corrections. It uses the ordinary paddle movement in the session.

Consequently, an unresolved CPU can act on the wrong guess for that whole rally. That is expected uncertainty, not a failure to learn from the previous rally: the previous rally cannot tell it the new rule. Qong's policy was inspected but not changed in this pass.

## Quantman: four pursuit roles, not hidden-rule learning

Source: [GhostPolicy.ts](../src/games/quantmanSynthetic/game/GhostPolicy.ts); timing, release and collision behavior: [QuantmanSession.ts](../src/games/quantmanSynthetic/game/QuantmanSession.ts); speeds: [config.ts](../src/games/quantmanSynthetic/config.ts).

Each ghost uses the player's current room and facing, its own room, and the entire current maze wall map. It does not know future maze states. It chooses a target, then takes the first step of a shortest currently open route toward that target. It makes that decision at a room boundary, not by steering continuously during a crossing.

| Ghost   | Target                                                                                          |
| ------- | ----------------------------------------------------------------------------------------------- |
| VECTOR  | The player's current room.                                                                      |
| VEIL    | Two rooms ahead of the player's current facing.                                                 |
| MIRROR  | One room ahead, then two rooms to the player's right.                                           |
| DRIFTER | Chase when more than five Manhattan grid steps away; otherwise head toward its assigned corner. |

The projected ambush/flank targets respect the grid boundary but can lie beyond walls; the route search still uses open passages. If a target cannot be reached, the ghost chooses a reproducible legal neighbouring room. If no exit is legal, it stays in the current room. The ghosts do not coordinate a shared chase plan or learn scoring rules.

During the eat-ghost power, all four target the corner furthest from the player by Manhattan distance. That is a corner-seeking heuristic, not a guarantee that every immediate step increases distance from the player. Being frightened currently changes the target rather than the speed.

Ghost speed is 1.65 rooms/second, compared with the player's 3.2. Ghosts move at half speed when leaving or entering a tunnel-mouth room; the player does not receive that slowdown. Ghosts leave the den in a staggered sequence after 1, 2.5, 4 and 5.5 seconds of active play. Within the den they follow a fixed exit route. An eaten ghost returns to its spawn, waits one second and exits again. After a player death, the ghost release sequence restarts and the player receives two seconds of invulnerability. These policies and timings were inspected, not changed in this pass.

## Quarry: pursue currently valid prey

Source: [QuagCpuPolicy.ts](../src/games/quag/QuagCpuPolicy.ts); runtime: [QuagSession.ts](../src/games/quag/QuagSession.ts). `quag` is the internal code name for Quarry.

The CPU receives the current visible hunt relationships. It does not need to infer a hidden scoring goal. When those relationships change, its eligible targets change immediately; there is no separate learning delay or memory of old prey.

It selects the nearest player it can currently capture, excluding knocked-out players and players with respawn protection. Distance combines vertical separation with the shortest horizontal route across the wrapping arena. Ties are resolved by player ID.

- A/B aim 14 units above the selected target's current position.
- C aims 18 units above a position projected 4 simulation ticks ahead, including vertical movement.
- D aims 28 units above the target and projects horizontal motion 6 ticks ahead.
- With no valid prey, it heads toward a seeded perch that can change with the relationship phase.

It steers horizontally toward that destination, with a 5-unit dead zone. It flaps when it needs height or is falling near the floor, subject to the normal flap cooldown and a staggered cadence: every 4 ticks for A/B, 5 for C, 6 for D (200/250/300 ms at 20 Hz). It uses the same movement physics as humans.

There is no explicit predator-avoidance strategy and no cooperative CPU plan. Some avoidance happens incidentally through movement toward prey or perches. The policy was inspected but not changed in this pass.

## How to read the evidence

The regression tests in [fluxball.test.ts](../tests/unit/fluxball.test.ts) verify goal learning, shared benefit, independent beliefs, unknown round starts, retained beliefs after changes, movement inversion evidence, collision exclusions and the public information boundary. New tests first failed on stale decisions, ambiguous previous-score sampling and a new goal arriving without a movement-clock increment; all pass after the focused scoring change.

The recorded-bank audit separately distinguishes **what goal the CPU believes is beneficial** from **where the ball actually goes**. A passing belief test is not proof of good shot execution. None of these checks claims a fresh hardware run, human-quality reasoning or perfect play.
