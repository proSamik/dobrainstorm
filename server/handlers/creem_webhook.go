package handlers

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"time"
)

// WebhookEvent represents a Creem webhook event
type WebhookEvent struct {
	ID         string                 `json:"id"`
	Type       string                 `json:"type"`
	Data       map[string]interface{} `json:"data"`
	CreatedAt  time.Time              `json:"created_at"`
	WebhookURL string                 `json:"webhook_url"`
	RequestID  string                 `json:"request_id"`
	CustomerID string                 `json:"customer_id"`
	OrderID    string                 `json:"order_id"`
	ProductID  string                 `json:"product_id"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
}

// HandleWebhook processes Creem webhooks
func (h *CreemHandler) HandleWebhook(w http.ResponseWriter, r *http.Request) {
	// Only allow POST method
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Read and parse the webhook payload
	body, err := io.ReadAll(r.Body)
	if err != nil {
		log.Printf("Error reading webhook body: %v", err)
		http.Error(w, "Error reading webhook body", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	// Parse the webhook data
	var event WebhookEvent
	if err := json.Unmarshal(body, &event); err != nil {
		log.Printf("Error parsing webhook body: %v", err)
		http.Error(w, "Error parsing webhook body", http.StatusBadRequest)
		return
	}

	// Log the webhook event
	log.Printf("Received webhook event: %s, ID: %s", event.Type, event.ID)

	// Process different event types
	switch event.Type {
	case "order.created":
		// Handle order creation
		h.handleOrderCreated(event)
	case "subscription.created":
		// Handle subscription creation
		h.handleSubscriptionCreated(event)
	case "subscription.updated":
		// Handle subscription update
		h.handleSubscriptionUpdated(event)
	case "subscription.cancelled":
		// Handle subscription cancellation
		h.handleSubscriptionCancelled(event)
	default:
		log.Printf("Unhandled webhook event type: %s", event.Type)
	}

	// Always return a 200 OK response to acknowledge receipt of the webhook
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("Webhook received"))
}

// handleOrderCreated processes an order.created event
func (h *CreemHandler) handleOrderCreated(event WebhookEvent) {
	// Extract user ID from metadata if available
	var userID string
	if event.Metadata != nil {
		if uid, ok := event.Metadata["userID"].(string); ok {
			userID = uid
		}
	}

	// If no user ID in metadata, try to find user by customer email
	if userID == "" {
		// This would require additional logic to look up user by email
		log.Printf("No user ID found in metadata for order: %s", event.OrderID)
		return
	}

	// Insert order into database if we have a user ID
	log.Printf("Processing order %s for user %s", event.OrderID, userID)

	// Save order information to database
	// Implement according to your database schema and requirements
}

// handleSubscriptionCreated processes a subscription.created event
func (h *CreemHandler) handleSubscriptionCreated(event WebhookEvent) {
	// Extract user ID from metadata if available
	var userID string
	if event.Metadata != nil {
		if uid, ok := event.Metadata["userID"].(string); ok {
			userID = uid
		}
	}

	// If no user ID in metadata, log and return
	if userID == "" {
		log.Printf("No user ID found in metadata for subscription")
		return
	}

	// Get subscription details from the event
	log.Printf("Creating subscription for user %s", userID)

	// The implementation would depend on your database schema and requirements
	// Example: update user table with subscription status
	// h.DB.UpdateUserSubscription(...)
}

// handleSubscriptionUpdated processes a subscription.updated event
func (h *CreemHandler) handleSubscriptionUpdated(event WebhookEvent) {
	// Update subscription in database
	log.Printf("Updating subscription: %v", event.ID)

	// The implementation would depend on your database schema and requirements
}

// handleSubscriptionCancelled processes a subscription.cancelled event
func (h *CreemHandler) handleSubscriptionCancelled(event WebhookEvent) {
	// Cancel subscription in database
	log.Printf("Cancelling subscription: %v", event.ID)

	// The implementation would depend on your database schema and requirements
}
