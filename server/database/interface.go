package database

import (
	"database/sql"
	"saas-server/models"
	"time"
)

// DBInterface defines the interface for database operations
type DBInterface interface {
	// Database core operations
	QueryRow(query string, args ...interface{}) *sql.Row
	Exec(query string, args ...interface{}) (sql.Result, error)

	// User operations
	GetUserByEmail(email string) (*models.User, error)
	GetUserByID(id string) (*models.User, error)
	CreateUser(email, password, name string, emailVerified bool) (*models.User, error)
	UpdateUser(id, name, email string) error
	UpdatePassword(id, hashedPassword string) error
	UserExists(email string) (bool, error)
	GetUserCreemSubscriptionStatus(id string) (*models.CreemSubscriptionStatus, error)
	InvalidateUserCache(userID string)

	// Admin operations
	GetUsers(page int, limit int, search string) ([]models.User, int, error)

	// Token management operations
	CreateRefreshToken(userID string, tokenHash string, deviceInfo string, ipAddress string, expiresAt time.Time) error
	GetRefreshToken(tokenHash string) (*models.RefreshToken, error)
	DeleteAllUserRefreshTokens(userID string) error

	// Token blacklist operations
	AddToBlacklist(jti string, userID string, expiresAt time.Time) error
	IsTokenBlacklisted(jti string) (bool, error)
	CleanupExpiredBlacklistedTokens() error

	// Password reset operations
	CreatePasswordResetToken(userID string, token string, expiresAt time.Time) error
	GetPasswordResetToken(token string) (string, error)
	MarkPasswordResetTokenUsed(token string) error

	// User settings operations
	GetUserSettings(userID string) (*models.UserSettings, error)
	SaveUserSettings(userID string, aiSettings []byte) error

	// Creem subscription operations
	CreateCreemSubscription(userID, subscriptionID, customerID, productID, checkoutID, orderID, status, collectionMethod, lastTransactionID string, lastTransactionDate, nextTransactionDate, currentPeriodStart, currentPeriodEnd, canceledAt, trialEndsAt *time.Time, metadata map[string]interface{}) error
	UpdateCreemSubscription(subscriptionID, status, lastTransactionID string, lastTransactionDate, nextTransactionDate, currentPeriodStart, currentPeriodEnd, canceledAt *time.Time, metadata map[string]interface{}) error
	UpdateUserCreemSubscription(userID, customerID, subscriptionID, productID, status string, currentPeriodStart, currentPeriodEnd *time.Time, isTrial bool) error
	GetCreemSubscriptionByUserID(userID string) (*models.CreemSubscription, error)
	GetCreemSubscriptionByID(subscriptionID string) (*models.CreemSubscription, error)
	CheckCreemActiveSubscription(userID string) (bool, error)

	// Email verification operations
	StoreEmailVerificationToken(token, userID, email string, expiresAt time.Time) error
	VerifyEmail(token string) error
}
