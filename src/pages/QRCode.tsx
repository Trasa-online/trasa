import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

const QRCodePage = () => {
  const qrRef = useRef<HTMLDivElement>(null);
  const targetUrl = "https://trasa.lovable.app";

  const downloadQR = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (canvas) {
      const url = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = url;
      link.download = "trasa-qr-code.png";
      link.click();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="text-center space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Kod QR do Trasa</h1>
        <p className="text-muted-foreground">
          Zeskanuj kod, aby przejść do waitlisty
        </p>

        <div
          ref={qrRef}
          className="bg-white p-6 rounded-2xl shadow-lg inline-block"
        >
          <QRCodeCanvas
            value={targetUrl}
            size={256}
            level="H"
            includeMargin={false}
          />
        </div>

        <p className="text-sm text-muted-foreground">{targetUrl}</p>

        <Button onClick={downloadQR} className="gap-2">
          <Download className="h-4 w-4" />
          Pobierz jako PNG
        </Button>
      </div>
    </div>
  );
};

export default QRCodePage;
