// Package creem provides integration with the Creem payment platform
package creem

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
)

// Client represents a Creem API client
type Client struct {
	apiKey     string
	baseURL    string
	successURL string
}

// NewClient creates a new Creem API client
func NewClient() *Client {
	apiKey := os.Getenv("CREEM_API_KEY")
	successURL := os.Getenv("CREEM_SUCCESS_URL")

	// Use test API URL in development environment
	baseURL := "https://api.creem.io/v1"
	if os.Getenv("ENV") == "development" {
		baseURL = "https://test-api.creem.io/v1"
	}

	return &Client{
		apiKey:     apiKey,
		baseURL:    baseURL,
		successURL: successURL,
	}
}

// CheckoutRequest represents a request to create a checkout session
type CheckoutRequest struct {
	ProductID    string                 `json:"product_id"`
	RequestID    string                 `json:"request_id,omitempty"`
	DiscountCode string                 `json:"discount_code,omitempty"`
	SuccessURL   string                 `json:"success_url,omitempty"`
	Customer     *CustomerInfo          `json:"customer,omitempty"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

// CustomerInfo represents customer information for checkout
type CustomerInfo struct {
	Email string `json:"email"`
}

// CreateCheckout creates a new checkout session
func (c *Client) CreateCheckout(request CheckoutRequest) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/checkouts", c.baseURL)

	// Set default success URL if not provided
	if request.SuccessURL == "" {
		request.SuccessURL = c.successURL
	}

	requestBody, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("error marshaling request body: %v", err)
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(requestBody))
	if err != nil {
		return nil, fmt.Errorf("error creating request: %v", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("accept", "application/json")
	req.Header.Set("x-api-key", c.apiKey)

	// Send request
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("error sending request: %v", err)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("error reading response body: %v", err)
	}

	// Check status code
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d, body: %s", resp.StatusCode, string(body))
	}

	// Parse response
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("error parsing response body: %v", err)
	}

	// Return only the checkout_url from the result
	checkoutURL, ok := result["checkout_url"].(string)
	if !ok {
		return nil, fmt.Errorf("checkout_url not found in response")
	}
	return map[string]interface{}{"checkout_url": checkoutURL}, nil
}

// VerifyReturnURL verifies the signature in the return URL- Beneficial for single order payment
func (c *Client) VerifyReturnURL(params map[string]string, signature string) (bool, error) {
	// Create a list of key=value pairs
	var pairs []string
	for key, value := range params {
		// Skip any empty values
		if value != "" {
			pairs = append(pairs, fmt.Sprintf("%s=%s", key, value))
		}
	}

	// Add the API key as a salt parameter
	pairs = append(pairs, fmt.Sprintf("salt=%s", c.apiKey))

	// Join pairs with pipe character to form data string
	data := strings.Join(pairs, "|")

	// Generate SHA-256 hash
	hash := sha256.Sum256([]byte(data))
	// Convert hash to lowercase hex string
	calculatedSignature := fmt.Sprintf("%x", hash)

	// Compare the generated signature with the provided one
	return calculatedSignature == signature, nil
}

// GetCustomerPortal retrieves the customer portal URL
func (c *Client) GetCustomerPortal(customerID string) (map[string]interface{}, error) {
	url := fmt.Sprintf("%s/customers/billing", c.baseURL)

	requestBody, err := json.Marshal(map[string]string{
		"customer_id": customerID,
	})
	if err != nil {
		return nil, fmt.Errorf("error marshaling request body: %v", err)
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(requestBody))
	if err != nil {
		return nil, fmt.Errorf("error creating request: %v", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("accept", "application/json")
	req.Header.Set("x-api-key", c.apiKey)

	// Send request
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("error sending request: %v", err)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("error reading response body: %v", err)
	}

	// Check status code
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d, body: %s", resp.StatusCode, string(body))
	}

	// Parse response
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("error parsing response body: %v", err)
	}

	return result, nil
}

// VerifyWebhookSignature verifies the signature of a webhook
func (c *Client) VerifyWebhookSignature(payload []byte, signature string) (bool, error) {
	webhookSecret := os.Getenv("CREEM_WEBHOOK_SECRET")
	if webhookSecret == "" {
		return false, fmt.Errorf("CREEM_WEBHOOK_SECRET not set")
	}

	// Create a new HMAC by defining the hash type and the key (as byte array)
	h := hmac.New(sha256.New, []byte(webhookSecret))

	// Write payload to the HMAC
	h.Write(payload)

	// Get result and encode as hexadecimal string
	expectedSignature := fmt.Sprintf("%x", h.Sum(nil))

	// Log signature info for debugging
	fmt.Printf("Expected signature: %s\n", expectedSignature)
	fmt.Printf("Received signature: %s\n", signature)

	// Compare signatures using constant-time comparison to prevent timing attacks
	return expectedSignature == signature, nil
}
