# Clear role separation + a real platform control centre

## 1. Fix the security hole first (highest priority)

Today the Users page has a "Make admin" button next to every account and a free-text
"add platform admin by email" box. One wrong click turns a hotel owner into a platform
admin with power over every business on the platform. Changes:

- **Two separate concepts, never mixed:**
  - *Platform team* (runs Custard Hotels): platform admin, plus a new read-only
    "platform support" level that can view and help but cannot change money settings,
    approve hotels, or grant roles.
  - *Hotel people* (run their own hotel): hotel owner and the staff the owner invites.
    A hotel owner can never be promoted from the Users list.
- The Users page becomes read-only for hotel accounts: you see who they are, which
  hotels they belong to, and their role there — no promote button.
- Promoting someone to the platform team moves to its own **Platform team** page:
  - the account must already exist,
  - you must type their full email to confirm,
  - the account cannot own or work at any hotel (a guard blocks owners/staff),
  - at least one platform admin must always remain,
  - every grant/revoke is written to the audit trail with who did it.
- The same guards are enforced in the backend, not just in the screen, so nothing can
  be bypassed.

## 2. Let each hotel manage its own people

The staff area already exists; it gets finished so a business is self-sufficient:

- Owner can invite staff by email, pick a job title, and tick exactly what each person
  may do (bookings, payments, refunds, rooms, guests, reports, settings).
- New "hotel admin" job title: full control of that hotel, including inviting other
  staff, but nothing outside that hotel.
- Owner can suspend, re-activate, or remove a member, and change their permissions
  at any time. Suspended people lose access immediately.
- Every screen and every backend action re-checks the permission, so a receptionist
  cannot reach payments even by typing the address directly.

## 3. Hotels manage their own data

- **Export**: bookings, guests, payments and folio charges downloadable as CSV for the
  selected date range (owner / hotel admin only).
- **Edit and correct**: guest records and booking notes editable with an audit entry.
- **Delete requests**: a hotel can request removal of its own data; the request appears
  in the platform admin queue rather than deleting silently.

## 4. Platform admin control centre

### Money and plans
- **Subscription plans**: platform admin defines plans (name, price, billing period —
  monthly, quarterly, annually, room-count limits, features). Each hotel is put on a
  plan; the plan renewal date and status (trial, active, past due, cancelled) show on
  the hotel record and on the hotel's own settings page.
- **Registration fee**: a one-off joining fee configurable per plan, shown to the hotel
  during registration and marked paid/unpaid by the platform admin.
- **Commission**: percentage taken from online (discovery) bookings, set platform-wide
  with an optional per-hotel override. Every discovery booking records the commission
  amount at the time of booking, so nothing changes retroactively.
- **Payouts / statements**: per-hotel statement showing collected online revenue,
  commission owed, subscription charges, and balance, for any month.

### Advertising and promotion
- Hotels submit an **ad request** (feature on the home page, top of search, banner) with
  the dates they want and see a price. Platform admin reviews, approves, or declines
  with a reason. Approved and paid requests automatically drive the "featured" slots on
  the public discovery pages — replacing today's manual featured toggle.

### Platform configuration
- Payment setup: which providers are enabled platform-wide and the settings for each.
- Platform identity: name, support email, approval mode (already exists, kept).
- Fees and commission defaults, plan catalogue, ad price list.
- Full audit trail of every platform action (already exists, extended to new actions).

## 5. Order of work

1. Security fix and role separation (sections 1 and 2) — done first, on its own.
2. Plans, registration fee, commission and hotel statements.
3. Ad requests plus wiring featured slots on discovery to approved ads.
4. Hotel data export, edits and delete requests.

## Technical notes

- New role value `platform_support` on the existing `app_role` type; hotel job titles
  stay on `hotel_members.staff_role` with a new `hotel_admin` value. Roles stay in their
  own table — never on profiles.
- A database check prevents a single account from holding both a platform role and a
  hotel membership/ownership.
- New tables: `plans`, `hotel_subscriptions`, `invoices`, `ad_requests`,
  `data_requests`; commission columns on `bookings`; fee/commission defaults on
  `platform_settings`. Each with row-level security so a hotel only ever sees its own
  rows and the platform team sees all.
- All privileged actions run through authenticated server functions that verify the
  caller's platform role before touching anything.
