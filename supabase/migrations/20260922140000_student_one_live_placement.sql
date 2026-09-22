-- A school can now place a student in a hostel directly, without an
-- accommodation request behind it. Those rows carry request_id IS NULL, and
-- Postgres lets UNIQUE (student_id, request_id) hold any number of NULLs — so
-- without this index the same student could be placed in two hostels at once.
-- A student lives in one place at a time; cancelled and checked-out placements
-- release them.
CREATE UNIQUE INDEX student_allocations_one_live
  ON public.student_allocations (student_id)
  WHERE status IN ('proposed', 'confirmed', 'checked_in');
