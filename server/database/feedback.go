package database

import (
	"saas-server/models"
	"time"
)

// CreateFeedback creates a new feedback entry in the database
func (db *DB) CreateFeedback(userID, username, userEmail, feedbackBody string, submissionTime time.Time) error {
	now := time.Now()
	_, err := db.Exec(
		"INSERT INTO feedback (user_id, username, useremail, feedback_body, submission_time, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $6)",
		userID, username, userEmail, feedbackBody, submissionTime, now,
	)
	return err
}

// GetFeedbackByUserID returns all feedback entries for a given user ID
func (db *DB) GetFeedbackByUserID(userID string) ([]models.Feedback, error) {
	rows, err := db.Query(
		"SELECT id, user_id, username, useremail, feedback_body, submission_time, created_at, updated_at FROM feedback WHERE user_id = $1 ORDER BY created_at DESC",
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []models.Feedback
	for rows.Next() {
		var entry models.Feedback
		if err := rows.Scan(
			&entry.ID,
			&entry.UserID,
			&entry.Username,
			&entry.UserEmail,
			&entry.FeedbackBody,
			&entry.SubmissionTime,
			&entry.CreatedAt,
			&entry.UpdatedAt,
		); err != nil {
			return nil, err
		}
		entries = append(entries, entry)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return entries, nil
}

// GetAllFeedback returns all feedback entries from the database
func (db *DB) GetAllFeedback() ([]models.Feedback, error) {
	rows, err := db.Query(
		"SELECT id, user_id, username, useremail, feedback_body, submission_time, created_at, updated_at FROM feedback ORDER BY created_at DESC",
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []models.Feedback
	for rows.Next() {
		var entry models.Feedback
		if err := rows.Scan(
			&entry.ID,
			&entry.UserID,
			&entry.Username,
			&entry.UserEmail,
			&entry.FeedbackBody,
			&entry.SubmissionTime,
			&entry.CreatedAt,
			&entry.UpdatedAt,
		); err != nil {
			return nil, err
		}
		entries = append(entries, entry)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return entries, nil
}
