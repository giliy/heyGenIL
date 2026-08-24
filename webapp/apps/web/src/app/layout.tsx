import type { Metadata } from 'next';
import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display', weight: ['500', '600', '700'] });
const body = Inter({ subsets: ['latin'], variable: '--font-body', weight: ['400', '500', '600'] });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', weight: ['400', '500', '700'] });

export const metadata: Metadata = {
  title: 'Shorts Studio',
  description: 'Faceless shorts factory',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="bg-paper text-ink antialiased">
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
