package database

import (
	"database/sql"
	"fmt"
	"saas-server/models"
)

// GetUsers retrieves a paginated list of users with optional search
func (db *DB) GetUsers(page int, limit int, search string) ([]models.User, int, error) {
	offset := (page - 1) * limit

	// Base query with all fields
	baseQuery := `
		SELECT 
			u.id, 
			u.email, 
			u.name, 
			u.email_verified,
			u.access_level,
			COALESCE(u.creem_subscription_status, '') as creem_subscription_status,
			u.creem_product_id,
			u.creem_subscription_id,
			u.creem_customer_id,
			u.creem_current_period_start,
			u.creem_current_period_end,
			u.creem_is_trial,
			u.created_at,
			u.updated_at
		FROM users u`

	// Count query
	countQuery := `SELECT COUNT(*) FROM users u`

	// Add search condition if search string is provided
	var args []interface{}
	if search != "" {
		searchCondition := ` WHERE (LOWER(u.name) LIKE LOWER($1) OR LOWER(u.email) LIKE LOWER($1))`
		baseQuery += searchCondition
		countQuery += searchCondition
		args = append(args, fmt.Sprintf("%%%s%%", search))
	}

	// Add pagination
	baseQuery += ` ORDER BY u.created_at DESC LIMIT $` + fmt.Sprintf("%d", len(args)+1) +
		` OFFSET $` + fmt.Sprintf("%d", len(args)+2)
	args = append(args, limit, offset)

	// Get total count
	var total int
	err := db.QueryRow(countQuery, args[:len(args)-2]...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("error counting users: %v", err)
	}

	// Execute the main query
	rows, err := db.Query(baseQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("error querying users: %v", err)
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var user models.User
		var accessLevel sql.NullInt64
		var creemStatus sql.NullString
		var creemProductID sql.NullString
		var creemSubscriptionID sql.NullString
		var creemCustomerID sql.NullString
		var creemCurrentPeriodStart sql.NullTime
		var creemCurrentPeriodEnd sql.NullTime
		var creemIsTrial sql.NullBool

		err := rows.Scan(
			&user.ID,
			&user.Email,
			&user.Name,
			&user.EmailVerified,
			&accessLevel,
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
			return nil, 0, fmt.Errorf("error scanning user: %v", err)
		}

		// Set access level if valid
		if accessLevel.Valid {
			user.AccessLevel = int(accessLevel.Int64)
		}

		// Set Creem fields from database
		user.CreemSubscriptionStatus = creemStatus.String
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

		users = append(users, user)
	}

	if err = rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("error iterating users: %v", err)
	}

	return users, total, nil
}
