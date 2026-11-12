We need to refactor how Tabula handles DeepSeek API calls and user token tracking to fix a security vulnerability where the DeepSeek API key is exposed in the database (`user_api_key` table).

I have already stored `DEEPSEEK_API_KEY` as a Supabase Edge Function Secret. Please implement the following changes across the database, backend, and frontend:

1. **Database Schema & Security (Supabase):**
   - Deprecate/remove the `user_api_key` table so the DeepSeek API key is never stored in a user-accessible table.
   - Create a `user_balances` table (or update the existing user profile table) with `user_id` (foreign key to `auth.users`) and `tokens_remaining` (integer, defaulting to `250000` for new users via a trigger on signup).
   - Enable Row Level Security (RLS) on `user_balances` so authenticated users can only `SELECT` their own balance, and only the `service_role` (backend) can `UPDATE` `tokens_remaining`.

2. **Backend Proxy (Supabase Edge Function):**
   - Create a new Supabase Edge Function named `deepseek-proxy` (or update our existing backend route).
   - Verify the incoming user's Supabase JWT auth token to get their `user_id`.
   - Query `user_balances` using the Supabase `service_role` client to check `tokens_remaining`. If `tokens_remaining <= 0`, return a `403` error stating they have run out of tokens.
   - Retrieve `Deno.env.get('DEEPSEEK_API_KEY')` and forward the user's prompt/messages to the DeepSeek API (`https://api.deepseek.com/chat/completions`).
   - Extract `usage.total_tokens` from DeepSeek's response, subtract that exact amount from the user's `tokens_remaining` in `user_balances` (clamping at `0` so it doesn't go negative), and return the assistant response along with the updated `tokens_remaining` to the frontend.

3. **Frontend Refactor:**
   - Remove all frontend queries to the old `user_api_key` table and remove any client-side calls directly to `api.deepseek.com`.
   - Update the chat/agent service to send requests to our new `deepseek-proxy` Supabase Edge Function, passing the user's active session `Authorization: Bearer <token>` header.
   - Update the UI dashboard to display the user's live `tokens_remaining` from `user_balances` after each query.

Please inspect our current codebase structure first, confirm the exact files you will modify, and then write the SQL migration, the Edge Function code, and the updated frontend API calls.
