CREATE OR REPLACE FUNCTION public.is_valid_genealogy_date(value text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
BEGIN
  IF value IS NULL THEN
    RETURN true;
  END IF;

  IF value !~ '^\d{4}(-\d{2}-\d{2})?$' THEN
    RETURN false;
  END IF;

  IF length(value) = 4 THEN
    RETURN value::integer > 0;
  END IF;

  PERFORM pg_catalog.make_date(
    pg_catalog.substr(value, 1, 4)::integer,
    pg_catalog.substr(value, 6, 2)::integer,
    pg_catalog.substr(value, 9, 2)::integer
  );
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

CREATE TABLE public.trees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid()
);

CREATE TABLE public.tree_members (
  tree_id uuid NOT NULL REFERENCES public.trees(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  PRIMARY KEY (tree_id, user_id)
);

CREATE TABLE public.people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id uuid NOT NULL REFERENCES public.trees(id) ON DELETE CASCADE,
  first_name text NOT NULL CHECK (length(btrim(first_name)) > 0),
  last_name text,
  gender text NOT NULL CHECK (gender IN ('male', 'female')),
  birth_date text CHECK (public.is_valid_genealogy_date(birth_date)),
  death_date text CHECK (public.is_valid_genealogy_date(death_date)),
  deceased boolean NOT NULL DEFAULT false,
  photo_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  UNIQUE (tree_id, id)
);

CREATE TABLE public.parent_links (
  tree_id uuid NOT NULL REFERENCES public.trees(id) ON DELETE CASCADE,
  child_id uuid NOT NULL,
  parent_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('biological', 'adoptive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  PRIMARY KEY (tree_id, child_id, parent_id),
  CHECK (child_id <> parent_id),
  FOREIGN KEY (tree_id, child_id) REFERENCES public.people(tree_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tree_id, parent_id) REFERENCES public.people(tree_id, id) ON DELETE CASCADE
);

CREATE TABLE public.partner_links (
  tree_id uuid NOT NULL REFERENCES public.trees(id) ON DELETE CASCADE,
  person_a uuid NOT NULL,
  person_b uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('married', 'former')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  PRIMARY KEY (tree_id, person_a, person_b),
  CHECK (person_a <> person_b),
  FOREIGN KEY (tree_id, person_a) REFERENCES public.people(tree_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tree_id, person_b) REFERENCES public.people(tree_id, id) ON DELETE CASCADE
);

CREATE INDEX tree_members_user_id_idx ON public.tree_members(user_id);
CREATE INDEX people_tree_id_idx ON public.people(tree_id);
CREATE INDEX parent_links_parent_idx ON public.parent_links(tree_id, parent_id);
CREATE INDEX partner_links_person_b_idx ON public.partner_links(tree_id, person_b);

CREATE OR REPLACE FUNCTION public.touch_updated_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := pg_catalog.now();
  NEW.updated_by := (SELECT auth.uid());
  RETURN NEW;
END;
$$;

CREATE TRIGGER trees_touch_updated_fields
BEFORE UPDATE ON public.trees
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_fields();

CREATE TRIGGER tree_members_touch_updated_fields
BEFORE UPDATE ON public.tree_members
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_fields();

CREATE TRIGGER people_touch_updated_fields
BEFORE UPDATE ON public.people
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_fields();

CREATE TRIGGER parent_links_touch_updated_fields
BEFORE UPDATE ON public.parent_links
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_fields();

CREATE TRIGGER partner_links_touch_updated_fields
BEFORE UPDATE ON public.partner_links
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_fields();

CREATE OR REPLACE FUNCTION public.add_tree_owner_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.tree_members (tree_id, user_id, role, created_by, updated_by)
  VALUES (NEW.id, NEW.owner_id, 'owner', NEW.owner_id, NEW.owner_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trees_add_owner_membership
AFTER INSERT ON public.trees
FOR EACH ROW EXECUTE FUNCTION public.add_tree_owner_membership();

CREATE OR REPLACE FUNCTION public.is_tree_member(target_tree_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tree_members AS tm
    WHERE tm.tree_id = target_tree_id
      AND tm.user_id = (SELECT auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.can_edit_tree(target_tree_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tree_members AS tm
    WHERE tm.tree_id = target_tree_id
      AND tm.user_id = (SELECT auth.uid())
      AND tm.role IN ('owner', 'editor')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_tree_owner(target_tree_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trees AS t
    WHERE t.id = target_tree_id
      AND t.owner_id = (SELECT auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.enforce_parent_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  existing_count integer;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(NEW.tree_id::text || ':' || NEW.child_id::text, 0)
  );

  SELECT count(*)::integer
  INTO existing_count
  FROM public.parent_links AS pl
  WHERE pl.tree_id = NEW.tree_id
    AND pl.child_id = NEW.child_id;

  IF existing_count >= 2 THEN
    RAISE EXCEPTION 'A person can have at most two parents.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER parent_links_enforce_parent_limit
BEFORE INSERT ON public.parent_links
FOR EACH ROW EXECUTE FUNCTION public.enforce_parent_limit();

CREATE OR REPLACE FUNCTION public.canonicalize_partner_pair()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  swap_id uuid;
BEGIN
  IF NEW.person_a > NEW.person_b THEN
    swap_id := NEW.person_a;
    NEW.person_a := NEW.person_b;
    NEW.person_b := swap_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER partner_links_canonicalize_pair
BEFORE INSERT OR UPDATE ON public.partner_links
FOR EACH ROW EXECUTE FUNCTION public.canonicalize_partner_pair();

ALTER TABLE public.trees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tree_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY trees_member_read
ON public.trees FOR SELECT TO authenticated
USING ((SELECT public.is_tree_member(id)) OR owner_id = (SELECT auth.uid()));

CREATE POLICY trees_owner_create
ON public.trees FOR INSERT TO authenticated
WITH CHECK (owner_id = (SELECT auth.uid()) AND created_by = (SELECT auth.uid()));

CREATE POLICY trees_owner_rename
ON public.trees FOR UPDATE TO authenticated
USING ((SELECT public.is_tree_owner(id)))
WITH CHECK ((SELECT public.is_tree_owner(id)) AND owner_id = (SELECT auth.uid()));

CREATE POLICY trees_owner_delete
ON public.trees FOR DELETE TO authenticated
USING ((SELECT public.is_tree_owner(id)));

CREATE POLICY tree_members_member_read
ON public.tree_members FOR SELECT TO authenticated
USING ((SELECT public.is_tree_member(tree_id)));

CREATE POLICY tree_members_owner_add
ON public.tree_members FOR INSERT TO authenticated
WITH CHECK ((SELECT public.is_tree_owner(tree_id)) AND role IN ('editor', 'viewer'));

CREATE POLICY tree_members_owner_change
ON public.tree_members FOR UPDATE TO authenticated
USING ((SELECT public.is_tree_owner(tree_id)) AND role <> 'owner')
WITH CHECK ((SELECT public.is_tree_owner(tree_id)) AND role IN ('editor', 'viewer'));

CREATE POLICY tree_members_owner_remove
ON public.tree_members FOR DELETE TO authenticated
USING ((SELECT public.is_tree_owner(tree_id)) AND role <> 'owner');

CREATE POLICY people_member_read
ON public.people FOR SELECT TO authenticated
USING ((SELECT public.is_tree_member(tree_id)));

CREATE POLICY people_editor_add
ON public.people FOR INSERT TO authenticated
WITH CHECK ((SELECT public.can_edit_tree(tree_id)) AND created_by = (SELECT auth.uid()));

CREATE POLICY people_editor_change
ON public.people FOR UPDATE TO authenticated
USING ((SELECT public.can_edit_tree(tree_id)))
WITH CHECK ((SELECT public.can_edit_tree(tree_id)));

CREATE POLICY people_editor_remove
ON public.people FOR DELETE TO authenticated
USING ((SELECT public.can_edit_tree(tree_id)));

CREATE POLICY parent_links_member_read
ON public.parent_links FOR SELECT TO authenticated
USING ((SELECT public.is_tree_member(tree_id)));

CREATE POLICY parent_links_editor_add
ON public.parent_links FOR INSERT TO authenticated
WITH CHECK ((SELECT public.can_edit_tree(tree_id)) AND created_by = (SELECT auth.uid()));

CREATE POLICY parent_links_editor_change
ON public.parent_links FOR UPDATE TO authenticated
USING ((SELECT public.can_edit_tree(tree_id)))
WITH CHECK ((SELECT public.can_edit_tree(tree_id)));

CREATE POLICY parent_links_editor_remove
ON public.parent_links FOR DELETE TO authenticated
USING ((SELECT public.can_edit_tree(tree_id)));

CREATE POLICY partner_links_member_read
ON public.partner_links FOR SELECT TO authenticated
USING ((SELECT public.is_tree_member(tree_id)));

CREATE POLICY partner_links_editor_add
ON public.partner_links FOR INSERT TO authenticated
WITH CHECK ((SELECT public.can_edit_tree(tree_id)) AND created_by = (SELECT auth.uid()));

CREATE POLICY partner_links_editor_change
ON public.partner_links FOR UPDATE TO authenticated
USING ((SELECT public.can_edit_tree(tree_id)))
WITH CHECK ((SELECT public.can_edit_tree(tree_id)));

CREATE POLICY partner_links_editor_remove
ON public.partner_links FOR DELETE TO authenticated
USING ((SELECT public.can_edit_tree(tree_id)));

REVOKE ALL ON TABLE public.trees, public.tree_members, public.people, public.parent_links, public.partner_links FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT ON TABLE public.trees TO authenticated;
GRANT INSERT (name, owner_id) ON TABLE public.trees TO authenticated;
GRANT UPDATE (name) ON TABLE public.trees TO authenticated;
GRANT DELETE ON TABLE public.trees TO authenticated;

GRANT SELECT ON TABLE public.tree_members TO authenticated;
GRANT INSERT (tree_id, user_id, role) ON TABLE public.tree_members TO authenticated;
GRANT UPDATE (role) ON TABLE public.tree_members TO authenticated;
GRANT DELETE ON TABLE public.tree_members TO authenticated;

GRANT SELECT ON TABLE public.people TO authenticated;
GRANT INSERT (id, tree_id, first_name, last_name, gender, birth_date, death_date, deceased, photo_path) ON TABLE public.people TO authenticated;
GRANT UPDATE (first_name, last_name, gender, birth_date, death_date, deceased, photo_path) ON TABLE public.people TO authenticated;
GRANT DELETE ON TABLE public.people TO authenticated;

GRANT SELECT ON TABLE public.parent_links TO authenticated;
GRANT INSERT (tree_id, child_id, parent_id, kind) ON TABLE public.parent_links TO authenticated;
GRANT UPDATE (kind) ON TABLE public.parent_links TO authenticated;
GRANT DELETE ON TABLE public.parent_links TO authenticated;

GRANT SELECT ON TABLE public.partner_links TO authenticated;
GRANT INSERT (tree_id, person_a, person_b, status) ON TABLE public.partner_links TO authenticated;
GRANT UPDATE (status) ON TABLE public.partner_links TO authenticated;
GRANT DELETE ON TABLE public.partner_links TO authenticated;

REVOKE ALL ON FUNCTION public.is_valid_genealogy_date(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.touch_updated_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_tree_owner_membership() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_tree_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_edit_tree(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_tree_owner(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enforce_parent_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.canonicalize_partner_pair() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_tree_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_tree(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tree_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_valid_genealogy_date(text) TO authenticated;
