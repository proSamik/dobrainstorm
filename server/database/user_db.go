package database

import (
	"database/sql"
	"fmt"
	"saas-server/models"
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
	var latestStatus sql.NullString
	var latestProductID sql.NullInt64
	var latestVariantID sql.NullInt64
	var latestRenewalDate sql.NullTime
	var latestEndDate sql.NullTime

	query := `
		SELECT id, email, password, name, email_verified,
			latest_status, latest_product_id, latest_variant_id,
			latest_renewal_date, latest_end_date,
			created_at, updated_at
		FROM users
		WHERE id = $1`

	err := db.QueryRow(query, id).Scan(
		&user.ID,
		&user.Email,
		&user.Password,
		&user.Name,
		&user.EmailVerified,
		&latestStatus,
		&latestProductID,
		&latestVariantID,
		&latestRenewalDate,
		&latestEndDate,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	// Convert NULL values to their appropriate types
	if latestStatus.Valid {
		user.LatestStatus = latestStatus.String
	}
	if latestProductID.Valid {
		user.LatestProductID = int(latestProductID.Int64)
	}
	if latestVariantID.Valid {
		user.LatestVariantID = int(latestVariantID.Int64)
	}
	if latestRenewalDate.Valid {
		t := latestRenewalDate.Time
		user.LatestRenewalDate = &t
	}
	if latestEndDate.Valid {
		t := latestEndDate.Time
		user.LatestEndDate = &t
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
