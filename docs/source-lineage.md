# Source lineage and preservation boundaries

**Recorded:** 2026-08-23; demo-release source cutoff revised 2026-09-06.
See `demo-release-contract.md` for the current player-flow and publication
contract; older QA notes remain historical observations.

## Visual references

The six recovered direction files remain read-only under
`drafts/visual-development/quantum-box/`:

| Role              | File                                                     | SHA-256                                                            |
| ----------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| Physical title    | `quantum-box-title-screen-early-color-tv-v2-formica.png` | `ebf5084d1666d20c910a5cda86965b5c3f049776136f300f0e9529a143eb83e6` |
| Internal library  | `quantum-box-library-menu-early-color-tv-v2-qong.png`    | `1670115ed6e1958809996aae2660903bd1d6caab4d3b28684c7621e13f07f034` |
| SkiPixl direction | `blur-slalom-early-color-tv-mockup-v1.png`               | `48a0814e3158b4eccb1d7def5ed2453071869fad5173f88d03b4dc4e3017c548` |
| Optional driving  | `blur-driving-completion-safe-mockup-v1.png`             | `342ebdfdb1bcd2d1ae8694d56a1520be85996e6a66c2ca9587c02a01849a3ec7` |
| Fluxball          | `fluxball-early-color-tv-restyle-v3.png`                 | `10a3076e8e1ec5a4d2f267ed41c9ffb36fcc151fad9013654335a90a3c9efcf4` |
| Quantman          | `labyrinth-maze-chase-early-color-tv-mockup-v1.png`      | `845145fb89c9f894c5794a9400a4218205ef00a392d0ff130d84cd668d783adc` |

The physical title source is shipped through the decomposed layers in
`src/assets/brown-box/`: `title-formica-device.png`,
`title-b3-s3-screen-layer.png`, and `title-sharp-local-layer.png`. The RGB
values in `title-b3-s3-screen-layer.png` are not rendered; its reviewed
binary-alpha silhouette is used only as the photographed CRT mask.
`BrownBoxTitleField` maps the same four native 320 × 180 endpoints and the same
hard 22.8-second replacement schedule used by the internal display into that
mask. The title CRT is a cropped window onto that field at the internal
foreground's exact integer pixel scale; it does not resize the complete field
to fit the photographed screen. No title-only field derivative, enlarged-cell
substitute, provider return, or new hardware result is introduced. This
photographic room/device composition is the sole approved exception to the
internal three-colour display. The other five files are historical design
references, not production sprites or evidence that the games exist.

The reviewed source package is
`drafts/visual-development/quantum-box/core-asset-language-v1/`; the immutable
shipping authority is `src/assets/canonical-runtime-assets-v2/`.
`visual-reference-contract.md` records the binding transfer and anti-drift
rules. The driving image is retained only as an optional future Arcade
direction; the confirmed Story game is skiing.

## Canonical runtime asset handoff

The visual branch imported the approved selections as a manifest-driven,
read-only package. Its two manifest files are pinned as follows:

| Manifest                                                     | SHA-256                                                            |
| ------------------------------------------------------------ | ------------------------------------------------------------------ |
| `canonical-runtime-assets-v2/manifests/source-manifest.json` | `ba0ff61d315690adcdac094ff4b810f411a01be1f30810b6b0d660c4c5c958d5` |
| `canonical-runtime-assets-v2/manifests/runtime-handoff.json` | `469b9474866522f919a57b18df30e7c06c272ed0e27cbe8198ec513fb16c3638` |

The source manifest records 26 immutable inputs. The runtime handoff covers all
45 PNGs under its `assets/` tree and 98 ordered frame records. Its contract is
native `320×180`, integer nearest-neighbour scaling, binary alpha only, and the
exact palette `#2B1C14`, `#564330`, and `#D6BD8B` (plus fully transparent
pixels in the sprite files). The audit rejects unmanifested files, hash drift,
hidden RGB beneath transparency, fractional anchors, missing lineage, and any
off-palette pixel.

The older true-morph strips `qong-paddle-to-wizard`,
`fluxball-player-a-to-wizard`, and `quantman-ghost-c-to-wizard` remain preserved
inside this immutable v2 package. They are historical runtime sources, not the
canonical Story v2 Designer presentation.

## Designer Professor v1

Story v2 uses the exact user-selected source
`drafts/visual-development/quantum-box/core-asset-language-v1/assets/designer-candidate-professor-20x20.png`,
SHA-256
`68329f1f921110b76151f5d3fe8eaf02c234518c9c6ac11e64bcbb48d3ecf745`.
The source is copied byte-for-byte to
`src/assets/designer-professor/assets/professor-source-locked-20x20.png` and is
never overwritten.

The deterministic local generator adds spectacles and a pipe, alternating
walk and talk poses, pointing and door-opening poses, and four seven-frame
Manhattan signed-distance morph strips:

- Qong paddle to professor;
- Qong paddle to walking Player C;
- Quantman Ghost C to professor;
- current crested Quarry Duck D frame to professor.

The package uses only `#2B1C14`, `#564330`, `#D6BD8B`, and fully transparent
pixels; alpha is binary and runtime scaling is integer nearest-neighbour. These
are local presentation derivatives, not QPixl output, QPU output, or evidence
of a provider operation. Its pinned manifests are:

| Manifest                                                 | SHA-256                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------ |
| `designer-professor/manifests/source-manifest.json`      | `a9ff3bcc28cbb87d8ce36d949c755a748b146db399dc5dce19fcca32d4ffaea9` |
| `designer-professor/manifests/morph-descriptors-v1.json` | `50595463b981fd6f8f00cf5a33341059bd5003acb6784ffb6ab7448df0edef25` |
| `designer-professor/manifests/runtime-handoff.json`      | `33c199f294e60b222f8b956da86ea10abed7efac5f14f097199dfd12474cce9c` |

The morph audit checks both endpoints against the currently pinned sources.
If the Quarry Duck D runtime frame changes, its morph must be deliberately
regenerated and re-reviewed; it may not silently retain an obsolete endpoint.

The canonical Designer fiction is **DRAFTED PROSE**, not evidence about MOTH:
he is an experimenter who was given an opaque key and access to MOTH, not the
inventor of the platform or its engines. His terminal must bind its narration
to the completed run and keep `INPUT`, `RETURN`, and `GAME MAPPING` distinct.
Where there is no provider return, the `RETURN` layer is explicitly absent or
non-authoritative rather than filled by fiction.

Story v2 terminal source status is fixed as follows:

| Chapter  | Gameplay authority                                                                                                  | Non-authoritative comparison                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Qong     | recorded Moth one-shot QPU pack                                                                                     | none                                                         |
| SkiPixl  | recorded platform-captured QPixl IBM Fez fields                                                                     | none                                                         |
| Fluxball | forty recorded Moth QGraph IBM Fez distributions                                                                    | labelled local/Aer fallback controls                         |
| Quantman | eight independent 10×10/100-bit Moth Labyrinth IBM Fez distributions grouped beneath seven authored maze topologies | authored topologies, admissibility filter, and local decoder |
| Quarry   | one of 24 recorded 12-qubit Moth QGraph IBM Fez distributions                                                       | separate Fluxball 40-return bank as comparison               |

Every terminal page records `activePlayNetwork: none`. Presentation never
changes the authority of the underlying evidence.

## Fluxball

Source: sibling package `prototypes/fluxball-browser/`, inspected 2026-08-23.

- Preserve its local/Aer fixture bytes and published behavior.
- Two-player gameplay uses a fitted two-qubit A/B relation.
- The active four-player hybrid fixture uses complete A/B/C/D joint counts for play; pairwise edge fits are explanatory only.
- Exactly three deterministic browser draws instantiate ACTION, INTERACTION, and PURPOSE per round.
- The standalone CPU receives hidden rules. The anthology must replace that privilege only within its isolated implementation.

The anthology retains exact local copies of the two fixture controls:

| Scientific path                         | File                                                                        | SHA-256                                                            |
| --------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Two-player pairwise tomography          | `src/games/fluxball/standalone/data/fluxball-aer-v1.json`                   | `af91a70fc633ef4808e658268309ad67d7b808b1d10d77e5e36fcf35090feedb` |
| Four-player hybrid joint-count gameplay | `src/games/fluxball/standalone/data/fluxball-aer-four-qubit-hybrid-v1.json` | `ba9afa9d257d9a2f6e11d1b23cb3a21bf1a10f87e2c9ea6d54cde92873fe0db3` |

Tests compare those bytes against the standalone files and compare the copied rule sampler, interpreter, scoring, RNG, fixture catalog, and fixture resolver source byte-for-byte. Current Fluxball v4 uses 1,200 fixed 20 Hz ticks/60 seconds in every format; retained v2/v3 recovery evidence preserves the earlier 2P 800-tick/40-second and 4P 1,200-tick/60-second contract. Story fixes 2P as Global and 4P as Individual. The separate anthology CPU receives only a public sport projection.

Fluxball's clean runtime figures and ball are local sprite derivatives admitted
through `canonical-runtime-assets-v2`; they do not alter or replace the two
scientific fixture controls above. The visual manifest and copied simulation
sources therefore have separate hashes and separate authority.

The current gameplay-preferred bank is
`src/games/fluxball/data/fluxball-qgraph-rule-bank-v1.json`, byte SHA-256
`e5564fcb5d229c766505fa4e8db5965945afeec214119517bc30c109187d4f45`,
bank ID `fluxball-qgraph-qpu-bank-v2`. It contains forty committed Moth
`graph-v1` QPU results from `ibm_fez`: sixteen two-player and twenty-four
four-player distributions, with their Moth and IBM job identities, raw-result
hashes, submitted operations, coupling maps, measurements, and evidence paths.
The browser samples these stored computational-basis distributions locally and
makes no request during active play. The earlier local/Aer fixtures remain
labelled fallback and regression controls; they are not relabelled as hardware.

## Brown Box field and SkiPixl QPixl bank

The runtime field at
`src/assets/brown-box/qrt-state-1-background-320x180.png` has SHA-256
`42b8e24696a46d41695712d97bb49b1ad74befce1d4d6a07c54dc2f2c98be3f1`.
It is byte-identical to
`drafts/visual-development/quantum-box/qpixl-visual-redesign-v1/hardware/brown-box-background-and-assets-v1/review/qrt-two-color-original-programme-v1/original-hybrid-programme-fixed-two-color-state-1-background-320x180.png`.
`src/display/BrownBoxField.ts` points to that programme's `provenance.json` and
classifies the field as the approved state-1 endpoint assembled from authentic
IBM Fez QPixl B2/B3/B4 returns under a local fixed-midpoint mapping to dark
tobacco `#2B1C14` and muted tan `#564330`. The two-colour mapping and full-screen
assembly are local presentation operations, not additional provider output.
The assembled field is not a whole-screen hardware render and supplies no
gameplay authority.

As of 2026-09-01, `src/display/BrownBoxViewportField.ts` is the sole internal
substrate renderer, and `src/display/BrownBoxTitleField.ts` presents the same
field programme inside the physical title CRT. The exact centred 320 × 180
endpoint remains unmodified. On a non-16:9 internal viewport, the internal
renderer extends only the surrounding area by cropping and deterministically
reordering exact 20 × 20 panels from each corresponding endpoint at the same
integer pixel scale. The four source PNGs, hashes, state order, timing, and hard
replacement boundary are shared with the title. The title mask and viewport
extension are local presentation geometry, not new QPixl jobs, provider
returns, or gameplay evidence. Phaser renders only transparent-backed cream
foreground geometry above the field.

SkiPixl installs `src/games/skipixl/data/qpixl-b3-segments-v1.json`, current byte
SHA-256
`e6465b573bf5fdb0976a25373a73f05bb73b976fd94bfdb6f314e58ae362ba5f`.
The record declares bank `qpixl-b3-segment-bank-v1`, canonical bank-content
hash `f09d509dd4f6980c0ac5146466e32c736f0688d13156334216720fa52dc8bffb`,
engine `qpixl-v1`, QPU mode, IBM Fez backend, and provider-UI payload capture
rather than HTTP response-body download. It contains twenty source/result pairs
and twenty distinct three-segment schedules.

The current derived catalog is
`src/games/skipixl/data/skipixl-residual-cuts-v7.json`, byte SHA-256
`d994544726c410b30d6e52f8e43b184dd7f4b0215a45e00f71dab93e8bc678bc`.
Decoder `skipixl-triplet-residual-slalom-v7` computes all 1,200 absolute
source-to-return residuals in a selected three-segment schedule, then applies
nested triplet-local cuts P90, P84, and P78. They select exactly 120, 192, and
264–265 cells for Easy, Medium, and Hard, retaining exact threshold ties. Residual sign selects tree or mogul;
neighboring residuals deterministically stagger each selected cell's horizontal
and downhill placement. Medium and Hard derive eight and twelve gates from
selected QPixl obstacle anchors; Easy is gate-free and compresses row spacing.
The v4/v5/v6 catalogs and the earlier single-P72 catalog remain legacy
validation inputs, not current course authority.

Those captures originated in the visual-study programme; they are not relabelled
as purpose-built skiing jobs. SkiPixl's contribution is the explicit classical
residual/cut decoder, staggering, gates, timing, and course schedule over the
preserved records. P90/P84/P78 are local views of one triplet, not separate
provider runs. No Moth or IBM request occurs during play.

## Excluded Quantum Blur

Source: sibling package `prototypes/quantum-blur-browser/`, inspected 2026-08-23.

Its browser worker is a deterministic local statevector transform. It uses no Moth service, shots, or QPU. For _Quantum Box_ it is explicitly excluded: its code, parameters, benchmarks, and outputs may not be used for assets, aesthetic or level decisions, current-engine evaluation, contract inference, or evidence of Moth or QuantumBlur behavior. It may be inspected only to identify its provenance and prevent accidental reuse. Only an explicit later instruction from Doug may reverse this decision.

The former synthetic Skiblur/Blur course packs are not part of the current runtime. Legacy save migration recognizes the old `skiblur` identifier only to preserve existing users' progression.

## Labyrinth and Quantman

The played Quantman corpus is
`src/games/quantmanSynthetic/data/quantman-labyrinth-ibm-fez-bank-v3.json`,
canonical bank SHA-256
`8168c10dc1e8b001d0e0e6c7489cb96e145bd13b42b24875d8828a0a93c52ab1`.
It preserves eight separately identified 4,096-shot IBM Fez distributions
under seven topology records. `ORIGINAL` owns the original canary and the
independent known-good serial control. `MAP 01` through `MAP 06` each own one
successful serial capture of a distinct authored topology. The failed
twelve-job bulk campaign has no fixture or authority record in this bank.

The v1 and v2 bank files remain unreferenced preservation sources rather than
parallel runtime banks. Existing fixture bytes, IDs, content hashes, records,
and provenance are included in v3 unchanged. Capture metadata and admissibility
indexes remain separate authority records, while topology records bind one or
more captures to the normalized 99-corridor authored input. Extending an
existing topology therefore adds a realization without inventing a level;
adding a distinct validated authored topology adds one course without changing
the selector architecture.

| Course     | Successful capture target(s)                         | Topology SHA-256                                                   |
| ---------- | ---------------------------------------------------- | ------------------------------------------------------------------ |
| `ORIGINAL` | `quantman-10x10-r1`; `quantman-known-good-serial-r1` | `0d63ffbd489385cebb77300a61b47b4ca6029a96260e826209bb0b322ae0faee` |
| `MAP 01`   | `quantman-map-01-serial-r1`                          | `5e22a8a28d53610c597b9b5d467450ff38570ebd9f76b815b0f5194b29b45ea5` |
| `MAP 02`   | `quantman-map-02-serial-r1`                          | `3279fe77c918070a34c7f2b8755b5791bbc21ba72cb11c885d221ae33f6b59d0` |
| `MAP 03`   | `quantman-map-03-serial-r1`                          | `637f6688b466b68f0656e52767dd1657e237f308c6b04825c1a675ee009f1146` |
| `MAP 04`   | `quantman-map-04-serial-r1`                          | `e421bfa62d79e77ee7a31ad92839b314bb3b491d51d83fe0c9b0adc7d0b431a5` |
| `MAP 05`   | `quantman-map-05-serial-r1`                          | `aea2e219b5ee160a64918796aa671692302773f4adadb5313850d993e001f3bb` |
| `MAP 06`   | `quantman-map-06-serial-r1`                          | `b9d38a32b842c06ea912ee1b58e9c931e96f9d16ec179fda668693895806b040` |

The authored corridor order is not semantic. The compiler and acquisition
validator normalize every corridor as an undirected edge before comparison.
That correction reconciled Map 01's preserved provider bytes after its initial
local `validation-rejected` state; it did not modify a returned bit, edge, or
wall.

The release compiler retains each complete source distribution and derives a
separate `quantman-demo-playability-v1` admissible-state index without changing
a returned bit. Each admitted state must give room 95 a component of at least
12 rooms containing a wall-pass pickup; give ghost-release room 35 a component
of at least four rooms; leave no more than ten of the 96 playable rooms
isolated; and contain both open and closed measured playable edges. The fixed
side tunnel participates in connectivity but is not called a measured wall.
The admitted ensemble must cover all 96 playable rooms and vary all 168
non-ghost-home grid edges. The eight captures admit 457, 484, 545, 485, 523,
482, 462, and 506 intact states respectively. All excluded states remain
byte-for-byte present in their fixture.

At run start, the deterministic local selector first chooses or receives a
topology, then chooses a runtime-eligible capture belonging to it, then samples
proportionally from that capture's original weights conditioned on its explicit
admissibility index.
Equal endpoint bits open a passage and unequal endpoint bits close it.
`STABILIZE GAZE` and `INVERSE GAZE` modify the local selection constraint.
Story advances through distinct topologies in stable order without exposing a
selector and persists both topology and capture identity. Arcade uses the same
automatic course rotation rather than exposing a course menu; its score cohorts
remain indexed by mechanic and topology, while exact capture identity stays in
run provenance. Ghosts, movement, collision, scoring, replay, filtering, and
rendering remain local game code. Neither Story nor Arcade performs provider
traffic.

The earlier local synthetic 100-bit control and 4×5 Moth remote-Aer preview
remain in source and tests as historical/recovery artifacts. They are not
production gameplay authority and do not appear as the active player-facing
source classification.

## Quarry

New player-facing, run, and Story identity is `quarry`. The old `quag` name is
retained only for compatibility with existing Arcade records, module paths,
pack IDs, asset IDs, and source history. It is not the identifier written by a
new Story run.

Current Quarry relationships select one of 24 promoted records from the
canonical corpus in
`src/games/qgraph/packs/quarry-qgraph-ibm-fez-bank-v2.json`. The corpus retains
two explicit source tranches: the original six-job v1 campaign and the
eighteen-job v2 campaign. Together they provide four hardware realizations of
each of six relational recipes without duplicating the original pack data.
The canonical corpus SHA-256 is
`c5fc0b3372f80757668ba21bdd5e3b475b8c917dcb1c9e34649038b3ed56a8b6`;
its source index retains the original v1 bank hash as well as both capture-set
hashes.
Each record is a 12-qubit `graph-v1` IBM Fez result whose ordered bits represent the directed
A→B, A→C, A→D, B→A, B→C, B→D, C→A, C→B, C→D, D→A, D→B, and D→C edges. The API
returned its ranked top twenty outcomes rather than all 4,096 requested shots;
the bank preserves that projection, its returned probability mass, and exact
Moth/IBM job and raw-result identity. Complete relation phases are sampled
locally from only those returned weights and frozen before play. The release
uses three approximately 60-second rounds and an approximately twelve-second
relation cadence. Both are local game timing, not evidence that the provider
circuit was remeasured at that cadence.

The old synthetic pack remains test and recovery infrastructure, not current
runtime authority. Fluxball's forty committed IBM Fez QGraph returns remain a
separate bank. The final Story terminal may compare the relational mappings,
but it must not transfer either game's hardware provenance to the other.

## Retired Enclose prototype

Enclose is not part of the shipped cabinet roster, Story, Source Record, or
Workshop. Its source, manifests, and historical QA captures remain in the
repository as unreferenced development history so removal from the product does
not become destruction of provenance. Their presence on disk is not evidence
that Enclose remains a production route or playable cabinet.

## Moth contract snapshot

- OpenAPI version: `0.1.0`
- canonical API-spec hash used by discovery: `de1a2956b0751079ae98627ffd1b40b0bf967ba9998f6db1551c7473d4455a8d`
- exact engine definitions and hashes are retained only in ignored, redacted discovery caches in the sibling tooling.
- the integrated runtime performs no provider request and contains no
  credential;
- historical incomplete acquisition material remains quarantined outside
  promoted runtime authority. Only validated, immutable records named in this
  document can carry gameplay authority.

## Qong installed-bank boundary

`src/games/qong/packs/qong-story-pack-bank-v1.json` contains the promoted bank
`qong-moth-qpu-bank-7e49214d4fe7`, canonical content SHA-256
`5b2cc29a0f0dbfe5ce3d34e1d4fa225408d79dbddc79873149c00a301fff3b94`.
It binds four separately hashed seven-result play packs to forty-four ordered
one-shot selector results. The seventy-two played/selector records are
classified `moth-api-qpu` and retain their returned provider-selected backends.
The browser loader and TypeScript/Python validators fail closed on absence,
tampering, reordered records, mixed adapters, or a backend identity not
justified by the reviewed adapter-v5 policy contract. Arcade's
`qong-synthetic-control-v1` is separately labelled and cannot acquire Story
authority.

## Quantum Box developer adapters

The isolated developer lifecycle and four engine-specific decisions are
recorded in `docs/moth-acquisition.md`. The values below are historical pins in
the integration adapter, not assertions about the current live engine records.
The isolated Qong task owns the currently authorized inspection and mutation
workflow. Integration will accept only its clean, provenance-valid promotion
handoff; it neither operates Moth nor infers a current contract from these
historical pins.

| Engine         | Historical pinned record SHA-256                                   | Pin timestamp          | Pinned credits | Current runtime decision                                                                |
| -------------- | ------------------------------------------------------------------ | ---------------------- | -------------- | --------------------------------------------------------------------------------------- |
| `coin-toss-v1` | `e868d1e2436e629a911bc3a7bb85c33c20951fbc8130c9bbd62dc239d005c51c` | `2026-07-23T16:09:42Z` | 2              | promoted one-shot QPU Story bank is separately identified above                         |
| `blur-v1`      | `bb0719963cd5927ade8d75bfbe66b6b906495697352fe3832437d71091cbf082` | `2026-08-04T12:08:45Z` | 1              | excluded from Quantum Box                                                               |
| `graph-v1`     | `5a1d16aba1eabb9a14fab5e397b1f96a5773812a0a4a26e2a31624fddfe10dfb` | `2026-08-20T11:05:21Z` | 5              | separate IBM Fez banks authorize Fluxball (40 returns) and Quarry (24 12-qubit returns) |
| `labyrinth-v1` | `f88c54b9d4d6366593ffdece799b4bef7676bc7c691833aeaebed0a85605b766` | `2026-07-23T16:09:42Z` | 5              | played Quantman uses the separately promoted 100-qubit IBM Fez return                   |

Local generation and synthetic controls remain explicitly classified as local.
They are not evidence of Moth execution. SkiPixl consumes the separately
documented preserved QPixl capture bank; Fluxball consumes its separately
documented forty-record Graph bank; Quarry consumes its separately documented
24-record Graph corpus. Quantman consumes the separately documented Labyrinth
hardware bank above.

## Integration merge provenance

The integration branch consumed the five clean branch handoffs in the required
order. Feature commit and resulting merge commit are recorded separately:

| Handoff branch         | Feature commit                                            | Integration merge |
| ---------------------- | --------------------------------------------------------- | ----------------- |
| `qbox/visual-bitmap`   | `6d1819e`                                                 | `283094b`         |
| `qbox/skipixl`         | `0a1abc2`                                                 | `6678e73`         |
| `qbox/quantman`        | `b261ee8`                                                 | `86ceb0e`         |
| `qbox/qong`            | handoff tip `ae345b5`, including implementation `011c423` | `713d660`         |
| `qbox/tutorial-worlds` | `76fe900`                                                 | `d0d5efb`         |

Shared app, screen, shell, save, recovery, replay, cross-cabinet tests, and QA
adaptations remain integration-branch work; the table does not attribute those
later changes to the isolated feature branches.
