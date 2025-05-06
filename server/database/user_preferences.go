package database

import (
	"database/sql"
	"log"

	"saas-server/models"

	"github.com/google/uuid"
)

// GetUserPreferences retrieves a user's preferences by user ID
func (db *DB) GetUserPreferences(userID uuid.UUID) (*models.UserPreferences, error) {
	query := `
		SELECT id, user_id, user_preferences, default_model, default_provider, created_at, updated_at
		FROM user_preferences
		WHERE user_id = $1
	`

	var prefs models.UserPreferences
	err := db.QueryRow(query, userID).Scan(
		&prefs.ID,
		&prefs.UserID,
		&prefs.UserPreferences,
		&prefs.DefaultModel,
		&prefs.DefaultProvider,
		&prefs.CreatedAt,
		&prefs.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			// Return default preferences if none found
			return &models.UserPreferences{
				UserID:          userID,
				DefaultProvider: "OPENROUTER",
			}, nil
		}
		log.Printf("Error retrieving user preferences: %v", err)
		return nil, err
	}

	return &prefs, nil
}

// SaveUserPreferences creates a new user preferences record
func (db *DB) SaveUserPreferences(preferences *models.UserPreferences) error {
	query := `
		INSERT INTO user_preferences (user_id, user_preferences, default_model, default_provider)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at, updated_at
	`

	err := db.QueryRow(
		query,
		preferences.UserID,
		preferences.UserPreferences,
		preferences.DefaultModel,
		preferences.DefaultProvider,
	).Scan(
		&preferences.ID,
		&preferences.CreatedAt,
		&preferences.UpdatedAt,
	)

	if err != nil {
		log.Printf("Error saving user preferences: %v", err)
		return err
	}

	return nil
}

// UpdateUserPreferences updates an existing user preferences record
func (db *DB) UpdateUserPreferences(preferences *models.UserPreferences) error {
	// First check if preferences exist
	existing, err := db.GetUserPreferences(preferences.UserID)
	if err != nil && err != sql.ErrNoRows {
		return err
	}

	// If preferences don't exist, create them
	if err == sql.ErrNoRows || existing == nil || existing.ID == uuid.Nil {
		return db.SaveUserPreferences(preferences)
	}

	// If preferences exist, update them
	query := `
		UPDATE user_preferences
		SET user_preferences = $1, default_model = $2, default_provider = $3, updated_at = NOW()
		WHERE user_id = $4
		RETURNING updated_at
	`

	err = db.QueryRow(
		query,
		preferences.UserPreferences,
		preferences.DefaultModel,
		preferences.DefaultProvider,
		preferences.UserID,
	).Scan(&preferences.UpdatedAt)

	if err != nil {
		log.Printf("Error updating user preferences: %v", err)
		return err
	}

	return nil
}
