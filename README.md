# PrintFlow - Phase 1 + Phase 2 (local demo)

Next.js 14 + SQLite + Tailwind. Runs fully on your laptop.

## Run
    npm install
    npm run dev          # or: npm run build && npm start

On FIRST RUN the terminal prints the shopkeeper login (email owner@printflow.local + a random password).
Open /dashboard once, then look at the terminal. To choose your own password up front:

    DASH_PASSWORD=YourStrongPass npm run dev
    (Windows PowerShell:  $env:DASH_PASSWORD="YourStrongPass"; npm run dev)

To reset everything: stop the server and delete the `data` folder.

- Customer page:  http://localhost:3000/s/campus-print-point
- Shopkeeper:     http://localhost:3000/dashboard

## Demo on phones (same Wi-Fi or phone hotspot)
1. Find the laptop IP (`ipconfig` / `ip a`), e.g. 192.168.1.20
2. Open http://192.168.1.20:3000/dashboard on the laptop -> Shop tab (QR code). The QR uses the address you opened.
3. Scan with a phone. Allow Node.js through the Windows firewall.
4. Open the dashboard on a second phone too (bottom tabs, big buttons). "Add to Home Screen" makes it feel like an app.

## Phase 2 features
- Real accounts: hashed passwords, expiring sessions, logout, change password
- Order queue: Approve, Start printing, Ready, Hand over; Hold/Resume; Urgent priority; Cancel with reason
- Payment: cash pending / paid / refunded; hand-over is blocked until payment is received
- Shop controls: accepting-orders switch (customers see "Closed"), minutes per order (waiting time), file retention
- Pricing editor with live example; reports (7-day cash, busiest hours, B&W vs colour pages); activity log
- New-order sound, vibration and tab badge; customer notification + vibration when the order is ready

## Security (done in the code)
- Passwords: scrypt hashes; random session token in HttpOnly + SameSite=Strict cookie (only its hash stored); 12 h expiry
- Login: rate limit per IP and per email, same error for unknown email, constant-time compare
- CSRF: SameSite=Strict + Origin check on every write request
- Order privacy: tracking needs a secret random token, not just the sequential order number
- Uploads: real file signature checked (PDF/JPG/PNG), random stored names, cleaned file names, nosniff, size/page/count limits
- Price tampering: server recalculates every price; settings are whitelisted; prices clamped
- Cross-shop access: every admin query is filtered by the logged-in shop
- Status rules: server-side state machine; unpaid orders cannot be collected
- Privacy: files deleted when collected/cancelled and after retention hours (default 48)
- Headers: CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy; no X-Powered-By
- Audit log: login, status, payment, price, password changes, file opens

## Before real internet deployment (not done yet)
- HTTPS + COOKIE_SECURE=1, behind a reverse proxy (Caddy/Nginx) that sets x-forwarded-for correctly
- PostgreSQL + private object storage for multiple shops/servers; automated backups
- Password reset by email/SMS; staff roles (Phase 4); antivirus scan of uploads; run `npm audit`
- Online payments: verify the gateway callback signature on the server, never trust the browser

## Folder map
lib/pricing.js (price + validation, shared) - lib/status.js (order rules) - lib/auth.js, guard.js, limit.js (security)
lib/db.js (tables, seed, cleanup) - app/api/* (backend) - app/s/[slug] (customer) - app/track/[no] - app/dashboard
