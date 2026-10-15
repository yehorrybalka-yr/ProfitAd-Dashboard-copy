import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { Inter, Manrope, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { AppProviders } from "@/components/providers/AppProviders";
import { loadRnpDataset } from "@/lib/rnpIngest";
import { THEME_STORAGE_KEY } from "@/lib/theme";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-manrope",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ProfitAd — РНП Дашборд",
  description: "Внутренняя аналитика рекламных проектов ProfitAd",
  icons: { icon: "/icon.png", apple: "/icon.png" },
};

export const dynamic = "force-dynamic";

const themeInitScript = `
(function() {
  var KEY = '${THEME_STORAGE_KEY}';
  function getPref() {
    try {
      var stored = localStorage.getItem(KEY);
      return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    } catch (e) {
      return 'system';
    }
  }
  function apply(pref) {
    var resolved = pref === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : pref;
    var root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolved);
    root.style.colorScheme = resolved;
  }
  function sync() {
    apply(getPref());
  }
  sync();
  try {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onSystemChange = function() {
      if (getPref() === 'system') sync();
    };
    if (mq.addEventListener) mq.addEventListener('change', onSystemChange);
    else if (mq.addListener) mq.addListener(onSystemChange);
  } catch (e) {}
})();
`;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  noStore();
  const dataset = await loadRnpDataset();

  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${inter.variable} ${manrope.variable} ${plexMono.variable} font-body antialiased`}
      >
        <AppProviders dataset={dataset}>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
