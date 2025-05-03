-- Drop indexes first
DROP INDEX IF EXISTS idx_feedback_user_id;
DROP INDEX IF EXISTS idx_feedback_created_at;

-- Drop the feedback table
DROP TABLE IF EXISTS feedback; 