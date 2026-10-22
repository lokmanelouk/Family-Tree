WITH ranked_invites AS (
  SELECT id, row_number() OVER (PARTITION BY tree_id, role ORDER BY created_at DESC, id DESC) AS position
  FROM public.invites
  WHERE revoked = false
)
UPDATE public.invites AS i
SET revoked = true
FROM ranked_invites AS r
WHERE r.id = i.id
  AND r.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS invites_one_unrevoked_per_role_idx
ON public.invites (tree_id, role)
WHERE revoked = false;
