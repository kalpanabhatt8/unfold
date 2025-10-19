import type { Metadata } from "next";
import localFont from "next/font/local";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

// Google Fonts
import { 
  Bricolage_Grotesque, 
  Manrope, 
  Caveat, 
  Space_Grotesk, 
  Patrick_Hand, 
  Poppins, 
  Plaster, 
  Lato,
  Hachi_Maru_Pop,
  Cute_Font,
  Bangers,
  Gloria_Hallelujah,
  Comic_Neue,
  Mochiy_Pop_One,
  Kosugi_Maru,
  Baloo_2,
  Yusei_Magic,
  Press_Start_2P,
  Gochi_Hand,
  Mali,
  Elsie,
  Indie_Flower,
  Kaushan_Script
} from "next/font/google";

// Local fonts
const minecraftia = localFont({
  src: "../../public/fonts/Minecraftia-Regular.ttf",
  variable: "--font-minecraftia",
});

const caress = localFont({
  src: "../../public/fonts/caress.otf",
  variable: "--font-caress",
});

const vensfolk = localFont({
  src: "../../public/fonts/Vensfolk.otf",
  variable: "--font-vensfolk",
});

// Existing Google fonts
const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-bricolage",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-manrope",
});

const lato = Lato({
  subsets: ["latin"],
  weight: ["100", "300", "400", "700", "900"],
  display: "swap",
  variable: "--font-lato",
});

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-caveat",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700","800" ],
  display: "swap",
  variable: "--font-poppins",
});

const plaster = Plaster({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
  variable: "--font-plaster",
});

const patrickHand = Patrick_Hand({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
  variable: "--font-patrick-hand",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-space-grotesk",
});

// 🎀 Kawaii theme fonts
const hachiMaruPop = Hachi_Maru_Pop({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-hachimarupop",
});
const cuteFont = Cute_Font({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-cutefont",
});
const kawaiiBangers = Bangers({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-bangers",
});

// 🕹️ Retro theme fonts
const retroGloria = Gloria_Hallelujah({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-gloria",
});
const comicNeue = Comic_Neue({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  variable: "--font-comicneue",
});

// 🎌 Anime theme fonts
const mochiyPop = Mochiy_Pop_One({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-mochiy",
});
const kosugiMaru = Kosugi_Maru({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-kosugimaru",
});
const baloo2 = Baloo_2({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-baloo2",
});
const yuseiMagic = Yusei_Magic({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-yusei",
});
const pressStart = Press_Start_2P({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-pressstart",
});

// 📓 Journal theme fonts
const gochiHand = Gochi_Hand({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-gochi",
});
const mali = Mali({
  subsets: ["latin"],
  weight: ["300","400","500","600","700"],
  variable: "--font-mali",
});
const elsie = Elsie({
  subsets: ["latin"],
  weight: ["400","900"],
  variable: "--font-elsie",
});
const indieFlower = Indie_Flower({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-indieflower",
});
const kaushan = Kaushan_Script({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-kaushan",
});

// Theme groups
export const themeFonts = {
  kawaii: [hachiMaruPop, cuteFont, kawaiiBangers],
  retro: [retroGloria, comicNeue, kawaiiBangers],
  anime: [mochiyPop, kosugiMaru, baloo2, yuseiMagic, pressStart],
  journal: [gochiHand, mali, elsie, indieFlower, kaushan],
};

export const metadata: Metadata = {
  title: "Keeps",
  description: "A private, playful scrapbook to plan, rant, dream, and collect pretty things.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider
      appearance={{
        theme: "simple",
        variables: {
          colorPrimary: "#6370e3",
          fontFamily: `var(${manrope.variable}), sans-serif`,
        },
        elements: {
          componentContainer: {
            border: "1px solid #e5e5e5",
            fontFamily: `var(${manrope.variable}), sans-serif !important`,
          },
          developmentOrTestModeBox: {
            background: `repeating-linear-gradient(-45deg, transparent, transparent 6px, #7c8bff20 6px, #7c8bff20 12px)`,
            border: "1px solid #7c8bff",
          },
          headerTitle: {
            fontFamily: `var(${manrope.variable}), sans-serif !important`,
          },
        },
      }}
    >
      <html
        lang="en"
        className={`
          ${minecraftia.variable} ${caress.variable} ${vensfolk.variable} 
          ${bricolageGrotesque.variable} ${manrope.variable} ${caveat.variable} 
          ${patrickHand.variable} ${spaceGrotesk.variable} ${poppins.variable} 
          ${plaster.variable} ${lato.variable} 
          ${hachiMaruPop.variable} ${cuteFont.variable} ${kawaiiBangers.variable}
          ${retroGloria.variable} ${comicNeue.variable}
          ${mochiyPop.variable} ${kosugiMaru.variable} ${baloo2.variable} ${yuseiMagic.variable} ${pressStart.variable}
          ${gochiHand.variable} ${mali.variable} ${elsie.variable} ${indieFlower.variable} ${kaushan.variable}
        `}
      >
        <body suppressHydrationWarning className={`${manrope.className} font-sans`}>{children}</body>
      </html>
    </ClerkProvider>
  );
}
