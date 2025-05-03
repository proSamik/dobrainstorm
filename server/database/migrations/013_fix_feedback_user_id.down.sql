-- Remove the foreign key constraint first
ALTER TABLE IF EXISTS feedback DROP CONSTRAINT IF EXISTS fk_feedback_user;

-- Convert the user_id column back to VARCHAR(36)
ALTER TABLE IF EXISTS feedback ALTER COLUMN user_id TYPE VARCHAR(36);

-- Reset the comment to the original
COMMENT ON TABLE feedback IS 'Stores user feedback submissions'; 