# Qong unresolved rule-state

**Status:** canonical gameplay fiction and interface contract

Qong is Pong with one unresolved constitutive rule. For each round, the
operative rule is one of two possibilities:

- score through the opponent's goal line to win the point; or
- score through your own goal line to win the point.

The binary rule-state is derived from recorded quantum Coin Toss data before
the match begins. Active play makes no provider request. Although the recorded
result is already present in the frozen run pack, the game's fiction treats the
rule as unresolved until it is observed or otherwise measured.

The physical and lusory events must remain distinct. A ball crossing is a
determinate physical event: the ball crossed the left or right line. What that
crossing means is unresolved until measurement determines which constitutive
rule Qong is operating under. Measurement therefore resolves the rule and the
point together. The game must never describe this as a completed goal followed
by a quantum toss that randomly chooses the winner.

## Measurement

Measurement occurs in either of two ways:

1. A player spends one observation by pressing Space before a line crossing.
2. If the rule remains unresolved when the ball crosses a line, the crossing
   forces measurement.

An observation resolves the current round's rule and leaves it resolved until
that round ends. A forced measurement resolves the rule and the point as one
staged event. Every new round begins with a new unresolved rule-state.

The internal data contract may continue to encode the two outcomes as
`direct` and `invert`: `direct` means the opponent-goal rule and `invert` means
the own-goal rule. Those implementation terms are not player-facing fiction.

## Player-facing state

The persistent top HUD has exactly four horizontal sections. Each section
places its label above its current value:

```text
ROUND:      | RULE STATE: | GOAL:       | WINNER:
4/7         | UNRESOLVED  | UNRESOLVED  | UNRESOLVED
```

Measurement replaces the final two values in place; it does not open a modal
or cover the playfield:

```text
RULE STATE: UNRESOLVED  ->  RULE STATE: MEASURING  ->  RULE STATE: RESOLVED
GOAL: UNRESOLVED           GOAL: UNRESOLVED           GOAL: OWN / OPPOSITE
```

`WINNER` remains `UNRESOLVED` when observing resolves the rule without a line
crossing. Once a crossing resolves the point, it names that point's winner
between rounds. After round seven it names the match winner. The possible
labels are `YOU` and `CPU` in a one-player match, or `PLAYER 1` and `PLAYER 2`
in a local two-player match.

During active play, the bottom action reads `OBSERVE: SPACE 3`, with the number
reflecting the existing remaining-use counter. Once the match is complete it
becomes `CONTINUE: SPACE`; the footer offers `RETRY: X` and no run export.
Deterministic replay remains internal QA/evidence infrastructure rather than a
player-facing literal replay. Completion must not add a notice over the court. The HUD must not use
`scan`, `polarity`, `trace`, `public model`, or player-versus-CPU mode labels.

## Evidence boundary

The unresolved state is the game's constitutive fiction, not a claim that a
live quantum system remains physically unmeasured during browser play. The
recorded provider result, local selection, scoring, physics, observation
staging, CPU inference, and replay must remain distinguishable. No live Coin
Toss call occurs during a rally.

## Story terminal

Qong returns from the completed result to the persisted terminal graph. No
physical avatar, Designer figure, morph, doorway, office, or walk-around scene
is part of production. The approved terminal corpus owns the player-facing
explanation and its page divisions; this design note does not paraphrase or
extend that copy.

The terminal distinguishes the physical crossing, unresolved gameplay rule,
stored one-shot provider result, and local own/opposite mapping. Exact provider
job IDs, backend identity, hashes, selector trace, and qualified `RunContext`
remain in provenance rather than crowding the default reading path.
