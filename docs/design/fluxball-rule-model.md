# Fluxball rule model

Status: canonical gameplay contract for `fluxball-rules-v6`.

Fluxball has two variants. Their rule models must remain distinct.

Story presents them in a fixed escalation: `fluxball-global` is 2P Global, then
`fluxball-individual` is 2P Individual. Arcade may expose the additional supported
format combinations, but it must not alter those Story assignments.

## Global Fluxball

Global Fluxball has one shared gameplay rule state. Its three variables—MOVE,
BALL, and GOAL—govern every active player. `CHANGE RULES` replaces that one
shared state for everyone. The interface confirms the change without exposing
either the outgoing or incoming values.

## Individual Fluxball

Individual Fluxball gives every player an individual hidden MOVE/BALL/GOAL
state. Players infer their own rules from movement, contact, and scoring
consequences. They may not inspect another player's rules, and the active or
completed match interface must not disclose any previous or new individual
rule state.

The individual states are coupled through a **joint QGraph state**. This is not
a global rule state: it is the coupled source from which the simultaneous set
of individual states is interpreted. When a human uses `CHANGE RULES`, the
joint QGraph state advances and every player's individual hidden rules change
together. Their values remain hidden; play supplies the evidence.

## Shared rule-change opportunity

Each timed round has exactly one player-triggered rule change. It is shared by
all local humans, the first valid human request consumes it, CPUs cannot use
it, and it resets at the next round. A goal never changes rules. The transition
is processed before movement, contact, and goal evaluation on its fixed tick.

Every round therefore freezes two QGraph-derived configurations before play:
the opening state and the possible successor. Active play is provider-free.

## Scoring

Goals are local to a timed round and reset when the next round starts. A unique
highest goal total earns exactly one round win; a tied highest total is a drawn
round and earns no round win. The match result is determined by round wins,
not cumulative goals. Every format uses three 40-second rounds. In four-player
formats the north/south apertures are scaled to the court width, rather than
reusing the narrower side-goal measurement.

## Distinction from Qong

- **Qong:** observation resolves one unresolved constitutive rule.
- **Global Fluxball:** everyone plays under one shared, mutable three-variable
  rule state.
- **Individual Fluxball:** players infer different hidden rules coupled through
  a joint QGraph state; the shared change opportunity transitions that joint
  state without revealing either configuration.

Historical v5 recordings retain four 40-second rounds; earlier versions retain their original durations. New Story seed selection is checked against the three-round schedule.
