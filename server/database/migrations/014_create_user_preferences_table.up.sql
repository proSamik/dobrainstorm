-- Enable the uuid-ossp extension if it doesn't exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create trigger function for updating timestamps if it doesn't exist
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create user_preferences table to store user preferences like default model, etc.
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_preferences TEXT, -- Markdown formatted user preferences
    default_model VARCHAR(100),
    default_provider VARCHAR(50) DEFAULT 'OPENROUTER',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- Create unique constraint to ensure one preference record per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_preferences_user_id_unique ON user_preferences(user_id);

-- Add trigger to update the updated_at timestamp
CREATE TRIGGER set_user_preferences_timestamp
BEFORE UPDATE ON user_preferences
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp(); 