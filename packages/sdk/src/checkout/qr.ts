import QRCode from "qrcode";

/**
 * Render a WalletConnect pairing URI as a scannable QR data-URL.
 * Used by the "Connect on another device" flow.
 */
export function toDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    margin: 1,
    width: 232,
    errorCorrectionLevel: "M",
  });
}
