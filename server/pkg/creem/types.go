// Package creem provides integration with the Creem payment platform
package creem

import (
	"encoding/json"
	"time"
)

// WebhookEvent represents a Creem webhook event
type WebhookEvent struct {
	ID        string          `json:"id"`
	EventType string          `json:"eventType"`
	CreatedAt int64           `json:"created_at"`
	Object    json.RawMessage `json:"object"`
}

// SubscriptionObject represents a subscription object in Creem webhook events
type SubscriptionObject struct {
	ID                  string                 `json:"id"`
	Object              string                 `json:"object"`
	Product             ProductObject          `json:"product"`
	Customer            CustomerObject         `json:"customer"`
	CollectionMethod    string                 `json:"collection_method"`
	Status              string                 `json:"status"`
	LastTransactionID   string                 `json:"last_transaction_id"`
	LastTransactionDate string                 `json:"last_transaction_date"`
	NextTransactionDate string                 `json:"next_transaction_date"`
	CurrentPeriodStart  string                 `json:"current_period_start_date"`
	CurrentPeriodEnd    string                 `json:"current_period_end_date"`
	CanceledAt          string                 `json:"canceled_at"`
	CreatedAt           string                 `json:"created_at"`
	UpdatedAt           string                 `json:"updated_at"`
	Metadata            map[string]interface{} `json:"metadata"`
	Mode                string                 `json:"mode"`
}

// ProductObject represents a product object in Creem webhook events
type ProductObject struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Description   string `json:"description"`
	ImageURL      string `json:"image_url"`
	Price         int    `json:"price"`
	Currency      string `json:"currency"`
	BillingType   string `json:"billing_type"`
	BillingPeriod string `json:"billing_period"`
	Status        string `json:"status"`
	Mode          string `json:"mode"`
}

// CustomerObject represents a customer object in Creem webhook events
type CustomerObject struct {
	ID        string `json:"id"`
	Object    string `json:"object"`
	Email     string `json:"email"`
	Name      string `json:"name"`
	Country   string `json:"country"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
	Mode      string `json:"mode"`
}

// RefundObject represents a refund object in Creem webhook events
type RefundObject struct {
	ID             string             `json:"id"`
	Object         string             `json:"object"`
	Status         string             `json:"status"`
	RefundAmount   int                `json:"refund_amount"`
	RefundCurrency string             `json:"refund_currency"`
	Reason         string             `json:"reason"`
	Transaction    TransactionObject  `json:"transaction"`
	Subscription   SubscriptionObject `json:"subscription"`
	CreatedAt      int64              `json:"created_at"`
	Mode           string             `json:"mode"`
}

// TransactionObject represents a transaction object in Creem webhook events
type TransactionObject struct {
	ID             string `json:"id"`
	Object         string `json:"object"`
	Amount         int    `json:"amount"`
	AmountPaid     int    `json:"amount_paid"`
	Currency       string `json:"currency"`
	Type           string `json:"type"`
	Status         string `json:"status"`
	RefundedAmount int    `json:"refunded_amount"`
	Subscription   string `json:"subscription"`
	CreatedAt      int64  `json:"created_at"`
	Mode           string `json:"mode"`
}

// ParseTime parses a time string in RFC3339 format and returns a pointer to time.Time
func ParseTime(timeStr string) *time.Time {
	if timeStr == "" {
		return nil
	}

	parsed, err := time.Parse(time.RFC3339, timeStr)
	if err != nil {
		return nil
	}

	return &parsed
}
