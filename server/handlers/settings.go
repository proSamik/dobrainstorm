package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"saas-server/database"
	"saas-server/middleware"
	"saas-server/pkg/encryption"
)

// SettingsHandler handles API endpoints related to user settings
type SettingsHandler struct {
	DB database.DBInterface
}

// NewSettingsHandler creates a new settings handler
func NewSettingsHandler(db database.DBInterface) *SettingsHandler {
	return &SettingsHandler{DB: db}
}

type ProviderSettings struct {
	Key           string   `json:"key"`
	Models        []string `json:"models,omitempty"`
	SelectedModel string   `json:"selectedModel,omitempty"`
}

// GetAPIKeys returns the saved API keys for the current user
func (h *SettingsHandler) GetAPIKeys(w http.ResponseWriter, r *http.Request) {
	// Get user ID from context using the middleware helper
	userIDStr := middleware.GetUserID(r.Context())
	if userIDStr == "" {
		log.Printf("[SettingsHandler] Error: user_id not found in context")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get user to verify existence
	_, err := h.DB.GetUserByID(userIDStr)
	if err != nil {
		log.Printf("[SettingsHandler] User not found: %v", err)
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	// Get user settings from database
	settings, err := h.DB.GetUserSettings(userIDStr)
	if err != nil {
		log.Printf("[SettingsHandler] Error retrieving settings: %v", err)
		http.Error(w, "Error retrieving settings", http.StatusInternalServerError)
		return
	}

	// If no settings or empty AI settings, return empty object
	var aiSettings map[string]ProviderSettings
	if settings == nil || settings.AISettings == nil || len(settings.AISettings) == 0 {
		log.Printf("[SettingsHandler] No settings found for user %s", userIDStr)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{})
		return
	}

	// Parse AI settings
	if err := settings.AISettings.Unmarshal(&aiSettings); err != nil {
		log.Printf("[SettingsHandler] Error parsing AI settings: %v", err)
		http.Error(w, "Failed to parse settings", http.StatusInternalServerError)
		return
	}

	// Create response with masked keys
	maskedSettings := make(map[string]interface{})
	for provider, data := range aiSettings {
		// Decrypt the stored key
		key, err := encryption.Decrypt(data.Key)
		if err != nil {
			log.Printf("[SettingsHandler] Error decrypting key: %v", err)
			http.Error(w, "Failed to decrypt key", http.StatusInternalServerError)
			return
		}

		// Mask the key, show only last 4 characters
		maskedKey := maskAPIKey(key)

		// Ensure models is not null
		models := data.Models
		if models == nil {
			models = []string{}
		}

		// Default selectedModel to first model if not set
		selectedModel := data.SelectedModel
		if selectedModel == "" && len(models) > 0 {
			selectedModel = models[0]
		}

		// If we have a selected model, ensure it's the first in the list for the frontend
		if selectedModel != "" {
			// Check if selected model is in the list
			found := false
			for _, model := range models {
				if model == selectedModel {
					found = true
					break
				}
			}

			// If not found, add it
			if !found && selectedModel != "" {
				models = append([]string{selectedModel}, models...)
			} else if found {
				// If found, reorder to put it first
				newModels := []string{selectedModel}
				for _, model := range models {
					if model != selectedModel {
						newModels = append(newModels, model)
					}
				}
				models = newModels
			}
		}

		// Log the response being sent for debugging
		log.Printf("[SettingsHandler] Sending response for provider %s: key=%s, isValid=true, models=%v, selectedModel=%s",
			provider, maskedKey, models, selectedModel)

		maskedSettings[provider] = map[string]interface{}{
			"key":           maskedKey,
			"isValid":       true,
			"models":        models,
			"selectedModel": selectedModel,
		}
	}

	// Return masked settings
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(maskedSettings)
}

// SaveKeys saves validated API keys for the current user
func (h *SettingsHandler) SaveKeys(w http.ResponseWriter, r *http.Request) {
	// Get user ID from context using the middleware helper
	userIDStr := middleware.GetUserID(r.Context())
	if userIDStr == "" {
		log.Printf("[SettingsHandler] Error: user_id not found in context")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Verify user exists
	_, err := h.DB.GetUserByID(userIDStr)
	if err != nil {
		log.Printf("[SettingsHandler] User not found: %v", err)
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	// Parse request
	var keysToSave map[string]ProviderSettings
	if err := json.NewDecoder(r.Body).Decode(&keysToSave); err != nil {
		log.Printf("[SettingsHandler] Error decoding request: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Encrypt keys before storage
	for provider, data := range keysToSave {
		encryptedKey, err := encryption.Encrypt(data.Key)
		if err != nil {
			log.Printf("[SettingsHandler] Error encrypting key: %v", err)
			http.Error(w, "Failed to encrypt key", http.StatusInternalServerError)
			return
		}
		data.Key = encryptedKey
		keysToSave[provider] = data
	}

	// Convert to JSON for storage
	aiSettingsJSON, err := json.Marshal(keysToSave)
	if err != nil {
		log.Printf("[SettingsHandler] Error marshaling settings: %v", err)
		http.Error(w, "Failed to process settings", http.StatusInternalServerError)
		return
	}

	// Save settings using the interface method
	log.Printf("[SettingsHandler] Saving settings for user %s", userIDStr)
	err = h.DB.SaveUserSettings(userIDStr, aiSettingsJSON)
	if err != nil {
		log.Printf("[SettingsHandler] Error saving settings: %v", err)
		http.Error(w, "Failed to save settings", http.StatusInternalServerError)
		return
	}

	// Return success response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "API keys saved successfully",
	})
}

// maskAPIKey masks an API key, showing only the last 4 characters
func maskAPIKey(key string) string {
	if len(key) <= 4 {
		return "•••••••"
	}
	maskedPart := ""
	for i := 0; i < len(key)-4; i++ {
		maskedPart += "•"
	}
	return maskedPart + key[len(key)-4:]
}
