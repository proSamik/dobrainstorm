// Package handlers provides HTTP request handlers for the API endpoints
package handlers

import (
	"encoding/json"
	"fmt"
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

	// Get query parameters
	productID := r.URL.Query().Get("product_id")
	discountCode := r.URL.Query().Get("discount_code") // Optional

	// Validate required fields
	if productID == "" {
		http.Error(w, "Product ID is required", http.StatusBadRequest)
		return
	}

	// Prepare checkout request
	checkoutRequest := creem.CheckoutRequest{
		ProductID:    productID,
		DiscountCode: discountCode,
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

// Extend it later to handle single order payment- HandleVerifyReturnURL verifies the signature in the return URL
// HandleVerifyReturnURL verifies the signature in the return URL
func (h *CreemHandler) HandleVerifyReturnURL(w http.ResponseWriter, r *http.Request) {
	log.Println("HandleVerifyReturnURL: Request received")

	// Only allow GET method
	if r.Method != http.MethodGet {
		log.Println("HandleVerifyReturnURL: Method not allowed")
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	log.Println("HandleVerifyReturnURL: Method is GET")

	// Get all query parameters
	queryParams := r.URL.Query()
	log.Printf("HandleVerifyReturnURL: Query parameters received: %v", queryParams)

	// Get signature from query parameter
	signature := queryParams.Get("signature")
	if signature == "" {
		log.Println("HandleVerifyReturnURL: Signature is required")
		http.Error(w, "Signature is required", http.StatusBadRequest)
		return
	}
	log.Printf("HandleVerifyReturnURL: Signature received: %s", signature)

	// Extract parameters from query (excluding signature)
	params := make(map[string]string)
	for key, values := range queryParams {
		if key != "signature" && len(values) > 0 {
			params[key] = values[0]
		}
	}
	log.Printf("HandleVerifyReturnURL: Parameters extracted: %v", params)

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
		log.Printf("HandleVerifyReturnURL: %s", errorMsg)
		http.Error(w, errorMsg, http.StatusBadRequest)
		return
	}
	log.Println("HandleVerifyReturnURL: All required parameters are present")

	// Verify signature
	valid, err := h.Client.VerifyReturnURL(params, signature)
	if err != nil {
		log.Printf("HandleVerifyReturnURL: Error verifying signature: %v", err)
		http.Error(w, "Error verifying signature", http.StatusInternalServerError)
		return
	}

	if !valid {
		log.Println("HandleVerifyReturnURL: Invalid signature")
		http.Error(w, "Invalid signature", http.StatusBadRequest)
		return
	}
	log.Println("HandleVerifyReturnURL: Signature verified successfully")

	// If we reached here, the signature is valid
	// Return simple success response
	response := map[string]interface{}{
		"valid": true,
	}
	log.Println("HandleVerifyReturnURL: Sending success response")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
	log.Println("HandleVerifyReturnURL: Response sent")
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

	if subscription == nil {
		http.Error(w, "No active subscription or customer ID found", http.StatusBadRequest)
		return
	}

	// Convert CustomerID to string for API call
	customerID := subscription.CustomerID

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
