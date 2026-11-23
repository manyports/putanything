import type { Metadata, Viewport } from "next";
import { Archivo, Caveat } from "next/font/google";
import { ToastProvider } from "@blurrow/ui";
import "./globals.css";

const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo" });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat", weight: ["500", "600"] });

export const metadata: Metadata = {
  title: "putanything",
  description:
    "a board you can put anything on: notes, clocks, the weather, a calculator that keeps its tape, and whatever you paste.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

/* Set the theme before first paint so a dark board never flashes light. */
const themeScript = `try{var t=localStorage.getItem("putanything:theme");document.documentElement.dataset.theme=t==="dark"||t==="light"?t:"system"}catch(e){document.documentElement.dataset.theme="system"}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="system" className={`${archivo.variable} ${caveat.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-page font-sans text-ink antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
