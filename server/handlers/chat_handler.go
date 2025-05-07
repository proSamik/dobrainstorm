// Package handlers contains HTTP handlers for the server's endpoints.
package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"

	"saas-server/database"
	"saas-server/pkg/openrouter"
)

// ChatHandler handles websocket connections for chat functionality
type ChatHandler struct {
	DB              *database.DB
	connections     sync.Map
	streamCancelers sync.Map // Map of sessionID -> cancel function
	streamActive    sync.Map // Map of sessionID -> atomic bool to track if stream is actually running
	upgrader        websocket.Upgrader
	openRouter      *openrouter.Client // Default system-wide OpenRouter client
}

// ChatMessage represents a message in the chat
type ChatMessage struct {
	Type         string      `json:"type"`
	Value        interface{} `json:"value"`
	SessionID    string      `json:"sessionId"`
	IsStreaming  bool        `json:"isStreaming,omitempty"`
	Reasoning    string      `json:"reasoning,omitempty"`
	Model        string      `json:"model,omitempty"`
	IsPreference bool        `json:"isPreference,omitempty"`
	LoadHistory  bool        `json:"loadHistory,omitempty"`
}

// StopStreamRequest represents a request to stop a stream
type StopStreamRequest struct {
	SessionID string `json:"sessionId"`
}

// StopStreamResponse represents a response to a stop stream request
type StopStreamResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

// NewChatHandler creates a new instance of ChatHandler, configured with allowed CORS origins.
func NewChatHandler(db *database.DB, allowedOrigins []string) *ChatHandler {
	// Create a map for quick origin lookup
	originMap := make(map[string]bool)
	for _, origin := range allowedOrigins {
		originMap[origin] = true
		log.Printf("[WebSocket CORS] Allowing origin: %s", origin) // Log allowed origins
	}

	// Initialize default OpenRouter client (will be used as fallback)
	openRouterClient, err := openrouter.NewClient()
	if err != nil {
		log.Printf("Failed to initialize default OpenRouter client: %v", err)
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

	// Check if connection is still valid
	if conn == nil {
		return fmt.Errorf("connection is nil")
	}

	return conn.WriteJSON(msg)
}

// Thread-safe WriteMessage for lower latency binary/text message writes
func (h *ChatHandler) writeMessage(conn *websocket.Conn, mutex *sync.Mutex, messageType int, data []byte) error {
	mutex.Lock()
	defer mutex.Unlock()

	// Check if connection is still valid
	if conn == nil {
		return fmt.Errorf("connection is nil")
	}

	return conn.WriteMessage(messageType, data)
}

// Check if streaming is active for a session
func (h *ChatHandler) isStreamActive(sessionID string) bool {
	if val, ok := h.streamActive.Load(sessionID); ok {
		return atomic.LoadInt32(val.(*int32)) == 1
	}
	return false
}

// Set streaming active state for a session
func (h *ChatHandler) setStreamActive(sessionID string, active bool) {
	var val int32 = 0
	if active {
		val = 1
	}

	// Store or update the atomic value
	var atomicVal *int32
	if existingVal, ok := h.streamActive.Load(sessionID); ok {
		atomicVal = existingVal.(*int32)
		atomic.StoreInt32(atomicVal, val)
	} else {
		atomicVal = new(int32)
		atomic.StoreInt32(atomicVal, val)
		h.streamActive.Store(sessionID, atomicVal)
	}

	log.Printf("Stream active state for session %s set to: %v", sessionID, active)
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

	// Check for session ID in query parameters (for reconnecting to existing session)
	requestedSessionID := r.URL.Query().Get("sessionId")

	// Upgrade the HTTP connection to a WebSocket connection
	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Failed to upgrade connection: %v", err)
		return
	}

	// Generate a unique session ID or use the requested one
	sessionID := requestedSessionID
	if sessionID == "" {
		sessionID = fmt.Sprintf("%s-%d", userID, GetUniqueID())
		log.Printf("New chat session established: %s", sessionID)
	} else {
		log.Printf("Reconnecting to existing chat session: %s", sessionID)
	}

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
	go h.handleConnectionWithMutex(conn, sessionID, userID, &wsWriteMutex, requestedSessionID != "")
}

// handleConnectionWithMutex processes messages for a single websocket connection with mutex protection
func (h *ChatHandler) handleConnectionWithMutex(conn *websocket.Conn, sessionID string, userID string, wsWriteMutex *sync.Mutex, isReconnection bool) {
	// Track chat history
	chatHistory := []openrouter.Message{}

	// Track model being used
	currentModel := ""

	// Initialize streaming state tracking
	h.setStreamActive(sessionID, false)

	// Try to get the user's API key
	var userOpenRouterClient *openrouter.Client
	userUUID, uuidErr := uuid.Parse(userID)
	if uuidErr == nil {
		// Get the user's OpenRouter API key
		userAPIKey, err := h.DB.GetUserOpenRouterAPIKey(userUUID)
		if err != nil {
			log.Printf("Error retrieving user's OpenRouter API key: %v", err)
		} else if userAPIKey != "" {
			// Initialize OpenRouter client with user's API key
			userOpenRouterClient, err = openrouter.NewClientWithAPIKey(userAPIKey)
			if err != nil {
				log.Printf("Failed to initialize OpenRouter client with user's API key: %v", err)
			} else {
				log.Printf("Using user's OpenRouter API key for session %s", sessionID)
			}
		}
	}

	// If no user client was created, use the default system client
	if userOpenRouterClient == nil {
		userOpenRouterClient = h.openRouter
		if userOpenRouterClient != nil {
			log.Printf("Using system OpenRouter API key for session %s", sessionID)
		} else {
			log.Printf("No OpenRouter client available for session %s", sessionID)
		}
	}

	// If this is a reconnection, try to load the chat history
	if isReconnection {
		userUUID, err := uuid.Parse(userID)
		if err == nil {
			// Get chat history from database
			history, err := h.DB.GetChatHistory(userUUID, sessionID)
			if err == nil && history != nil {
				// Parse messages from JSON
				var messages []openrouter.Message
				if err := json.Unmarshal(history.Messages, &messages); err == nil {
					chatHistory = messages

					// Load model if available
					if history.Model != "" {
						currentModel = history.Model
					}

					log.Printf("Loaded %d messages from history for session %s", len(chatHistory), sessionID)

					// Send initial messages to client (last 5 or fewer)
					startIdx := 0
					if len(chatHistory) > 5 {
						startIdx = len(chatHistory) - 5

						// Send notification that there are more messages
						moreMsg := ChatMessage{
							Type:      "history_info",
							Value:     fmt.Sprintf("Showing last %d messages of %d total. Load more to see earlier messages.", 5, len(chatHistory)),
							SessionID: sessionID,
						}
						if err := h.writeJSON(conn, wsWriteMutex, moreMsg); err != nil {
							log.Printf("Error sending history info: %v", err)
						}
					}

					// Send history messages
					for i := startIdx; i < len(chatHistory); i++ {
						msg := chatHistory[i]
						clientMsg := ChatMessage{
							Type:      msg.Role,
							Value:     msg.Content,
							SessionID: sessionID,
						}

						if err := h.writeJSON(conn, wsWriteMutex, clientMsg); err != nil {
							log.Printf("Error sending history message: %v", err)
							break
						}

						// Small delay to help client process messages in order
						time.Sleep(50 * time.Millisecond)
					}
				} else {
					log.Printf("Error parsing chat history messages: %v", err)
				}
			} else {
				log.Printf("No chat history found for session %s or error: %v", sessionID, err)
			}
		} else {
			log.Printf("Could not parse user ID as UUID: %v", err)
		}
	}

	// Keep track of streaming state
	isStreaming := false

	// Declare context and cancel function at this scope
	var cancelStreamCtx context.CancelFunc

	// Recover from panics to prevent crashing the server
	defer func() {
		if r := recover(); r != nil {
			log.Printf("Recovered from panic in handleConnection: %v", r)
		}

		// Cancel any ongoing stream before closing
		if cancelStreamCtx != nil {
			log.Printf("Defer cleanup: Cancelling stream for session %s", sessionID)
			cancelStreamCtx()
			cancelStreamCtx = nil
		}

		// Update streaming state
		h.setStreamActive(sessionID, false)

		// Remove from canceler map
		if _, ok := h.streamCancelers.Load(sessionID); ok {
			log.Printf("Defer cleanup: Removing cancel function for session %s", sessionID)
			h.streamCancelers.Delete(sessionID)
		}

		// Save chat history to the database
		if len(chatHistory) > 0 {
			userUUID, err := uuid.Parse(userID)
			if err == nil {
				// Convert chat history to JSON
				messagesJSON, err := json.Marshal(chatHistory)
				if err == nil {
					// Save to database
					err = h.DB.SaveChatHistory(userUUID, sessionID, messagesJSON, currentModel)
					if err != nil {
						log.Printf("Error saving chat history: %v", err)
					} else {
						log.Printf("Saved chat history for session %s with %d messages",
							sessionID, len(chatHistory))
					}
				} else {
					log.Printf("Error serializing chat history: %v", err)
				}
			} else {
				log.Printf("Could not parse user ID as UUID for saving history: %v", err)
			}
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
		if message.Model != "" {
			log.Printf("Received model parameter: %s", message.Model)
			currentModel = message.Model
		}

		// Set the session ID if it's not in the message
		if message.SessionID == "" {
			message.SessionID = sessionID
		} else if message.SessionID != sessionID {
			log.Printf("Warning: Message session ID %s does not match connection session ID %s",
				message.SessionID, sessionID)
			// Use the connection's session ID to ensure consistency
			message.SessionID = sessionID
		}

		// Process the message based on type
		if message.Type == "message" {
			// If this is the first message and preferences are requested, fetch and add user preferences
			if len(chatHistory) == 0 && message.IsPreference {
				// Add user preferences to chat history
				userUUID, err := uuid.Parse(userID)
				if err == nil {
					userPrefs, err := h.DB.GetUserPreferences(userUUID)
					if err == nil && userPrefs != nil {
						prefMessage := openrouter.Message{
							Role:    "user",
							Content: fmt.Sprintf("About User and user preference- %s", userPrefs.UserPreferences),
						}
						chatHistory = append(chatHistory, prefMessage)
						log.Printf("Added user preferences to chat history for user %s", userID)
					} else {
						log.Printf("Could not get user preferences: %v", err)
					}
				} else {
					log.Printf("Could not parse user ID as UUID: %v", err)
				}
			}

			// If currently streaming, send stop command
			if isStreaming {
				log.Printf("Received new message while streaming, stopping current stream for session %s", sessionID)
				isStreaming = false

				// Cancel the stream if it's active
				if cancelStreamCtx != nil {
					log.Printf("Cancelling active stream for session %s", sessionID)
					cancelStreamCtx()
					cancelStreamCtx = nil

					// Remove from canceler map
					log.Printf("Removing cancel function for session %s from map", sessionID)
					h.streamCancelers.Delete(sessionID)

					// Update streaming state
					h.setStreamActive(sessionID, false)
				}

				// Small delay to allow cancelation to take effect
				time.Sleep(100 * time.Millisecond)
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
			h.setStreamActive(sessionID, true)

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
				h.setStreamActive(sessionID, false)
				break
			}

			// Create request to OpenRouter API
			req := openrouter.ChatCompletionRequest{
				Messages: chatHistory,
				Model:    message.Model,
				Stream:   true,
			}

			// Set the model if specified in the message
			if message.Model != "" {
				req.Model = message.Model
				log.Printf("Using specified model from request: %s", message.Model)
			}

			// Create a cancellable context
			var streamCtx context.Context
			streamCtx, cancelStreamCtx = context.WithCancel(context.Background())

			// Store the cancel function in the map
			log.Printf("Storing cancel function for session %s in map", sessionID)
			h.streamCancelers.Store(sessionID, cancelStreamCtx)

			// Create a closure to control access to connection state
			safeConn := conn
			activeMutex := wsWriteMutex

			// Process stream with proper context handling
			go func() {
				// Create a deferred function to ensure proper cleanup
				defer func() {
					if r := recover(); r != nil {
						log.Printf("Recovered from panic in stream goroutine: %v", r)
					}

					// Update state on completion
					isStreaming = false
					h.setStreamActive(sessionID, false)

					// Cleanup cancel function
					log.Printf("Stream goroutine completed, removing cancel function for session %s", sessionID)
					h.streamCancelers.Delete(sessionID)
					cancelStreamCtx = nil
				}()

				// Log which API key is being used
				if userOpenRouterClient.IsUsingUserKey() {
					log.Printf("Session %s: Using user's OpenRouter API key", sessionID)
				} else {
					log.Printf("Session %s: Using system OpenRouter API key", sessionID)
				}

				// Process the stream
				responseContent, reasoningContent, streamErr := h.processStreamWithContext(
					safeConn,
					sessionID,
					activeMutex,
					req,
					streamCtx,
					userOpenRouterClient, // Use the user's client or system fallback
				)

				// Check if the context was cancelled before attempting to write to the connection
				if streamCtx.Err() != nil {
					log.Printf("Context was cancelled, not sending result for session %s", sessionID)
					return
				}

				// Check if this was a client-initiated cancellation
				if streamErr != nil {
					if streamErr.Error() == "streaming canceled by client" ||
						streamErr.Error() == "context canceled" {
						log.Printf("Stream was intentionally canceled by client")

						// Send a stopped status
						stopMsg := ChatMessage{
							Type:      "status",
							Value:     "stopped",
							SessionID: sessionID,
						}
						if err := h.writeJSON(safeConn, activeMutex, stopMsg); err != nil {
							log.Printf("Error sending stop confirmation: %v", err)
						}
					} else if streamErr.Error() == "context deadline exceeded" ||
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
							if err := h.writeJSON(safeConn, activeMutex, streamEndMsg); err != nil {
								// Just log the error, don't break the connection
								log.Printf("Error sending stream end after timeout: %v", err)
							}

							// Add AI message to history
							aiMessage := openrouter.Message{
								Role:    "assistant",
								Content: responseContent,
							}
							chatHistory = append(chatHistory, aiMessage)

							// Log that we're not sending the complete message since client compiles it
							log.Printf("Not sending complete message after timeout, client has compiled %d chars",
								len(responseContent))
						}
					} else {
						// This is an unexpected error
						log.Printf("Error streaming response: %v", streamErr)
						errorMsg := ChatMessage{
							Type:      "error",
							Value:     "Failed to get AI response",
							SessionID: sessionID,
						}
						if err := h.writeJSON(safeConn, activeMutex, errorMsg); err != nil {
							log.Printf("Error sending error message: %v", err)
						}
					}
					return
				}

				// Add AI message to history with reasoning if available
				aiMessage := openrouter.Message{
					Role:    "assistant",
					Content: responseContent,
				}
				chatHistory = append(chatHistory, aiMessage)

				// Don't send a final complete message, just a stream_end status
				// Client will use the accumulated chunks as the final message
				streamEndMsg := ChatMessage{
					Type:        "status",
					Value:       "stream_end",
					SessionID:   sessionID,
					IsStreaming: false,
				}
				if err := h.writeJSON(safeConn, activeMutex, streamEndMsg); err != nil {
					log.Printf("Error sending stream end status: %v", err)
				}

				// Log that we're not sending the complete message since client compiles it
				log.Printf("Not sending complete message, client has compiled %d chars of content and %d chars of reasoning",
					len(responseContent), len(reasoningContent))
			}()

		} else if message.Type == "load_more_history" {
			// Handle request to load more history
			offset := 0
			limit := 5

			// Get offset from message if provided
			if offsetVal, ok := message.Value.(float64); ok {
				offset = int(offsetVal)
			}

			// Convert user ID to UUID
			userUUID, err := uuid.Parse(userID)
			if err != nil {
				log.Printf("Could not parse user ID as UUID: %v", err)
				continue
			}

			// Get chat history from database
			history, err := h.DB.GetChatHistory(userUUID, sessionID)
			if err != nil || history == nil {
				log.Printf("Error retrieving chat history: %v", err)
				continue
			}

			// Parse messages from JSON
			var allMessages []openrouter.Message
			if err := json.Unmarshal(history.Messages, &allMessages); err != nil {
				log.Printf("Error parsing chat history messages: %v", err)
				continue
			}

			// Calculate start and end indexes
			endIdx := len(allMessages) - offset
			startIdx := endIdx - limit

			// Adjust if needed
			if startIdx < 0 {
				startIdx = 0
			}
			if endIdx <= 0 || startIdx >= endIdx {
				// No more messages to load
				noMoreMsg := ChatMessage{
					Type:      "history_info",
					Value:     "No more messages to load",
					SessionID: sessionID,
				}
				if err := h.writeJSON(conn, wsWriteMutex, noMoreMsg); err != nil {
					log.Printf("Error sending no more messages info: %v", err)
				}
				continue
			}

			// Send earlier messages
			for i := startIdx; i < endIdx; i++ {
				msg := allMessages[i]
				clientMsg := ChatMessage{
					Type:      msg.Role,
					Value:     msg.Content,
					SessionID: sessionID,
				}

				if err := h.writeJSON(conn, wsWriteMutex, clientMsg); err != nil {
					log.Printf("Error sending history message: %v", err)
					break
				}

				// Small delay to help client process messages in order
				time.Sleep(50 * time.Millisecond)
			}

			// Indicate if there are more messages
			if startIdx > 0 {
				moreMsg := ChatMessage{
					Type:      "more_available",
					Value:     endIdx, // New offset for next load
					SessionID: sessionID,
				}
				if err := h.writeJSON(conn, wsWriteMutex, moreMsg); err != nil {
					log.Printf("Error sending more available message: %v", err)
				}
			} else {
				// No more messages to load
				noMoreMsg := ChatMessage{
					Type:      "history_info",
					Value:     "Loaded all messages",
					SessionID: sessionID,
				}
				if err := h.writeJSON(conn, wsWriteMutex, noMoreMsg); err != nil {
					log.Printf("Error sending all loaded message: %v", err)
				}
			}
		} else if message.Type == "stop" {
			// Client wants to stop streaming
			log.Printf("Received stop request for session %s", sessionID)

			// Check if stream is actually active according to our tracking
			if h.isStreamActive(sessionID) {
				log.Printf("Stream is active for session %s, proceeding with cancellation", sessionID)
				isStreaming = false

				// Get and call the cancel function for this session
				if cancel, ok := h.streamCancelers.Load(sessionID); ok {
					log.Printf("Found cancel function, aborting OpenRouter request for session %s", sessionID)
					cancelerFunc := cancel.(context.CancelFunc)
					cancelerFunc()

					// Remove from map immediately
					log.Printf("Removing cancel function for session %s from map", sessionID)
					h.streamCancelers.Delete(sessionID)
					cancelStreamCtx = nil

					// Update streaming state
					h.setStreamActive(sessionID, false)

					// Send confirmation to client that streaming was stopped
					stopMsg := ChatMessage{
						Type:      "status",
						Value:     "stopped",
						SessionID: sessionID,
					}
					if err := h.writeJSON(conn, wsWriteMutex, stopMsg); err != nil {
						log.Printf("Error sending stop confirmation: %v", err)
						break
					}
				} else {
					log.Printf("No cancel function found for session %s despite stream being marked as active", sessionID)

					// Still update tracking state to be consistent
					h.setStreamActive(sessionID, false)

					// Send confirmation to client
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
				log.Printf("No active stream found for session %s", sessionID)

				// Send message to client
				infoMsg := ChatMessage{
					Type:      "status",
					Value:     "no_active_stream",
					SessionID: sessionID,
				}
				if err := h.writeJSON(conn, wsWriteMutex, infoMsg); err != nil {
					log.Printf("Error sending no active stream message: %v", err)
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

// Create a reusable function for processing streams with context
func (h *ChatHandler) processStreamWithContext(
	conn *websocket.Conn,
	sessionID string,
	wsWriteMutex *sync.Mutex,
	req openrouter.ChatCompletionRequest,
	ctx context.Context,
	client *openrouter.Client, // Add client parameter
) (string, string, error) {

	// Track streaming state and content
	responseContent := ""
	reasoningContent := ""
	chunkCounter := 0

	// Log streaming start
	log.Printf("Starting OpenRouter streaming for session %s with cancellable context", sessionID)

	// Process the stream response
	streamErr := client.ChatCompletionsStreamWithContext(
		ctx,
		req,
		func(resp openrouter.StreamResponse, isComment bool, commentText string) error {
			// Check if context was cancelled before performing any operations
			if ctx.Err() != nil {
				log.Printf("Streaming context was cancelled, stopping processing")
				return ctx.Err()
			}

			// Handle OpenRouter comments (like processing indicators)
			if isComment {
				// Send a processing indicator to client
				processingMsg := ChatMessage{
					Type:        "status",
					Value:       "processing",
					SessionID:   sessionID,
					IsStreaming: true,
				}
				if err := h.writeJSON(conn, wsWriteMutex, processingMsg); err != nil {
					log.Printf("Error sending processing status: %v", err)
					return err
				}
				return nil
			}

			// Handle [DONE] marker
			if commentText == "[DONE]" {
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

			// Check context again before processing data
			if ctx.Err() != nil {
				log.Printf("Context cancelled during stream processing, stopping")
				return ctx.Err()
			}

			// Handle normal streaming chunks
			chunkCounter++

			if len(resp.Choices) > 0 {
				choice := resp.Choices[0]

				// Check if this is the end of the stream by finish_reason
				if choice.FinishReason != "" {
					// Stream has ended naturally
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

				// Process reasoning delta
				if reasoning := choice.Delta.Reasoning; reasoning != "" {
					reasoningContent += reasoning

					// Check context again before sending
					if ctx.Err() != nil {
						return ctx.Err()
					}

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
						return err
					}
				}

				// Process content delta - immediately send to client
				if content := choice.Delta.Content; content != "" {
					responseContent += content

					// Check context again before sending
					if ctx.Err() != nil {
						return ctx.Err()
					}

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
						return err
					}
				}
			}

			// Check if final usage data is being sent (end of stream)
			if resp.Usage != nil {
				// Check context again before sending end status
				if ctx.Err() != nil {
					return ctx.Err()
				}

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
			}

			return nil
		})

	// Log streaming completion
	log.Printf("Streaming completed for session %s. Total chunks: %d, Content length: %d, Reasoning length: %d",
		sessionID, chunkCounter, len(responseContent), len(reasoningContent))

	return responseContent, reasoningContent, streamErr
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

// HandleStopStream is a dedicated HTTP handler for stopping a stream via direct API call
// This bypasses WebSocket message queuing issues for critical control messages
func (h *ChatHandler) HandleStopStream(w http.ResponseWriter, r *http.Request) {
	// Set headers
	w.Header().Set("Content-Type", "application/json")

	// Only accept POST requests
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(StopStreamResponse{
			Success: false,
			Message: "Method not allowed. Use POST.",
		})
		return
	}

	// Extract user ID from request context (set by auth middleware)
	userID, ok := r.Context().Value("userID").(string)
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(StopStreamResponse{
			Success: false,
			Message: "Unauthorized",
		})
		return
	}

	// Decode request body
	var req StopStreamRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(StopStreamResponse{
			Success: false,
			Message: "Invalid request format",
		})
		return
	}

	// Validate session ID
	if req.SessionID == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(StopStreamResponse{
			Success: false,
			Message: "Session ID is required",
		})
		return
	}

	// Verify that the session belongs to this user (basic security check)
	if !h.validateSessionOwnership(req.SessionID, userID) {
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(StopStreamResponse{
			Success: false,
			Message: "Not authorized to stop this session",
		})
		return
	}

	// Check if stream is active
	if !h.isStreamActive(req.SessionID) {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(StopStreamResponse{
			Success: false,
			Message: "No active stream found for this session",
		})
		return
	}

	// Try to cancel the stream
	cancelSuccess := h.cancelStreamBySessionID(req.SessionID)

	// Find the connection to send a stop notification
	if conn, ok := h.connections.Load(req.SessionID); ok {
		wsConn := conn.(*websocket.Conn)

		// Create a mutex for this write operation
		var mutex sync.Mutex

		// Create a stop message
		stopMsg := ChatMessage{
			Type:      "status",
			Value:     "stopped",
			SessionID: req.SessionID,
		}

		// Try to send it with mutex protection
		if err := h.writeJSON(wsConn, &mutex, stopMsg); err != nil {
			log.Printf("Warning: Could not send stop notification via WebSocket: %v", err)
		}
	}

	// Return success response
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(StopStreamResponse{
		Success: cancelSuccess,
		Message: "Stream cancellation request processed",
	})
}

// validateSessionOwnership checks if a session belongs to a user
func (h *ChatHandler) validateSessionOwnership(sessionID, userID string) bool {
	// Simple check: sessions are named as userID-number
	// So we just check if the session ID starts with the user ID
	return len(sessionID) > len(userID) && sessionID[:len(userID)] == userID
}

// cancelStreamBySessionID tries to cancel a stream by session ID
// Returns true if cancellation was successful, false otherwise
func (h *ChatHandler) cancelStreamBySessionID(sessionID string) bool {
	// Get the cancel function for this session
	if cancelVal, ok := h.streamCancelers.Load(sessionID); ok {
		log.Printf("Found cancel function, aborting OpenRouter request for session %s", sessionID)

		// Call the cancel function
		cancel := cancelVal.(context.CancelFunc)
		cancel()

		// Clean up
		log.Printf("Removing cancel function for session %s from map", sessionID)
		h.streamCancelers.Delete(sessionID)

		// Update tracking state
		h.setStreamActive(sessionID, false)

		return true
	}

	log.Printf("No cancel function found for session %s", sessionID)
	// Still update the active state to be consistent
	h.setStreamActive(sessionID, false)

	return false
}
