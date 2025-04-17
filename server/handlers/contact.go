package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"saas-server/pkg/email"
	"saas-server/pkg/validation"
)

// ContactHandler handles requests related to contact form submissions
type ContactHandler struct{}

// ContactFormRequest represents the data submitted from the contact form
type ContactFormRequest struct {
	Name    string `json:"name"`
	Email   string `json:"email"`
	Subject string `json:"subject"`
	Message string `json:"message"`
}

// NewContactHandler creates a new instance of ContactHandler
func NewContactHandler() *ContactHandler {
	return &ContactHandler{}
}

// SendContactEmail handles the contact form submission and sends an email to the admin
func (h *ContactHandler) SendContactEmail(w http.ResponseWriter, r *http.Request) {
	// Only allow POST requests
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse the request body
	var req ContactFormRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[ContactHandler] Error decoding request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Validate and sanitize inputs
	// Validate name
	sanitizedName, err := validation.ValidateName(req.Name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	req.Name = sanitizedName

	// Validate email
	req.Email = validation.SanitizeInput(req.Email, 255)
	if !validation.ValidateEmail(req.Email) {
		http.Error(w, "Invalid email address", http.StatusBadRequest)
		return
	}

	// Sanitize subject
	req.Subject = validation.SanitizeInput(req.Subject, 200)
	if req.Subject == "" {
		req.Subject = "Contact Form Submission"
	}

	// Sanitize message for XSS protection
	req.Message = validation.SanitizeHTML(req.Message)
	if req.Message == "" {
		http.Error(w, "Message is required", http.StatusBadRequest)
		return
	}

	// Get admin email from environment variables
	adminEmail := os.Getenv("ADMIN_EMAIL")
	if adminEmail == "" {
		log.Println("[ContactHandler] Admin email not configured")
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Prepare email content
	subject := fmt.Sprintf("Contact Form: %s", req.Subject)

	emailContent := fmt.Sprintf(`
<h1>New Contact Form Submission</h1>
<p><strong>From:</strong> %s (%s)</p>
<p><strong>Subject:</strong> %s</p>
<p><strong>Message:</strong></p>
<p>%s</p>
`, req.Name, req.Email, req.Subject, req.Message)

	// Send email using our email utility
	if err := email.SendEmail(adminEmail, subject, emailContent); err != nil {
		log.Printf("[ContactHandler] Error sending contact email: %v", err)
		http.Error(w, "Error sending email", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Thank you for contacting us! We'll get back to you soon.",
	})
}
