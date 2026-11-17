# Quantum Box NPC behavior

Policy record: 2026-10-22; local difficulty and navigation update: 2026-11-17. This describes the desktop release candidate. The policies are deterministic game code, not language models or remote AI. Recorded quantum data determines game conditions; it does not make the NPC's decisions.

## Current correction

Fluxball learns each scoring goal from its public recipients, processes goals even during a frozen movement clock, and immediately replaces an intent based on a disproven goal. That fixes the evidence-handling defect.

A separate physical defect let a CPU kick the ball the wrong way while walking straight through it toward a shooting position. Once it has learned STRIKE, it now checks that route, steps clear on one consistent side when necessary, gets behind the ball, and follows through to contact. Staging points respect the court edges. Pursuit of another carrier remains direct; movement speed, acceleration, input precision, collision physics and movement-inversion learning are unchanged. This does not make every kick perfect or eliminate ordinary own goals caused by opposition or uncertain rules.

A later desktop QA sweep reproduced a separate deadlock after movement inversion: CPUs could reach a wall before collecting unobstructed movement evidence, then keep pushing into it. Boundary recovery now briefly reverses the blocked input to regain room for observation. It does not infer inversion from the blockage or a rule-change notification. The November 17 changes below affect Fluxball and Quarry only. Qong and Quantman are unchanged.

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
- If another player carries the ball, it pursues that player's position projected 0.25 seconds ahead with two competitors or 0.15 seconds with four. There is no CPU teammate exception.
- While carrying, it heads beyond its believed scoring goal. The pre-existing carrying code can choose a small sideways waypoint around a nearby player directly ahead; this is separate from the removed ball/carrier circling change.
- After learning STRIKE, it stages 60 court units behind the ball relative to its believed scoring goal. If the path would cross the ball, it uses a consistent side and a clearance waypoint, then proceeds behind it. Once aligned or close to a court-clipped staging point, it commits through the ball instead of braking back toward staging. If the ball moves so that a clipped clearance waypoint traps the CPU at the sideline, it switches to the other side. Public contact or a goal resets this short shot preparation.
- It compensates for inverted movement only after learning that mapping. The separate boundary-recovery probe below briefly reverses a blocked input without changing that belief.

Pursuit decisions update every 4 simulation ticks with two competitors (200 ms) or 7 ticks with four competitors (350 ms). While carrying or preparing a learned STRIKE, the existing 3/4-tick cadence is retained: slower updates there disrupted purposeful shot execution in regression tests. A changed scoring belief now invalidates the old decision immediately. Story and Arcade currently use the same decision/evidence settings. The faster `CAPABLE_PUBLIC_POLICY_TUNING` is used by evaluation/tests, not the ordinary game.

At a court boundary, 8 consecutive live ticks (400 ms) of nonzero input with less than 0.15 court units of displacement trigger a deterministic reversal at the next normal decision. The escape probe lasts at most 24 ticks (1.2 seconds), ends earlier when the ordinary unobstructed movement test obtains evidence, and is cancelled by a goal/clock discontinuity. It issues movement throughout; it is not a stationary delay. `blockedMovementTicks` and `boundaryProbeTicks` expose those bounds. A blocked sample never changes a belief, and the existing wall/player collision exclusions remain in force. Normal pursuit and shot preparation resume after the probe.

Movement learning waits for a command to settle for 4 ticks (200 ms), then requires 3 consecutive clear displacement samples. Those thresholds are exposed in `FluxballPolicyTuning`. Walls, nearby players, goal freezes and body resets are excluded as evidence of inversion. This is purposeful movement followed by correction; there is no random wandering or stationary confusion timer. Congestion can delay learning because the code declines to treat a collision as evidence. Confidence values are fixed diagnostic labels, not calibrated probabilities.

### Limits and invariants

The CPU can still guess wrong before it has evidence, be obstructed or outplayed, or mis-kick a moving ball. The regression tests reproduce the original four repeated harmful-goal rounds and require useful goals without those repeated mistakes. Separate physical tests cover approaches toward all four goals and near sidelines, requiring an actual useful kick within twelve simulation seconds. They test purposeful progress as well as correct beliefs. Boundary regressions also replay the recorded four-competitor Split deadlocks at seed 7/round 2 and seed 14/round 3, require actual resumed movement and scoring, and check that blocked observations cannot teach inversion or bypass the normal decision cadence.

Four-competitor kickoffs and goal resets put every player 128.8 court units from the centre. A/B move inward; C/D retain their distance. The court and goal openings do not change, so the vertical goals still have a shorter, wider scoring route. Collision-pair order is shuffled once per kickoff and exact equal-distance ball-contact ties are seeded, avoiding a fixed player-ID preference. This does not promise equal outcomes in a crowded four-body collision. Two-competitor starts retain their original geometry and tie handling.

The one shared human-triggered change per round, simultaneous-input handling, shared round winners, speed, acceleration, collision magnitudes and recorded-data provenance are unchanged. New runs use `fluxball-rules-v8`; older v7 runs retain their original tuning, starts and collision ordering for reproducible replays.

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

The CPU receives the current visible hunt relationships, including who can hunt it. It does not inspect hidden or future graph states. Each bird independently refreshes its tactical destination every 4 simulation ticks (200 ms).

- If a currently active hunter is nearby, it chooses a perch that increases horizontal/vertical separation, penalizing a route through that hunter. This applies even with no valid prey. It is a simple escape heuristic, not perfect shelter/pathfinding.
- Otherwise it selects the nearest valid prey, excluding knocked-out and protected players. Distance respects horizontal wrap. A/B aim 14 units above the target's observed position. C aims 18 above a 2-tick (100 ms) motion projection; D aims 28 above a 3-tick (150 ms) horizontal projection.
- With no prey or nearby hunter, it changes its seeded perch destination every 4 seconds. It can rest when it reaches a perch; it no longer holds one perch for the whole hunt phase.
- If it stands on a platform above its destination, it selects an edge, moves beyond it and commits until its body has descended below the platform. This fixes the case where it sat directly above prey forever. A changed tactical goal clears that route; an 80-tick safety bound prevents stale routes from persisting indefinitely.

It steers horizontally toward the current destination with the existing 5-unit dead zone. It flaps when it needs height or is falling near the floor, subject to the normal flap cooldown and staggered cadence: every 4 ticks for A/B, 5 for C, 6 for D (200/250/300 ms at 20 Hz). Flight speed, impulse, capture geometry and human controls are unchanged. The birds do not coordinate.

New runs use `quarry-rules-v8`. Earlier versions, including v7, retain the old stateless policy so saved input tapes reproduce their original behavior. Tactical memory is per bird and resets each round. Better routing/evasion can sometimes make a bird harder to catch even though offensive tracking is slower; human difficulty remains a playtest judgment.

## How to read the evidence

The regression tests in [fluxball.test.ts](../tests/unit/fluxball.test.ts) verify goal learning, shared benefit, independent beliefs, unknown round starts, retained beliefs after changes, movement inversion evidence, collision exclusions and the public information boundary. New tests first failed on stale decisions, ambiguous previous-score sampling and a new goal arriving without a movement-clock increment; all pass after the focused scoring change.

The recorded-bank audit separately distinguishes **what goal the CPU believes is beneficial** from **where the ball actually goes**. A passing belief test is not proof of good shot execution. None of these checks claims a fresh hardware run, human-quality reasoning or perfect play.

The focused [AI balance regressions](../tests/unit/aiBalance.test.ts) cover one/two-human ledge recovery, predator evasion, no-prey patrol, tracking cadence, equal kickoff/reset distances and reproducible contact ties. Local before/after replay probes separately compare unchanged v7 simulations. Diagnostic idle-human score totals are not human win rates.
