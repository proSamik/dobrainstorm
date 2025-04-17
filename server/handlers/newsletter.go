package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"saas-server/database"
	"saas-server/models"
	"saas-server/pkg/validation"
)

// NewsletterHandler handles newsletter subscription requests
type NewsletterHandler struct {
	DB *database.DB
}

// NewNewsletterHandler creates a new newsletter handler
func NewNewsletterHandler(db *database.DB) *NewsletterHandler {
	return &NewsletterHandler{DB: db}
}

// Subscribe handles newsletter subscription requests
func (h *NewsletterHandler) Subscribe(w http.ResponseWriter, r *http.Request) {
	// Only allow POST requests
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse request body
	var req models.NewsletterSubscriptionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[NewsletterHandler] Error decoding request: %v", err)
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

	// Trim and lowercase email (not needed as sanitization already does this, but keeping for explicitness)
	email := strings.ToLower(req.Email)

	// Check if email already exists
	exists, err := h.DB.NewsletterEmailExists(email)
	if err != nil {
		log.Printf("[NewsletterHandler] Error checking for existing email: %v", err)
		http.Error(w, "Failed to process request", http.StatusInternalServerError)
		return
	}

	if exists {
		// If email exists, update the subscription status to true
		err := h.DB.UpdateNewsletterSubscription(email, true)
		if err != nil {
			log.Printf("[NewsletterHandler] Error updating subscription: %v", err)
			// Don't return an error to the client, just log it
		}

		// Return success (don't let users know they've already subscribed)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Thank you for subscribing to our newsletter!",
		})
		return
	}

	// Insert new newsletter subscription
	err = h.DB.CreateNewsletterSubscription(email)
	if err != nil {
		log.Printf("[NewsletterHandler] Error creating subscription: %v", err)
		http.Error(w, "Failed to subscribe to newsletter", http.StatusInternalServerError)
		return
	}

	// Track subscription with Plunk
	if err := trackNewsletterSubscription(email); err != nil {
		log.Printf("[NewsletterHandler] Error tracking subscription: %v", err)
		// Continue even if tracking fails
	}

	// Return success
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Thank you for subscribing to our newsletter!",
	})
}

// GetAllNewsletterSubscriptions returns all newsletter subscriptions
// This is an admin-only function
func (h *NewsletterHandler) GetAllNewsletterSubscriptions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	subscriptions, err := h.DB.GetAllNewsletterSubscriptions()
	if err != nil {
		log.Printf("[NewsletterHandler] Error fetching subscriptions: %v", err)
		http.Error(w, "Failed to fetch newsletter subscriptions", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(subscriptions)
}

// trackNewsletterSubscription tracks a newsletter subscription with analytics
func trackNewsletterSubscription(email string) error {
	plunkAPIKey := os.Getenv("PLUNK_SECRET_API_KEY")
	if plunkAPIKey == "" {
		return fmt.Errorf("PLUNK_SECRET_API_KEY not set")
	}

	type TrackRequest struct {
		Event      string `json:"event"`
		Email      string `json:"email"`
		Subscribed bool   `json:"subscribed"`
	}

	trackReq := TrackRequest{
		Event:      "newsletter-subscription",
		Email:      email,
		Subscribed: true,
	}

	jsonData, err := json.Marshal(trackReq)
	if err != nil {
		return fmt.Errorf("error marshaling track request: %v", err)
	}

	req, err := http.NewRequest("POST", "https://api.useplunk.com/v1/track", bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("error creating request: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+plunkAPIKey)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("error tracking subscription: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("error response from Plunk API: %d", resp.StatusCode)
	}

	return nil
}
