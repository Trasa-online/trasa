CREATE OR REPLACE FUNCTION public.generate_referral_codes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  INSERT INTO public.referral_codes (code, owner_id, slot)
  VALUES
    (encode(extensions.gen_random_bytes(5), 'hex'), NEW.id, 1),
    (encode(extensions.gen_random_bytes(5), 'hex'), NEW.id, 2)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;