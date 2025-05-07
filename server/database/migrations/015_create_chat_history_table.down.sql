-- Drop indexes
DROP INDEX IF EXISTS chat_history_user_id_idx;
DROP INDEX IF EXISTS chat_history_session_id_idx;
DROP INDEX IF EXISTS chat_history_created_at_idx;

-- Drop table
DROP TABLE IF EXISTS chat_history; 