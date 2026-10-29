-- Explicit deny policy documents that quota rows are never a client API.
-- No table grants; only the checked private DEFINER function can modify counters.
create policy mx_ai_no_client_access on mirror_x.ai_usage for all to authenticated using(false) with check(false);
