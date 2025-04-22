-- Drop trigger
DROP TRIGGER IF EXISTS trigger_update_user_settings_updated_at ON user_settings;

-- Drop trigger function
DROP FUNCTION IF EXISTS update_user_settings_updated_at();

-- Drop table
DROP TABLE IF EXISTS user_settings; 