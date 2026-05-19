import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SaPen Annotate",
  description: "Standalone wood-slice annotation for SaPen training data.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
