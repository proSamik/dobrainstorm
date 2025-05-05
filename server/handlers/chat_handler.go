// Package handlers contains HTTP handlers for the server's endpoints.
package handlers

import (
	"fmt"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"

	"saas-server/database"
)

// ChatHandler handles websocket connections for chat functionality
type ChatHandler struct {
	DB          *database.DB
	connections sync.Map
	upgrader    websocket.Upgrader
}

// ChatMessage represents a message in the chat
type ChatMessage struct {
	Type      string      `json:"type"`
	Value     interface{} `json:"value"`
	SessionID string      `json:"sessionId"`
}

// NewChatHandler creates a new instance of ChatHandler
func NewChatHandler(db *database.DB) *ChatHandler {
	return &ChatHandler{
		DB: db,
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			// Allow all origins for now
			CheckOrigin: func(r *http.Request) bool { return true },
			// Explicitly disable compression to fix RSV1 error
			EnableCompression: false,
			// Explicitly reject compression extensions
			Subprotocols: []string{},
		},
	}
}

// HandleChat manages websocket connections for chat functionality
func (h *ChatHandler) HandleChat(w http.ResponseWriter, r *http.Request) {
	// Remove any compression extensions from the request
	if extensions := r.Header.Get("Sec-WebSocket-Extensions"); extensions != "" {
		r.Header.Del("Sec-WebSocket-Extensions")
	}

	// Extract user ID from request context (set by auth middleware)
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Upgrade the HTTP connection to a WebSocket connection
	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Failed to upgrade connection: %v", err)
		return
	}

	// Generate a unique session ID
	sessionID := fmt.Sprintf("%s-%d", userID, GetUniqueID())
	log.Printf("New chat session established: %s", sessionID)

	// Store the connection
	h.connections.Store(sessionID, conn)

	// Send initial message
	initialMsg := ChatMessage{
		Type:      "number",
		Value:     0,
		SessionID: sessionID,
	}
	if err := conn.WriteJSON(initialMsg); err != nil {
		log.Printf("Error sending initial message: %v", err)
		conn.Close()
		h.connections.Delete(sessionID)
		return
	}

	// Handle the connection in a goroutine
	go h.handleConnection(conn, sessionID, userID)
}

// handleConnection processes messages for a single websocket connection
func (h *ChatHandler) handleConnection(conn *websocket.Conn, sessionID string, userID string) {
	// Track chat history (for future database storage)
	chatHistory := []ChatMessage{
		{
			Type:      "number",
			Value:     0,
			SessionID: sessionID,
		},
	}

	// Keep track of the last number for addition
	lastNumber := 0

	// Recover from panics to prevent crashing the server
	defer func() {
		if r := recover(); r != nil {
			log.Printf("Recovered from panic in handleConnection: %v", r)
		}

		// Log the chat session when it's closed
		log.Printf("Logging chat session %s for user %s with %d messages",
			sessionID, userID, len(chatHistory))

		// Close connection and clean up
		conn.Close()
		h.connections.Delete(sessionID)
		log.Printf("Chat session closed: %s", sessionID)
	}()

	// Process messages
	for {
		// Read raw message from WebSocket
		_, rawMessage, err := conn.ReadMessage()
		if err != nil {
			log.Printf("Error reading raw message: %v", err)
			break
		}

		// Log the raw message
		log.Printf("Raw message received: %s", string(rawMessage))

		// Use only ONE method to read from WebSocket - ReadJSON
		var message ChatMessage
		err = conn.ReadJSON(&message)
		if err != nil {
			log.Printf("Error reading message: %v", err)
			break
		}

		// Log the received message
		log.Printf("Received message: %+v", message)

		// Set the session ID if it's not in the message
		if message.SessionID == "" {
			message.SessionID = sessionID
		}

		// Add message to history
		chatHistory = append(chatHistory, message)

		// Process the message based on type
		if message.Type == "number" {
			var clientInt int

			// Extract the number based on the value type
			switch v := message.Value.(type) {
			case float64:
				clientInt = int(v)
			case float32:
				clientInt = int(v)
			case int:
				clientInt = v
			case int64:
				clientInt = int(v)
			default:
				log.Printf("Invalid number type: %T", message.Value)
				errorResp := ChatMessage{
					Type:      "error",
					Value:     "Invalid number format",
					SessionID: sessionID,
				}
				if writeErr := conn.WriteJSON(errorResp); writeErr != nil {
					log.Printf("Error sending error response: %v", writeErr)
					break
				}
				continue
			}

			// Calculate the new sum
			sum := lastNumber + clientInt
			lastNumber = sum

			// Prepare response
			response := ChatMessage{
				Type:      "number",
				Value:     sum,
				SessionID: sessionID,
			}

			// Add response to history
			chatHistory = append(chatHistory, response)
			log.Printf("Sending response: %+v", response)

			// Send response
			if err := conn.WriteJSON(response); err != nil {
				log.Printf("Error sending response: %v", err)
				break
			}
		} else {
			log.Printf("Unsupported message type: %s", message.Type)
			errorResp := ChatMessage{
				Type:      "error",
				Value:     "Unsupported message type",
				SessionID: sessionID,
			}
			if writeErr := conn.WriteJSON(errorResp); writeErr != nil {
				log.Printf("Error sending error response: %v", writeErr)
				break
			}
		}
	}
}

// Variable to generate unique IDs
var (
	idCounter int64
	idMutex   sync.Mutex
)

// GetUniqueID generates a unique ID for chat sessions
func GetUniqueID() int64 {
	idMutex.Lock()
	defer idMutex.Unlock()
	idCounter++
	return idCounter
}
