package database

import (
	"database/sql"
	"encoding/json"
	"log"
	"saas-server/models"
	"time"

	"github.com/google/uuid"
)

// CreateCreemSubscription creates a new Creem subscription record
func (db *DB) CreateCreemSubscription(
	userID string,
	subscriptionID string,
	customerID string,
	productID string,
	checkoutID string,
	orderID string,
	status string,
	collectionMethod string,
	lastTransactionID string,
	lastTransactionDate *time.Time,
	nextTransactionDate *time.Time,
	currentPeriodStart *time.Time,
	currentPeriodEnd *time.Time,
	canceledAt *time.Time,
	trialEndsAt *time.Time,
	metadata map[string]interface{}) error {

	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO creem_subscriptions (
			user_id, subscription_id, customer_id, product_id, checkout_id, order_id,
			status, collection_method, last_transaction_id, last_transaction_date, 
			next_transaction_date, current_period_start_date, current_period_end_date,
			canceled_at, trial_ends_at, metadata,
			created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`
	_, err = db.Exec(query,
		userID, subscriptionID, customerID, productID, checkoutID, orderID,
		status, collectionMethod, lastTransactionID, lastTransactionDate,
		nextTransactionDate, currentPeriodStart, currentPeriodEnd,
		canceledAt, trialEndsAt, metadataJSON)

	if err != nil {
		return err
	}

	// Update user record with subscription info
	err = db.UpdateUserCreemSubscription(
		userID,
		customerID,
		subscriptionID,
		productID,
		status,
		currentPeriodStart,
		currentPeriodEnd,
		trialEndsAt != nil,
	)

	return err
}

// UpdateCreemSubscription updates an existing Creem subscription
func (db *DB) UpdateCreemSubscription(
	subscriptionID string,
	status string,
	lastTransactionID string,
	lastTransactionDate *time.Time,
	nextTransactionDate *time.Time,
	currentPeriodStart *time.Time,
	currentPeriodEnd *time.Time,
	canceledAt *time.Time,
	metadata map[string]interface{}) error {

	// Convert metadata to JSON
	var metadataJSON []byte
	var err error
	if metadata != nil {
		metadataJSON, err = json.Marshal(metadata)
		if err != nil {
			return err
		}
	}

	query := `
		UPDATE creem_subscriptions 
		SET status = $1,
		    last_transaction_id = $2,
		    last_transaction_date = $3,
		    next_transaction_date = $4,
		    current_period_start_date = $5,
		    current_period_end_date = $6,
		    canceled_at = $7,
		    metadata = CASE WHEN $8::jsonb IS NULL THEN metadata ELSE $8::jsonb END,
		    updated_at = CURRENT_TIMESTAMP
		WHERE subscription_id = $9
	`

	result, err := db.Exec(query,
		status,
		lastTransactionID,
		lastTransactionDate,
		nextTransactionDate,
		currentPeriodStart,
		currentPeriodEnd,
		canceledAt,
		metadataJSON,
		subscriptionID)

	if err != nil {
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rows == 0 {
		return sql.ErrNoRows
	}

	// Get the user ID for this subscription to update user record
	var userID string
	var productID string
	var isTrial bool

	queryUser := `
		SELECT user_id, product_id, (trial_ends_at IS NOT NULL AND trial_ends_at > CURRENT_TIMESTAMP) as is_trial
		FROM creem_subscriptions
		WHERE subscription_id = $1
	`

	err = db.QueryRow(queryUser, subscriptionID).Scan(&userID, &productID, &isTrial)
	if err != nil {
		return err
	}

	// Update the user's subscription information
	return db.UpdateUserCreemSubscription(
		userID,
		"", // don't update customer ID
		subscriptionID,
		productID,
		status,
		currentPeriodStart,
		currentPeriodEnd,
		isTrial,
	)
}

// UpdateUserCreemSubscription updates the user record with Creem subscription info
func (db *DB) UpdateUserCreemSubscription(
	userID string,
	customerID string,
	subscriptionID string,
	productID string,
	status string,
	currentPeriodStart *time.Time,
	currentPeriodEnd *time.Time,
	isTrial bool) error {

	parsedID, err := uuid.Parse(userID)
	if err != nil {
		log.Printf("[DB] Error parsing UUID: %v", err)
		return err
	}

	query := `
		UPDATE users
		SET creem_subscription_id = $2,
		    creem_subscription_status = $3,
		    creem_product_id = $4,
		    creem_current_period_start = $5,
		    creem_current_period_end = $6,
		    creem_is_trial = $7,
	`

	args := []interface{}{
		parsedID,
		subscriptionID,
		status,
		productID,
		currentPeriodStart,
		currentPeriodEnd,
		isTrial,
	}

	// Only update customer_id if provided
	if customerID != "" {
		query += `creem_customer_id = $8,`
		args = append(args, customerID)
	}

	query += `updated_at = CURRENT_TIMESTAMP
		  WHERE id = $1`

	result, err := db.Exec(query, args...)
	if err != nil {
		log.Printf("[DB] Error executing update query: %v", err)
		return err
	}

	rows, err := result.RowsAffected()
	if err != nil {
		log.Printf("[DB] Error getting affected rows: %v", err)
		return err
	}

	if rows == 0 {
		log.Printf("[DB] No rows affected - user not found with ID: %s", userID)
		return sql.ErrNoRows
	}

	return nil
}

// GetCreemSubscriptionByUserID retrieves a subscription by user ID
func (db *DB) GetCreemSubscriptionByUserID(userID string) (*models.CreemSubscription, error) {
	var subscription models.CreemSubscription
	var metadataBytes []byte

	query := `
		SELECT id, user_id, subscription_id, customer_id, product_id, checkout_id, order_id,
		       status, collection_method, last_transaction_id, last_transaction_date,
		       next_transaction_date, current_period_start_date, current_period_end_date,
		       canceled_at, trial_ends_at, metadata, created_at, updated_at
		FROM creem_subscriptions
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT 1
	`

	err := db.QueryRow(query, userID).Scan(
		&subscription.ID,
		&subscription.UserID,
		&subscription.SubscriptionID,
		&subscription.CustomerID,
		&subscription.ProductID,
		&subscription.CheckoutID,
		&subscription.OrderID,
		&subscription.Status,
		&subscription.CollectionMethod,
		&subscription.LastTransactionID,
		&subscription.LastTransactionDate,
		&subscription.NextTransactionDate,
		&subscription.CurrentPeriodStart,
		&subscription.CurrentPeriodEnd,
		&subscription.CanceledAt,
		&subscription.TrialEndsAt,
		&metadataBytes,
		&subscription.CreatedAt,
		&subscription.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	// Parse metadata if it exists
	if metadataBytes != nil {
		var metadata models.JSONMap
		if err := json.Unmarshal(metadataBytes, &metadata); err != nil {
			return nil, err
		}
		subscription.Metadata = metadata
	}

	return &subscription, nil
}

// GetCreemSubscriptionByID retrieves a subscription by its ID
func (db *DB) GetCreemSubscriptionByID(subscriptionID string) (*models.CreemSubscription, error) {
	var subscription models.CreemSubscription
	var metadataBytes []byte

	query := `
		SELECT id, user_id, subscription_id, customer_id, product_id, checkout_id, order_id,
		       status, collection_method, last_transaction_id, last_transaction_date,
		       next_transaction_date, current_period_start_date, current_period_end_date,
		       canceled_at, trial_ends_at, metadata, created_at, updated_at
		FROM creem_subscriptions
		WHERE subscription_id = $1
	`

	err := db.QueryRow(query, subscriptionID).Scan(
		&subscription.ID,
		&subscription.UserID,
		&subscription.SubscriptionID,
		&subscription.CustomerID,
		&subscription.ProductID,
		&subscription.CheckoutID,
		&subscription.OrderID,
		&subscription.Status,
		&subscription.CollectionMethod,
		&subscription.LastTransactionID,
		&subscription.LastTransactionDate,
		&subscription.NextTransactionDate,
		&subscription.CurrentPeriodStart,
		&subscription.CurrentPeriodEnd,
		&subscription.CanceledAt,
		&subscription.TrialEndsAt,
		&metadataBytes,
		&subscription.CreatedAt,
		&subscription.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	// Parse metadata if it exists
	if metadataBytes != nil {
		var metadata models.JSONMap
		if err := json.Unmarshal(metadataBytes, &metadata); err != nil {
			return nil, err
		}
		subscription.Metadata = metadata
	}

	return &subscription, nil
}

// CheckCreemActiveSubscription checks if a user has an active subscription
func (db *DB) CheckCreemActiveSubscription(userID string) (bool, error) {
	query := `
		SELECT EXISTS (
			SELECT 1
			FROM creem_subscriptions
			WHERE user_id = $1
			AND status IN ('active', 'trialing')
		) as has_subscription
	`

	var hasSubscription bool
	err := db.QueryRow(query, userID).Scan(&hasSubscription)
	if err != nil {
		return false, err
	}

	return hasSubscription, nil
}

// GetUserCreemSubscriptionStatus retrieves a user's Creem subscription status
func (db *DB) GetUserCreemSubscriptionStatus(userID string) (*models.CreemSubscriptionStatus, error) {
	var status sql.NullString
	var productID sql.NullString
	var isTrial sql.NullBool

	query := `
		SELECT creem_subscription_status, creem_product_id, creem_is_trial
		FROM users
		WHERE id = $1
	`

	err := db.QueryRow(query, userID).Scan(&status, &productID, &isTrial)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	// Only create the status object if at least one field is not null
	if !status.Valid && !productID.Valid && !isTrial.Valid {
		return nil, nil
	}

	result := &models.CreemSubscriptionStatus{}

	if status.Valid {
		result.Status = &status.String
	}
	if productID.Valid {
		result.ProductID = &productID.String
	}
	if isTrial.Valid {
		result.IsTrial = &isTrial.Bool
	}

	return result, nil
}
