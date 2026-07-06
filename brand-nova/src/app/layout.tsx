import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brand Nova — AI Employee",
  description:
    "De autonome AI-medewerker van Brand Nova: van koude lijst naar warme leads.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl">
      <body className="antialiased">{children}</body>
    </html>
  );
}
