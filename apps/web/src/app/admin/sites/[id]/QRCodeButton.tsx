"use client";

import { useEffect, useState, type ComponentType, type SVGAttributes } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

type QRCodeSvgProps = {
  value: string | string[];
  size?: number;
  level?: "L" | "M" | "Q" | "H";
  includeMargin?: boolean;
} & SVGAttributes<SVGSVGElement>;

interface QRCodeButtonProps {
  url: string;
  siteName: string;
}

export function QRCodeButton({ url, siteName }: QRCodeButtonProps) {
  const [showQR, setShowQR] = useState(false);
  const [QRCodeSVGComponent, setQRCodeSVGComponent] = useState<
    ComponentType<QRCodeSvgProps> | null
  >(null);

  useEffect(() => {
    if (!showQR || QRCodeSVGComponent) return;

    let cancelled = false;
    void import("qrcode.react").then((mod) => {
      if (!cancelled) {
        setQRCodeSVGComponent(() => mod.QRCodeSVG as ComponentType<QRCodeSvgProps>);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [QRCodeSVGComponent, showQR]);

  const downloadQR = () => {
    const svg = document.getElementById("site-qr-code");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width + 40;
      canvas.height = img.height + 100;
      if (ctx) {
        // White background
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw image
        ctx.drawImage(img, 20, 20);

        // Add text
        ctx.fillStyle = "black";
        ctx.font = "bold 20px Arial";
        ctx.textAlign = "center";
        ctx.fillText(siteName, canvas.width / 2, img.height + 60);
        ctx.font = "14px Arial";
        ctx.fillText("Scan to Sign In", canvas.width / 2, img.height + 85);
      }

      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `QR-${siteName.replace(/\s+/g, "-")}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  return (
    <>
      <Button onClick={() => setShowQR(true)}>
        <svg
          className="-ml-0.5 mr-1.5 h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 17h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
          />
        </svg>
        Print Gate Poster
      </Button>

      <Modal
        open={showQR}
        onClose={() => setShowQR(false)}
        title={siteName}
        description="Print or download this QR poster for on-site sign-in."
        width="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowQR(false)}>
              Close
            </Button>
            <Button onClick={downloadQR}>Download PNG</Button>
          </>
        }
      >
        <div className="flex justify-center">
          {QRCodeSVGComponent ? (
            <QRCodeSVGComponent
              id="site-qr-code"
              value={url}
              size={256}
              level="H"
              includeMargin={true}
            />
          ) : (
            <div className="h-[256px] w-[256px] animate-pulse rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)]" />
          )}
        </div>
      </Modal>
    </>
  );
}


