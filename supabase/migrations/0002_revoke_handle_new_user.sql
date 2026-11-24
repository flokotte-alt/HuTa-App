-- Der Trigger-Funktion duerfen angemeldete Nutzer nicht direkt aufrufen.
revoke execute on function public.handle_new_user() from authenticated, anon, public;
