package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"saas-server/middleware"
	"saas-server/models"
	"saas-server/pkg/email"
	"saas-server/pkg/validation"
	"time"
)

// FeedbackHandler handles user feedback submissions
type FeedbackHandler struct {
	DB interface {
		CreateFeedback(userID, username, userEmail, feedbackBody string, submissionTime time.Time) error
		GetUserByID(id string) (*models.User, error)
	}
}

// NewFeedbackHandler creates a new FeedbackHandler
func NewFeedbackHandler(db interface {
	CreateFeedback(userID, username, userEmail, feedbackBody string, submissionTime time.Time) error
	GetUserByID(id string) (*models.User, error)
}) *FeedbackHandler {
	return &FeedbackHandler{
		DB: db,
	}
}

// SubmitFeedback handles authenticated user feedback submissions
func (h *FeedbackHandler) SubmitFeedback(w http.ResponseWriter, r *http.Request) {
	// Only allow POST requests
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get user ID from the context using the middleware utility function
	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		log.Println("[FeedbackHandler] User ID not found in context")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Log that we found the user ID
	log.Printf("[FeedbackHandler] Found user ID in context: %s", userID)

	// Look up the user in the database
	user, err := h.DB.GetUserByID(userID)
	if err != nil {
		log.Printf("[FeedbackHandler] Error fetching user data: %v", err)
		http.Error(w, "Error fetching user data", http.StatusInternalServerError)
		return
	}

	if user == nil {
		log.Printf("[FeedbackHandler] User not found with ID: %s", userID)
		http.Error(w, "User not found", http.StatusUnauthorized)
		return
	}

	// Parse the request body
	var req models.FeedbackRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[FeedbackHandler] Error decoding request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Sanitize and validate message
	sanitizedMessage := validation.SanitizeHTML(req.Message)
	if sanitizedMessage == "" {
		http.Error(w, "Feedback message is required", http.StatusBadRequest)
		return
	}

	// Convert time to UTC +5:30 (India Standard Time)
	indiaLocation, err := time.LoadLocation("Asia/Kolkata") // IST is Asia/Kolkata in IANA timezone database
	if err != nil {
		indiaLocation = time.FixedZone("IST", 5*60*60+30*60) // Fallback: UTC+5:30
	}
	submissionTime := time.Now().In(indiaLocation)

	// Store feedback in database
	if err := h.DB.CreateFeedback(user.ID, user.Name, user.Email, sanitizedMessage, submissionTime); err != nil {
		log.Printf("[FeedbackHandler] Error storing feedback: %v", err)
		http.Error(w, "Error processing feedback", http.StatusInternalServerError)
		return
	}

	// Get admin email from environment variables
	adminEmail := os.Getenv("ADMIN_EMAIL")
	if adminEmail == "" {
		log.Println("[FeedbackHandler] Admin email not configured")
		// Continue execution - we'll skip sending email but still record the feedback
	} else {
		// Prepare email content
		subject := fmt.Sprintf("Feedback from %s", user.Name)

		emailContent := fmt.Sprintf(`
<h1>New User Feedback</h1>
<p><strong>From:</strong> %s (%s)</p>
<p><strong>User ID:</strong> %s</p>
<p><strong>Submission Time:</strong> %s</p>
<p><strong>Feedback:</strong></p>
<p>%s</p>
`, user.Name, user.Email, user.ID, submissionTime.Format(time.RFC1123), sanitizedMessage)

		// Send email using our email utility
		if err := email.SendEmail(adminEmail, subject, emailContent); err != nil {
			log.Printf("[FeedbackHandler] Error sending feedback email: %v", err)
			// Continue execution - we'll still record the feedback even if email fails
		}
	}

	// Return success response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Thank you for your feedback! We appreciate your input.",
	})
}
