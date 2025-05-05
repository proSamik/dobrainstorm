// Package handlers contains HTTP handlers for the server's endpoints.
package handlers

import (
	"fmt"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"

	"saas-server/database"
	"saas-server/pkg/openrouter"
)

// ChatHandler handles websocket connections for chat functionality
type ChatHandler struct {
	DB          *database.DB
	connections sync.Map
	upgrader    websocket.Upgrader
	openRouter  *openrouter.Client
}

// ChatMessage represents a message in the chat
type ChatMessage struct {
	Type        string      `json:"type"`
	Value       interface{} `json:"value"`
	SessionID   string      `json:"sessionId"`
	IsStreaming bool        `json:"isStreaming,omitempty"`
}

// NewChatHandler creates a new instance of ChatHandler, configured with allowed CORS origins.
func NewChatHandler(db *database.DB, allowedOrigins []string) *ChatHandler {
	// Create a map for quick origin lookup
	originMap := make(map[string]bool)
	for _, origin := range allowedOrigins {
		originMap[origin] = true
		log.Printf("[WebSocket CORS] Allowing origin: %s", origin) // Log allowed origins
	}

	// Initialize OpenRouter client
	openRouterClient, err := openrouter.NewClient()
	if err != nil {
		log.Printf("Failed to initialize OpenRouter client: %v", err)
	}

	return &ChatHandler{
		DB:         db,
		openRouter: openRouterClient,
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			// CheckOrigin function now validates against the allowed origins list.
			CheckOrigin: func(r *http.Request) bool {
				origin := r.Header.Get("Origin")
				if origin == "" {
					// Allow requests with no Origin header (e.g., non-browser clients, same-origin requests)
					// Adjust this policy if stricter control is needed.
					log.Println("[WebSocket CORS] No Origin header, allowing.")
					return true
				}

				// Simple string comparison is often sufficient and secure.
				if originMap[origin] {
					log.Printf("[WebSocket CORS] Origin '%s' is allowed.", origin)
					return true
				}

				// Optional: Handle cases like localhost with different ports if necessary,
				// but be cautious as it can weaken security.
				// Example (use carefully):
				// u, err := url.Parse(origin)
				// if err == nil && u.Hostname() == "localhost" {
				//   // Check if any allowed origin is a localhost variant
				//   for allowed := range originMap {
				//     allowedU, allowedErr := url.Parse(allowed)
				//     if allowedErr == nil && allowedU.Hostname() == "localhost" {
				//       log.Printf("[WebSocket CORS] Allowing localhost variant origin '%s'.", origin)
				// 		 return true
				//     }
				//   }
				// }

				log.Printf("[WebSocket CORS] Origin '%s' is NOT allowed.", origin)
				return false
			},
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
		Type:      "connected",
		Value:     "Connected to chat. Send a message to start a conversation.",
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
	// Track chat history
	chatHistory := []openrouter.Message{}

	// Keep track of streaming state
	isStreaming := false

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
		// Read message from WebSocket
		var message ChatMessage
		err := conn.ReadJSON(&message)
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

		// Process the message based on type
		if message.Type == "message" {
			// If currently streaming, send stop command
			if isStreaming {
				isStreaming = false
				continue
			}

			// Get the message content as string
			var messageContent string
			switch v := message.Value.(type) {
			case string:
				messageContent = v
			default:
				log.Printf("Invalid message type: %T", message.Value)
				errorResp := ChatMessage{
					Type:      "error",
					Value:     "Invalid message format",
					SessionID: sessionID,
				}
				if writeErr := conn.WriteJSON(errorResp); writeErr != nil {
					log.Printf("Error sending error response: %v", writeErr)
					break
				}
				continue
			}

			// Add user message to history
			userMessage := openrouter.Message{
				Role:    "user",
				Content: messageContent,
			}
			chatHistory = append(chatHistory, userMessage)

			// Add the client message to response for display
			clientMessage := ChatMessage{
				Type:      "message",
				Value:     messageContent,
				SessionID: sessionID,
			}
			// Send the client message back for UI display
			if err := conn.WriteJSON(clientMessage); err != nil {
				log.Printf("Error sending client message: %v", err)
				break
			}

			// Start streaming
			isStreaming = true

			// Send notification that AI is typing
			typingMsg := ChatMessage{
				Type:        "status",
				Value:       "typing",
				SessionID:   sessionID,
				IsStreaming: true,
			}
			if err := conn.WriteJSON(typingMsg); err != nil {
				log.Printf("Error sending typing status: %v", err)
				isStreaming = false
				break
			}

			// Create request to OpenRouter API
			req := openrouter.ChatCompletionRequest{
				Messages: chatHistory,
				Stream:   true,
			}

			// Build response content as we receive stream chunks
			responseContent := ""

			// Add log for streaming start
			log.Printf("Starting OpenRouter streaming for session %s", sessionID)

			// Track stream chunks
			chunkCounter := 0

			// Process the stream response
			streamErr := h.openRouter.ChatCompletionsStream(req, func(resp openrouter.StreamResponse) error {
				chunkCounter++

				if !isStreaming {
					// Client has requested to stop streaming
					log.Printf("Stream cancelled by client after %d chunks", chunkCounter)
					return fmt.Errorf("streaming canceled by client")
				}

				log.Printf("Processing stream chunk #%d for session %s", chunkCounter, sessionID)

				if len(resp.Choices) > 0 {
					choice := resp.Choices[0]

					// Check if this is the end of the stream by finish_reason
					if choice.FinishReason != "" {
						log.Printf("Stream naturally finished (finish_reason=%s) after %d chunks",
							choice.FinishReason, chunkCounter)

						// Stream has ended naturally
						streamEndMsg := ChatMessage{
							Type:        "status",
							Value:       "stream_end",
							SessionID:   sessionID,
							IsStreaming: false,
						}
						log.Printf("Sending stream_end status message")
						if err := conn.WriteJSON(streamEndMsg); err != nil {
							log.Printf("Error sending stream end status: %v", err)
							return err
						}
						return nil
					}

					// Process content delta
					content := choice.Delta.Content
					if content != "" {
						responseContent += content
						log.Printf("Stream chunk #%d content: %q (total length so far: %d)",
							chunkCounter, content, len(responseContent))

						// Send the stream chunk to client
						streamMsg := ChatMessage{
							Type:        "stream",
							Value:       content,
							SessionID:   sessionID,
							IsStreaming: true,
						}
						if err := conn.WriteJSON(streamMsg); err != nil {
							log.Printf("Error sending stream chunk: %v", err)
							isStreaming = false
							return err
						}

						log.Printf("Stream chunk #%d sent to client", chunkCounter)
					} else {
						log.Printf("Stream chunk #%d had empty content", chunkCounter)
					}
				} else {
					log.Printf("Stream chunk #%d had no choices", chunkCounter)
				}

				// Check if final usage data is being sent (end of stream)
				if resp.Usage != nil {
					log.Printf("Received final usage data after %d chunks: %+v", chunkCounter, resp.Usage)
					streamEndMsg := ChatMessage{
						Type:        "status",
						Value:       "stream_end",
						SessionID:   sessionID,
						IsStreaming: false,
					}
					if err := conn.WriteJSON(streamEndMsg); err != nil {
						log.Printf("Error sending stream end status: %v", err)
						return err
					}
					log.Printf("Sent stream_end status message with usage data")
				}

				return nil
			})

			// Streaming has ended
			isStreaming = false
			log.Printf("Streaming completed for session %s. Total chunks: %d, Content length: %d",
				sessionID, chunkCounter, len(responseContent))

			if streamErr != nil && streamErr.Error() != "streaming canceled by client" {
				log.Printf("Error streaming response: %v", streamErr)
				errorMsg := ChatMessage{
					Type:      "error",
					Value:     "Failed to get AI response",
					SessionID: sessionID,
				}
				if err := conn.WriteJSON(errorMsg); err != nil {
					log.Printf("Error sending error message: %v", err)
					break
				}
				continue
			}

			// Add AI message to history
			if responseContent != "" {
				aiMessage := openrouter.Message{
					Role:    "assistant",
					Content: responseContent,
				}
				chatHistory = append(chatHistory, aiMessage)

				// Send final complete message
				completeMsg := ChatMessage{
					Type:        "message",
					Value:       responseContent,
					SessionID:   sessionID,
					IsStreaming: false,
				}
				if err := conn.WriteJSON(completeMsg); err != nil {
					log.Printf("Error sending complete message: %v", err)
					break
				}
			}
		} else if message.Type == "stop" {
			// Client wants to stop streaming
			isStreaming = false
			stopMsg := ChatMessage{
				Type:      "status",
				Value:     "stopped",
				SessionID: sessionID,
			}
			if err := conn.WriteJSON(stopMsg); err != nil {
				log.Printf("Error sending stop confirmation: %v", err)
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
