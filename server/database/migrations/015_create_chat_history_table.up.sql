-- Create chat_history table
CREATE TABLE IF NOT EXISTS chat_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    title TEXT,
    model TEXT,
    UNIQUE(user_id, session_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS chat_history_user_id_idx ON chat_history(user_id);
CREATE INDEX IF NOT EXISTS chat_history_session_id_idx ON chat_history(session_id);
CREATE INDEX IF NOT EXISTS chat_history_created_at_idx ON chat_history(created_at);

-- Add comment
COMMENT ON TABLE chat_history IS 'Stores chat conversation history for each user session'; 