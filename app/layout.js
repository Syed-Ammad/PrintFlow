import './globals.css';
export const metadata = { title: 'PrintFlow', description: 'Scan. Upload. Pay. Print.' };
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#2563EB' };
export default function RootLayout({ children }) {
  return (<html lang="en"><body>{children}</body></html>);
}
