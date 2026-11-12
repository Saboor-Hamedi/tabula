# Migrations

The schema for the Tabula backend, one file per feature. Apply them in order.

| File | What it holds |
| --- | --- |
| `accounts.sql` | `profiles`, `subscriptions`, `usage_ledger`, the enums, the signup trigger and the indexes |
| `roles.sql` | `public.app_role`, `public.is_admin()`, the guard that stops a member promoting themselves |
| `posts.sql` | `posts`, `post_images`, their RLS policies, the view counter and the `published_posts` feed |
| `media.sql` | the `post-media` storage bucket and its policies |
| `admin.sql` | `profiles.last_sign_in_at` and the two policies that let an administrator read members and subscriptions |
| `api_keys.sql` | `user_api_keys` — admin-only platform model key (backend `service_role` only) |
| `trial_and_security.sql` | idempotent upgrade script for 7-day trials, token usage RPC, and admin-only API key lockdown |
| `queries.sql` | the exact requests the app issues, next to the schema they depend on |

## Applying

```bash
# With the Supabase CLI
supabase db push

# Or: Supabase Dashboard -> SQL Editor, run them in the order above.
```

Every statement is idempotent (`if not exists`, `drop policy if exists`,
`on conflict do nothing`), so running a file twice is safe.

## After applying

Promote the account that should be able to publish:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

Check the roles:

```sql
select id, email, display_name, role, last_sign_in_at
  from public.profiles order by created_at;
```

## The posts feature in one paragraph

An administrator asks Tabula a question, gets an answer, and clicks **Publish**
once. The answer is stored as a post: the raw markdown plus the parsed render
blocks (markdown, mermaid, chart, table), an optional cover image and gallery,
tags and a reading time. The front page reads published posts through the
`published_posts` view and draws them with the same components the workspace
uses, so a Mermaid diagram or a chart looks identical in both places. Only
`public.is_admin()` may write.

## Platform API key (admin-only)

Only administrators may set, view (masked), or remove the platform model key
from Settings (`user_api_keys`). Direct browser access to `public.user_api_keys`
is revoked via RLS; all key reads and writes go through the backend proxy
(`/api/admin/key`) using `SUPABASE_SERVICE_ROLE_KEY`, encrypted at rest.

Without Supabase configured the app still runs — publishing is simply hidden
and the front page shows an empty state.
