// Package email provides utilities for sending emails with validation and sanitization
package email

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"saas-server/pkg/validation"
)

// PlunkEmailRequest represents the request format for Plunk API
type PlunkEmailRequest struct {
	To      string `json:"to"`
	Subject string `json:"subject"`
	HTML    string `json:"html"`
}

// SendEmail sends an email using the Plunk API with validation and sanitization
func SendEmail(to, subject, htmlContent string) error {
	// Validate email address
	if !validation.ValidateEmail(to) {
		return fmt.Errorf("invalid email address: %s", to)
	}

	// Sanitize subject
	subject = validation.SanitizeInput(subject, 200)
	if subject == "" {
		return fmt.Errorf("email subject cannot be empty")
	}

	// Sanitize HTML content
	htmlContent = validation.SanitizeHTML(htmlContent)
	if htmlContent == "" {
		return fmt.Errorf("email content cannot be empty")
	}

	// Get Plunk API key
	plunkAPIKey := os.Getenv("PLUNK_SECRET_API_KEY")
	if plunkAPIKey == "" {
		return fmt.Errorf("PLUNK_SECRET_API_KEY not set")
	}

	// Create email request
	emailReq := PlunkEmailRequest{
		To:      to,
		Subject: subject,
		HTML:    htmlContent,
	}

	// Marshal request to JSON
	jsonData, err := json.Marshal(emailReq)
	if err != nil {
		return fmt.Errorf("error marshaling email request: %w", err)
	}

	// Create HTTP request to Plunk API
	req, err := http.NewRequest("POST", "https://api.useplunk.com/v1/send", bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("error creating email request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+plunkAPIKey)

	// Send request
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("error sending email: %w", err)
	}
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("error response from Plunk API: %d", resp.StatusCode)
	}

	log.Printf("[Email] Successfully sent email to %s with subject: %s", to, subject)
	return nil
}

// SendPasswordResetEmail sends a password reset email with a secure token
func SendPasswordResetEmail(to string, resetURL string) error {
	subject := "Password Reset Request"

	htmlContent := `
	<h1>Password Reset</h1>
	<p>You've requested to reset your password. Click the link below to reset your password:</p>
	<p><a href="` + resetURL + `">Reset Password</a></p>
	<p>This link will expire in 1 hour.</p>
	<p>If you didn't request this, you can safely ignore this email.</p>
	`

	return SendEmail(to, subject, htmlContent)
}

// SendVerificationEmail sends an email verification link to the user
func SendVerificationEmail(to string, verificationURL string) error {
	subject := "Verify Your Email Address"

	htmlContent := `
	<!DOCTYPE html>
	<html>
	<head>
		<style>
			body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
			.container { max-width: 600px; margin: 0 auto; padding: 20px; }
			.button {
				display: inline-block;
				padding: 12px 24px;
				background-color: #3b82f6;
				color: white;
				text-decoration: none;
				border-radius: 6px;
				margin: 20px 0;
			}
			.footer { margin-top: 30px; font-size: 14px; color: #666; }
		</style>
	</head>
	<body>
		<div class="container">
			<h2>Verify Your Email Address</h2>
			<p>Thank you for signing up! Please click the button below to verify your email address:</p>
			
			<a href="` + verificationURL + `" class="button">Verify Email</a>
			
			<p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
			<p>` + verificationURL + `</p>
			
			<div class="footer">
				<p>This link will expire in 24 hours for security reasons.</p>
				<p>If you didn't create an account, you can safely ignore this email.</p>
			</div>
		</div>
	</body>
	</html>
	`

	return SendEmail(to, subject, htmlContent)
}
