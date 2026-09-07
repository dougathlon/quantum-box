import titleScreenMaskUrl from "../assets/brown-box/title-b3-s3-screen-layer.png";
import titleDeviceUrl from "../assets/brown-box/title-formica-device.png";
import titleSharpLocalLayerUrl from "../assets/brown-box/title-sharp-local-layer.png";
import {
  BROWN_BOX_FIELD_PROVENANCE,
  BROWN_BOX_FIELD_STATES,
} from "./BrownBoxField";
import {
  BROWN_BOX_BACKGROUND_PROGRAMMES,
  DEFAULT_BROWN_BOX_BACKGROUND_PROGRAMME_ID,
} from "./backgrounds/BrownBoxBackgroundPrograms";

export interface QuantumBoxTitleAssets {
  readonly device: string;
  readonly screenMask: string;
  readonly sharpLocalLayer: string;
}

export const BROWN_BOX_ASSET_MANIFEST = Object.freeze({
  internalFields: BROWN_BOX_FIELD_STATES,
  internalFieldProgramme: BROWN_BOX_FIELD_PROVENANCE,
  backgroundProgrammeId: DEFAULT_BROWN_BOX_BACKGROUND_PROGRAMME_ID,
  backgroundProgrammes: BROWN_BOX_BACKGROUND_PROGRAMMES,
  title: Object.freeze({
    device: titleDeviceUrl,
    deviceSha256:
      "ebf5084d1666d20c910a5cda86965b5c3f049776136f300f0e9529a143eb83e6",
    screenMask: titleScreenMaskUrl,
    screenMaskSha256:
      "88e931ba0ddcc9cfc9f81a374bae2d43a69fba3e5fc972f630c731282fe2943f",
    screenMaskPurpose:
      "Reviewed binary-alpha photographic CRT mask. Its RGB values are ignored; the title field uses the same selected native endpoints and runtime programme as the internal display.",
    sharpLocalLayer: titleSharpLocalLayerUrl,
    sharpLocalLayerSha256:
      "b316d2d561673d01f5633f54197ad8acb66e3d1a0d51695b8328265788e3e545",
    excludedLayer:
      "title-coherent-source-footprint-device-asset-layer-1672x941.png",
    excludedReason:
      "Processed QPixl indicators are outside the approved ordinary sharp local title treatment.",
  }),
});
