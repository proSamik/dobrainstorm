package models

import "time"

// Feedback represents user feedback entries stored in the database
type Feedback struct {
	ID             int       `json:"id"`
	UserID         string    `json:"user_id"`
	Username       string    `json:"username"`
	UserEmail      string    `json:"useremail"`
	FeedbackBody   string    `json:"feedback_body"`
	SubmissionTime time.Time `json:"submission_time"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// FeedbackRequest represents the incoming feedback request structure
type FeedbackRequest struct {
	Message string `json:"message"`
}
