# Who's who on Custard Hotels — and fixing the demo-hotel confusion

## The two "sides" of the product

Think of it as a marketplace with a landlord:

1. **The platform** = Custard Hotels itself, the company running the site. Its staff are **platform admins**. They don't run any hotel. They approve or reject hotels that apply to join, suspend bad actors, decide which hotels appear on the public search page, and see totals across all hotels.
2. **A hotel** = an independent business with its own private workspace. Its **owner** registers it, and invites **staff** (manager, receptionist, cashier, accountant, housekeeping, restaurant) who only ever see that one hotel.
3. **A customer** = a guest browsing the public search page and booking a room. No dashboard.

## The intended flow

```text
person signs up            -> customer (no hotel)
customer registers a hotel -> hotel is "Pending", owner sees a waiting screen
platform admin reviews it  -> Approve / Reject
approved                   -> owner gets the hotel dashboard, runs onboarding,
                              can invite staff, can be listed on public search
```

Approval is done by a platform admin on the Platform > Hotels page. There is also a platform setting "auto-approve hotels" (currently off) that skips manual review.

## What is actually wrong today

Confirmed by checking the accounts and hotel records:

- The three sample hotels (Custard Bay, Ashanti Palm, Cape Coast) are flagged as demo hotels, and **every signed-in person who is not a platform admin is automatically given access to all three** — both in the app and in the database access rules. That is why a brand-new account appears to "own" hotels. This is the main source of confusion.
- The very first person who ever signs up is silently made a platform admin. Two platform admin accounts exist now, so this rule is no longer needed and is a security risk.
- A new owner whose hotel is still Pending has no clear "waiting for approval" screen explaining what happens next.

## What I'll change

**1. Stop handing hotels to new users**
- Remove the demo-hotel grant from the app and from the database access rules, so access to a hotel comes only from owning it or being invited as staff.
- Keep the three sample hotels alive as public listings for the search page (they stay bookable by guests); they simply stop appearing in anyone's private dashboard.

**2. Make new accounts plain customers**
- New signups always become customers. Platform admin can only be granted by an existing platform admin from Platform > Users.

**3. Make the state of an account obvious**
- Signed in with no hotel: a clear screen — "You don't manage a hotel yet" with "Register your hotel" and "Browse hotels".
- Hotel pending: a waiting screen showing submitted details and "Awaiting approval from Custard Hotels", with no operational menus.
- Hotel rejected or suspended: the reason plus what to do next.

**4. Explain the roles in the product itself**
- Short "how this works" panel on the registration page (register -> review -> approved -> onboard -> invite staff).
- The Platform area gets a one-line description at the top of Hotels so admins know approval is their job.

## Technical notes

- Drop `is_demo_hotel` from `has_hotel_access` and remove the `is_demo` fetch in `fetchHotels` (`src/hooks/useAuth.tsx`); leave the public-listing policies untouched so `/discover` keeps working.
- Rewrite `handle_new_user` to always insert `customer` (keep the pending-staff-invite claim logic).
- Add gating in `src/routes/_authenticated.tsx` / `DashboardShell` for the no-hotel, pending, rejected and suspended states.
- No schema changes beyond the two function replacements.

## Question left open

Should the three sample hotels also be assigned to a real owner account so you can demo the owner dashboard, or stay owner-less public listings only? I'll assume owner-less unless you say otherwise.
