DROP FUNCTION IF EXISTS public.accept_invite(text);

CREATE FUNCTION public.accept_invite(invite_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := (SELECT auth.uid());
  invite_row public.invites%ROWTYPE;
  already_member boolean;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'INVITE_AUTH_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO invite_row
  FROM public.invites AS i
  WHERE i.token = invite_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVITE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.tree_members AS tm
    WHERE tm.tree_id = invite_row.tree_id
      AND tm.user_id = current_user_id
  ) INTO already_member;

  IF already_member THEN
    RETURN pg_catalog.jsonb_build_object('tree_id', invite_row.tree_id, 'already_member', true);
  END IF;

  IF invite_row.revoked THEN
    RAISE EXCEPTION 'INVITE_REVOKED' USING ERRCODE = 'P0001';
  END IF;
  IF invite_row.expires_at <= pg_catalog.now() THEN
    RAISE EXCEPTION 'INVITE_EXPIRED' USING ERRCODE = 'P0001';
  END IF;
  IF invite_row.uses >= invite_row.max_uses THEN
    RAISE EXCEPTION 'INVITE_USED' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.tree_members (tree_id, user_id, role, created_by, updated_by)
  VALUES (invite_row.tree_id, current_user_id, invite_row.role, current_user_id, current_user_id)
  ON CONFLICT (tree_id, user_id) DO NOTHING;

  UPDATE public.invites
  SET uses = uses + 1
  WHERE id = invite_row.id;

  RETURN pg_catalog.jsonb_build_object('tree_id', invite_row.tree_id, 'already_member', false);
END;
$$;

REVOKE ALL ON FUNCTION public.accept_invite(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invite(text) TO authenticated;
