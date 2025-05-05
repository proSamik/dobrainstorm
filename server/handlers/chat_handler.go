// Package handlers contains HTTP handlers for the server's endpoints.
package handlers

import (
	"context"
	"encoding/json"
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
	Reasoning   string      `json:"reasoning,omitempty"`
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

				log.Printf("[WebSocket CORS] Origin '%s' is NOT allowed.", origin)
				return false
			},
		},
	}
}

// Use mutex for all websocket writes to ensure thread safety
func (h *ChatHandler) writeJSON(conn *websocket.Conn, mutex *sync.Mutex, msg interface{}) error {
	mutex.Lock()
	defer mutex.Unlock()
	return conn.WriteJSON(msg)
}

// Thread-safe WriteMessage for lower latency binary/text message writes
func (h *ChatHandler) writeMessage(conn *websocket.Conn, mutex *sync.Mutex, messageType int, data []byte) error {
	mutex.Lock()
	defer mutex.Unlock()
	return conn.WriteMessage(messageType, data)
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

	// Mutex to protect WebSocket writes
	var wsWriteMutex sync.Mutex

	// Send initial message
	initialMsg := ChatMessage{
		Type:      "connected",
		Value:     "Connected to chat. Send a message to start a conversation.",
		SessionID: sessionID,
	}
	if err := h.writeJSON(conn, &wsWriteMutex, initialMsg); err != nil {
		log.Printf("Error sending initial message: %v", err)
		conn.Close()
		h.connections.Delete(sessionID)
		return
	}

	// Handle the connection in a goroutine
	go h.handleConnectionWithMutex(conn, sessionID, userID, &wsWriteMutex)
}

// Create a reusable function for creating and managing the context
func (h *ChatHandler) streamWithContext(conn *websocket.Conn, sessionID string, wsWriteMutex *sync.Mutex,
	req openrouter.ChatCompletionRequest, _ *[]openrouter.Message) (string, string, error) {

	// Track streaming state and content
	isStreaming := true
	responseContent := ""
	reasoningContent := ""
	chunkCounter := 0

	// Create a cancellable context
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel() // Ensure context is always cancelled when function exits

	// Log streaming start
	// log.Printf("Starting OpenRouter streaming for session %s", sessionID)

	// Process the stream response
	streamErr := h.openRouter.ChatCompletionsStreamWithContext(
		ctx,
		req,
		func(resp openrouter.StreamResponse, isComment bool, commentText string) error {
			// Check if streaming was cancelled
			if !isStreaming {
				// log.Printf("Stream cancelled by client")
				return fmt.Errorf("streaming canceled by client")
			}

			// Handle OpenRouter comments (like processing indicators)
			if isComment {
				// log.Printf("OpenRouter comment: %s", commentText)

				// Send a processing indicator to client
				processingMsg := ChatMessage{
					Type:        "status",
					Value:       "processing",
					SessionID:   sessionID,
					IsStreaming: true,
				}
				if err := h.writeJSON(conn, wsWriteMutex, processingMsg); err != nil {
					// log.Printf("Error sending processing status: %v", err)
					return err
				}
				return nil
			}

			// Handle [DONE] marker
			if commentText == "[DONE]" {
				// log.Printf("Received [DONE] marker")
				// Stream is complete - send end marker and final content
				streamEndMsg := ChatMessage{
					Type:        "status",
					Value:       "stream_end",
					SessionID:   sessionID,
					IsStreaming: false,
				}
				if err := h.writeJSON(conn, wsWriteMutex, streamEndMsg); err != nil {
					log.Printf("Error sending stream end status: %v", err)
					return err
				}
				return nil
			}

			// Handle normal streaming chunks
			chunkCounter++
			// log.Printf("Processing stream chunk #%d for session %s", chunkCounter, sessionID)

			if len(resp.Choices) > 0 {
				choice := resp.Choices[0]

				// Check if this is the end of the stream by finish_reason
				if choice.FinishReason != "" {
					// log.Printf("Stream naturally finished (finish_reason=%s) after %d chunks",
					// 	choice.FinishReason, chunkCounter)

					// Stream has ended naturally
					streamEndMsg := ChatMessage{
						Type:        "status",
						Value:       "stream_end",
						SessionID:   sessionID,
						IsStreaming: false,
					}
					// log.Printf("Sending stream_end status message")
					if err := h.writeJSON(conn, wsWriteMutex, streamEndMsg); err != nil {
						log.Printf("Error sending stream end status: %v", err)
						return err
					}
					return nil
				}

				// Process reasoning delta
				if reasoning := choice.Delta.Reasoning; reasoning != "" {
					reasoningContent += reasoning
					// log.Printf("Stream reasoning chunk: %q (total reasoning length: %d)",
					// 	reasoning, len(reasoningContent))

					// Send reasoning chunk to client
					reasoningMsg := ChatMessage{
						Type:        "reasoning",
						Value:       reasoning,
						SessionID:   sessionID,
						IsStreaming: true,
					}

					// Use thread-safe method to write to websocket
					jsonData, err := json.Marshal(reasoningMsg)
					if err != nil {
						log.Printf("Error marshaling reasoning chunk: %v", err)
						return err
					}

					if err := h.writeMessage(conn, wsWriteMutex, websocket.TextMessage, jsonData); err != nil {
						log.Printf("Error sending reasoning chunk: %v", err)
						isStreaming = false
						return err
					}

					// log.Printf("Reasoning chunk sent to client")
				}

				// Process content delta - immediately send to client
				if content := choice.Delta.Content; content != "" {
					responseContent += content
					// log.Printf("Stream content chunk: %q (total content length: %d)",
					// 	content, len(responseContent))

					// Send the stream chunk to client IMMEDIATELY
					streamMsg := ChatMessage{
						Type:        "stream",
						Value:       content,
						SessionID:   sessionID,
						IsStreaming: true,
					}

					// Use WriteMessage instead of WriteJSON for lower latency
					// This bypasses the JSON marshal/unmarshal cycle
					jsonData, err := json.Marshal(streamMsg)
					if err != nil {
						log.Printf("Error marshaling stream chunk: %v", err)
						return err
					}

					// Use thread-safe method to write to websocket
					if err := h.writeMessage(conn, wsWriteMutex, websocket.TextMessage, jsonData); err != nil {
						log.Printf("Error sending stream chunk: %v", err)
						isStreaming = false
						return err
					}

					// log.Printf("Stream chunk #%d sent to client", chunkCounter)
				}
			} else {
				// log.Printf("Stream chunk #%d had no choices", chunkCounter)
			}

			// Check if final usage data is being sent (end of stream)
			if resp.Usage != nil {
				// log.Printf("Received final usage data after %d chunks: %+v", chunkCounter, resp.Usage)
				streamEndMsg := ChatMessage{
					Type:        "status",
					Value:       "stream_end",
					SessionID:   sessionID,
					IsStreaming: false,
				}
				if err := h.writeJSON(conn, wsWriteMutex, streamEndMsg); err != nil {
					log.Printf("Error sending stream end status: %v", err)
					return err
				}
				// log.Printf("Sent stream_end status message with usage data")
			}

			return nil
		})

	// Log streaming completion
	// log.Printf("Streaming completed for session %s. Total chunks: %d, Content length: %d, Reasoning length: %d",
	// 	sessionID, chunkCounter, len(responseContent), len(reasoningContent))

	return responseContent, reasoningContent, streamErr
}

// handleConnectionWithMutex processes messages for a single websocket connection with mutex protection
func (h *ChatHandler) handleConnectionWithMutex(conn *websocket.Conn, sessionID string, userID string, wsWriteMutex *sync.Mutex) {
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

			// Start streaming
			isStreaming = true

			// Send notification that AI is typing
			typingMsg := ChatMessage{
				Type:        "status",
				Value:       "typing",
				SessionID:   sessionID,
				IsStreaming: true,
			}
			if err := h.writeJSON(conn, wsWriteMutex, typingMsg); err != nil {
				log.Printf("Error sending typing status: %v", err)
				isStreaming = false
				break
			}

			// Create request to OpenRouter API
			req := openrouter.ChatCompletionRequest{
				Messages: chatHistory,
				Stream:   true,
			}

			// Process stream with proper context handling
			responseContent, reasoningContent, streamErr := h.streamWithContext(conn, sessionID, wsWriteMutex, req, &chatHistory)

			// Streaming has ended
			isStreaming = false

			if streamErr != nil {
				// Check if this was a client-initiated cancellation
				if streamErr.Error() == "streaming canceled by client" {
					log.Printf("Stream was intentionally canceled by client")
				} else if streamErr.Error() == "context deadline exceeded" ||
					streamErr.Error() == "context canceled" ||
					streamErr.Error() == "read: connection reset by peer" ||
					streamErr.Error() == "client disconnected" ||
					streamErr.Error() == "websocket: close sent" ||
					streamErr.Error() == "use of closed network connection" ||
					// Handle Go's net/http timeout error pattern
					streamErr.Error() == "net/http: timeout awaiting response headers" ||
					streamErr.Error() == "http2: client connection force closed via ClientConn.Close" ||
					streamErr.Error() == "http2: client connection lost" ||
					// And the error we saw in the logs
					streamErr.Error() == "error reading response: context deadline exceeded (Client.Timeout or context cancellation while reading body)" {
					// These are expected errors when the client disconnects or the stream times out
					// Treat them as normal completions
					log.Printf("Stream ended due to timeout or disconnection: %v", streamErr)

					// If we have partial content, send a completion message to client
					if responseContent != "" {
						// Send a stream end notification
						streamEndMsg := ChatMessage{
							Type:        "status",
							Value:       "stream_end",
							SessionID:   sessionID,
							IsStreaming: false,
						}
						if err := h.writeJSON(conn, wsWriteMutex, streamEndMsg); err != nil {
							// Just log the error, don't break the connection
							log.Printf("Error sending stream end after timeout: %v", err)
						}

						// Add AI message to history
						aiMessage := openrouter.Message{
							Role:    "assistant",
							Content: responseContent,
						}
						chatHistory = append(chatHistory, aiMessage)

						// Send final message
						completeMsg := ChatMessage{
							Type:        "assistant",
							Value:       responseContent + " (response incomplete due to timeout)",
							SessionID:   sessionID,
							IsStreaming: false,
						}
						if err := h.writeJSON(conn, wsWriteMutex, completeMsg); err != nil {
							// Just log the error and continue
							log.Printf("Error sending complete message after timeout: %v", err)
						}
					}
				} else {
					// This is an unexpected error
					log.Printf("Error streaming response: %v", streamErr)
					errorMsg := ChatMessage{
						Type:      "error",
						Value:     "Failed to get AI response",
						SessionID: sessionID,
					}
					if err := h.writeJSON(conn, wsWriteMutex, errorMsg); err != nil {
						log.Printf("Error sending error message: %v", err)
						break
					}
				}
				continue
			}

			// Add AI message to history with reasoning if available
			aiMessage := openrouter.Message{
				Role:    "assistant",
				Content: responseContent,
			}
			chatHistory = append(chatHistory, aiMessage)

			// Send final complete message with reasoning if available
			completeMsg := ChatMessage{
				Type:        "assistant",
				Value:       responseContent,
				Reasoning:   reasoningContent,
				SessionID:   sessionID,
				IsStreaming: false,
			}
			if err := h.writeJSON(conn, wsWriteMutex, completeMsg); err != nil {
				log.Printf("Error sending complete message: %v", err)
				break
			}
		} else if message.Type == "stop" {
			// Client wants to stop streaming
			if isStreaming {
				log.Printf("Cancelling stream by client request")
				isStreaming = false
				stopMsg := ChatMessage{
					Type:      "status",
					Value:     "stopped",
					SessionID: sessionID,
				}
				if err := h.writeJSON(conn, wsWriteMutex, stopMsg); err != nil {
					log.Printf("Error sending stop confirmation: %v", err)
					break
				}
			}
		} else {
			log.Printf("Unsupported message type: %s", message.Type)
			errorResp := ChatMessage{
				Type:      "error",
				Value:     "Unsupported message type",
				SessionID: sessionID,
			}
			if writeErr := h.writeJSON(conn, wsWriteMutex, errorResp); writeErr != nil {
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
