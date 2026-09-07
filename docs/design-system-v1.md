# Quantum Box design system v1

**Status:** binding browser implementation contract, revised 2026-09-05
**Logical screen:** 320 × 180  
**Reference authority:** `docs/visual-reference-contract.md`

## Visual grammar

Quantum Box is a handmade early-1970s game anthology, not a universal Fluxball
skin, a green-phosphor oscilloscope, or a modern CRT shader demo. Every internal
surface is registered to a 320 × 180 Brown Box display. The field uses a
preserved QPixl-derived two-colour distribution; sharp local geometry, sprites,
type, focus, and controls are drawn above it. The fixed internal palette is:

| Role         | Value     | Use                                                     |
| ------------ | --------- | ------------------------------------------------------- |
| dark tobacco | `#2B1C14` | deepest field, negative space, outlines                 |
| muted tan    | `#564330` | second background value and subordinate surfaces        |
| warm cream   | `#D6BD8B` | type, court, maze, course structure, players, and focus |

Screens preserve sparse peripheral counters and a clear central playfield. Text-heavy settings, Workshop, formulae, and source records remain DOM-authored for keyboard and assistive-technology access. Gameplay authority stays outside DOM and rendering.

## Reference-to-surface rules

- **Launch:** show only STORY, ARCADE, WORKSHOP, and SETTINGS as four quiet
  primary rows. Credits belongs under Settings. Do not place game thumbnails on
  the launch surface.
- **Story and Arcade:** each is a separate five-cabinet selection screen for
  Qong, SkiPixl, Fluxball, Quantman, and Quarry, and both reuse the same
  canonical preview marks. Enclose is not shipped. Story shows only preview,
  number, title, chapter status, and compact paired-stage progress. Arcade
  shows only preview, title, and the launch modes
  required to distinguish its playable formats. Neither selection surface
  repeats its page heading. Arcade does not paint source subtitles, label a
  mode-selection panel, or outline individual hit targets. Arcade authority
  metadata remains in the accessible structure rather than becoming visible
  diagnostic copy. Preview marks use only the three-colour palette.
- **Arcade labels:** describe the actual playable choice. Qong uses
  `PLAYER / CPU` and `PLAYER / PLAYER`; SkiPixl uses `EASY`, `MEDIUM`, and
  `HARD`; Quantman uses `STABILIZE GAZE` and `INVERSE GAZE`; Fluxball uses
  `2P GLOBAL`, `2P INDIVIDUAL`, `4P GLOBAL`, and `4P INDIVIDUAL`; and Quarry
  exposes its supported human/CPU join flow. `LOCAL` is not a visible rule label because it ambiguously names
  both same-device multiplayer and locally decoded rule variation. Every mode
  target reserves the same logical height so short Fluxball labels cannot
  trigger a larger bitmap-text scale.
- **SkiPixl:** use the compact seven-state runtime skier family derived from the
  posture, scale, and rotation logic of Atari _Skiing_ (1980) without copying
  its sprite. The earlier Candidate B sheet is historical development evidence,
  not current runtime authority. The skier faces down-screen in the upper third;
  new rows enter below and move upward. Do not add tracks, corridor walls, or a
  speed panel.
- **Fluxball:** use Fluxball Classic's four recovered role silhouettes as the
  sprite-language benchmark while preserving the existing physics, rule
  sampling, controls, and court topology. Individual mode shows only each
  side's round goals and round wins plus the shared `CHANGE RULES` availability;
  it never exposes an individual or joint state. Global mode alone may show its
  outgoing or final shared triplet. Do not add opaque rule cards or new colours.
- **Quantman:** use continuous cream corridors, small fragments, the selected
  notched player, and signal ghosts without copying a protected maze or
  character. Both modes render the 10×10/100-bit local synthetic control; the
  preserved Moth remote-Aer preview is comparison evidence, not visual or
  gameplay authority.
- **Quarry:** use the four silhouette-distinct duck families, directed relation
  lines, open wraparound sides, and sparse arena architectures. Its QGraph-
  compatible relationship schedule is a local synthetic model; do not visually
  transfer Fluxball's IBM Fez provenance to it.
- **Story:** the five chapters contain eight gameplay stages: Qong; SkiPixl
  Medium then Hard; Fluxball 2P Global then 4P Individual; Quantman Stabilize
  then Inverse; and Quarry. Morphs, doors, dismounts, and transports are shown
  as actions, never described by captions. Compact in-world dialogue then gives
  way to player-controlled top-down room traversal into the shared office, den,
  cabin, and terminal grammar. The former four spatial tutorial rooms are
  legacy QA surfaces, not current Story destinations.
- **Workshop and Settings:** retain the ordinary Brown Box menu frame. Workshop
  contains four engine bays and no invented fifth row; Settings keeps stable
  DISPLAY, FIELD, CONTROLS, and DATA sections and reveals one group at a time.

Each mapping is tested with a served screenshot beside the exact reference. Similar palette alone is insufficient.

## Display field, scaling, and motion

- The interactive foreground plane is exactly 320 × 180. CSS preserves its 16:9 aspect ratio and uses nearest-neighbour scaling. The QPixl field alone continues beyond that foreground in non-16:9 viewports at the same integer pixel scale; it is not a second decorative field or a differently scaled copy.
- Existing cabinet drawing code may use the exact 640 × 360 legacy authoring plane only through the single fixed 0.5 transform in `BrownBoxDisplay`; the resulting display model and content plane remain 320 × 180.
- The installed state-1 field is one frozen local assembly using authentic
  returned QPixl cell values from the B2/B3/B4 programme under a documented
  fixed-midpoint two-colour presentation mapping. It is not a single
  whole-screen QPU render and is not collision, rule, or gameplay authority.
- `BrownBoxViewportField` keeps the exact 320 × 180 endpoint under the
  foreground. Where a square or portrait viewport extends beyond that plane,
  it fills only the extra area with a deterministic local stitch of exact
  20 × 20 panels cropped from the same endpoint. That extension is local
  presentation, remains explicitly labelled, and must never be described as a
  provider-returned expanded frame.
- One hard left-to-right replacement boundary changes the complete viewport
  between the four approved endpoints. There is no separate CSS field, Phaser
  field, authored scan line, opacity blend, or interpolation.
- The photographed title CRT uses those same four endpoint images, state order,
  100 ms frame schedule, and hard replacement boundary. Its reviewed
  binary-alpha mask changes only the presentation geometry. The CRT crops the
  native field at the internal foreground's current integer pixel scale; it
  never fits or rescales the complete endpoint into the smaller photographed
  screen. There is no static or differently scaled title-only background.
- Court lines, maze walls, skier, hazards, players, ball, fragments, type, focus, and controls remain sharp local marks. No processed actor experiment is shipped.
- Do not add generic CRT blur, bloom, chromatic halo, green phosphor, smoothing, animated QRT scans, damaged QPixl states, or invented provider noise.
- Do not use opacity flicker or colour drift to imply quantum activity. Reduced
  motion freezes both title and internal fields on `state-1`; presentation
  state never consumes a cabinet PRNG or advances simulation.

## Typography and spacing

- Uppercase monospace is the default machine voice.
- Major titles occupy roughly 9–12% of screen height; cabinet counters 8–11%; labels 2–4%.
- Primary structure aligns to an eight-pixel logical rhythm; fine raster marks may use two-pixel increments.
- Surface texture comes from the committed static field rather than an animated raster filter. Reduced-motion mode keeps the same field and disables title/display movement.
- At 1280×720 and 1920×1080, cream type, court lines, piste edges, hazards, fragments, and walls remain legible without smoothing.
- Active play leaves at least 80% of the central field free of permanent prose.
- Focus uses a small two-pixel cream cursor beside the active label. It never
  outlines or fills the rectangular hit target.
- Header labels reserve enough semantic width and line height for the bitmap
  renderer's one-pixel inset. `QUANTUM BOX` and the right breadcrumb must paint
  every glyph at panel, 1280 × 720, and 1920 × 1080 sizes.
- Story recovery statuses occupy a fixed, centered column wide enough for the
  bitmap renderer to paint complete `OPEN` and `CLOSED` words without wrapping.
- Runtime announcements remain available to assistive technology but do not
  paint a diagnostic strip over menus or playfields. Required failures render
  inside their owning page instead.

## Audio contract

- Short oscillator envelopes provide interface and cabinet effects. Menu playback uses the exact approved local `fluxball-01-open-field-likeness-65-region-03-repeated.wav` asset (SHA-256 `e385a500ac98fb742633443ac1113085d1f097d6d59dd37e27e24c662b8498b5`) rather than reconstructing a shorter approximation in memory.
- The menu loop begins only after `PRESS START`, remains confined to library/menu surfaces, and stops before any cabinet or Story presentation starts. Its source MIDI SHA-256 is `236dcd67c0388c59ae3977645253ebe3bdee7e0eb3f4e431dcfc8cd180a1b5e3`; this is QRC/Qiskit Aer-derived music, not quantum-hardware output.
- Shared interface cues remain restrained. Qong uses dry Pong-like contact tones and a stepped observation cadence; Fluxball separates carry, strike, steal, rule shift, awarded goal, unawarded goal, round, and match feedback; Quarry uses clipped flap/landing sounds, comic capture honks, and a lower ominous graph-shift interval. SkiPixl retains its existing carve, tree, mogul, gate, and finish vocabulary.
- Web Audio is created and resumed only from the player’s `PRESS START` gesture. Failure to unlock never blocks play and never produces an unhandled autoplay error.
- Global mute and a separate 0–100% sound level persist in the versioned local save. `M` and standard gamepad Y toggle mute; standard gamepad X pauses.
- Focus loss pauses an active cabinet, cancels active transient tails, and silences presentation audio. Resuming restores the configured gain without replaying a stale impact or cheer.
- Audio cannot mutate simulation, consume gameplay PRNG, select a pack, or alter replay identity.

## Exceptions

The physical title is currently a reviewed raster asset behind a live accessible `PRESS START` control. It is isolated from the internal UI and may later be decomposed into device/table/screen layers without changing title-state behavior. No other approved reference is shipped as a static gameplay image.
