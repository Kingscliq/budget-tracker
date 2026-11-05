import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Analytics } from "@/components/analytics";
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
const title = "Pocket — Your monthly budget";
const description =
  "A little clarity for your money. Plan, track, and make room for what matters.";

export const metadata: Metadata = {
  metadataBase: new URL("https://pbt-tracker.vercel.app"),
  title,
  description,
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Pocket",
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
  },
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
