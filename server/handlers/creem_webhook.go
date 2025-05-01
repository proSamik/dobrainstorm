package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"saas-server/pkg/creem"
)

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

	// Verify the webhook signature
	receivedSignature := r.Header.Get("creem-signature")
	valid, err := h.Client.VerifyWebhookSignature(body, receivedSignature)
	if err != nil {
		log.Printf("Error verifying webhook signature: %v", err)
	} else if !valid {
		log.Printf("Invalid webhook signature")
		http.Error(w, "Unauthorized - Invalid signature", http.StatusUnauthorized)
		return
	} else {
		log.Printf("Webhook signature verified successfully")
	}

	// Log the raw webhook for debugging
	log.Printf("Received webhook: %s", string(body))

	// Parse the webhook data
	var event creem.WebhookEvent
	if err := json.Unmarshal(body, &event); err != nil {
		log.Printf("Error parsing webhook body: %v", err)
		http.Error(w, "Error parsing webhook body", http.StatusBadRequest)
		return
	}

	// Log the webhook event
	log.Printf("Received webhook event: %s, ID: %s", event.EventType, event.ID)

	// Process different event types
	switch event.EventType {
	case "subscription.active":
		// New active subscription (first payment successful)
		err = h.handleSubscriptionActive(event.Object)
	case "subscription.paid":
		// Subscription payment successful
		err = h.handleSubscriptionPaid(event.Object)
	case "subscription.canceled":
		// Subscription was canceled
		err = h.handleSubscriptionCanceled(event.Object)
	case "subscription.expired":
		// Subscription has expired
		err = h.handleSubscriptionExpired(event.Object)
	case "subscription.trialing":
		// Subscription is in trial period
		err = h.handleSubscriptionTrialing(event.Object)
	case "subscription.update":
		// Subscription was updated
		err = h.handleSubscriptionUpdate(event.Object)
	case "refund.created":
		// Refund was issued
		err = h.handleRefundCreated(event.Object)
	case "checkout.completed":
		// Checkout was completed
		err = h.handleCheckoutCompleted(event.Object)
	default:
		log.Printf("Unhandled webhook event type: %s", event.EventType)
	}

	if err != nil {
		log.Printf("Error processing webhook event %s: %v", event.EventType, err)
		// Still return 200 OK to prevent Creem from retrying
	}

	// Always return a 200 OK response to acknowledge receipt of the webhook
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("Webhook received"))
}

// handleSubscriptionActive processes a subscription.active event
func (h *CreemHandler) handleSubscriptionActive(objectData json.RawMessage) error {
	var subscription creem.SubscriptionObject
	if err := json.Unmarshal(objectData, &subscription); err != nil {
		return fmt.Errorf("error parsing subscription data: %v", err)
	}

	log.Printf("Processing active subscription: %s", subscription.ID)

	// Extract user ID from metadata if available
	var userID string
	if subscription.Metadata != nil {
		if uid, ok := subscription.Metadata["userID"].(string); ok {
			userID = uid
		}
	}

	if userID == "" {
		return fmt.Errorf("no user ID found in metadata for subscription %s", subscription.ID)
	}

	// Parse dates
	currentPeriodStart := creem.ParseTime(subscription.CurrentPeriodStart)
	currentPeriodEnd := creem.ParseTime(subscription.CurrentPeriodEnd)
	lastTransactionDate := creem.ParseTime(subscription.LastTransactionDate)
	nextTransactionDate := creem.ParseTime(subscription.NextTransactionDate)
	canceledAt := creem.ParseTime(subscription.CanceledAt)

	// Create subscription record in database
	return h.DB.CreateCreemSubscription(
		userID,
		subscription.ID,
		subscription.Customer.ID,
		subscription.Product.ID,
		"", // checkout_id is not provided in this event
		"", // order_id is not provided in this event
		subscription.Status,
		subscription.CollectionMethod,
		subscription.LastTransactionID,
		lastTransactionDate,
		nextTransactionDate,
		currentPeriodStart,
		currentPeriodEnd,
		canceledAt,
		nil, // trial_ends_at is not directly provided
		subscription.Metadata,
	)
}

// handleSubscriptionPaid processes a subscription.paid event
func (h *CreemHandler) handleSubscriptionPaid(objectData json.RawMessage) error {
	var subscription creem.SubscriptionObject
	if err := json.Unmarshal(objectData, &subscription); err != nil {
		return fmt.Errorf("error parsing subscription data: %v", err)
	}

	log.Printf("Processing paid subscription: %s", subscription.ID)

	// Parse dates
	currentPeriodStart := creem.ParseTime(subscription.CurrentPeriodStart)
	currentPeriodEnd := creem.ParseTime(subscription.CurrentPeriodEnd)
	lastTransactionDate := creem.ParseTime(subscription.LastTransactionDate)
	nextTransactionDate := creem.ParseTime(subscription.NextTransactionDate)
	canceledAt := creem.ParseTime(subscription.CanceledAt)

	// Update subscription in database
	return h.DB.UpdateCreemSubscription(
		subscription.ID,
		subscription.Status,
		subscription.LastTransactionID,
		lastTransactionDate,
		nextTransactionDate,
		currentPeriodStart,
		currentPeriodEnd,
		canceledAt,
		subscription.Metadata,
	)
}

// handleSubscriptionCanceled processes a subscription.canceled event
func (h *CreemHandler) handleSubscriptionCanceled(objectData json.RawMessage) error {
	var subscription creem.SubscriptionObject
	if err := json.Unmarshal(objectData, &subscription); err != nil {
		return fmt.Errorf("error parsing subscription data: %v", err)
	}

	log.Printf("Processing canceled subscription: %s", subscription.ID)

	// Parse dates
	currentPeriodStart := creem.ParseTime(subscription.CurrentPeriodStart)
	currentPeriodEnd := creem.ParseTime(subscription.CurrentPeriodEnd)
	canceledAt := creem.ParseTime(subscription.CanceledAt)
	lastTransactionDate := creem.ParseTime(subscription.LastTransactionDate)

	// Update subscription status to canceled and set canceled_at date
	return h.DB.UpdateCreemSubscription(
		subscription.ID,
		"canceled",
		subscription.LastTransactionID,
		lastTransactionDate,
		nil, // No next transaction for canceled subscriptions
		currentPeriodStart,
		currentPeriodEnd,
		canceledAt,
		subscription.Metadata,
	)
}

// handleSubscriptionExpired processes a subscription.expired event
func (h *CreemHandler) handleSubscriptionExpired(objectData json.RawMessage) error {
	var subscription creem.SubscriptionObject
	if err := json.Unmarshal(objectData, &subscription); err != nil {
		return fmt.Errorf("error parsing subscription data: %v", err)
	}

	log.Printf("Processing expired subscription: %s", subscription.ID)

	// Parse dates
	currentPeriodStart := creem.ParseTime(subscription.CurrentPeriodStart)
	currentPeriodEnd := creem.ParseTime(subscription.CurrentPeriodEnd)

	// Update subscription status to expired
	return h.DB.UpdateCreemSubscription(
		subscription.ID,
		"expired",
		subscription.LastTransactionID,
		nil, // lastTransactionDate is not needed for expired
		nil, // No next transaction for expired subscriptions
		currentPeriodStart,
		currentPeriodEnd,
		nil, // Not explicitly canceled
		subscription.Metadata,
	)
}

// handleSubscriptionTrialing processes a subscription.trialing event
func (h *CreemHandler) handleSubscriptionTrialing(objectData json.RawMessage) error {
	var subscription creem.SubscriptionObject
	if err := json.Unmarshal(objectData, &subscription); err != nil {
		return fmt.Errorf("error parsing subscription data: %v", err)
	}

	log.Printf("Processing trialing subscription: %s", subscription.ID)

	// Parse dates
	currentPeriodStart := creem.ParseTime(subscription.CurrentPeriodStart)
	currentPeriodEnd := creem.ParseTime(subscription.CurrentPeriodEnd)
	log.Printf("Current period start: %s, Current period end: %s", currentPeriodStart, currentPeriodEnd)

	// Check if this is a new subscription or an update
	existingSub, err := h.DB.GetCreemSubscriptionByID(subscription.ID)
	if err != nil || existingSub == nil {
		// New subscription in trial period
		// Extract user ID from metadata if available
		var userID string
		if subscription.Metadata != nil {
			if uid, ok := subscription.Metadata["userID"].(string); ok {
				userID = uid
			}
		}

		if userID == "" {
			return fmt.Errorf("no user ID found in metadata for new trial subscription %s", subscription.ID)
		}

		// Create new subscription with trial status
		return h.DB.CreateCreemSubscription(
			userID,
			subscription.ID,
			subscription.Customer.ID,
			subscription.Product.ID,
			"", // checkout_id not available
			"", // order_id not available
			"trialing",
			subscription.CollectionMethod,
			"",  // no transaction yet
			nil, // no transaction yet
			nil, // no next transaction date
			currentPeriodStart,
			currentPeriodEnd,
			nil,              // not canceled
			currentPeriodEnd, // trial_ends_at is end of current period
			subscription.Metadata,
		)
	}

	// Update existing subscription to trial status
	return h.DB.UpdateCreemSubscription(
		subscription.ID,
		"trialing",
		"",  // no transaction
		nil, // no transaction date
		nil, // no next transaction date
		currentPeriodStart,
		currentPeriodEnd,
		nil, // not canceled
		subscription.Metadata,
	)
}

// handleSubscriptionUpdate processes a subscription.update event
func (h *CreemHandler) handleSubscriptionUpdate(objectData json.RawMessage) error {
	var subscription creem.SubscriptionObject
	if err := json.Unmarshal(objectData, &subscription); err != nil {
		return fmt.Errorf("error parsing subscription data: %v", err)
	}

	log.Printf("Processing updated subscription: %s", subscription.ID)

	// Parse dates
	currentPeriodStart := creem.ParseTime(subscription.CurrentPeriodStart)
	currentPeriodEnd := creem.ParseTime(subscription.CurrentPeriodEnd)
	lastTransactionDate := creem.ParseTime(subscription.LastTransactionDate)
	nextTransactionDate := creem.ParseTime(subscription.NextTransactionDate)
	canceledAt := creem.ParseTime(subscription.CanceledAt)

	// Get the existing subscription to check for product_id changes
	existingSub, err := h.DB.GetCreemSubscriptionByID(subscription.ID)
	if err != nil {
		log.Printf("Error getting existing subscription: %v", err)
		// Continue with update even if we can't get the existing subscription
	}

	// Check if product_id has changed
	if existingSub != nil && existingSub.ProductID != subscription.Product.ID {
		log.Printf("Product ID changed for subscription %s: from %s to %s",
			subscription.ID, existingSub.ProductID, subscription.Product.ID)

		// Update the database schema to include a way to update product_id
		// For now, we'll use a modified query that handles product_id changes
		return h.DB.UpdateCreemSubscriptionWithProductChange(
			subscription.ID,
			subscription.Status,
			subscription.Product.ID, // Include the updated product ID
			subscription.LastTransactionID,
			lastTransactionDate,
			nextTransactionDate,
			currentPeriodStart,
			currentPeriodEnd,
			canceledAt,
			subscription.Metadata,
		)
	}

	// If no product change, use the regular update method
	return h.DB.UpdateCreemSubscription(
		subscription.ID,
		subscription.Status,
		subscription.LastTransactionID,
		lastTransactionDate,
		nextTransactionDate,
		currentPeriodStart,
		currentPeriodEnd,
		canceledAt,
		subscription.Metadata,
	)
}

// handleRefundCreated processes a refund.created event
func (h *CreemHandler) handleRefundCreated(objectData json.RawMessage) error {
	var refund creem.RefundObject
	if err := json.Unmarshal(objectData, &refund); err != nil {
		return fmt.Errorf("error parsing refund data: %v", err)
	}

	log.Printf("Processing refund: %s for subscription: %s", refund.ID, refund.Transaction.Subscription)

	// For refunds, we may need to check the subscription status and potentially update it
	// if the refund affects access rights

	// Typically we don't automatically cancel a subscription on refund,
	// but we might want to mark it or notify appropriate teams

	// For now, we'll just log the refund and not make any subscription changes
	log.Printf("Refund processed: %s, Amount: %d %s, Reason: %s",
		refund.ID, refund.RefundAmount, refund.RefundCurrency, refund.Reason)

	return nil
}

// handleCheckoutCompleted processes a checkout.completed event
func (h *CreemHandler) handleCheckoutCompleted(objectData json.RawMessage) error {
	// Log full object data for debugging
	log.Printf("Processing checkout.completed event with data: %s", string(objectData))

	// Parse checkout data
	var checkoutData map[string]interface{}
	if err := json.Unmarshal(objectData, &checkoutData); err != nil {
		return fmt.Errorf("error parsing checkout data: %v", err)
	}

	// Extract important information
	checkoutID, _ := checkoutData["id"].(string)
	log.Printf("Checkout completed: %s", checkoutID)

	// Extract metadata if available
	var userID string
	if metadata, ok := checkoutData["metadata"].(map[string]interface{}); ok {
		if uid, ok := metadata["userID"].(string); ok {
			userID = uid
			log.Printf("User ID from metadata: %s", userID)
		}
	}

	// Note: For checkouts, we usually don't need to take action here
	// as the subscription.active or subscription.trialing webhooks will be triggered
	// immediately after a successful checkout, and those will create the subscription

	// However, you can implement custom actions based on your business requirements
	// For example, recording the checkout in a separate table, sending notifications, etc.

	log.Printf("Checkout processed: %s", checkoutID)
	return nil
}
