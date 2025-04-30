// Package handlers provides HTTP request handlers for the API endpoints
package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"saas-server/database"
	"saas-server/middleware"
	"saas-server/pkg/creem"
	"strings"
)

// CreemHandler handles Creem payment requests
type CreemHandler struct {
	DB     *database.DB
	Client *creem.Client
}

// NewCreemHandler creates a new CreemHandler instance
func NewCreemHandler(db *database.DB) *CreemHandler {
	return &CreemHandler{
		DB:     db,
		Client: creem.NewClient(),
	}
}

// HandleCheckout creates a new checkout session
func (h *CreemHandler) HandleCheckout(w http.ResponseWriter, r *http.Request) {
	// Only allow POST method
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get user ID from context
	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Check if user has an active subscription
	hasActiveSubscription, err := h.DB.CheckActiveSubscription(userID)
	if err != nil {
		log.Printf("Error checking subscription status: %v", err)
		http.Error(w, "Error checking subscription status", http.StatusInternalServerError)
		return
	}

	if hasActiveSubscription {
		http.Error(w, "User already has an active subscription", http.StatusBadRequest)
		return
	}

	// Get user details
	user, err := h.DB.GetUserByID(userID)
	if err != nil {
		log.Printf("Error getting user: %v", err)
		http.Error(w, "Error getting user information", http.StatusInternalServerError)
		return
	}

	// Parse request body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		log.Printf("Error reading request body: %v", err)
		http.Error(w, "Error reading request body", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	// Parse JSON
	var requestData struct {
		ProductID    string `json:"product_id"`
		RequestID    string `json:"request_id,omitempty"`
		DiscountCode string `json:"discount_code,omitempty"`
	}
	if err := json.Unmarshal(body, &requestData); err != nil {
		log.Printf("Error parsing request body: %v", err)
		http.Error(w, "Error parsing request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if requestData.ProductID == "" {
		http.Error(w, "Product ID is required", http.StatusBadRequest)
		return
	}

	// Prepare checkout request
	checkoutRequest := creem.CheckoutRequest{
		ProductID:    requestData.ProductID,
		RequestID:    requestData.RequestID,
		DiscountCode: requestData.DiscountCode,
		Customer: &creem.CustomerInfo{
			Email: user.Email,
		},
		Metadata: map[string]interface{}{
			"userID": userID,
		},
	}

	// Create checkout
	result, err := h.Client.CreateCheckout(checkoutRequest)
	if err != nil {
		log.Printf("Error creating checkout: %v", err)
		http.Error(w, "Error creating checkout", http.StatusInternalServerError)
		return
	}

	// Return response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// HandleCustomerPortal retrieves the customer portal URL
func (h *CreemHandler) HandleCustomerPortal(w http.ResponseWriter, r *http.Request) {
	// Only allow GET method
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get user ID from context
	userID := middleware.GetUserID(r.Context())
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get user subscription to retrieve customer_id
	subscription, err := h.DB.GetSubscriptionByUserID(userID)
	if err != nil {
		log.Printf("Error getting subscription: %v", err)
		http.Error(w, "Error getting subscription information", http.StatusInternalServerError)
		return
	}

	if subscription == nil || subscription.CustomerID == 0 {
		http.Error(w, "No active subscription or customer ID found", http.StatusBadRequest)
		return
	}

	// Convert CustomerID to string for API call
	customerID := fmt.Sprintf("%d", subscription.CustomerID)

	// Get customer portal
	result, err := h.Client.GetCustomerPortal(customerID)
	if err != nil {
		log.Printf("Error getting customer portal: %v", err)
		http.Error(w, "Error getting customer portal", http.StatusInternalServerError)
		return
	}

	// Return response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// HandleVerifyReturnURL verifies the signature in the return URL
func (h *CreemHandler) HandleVerifyReturnURL(w http.ResponseWriter, r *http.Request) {
	// Only allow GET method
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get all query parameters
	queryParams := r.URL.Query()

	// Get signature from query parameter
	signature := queryParams.Get("signature")
	if signature == "" {
		http.Error(w, "Signature is required", http.StatusBadRequest)
		return
	}

	// Extract parameters from query (excluding signature)
	params := make(map[string]string)
	for key, values := range queryParams {
		if key != "signature" && len(values) > 0 {
			params[key] = values[0]
		}
	}

	// Check required parameters
	requiredParams := []string{"checkout_id", "order_id", "customer_id", "product_id"}
	var missingParams []string
	for _, param := range requiredParams {
		if _, exists := params[param]; !exists || params[param] == "" {
			missingParams = append(missingParams, param)
		}
	}

	if len(missingParams) > 0 {
		errorMsg := fmt.Sprintf("Missing required parameters: %s", strings.Join(missingParams, ", "))
		http.Error(w, errorMsg, http.StatusBadRequest)
		return
	}

	// Verify signature
	valid, err := h.Client.VerifyReturnURL(params, signature)
	if err != nil {
		log.Printf("Error verifying signature: %v", err)
		http.Error(w, "Error verifying signature", http.StatusInternalServerError)
		return
	}

	if !valid {
		http.Error(w, "Invalid signature", http.StatusBadRequest)
		return
	}

	// If we reached here, the signature is valid
	// Return success response with the validated parameters
	response := map[string]interface{}{
		"valid": true,
		"params": map[string]string{
			"checkout_id":     params["checkout_id"],
			"order_id":        params["order_id"],
			"customer_id":     params["customer_id"],
			"subscription_id": params["subscription_id"],
			"product_id":      params["product_id"],
			"request_id":      params["request_id"],
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
