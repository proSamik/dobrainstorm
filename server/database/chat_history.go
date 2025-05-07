package database

import (
	"encoding/json"
	"log"
	"time"

	"saas-server/models"

	"github.com/google/uuid"
)

// SaveChatHistory saves a chat session to the database
func (db *DB) SaveChatHistory(userID uuid.UUID, sessionID string, messages []byte, model string) error {
	// Check if a record already exists for this session
	query := `
		SELECT id FROM chat_history
		WHERE user_id = $1 AND session_id = $2
	`
	var id uuid.UUID
	err := db.QueryRow(query, userID, sessionID).Scan(&id)

	if err == nil {
		// Update existing record
		updateQuery := `
			UPDATE chat_history
			SET messages = $1, updated_at = NOW(), model = $2
			WHERE id = $3
		`
		_, err = db.Exec(updateQuery, messages, model, id)
		if err != nil {
			log.Printf("Error updating chat history: %v", err)
			return err
		}
		return nil
	}

	// Insert new record
	// Extract the first message to use as title (if available)
	var title string
	var messagesArray []map[string]interface{}
	if err := json.Unmarshal(messages, &messagesArray); err == nil && len(messagesArray) > 0 {
		// Find the first user or assistant message to use as title
		for _, msg := range messagesArray {
			if role, ok := msg["role"].(string); ok && (role == "user" || role == "assistant") {
				if content, ok := msg["content"].(string); ok && content != "" {
					// Truncate title to reasonable length
					if len(content) > 50 {
						title = content[:50] + "..."
					} else {
						title = content
					}
					break
				}
			}
		}
	}

	insertQuery := `
		INSERT INTO chat_history (user_id, session_id, messages, title, model)
		VALUES ($1, $2, $3, $4, $5)
	`
	_, err = db.Exec(insertQuery, userID, sessionID, messages, title, model)
	if err != nil {
		log.Printf("Error saving chat history: %v", err)
		return err
	}

	return nil
}

// GetChatHistory retrieves a specific chat session
func (db *DB) GetChatHistory(userID uuid.UUID, sessionID string) (*models.ChatHistory, error) {
	query := `
		SELECT id, user_id, session_id, messages, created_at, updated_at, title, model
		FROM chat_history
		WHERE user_id = $1 AND session_id = $2
	`

	var history models.ChatHistory
	err := db.QueryRow(query, userID, sessionID).Scan(
		&history.ID,
		&history.UserID,
		&history.SessionID,
		&history.Messages,
		&history.CreatedAt,
		&history.UpdatedAt,
		&history.Title,
		&history.Model,
	)

	if err != nil {
		log.Printf("Error retrieving chat history: %v", err)
		return nil, err
	}

	return &history, nil
}

// ListChatHistories retrieves all chat sessions for a user
func (db *DB) ListChatHistories(userID uuid.UUID, limit, offset int) ([]models.ChatHistoryResponse, error) {
	if limit <= 0 {
		limit = 10 // Default limit
	}

	query := `
		SELECT id, session_id, title, created_at, updated_at, model
		FROM chat_history
		WHERE user_id = $1
		ORDER BY updated_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := db.Query(query, userID, limit, offset)
	if err != nil {
		log.Printf("Error listing chat histories: %v", err)
		return nil, err
	}
	defer rows.Close()

	var histories []models.ChatHistoryResponse
	for rows.Next() {
		var history models.ChatHistoryResponse
		var model *string // Nullable field
		err := rows.Scan(
			&history.ID,
			&history.SessionID,
			&history.Title,
			&history.CreatedAt,
			&history.UpdatedAt,
			&model,
		)
		if err != nil {
			log.Printf("Error scanning chat history: %v", err)
			return nil, err
		}

		if model != nil {
			history.Model = *model
		}

		histories = append(histories, history)
	}

	if err = rows.Err(); err != nil {
		log.Printf("Error iterating chat histories: %v", err)
		return nil, err
	}

	return histories, nil
}

// UpdateChatHistoryTitle updates the title of a chat session
func (db *DB) UpdateChatHistoryTitle(userID uuid.UUID, sessionID string, title string) error {
	query := `
		UPDATE chat_history
		SET title = $1, updated_at = $2
		WHERE user_id = $3 AND session_id = $4
	`

	_, err := db.Exec(query, title, time.Now(), userID, sessionID)
	if err != nil {
		log.Printf("Error updating chat history title: %v", err)
		return err
	}

	return nil
}

// DeleteChatHistory deletes a chat session
func (db *DB) DeleteChatHistory(userID uuid.UUID, sessionID string) error {
	query := `
		DELETE FROM chat_history
		WHERE user_id = $1 AND session_id = $2
	`

	_, err := db.Exec(query, userID, sessionID)
	if err != nil {
		log.Printf("Error deleting chat history: %v", err)
		return err
	}

	return nil
}
