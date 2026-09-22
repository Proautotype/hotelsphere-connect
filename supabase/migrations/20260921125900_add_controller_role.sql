-- School staff sign in with their own app role. This lives in its own migration
-- because a new enum value cannot be used in the transaction that adds it, so
-- everything that references 'controller' has to run afterwards.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'controller';
