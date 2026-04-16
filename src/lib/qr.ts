import QRCode from "qrcode";

export async function generateQRDataURL(
  machineId: string,
  qrToken: string,
): Promise<string> {
  // machineId unused in URL but kept for caller convenience / future telemetry
  void machineId;
  const url = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/m/${qrToken}`;
  return QRCode.toDataURL(url, {
    width: 300,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });
}

export async function generateQRBuffer(
  machineId: string,
  qrToken: string,
): Promise<Buffer> {
  // machineId unused in URL but kept for caller convenience / future telemetry
  void machineId;
  const url = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/m/${qrToken}`;
  return QRCode.toBuffer(url, {
    width: 300,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });
}
