import { BROWN_BOX_LOGICAL_SCREEN } from "../BrownBoxTheme";

export const BROWN_BOX_BACKGROUND_PROGRAMME_IDS = Object.freeze([
  "current-four-state-v1",
  "adaptive-direct-v1",
  "adaptive-restrained-v1",
  "adaptive-stronger-v1",
  "amplified-four-state-v1",
  "seeded-sixteen-state-v1",
] as const);

export type BrownBoxBackgroundProgrammeId =
  (typeof BROWN_BOX_BACKGROUND_PROGRAMME_IDS)[number];

export const DEFAULT_BROWN_BOX_BACKGROUND_PROGRAMME_ID =
  "current-four-state-v1" satisfies BrownBoxBackgroundProgrammeId;

export interface BrownBoxBackgroundState {
  readonly stateId: `state-${number}`;
  readonly textureKey: string;
  readonly fileName: string;
  readonly relativePath: string;
  readonly sha256: string;
  readonly classification: string;
  readonly url: string;
}

export interface BrownBoxBackgroundTiming {
  readonly frameDurationMs: number;
  readonly holdFrameCount: number;
  readonly sweepStepCount: number;
  readonly sweepFrameCount: number;
  readonly firstSweepStep: 0 | 1;
  readonly phaseFrameCount: number;
  readonly loopFrameCount: number;
  readonly loopDurationMs: number;
}

export interface BrownBoxBackgroundProvenance {
  readonly sourceManifest: string;
  readonly sourceManifestSha256: string;
  readonly classification: string;
  readonly derivation: string;
  readonly providerKeyframeJobIds: readonly string[];
  readonly loopClosure: string;
}

export interface BrownBoxBackgroundProgramme {
  readonly programmeId: BrownBoxBackgroundProgrammeId;
  readonly label: string;
  readonly width: number;
  readonly height: number;
  readonly palette: readonly ["#2B1C14", "#564330"];
  readonly timing: BrownBoxBackgroundTiming;
  readonly transition: Readonly<{
    direction: "left-to-right";
    boundaryLine: "none";
    interpolation: "none";
  }>;
  readonly provenance: BrownBoxBackgroundProvenance;
  readonly states: readonly BrownBoxBackgroundState[];
}

export interface LoadedBrownBoxBackgroundProgramme {
  readonly programme: BrownBoxBackgroundProgramme;
  readonly images: readonly HTMLImageElement[];
}

export interface BrownBoxBackgroundProgrammeTarget {
  setProgramme(
    loadedProgramme: LoadedBrownBoxBackgroundProgramme,
    startedAtMs: number,
  ): void;
}

const CURRENT_HASHES = Object.freeze([
  "42b8e24696a46d41695712d97bb49b1ad74befce1d4d6a07c54dc2f2c98be3f1",
  "91d9812d112acfccb0d1a67cc555f5bfa1ed806d346bcf33826d1db6f0b1923f",
  "56ed4dac2452e16257ca4c651a6215b54270663a1420ec89f931d748365d288b",
  "f7bfc20072e604e6a67737fbcf7d9579d4f973fc984e99a122bcd4cd714bfb33",
]);

const ADAPTIVE_DIRECT_HASHES = Object.freeze([
  "42b8e24696a46d41695712d97bb49b1ad74befce1d4d6a07c54dc2f2c98be3f1",
  "12a36382a0aa7b6b48e5009d65e4d6c24f336b92c3386b55e4bb70b0e1e6276f",
  "3e33f875a08e1edcbf211dfdbb2d531f29fa61fa5b406aad8259e0a83b2aecdc",
  "a6efb7df9af9c40d9f020b378a40bcd53a6512d28c7b442a9ae4a2d4481928f7",
  "2e487f8d161e06c431b27969de0fe0ef830d8d7928a0f6ab32317840c8510ccd",
  "3bfdce2da7bc9c7bdd727cd2f8f3c0232b493c026bec3c4bbfc9761a902b066e",
  "ba26051334d216b5490bacf2a14c5c804e1492b9a44d16bb46be5277ceef188b",
  "aaed6007cb0b00e8e189c3676ed0e37db173189d95018ead99b7bd75097475df",
  "d004be41dc9de5dff2107606a4df9d6b21a34b9025bf10c00206dbebfd89777c",
  "a71719d3e152efb2861c726d28dc945a9b531f7c020cb3451d501c337155106e",
  "0133deec7c8d6bdb127283d98391a17b960a793e25dfbf8d1177bef6d1109f64",
  "de8ca0b41484329c70e93782c620852202111ec3076e2be79c515ba86247d173",
  "ae5c8ae80803c8663e03149f1a6c45916ad1d7fcad61b065ec9d91707918afc2",
  "fbdb059956ce0260bd2bf05f39dcd5991ff97a8133d3daa045176005557d4423",
  "29433c7c767caae6b9196fe81b47d2d71d346281eef01128301bbe3ecb4759d5",
  "44929db150dbcd2f90ed51b9272e4e085eebc510f86eac843ab16dec54db43e7",
  "6922d091d8245c2623236c88d83fc0114db5ec861506236c82b93658ccbecd78",
  "24ff9eed728dfd6ff68d020fcdb062ac2803be740d9abc5d26ba969c2220cf80",
  "e1d53651a169283ec9879228f921be268968b0c33ee250da5c4eb1e7dae1cad2",
  "30d8abb2a99a30e016fe6426bd9123a5fad43d3c42a29dd5499d1e15d1ce446a",
  "8ac97127e1593dcef66429d61568f44cc38fd68d89de10ffd3e3b2370ba81a7a",
  "a321348c163878028d53b202115f3532f0d1df94c439bb2041245a2c1982c991",
  "85a007f954f7e6afcf297c2a21908f391dfa787e067dad60b13c47968ce091fc",
  "d032e3fcab46e64f86de8eae07662651df8401f436cda73c309ff21312683ced",
]);

const ADAPTIVE_RESTRAINED_HASHES = Object.freeze([
  "42b8e24696a46d41695712d97bb49b1ad74befce1d4d6a07c54dc2f2c98be3f1",
  "ddf5b67784eab35506b9b0c030e35d0b9de036215275fb55b7d4b8a8a0df36cf",
  "b7eed09c3b640d53916cedefb5a4634d6f5fca657eaaf1602ef54554f635dee9",
  "585a7fe8d7ba57304ad2a2ef2c7b841d4bc62f5aa3a53e3ae7a6b167daa0a9f9",
  "d103d661589ccd5efc27ef43032a4841e90bf595b51a69781e77db2ef63fc8f6",
  "61fee31d4019d722b2875d1e59acded509cbc07e1a93505cf3ebcd8f3dddc7eb",
  "78ccbe89db6accffb4781dd681f18a8eb98370f2614aacfc3f2d7d26aca9fad5",
  "b7e228af45377a7f604b663c067a09bdd4d2cc5c8a7609440fbf1beeb676313a",
  "0ab55eae685d3bf9601f9a9d897eb4e8d7ae42451b32110c87e3f3abb02759ef",
  "2bd992599d59635f4fd558cd6dce1c9f7434f35d05e1cc3991c4a519afa8287a",
  "6f1c32cae39c4034290d1918a1d31feed527e45d0b6c891e3a3647cca6c62a96",
  "44a2d6498ea8f6d3498a465736324ccf924047fe8acab39f80c9094c4a1a7885",
  "5d3ca17552f3a741bd11d13220332db1046f4e10fbce087737420e56253779c9",
  "890785ecfd88d169ff990ca08563be73713c68b9b88fa53b6635110138a63053",
  "bb8c24be72a26c3dc1202c3fca5062f0b4bd50522a55bf609c856eb9a64bcce7",
  "12cffa106fdf56df6b719c54e1c69789f023bfb9cdd302156fe12bdd1422c9d1",
  "2ecc4af9408f5d38c8585b9574966a19fa374d44236e29036e4d716cec84a4ec",
  "b0cf0f6f61623ed4c3f324252d81f28ebc62c8d95ab378c38a6a330c9742d7cb",
  "ff29434d216e1857616312130aaad8260fec795af3a86212da019f760422e37c",
  "6148f3f28a5b5d8d2d2fac20b1dc5d2d0a7537ac4c1c745c96b052b82cfacdb5",
  "46f2f549aa83435cfd2efbf3fca120b2171d95cab6ed2e8a713c590b3e618b95",
  "ee9ae6d56a1e225825c693a2282630de44dcc9dcd773240af5c690300cd751aa",
  "591909c3f8394b0d2ceeec89d97b7df1f35b0f4428fb48f629a92258e4f29c33",
  "df5dd121bfdf3dc6d72da1a10ac0112579259f9d121e24a5a0d5b98f78631568",
]);

const ADAPTIVE_STRONGER_HASHES = Object.freeze([
  "42b8e24696a46d41695712d97bb49b1ad74befce1d4d6a07c54dc2f2c98be3f1",
  "6439359b14cb83fc2c6276b759333aa8142d97c9a71c217175a488c7223781a0",
  "1ad97df3510d14fde6eecbb43e3b253e2ad4336b8bbbb0e3bef4638b71badad5",
  "e3b09e34f94c09568e3f96dc5cdafff7e2c100137f0de28a642a0e6138ddef6e",
  "772de57dbffd9d6038d154517749fa2a31ab129ab03be616e9bdafdc74013373",
  "461b148829e9092086083011ba35aa3f2ad905c4ba8db0ec83cd7d7c7fd29b57",
  "74556600d349465d47ca35901490b44587bbab8b3e48fc0437de2a4648dcb4f1",
  "e13feb3a22234fd1b9a718657c8143e65ea1f5535088c68a2c30c702c2207f60",
  "6ba5dbf19a7c0f5b357caea12473abb7d01078ea5acd0b1be638818a331cfd3e",
  "09712cd3f74084510ddfe4e6c8fc839e8b81b7b81fc29ddcc7a4163d54fd2743",
  "73d568505c94d484a51136bd14bcecc485f105fd18cfe076cab9e3bfad223962",
  "9da2efbf0da33c56142594f6c137a8b84ed0c61929a676c7d68df98b160ea5da",
  "5780a391397d31a16cb662ef66d117263fcb62f4e12142f076302bdd8b240b55",
  "7658e03327223126a73d704fe96595c49b1fb9df69b893c0fe4b55e22eedd240",
  "3f6b4c18e94da6622584d949a324a9c4f27e88fb519d45c3def6e1cf35b2504f",
  "8fbc9a95ec9cda2a123469acd6b0cc789e8e21c31a5926481ed5dc72b6c89fd7",
  "7b4ec5f87470201f7001b5e4f33581dca7765ca3ef7f246ec7250bf70cbdadd6",
  "005357a82d94e59679780eb485897b54068be3118256ed23f492288304e8de5e",
  "43a363ea17a6dc5d56cdf884762039ac1521f9d0da1fcdf3a6ab0feaad655367",
  "1512e1db7064bc22551f346a67693dd70c308e71aafe2e92e460a99dde3d1843",
  "4efb966484fce92c5d8d4fd451043abfae304d050633b9ceae685bebec7e1a0a",
  "b07e67085f25e330aee743e3246666ec1f128d738c87a53345c148e1c22503e7",
  "9e05753df8aeb54c4532acaffdf1f56cfa2e139919830a4884e54217a39fc77e",
  "4ed3ff0d0de153f754290944537efaca37f25e614a8a48de7cf43a9748b37bd8",
]);

const AMPLIFIED_HASHES = Object.freeze([
  "42b8e24696a46d41695712d97bb49b1ad74befce1d4d6a07c54dc2f2c98be3f1",
  "3e34ad46473d128cb2127ea665c73f3a3a812ec15358a921c02afafa148cdad3",
  "9e49654fa84e47cfb5d6efb3ed4fdc40be66c371260459303fb3d0c0a6a5f436",
  "d502c25dbfdaf12d4977786d7b4ad59134dc5b51f2ed8d8aeb06b5d889a706b3",
]);

const SEEDED_HASHES = Object.freeze([
  "42b8e24696a46d41695712d97bb49b1ad74befce1d4d6a07c54dc2f2c98be3f1",
  "30e29f3ff28efbce07b1e98d48fb8b17867d57e77575561edf65a643a8224db8",
  "e8c19c8a3fbeb043f7d94c31c8f30a2495a6a8a7549842e92981315392065ddf",
  "ff8013afd4ba0e55d74255b7532620c99197062896d83dbf0f516c55ba07e2d4",
  "4e9e7b657ee675096fd966fc85754bd58e120539ee52086b36a8dfbfd770e874",
  "bb5591cb0dca9c401d93447beca465a533d0974e62ccf60ea3da07042270391a",
  "435f03e890fc270dfdf5af4b1699d85fdecebee660e1eaa7d36b6ed7d0c60e9e",
  "b583402fc697d8726550a36f8e83712d263f61a76460266d08eaae90c39a2841",
  "b7a787f14821c395a3b199f82ebe34b0d71bee4b71ec4c7a8f8e577a465cfb28",
  "1e10f104240d405e1580057aedbf441c9dba099ee50fc8ad49ce9e1b0902ebf9",
  "ebfd00d670da00d1cecb0c8f998303fd86bd808d09c1ac9ef1b6d7116b9df819",
  "17b0d75fdf50b2c3d2f51b332f13119a9337942955cd91562d22e6891a7faf88",
  "d75fd4ff8dee637b9b9ce7a40f0bed3fb9a0d2da75cfdae1d93e690ecb39bdfa",
  "2a0b7bcfc2c4c554baa356b35d42c840fd0ae51446ca231bbbcd52b51ec3cd68",
  "4d7c57d7b5cb55c734908e49501505d0b325f93c55dce08077437e845c732a65",
  "81637da7c1d2e5371a20cb6d5dc302ca6a16564542eb712a0bda779ce787ee52",
]);

const assetUrls = import.meta.glob<string>(
  "../../assets/brown-box/background-programs/**/*.png",
  { eager: true, query: "?url&no-inline", import: "default" },
);

const HARD_SWEEP = Object.freeze({
  direction: "left-to-right",
  boundaryLine: "none",
  interpolation: "none",
} as const);

const LONG_SWEEP = Object.freeze({
  frameDurationMs: 100,
  holdFrameCount: 8,
  sweepStepCount: 48,
  sweepFrameCount: 49,
  firstSweepStep: 0,
} as const);

const ADAPTIVE_SWEEP = Object.freeze({
  frameDurationMs: 120,
  holdFrameCount: 2,
  sweepStepCount: 6,
  sweepFrameCount: 6,
  firstSweepStep: 1,
} as const);

function programme(
  programmeId: BrownBoxBackgroundProgrammeId,
  label: string,
  hashes: readonly string[],
  timingSource: typeof LONG_SWEEP | typeof ADAPTIVE_SWEEP,
  provenance: BrownBoxBackgroundProvenance,
): BrownBoxBackgroundProgramme {
  const timing = Object.freeze({
    ...timingSource,
    phaseFrameCount: timingSource.holdFrameCount + timingSource.sweepFrameCount,
    loopFrameCount:
      hashes.length *
      (timingSource.holdFrameCount + timingSource.sweepFrameCount),
    loopDurationMs:
      hashes.length *
      (timingSource.holdFrameCount + timingSource.sweepFrameCount) *
      timingSource.frameDurationMs,
  });
  const stateClassification = stateClassificationFor(provenance.classification);
  const states = Object.freeze(
    hashes.map((sha256, index) => {
      const stateNumber = index + 1;
      const fileName = `state-${String(stateNumber).padStart(2, "0")}.png`;
      const relativePath = `src/assets/brown-box/background-programs/${programmeId}/${fileName}`;
      const modulePath = `../../assets/brown-box/background-programs/${programmeId}/${fileName}`;
      const url = assetUrls[modulePath];
      if (!url) {
        throw new Error(`Brown Box background state is missing: ${modulePath}`);
      }
      return Object.freeze({
        stateId: `state-${stateNumber}` as const,
        textureKey: `brown-box-background:${programmeId}:${fileName}`,
        fileName,
        relativePath,
        sha256,
        classification: stateClassification,
        url,
      });
    }),
  );
  const result = Object.freeze({
    programmeId,
    label,
    width: BROWN_BOX_LOGICAL_SCREEN.width,
    height: BROWN_BOX_LOGICAL_SCREEN.height,
    palette: Object.freeze(["#2B1C14", "#564330"] as const),
    timing,
    transition: HARD_SWEEP,
    provenance: Object.freeze({
      ...provenance,
      providerKeyframeJobIds: Object.freeze([
        ...provenance.providerKeyframeJobIds,
      ]),
    }),
    states,
  });
  validateProgramme(result);
  return result;
}

const ADAPTIVE_SOURCE =
  "drafts/visual-development/quantum-box/qpixl-visual-redesign-v1/hardware/brown-box-evolution-v2/manifests/adaptive-gallery-provenance-v1.json";
const ADAPTIVE_CLASSIFICATION =
  "review-only comparison; provider keyframes and local derived whole-field states are explicitly separated";
const ADAPTIVE_DERIVATION =
  "panel-adjacent-mask-propagation-v1; the 20x20 input-versus-provider-output driver mask is propagated through adjacent panels locally";
const ADAPTIVE_LOOP =
  "local reverse propagation followed by the same left-to-right hard sweep";

export const BROWN_BOX_BACKGROUND_PROGRAMMES = Object.freeze([
  programme("current-four-state-v1", "STANDARD", CURRENT_HASHES, LONG_SWEEP, {
    sourceManifest:
      "drafts/visual-development/quantum-box/qpixl-visual-redesign-v1/hardware/brown-box-background-and-assets-v1/review/qrt-two-color-original-programme-v1/provenance.json",
    sourceManifestSha256:
      "4d8837db24ae150a0c9da071c6f44389bc0781c3de5338ee755bfd9d068da717",
    classification:
      "exact programme reconstruction using authentic IBM Fez returned values under a local fixed-midpoint two-color presentation mapping",
    derivation:
      "Preserved returned 20x20 QPixl panels assembled into four byte-identical 320x180 runtime endpoints.",
    providerKeyframeJobIds: Object.freeze([]),
    loopClosure:
      "The approved endpoint sequence closes from state 4 to state 1 with the same invisible hard sweep.",
  }),
  programme(
    "adaptive-direct-v1",
    "ADAPTIVE DIRECT",
    ADAPTIVE_DIRECT_HASHES,
    ADAPTIVE_SWEEP,
    {
      sourceManifest: ADAPTIVE_SOURCE,
      sourceManifestSha256:
        "ca1249a8547e0017515c7bd2fa6b5cabff93a551cad6743c0076f22df877ebaa",
      classification: ADAPTIVE_CLASSIFICATION,
      derivation: `Exact succession of the two QPixl-returned driver panels; ${ADAPTIVE_DERIVATION}. The whole-field states remain local derivatives.`,
      providerKeyframeJobIds: Object.freeze([
        "d4219913-dc40-4538-9d78-e96f39eab68f",
        "266774e8-e777-4493-90d0-c5f134a39e2a",
      ]),
      loopClosure: ADAPTIVE_LOOP,
    },
  ),
  programme(
    "adaptive-restrained-v1",
    "ADAPTIVE RESTRAINED",
    ADAPTIVE_RESTRAINED_HASHES,
    ADAPTIVE_SWEEP,
    {
      sourceManifest: ADAPTIVE_SOURCE,
      sourceManifestSha256:
        "ca1249a8547e0017515c7bd2fa6b5cabff93a551cad6743c0076f22df877ebaa",
      classification: ADAPTIVE_CLASSIFICATION,
      derivation: `Three-cell edge band at 20% neighbour influence; ${ADAPTIVE_DERIVATION}.`,
      providerKeyframeJobIds: Object.freeze([
        "716571d5-858c-4c12-8092-853899d46d52",
        "1584811c-5f5e-4268-b5a1-c6df52e98bc4",
      ]),
      loopClosure: ADAPTIVE_LOOP,
    },
  ),
  programme(
    "adaptive-stronger-v1",
    "ADAPTIVE STRONGER · EXPERIMENTAL",
    ADAPTIVE_STRONGER_HASHES,
    ADAPTIVE_SWEEP,
    {
      sourceManifest: ADAPTIVE_SOURCE,
      sourceManifestSha256:
        "ca1249a8547e0017515c7bd2fa6b5cabff93a551cad6743c0076f22df877ebaa",
      classification: ADAPTIVE_CLASSIFICATION,
      derivation: `Four-cell edge band at 30% neighbour influence; ${ADAPTIVE_DERIVATION}.`,
      providerKeyframeJobIds: Object.freeze([
        "20607d58-d2fb-486b-8460-a30a50913be3",
        "97936cce-8260-4b24-bf0f-53c48d8aad7f",
      ]),
      loopClosure: ADAPTIVE_LOOP,
    },
  ),
  programme(
    "amplified-four-state-v1",
    "AMPLIFIED FOUR-STATE",
    AMPLIFIED_HASHES,
    LONG_SWEEP,
    {
      sourceManifest:
        "drafts/visual-development/quantum-box/qpixl-visual-redesign-v1/hardware/brown-box-background-and-assets-v1/review/qrt-change-amplification-v1/provenance.json",
      sourceManifestSha256:
        "8addd80044ca4c58d2d2ca21a11f6a168ab25bb645dfc1014456273b36e48fec",
      classification:
        "Review-only local composition of preserved IBM Fez QPixl-returned 20x20 panels; not a provider-rendered whole-screen field.",
      derivation:
        "Preserved thresholded QPixl panels were locally selected and composed to amplify endpoint changes to approximately 0.5 percent.",
      providerKeyframeJobIds: Object.freeze([]),
      loopClosure:
        "The four locally composed endpoints close from state 4 to state 1 with the recorded invisible hard sweep.",
    },
  ),
  programme(
    "seeded-sixteen-state-v1",
    "SEEDED SIXTEEN-STATE",
    SEEDED_HASHES,
    LONG_SWEEP,
    {
      sourceManifest:
        "drafts/visual-development/quantum-box/qpixl-visual-redesign-v1/hardware/brown-box-background-and-assets-v1/review/qrt-evolving-field-v1/provenance.json",
      sourceManifestSha256:
        "6bf1efb475021ca53fc3d92391bb11b6b8f7d22766f5695da883785517d50384",
      classification:
        "Review-only classically seeded evolution assembled entirely from preserved IBM Fez QPixl-returned 20x20 panels; not quantum randomness and not a provider-rendered whole-screen field.",
      derivation:
        "Deterministic xoshiro128** assignment selects preserved QPixl-returned panel patterns; the assignment itself is classical.",
      providerKeyframeJobIds: Object.freeze([]),
      loopClosure:
        "Local hard-sweep presentation from state 16 to state 1; not a provider generation.",
    },
  ),
]);

export const BROWN_BOX_BACKGROUND_PROGRAMME_BY_ID: ReadonlyMap<
  BrownBoxBackgroundProgrammeId,
  BrownBoxBackgroundProgramme
> = new Map(
  BROWN_BOX_BACKGROUND_PROGRAMMES.map(
    (entry) => [entry.programmeId, entry] as const,
  ),
);

export const DEFAULT_BROWN_BOX_BACKGROUND_PROGRAMME =
  requireBrownBoxBackgroundProgramme(DEFAULT_BROWN_BOX_BACKGROUND_PROGRAMME_ID);

const programmeLoadCache = new Map<
  BrownBoxBackgroundProgrammeId,
  Promise<LoadedBrownBoxBackgroundProgramme>
>();

export function isBrownBoxBackgroundProgrammeId(
  value: unknown,
): value is BrownBoxBackgroundProgrammeId {
  return (
    typeof value === "string" &&
    BROWN_BOX_BACKGROUND_PROGRAMME_BY_ID.has(
      value as BrownBoxBackgroundProgrammeId,
    )
  );
}

export function requireBrownBoxBackgroundProgramme(
  programmeId: BrownBoxBackgroundProgrammeId,
): BrownBoxBackgroundProgramme {
  const found = BROWN_BOX_BACKGROUND_PROGRAMME_BY_ID.get(programmeId);
  if (!found) {
    throw new Error(`Unknown Brown Box background programme: ${programmeId}`);
  }
  return found;
}

export function preloadBrownBoxBackgroundProgramme(
  programmeId: BrownBoxBackgroundProgrammeId,
): Promise<LoadedBrownBoxBackgroundProgramme> {
  const cached = programmeLoadCache.get(programmeId);
  if (cached) return cached;
  const programme = requireBrownBoxBackgroundProgramme(programmeId);
  const loading = Promise.all(
    programme.states.map(async (state) => {
      const image = new Image();
      image.decoding = "async";
      image.src = state.url;
      await waitForImage(image, state);
      if (
        image.naturalWidth !== programme.width ||
        image.naturalHeight !== programme.height
      ) {
        throw new Error(
          `Brown Box background state has invalid dimensions: ${state.relativePath}`,
        );
      }
      return image;
    }),
  ).then((images) =>
    Object.freeze({ programme, images: Object.freeze(images) }),
  );
  programmeLoadCache.set(programmeId, loading);
  void loading.catch(() => programmeLoadCache.delete(programmeId));
  return loading;
}

export async function activateBrownBoxBackgroundProgramme(
  programmeId: BrownBoxBackgroundProgrammeId,
  targets: readonly BrownBoxBackgroundProgrammeTarget[],
): Promise<void> {
  if (targets.length === 0) {
    throw new Error("Brown Box background activation requires a target.");
  }
  const loaded = await preloadBrownBoxBackgroundProgramme(programmeId);
  const startedAtMs = performance.now();
  for (const target of targets) target.setProgramme(loaded, startedAtMs);
}

function stateClassificationFor(programmeClassification: string): string {
  if (programmeClassification === ADAPTIVE_CLASSIFICATION) {
    return "local whole-field review state";
  }
  return programmeClassification;
}

function waitForImage(
  image: HTMLImageElement,
  state: BrownBoxBackgroundState,
): Promise<void> {
  if (image.complete && image.naturalWidth > 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    image.addEventListener("load", () => resolve(), { once: true });
    image.addEventListener(
      "error",
      () =>
        reject(
          new Error(`Brown Box background state failed to load: ${state.url}`),
        ),
      { once: true },
    );
  });
}

function validateProgramme(entry: BrownBoxBackgroundProgramme): void {
  if (
    entry.width !== BROWN_BOX_LOGICAL_SCREEN.width ||
    entry.height !== BROWN_BOX_LOGICAL_SCREEN.height ||
    entry.states.length < 2 ||
    entry.timing.frameDurationMs <= 0 ||
    entry.timing.holdFrameCount < 0 ||
    entry.timing.sweepStepCount <= 0 ||
    entry.timing.sweepFrameCount <= 0 ||
    entry.timing.phaseFrameCount !==
      entry.timing.holdFrameCount + entry.timing.sweepFrameCount ||
    entry.timing.loopFrameCount !==
      entry.states.length * entry.timing.phaseFrameCount ||
    entry.timing.loopDurationMs !==
      entry.timing.loopFrameCount * entry.timing.frameDurationMs
  ) {
    throw new Error(
      `Brown Box background programme metadata is inconsistent: ${entry.programmeId}`,
    );
  }
  if (
    entry.transition.direction !== "left-to-right" ||
    entry.transition.boundaryLine !== "none" ||
    entry.transition.interpolation !== "none"
  ) {
    throw new Error(
      `Brown Box background transition drifted: ${entry.programmeId}`,
    );
  }
}
