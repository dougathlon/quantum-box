# Quantum Box visual reference contract

**Status:** binding implementation and review contract, revised 2026-09-07

**Runtime asset package:** `src/assets/canonical-runtime-assets-v2/`

**Approved source package:** `drafts/visual-development/quantum-box/core-asset-language-v1/`

The recovered early-colour-TV mock-ups remain historical art-direction evidence.
The immutable canonical-runtime-assets-v2 manifest is the shipping authority;
core-asset-language-v1 remains its reviewed source package. Together they fix
the internal palette, sprite scale, and interface hierarchy. Legacy tutorial-
space assets remain historical sources; current Story authority comes from the
Story-v2 registry and the separately audited `designer-professor` package. The
physical title retains its reviewed photographed device composition while its
screen field and locally authored 5 by 7 title copy remain independently
rendered. Internal menus and games remain code-native at `320×180`.

The canonical package contains 26 immutable source records, 45 runtime PNGs,
and 98 ordered frames. The source-manifest SHA-256 is
`ba0ff61d315690adcdac094ff4b810f411a01be1f30810b6b0d660c4c5c958d5`;
the runtime-handoff SHA-256 is
`469b9474866522f919a57b18df30e7c06c272ed0e27cbe8198ec513fb16c3638`.

## Binding internal grammar

The internal display uses exactly three opaque colours:

| Role         | Value     | Authority                                                            |
| ------------ | --------- | -------------------------------------------------------------------- |
| dark tobacco | `#2B1C14` | negative space, deepest field, outlines                              |
| muted tan    | `#564330` | the second fixed background value and subordinate surfaces           |
| warm cream   | `#D6BD8B` | type, focus, sprites, controls, walls, courts, and gameplay geometry |

- The background field contains dark tobacco and muted tan only. Its variation
  redistributes those fixed colours; it does not change hue or introduce
  brightness drift.
- Warm cream is sharp local authority. Text, controls, players, goals, walls,
  and other gameplay geometry are not QPixl returns.
- Render at `320×180` and scale by integer nearest-neighbour only.
- Runtime PNG transparency is binary: alpha is exactly 0 or 255, and fully
  transparent pixels contain no hidden RGB.
- Do not introduce gradients, blur, bloom, smoothing, antialiasing, opacity-
  derived shades, generic CRT damage, chromatic fringe, or extra accent colours.
- Keep provider-derived background evidence distinct from locally authored
  sprites and interface layers. A composite is not a provider return.
- Fluxball Classic's approximately `20×20` figures are the sprite-language
  benchmark: compact heads, economical bodies, separate limbs, asymmetric role
  cues, and generous negative space.

## Surface map

| Surface                   | Current authority                                                                                                                | Required transfer                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Physical title            | the decomposed reviewed layers in `src/assets/brown-box/` plus `src/display/TitleLettering.ts`                                   | Preserve the worn wooden device and Formica table. Keep the screen field and locally authored 5 by 7 `QUANTUM BOX` / `PRESS START` copy separately replaceable and sharp. The photographic room/device surround is the sole approved exception to the internal three-colour rule.                                                                                                                                                                             |
| Launch menu               | sharp runtime bitmap UI, derived from `core-asset-language-v1/screens/menu-main-selected-320x180.png`                            | Show only STORY, ARCADE, WORKSHOP, and SETTINGS. Use four large quiet rows; do not put the game library or Credits on this surface.                                                                                                                                                                                                                                                                                                                           |
| Story selection           | sharp runtime bitmap UI, derived from `core-asset-language-v1/screens/menu-story-selected-320x180.png`                           | Show five chapters—Qong, SkiPixl, Fluxball, Quantman, Quarry—with compact progress for the paired stages. Enclose is absent.                                                                                                                                                                                                                                                                                                                                  |
| Arcade selection          | sharp runtime bitmap UI, derived from `core-asset-language-v1/screens/menu-arcade-selected-320x180.png`                          | Show all five cabinets in one non-scrolling Story-like index. Each row contains a centred canonical mark, number, title, and `OPEN`; selecting it opens a separate game-specific trial sheet with premise, object, condition, controls, modes, and scores where applicable. Thumbnails and controls use only the three-colour grammar. Enclose is absent.                                                                                                     |
| Qong                      | `qong-paddle-canonical` plus sharp local ball, court, HUD, and controls                                                          | Keep paddles, ball, court, scores, and controls opaque warm cream over the two-colour field. The installed Story bank supplies recorded QPU rule states without changing the visual grammar or authorizing substitute imagery.                                                                                                                                                                                                                                |
| SkiPixl                   | `skipixl-steering-seven-angle-strip` and `skipixl-approved-five-state-strip` in `canonical-runtime-assets-v2`                    | Use the Atari _Skiing_ lineage: small downhill stance, seven legible ski angles, left/right rotation, fall, and recovery without tracks, corridor walls, or extra illustration.                                                                                                                                                                                                                                                                               |
| Fluxball                  | `fluxball-family-strip` and ball assets in `canonical-runtime-assets-v2`, with the recovered Classic source as lineage authority | Preserve the Classic silhouettes as the strongest role-specific figure grammar and retain the existing court topology. Runtime sprite authority remains distinct from the copied local-Aer gameplay fixtures.                                                                                                                                                                                                                                                 |
| Quantman                  | Candidate C player/ghost family in `canonical-runtime-assets-v2`                                                                 | Use the Candidate-C notched angular player, signal ghosts, fragments, observation marks, and continuous cream maze rails. Both modes use the installed 10×10/100-bit Moth Labyrinth IBM Fez return. Do not copy a proprietary maze or character.                                                                                                                                                                                                              |
| Quarry                    | directional duck strip and Quarry runtime assets under `qgraph-cabinet-assets-v1`                                                | Preserve four silhouette-distinct duck families, waddle/flap/catch readability, open wraparound sides, directed relation lines, and sparse arenas. Local sprites remain separate from the 24-record IBM Fez QGraph gameplay corpus.                                                                                                                                                                                                                           |
| Player and Designer       | Player Candidate C plus the locked professor source and deterministic derivatives under `designer-professor`                     | Story v2 uses the professor with pipe, walk/talk poses, and source-locked morphs from Qong paddle, Player C, Quantman Ghost C, and Quarry Duck D. The older Wizard strips remain immutable historical sources, not current Story authority.                                                                                                                                                                                                                   |
| Dialogue and Story spaces | Story-v2 presentation registry plus professor/action/morph assets                                                                | Enact morphs, doors, dismounts, and transports visibly without captioning the action. Use compact in-world dialogue, then player-controlled top-down traversal into the shared office/den/terminal grammar. The five chapters contain eight stages: Qong; SkiPixl Medium then Hard; Fluxball 2P Global then 4P Individual; Quantman Stabilize then Inverse; Quarry. The former spatial tutorial rooms remain legacy QA only.                                  |
| Workshop                  | Five Story recovery records                                                                                                      | Keep the page selectable from the beginning. Use five large, quiet rows within the standard menu frame and unlock each record through its Story chapter. Quarry's fifth record reuses QGraph without pretending to be another engine family. Keep the MOTH link gated by Quarry completion and within its final Workshop/recovery material; never expose it as an ungated menu shortcut. Do not expose dense formula copy before a recovered row is selected. |
| Settings                  | Sectioned semantic settings form                                                                                                 | Keep DISPLAY, FIELD, CONTROLS, and DATA as stable left-hand sections and show one legible settings group at a time. Do not stack every field into one scrolling wall.                                                                                                                                                                                                                                                                                         |

## Review gate

Every visual milestone requires:

1. native `320×180` evidence;
2. nearest-neighbour enlarged inspection where sprite pixels matter;
3. a served `1280×720` screenshot for integrated work;
4. a served `1920×1080` screenshot before release-candidate sign-off;
5. an exact-palette and binary-alpha audit for generated PNG assets;
6. explicit separation of recovered/provider-derived sources, local authored
   assets, runtime composites, and screenshots.

The source comparison sheets and selection record remain under
`drafts/visual-development/quantum-box/core-asset-language-v1/`. The immutable
shipping manifest and its exact palette, binary-alpha, frame-order, anchor, and
lineage records live under `src/assets/canonical-runtime-assets-v2/`. Source
paths above are relative to the Quantum Culture project root.
