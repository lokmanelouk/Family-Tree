# Supabase database setup

1. In the Supabase dashboard, open SQL Editor and run `migrations/20261019000100_family_tree_schema.sql`.
2. In Authentication → Users, create two test users. Use one as the tree owner and one as the viewer. Copy each user's UUID from the Users list.
3. Open `tests/rls_access.sql` and replace every `REPLACE_WITH_OWNER_USER_UUID` with the owner's UUID and every `REPLACE_WITH_VIEWER_USER_UUID` with the viewer's UUID. The outsider UUID is a test-only UUID and must not belong to either user or any tree member.
4. Run `tests/rls_access.sql` in SQL Editor. It checks automatic owner membership, owner access and writes, viewer reads and denied writes, and outsider isolation. The test rolls back its fixtures when it finishes.
5. Copy the project URL and public anon key from Project Settings → API into the matching entries in the local `.env` file. Never put a `service_role` key in the browser app.

The migration grants table privileges to `authenticated` only, then uses RLS policies to restrict each operation by tree membership and role. Viewers can read; owners and editors can edit people and links; only owners can rename or delete trees and manage members.
