CREATE TABLE public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id uuid NOT NULL REFERENCES public.trees(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE CHECK (length(token) >= 48),
  role text NOT NULL CHECK (role IN ('viewer', 'editor')),
  expires_at timestamptz NOT NULL,
  max_uses integer NOT NULL CHECK (max_uses > 0),
  uses integer NOT NULL DEFAULT 0 CHECK (uses >= 0 AND uses <= max_uses),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX invites_tree_id_created_at_idx ON public.invites(tree_id, created_at DESC);
CREATE INDEX invites_token_idx ON public.invites(token);

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY invites_owner_read
ON public.invites FOR SELECT TO authenticated
USING ((SELECT public.is_tree_owner(tree_id)));

CREATE POLICY invites_owner_add
ON public.invites FOR INSERT TO authenticated
WITH CHECK ((SELECT public.is_tree_owner(tree_id)) AND created_by = (SELECT auth.uid()));

CREATE POLICY invites_owner_revoke
ON public.invites FOR UPDATE TO authenticated
USING ((SELECT public.is_tree_owner(tree_id)))
WITH CHECK ((SELECT public.is_tree_owner(tree_id)) AND revoked);

CREATE TRIGGER invites_touch_updated_fields
BEFORE UPDATE ON public.invites
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_fields();

CREATE OR REPLACE FUNCTION public.accept_invite(invite_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := (SELECT auth.uid());
  invite_row public.invites%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'INVITE_AUTH_REQUIRED';
  END IF;

  SELECT * INTO invite_row
  FROM public.invites AS i
  WHERE i.token = invite_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVITE_INVALID';
  END IF;
  IF invite_row.revoked THEN
    RAISE EXCEPTION 'INVITE_REVOKED';
  END IF;
  IF invite_row.expires_at <= pg_catalog.now() THEN
    RAISE EXCEPTION 'INVITE_EXPIRED';
  END IF;
  IF invite_row.uses >= invite_row.max_uses THEN
    RAISE EXCEPTION 'INVITE_USED';
  END IF;

  INSERT INTO public.tree_members (tree_id, user_id, role, created_by, updated_by)
  VALUES (invite_row.tree_id, current_user_id, invite_row.role, current_user_id, current_user_id)
  ON CONFLICT (tree_id, user_id) DO NOTHING;

  UPDATE public.invites
  SET uses = uses + 1
  WHERE id = invite_row.id;

  RETURN invite_row.tree_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_tree_members(target_tree_id uuid)
RETURNS TABLE(user_id uuid, email text, role text, joined_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT tm.user_id, au.email::text, tm.role, tm.created_at
  FROM public.tree_members AS tm
  LEFT JOIN auth.users AS au ON au.id = tm.user_id
  WHERE tm.tree_id = target_tree_id
    AND (SELECT public.is_tree_owner(target_tree_id))
  ORDER BY CASE tm.role WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END, tm.created_at;
$$;

REVOKE ALL ON TABLE public.invites FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.invites TO authenticated;
GRANT INSERT (tree_id, token, role, expires_at, max_uses, created_by) ON TABLE public.invites TO authenticated;
GRANT UPDATE (revoked) ON TABLE public.invites TO authenticated;

REVOKE ALL ON FUNCTION public.accept_invite(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invite(text) TO authenticated;
REVOKE ALL ON FUNCTION public.list_tree_members(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_tree_members(uuid) TO authenticated;
