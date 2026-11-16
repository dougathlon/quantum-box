# Terminal Story contract

The Story is a deterministic demonstration authored by an unseen Designer
through the Quantum Box terminal. Production contains no physical Designer or
player avatar, morph, office, den, door, walk-around room, or Workshop scene.

## Copy authority

`src/story/terminal/text-notes-provenance.json` records the approved document
filename, source SHA-256, allowed normalization, and a hash of the complete
runtime page corpus. The approved corpus covers the complete demonstration and
the separately supplied Postscript:

- wording, punctuation, paragraph order, and page divisions are fixed;
- editorial labels and routing instructions are not player copy;
- `CONTINUE`, `PLAY`, and `RETRY` are actions rather than prose;
- text above the document separator is the page header;
- commands and engine identifiers are displayed uppercase without changing
  their semantic identifiers;
- the accidentally embedded project instruction and duplicated introduction
  are omitted;
- required glyphs, including `™`, are native bitmap glyphs.

The complete Fluxball and Quarry prose is approved. The 2026-11-10 release
objective changed one Postscript body sentence: `YOU BEAT THE DEMO.` became
`YOU REACHED THE END OF THE DEMO.` The 2026-11-15 corrections add a distinct
feasible SkiPixl success page, revise its failure invitation and Quantman's
outcome responses, and remove two redundant Split tutorial paragraphs. The copy
provenance records these explicit exceptions. Do not smooth, infer, or invent
replacement prose.

## Graph order

1. Introductory terminal pages.
2. Qong introduction/tutorial, game, outcome branch, and debrief.
3. SkiPixl feasible course, response, overloaded introduction, overloaded
   course, distinct result, and shared debrief.
4. Quantman Hold, outcome branch, and explanation pages.
5. Fluxball 2P Global, outcome and explanation.
6. Fluxball 2P Individual, outcome and explanation.
7. Quarry, outcome and explanation.
8. Closing sequence, both Postscript pages, and completion.

Every successful outcome offers Continue only. Qong and Quantman require Retry
after the first completed loss in a main Story playthrough; later losses offer
Retry and Continue. Both SkiPixl courses, both Fluxball stages and Quarry offer
Retry and Continue after their first loss. Launching or abandoning an attempt
does not count as a completed loss. New Story resets first-loss routing while
preserving earned results. Retry launches a fresh run; Continue follows the
authored narrative. Feasible SkiPixl has one outcome choice before its common
explanation, which offers Continue only. Reaching the ending opens both
Postscript pages without requiring wins. Continuing after a loss never records
a clear.

Before the narrator response, every cabinet displays its final outcome with
navigable result choices. Continue Story (or completed Back) then opens that
response; Retry belongs to the narrator page. Final-result input is ignored for
600 ms so a last gameplay press cannot dismiss the outcome immediately. Held
transition inputs still require release. X is not a hidden retry/exit shortcut
while the shared pause/result menu is active. Arcade retains Play Again,
qualifying score entry, and Quantman's Next Maze route.

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
- A chapter offers Read only when every required stage is cleared. Its transcript
  follows the complete authored success sequence, without replaying games or
  mixing failure responses into success. Quarry's transcript includes the ending
  and both Postscript pages.
- An experienced but uncleared chapter offers Retry only. It begins with the
  authored introductory text for its earliest uncleared stage, including only
  the second SkiPixl course or Split Fluxball when the first stage is cleared.
- A Terminal retry does not rewind or advance the main Story cursor.
- Genuine wins earned through Terminal count toward the same Story clears and
  retain the same qualified run evidence. Terminal failures do not change the
  main Story playthrough's first-loss state.
- Opening a transcript records only that it was seen.

Story has no leaderboard. Arcade score records cannot write Story state.

## Evidence and migration

Each cleared stage retains the exact qualified `RunContext`, including selected
hardware bank/fixture, topology or state identity, seed, rules version, and
immutable provenance. Save-v6 separately records experience, clear, read-page
history, transcript-seen, attempt, current-node, and last-outcome state.

Migration accepts v1–v5 saves. It preserves proven wins and exact evidence,
maps successful SkiPixl receipts, leaves obsolete Quantman Invert and old 4P
Fluxball evidence as history, and resumes at the earliest unfinished current
stage. It never creates a win from a mere attempt. Existing v6 saves without a
read-page ledger recover only pages unavoidable before their saved cursor;
ambiguous outcome branches remain unread. Completed saves that missed the
Postscript resume there without a reset or replay of the games.
