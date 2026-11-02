import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Analytics } from "@/components/analytics";
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
export const metadata: Metadata = {
  title: "Pocket — Your monthly budget",
  description:
    "A little clarity for your money. Plan, track, and make room for what matters.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gaId = process.env.GA_MEASUREMENT_ID?.trim();
  const analyticsEnabled =
    process.env.VERCEL_ENV === "production" && /^G-[A-Z0-9]+$/.test(gaId ?? "");
  return (
    <html lang="en">
      <body>
        {children}
        {analyticsEnabled && <Analytics measurementId={gaId!} />}
      </body>
    </html>
  );
}
