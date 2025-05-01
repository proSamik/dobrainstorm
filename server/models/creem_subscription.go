package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"
)

// CreemSubscription represents a subscription in the Creem payment system
type CreemSubscription struct {
	ID                  int        `json:"id"`
	UserID              string     `json:"user_id"`
	SubscriptionID      string     `json:"subscription_id"`
	CustomerID          string     `json:"customer_id"`
	ProductID           string     `json:"product_id"`
	CheckoutID          string     `json:"checkout_id,omitempty"`
	OrderID             string     `json:"order_id,omitempty"`
	Status              string     `json:"status"`
	CollectionMethod    string     `json:"collection_method,omitempty"`
	LastTransactionID   string     `json:"last_transaction_id,omitempty"`
	LastTransactionDate *time.Time `json:"last_transaction_date,omitempty"`
	NextTransactionDate *time.Time `json:"next_transaction_date,omitempty"`
	CurrentPeriodStart  *time.Time `json:"current_period_start_date,omitempty"`
	CurrentPeriodEnd    *time.Time `json:"current_period_end_date,omitempty"`
	CanceledAt          *time.Time `json:"canceled_at,omitempty"`
	TrialEndsAt         *time.Time `json:"trial_ends_at,omitempty"`
	Metadata            JSONMap    `json:"metadata,omitempty"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
}

// JSONMap is a custom type for handling JSONB data
type JSONMap map[string]interface{}

// Value implements the driver.Valuer interface for JSONMap
func (j JSONMap) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

// Scan implements the sql.Scanner interface for JSONMap
func (j *JSONMap) Scan(value interface{}) error {
	if value == nil {
		*j = nil
		return nil
	}

	b, ok := value.([]byte)
	if !ok {
		return errors.New("type assertion to []byte failed")
	}

	return json.Unmarshal(b, j)
}

// CreemSubscriptionStatus represents a user's subscription status in Creem
type CreemSubscriptionStatus struct {
	Status    *string `json:"status,omitempty"`
	ProductID *string `json:"product_id,omitempty"`
	IsTrial   *bool   `json:"is_trial,omitempty"`
}
