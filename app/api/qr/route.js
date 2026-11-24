import QRCode from 'qrcode';
export async function GET(req) {
  const slug = new URL(req.url).searchParams.get('slug') || '';
  const host = req.headers.get('host') || '';
  if (!/^[a-z0-9-]{1,60}$/.test(slug) || !/^[\w.-]+(:\d+)?$/.test(host)) return new Response('Bad request', { status: 400 });
  const proto = req.headers.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  const png = await QRCode.toBuffer(`${proto}://${host}/s/${slug}`, { width: 600, margin: 2 });
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
}
