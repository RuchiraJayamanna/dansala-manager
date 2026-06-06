
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

ALTER TABLE public.master_options ADD CONSTRAINT master_options_type_value_unique UNIQUE (option_type, value);
