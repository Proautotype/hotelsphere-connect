# Custard Hotels — Phase 1: Foundation & Core Operations

A multi-tenant hotel platform: hotels run their business in private dashboards, and the platform company oversees every hotel from a separate admin dashboard.

Phase 1 delivers the foundation plus day-to-day hotel operations. Public discovery, promotions, reviews, subscriptions billing, and full reporting come in later phases on top of this same schema.

## What Phase 1 includes

**Accounts & roles**
- Email/password sign-up and login, plus Google sign-in.
- Four audiences: platform admin, hotel owner, hotel staff (Manager, Receptionist, Cashier, Accountant, Housekeeping, Restaurant), and customer.
- Roles live in a dedicated roles table, never on profiles, so permissions can't be self-escalated.
- Staff invitations by the hotel owner with per-role permission toggles (view/create/modify/cancel bookings, payments, refunds, guests, rooms, services, reports, staff, settings).

**Hotel registration & approval**
- Public "Register your hotel" flow: owner account details, hotel details (name, description, type, address, city, region, country, contacts, website, logo, cover, room count), and business configuration (currency, timezone, check-in/out times, tax, service charge, cancellation policy).
- New hotels land in Pending. Platform admin approves, rejects, suspends, reactivates, or archives. A platform setting switches between auto-approval and manual review.

**Onboarding wizard**
- Guided steps with a saved progress bar: hotel info → logo/cover → currency → tax → room types → rooms → pricing → amenities → payment methods → staff → public listing → done. Owners can leave and resume.

**Hotel dashboard**
- Today's bookings, check-ins, check-outs, in-house guests, room status counts (available/reserved/occupied/cleaning/maintenance/out of service), today's and monthly revenue, outstanding balances, occupancy rate, recent and upcoming bookings.
- Charts: revenue trend, occupancy trend, bookings, payment-method mix, room performance.

**Rooms**
- Room types (name, description, max guests, beds, bed type, base price, amenities, images) and individual rooms (number, type, floor, status, notes).

**Bookings**
- Create/edit/cancel, change dates, change room, extend stay, add guests and services, record payments.
- Statuses: pending, confirmed, checked in, checked out, cancelled, no-show. Unique booking reference per booking.
- Server-side overlap check makes double-booking impossible; totals, taxes, and service charges are always computed server-side from the hotel's configuration.

**Guests**
- Profile with contacts, address, country, ID details, emergency contact, notes, plus booking and payment history. Fast search for returning guests.

**Reception**
- Check-in: find booking → verify guest → confirm room → record details → take deposit → check in (room becomes occupied), with a printable confirmation.
- Check-out: room charges + services + tax − discounts → balance → final payment → receipt → room becomes cleaning.

**Folio, invoices, receipts**
- Line-item folio per booking (room, food, drinks, laundry, transport, room service, extra bed, conference, spa, other).
- Printable/downloadable invoices and receipts with hotel branding and unique numbers.

**Payments (Paystack + cash)**
- Provider-abstraction layer so more providers slot in later; per-hotel toggles for Mobile Money, Cash, Card, Bank Transfer.
- Paystack integration for Ghana Mobile Money (MTN, Telecel, AirtelTigo) and cards: initialize charge → customer approves on phone → webhook + server-side verification marks the payment successful → folio and booking update → receipt. Duplicate callbacks can never create duplicate payments.
- Cash sessions: open with a float, record payments/refunds/adjustments, close with expected vs actual and the difference recorded. Completed financial records are never silently edited — corrections are new, audited entries.

**Housekeeping**
- Mobile-first room status board (dirty → cleaning → clean → inspected → maintenance) with manager progress view.

**Platform admin dashboard**
- Separate area: platform overview stats, hotel list with search and approve/reject/suspend/reactivate actions, hotel performance, user management, platform settings (including the auto-approval switch).

**Notifications & audit**
- In-app notifications for registration, approval/rejection, new booking, cancellation, payment received/failed, upcoming check-in/out. Email-ready, SMS-ready.
- Audit log capturing user, hotel, action, resource, timestamp, previous and new values for payments, refunds, cash, booking changes, permissions, and settings changes.

**Demo data**
- Seeded platform admin, 3 hotels with owners and staff, multiple room types, 20+ rooms, 20+ guests, 20+ bookings across statuses, and payment records. Registration also stays open for new hotels and customers.

## Design

Teal hospitality: deep teal (#0F4C46) primary, sand (#E8DCC8) surfaces, warm amber (#D98A3C) accent, white cards. Sidebar dashboards, dense responsive tables, cards, charts, filters, pagination, modals, confirmation dialogs, toasts, and proper loading/empty/error states. Everything works on phone, tablet, and desktop; housekeeping and reception screens are designed phone-first.

## Technical notes

- Lovable Cloud (Postgres + auth + storage + server functions) is enabled for this project.
- Tenant isolation is enforced in the database with row-level security: every hotel-scoped table carries `hotel_id`, and policies grant access only through a membership check against the signed-in user's hotel. Platform admins are allowed through a separate security-definer role check. No hotel can read another hotel's rows even if the UI is bypassed.
- All money, availability, tax, and status logic runs in server functions — never in the browser.
- Paystack webhooks land on a public API route with signature verification and idempotency keys on transaction references.
- Paystack requires your secret and public keys; I'll request them securely when the payment module is wired, and cash-only flows work until then.
- Modules are built in order: auth & tenancy → hotel registration/approval → onboarding → rooms → bookings/guests → reception → folio/payments → housekeeping → platform admin.

## Not in Phase 1

Public hotel discovery and search, public hotel profile pages, customer-facing booking and account area, promotions/featured hotels, reviews, subscription plans and platform billing, and the deep reports/analytics suite. The schema and permissions are built so these attach without rework.
