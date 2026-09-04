# Seed the first platform admin (backend-only)

## Goal
Give Custard Hotels a safe, developer-controlled way to create the very first platform admin, so the `/admin` area can actually be reached and used to approve hotels and grant admin rights to others.

## Background
- The app has only one login page (`/auth`). Admins log in the same way as hotel owners and customers.
- A user becomes a platform admin when a row with `role = 'platform_admin'` exists in `public.user_roles`.
- The UI at `/admin/users` lets an existing platform admin grant the role to other accounts.
- Today there is no first admin, so the `/admin/users` page can never be opened and no one can ever become admin through the UI.
- New signups no longer receive demo hotels; they only get the `customer` role until they register a hotel or are granted a role.

## What we will build
1. Add a backend-only, security-definer SQL function `seed_platform_admin(target_email text)`.
   - It looks up the account in `auth.users` by email.
   - It inserts `platform_admin` into `public.user_roles` for that user.
   - It is idempotent (`ON CONFLICT DO NOTHING`) and fails loudly if the email does not exist.
2. Run that function once for the target admin email.
3. Do **not** add any UI bootstrap, automatic first-user-admin logic, or public endpoint.

## Operational steps after the migration
1. Create the admin account normally through `/auth` (sign up / sign in) with the target email, e.g. `admin@custardhotels.com`.
2. Run `SELECT seed_platform_admin('admin@custardhotels.com');` against the database.
3. The user can now sign out and sign back in; they will have full access to `/admin`.
4. From `/admin/users` they can grant platform admin to additional accounts.
5. From `/admin/hotels` they can approve, suspend, or reject hotel registrations.

## What will not change
- No separate admin login page.
- No automatic promotion of the first signed-up user.
- No public API or route for gaining admin rights.
- Existing admin pages and role checks remain as they are.
