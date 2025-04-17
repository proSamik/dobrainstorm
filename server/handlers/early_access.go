package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"saas-server/database"
	"saas-server/models"
	"saas-server/pkg/validation"
)

// EarlyAccessHandler handles early access waiting list requests
type EarlyAccessHandler struct {
	DB *database.DB
}

// NewEarlyAccessHandler creates a new early access handler
func NewEarlyAccessHandler(db *database.DB) *EarlyAccessHandler {
	return &EarlyAccessHandler{DB: db}
}

// Register handles early access registration requests
func (h *EarlyAccessHandler) Register(w http.ResponseWriter, r *http.Request) {
	// Only allow POST requests
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse request body
	var req models.EarlyAccessRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[EarlyAccessHandler] Error decoding request: %v", err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Sanitize email
	req.Email = validation.SanitizeInput(req.Email, 255)

	// Validate email
	if !validation.ValidateEmail(req.Email) {
		http.Error(w, "Invalid email address", http.StatusBadRequest)
		return
	}

	// Sanitize referrer
	req.Referrer = validation.SanitizeReferrer(req.Referrer)

	// Check if email already exists
	exists, err := h.DB.EarlyAccessEmailExists(req.Email)
	if err != nil {
		log.Printf("[EarlyAccessHandler] Error checking for existing email: %v", err)
		http.Error(w, "Failed to process request", http.StatusInternalServerError)
		return
	}

	if exists {
		// If email exists, just update the referrer if provided
		if req.Referrer != "" {
			err := h.DB.UpdateEarlyAccessReferrer(req.Email, req.Referrer)
			if err != nil {
				log.Printf("[EarlyAccessHandler] Error updating referrer: %v", err)
				// Don't return an error to the client, just log it
			}
		}

		// Return success (don't let users know they've already signed up to prevent email harvesting)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Thank you for your interest in our platform!",
		})
		return
	}

	// Insert new early access record
	err = h.DB.CreateEarlyAccessEntry(req.Email, req.Referrer)
	if err != nil {
		log.Printf("[EarlyAccessHandler] Error inserting record: %v", err)
		http.Error(w, "Failed to register for early access", http.StatusInternalServerError)
		return
	}

	// Return success response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Successfully registered for early access",
	})
}

// GetAllEarlyAccessRegistrations returns all early access registrations
// This is typically an admin-only function
func (h *EarlyAccessHandler) GetAllEarlyAccessRegistrations(w http.ResponseWriter, r *http.Request) {
	// Only allow GET requests
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get all early access registrations
	registrations, err := h.DB.GetAllEarlyAccessEntries()
	if err != nil {
		log.Printf("[EarlyAccessHandler] Error fetching registrations: %v", err)
		http.Error(w, "Failed to fetch early access registrations", http.StatusInternalServerError)
		return
	}

	// Return registrations as JSON
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(registrations)
}
