# Quantum Box browser

An isolated Phaser/TypeScript/Vite implementation of the **Quantum Box** early-1970s browser-game anthology. This package does not replace or mutate the standalone Fluxball, Quantum Blur, Quantum Royale, or Quantum Rat Race prototypes.

## Current phase

The shipped anthology uses the three-colour `320×180` Brown Box display and five
visible Story chapters: Qong, SkiPixl, Fluxball, Quantman, and Quarry. Those
chapters contain eight ordered stages: Qong; SkiPixl Medium and Hard; Fluxball
2P Global and 4P Individual; Quantman Stabilize Gaze and Inverse Gaze; and
Quarry.

The Designer is an experimenter who was given an opaque key and access to MOTH.
He did not invent MOTH or its engines. Qong establishes the reference grammar:
its exact completed court remains visible while both paddles transform in
place, the Designer opens a doorway in that court, and the player walks through
it into a furnished top-down office before sitting at the computer. Later
chapters must preserve the same game-world-to-office spatial continuity rather
than substitute explanatory slides. Each terminal explanation preserves
three separate layers: the submitted input, the returned artifact or result,
and the local rule that maps that result into play. Mid-chapter interludes
launch the harder companion stage directly; completed chapters return to the
menu. A pending interlude beat is persisted before presentation begins so
leaving the sequence never forces the player to repeat a cleared game.

The runtime consumes immutable, manifest-driven pixel assets. The selected
20×20 professor source is preserved byte-for-byte, while deterministic local
pixel operations add his pipe, walk/talk poses, and source-locked morph strips.
These are local presentation derivatives, not QPixl or provider output. Menus,
controls, cabinet HUDs, and dialogue retain accessible semantic DOM mirrors.
The photographic title scene remains the sole exception to the internal
three-colour display contract.

Settings can select among six provenance-labelled Brown Box background
programs while `STANDARD` remains the default. Those programs preserve the
recorded distinction among QPixl-returned keyframes, local propagation,
amplified local composition, and deterministic seeded assignment. None is
described as a provider-rendered whole screen, and changing a background never
changes game state.

Arcade exposes the shipped cabinets independently of Story. SkiPixl and both
Quantman modes maintain local top-five scoreboards; Story, QA, abandoned runs,
and internal replay never write entries. Quantman exposes seven distinct
10×10 authored maze courses backed by eight validated 100-bit Moth Labyrinth
returns from IBM Fez. The original course has two independent hardware
captures; Maps 01–06 have one each. Arcade scores are separated by course,
while Story traverses successive courses without a maze-selection screen.
Quarry selects one of 24 recorded 12-qubit IBM Fez QGraph returns per run—four
hardware realizations for each of six relational recipes. Fluxball uses its
distinct bank of 40 recorded IBM Fez QGraph distributions.

All timed play is provider-free. Moth and IBM credentials, requests, polling,
and retries remain outside the public browser. The promoted Qong, QPixl,
Fluxball, Quantman, and Quarry records are selected and frozen before play.

## Run

Requires Node 24+ and pnpm 10+.

```bash
pnpm install
pnpm dev
```

Open <http://127.0.0.1:4390>. The `dev` script owns that strict integration
port; a process already using it is an error rather than permission to fall
back to another port.

## GitHub Pages release

The repository includes a GitHub Actions release gate at
`.github/workflows/deploy-pages.yml`. A push to the remote `main` branch, or a
manual workflow dispatch, installs the pinned JavaScript and Python audit
toolchains, runs `pnpm check`, executes the Playwright browser journeys on
Chromium, and deploys only the verified `dist/` artifact. The workflow does not
need or accept Moth or IBM credentials.

Before the first deployment, set the repository's **Settings → Pages → Source**
to **GitHub Actions**. The Vite build uses relative asset URLs, so the same
artifact works at a project URL such as
`https://<owner>.github.io/<repository>/` without hard-coding the eventual
repository name.

Run the Pages artifact check independently after a build with:

```bash
pnpm build
pnpm check:pages
```

That check verifies that the entry document has no root-relative deployment
paths, every local entry reference exists, the artifact contains no links, and
the published payload remains inside GitHub's size limits. The separate
`scan:artifact` command remains responsible for credential, private-path,
source-map, signed-URL, and retired-cabinet checks.

The public source snapshot is produced from a reviewed commit with `git
archive`. Export attributes omit private QA history, operator-only acquisition
notes, and retired implementation files. `pnpm scan:source` verifies that the
export contains no private local paths, credential material, source maps,
backup files, or retired runtime assets. Quantum Box itself has no open-source
licence in this release.

The built site includes `THIRD_PARTY_NOTICES.txt` for its bundled MIT and
BSD-3-Clause dependencies. That notice does not assign a licence to Quantum
Box's own code, writing, audio, or visual assets.

Run the full local checks, including mocked Moth lifecycle and adapter tests,
the 228-frame native Brown Box background audit, and Playwright test
collection:

```bash
pnpm check
```

`pnpm check` proves that the Playwright suite can be collected; it does not
claim that Chromium executed. In the current managed Mac environment, native
Chromium launch is separately blocked at `MachPortRendezvousServer` before any
product assertion, so served in-app-browser QA remains separate evidence.

The background audit can also be run independently. It validates the four
installed endpoint hashes, exact two-brown RGB palette, native `320×180`
dimensions, and every hard-crop frame in the 22.8-second loop without emitting
a visual derivative:

```bash
pnpm audit:visual
```

The canonical asset audit independently pins both manifests; reopens all 26
source files and verifies their current bytes, dimensions, and image modes; and
checks all 45 runtime PNGs and 98 frame records for exact hashes, dimensions,
three-colour palette, binary alpha, transparent-pixel hygiene, anchors, and
manifest coverage:

```bash
pnpm audit:assets
```

The production build is also scanned for credentials, signed URLs, private paths, and source maps:

```bash
pnpm scan:artifact
```

The installed Qong, QPixl, Fluxball, Quantman, and Quarry packs are immutable,
credential-free runtime records. Acquisition ledgers and operator procedures
are intentionally outside the public snapshot. The browser cannot submit,
poll, retry, or purchase a provider job.

## Non-negotiable runtime boundary

- The public browser never contains a Moth credential.
- A complete validated committed pack and browser run seed are frozen before timed play.
- No Moth request, polling, retry, fallback, or result processing occurs during a timed game.
- Qong Story consumes four seven-result play packs plus forty-four ordered selector bits. Two selector bits choose one play pack locally for each attempt, providing twenty-two selections before the recorded sequence cycles.
- SkiPixl consumes three pre-acquired 20×20 QPixl source/result pairs per descent and runs its residual decoder and all gameplay locally.
- Story progression and chapter formula unlocks cannot be advanced from Arcade.
- CPU agents receive only typed public observations and their own belief state.
- Existing local/Aer fixtures remain regression controls.
- Deterministic replay artifacts remain an internal QA and evidence-reconstruction
  mechanism; player-facing completion controls start a fresh `RETRY` run.
- `quantum-box/save-v5` stores settings, versioned Arcade records, explicit
  Story stages, pending presentation beats, and source-specific recovery
  evidence. Legacy migration never invents provider or completion evidence.
- Story debrief presentation cannot manufacture a qualified run. It begins only
  after the corresponding gameplay evidence has been stored.
- `PREPARE MATCH` is represented only by a disabled interface; the static build cannot contact a provider or hold a credential.

See `docs/architecture.md`, `docs/acceptance-matrix.md`, `docs/design-system-v1.md`, `docs/design/qong-unresolved-rule-state.md`, `docs/critical-play-trace.md`, `docs/visual-reference-contract.md`, and `docs/source-lineage.md`.

Human comprehension and feel studies remain useful future research, but they
are not release or completion gates for this integration pass. The active
machine acceptance contract is `docs/acceptance-matrix.md`.
