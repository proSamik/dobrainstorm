// Package validation provides functions for validating and sanitizing user input
package validation

import (
	"fmt"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/microcosm-cc/bluemonday"
)

// ValidateEmail validates an email address
func ValidateEmail(email string) bool {
	emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	return emailRegex.MatchString(email)
}

// SanitizeInput sanitizes general text input
func SanitizeInput(input string, maxLength int) string {
	// Trim whitespace
	input = strings.TrimSpace(input)

	// Limit length
	if maxLength > 0 && utf8.RuneCountInString(input) > maxLength {
		input = string([]rune(input)[:maxLength])
	}

	// Remove control characters
	controlCharRegex := regexp.MustCompile(`[\x00-\x1F\x7F]`)
	input = controlCharRegex.ReplaceAllString(input, "")

	return input
}

// ValidateName validates a user's name
func ValidateName(name string) (string, error) {
	name = SanitizeInput(name, 100)

	if name == "" {
		return "", fmt.Errorf("name cannot be empty")
	}

	if utf8.RuneCountInString(name) < 2 {
		return "", fmt.Errorf("name must be at least 2 characters long")
	}

	// Check for valid characters
	nameRegex := regexp.MustCompile(`^[a-zA-Z0-9\s\-'.]+$`)
	if !nameRegex.MatchString(name) {
		return "", fmt.Errorf("name contains invalid characters")
	}

	return name, nil
}

// ValidatePassword validates password strength
func ValidatePassword(password string) error {
	if utf8.RuneCountInString(password) < 8 {
		return fmt.Errorf("password must be at least 8 characters long")
	}
	if !regexp.MustCompile(`[A-Z]`).MatchString(password) {
		return fmt.Errorf("password must contain at least one uppercase letter")
	}
	if !regexp.MustCompile(`[a-z]`).MatchString(password) {
		return fmt.Errorf("password must contain at least one lowercase letter")
	}
	if !regexp.MustCompile(`[0-9]`).MatchString(password) {
		return fmt.Errorf("password must contain at least one number")
	}
	if !regexp.MustCompile(`[^A-Za-z0-9]`).MatchString(password) {
		return fmt.Errorf("password must contain at least one special character")
	}
	return nil
}

// SanitizeHTML sanitizes HTML content to prevent XSS
func SanitizeHTML(content string) string {
	p := bluemonday.UGCPolicy()
	return p.Sanitize(content)
}

// ValidateURL validates a URL
func ValidateURL(url string) bool {
	urlRegex := regexp.MustCompile(`^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,})([\/\w \.-]*)*\/?$`)
	return urlRegex.MatchString(url)
}

// SanitizeReferrer sanitizes a referrer string
func SanitizeReferrer(referrer string) string {
	// Trim whitespace
	referrer = strings.TrimSpace(referrer)

	// If empty, return "direct"
	if referrer == "" {
		return "direct"
	}

	// Remove any protocol (http://, https://)
	referrer = regexp.MustCompile(`^https?://`).ReplaceAllString(referrer, "")

	// Remove paths and parameters
	if parts := strings.Split(referrer, "/"); len(parts) > 0 {
		referrer = parts[0]
	}

	// Remove port if present
	if parts := strings.Split(referrer, ":"); len(parts) > 0 {
		referrer = parts[0]
	}

	// Limit length
	if len(referrer) > 255 {
		referrer = referrer[:255]
	}

	return referrer
}

// ValidateToken validates that a token is a properly formatted UUID
func ValidateToken(token string) bool {
	// UUID format
	uuidRegex := regexp.MustCompile(`^[0-9a-fA-F]{8}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{12}$`)
	return uuidRegex.MatchString(token)
}
