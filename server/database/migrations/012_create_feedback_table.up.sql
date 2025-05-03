-- Create the feedback table
CREATE TABLE IF NOT EXISTS feedback (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    username VARCHAR(255) NOT NULL,
    useremail VARCHAR(255) NOT NULL,
    feedback_body TEXT NOT NULL,
    submission_time TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Add indexes for faster lookups
CREATE INDEX idx_feedback_user_id ON feedback(user_id);
CREATE INDEX idx_feedback_created_at ON feedback(created_at);

COMMENT ON TABLE feedback IS 'Stores user feedback submissions';
COMMENT ON COLUMN feedback.user_id IS 'References the user who submitted the feedback';
COMMENT ON COLUMN feedback.username IS 'Username at the time of submission';
COMMENT ON COLUMN feedback.useremail IS 'User email at the time of submission';
COMMENT ON COLUMN feedback.feedback_body IS 'The actual feedback content submitted by the user';
COMMENT ON COLUMN feedback.submission_time IS 'The time when feedback was submitted (in UTC +5:30)'; 