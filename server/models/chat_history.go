package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// Message represents a single message in a chat
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatHistory represents a saved chat session
type ChatHistory struct {
	ID        uuid.UUID       `json:"id"`
	UserID    uuid.UUID       `json:"user_id"`
	SessionID string          `json:"session_id"`
	Messages  json.RawMessage `json:"messages"` // Stored as JSONB in the database
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
	Title     string          `json:"title,omitempty"`
	Model     string          `json:"model,omitempty"`
}

// ChatHistoryResponse represents the data sent to the client
type ChatHistoryResponse struct {
	ID        uuid.UUID `json:"id"`
	SessionID string    `json:"session_id"`
	Title     string    `json:"title"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	Model     string    `json:"model,omitempty"`
}

// GetChatHistoryRequest represents a request to get chat history
type GetChatHistoryRequest struct {
	SessionID string `json:"sessionId"`
	Limit     int    `json:"limit,omitempty"`
	Offset    int    `json:"offset,omitempty"`
}

// LoadMoreChatHistoryRequest represents a request to load more messages
type LoadMoreChatHistoryRequest struct {
	SessionID string `json:"sessionId"`
	Offset    int    `json:"offset"`
	Limit     int    `json:"limit"`
}
