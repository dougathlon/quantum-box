export interface DeviceSignals {
  readonly userAgent: string;
  readonly maxTouchPoints: number;
  readonly coarsePointer: boolean;
  readonly finePointer: boolean;
}

/** A compatibility notice, not an access/security boundary. Unknown devices play. */
export function requiresComputerNotice(device: DeviceSignals): boolean {
  if (/Android|iPhone|iPad|iPod|Windows Phone|IEMobile/i.test(device.userAgent))
    return true;
  // iPadOS can request desktop sites using a Macintosh identity. Touch alone
  // must never exclude Windows/ChromeOS laptops or a Mac with a precise pointer.
  return (
    /Macintosh/i.test(device.userAgent) &&
    device.maxTouchPoints > 1 &&
    device.coarsePointer &&
    !device.finePointer
  );
}
