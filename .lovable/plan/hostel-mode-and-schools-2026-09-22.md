# Hostel mode, and schools that place students

Custard was built around nightly stays. A hostel does not work that way: a student
pays one fee for a whole semester, shares a room with three other people, and often
has no agreed date for moving out. This change makes that a first-class way to sell
a room, and adds the other side of the arrangement — the school that sends the
students.

## What a hostel owner sees

- **Property type** is now on the Settings page, not just buried in registration. Set
  it to Hostel and an **Accommodation mode** choice appears: short-term stays,
  long-term semester stays, or both.
- A room type can be priced **per night** as before, or as a **flat fee per person for
  the whole stay**. The rooms list shows which, so "GHS 1,800 per stay" sits next to
  "GHS 250 per night".
- A per-stay booking takes **several occupants at once** — one name and contact per
  bed — and **the check-out date is optional**. Leave it empty and the stay runs until
  somebody ends it.
- The booking page gains an **Occupants** section: who is in the room, which bed, what
  they are paying, and whether they have moved in. Each person checks in and out on
  their own. The room only goes back to dirty when the last one leaves.
- **Reception** lists the occupants of a shared room with the same per-person buttons.
- The public hotel page prices a dorm as "per person, per stay" and drops the nightly
  quote.

## What a school sees

Schools are set up by Custard, not by themselves. An administrator creates the school
at **Admin → Schools** and links its staff accounts; if someone has no Custard account
yet, one is made for them there and then.

Those staff get their own workspace at **/school**:

- **Accommodation requests** — how many students, which term, what dates, what budget.
  Saved as a draft, then published to hostels.
- **Offers** come back from hostels with a bed count and a price per student. Accepting
  one declines the rest.
- **Students** — the register, which the school assigns against the accepted offer.
- **Hostels** — who they work with and how many students are placed with each.

The school never handles payment in this version.

## What connects the two

A hostel owner sees published requests at **Schools & allocations** in their dashboard,
offers beds, and once the school has assigned students, checks them in one at a time.

Checking a student in is the seam between the two halves. It creates an ordinary
per-stay booking on the room, adds the student as an occupant, writes the folio line
and marks the room occupied. If a stay is already running in that room on the same
terms, the student joins it instead — so the hostel keeps one folio per room rather
than one per student. The stay ends when the school's period ends, or stays open if
the school gave no end date.

## Technical notes

- `hotels.operating_mode`, `room_types.pricing_model` + `per_stay_price`, and
  `bookings.pricing_model` are new. `bookings.check_out` is now nullable and `nights`
  is a generated column that is null when there is no departure date.
- New `occupancies` table: one row per person in a stay, with their own status and
  check-in/out timestamps. Every existing booking was backfilled with one, mirroring
  its own status.
- `prevent_double_booking()` was relaxed. Per-night rooms keep the old rule exactly.
  Per-stay bookings are exempt both ways, because a dorm is meant to hold several
  stays and because an open-ended stay is an unbounded date range that would
  otherwise lock the room forever. Capacity is enforced in `createBooking` against
  the room type's bed count.
- Seven tables carry the school side: `controllers`, `controller_members`,
  `hotel_controller_affiliations`, `accommodation_requests`, `allocation_offers`,
  `students`, `student_allocations`. Access goes through a new
  `has_controller_access()`, mirroring `has_hotel_access()`. A hostel can read
  published requests and the students allocated to it, and nothing else of a
  school's; a school can read the hostels it is affiliated with.
- `controller` is a new `app_role`, added in its own migration because a new enum
  value cannot be used in the transaction that creates it.
- Property types were stored two ways — Title Case labels from the registration form
  against lowercase slugs everywhere else — so nothing ever matched. They are
  normalised to the slugs in `src/lib/permissions.ts`, which also fixes the type
  filter on `/discover`.

## Not in this version

Schools cannot register themselves. Payment stays at booking level: there is no
per-occupant split. Beds are a free-text label plus a capacity count, not a modelled
inventory. Existing hostel bookings keep their original nightly pricing.
