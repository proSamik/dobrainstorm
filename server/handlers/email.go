package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"saas-server/pkg/email"
	"saas-server/pkg/validation"
)

// PlunkEmailRequest represents the request format for Plunk API
type PlunkEmailRequest struct {
	To      string `json:"to"`
	Subject string `json:"subject"`
	HTML    string `json:"html"`
}

// AdminEmailRequest represents the request structure for admin to send an email
type AdminEmailRequest struct {
	To      string `json:"to"`
	Subject string `json:"subject"`
	Body    string `json:"body"`
}

// AdminSendEmailHandler handles the request to send an email from admin to a user
func (h *Handler) AdminSendEmailHandler(w http.ResponseWriter, r *http.Request) {
	// Only allow POST method
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse the request body
	var req AdminEmailRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate request fields
	req.To = validation.SanitizeInput(req.To, 255)
	if !validation.ValidateEmail(req.To) {
		http.Error(w, "Invalid email address", http.StatusBadRequest)
		return
	}

	req.Subject = validation.SanitizeInput(req.Subject, 200)
	if req.Subject == "" {
		http.Error(w, "Subject is required", http.StatusBadRequest)
		return
	}

	req.Body = validation.SanitizeHTML(req.Body)
	if req.Body == "" {
		http.Error(w, "Email body cannot be empty", http.StatusBadRequest)
		return
	}

	// Send the email using our centralized email utility
	if err := email.SendEmail(req.To, req.Subject, req.Body); err != nil {
		log.Printf("[AdminEmail] Failed to send email: %v", err)
		http.Error(w, "Failed to send email: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Return success response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "Email sent successfully"})
}
