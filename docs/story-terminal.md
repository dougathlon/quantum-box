# Terminal Story contract

The Story is a deterministic demonstration authored by an unseen Designer
through the Quantum Box terminal. Production contains no physical Designer or
player avatar, morph, office, den, door, walk-around room, or Workshop scene.

## Copy authority

`src/story/terminal/text-notes-provenance.json` records the approved document
filename, source SHA-256, allowed normalization, and a hash of the complete
runtime page corpus. Through the end of Quantman:

- wording, punctuation, paragraph order, and page divisions are fixed;
- editorial labels and routing instructions are not player copy;
- `CONTINUE`, `PLAY`, and `RETRY` are actions rather than prose;
- text above the document separator is the page header;
- commands and engine identifiers are displayed uppercase without changing
  their semantic identifiers;
- the accidentally embedded project instruction and duplicated introduction
  are omitted;
- required glyphs, including `™`, are native bitmap glyphs.

The approved document ends when Fluxball loads. Fluxball and Quarry pages must
remain literally `PLACEHOLDER` until separately approved copy replaces them.
Do not smooth, infer, or invent missing prose.

## Graph order

1. Introductory terminal pages.
2. Qong introduction/tutorial, game, outcome branch, and debrief.
3. SkiPixl feasible course, response, overloaded introduction, overloaded
   course, distinct result, and shared debrief.
4. Quantman Hold, outcome branch, and explanation pages.
5. Fluxball 2P Global with placeholder pages.
6. Fluxball 2P Individual with placeholder pages.
7. Quarry with placeholder pages.
8. Completion.

Qong and Quantman distinguish the first loss from later losses. A first loss
requires Retry. Later losses offer Retry and Continue. SkiPixl progression may
continue after a failed descent, but the transcript-clear gate still requires a
successful finish. Fluxball and Quarry loss placeholders offer Retry and
Continue as specified.

## Node and action semantics

The graph is data, not a chain of UI callbacks. Node kinds are terminal page,
loading transition, placeholder, game launch, outcome branch, and completion.
Every outgoing node ID is validated.

For a Story page:

1. the header types;
2. the top rule appears;
3. body paragraphs type in order;
4. the action appears on the left below the final text unit with a continuously flashing block;
5. text and action remain inside the outer frame, without a redundant inner bottom rule.

Pressing the action key during typing completes the page. Only a later press
advances. Reduced Motion renders the full page immediately and shows a steady
block. Semantic DOM contains the complete page and action labels, but the live
region never announces individual characters.

The current node is persisted before each transition. Reloading therefore
returns to a coherent page and cannot replay a finished game merely to rebuild
presentation state.

## Terminal archive

The main-menu `TERMINAL` contains five programs: Qong, SkiPixl, Quantman,
Fluxball, and Quarry.

- A chapter is experienced when any of its Story stages launches.
- Its transcript unlocks only when every required stage is cleared: one Qong
  win; both SkiPixl finishes; Quantman Hold clear; both 2P Fluxball wins; or the
  Quarry Story win.
- An experienced but uncleared chapter launches a fresh retry at its earliest
  uncleared stage.
- A Terminal retry does not rewind or advance the main Story cursor.
- Opening a transcript records only that it was seen.

Story has no leaderboard. Arcade score records cannot write Story state.

## Evidence and migration

Each cleared stage retains the exact qualified `RunContext`, including selected
hardware bank/fixture, topology or state identity, seed, rules version, and
immutable provenance. Save-v6 separately records experience, clear, transcript,
attempt, current-node, and last-outcome state.

Migration accepts v1–v5 saves. It preserves proven wins and exact evidence,
maps successful SkiPixl receipts, leaves obsolete Quantman Invert and old 4P
Fluxball evidence as history, and resumes at the earliest unfinished current
stage. It never creates a win from a mere attempt.
