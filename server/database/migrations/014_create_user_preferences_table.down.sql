-- Drop trigger first
DROP TRIGGER IF EXISTS set_user_preferences_timestamp ON user_preferences;

-- Drop indexes
DROP INDEX IF EXISTS idx_user_preferences_user_id;
DROP INDEX IF EXISTS idx_user_preferences_user_id_unique;

-- Drop the table
DROP TABLE IF EXISTS user_preferences; 