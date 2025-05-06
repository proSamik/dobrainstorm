package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"saas-server/database"
	"saas-server/models"

	"github.com/google/uuid"
)

// PreferencesHandler handles user preferences-related requests
type PreferencesHandler struct {
	DB *database.DB
}

// NewPreferencesHandler creates a new preferences handler
func NewPreferencesHandler(db *database.DB) *PreferencesHandler {
	return &PreferencesHandler{
		DB: db,
	}
}

// GetUserPreferences retrieves a user's preferences
func (h *PreferencesHandler) GetUserPreferences(w http.ResponseWriter, r *http.Request) {
	// Set response headers
	w.Header().Set("Content-Type", "application/json")

	// Get user ID from context (set by auth middleware)
	userIDStr, ok := r.Context().Value("userID").(string)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse UUID
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		log.Printf("Invalid user ID format: %v", err)
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Get user preferences from database
	preferences, err := h.DB.GetUserPreferences(userID)
	if err != nil {
		log.Printf("Error retrieving user preferences: %v", err)
		http.Error(w, "Error retrieving preferences", http.StatusInternalServerError)
		return
	}

	// Return preferences as JSON
	json.NewEncoder(w).Encode(preferences)
}

// UpdateUserPreferences updates a user's preferences
func (h *PreferencesHandler) UpdateUserPreferences(w http.ResponseWriter, r *http.Request) {
	// Set response headers
	w.Header().Set("Content-Type", "application/json")

	// Only accept POST requests
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get user ID from context (set by auth middleware)
	userIDStr, ok := r.Context().Value("userID").(string)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse UUID
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		log.Printf("Invalid user ID format: %v", err)
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Parse request body
	var input models.UserPreferencesInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		log.Printf("Error parsing request body: %v", err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Create preferences object
	preferences := &models.UserPreferences{
		UserID:          userID,
		UserPreferences: input.UserPreferences,
		DefaultModel:    input.DefaultModel,
		DefaultProvider: input.DefaultProvider,
	}

	// If default provider is empty, set to "OPENROUTER"
	if preferences.DefaultProvider == "" {
		preferences.DefaultProvider = "OPENROUTER"
	}

	// Update user preferences in database
	err = h.DB.UpdateUserPreferences(preferences)
	if err != nil {
		log.Printf("Error updating user preferences: %v", err)
		http.Error(w, "Error updating preferences", http.StatusInternalServerError)
		return
	}

	// Get updated preferences to return
	updatedPrefs, err := h.DB.GetUserPreferences(userID)
	if err != nil {
		log.Printf("Error retrieving updated preferences: %v", err)
		http.Error(w, "Error retrieving updated preferences", http.StatusInternalServerError)
		return
	}

	// Return updated preferences as JSON
	json.NewEncoder(w).Encode(updatedPrefs)
}
