# Quantum Box acceptance matrix

**Candidate date:** 2026-09-09

**Authority:** current release contract and executable implementation

| ID         | Requirement                                                                                                                    | Evidence required                                                                        | Status before publication |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------- |
| SHELL-01   | Title and every game surface use one native `320×180` integer raster; title includes `QUANTUM BOX` and `PRESS START`.          | Raster/unit audits plus served native and 1280×720 inspection                            | Implemented               |
| SHELL-02   | Home is Story, Arcade, Terminal, Settings; Story has no chapter menu; Enclose and Workshop are absent.                         | DOM, navigation, bundle, and public-source scans                                         | Implemented               |
| STORY-01   | Exact approved copy runs through Quantman; late Story uses literal placeholders; all success/failure/reload paths resolve.     | Source/corpus hashes, graph tests, and fresh-save browser traversal                      | Implemented               |
| STORY-02   | Transcript gates use proven clears; Terminal retries do not move the main Story cursor.                                        | Save/Story unit tests and reload browser trace                                           | Implemented               |
| SAVE-01    | Save-v6 preserves settings, scores, hardware evidence, and legacy v1–v5 hashes without inventing completion.                   | Boundary migration fixtures and export/import tests                                      | Implemented               |
| AUDIO-01   | One route cue at a time; same-cue no-op; fades ordered; autoplay/tab/mute behavior stable; games effects-only.                 | Transport unit tests, audio-element browser state, and human three-loop listening        | Human listening pending   |
| SKI-01     | Every mode uses 60 seconds; Down accelerates 72→92 at 36 units/s² and releases at 18 units/s²; replay remains deterministic.   | Rules/receipt tests, policy sweep, and all-mode browser exercise                         | Implemented               |
| FLUX-01    | Every format uses four 40-second rounds; CPU uses public information; held-ball/steal/physical-goal paths work.                | Deterministic session, hidden-rule, goal, possession, and CPU fixtures plus browser play | Browser feel pending      |
| QUANT-01   | Seven topologies/eight captures remain hardware authority; no maze menu; Story has no score; Arcade records course identity.   | Bank, selection, persistence, score, and network-boundary tests                          | Implemented               |
| QUARRY-01  | All 24 jobs remain reachable; caught ducks respawn with grace while scheduled relations persist.                               | Bank reachability, knockout/respawn, timing, replay, and regression tests                | Implemented               |
| RELEASE-01 | Formatting, docs, types, unit/compiler tests, audits, build, artifact scan, and browser collection pass on one commit.         | Exact `pnpm check` transcript                                                            | Pending final commit      |
| RELEASE-02 | Executed browser journeys are distinguished from collection and host-policy failures.                                          | Direct served-browser record and Linux workflow                                          | Pending                   |
| RELEASE-03 | Sanitized public `main` deploys at the stable Pages URL and survives hard refresh with assets, audio, controls, and migration. | Public-source scan, Actions result, asset requests, and direct live trace                | Pending                   |

## Evidence categories

Automated checks, browser execution, complete fresh-save Story traversal,
deployment verification, and human visual/listening acceptance are reported
separately. One category cannot be used as shorthand for another.

## Non-gating audience research

After release, ask whether unfamiliar players understand the terminal's terms,
develop useful hypotheses about the rule/terrain/maze/relation systems, and find
the CPU and difficulty curves fair. These observations can drive later changes;
their absence does not convert deterministic or provenance checks into failure.
