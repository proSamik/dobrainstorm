package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"saas-server/database"
	"saas-server/middleware"
	"saas-server/models"

	"github.com/google/uuid"
)

// BoardHandler contains all the handlers for board operations
type BoardHandler struct {
	DB *database.DB
}

// NewBoardHandler creates a new BoardHandler instance
func NewBoardHandler(db *database.DB) *BoardHandler {
	return &BoardHandler{DB: db}
}

// CreateBoard handles requests to create a new board
func (h *BoardHandler) CreateBoard(w http.ResponseWriter, r *http.Request) {
	// Log request details
	log.Printf("[BoardHandler] CreateBoard - Method: %s, Path: %s, RemoteAddr: %s",
		r.Method, r.URL.Path, r.RemoteAddr)

	// Log headers for debugging
	log.Printf("[BoardHandler] Request Headers:")
	for name, values := range r.Header {
		log.Printf("[BoardHandler] Header %s: %v", name, values)
	}

	// Log cookies for debugging
	log.Printf("[BoardHandler] Cookies:")
	for _, cookie := range r.Cookies() {
		log.Printf("[BoardHandler] Cookie %s: %s (Domain: %s, Path: %s, Secure: %v, HttpOnly: %v)",
			cookie.Name, cookie.Value, cookie.Domain, cookie.Path, cookie.Secure, cookie.HttpOnly)
	}

	// Only accept POST requests
	if r.Method != http.MethodPost {
		log.Printf("[BoardHandler] Method not allowed: %s", r.Method)
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Log all context keys for debugging
	log.Printf("[BoardHandler] Context Values:")
	// We can't directly iterate over context values, so let's check for known keys
	log.Printf("[BoardHandler] Context userID (exported typed key): %v", r.Context().Value(middleware.ExportedUserIDKey))
	log.Printf("[BoardHandler] Context userID (typed key): %v", r.Context().Value(middleware.UserIDKey))
	log.Printf("[BoardHandler] Context userID (string key): %v", r.Context().Value(middleware.UserIDContextKey))
	log.Printf("[BoardHandler] Context userID (direct string): %v", r.Context().Value("userID"))

	// Try multiple ways to get the user ID to debug the issue
	var userID string

	// Try the middleware helper first
	userID = middleware.GetUserID(r.Context())
	log.Printf("[BoardHandler] userID from GetUserID: %q", userID)

	// If that fails, try direct context access
	if userID == "" {
		if id, ok := r.Context().Value(middleware.ExportedUserIDKey).(string); ok {
			userID = id
			log.Printf("[BoardHandler] userID from exported key: %q", userID)
		} else if id, ok := r.Context().Value(middleware.UserIDContextKey).(string); ok {
			userID = id
			log.Printf("[BoardHandler] userID from context string key: %q", userID)
		} else if id, ok := r.Context().Value("userID").(string); ok {
			userID = id
			log.Printf("[BoardHandler] userID from direct string key: %q", userID)
		}
	}

	if userID == "" {
		log.Printf("[BoardHandler] Error: user_id not found in context")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse request body
	var req models.BoardCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[BoardHandler] Error decoding request body: %v", err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Log request data
	log.Printf("[BoardHandler] Board create request: name=%q, description=%q",
		req.Name, req.Description)

	// Validate request
	if req.Name == "" {
		log.Printf("[BoardHandler] Board name is required")
		http.Error(w, "Board name is required", http.StatusBadRequest)
		return
	}

	// Create board in database
	boardDB := database.NewBoardDB(h.DB.DB)
	board, err := boardDB.CreateBoard(userID, req)
	if err != nil {
		log.Printf("[BoardHandler] Failed to create board: %v", err)
		http.Error(w, "Failed to create board", http.StatusInternalServerError)
		return
	}

	// Prepare response
	response := models.BoardResponse{
		ID:          board.ID,
		Name:        board.Name,
		Description: board.Description,
		Nodes:       []interface{}{},
		Edges:       []interface{}{},
		CreatedAt:   board.CreatedAt,
		UpdatedAt:   board.UpdatedAt,
	}

	// Return created board
	log.Printf("[BoardHandler] Board created successfully: id=%s, name=%s", board.ID, board.Name)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}

// GetBoard handles requests to get a board by ID
func (h *BoardHandler) GetBoard(w http.ResponseWriter, r *http.Request) {
	// Log request details
	log.Printf("[BoardHandler] GetBoard - Method: %s, Path: %s, Query: %s",
		r.Method, r.URL.Path, r.URL.RawQuery)

	// Only accept GET requests
	if r.Method != http.MethodGet {
		log.Printf("[BoardHandler] Method not allowed: %s", r.Method)
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Log all context keys for debugging
	log.Printf("[BoardHandler] Context Values:")
	log.Printf("[BoardHandler] Context userID (typed key): %v", r.Context().Value(middleware.UserIDKey))
	log.Printf("[BoardHandler] Context userID (string key): %v", r.Context().Value("userID"))

	// Get user ID from context using the middleware helper
	userID := middleware.GetUserID(r.Context())
	log.Printf("[BoardHandler] Retrieved userID: %q", userID)

	if userID == "" {
		log.Printf("[BoardHandler] Error: user_id not found in context")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get board ID from URL query
	boardID := r.URL.Query().Get("id")
	if boardID == "" {
		log.Printf("[BoardHandler] Board ID is required")
		http.Error(w, "Board ID is required", http.StatusBadRequest)
		return
	}

	// Validate UUID format
	if _, err := uuid.Parse(boardID); err != nil {
		log.Printf("[BoardHandler] Invalid board ID format: %s", boardID)
		http.Error(w, "Invalid board ID format", http.StatusBadRequest)
		return
	}

	// Get board from database
	boardDB := database.NewBoardDB(h.DB.DB)
	board, err := boardDB.GetBoard(boardID, userID)
	if err != nil {
		log.Printf("[BoardHandler] Board not found or access denied: %v", err)
		http.Error(w, "Board not found or access denied", http.StatusNotFound)
		return
	}

	// Parse board data into interfaces
	var nodes []interface{}
	var edges []interface{}

	// Unmarshal nodes
	if err := json.Unmarshal([]byte(`[`+joinRawMessages(board.Data.Nodes, ",")+`]`), &nodes); err != nil {
		log.Printf("[BoardHandler] Error unmarshaling nodes: %v", err)
		nodes = []interface{}{}
	}

	// Unmarshal edges
	if err := json.Unmarshal([]byte(`[`+joinRawMessages(board.Data.Edges, ",")+`]`), &edges); err != nil {
		log.Printf("[BoardHandler] Error unmarshaling edges: %v", err)
		edges = []interface{}{}
	}

	// Prepare response
	response := models.BoardResponse{
		ID:          board.ID,
		Name:        board.Name,
		Description: board.Description,
		Nodes:       nodes,
		Edges:       edges,
		CreatedAt:   board.CreatedAt,
		UpdatedAt:   board.UpdatedAt,
	}

	// Return board
	log.Printf("[BoardHandler] Board fetched successfully: id=%s, name=%s", board.ID, board.Name)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// UpdateBoard handles requests to update an existing board
func (h *BoardHandler) UpdateBoard(w http.ResponseWriter, r *http.Request) {
	// Log request details
	log.Printf("[BoardHandler] UpdateBoard - Method: %s, Path: %s, Query: %s",
		r.Method, r.URL.Path, r.URL.RawQuery)

	// Accept POST, PUT, and PATCH requests
	if r.Method != http.MethodPut && r.Method != http.MethodPatch && r.Method != http.MethodPost {
		log.Printf("[BoardHandler] Method not allowed: %s", r.Method)
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Log all context keys for debugging
	log.Printf("[BoardHandler] Context Values:")
	log.Printf("[BoardHandler] Context userID (typed key): %v", r.Context().Value(middleware.UserIDKey))
	log.Printf("[BoardHandler] Context userID (string key): %v", r.Context().Value(middleware.UserIDContextKey))

	// Get user ID from context using the middleware helper
	userID := middleware.GetUserID(r.Context())
	log.Printf("[BoardHandler] Retrieved userID: %q", userID)

	if userID == "" {
		log.Printf("[BoardHandler] Error: user_id not found in context")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get board ID from URL query
	boardID := r.URL.Query().Get("id")
	if boardID == "" {
		log.Printf("[BoardHandler] Board ID is required")
		http.Error(w, "Board ID is required", http.StatusBadRequest)
		return
	}

	// Validate UUID format
	if _, err := uuid.Parse(boardID); err != nil {
		log.Printf("[BoardHandler] Invalid board ID format: %s", boardID)
		http.Error(w, "Invalid board ID format", http.StatusBadRequest)
		return
	}

	// Parse request body
	var req models.BoardUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[BoardHandler] Error decoding request body: %v", err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Log request data
	log.Printf("[BoardHandler] Board update request for boardID=%s: name=%q, description=%q",
		boardID, req.Name, req.Description)

	// Update board in database
	boardDB := database.NewBoardDB(h.DB.DB)
	board, err := boardDB.UpdateBoard(boardID, userID, req)
	if err != nil {
		log.Printf("[BoardHandler] Failed to update board: %v", err)
		http.Error(w, "Failed to update board", http.StatusInternalServerError)
		return
	}

	// Parse board data into interfaces
	var nodes []interface{}
	var edges []interface{}

	// Unmarshal nodes
	if err := json.Unmarshal([]byte(`[`+joinRawMessages(board.Data.Nodes, ",")+`]`), &nodes); err != nil {
		log.Printf("[BoardHandler] Error unmarshaling nodes: %v", err)
		nodes = []interface{}{}
	}

	// Unmarshal edges
	if err := json.Unmarshal([]byte(`[`+joinRawMessages(board.Data.Edges, ",")+`]`), &edges); err != nil {
		log.Printf("[BoardHandler] Error unmarshaling edges: %v", err)
		edges = []interface{}{}
	}

	// Prepare response
	response := models.BoardResponse{
		ID:          board.ID,
		Name:        board.Name,
		Description: board.Description,
		Nodes:       nodes,
		Edges:       edges,
		CreatedAt:   board.CreatedAt,
		UpdatedAt:   board.UpdatedAt,
	}

	// Return updated board
	log.Printf("[BoardHandler] Board updated successfully: id=%s, name=%s", board.ID, board.Name)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// DeleteBoard handles requests to delete a board
func (h *BoardHandler) DeleteBoard(w http.ResponseWriter, r *http.Request) {
	// Log request details
	log.Printf("[BoardHandler] DeleteBoard - Method: %s, Path: %s, Query: %s",
		r.Method, r.URL.Path, r.URL.RawQuery)

	// Accept POST and DELETE requests
	if r.Method != http.MethodDelete && r.Method != http.MethodPost {
		log.Printf("[BoardHandler] Method not allowed: %s", r.Method)
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Log all context keys for debugging
	log.Printf("[BoardHandler] Context Values:")
	log.Printf("[BoardHandler] Context userID (typed key): %v", r.Context().Value(middleware.UserIDKey))
	log.Printf("[BoardHandler] Context userID (string key): %v", r.Context().Value(middleware.UserIDContextKey))

	// Get user ID from context using the middleware helper
	userID := middleware.GetUserID(r.Context())
	log.Printf("[BoardHandler] Retrieved userID: %q", userID)

	if userID == "" {
		log.Printf("[BoardHandler] Error: user_id not found in context")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get board ID from URL query
	boardID := r.URL.Query().Get("id")
	if boardID == "" {
		log.Printf("[BoardHandler] Board ID is required")
		http.Error(w, "Board ID is required", http.StatusBadRequest)
		return
	}

	// Validate UUID format
	if _, err := uuid.Parse(boardID); err != nil {
		log.Printf("[BoardHandler] Invalid board ID format: %s", boardID)
		http.Error(w, "Invalid board ID format", http.StatusBadRequest)
		return
	}

	// Delete board from database
	boardDB := database.NewBoardDB(h.DB.DB)
	if err := boardDB.DeleteBoard(boardID, userID); err != nil {
		log.Printf("[BoardHandler] Board not found or access denied: %v", err)
		http.Error(w, "Board not found or access denied", http.StatusNotFound)
		return
	}

	// Return success response
	log.Printf("[BoardHandler] Board deleted successfully: id=%s", boardID)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Board deleted successfully",
	})
}

// ListBoards handles requests to list all boards for a user
func (h *BoardHandler) ListBoards(w http.ResponseWriter, r *http.Request) {
	// Log request details
	log.Printf("[BoardHandler] ListBoards - Method: %s, Path: %s", r.Method, r.URL.Path)

	// Only accept GET requests
	if r.Method != http.MethodGet {
		log.Printf("[BoardHandler] Method not allowed: %s", r.Method)
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Log all context keys for debugging
	log.Printf("[BoardHandler] Context Values:")
	log.Printf("[BoardHandler] Context userID (typed key): %v", r.Context().Value(middleware.UserIDKey))
	log.Printf("[BoardHandler] Context userID (string key): %v", r.Context().Value("userID"))

	// Get user ID from context using the middleware helper
	userID := middleware.GetUserID(r.Context())
	log.Printf("[BoardHandler] Retrieved userID: %q", userID)

	if userID == "" {
		log.Printf("[BoardHandler] Error: user_id not found in context")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get boards from database
	boardDB := database.NewBoardDB(h.DB.DB)
	boards, err := boardDB.ListBoards(userID)
	if err != nil {
		log.Printf("[BoardHandler] Failed to list boards: %v", err)
		http.Error(w, "Failed to list boards", http.StatusInternalServerError)
		return
	}

	// Return boards
	log.Printf("[BoardHandler] Boards fetched successfully: count=%d", len(boards))
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(boards)
}

// Helper function to join RawMessage slices
func joinRawMessages(msgs []json.RawMessage, sep string) string {
	if len(msgs) == 0 {
		return ""
	}

	result := ""
	for i, msg := range msgs {
		if i > 0 {
			result += sep
		}
		result += string(msg)
	}
	return result
}
