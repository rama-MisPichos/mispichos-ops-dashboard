import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MisPichos | Operaciones",
  description: "Dashboard operativo para toma de decisiones",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

