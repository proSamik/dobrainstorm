package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"
)

// UserSettings represents the user's API and application settings
type UserSettings struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	UserID     string    `gorm:"uniqueIndex" json:"user_id"`
	AISettings JSON      `gorm:"type:json" json:"ai_settings"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// JSON custom type for storing JSON data
type JSON []byte

// Value implements the driver.Valuer interface for database storage
func (j JSON) Value() (driver.Value, error) {
	if j.IsNull() {
		return nil, nil
	}
	return string(j), nil
}

// Scan implements the sql.Scanner interface for database retrieval
func (j *JSON) Scan(value interface{}) error {
	if value == nil {
		*j = nil
		return nil
	}

	var data []byte
	switch v := value.(type) {
	case string:
		data = []byte(v)
	case []byte:
		data = v
	default:
		return errors.New("invalid scan source for JSON")
	}

	*j = data
	return nil
}

// MarshalJSON returns the JSON encoding of j
func (j JSON) MarshalJSON() ([]byte, error) {
	if j.IsNull() {
		return []byte("null"), nil
	}
	return j, nil
}

// UnmarshalJSON sets *j to a copy of data
func (j *JSON) UnmarshalJSON(data []byte) error {
	if j == nil {
		return errors.New("JSON: UnmarshalJSON on nil pointer")
	}
	*j = append((*j)[0:0], data...)
	return nil
}

// IsNull checks if the JSON value is null
func (j JSON) IsNull() bool {
	return len(j) == 0 || string(j) == "null"
}

// Unmarshal parses the JSON-encoded data and stores the result in the value pointed to by v
func (j JSON) Unmarshal(v interface{}) error {
	if j.IsNull() {
		return nil
	}
	return json.Unmarshal(j, v)
}
