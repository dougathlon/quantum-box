# Audio contract

Audio is local presentation state. It never changes simulation, replay,
hardware provenance, or Story authority.

## Route map

| Cue ID          | Surface                                                              | Shipping asset                   |
| --------------- | -------------------------------------------------------------------- | -------------------------------- |
| `cabinet-hum`   | Title/start screen                                                   | `cabinet-hum-loop.wav`           |
| `key-is-opaque` | Home, Arcade, trial sheets, scores, Settings, Source, Terminal index | `key-is-opaque-backing-loop.wav` |
| `spare-key`     | Active Story terminal pages and opened Terminal transcripts          | `spare-key-loop.wav`             |
| none            | Active games, gameplay pauses, and gameplay results                  | effects only                     |

The exact cue hashes are:

- cabinet hum: `f9b1a71687987ba08b6f4009673addc280c57e96b4e15c9f718594279873f01b`;
- menu backing loop: `feff452edce713f945139fae58469798b8d13aa1783e4683281688bfb7d43d02`;
- terminal loop: `419e6ecb5bceeec1615b7a2843d2a9389f914f6399422304445f45d04d825a3a`.

The title and terminal files are approved local compositions. The menu loop is
a local frame-exact derivative of the approved lead-free reference render.
None is QPU audio.

## Menu-loop derivation

`src/audio/assets/key-is-opaque-backing-loop.provenance.json` is the authority.
The immutable source render has SHA-256
`76d5f660b125e61c7e67b212ab7b0a9a2a38c23266f8398e88b6ef3ed73526a8`;
its adjacent manifest hashes to
`74482386773bda1873a003f663c9da7dfa547504d2e051cd8468ffc0d3d8b4c4`.

The shipping derivative retains bass, inner, and drum roles, excludes lead,
uses quarter-beats 8–40 at 112 BPM, and preserves master gain
`2.1910490466318087`. At 44.1 kHz stereo it contains exactly 756,000 frames and
lasts 17.142857 seconds. Boundary frames are zero. The source render is not
overwritten.

Recreate or verify it with `scripts/derive_menu_backing_loop.py`; do not use a
whole-file wrap, the lead-bearing core loop, the old Fluxball music, or an
experimental fragmentation variant.

## Transport rules

`SynthAudio` owns exactly one native `<audio>` background element at a time.

- Re-requesting the current cue is a no-op and preserves playback position.
- A route change fades the old cue out before the next cue starts and fades in.
- A generation token invalidates stale asynchronous `play()` completions.
- A rejected autoplay attempt remains pending until the next valid gesture.
- Start unlocks audio and enters the home screen in one action.
- Hiding a tab preserves position; visibility restoration resumes the newest
  requested cue, not a stale one.
- Mute and volume changes adjust gain without restarting transport.
- A game route explicitly requests no background cue.

Web Audio oscillator/noise voices remain effects. Long-lived effects such as
SkiPixl carve noise must be stopped on pause, result, route exit, and disposal.

## Verification

Unit tests cover one-cue ownership, same-cue no-op, transition order, rejected
autoplay recovery, mute/volume stability, visibility changes, and stale promise
guards. Hash/frame audits cover exact files and loop boundaries.

Human listening is separate. Release review should hear at least three complete
repetitions of each cue through route changes and tab suspension. A waveform
test cannot establish that a seam is inaudible or that a mix is appropriate.
