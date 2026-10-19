BEGIN;

INSERT INTO public.trees (id, name, owner_id, created_by, updated_by)
VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'RLS access test',
  'REPLACE_WITH_OWNER_USER_UUID',
  'REPLACE_WITH_OWNER_USER_UUID',
  'REPLACE_WITH_OWNER_USER_UUID'
);

INSERT INTO public.tree_members (tree_id, user_id, role, created_by, updated_by)
VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'REPLACE_WITH_VIEWER_USER_UUID',
  'viewer',
  'REPLACE_WITH_OWNER_USER_UUID',
  'REPLACE_WITH_OWNER_USER_UUID'
);

INSERT INTO public.people (id, tree_id, first_name, gender, birth_date, created_by, updated_by)
VALUES (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Test Person',
  'female',
  '1982',
  'REPLACE_WITH_OWNER_USER_UUID',
  'REPLACE_WITH_OWNER_USER_UUID'
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.tree_members
    WHERE tree_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      AND user_id = 'REPLACE_WITH_OWNER_USER_UUID'
      AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Tree owner membership was not created automatically.';
  END IF;
END;
$$;

DELETE FROM public.tree_members
WHERE tree_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  AND user_id = 'REPLACE_WITH_OWNER_USER_UUID'
  AND role = 'owner';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'REPLACE_WITH_OWNER_USER_UUID', true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.trees
    WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ) THEN
    RAISE EXCEPTION 'Owner cannot read their tree without a membership row.';
  END IF;
END;
$$;

RESET ROLE;

INSERT INTO public.tree_members (tree_id, user_id, role, created_by, updated_by)
VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'REPLACE_WITH_OWNER_USER_UUID',
  'owner',
  'REPLACE_WITH_OWNER_USER_UUID',
  'REPLACE_WITH_OWNER_USER_UUID'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'REPLACE_WITH_OWNER_USER_UUID', true);

INSERT INTO public.people (id, tree_id, first_name, gender)
VALUES (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Owner Added Person',
  'male'
);

SELECT set_config('request.jwt.claim.sub', 'REPLACE_WITH_VIEWER_USER_UUID', true);

DO $$
DECLARE
  write_denied boolean := false;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.trees
    WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ) THEN
    RAISE EXCEPTION 'Viewer cannot read the tree.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.people
    WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.people
    WHERE id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  ) THEN
    RAISE EXCEPTION 'Viewer cannot read people in the tree.';
  END IF;

  BEGIN
    INSERT INTO public.people (id, tree_id, first_name, gender)
    VALUES (
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'Viewer Write Attempt',
      'male'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    write_denied := true;
  END;

  IF NOT write_denied THEN
    RAISE EXCEPTION 'Viewer write was not denied by row-level security.';
  END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.trees WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') THEN
    RAISE EXCEPTION 'Outsider can read the tree.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.people WHERE tree_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') THEN
    RAISE EXCEPTION 'Outsider can read people in the tree.';
  END IF;
END;
$$;

ROLLBACK;
