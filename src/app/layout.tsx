import type { Metadata } from "next";
import { Noto_Sans, Noto_Sans_Thai_Looped } from "next/font/google";
import "./globals.css";
const notoSans = Noto_Sans({ subsets: ["latin"], variable: "--font-noto-sans", display: "swap", adjustFontFallback: false });
const notoThai = Noto_Sans_Thai_Looped({ subsets: ["thai"], weight: ["300", "400", "500", "600", "700", "800"], variable: "--font-noto-thai", display: "swap", adjustFontFallback: false });
export const metadata: Metadata = { title: "PAM · API Report", description: "รายงานข้อมูล Privileged Access Management พร้อมพิมพ์ A4" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th" className={`${notoSans.variable} ${notoThai.variable}`}><body>{children}</body></html>;
}
