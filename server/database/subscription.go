// Package database provides database access and operations
package database

import (
	"log"
	"saas-server/models"
)

// CheckActiveSubscription checks if a user has an active subscription
// This is a wrapper around CheckCreemActiveSubscription to maintain compatibility
// with existing code that was using the old LemonSqueezy integration
func (db *DB) CheckActiveSubscription(userID string) (bool, error) {
	log.Printf("[DB] Checking active subscription for user: %s", userID)
	return db.CheckCreemActiveSubscription(userID)
}

// GetSubscriptionByUserID retrieves a user's subscription
// This is a wrapper around GetCreemSubscriptionByUserID to maintain compatibility
// with existing code that was using the old LemonSqueezy integration
func (db *DB) GetSubscriptionByUserID(userID string) (*models.CreemSubscription, error) {
	log.Printf("[DB] Getting subscription for user: %s", userID)
	return db.GetCreemSubscriptionByUserID(userID)
}
