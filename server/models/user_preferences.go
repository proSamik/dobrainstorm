package models

import (
	"time"

	"github.com/google/uuid"
)

// UserPreferences represents a user's preferences, including UI settings and default model choice
type UserPreferences struct {
	ID              uuid.UUID `json:"id" db:"id"`
	UserID          uuid.UUID `json:"userId" db:"user_id"`
	UserPreferences string    `json:"userPreferences" db:"user_preferences"`
	DefaultModel    string    `json:"defaultModel" db:"default_model"`
	DefaultProvider string    `json:"defaultProvider" db:"default_provider"`
	CreatedAt       time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt       time.Time `json:"updatedAt" db:"updated_at"`
}

// UserPreferencesInput represents input data for updating user preferences
type UserPreferencesInput struct {
	UserPreferences string `json:"userPreferences"`
	DefaultModel    string `json:"defaultModel"`
	DefaultProvider string `json:"defaultProvider"`
}
