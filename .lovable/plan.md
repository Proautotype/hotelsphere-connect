# Give every hotel its own address

Today a hotel page lives at `/hotels/ashanti-palm-hotel` inside the shared Custard
discovery site. After this change each hotel gets its own short address that looks and
feels like that hotel's own website, and the same page will answer on a hotel
subdomain the moment a wildcard domain points at the app.

## What the guest sees

- Short address per hotel: `custardhotels.com/ashanti-palm-hotel`.
- Subdomain ready: `ashantipalmhotel.custard.com` shows the same hotel page
  automatically, with no extra work, once the domain exists and its DNS points here.
- The page becomes the hotel's own storefront: their logo and name in the header,
  their cover photo, their contact details and rooms, their booking box. No Custard
  search bar or Custard menu — just a small "Powered by Custard Hotels" line in the
  footer linking back to the directory.
- Old links keep working: `/hotels/<slug>` permanently redirects to the new short
  address, so nothing already shared breaks.
- The hotel's own address for sharing is shown to the owner on their Settings page so
  they can put it on cards, WhatsApp and Instagram.

## Header and footer on the hotel site

- Header: hotel logo (or hotel name in the display type if no logo), phone number and
  a "Book a room" button that jumps to the booking box.
- Footer: address, phone, email, check-in/out times, cancellation policy, and the
  small Custard credit line.

## Technical notes

- New route file `src/routes/$hotelSlug.tsx` renders the hotel page. It is the last
  matcher, so existing paths (`/discover`, `/auth`, `/register`, `/booking/$reference`,
  `/admin/*`, dashboard routes, `/api/*`) still win. Its loader calls the existing
  `getPublicHotel`; a miss throws `notFound()`.
- The hotel page body moves out of `src/routes/hotels.$slug.tsx` into a shared
  `src/components/discovery/HotelSite.tsx` (props: loader data + slug) so both routes
  render identical markup. `hotels.$slug.tsx` becomes a permanent redirect
  (`beforeLoad` → `redirect({ to: "/$hotelSlug", params, statusCode: 301 })`).
- New `src/components/discovery/HotelShell.tsx` replaces `DiscoveryLayout` on the
  hotel page: hotel-branded header/footer as described above. `DiscoveryLayout` is left
  untouched for `/discover` and the booking confirmation page.
- Subdomain support: in `src/routes/index.tsx` `beforeLoad`, read the request host
  (server side via `getRequest()` from `@tanstack/react-start/server`, client side via
  `window.location.hostname`). If the first label is not `www`, `app`, `project`,
  `id-preview` or the apex itself, look the label up as a hotel slug (comparing against
  the slug with dashes removed too, so `ashantipalmhotel` matches `ashanti-palm-hotel`)
  and render the hotel site at `/`. A small helper
  `src/lib/hotel-host.functions.ts` (`resolveHotelHost`) does the lookup with the
  publishable/admin server client, returning `null` for unknown hosts so the normal home
  page shows.
- `head()` on the new route reuses the current per-hotel title/description/og tags,
  with the canonical URL pointing at the short path.
- No database or permissions changes.

## What still needs the user

Real subdomains need a domain you own (e.g. `custard.com`) connected to this project
plus a wildcard DNS record (`*` → the same target as the root). I can't add DNS records
for you; once you have the domain I'll walk you through the exact record to add. Until
then the short addresses work everywhere.
