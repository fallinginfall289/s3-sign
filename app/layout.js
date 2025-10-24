import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react"; 
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });
const geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata = {
  title: "Hello World",
  description:
    "Hello World",
  openGraph: {
    title: "Hello World",
    description:
      "Hello World",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hello World",
    description: "Hello World",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased ${geist.className} ${geistMono.className}`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
