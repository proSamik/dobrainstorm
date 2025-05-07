package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"saas-server/database"

	"github.com/google/uuid"
)

// ChatHistoryHandler handles HTTP requests for chat history
type ChatHistoryHandler struct {
	DB *database.DB
}

// NewChatHistoryHandler creates a new chat history handler
func NewChatHistoryHandler(db *database.DB) *ChatHistoryHandler {
	return &ChatHistoryHandler{
		DB: db,
	}
}

// GetChatHistory handles requests to retrieve a specific chat history
func (h *ChatHistoryHandler) GetChatHistory(w http.ResponseWriter, r *http.Request) {
	// Set response headers
	w.Header().Set("Content-Type", "application/json")

	// Extract user ID from request context (set by auth middleware)
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse session ID from request
	sessionID := r.URL.Query().Get("sessionId")
	if sessionID == "" {
		http.Error(w, "Session ID is required", http.StatusBadRequest)
		return
	}

	// Convert user ID to UUID
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Get chat history
	history, err := h.DB.GetChatHistory(userUUID, sessionID)
	if err != nil {
		log.Printf("Error retrieving chat history: %v", err)
		http.Error(w, "Failed to retrieve chat history", http.StatusInternalServerError)
		return
	}

	// Return the chat history
	json.NewEncoder(w).Encode(history)
}

// ListChatHistories handles requests to list all chat histories for a user
func (h *ChatHistoryHandler) ListChatHistories(w http.ResponseWriter, r *http.Request) {
	// Set response headers
	w.Header().Set("Content-Type", "application/json")

	// Extract user ID from request context (set by auth middleware)
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse limit and offset from query parameters
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 5 // Default limit
	if limitStr != "" {
		parsedLimit, err := strconv.Atoi(limitStr)
		if err == nil && parsedLimit > 0 {
			limit = parsedLimit
		}
	}

	offset := 0 // Default offset
	if offsetStr != "" {
		parsedOffset, err := strconv.Atoi(offsetStr)
		if err == nil && parsedOffset >= 0 {
			offset = parsedOffset
		}
	}

	// Convert user ID to UUID
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Get chat histories
	histories, err := h.DB.ListChatHistories(userUUID, limit, offset)
	if err != nil {
		log.Printf("Error listing chat histories: %v", err)
		http.Error(w, "Failed to list chat histories", http.StatusInternalServerError)
		return
	}

	// Return the chat histories
	json.NewEncoder(w).Encode(histories)
}

// UpdateChatHistoryTitle handles requests to update a chat history title
func (h *ChatHistoryHandler) UpdateChatHistoryTitle(w http.ResponseWriter, r *http.Request) {
	// Set response headers
	w.Header().Set("Content-Type", "application/json")

	// Only accept POST requests
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract user ID from request context (set by auth middleware)
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse request body
	var req struct {
		SessionID string `json:"sessionId"`
		Title     string `json:"title"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate request
	if req.SessionID == "" {
		http.Error(w, "Session ID is required", http.StatusBadRequest)
		return
	}

	// Convert user ID to UUID
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Update chat history title
	err = h.DB.UpdateChatHistoryTitle(userUUID, req.SessionID, req.Title)
	if err != nil {
		log.Printf("Error updating chat history title: %v", err)
		http.Error(w, "Failed to update chat history title", http.StatusInternalServerError)
		return
	}

	// Return success response
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

// DeleteChatHistory handles requests to delete a chat history
func (h *ChatHistoryHandler) DeleteChatHistory(w http.ResponseWriter, r *http.Request) {
	// Set response headers
	w.Header().Set("Content-Type", "application/json")

	// Only accept DELETE requests
	if r.Method != http.MethodDelete && r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract user ID from request context (set by auth middleware)
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse request body
	var req struct {
		SessionID string `json:"sessionId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate request
	if req.SessionID == "" {
		http.Error(w, "Session ID is required", http.StatusBadRequest)
		return
	}

	// Convert user ID to UUID
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Delete chat history
	err = h.DB.DeleteChatHistory(userUUID, req.SessionID)
	if err != nil {
		log.Printf("Error deleting chat history: %v", err)
		http.Error(w, "Failed to delete chat history", http.StatusInternalServerError)
		return
	}

	// Return success response
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}
