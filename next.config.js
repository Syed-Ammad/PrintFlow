const dev = process.env.NODE_ENV !== 'production';
const csp = [
  "default-src 'self'", `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "connect-src 'self'",
  "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
].join('; ');
const base = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'same-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];
module.exports = {
  poweredByHeader: false,
  experimental: { serverComponentsExternalPackages: ['better-sqlite3'] },
  async headers() {
    return [
      { source: '/:path*', headers: base },
      // CSP only on pages (API file responses such as PDFs must stay viewable in the browser)
      { source: '/((?!api/).*)', headers: [{ key: 'Content-Security-Policy', value: csp }] },
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ];
  },
};
