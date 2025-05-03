-- Alter the feedback table to change user_id to UUID
ALTER TABLE IF EXISTS feedback ALTER COLUMN user_id TYPE UUID USING user_id::uuid;

-- Now add the foreign key constraint
ALTER TABLE IF EXISTS feedback
ADD CONSTRAINT fk_feedback_user
FOREIGN KEY (user_id)
REFERENCES users(id) ON DELETE CASCADE;

-- Add a comment explaining the migration
COMMENT ON TABLE feedback IS 'Stores user feedback submissions with proper UUID for user_id'; 