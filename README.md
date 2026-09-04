# HotelSphere Connect

Build a Multi-Tenant Hotel Management & Hotel Discovery Platform

Build a complete, production-ready Hotel Management SaaS Platform that allows multiple independent hotels, guesthouses, resorts, lodges, hostels, and other accommodation businesses to register and manage their businesses from the same platform.

The product has two major sides:

1. Hotel Management System — each registered hotel gets its own private management environment.

2. Central Hotel Discovery & Promotion Platform — the platform owner has a separate administration dashboard to manage all hotels on the platform and promote selected hotels to customers.

The system must be designed from the beginning as a multi-tenant platform. Data, users, bookings, payments, rooms, reports, and settings belonging to one hotel must never be accessible to another hotel unless explicitly authorized by the platform administrator.

---

1. Product Concept

The platform should work like this:

                    HOTEL PLATFORM

                          │

             ┌────────────┴────────────┐

             │                         │

             ▼                         ▼

      HOTEL MANAGEMENT          HOTEL DISCOVERY

          SYSTEM                    PLATFORM

             │                         │

      ┌──────┼──────┐           ┌──────┼──────┐

      ▼      ▼      ▼           ▼      ▼      ▼

    Hotel A Hotel B Hotel C   Search  Promote  Recommend

A hotel owner registers on the platform.

After registration:

- Their hotel account is created.

- Their hotel becomes a tenant.

- They receive access to their hotel dashboard.

- They configure their rooms, pricing, services, staff, and payment methods.

- Their hotel can optionally be listed publicly on the discovery platform.

- The platform administrator can review, approve, promote, feature, suspend, or manage the hotel from a separate platform dashboard.

---

2. User Types

Create the following major user categories.

Platform Administrator

The company/platform owner.

Can:

- View all registered hotels.

- Approve or reject hotels.

- Suspend hotels.

- Manage hotels.

- View platform-wide statistics.

- Manage featured hotels.

- Promote hotels.

- Manage public hotel listings.

- Manage platform users.

- Manage subscription plans.

- Monitor platform payments.

- View platform analytics.

- Manage platform settings.

Hotel Owner

The person/business that registered a hotel.

Can:

- Manage their hotel.

- Manage rooms.

- Manage bookings.

- Manage guests.

- Manage staff.

- Manage payments.

- Manage services.

- Manage pricing.

- Manage reports.

- Configure their hotel.

- Control public visibility.

Hotel Staff

Staff accounts created by the hotel owner.

Roles should include configurable permissions for:

- Manager

- Receptionist

- Cashier

- Accountant

- Housekeeping

- Restaurant staff

- Other staff

---

3. Hotel Registration

Create a public hotel registration process.

The hotel owner should provide:

Account information

- Full name

- Email

- Phone

- Password

Hotel information

- Hotel name

- Hotel description

- Hotel type

- Address

- City

- Region/state

- Country

- Contact number

- Email

- Website

- Logo

- Cover image

- Location

- Number of rooms

Business configuration

- Currency

- Time zone

- Check-in time

- Check-out time

- Tax settings

- Service charge

- Cancellation policy

After registration:

Registration

     ↓

Account Created

     ↓

Hotel Created

     ↓

Hotel Status = Pending

     ↓

Platform Admin Review

     ↓

Approved

     ↓

Hotel Activated

     ↓

Hotel Dashboard

The platform administrator should be able to configure whether hotels are automatically approved or require manual approval.

---

4. Hotel Onboarding

After registering, guide the hotel owner through an onboarding wizard.

Steps:

1. Hotel information

2. Upload logo/cover

3. Configure currency

4. Configure tax

5. Add room types

6. Add rooms

7. Configure room prices

8. Add hotel amenities

9. Configure payment methods

10. Add staff

11. Configure public listing

12. Complete setup

Show onboarding progress.

Example:

Hotel Setup

████████████░░░░ 75%

✓ Hotel information

✓ Room types

✓ Rooms

✓ Pricing

✓ Payment methods

○ Staff

○ Public listing

---

5. Hotel Dashboard

Each hotel should have a dedicated dashboard.

Show:

- Today's bookings

- Today's check-ins

- Today's check-outs

- Current guests

- Available rooms

- Occupied rooms

- Reserved rooms

- Rooms under maintenance

- Today's revenue

- Monthly revenue

- Outstanding payments

- Recent bookings

- Upcoming bookings

- Occupancy rate

Include useful charts for:

- Revenue

- Occupancy

- Bookings

- Payment methods

- Room performance

---

6. Room Management

Hotels should be able to configure their entire room inventory.

Create:

Room Types

Examples:

- Standard Room

- Deluxe Room

- Executive Room

- Suite

- Presidential Suite

Each room type should support:

- Name

- Description

- Maximum guests

- Number of beds

- Bed type

- Base price

- Amenities

- Images

Individual Rooms

Each room should have:

- Room number/name

- Room type

- Floor

- Status

- Notes

Room statuses:

- Available

- Reserved

- Occupied

- Cleaning

- Maintenance

- Out of service

Prevent double booking.

---

7. Booking Management

Implement a complete booking system.

Bookings can originate from:

- Hotel staff

- Hotel website

- Public discovery platform

- Future external booking channels

A booking should contain:

- Guest

- Room

- Check-in date

- Check-out date

- Number of guests

- Room rate

- Additional services

- Discounts

- Taxes

- Total

- Amount paid

- Outstanding balance

- Booking status

Statuses:

- Pending

- Confirmed

- Checked in

- Checked out

- Cancelled

- No-show

Hotel staff should be able to:

- Create booking

- Edit booking

- Cancel booking

- Change dates

- Change room

- Extend stay

- Add guests

- Add services

- Record payment

---

8. Guest Management

Create a guest management system.

Store:

- Name

- Email

- Phone

- Address

- Country

- Identification details where appropriate

- Emergency contact

- Booking history

- Payment history

- Notes

Allow staff to quickly find returning guests.

---

9. Check-In

Create a simple reception check-in workflow.

Example:

Find Booking

     ↓

Verify Guest

     ↓

Confirm Room

     ↓

Record Required Information

     ↓

Record Deposit/Payment

     ↓

Check In

     ↓

Room = Occupied

Generate a check-in confirmation.

---

10. Check-Out

Create a complete checkout process.

At checkout:

- Calculate room charges.

- Add services.

- Add taxes.

- Apply discounts.

- Calculate total.

- Calculate amount paid.

- Calculate outstanding amount.

- Accept final payment.

- Generate receipt.

- Complete booking.

- Change room status to cleaning.

---

11. Hotel Billing

Create a guest folio/billing system.

Charges can include:

- Room

- Food

- Drinks

- Laundry

- Transport

- Room service

- Extra bed

- Conference room

- Spa

- Other hotel services

Every charge should appear on the guest's folio.

Example:

Room               500

Laundry             50

Restaurant          80

Service charge      30

Tax                 66

Discount            -20

----------------------

Total               706

Paid                500

Outstanding         206

---

12. Payment System

Payments are a core part of the application.

Create a flexible payment system that supports multiple payment methods.

Initial payment methods:

- Mobile Money

- Cash

- Bank transfer

- Card

The system should be designed so additional payment providers can be added later without redesigning the booking system.

Every payment should have:

- Payment reference

- Booking

- Guest

- Hotel

- Amount

- Currency

- Payment method

- Payment provider

- Status

- Date

- Transaction metadata

Statuses:

- Pending

- Processing

- Successful

- Failed

- Cancelled

- Refunded

- Partially refunded

---

13. Mobile Money

Mobile Money is particularly important because the platform will operate in Ghana and potentially other African markets.

Support mobile money payments through configurable providers.

The architecture should allow integration with:

- MTN Mobile Money

- Telecel Cash

- AirtelTigo/other supported networks

- Payment aggregators

Do not hardcode one provider into the entire application.

Create a payment-provider abstraction.

A hotel should be able to enable/disable supported payment methods.

Example:

Payment Methods

✓ Mobile Money

✓ Cash

✓ Card

○ Bank Transfer

For Mobile Money:

Customer

   ↓

Select Mobile Money

   ↓

Enter phone number

   ↓

Create payment

   ↓

Mobile Money prompt

   ↓

Customer approves

   ↓

Provider confirms transaction

   ↓

Payment marked successful

   ↓

Booking/Folio updated

   ↓

Receipt generated

The system must verify payment status from the payment provider before considering the payment successful.

Support payment callbacks/webhooks.

Prevent duplicate transactions.

---

14. Cash Payments

Cash must be treated as a proper payment method, not simply a text field.

A cashier/receptionist can record:

- Amount received

- Currency

- Guest

- Booking

- Payment reason

- Date/time

- Staff member receiving payment

Generate a receipt.

Create a cashier/cash-session system.

A cashier should be able to:

Open Cash Session

       ↓

Opening Balance

       ↓

Receive Payments

       ↓

Record Refunds

       ↓

Record Adjustments

       ↓

Close Cash Session

       ↓

Expected Cash

       ↓

Actual Cash

       ↓

Difference

Important cash transactions should be auditable.

Do not allow staff to silently edit completed transactions.

---

15. Invoices and Receipts

Generate professional invoices and receipts.

Documents should include:

- Hotel logo

- Hotel information

- Guest information

- Booking information

- Charges

- Taxes

- Discounts

- Payments

- Balance

- Receipt/invoice number

Allow users to:

- View

- Print

- Download

- Email

---

16. Hotel Services

Allow each hotel to define its own services.

Examples:

- Restaurant

- Laundry

- Airport pickup

- Car rental

- Spa

- Conference room

- Room service

- Extra bed

Each service should have:

- Name

- Description

- Price

- Category

- Active/inactive status

Services can be added to a guest's booking/folio.

---

17. Housekeeping

Create a housekeeping module.

Show rooms by status:

Dirty

Cleaning

Clean

Inspected

Maintenance

Housekeeping staff should be able to update room status from a mobile-friendly interface.

Managers should be able to see housekeeping progress.

---

18. Staff Management

Hotel owners should be able to invite staff.

Create configurable roles and permissions.

Examples:

Manager

Receptionist

Cashier

Accountant

Housekeeping

Restaurant Staff

Permissions should include:

View bookings

Create bookings

Modify bookings

Cancel bookings

View payments

Create payments

Refund payments

View guests

Manage rooms

Manage services

View reports

Manage staff

Manage hotel settings

Hotel owners should not have to give every staff member full access.

---

19. Public Hotel Discovery

The platform should have a public-facing hotel discovery section.

This is separate from the private hotel management dashboard.

Visitors should be able to:

- Search hotels

- Browse hotels

- Filter hotels

- View hotel profiles

- View rooms

- View prices

- View amenities

- View photos

- View location

- Check availability

- Make bookings

Search/filter options should include:

- Location

- Price

- Hotel type

- Rating

- Amenities

- Availability

- Number of guests

---

20. Public Hotel Profile

Each publicly listed hotel should have a professional profile page.

Include:

- Hotel name

- Photos

- Description

- Location

- Contact information

- Amenities

- Room types

- Prices

- Availability

- Reviews

- Policies

- Map/location

Example:

--------------------------------

         HOTEL NAME

--------------------------------

[ Cover Image ]

★★★★★ 4.7

Location

Amenities

Rooms

Reviews

From GHS XXX / night

[ Check Availability ]

[ Book Now ]

--------------------------------

---

21. Hotel Visibility

Hotels should have control over their public presence.

Settings:

Public listing: ON/OFF

Accept online bookings: ON/OFF

Show prices: ON/OFF

Show availability: ON/OFF

The platform administrator should still have final control over whether a hotel is visible.

Hotel statuses:

- Pending

- Active

- Suspended

- Rejected

- Archived

---

22. Hotel Promotion

The platform owner should be able to promote hotels registered on the platform.

Create a promotion system.

Promotion types:

- Featured hotel

- Recommended hotel

- Sponsored hotel

- Special offer

- Discount campaign

- Homepage placement

- Location-based promotion

The platform administrator should be able to select:

- Hotel

- Promotion type

- Start date

- End date

- Priority

- Placement

- Status

Example homepage:

Featured Hotels

[ Hotel A ] [ Hotel B ] [ Hotel C ]

Recommended for you

[ Hotel D ] [ Hotel E ]

The promotion system should be designed for future monetization.

---

23. Platform Administration Dashboard

Create a completely separate platform administration dashboard.

This dashboard belongs to the company operating the SaaS platform.

It should provide:

Overview

- Total hotels

- Active hotels

- Pending hotels

- Suspended hotels

- Total users

- Total bookings

- Total revenue

- Platform revenue

- Total rooms

- Occupancy across platform

Hotel management

- View hotels

- Search hotels

- Approve

- Reject

- Suspend

- Reactivate

- Feature

- Promote

- View performance

Users

- View users

- Manage platform administrators

- View hotel owners

- Manage access

Promotions

- Create promotions

- Manage featured hotels

- Manage campaigns

Analytics

- Hotel registrations

- Booking trends

- Revenue trends

- Most-booked hotels

- Highest-performing hotels

- Popular locations

- Platform growth

---

24. Platform vs Hotel Data

Clearly separate platform-level and hotel-level data.

A hotel owner should only see:

Their hotel

Their rooms

Their staff

Their guests

Their bookings

Their payments

Their reports

Their settings

The platform administrator can see platform-wide information.

For example:

Hotel A

 └── Cannot see Hotel B

Hotel B

 └── Cannot see Hotel A

Platform Admin

 ├── Hotel A

 ├── Hotel B

 └── Hotel C

This is a critical requirement.

---

25. Subscription Plans

Prepare the platform for SaaS subscriptions.

Create configurable plans such as:

Starter

- Limited rooms

- Limited staff

- Basic booking management

- Basic reports

Professional

- More rooms

- More users

- Online bookings

- Mobile money

- Advanced reports

- POS/services

Enterprise

- Unlimited/large room capacity

- Advanced analytics

- Multiple branches

- Advanced integrations

- Priority support

The platform administrator should be able to create and modify subscription plans.

---

26. Notifications

Implement notifications for:

- New registration

- Hotel approval

- Hotel rejection

- New booking

- Booking cancellation

- Payment received

- Payment failure

- Upcoming check-in

- Upcoming checkout

- Subscription expiration

Support:

- In-app notifications

- Email

- SMS-ready architecture

---

27. Reviews

Allow guests to review hotels after completed stays.

Reviews include:

- Rating

- Comment

- Date

- Guest

- Hotel

Hotels can respond to reviews.

Platform administrators can:

- Moderate reviews

- Hide inappropriate reviews

- Restore reviews

---

28. Reports

Hotel administrators should have access to:

Financial

- Revenue

- Payments

- Cash payments

- Mobile money payments

- Outstanding balances

- Refunds

Operations

- Occupancy

- Bookings

- Cancellations

- Check-ins

- Check-outs

- No-shows

Rooms

- Room performance

- Most-booked rooms

- Revenue per room

Guests

- New guests

- Returning guests

- Guest history

Allow exports where appropriate.

---

29. Platform Analytics

The platform administrator should have analytics across all hotels.

Examples:

Hotels registered this month

Bookings this month

Revenue this month

Active hotels

Hotel growth

Booking growth

Most popular locations

Top-performing hotels

Most popular room types

Payment method usage

Provide charts and filtering by:

- Date

- Hotel

- Location

- Booking status

- Payment method

---

30. Search and Discovery

The public platform should have a strong search experience.

Users should be able to search:

Where?

Check-in

Check-out

Guests

Then show available hotels.

Example:

Search Hotels

Location: Accra

Check-in: 12 Oct

Check-out: 15 Oct

Guests: 2

[ Search ]

Results should show:

- Hotel image

- Hotel name

- Rating

- Location

- Amenities

- Available rooms

- Price

- Promotions

---

31. Booking Through Discovery Platform

A customer should be able to book a hotel directly from the public platform.

Flow:

Discover Hotel

      ↓

Select Dates

      ↓

Select Room

      ↓

Enter Guest Information

      ↓

Review Booking

      ↓

Select Payment

      ↓

Pay

      ↓

Booking Confirmed

      ↓

Hotel Receives Reservation

The booking should automatically appear inside the hotel's private dashboard.

---

32. Customer Account

Create a customer-facing account system.

Customers should be able to:

- Register

- Login

- View bookings

- Cancel bookings where allowed

- View payment history

- Download receipts

- Manage profile

- Review hotels

- View upcoming stays

---

33. Audit and Security

All important actions should be auditable.

Track:

- User

- Hotel

- Action

- Resource

- Date/time

- Previous value

- New value

Especially audit:

- Payments

- Refunds

- Cash transactions

- Booking changes

- Staff permissions

- Hotel settings

- Platform administrator actions

Security must prevent one hotel from accessing another hotel's information.

---

34. Responsive Design

The application must work well on:

- Desktop

- Tablet

- Mobile

Hotel receptionists and housekeeping staff should be able to use the application comfortably on phones/tablets.

The platform admin dashboard can prioritize desktop/tablet usage.

---

35. UI/UX

Create a professional SaaS product rather than a basic CRUD application.

Use:

- Modern dashboard

- Sidebar navigation

- Responsive tables

- Cards

- Charts

- Filters

- Search

- Pagination

- Modals

- Forms

- Confirmation dialogs

- Toast notifications

- Loading states

- Empty states

- Error states

Keep the interface simple enough for hotel staff who may not be technically advanced.

---

36. Main Navigation

Public Platform

Home

Hotels

Featured Hotels

Offers

About

Pricing

Login

Register Your Hotel

Hotel Dashboard

Dashboard

Reservations

Calendar

Rooms

Guests

Check-in

Check-out

Billing

Payments

Services

Housekeeping

Staff

Reports

Settings

Platform Admin

Dashboard

Hotels

Users

Bookings

Payments

Subscriptions

Promotions

Reviews

Analytics

Settings

---

37. Important Business Rules

Implement these rules carefully:

1. A hotel cannot access another hotel's data.

2. A room cannot be double-booked for overlapping dates.

3. A booking cannot be checked in if it is cancelled.

4. A booking cannot be checked out before being checked in unless explicitly configured.

5. Payment status must be verified server-side.

6. Mobile money transactions must support asynchronous confirmation.

7. Duplicate payment callbacks must not create duplicate payments.

8. Cash transactions must be auditable.

9. Completed financial transactions should not be silently edited.

10. Hotel owners control their own hotel configuration.

11. Platform administrators control platform-level visibility.

12. Suspended hotels cannot accept new public bookings.

13. Public hotel listings must respect hotel/platform visibility settings.

14. Prices must be calculated from server-side hotel configuration.

15. Taxes and service charges must be calculated consistently.

16. All bookings must have a unique booking reference.

17. All payments must have unique transaction references.

18. All invoices and receipts must have unique numbers.

---

38. Seed/Demo Data

Create realistic demo data so the application can be tested immediately.

Include:

- Platform administrator

- Several demo hotels

- Hotel owners

- Hotel staff

- Room types

- Rooms

- Guests

- Bookings

- Payments

- Services

- Promotions

- Reviews

Create at least:

3 demo hotels

20+ rooms

20+ guests

20+ bookings

Multiple payment records

Multiple room types

Several services

Several promotions

---

39. Build Strategy

Do not create everything as one giant screen or one monolithic feature.

Build the application as clearly separated modules:

Authentication

       ↓

Multi-Tenancy

       ↓

Hotel Management

       ↓

Room Management

       ↓

Booking Management

       ↓

Guest Management

       ↓

Billing

       ↓

Payments

       ↓

Hotel Operations

       ↓

Public Discovery

       ↓

Promotions

       ↓

Subscriptions

       ↓

Analytics

Make each module reusable and maintainable.

---

40. Most Important Requirement

The product should feel like two connected products built on one platform:

Product 1 — Hotel Management Software

Hotels pay/use the platform to run their business:

Rooms

Bookings

Guests

Reception

Billing

Payments

Cash

Mobile Money

Staff

Housekeeping

Reports

Product 2 — Hotel Discovery Platform

Customers use the platform to find hotels:

Search

Discover

Compare

View

Book

Pay

Review

The company operating the platform sits above both:

                 PLATFORM COMPANY

                        │

          ┌─────────────┴─────────────┐

          │                           │

          ▼                           ▼

 HOTEL MANAGEMENT SaaS        HOTEL DISCOVERY

          │                           │

   ┌──────┼──────┐              Customers

   │      │      │

 Hotel A Hotel B Hotel C

The long-term goal is to build a network of hotels using the software while simultaneously making those hotels discoverable to customers.

The architecture must therefore support future business models such as:

- Hotel SaaS subscriptions

- Booking commissions

- Featured hotel placements

- Paid promotions

- Special offers

- Premium hotel listings

- Payment processing fees

- Enterprise hotel plans

Build the foundation correctly so these capabilities can be added without rewriting the core system.

Start by designing the application structure, database entities, user roles, tenant boundaries, navigation, and core workflows. Then implement the system incrementally, beginning with authentication, hotel registration, multi-tenancy, hotel onboarding, and the separate platform/hotel dashboards.
-----
App name : Custard Hotels

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/35fee4d5-1d26-424b-b6f6-1aa224e51114).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
