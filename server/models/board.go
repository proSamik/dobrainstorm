package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"
)

// BoardData represents the JSON structure of a board's content
type BoardData struct {
	Nodes []json.RawMessage `json:"nodes"`
	Edges []json.RawMessage `json:"edges"`
}

// Value implements the driver.Valuer interface for BoardData
func (bd BoardData) Value() (driver.Value, error) {
	return json.Marshal(bd)
}

// Scan implements the sql.Scanner interface for BoardData
func (bd *BoardData) Scan(value interface{}) error {
	b, ok := value.([]byte)
	if !ok {
		return errors.New("type assertion to []byte failed")
	}
	return json.Unmarshal(b, &bd)
}

// Board represents a brainstorming board in the database
type Board struct {
	ID          string    `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	UserID      string    `json:"userId" db:"user_id"`
	Description string    `json:"description" db:"description"`
	Data        BoardData `json:"data" db:"data"`
	CreatedAt   time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time `json:"updatedAt" db:"updated_at"`
}

// BoardResponse is the data sent back to the client when fetching a board
type BoardResponse struct {
	ID          string        `json:"id"`
	Name        string        `json:"name"`
	Description string        `json:"description"`
	Nodes       []interface{} `json:"nodes"`
	Edges       []interface{} `json:"edges"`
	CreatedAt   time.Time     `json:"createdAt"`
	UpdatedAt   time.Time     `json:"updatedAt"`
}

// BoardCreateRequest is the payload for creating a new board
type BoardCreateRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

// BoardUpdateRequest is the payload for updating an existing board
type BoardUpdateRequest struct {
	Name        string        `json:"name,omitempty"`
	Description string        `json:"description,omitempty"`
	Nodes       []interface{} `json:"nodes,omitempty"`
	Edges       []interface{} `json:"edges,omitempty"`
}

// BoardListItem represents a summary of a board for listing
type BoardListItem struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	NodeCount   int       `json:"nodeCount"`
	EdgeCount   int       `json:"edgeCount"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}
