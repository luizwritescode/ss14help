import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "ss14help", template: "%s · ss14help" },
  description:
    "Chemistry and cooking recipes for Space Station 14 servers, with a calculator for exact ingredient amounts.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#070a13" },
    { media: "(prefers-color-scheme: light)", color: "#f6f7fb" },
  ],
};

// Applies the stored theme before first paint. Dark is the default ("dark first").
const themeScript = `try{var t=JSON.parse(localStorage.getItem("ss14help:theme"))||"dark";if(t!=="system")document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="dark"}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="h-full font-sans antialiased">{children}</body>
    </html>
  );
}
