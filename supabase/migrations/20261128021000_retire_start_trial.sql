-- Plus (and its free week) start only through the App Store; the old start_trial() just refuses. Nobody may call it.
revoke execute on function public.start_trial() from authenticated;
