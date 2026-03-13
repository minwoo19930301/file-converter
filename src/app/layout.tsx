import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "File Converter",
  description: "Dark-mode browser file converter for images, PDFs, and text.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
