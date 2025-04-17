package database

import (
	"database/sql"
	"encoding/json"
	"errors"
	"saas-server/models"
	"time"

	"github.com/google/uuid"
)

// BoardDB handles database operations for boards
type BoardDB struct {
	db *sql.DB
}

// NewBoardDB creates a new BoardDB instance
func NewBoardDB(db *sql.DB) *BoardDB {
	return &BoardDB{db: db}
}

// CreateBoard creates a new board for a user
func (b *BoardDB) CreateBoard(userID string, req models.BoardCreateRequest) (*models.Board, error) {
	// Generate a new UUID if not provided
	id := uuid.New().String()

	// Initialize empty board data
	boardData := models.BoardData{
		Nodes: []json.RawMessage{},
		Edges: []json.RawMessage{},
	}

	// Create the board in the database
	query := `
		INSERT INTO boards (id, user_id, name, description, data, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $6)
		RETURNING id, user_id, name, description, data, created_at, updated_at
	`

	now := time.Now()

	// Convert BoardData to JSON for storage
	dataJSON, err := json.Marshal(boardData)
	if err != nil {
		return nil, err
	}

	var board models.Board

	// Execute the query
	var rawData []byte
	err = b.db.QueryRow(
		query,
		id,
		userID,
		req.Name,
		req.Description,
		dataJSON,
		now,
	).Scan(
		&board.ID,
		&board.UserID,
		&board.Name,
		&board.Description,
		&rawData,
		&board.CreatedAt,
		&board.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	// Parse the JSON data back into the BoardData struct
	if err := json.Unmarshal(rawData, &board.Data); err != nil {
		return nil, err
	}

	return &board, nil
}

// GetBoard retrieves a board by ID and checks if the requesting user owns it
func (b *BoardDB) GetBoard(boardID, userID string) (*models.Board, error) {
	query := `
		SELECT id, user_id, name, description, data, created_at, updated_at
		FROM boards
		WHERE id = $1 AND user_id = $2
	`

	var board models.Board
	var rawData []byte

	err := b.db.QueryRow(query, boardID, userID).Scan(
		&board.ID,
		&board.UserID,
		&board.Name,
		&board.Description,
		&rawData,
		&board.CreatedAt,
		&board.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("board not found or access denied")
		}
		return nil, err
	}

	// Parse the JSON data
	if err := json.Unmarshal(rawData, &board.Data); err != nil {
		return nil, err
	}

	return &board, nil
}

// UpdateBoard updates an existing board's metadata and content
func (b *BoardDB) UpdateBoard(boardID, userID string, req models.BoardUpdateRequest) (*models.Board, error) {
	// First check if the board exists and belongs to the user
	existingBoard, err := b.GetBoard(boardID, userID)
	if err != nil {
		return nil, err
	}

	// Start a transaction
	tx, err := b.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// Update metadata if provided
	if req.Name != "" || req.Description != "" {
		metaQuery := `
			UPDATE boards 
			SET name = COALESCE($1, name),
				description = COALESCE($2, description)
			WHERE id = $3 AND user_id = $4
		`
		_, err = tx.Exec(metaQuery, req.Name, req.Description, boardID, userID)
		if err != nil {
			return nil, err
		}
	}

	// Update board data if nodes or edges are provided
	if req.Nodes != nil || req.Edges != nil {
		// Prepare the updated data
		updatedData := existingBoard.Data

		// Update nodes if provided
		if req.Nodes != nil {
			nodesJSON, err := json.Marshal(req.Nodes)
			if err != nil {
				return nil, err
			}

			var nodes []json.RawMessage
			if err := json.Unmarshal(nodesJSON, &nodes); err != nil {
				return nil, err
			}
			updatedData.Nodes = nodes
		}

		// Update edges if provided
		if req.Edges != nil {
			edgesJSON, err := json.Marshal(req.Edges)
			if err != nil {
				return nil, err
			}

			var edges []json.RawMessage
			if err := json.Unmarshal(edgesJSON, &edges); err != nil {
				return nil, err
			}
			updatedData.Edges = edges
		}

		// Convert to JSON for storage
		dataJSON, err := json.Marshal(updatedData)
		if err != nil {
			return nil, err
		}

		// Update the data in the database
		dataQuery := `
			UPDATE boards 
			SET data = $1
			WHERE id = $2 AND user_id = $3
		`
		_, err = tx.Exec(dataQuery, dataJSON, boardID, userID)
		if err != nil {
			return nil, err
		}
	}

	// Commit the transaction
	if err := tx.Commit(); err != nil {
		return nil, err
	}

	// Return the updated board
	return b.GetBoard(boardID, userID)
}

// DeleteBoard deletes a board by ID if it belongs to the requesting user
func (b *BoardDB) DeleteBoard(boardID, userID string) error {
	query := `
		DELETE FROM boards
		WHERE id = $1 AND user_id = $2
	`

	result, err := b.db.Exec(query, boardID, userID)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return errors.New("board not found or access denied")
	}

	return nil
}

// ListBoards retrieves all boards belonging to a user
func (b *BoardDB) ListBoards(userID string) ([]models.BoardListItem, error) {
	query := `
		SELECT 
			id, 
			name, 
			description, 
			jsonb_array_length(data->'nodes') as node_count,
			jsonb_array_length(data->'edges') as edge_count, 
			created_at, 
			updated_at
		FROM boards
		WHERE user_id = $1
		ORDER BY updated_at DESC
	`

	rows, err := b.db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var boardList []models.BoardListItem

	for rows.Next() {
		var board models.BoardListItem
		if err := rows.Scan(
			&board.ID,
			&board.Name,
			&board.Description,
			&board.NodeCount,
			&board.EdgeCount,
			&board.CreatedAt,
			&board.UpdatedAt,
		); err != nil {
			return nil, err
		}
		boardList = append(boardList, board)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return boardList, nil
}
