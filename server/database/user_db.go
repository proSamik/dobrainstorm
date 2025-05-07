package database

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"saas-server/models"
	"saas-server/pkg/encryption"
	"time"

	"github.com/google/uuid"
)

// CreateUser creates a new user in the database with the given details
func (db *DB) CreateUser(email, password, name string, emailVerified bool) (*models.User, error) {
	// Check if user already exists
	exists, err := db.UserExists(email)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, fmt.Errorf("user with email %s already exists", email)
	}

	id := uuid.New().String()
	now := time.Now()

	query := `
		INSERT INTO users (id, email, password, name, email_verified, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, email, password, name, email_verified, created_at, updated_at`

	var user models.User
	err = db.QueryRow(
		query,
		id,
		email,
		password,
		name,
		emailVerified,
		now,
		now,
	).Scan(
		&user.ID,
		&user.Email,
		&user.Password,
		&user.Name,
		&user.EmailVerified,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// GetUserByEmail retrieves a user by their email address
func (db *DB) GetUserByEmail(email string) (*models.User, error) {
	var user models.User
	query := `
		SELECT id, email, password, name, email_verified, created_at, updated_at
		FROM users
		WHERE email = $1`

	err := db.QueryRow(query, email).Scan(
		&user.ID,
		&user.Email,
		&user.Password,
		&user.Name,
		&user.EmailVerified,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// GetUserByID retrieves all user details by their unique identifier
func (db *DB) GetUserByID(id string) (*models.User, error) {
	var user models.User
	var creemStatus sql.NullString
	var creemProductID sql.NullString
	var creemSubscriptionID sql.NullString
	var creemCustomerID sql.NullString
	var creemCurrentPeriodStart sql.NullTime
	var creemCurrentPeriodEnd sql.NullTime
	var creemIsTrial sql.NullBool

	query := `
		SELECT id, email, password, name, email_verified,
			creem_subscription_status, creem_product_id, creem_subscription_id, creem_customer_id,
			creem_current_period_start, creem_current_period_end, creem_is_trial,
			created_at, updated_at
		FROM users
		WHERE id = $1`

	err := db.QueryRow(query, id).Scan(
		&user.ID,
		&user.Email,
		&user.Password,
		&user.Name,
		&user.EmailVerified,
		&creemStatus,
		&creemProductID,
		&creemSubscriptionID,
		&creemCustomerID,
		&creemCurrentPeriodStart,
		&creemCurrentPeriodEnd,
		&creemIsTrial,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	// Convert NULL values to their appropriate types
	if creemStatus.Valid {
		user.CreemSubscriptionStatus = creemStatus.String
	}
	if creemProductID.Valid {
		user.CreemProductID = creemProductID.String
	}
	if creemSubscriptionID.Valid {
		user.CreemSubscriptionID = creemSubscriptionID.String
	}
	if creemCustomerID.Valid {
		user.CreemCustomerID = creemCustomerID.String
	}
	if creemCurrentPeriodStart.Valid {
		user.CreemCurrentPeriodStart = &creemCurrentPeriodStart.Time
	}
	if creemCurrentPeriodEnd.Valid {
		user.CreemCurrentPeriodEnd = &creemCurrentPeriodEnd.Time
	}
	if creemIsTrial.Valid {
		user.CreemIsTrial = creemIsTrial.Bool
	}

	return &user, nil
}

// UserExists checks if a user with the given email already exists
func (db *DB) UserExists(email string) (bool, error) {
	var exists bool
	query := `
		SELECT EXISTS(
			SELECT 1 FROM users WHERE email = $1
		)`

	err := db.QueryRow(query, email).Scan(&exists)
	if err != nil {
		return false, err
	}
	return exists, nil
}

// UpdateUser updates a user's profile information in the database
func (db *DB) UpdateUser(id, name, email string) error {
	parsedID, err := uuid.Parse(id)
	if err != nil {
		return err
	}

	query := `
		UPDATE users
		SET name = $2, email = $3, updated_at = CURRENT_TIMESTAMP
		WHERE id = $1`

	result, err := db.Exec(query, parsedID, name, email)
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

	return nil
}

// UpdatePassword updates a user's password in the database
func (db *DB) UpdatePassword(id, hashedPassword string) error {
	parsedID, err := uuid.Parse(id)
	if err != nil {
		return err
	}

	query := `
		UPDATE users
		SET password = $2, updated_at = CURRENT_TIMESTAMP
		WHERE id = $1`

	result, err := db.Exec(query, parsedID, hashedPassword)
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

	return nil
}

// GetUserSettings retrieves user settings from the database
func (db *DB) GetUserSettings(userID string) (*models.UserSettings, error) {
	var settings models.UserSettings

	// Parse the UUID
	parsedID, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user ID format: %w", err)
	}

	query := `
		SELECT id, user_id, ai_settings, created_at, updated_at 
		FROM user_settings 
		WHERE user_id = $1
		LIMIT 1
	`

	row := db.QueryRow(query, parsedID)
	err = row.Scan(
		&settings.ID,
		&settings.UserID,
		&settings.AISettings,
		&settings.CreatedAt,
		&settings.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			// Return empty settings with no error if not found
			return &models.UserSettings{}, nil
		}
		return nil, err
	}

	return &settings, nil
}

// SaveUserSettings creates or updates user settings in the database
func (db *DB) SaveUserSettings(userID string, aiSettings []byte) error {
	// Parse the UUID
	parsedID, err := uuid.Parse(userID)
	if err != nil {
		return fmt.Errorf("invalid user ID format: %w", err)
	}

	// Check if settings already exist
	var count int
	err = db.QueryRow("SELECT COUNT(*) FROM user_settings WHERE user_id = $1", parsedID).Scan(&count)
	if err != nil {
		return err
	}

	currentTime := time.Now()

	// Create or update based on existence
	if count == 0 {
		// Create new settings
		_, err = db.Exec(
			"INSERT INTO user_settings (user_id, ai_settings, created_at, updated_at) VALUES ($1, $2, $3, $4)",
			parsedID, aiSettings, currentTime, currentTime,
		)
	} else {
		// Update existing settings
		_, err = db.Exec(
			"UPDATE user_settings SET ai_settings = $1, updated_at = $2 WHERE user_id = $3",
			aiSettings, currentTime, parsedID,
		)
	}

	return err
}

// GetUserOpenRouterAPIKey retrieves the OpenRouter API key for a specific user
// If the user has no API key or if there's an error, it returns an empty string and the error
func (db *DB) GetUserOpenRouterAPIKey(userID uuid.UUID) (string, error) {
	// Get user settings from database
	settings, err := db.GetUserSettings(userID.String())
	if err != nil {
		return "", fmt.Errorf("error retrieving user settings: %w", err)
	}

	// If no settings or empty AI settings, return empty string
	if settings == nil || settings.AISettings == nil || len(settings.AISettings) == 0 {
		return "", nil
	}

	// Parse AI settings
	var aiSettings map[string]json.RawMessage
	if err := json.Unmarshal(settings.AISettings, &aiSettings); err != nil {
		return "", fmt.Errorf("failed to parse settings: %w", err)
	}

	// Check if openrouter key exists
	openRouterData, exists := aiSettings["openrouter"]
	if !exists {
		return "", nil
	}

	// Parse the openrouter settings
	var providerSettings struct {
		Key           string   `json:"key"`
		Models        []string `json:"models,omitempty"`
		SelectedModel string   `json:"selectedModel,omitempty"`
	}

	if err := json.Unmarshal(openRouterData, &providerSettings); err != nil {
		return "", fmt.Errorf("failed to parse openrouter settings: %w", err)
	}

	// If key is empty, return empty string
	if providerSettings.Key == "" {
		return "", nil
	}

	// Decrypt the key
	decryptedKey, err := encryption.Decrypt(providerSettings.Key)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt openrouter key: %w", err)
	}

	return decryptedKey, nil
}
