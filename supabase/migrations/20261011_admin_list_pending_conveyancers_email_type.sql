-- auth.users.email is varchar(255), but this function declares signup_email as
-- text. RETURN QUERY does not coerce, so every call failed with "structure of
-- query does not match function result type" and the admin Conveyancers tab
-- could never load. Cast the column; the rest of the body is unchanged.
CREATE OR REPLACE FUNCTION public.admin_list_pending_conveyancers()
 RETURNS TABLE(id uuid, practice_name text, clc_id text, email text, postcode text, business_type text, address text, signup_email text, signup_at timestamp with time zone, clc_verified boolean, clc_verified_claimed_by_applicant boolean, register_practice_name text, email_domain_matches_register boolean, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
BEGIN
  IF NOT public.is_propxchain_admin() THEN
    RAISE EXCEPTION 'not authorised' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT
      cp.id, cp.practice_name, cp.clc_id, cp.email, cp.postcode,
      cp.business_type, cp.address,
      u.email::text AS signup_email,
      u.created_at AS signup_at,
      -- Server-derived: does this clc_id actually exist in our register snapshot?
      (cl.clc_id IS NOT NULL) AS clc_verified,
      -- What the applicant asserted at signup. Advisory only, never trusted.
      COALESCE(
        (u.raw_user_meta_data #> '{propxchain_pending_conveyancer_firm,clc_verified}')::boolean,
        false
      ) AS clc_verified_claimed_by_applicant,
      cl.practice_name AS register_practice_name,
      -- Does the signup email domain match the practice's registered domain?
      (
        cl.email IS NOT NULL
        AND u.email IS NOT NULL
        AND lower(split_part(u.email, '@', 2)) = lower(split_part(cl.email, '@', 2))
      ) AS email_domain_matches_register,
      cp.created_at
    FROM public.conveyancer_panel cp
    LEFT JOIN auth.users u ON u.id = cp.auth_user_id
    LEFT JOIN public.clc_practices cl ON cl.clc_id = cp.clc_id
    WHERE cp.pending_review = true
    ORDER BY cp.created_at DESC;
END;
$function$;
