package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"saas-server/middleware"
	"saas-server/pkg/email"
	"saas-server/pkg/validation"
	"time"

	"github.com/google/uuid"
)

// EmailVerificationToken represents a token for email verification
type EmailVerificationToken struct {
	Token     string    `json:"token"`
	UserID    string    `json:"user_id"`
	Email     string    `json:"email"`
	ExpiresAt time.Time `json:"expires_at"`
}

// SendVerificationEmail handles the request to send an email verification link
func (h *AuthHandler) SendVerificationEmail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get user ID from context using the correct key
	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		log.Printf("Error: user_id not found in context")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get user details
	user, err := h.db.GetUserByID(userID)
	if err != nil {
		log.Printf("Error getting user: %v", err)
		http.Error(w, "Error getting user details", http.StatusInternalServerError)
		return
	}

	// Validate email
	if !validation.ValidateEmail(user.Email) {
		log.Printf("Invalid email format for user: %s", userID)
		http.Error(w, "Invalid email address", http.StatusBadRequest)
		return
	}

	// Check if email is already verified
	if user.EmailVerified {
		http.Error(w, "Email is already verified", http.StatusBadRequest)
		return
	}

	// Generate verification token
	token := uuid.New().String()
	expiresAt := time.Now().Add(24 * time.Hour)

	// Store verification token in database
	err = h.db.StoreEmailVerificationToken(token, userID, user.Email, expiresAt)
	if err != nil {
		log.Printf("Error storing verification token: %v", err)
		http.Error(w, "Error generating verification token", http.StatusInternalServerError)
		return
	}

	// Generate verification link
	clientURL := os.Getenv("FRONTEND_URL")
	if clientURL == "" {
		clientURL = "http://localhost:3000" // Default for development
	}
	verificationLink := fmt.Sprintf("%s/auth/verify-email?token=%s", clientURL, token)

	// Send verification email using our email utility
	err = email.SendVerificationEmail(user.Email, verificationLink)
	if err != nil {
		log.Printf("Error sending verification email: %v", err)
		http.Error(w, "Error sending verification email", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Verification email sent successfully",
	})
}

// VerifyEmail handles the verification of an email using a token
func (h *AuthHandler) VerifyEmail(w http.ResponseWriter, r *http.Request) {
	log.Printf("[Email Verification] Request received - Method: %s", r.Method)

	if r.Method != http.MethodPost {
		log.Printf("[Email Verification] Invalid method: %s", r.Method)
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[Email Verification] Failed to decode request body: %v", err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	log.Printf("[Email Verification] Processing token: %s", req.Token)

	// Validate token format
	if !validation.ValidateToken(req.Token) {
		log.Printf("[Email Verification] Invalid token format: %s", req.Token)
		http.Error(w, "Invalid token format", http.StatusBadRequest)
		return
	}

	// Verify token and update user's email verification status
	err := h.db.VerifyEmail(req.Token)
	if err != nil {
		log.Printf("[Email Verification] Token verification failed: %v", err)
		http.Error(w, "Invalid or expired verification token", http.StatusBadRequest)
		return
	}

	log.Printf("[Email Verification] Email verified successfully for token: %s", req.Token)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Email verified successfully",
	})
}
