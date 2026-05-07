import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'EstateValue AI',
  description: 'ML-powered real estate valuation and market intelligence dashboard'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
