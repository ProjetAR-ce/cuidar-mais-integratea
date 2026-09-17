import type { Metadata, Viewport } from "next";
import { Baloo_2 } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Cuidar+ · IntegraTEA Crateús", template: "%s · Cuidar+" },
  description: "Plataforma de coordenação do cuidado de pessoas com TEA na rede municipal de Crateús.",
};

export const viewport: Viewport = {
  themeColor: "#fdfbf7",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${baloo.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            classNames: {
              toast: "!rounded-[20px] !border-line !font-sans !shadow-float !text-callout",
              title: "!font-bold !text-ink-strong",
              description: "!text-ink-muted",
            },
          }}
        />
      </body>
    </html>
  );
}
