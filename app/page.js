import Link from 'next/link';
export default function Home() {
  return (
    <main className="max-w-md mx-auto p-6 pt-20 space-y-4">
      <h1 className="text-4xl font-bold text-brand">PrintFlow</h1>
      <p className="text-mute">Scan. Upload. Pay. Print.</p>
      <Link className="btn flex items-center justify-center" href="/s/campus-print-point">Open customer page (demo shop)</Link>
      <Link className="btn2 flex items-center justify-center" href="/dashboard">Shopkeeper dashboard</Link>
    </main>
  );
}
