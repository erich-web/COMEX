-- Endurecimento de segurança (advisors do Supabase)
-- Nenhuma RPC é pública: só usuários autenticados chamam (as funções ainda checam papel internamente)
revoke execute on all functions in schema public from anon, public;
alter default privileges in schema public revoke execute on functions from anon, public;
-- Funções internas de trigger não precisam ser chamáveis via API
revoke execute on function handle_new_user() from authenticated;
revoke execute on function log_task_activity() from authenticated;
revoke execute on function tasks_before_write() from authenticated;
revoke execute on function set_updated_at() from authenticated;
-- search_path fixo
alter function set_updated_at() set search_path = public;
alter function unaccent_safe(text) set search_path = public;
alter function tasks_before_write() set search_path = public;
