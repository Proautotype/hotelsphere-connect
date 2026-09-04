CREATE OR REPLACE FUNCTION public.seed_platform_admin(target_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  IF target_email IS NULL OR length(trim(target_email)) = 0 THEN
    RAISE EXCEPTION 'target_email is required';
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(trim(target_email))
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user found with email %', target_email;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'platform_admin')
  ON CONFLICT DO NOTHING;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.seed_platform_admin(text) TO service_role;