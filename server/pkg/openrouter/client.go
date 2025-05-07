// Package openrouter provides a client for the OpenRouter API.
package openrouter

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

const (
	// BaseURL is the base URL for the OpenRouter API
	BaseURL = "https://openrouter.ai/api/v1"
	// DefaultModel is the default model to use
	DefaultModel = "qwen/qwq-32b:free"
)

// Client represents an OpenRouter API client
type Client struct {
	apiKey        string
	httpClient    *http.Client
	frontendURL   string
	frontendTitle string
	isUserKey     bool // Indicates if we're using a user-specific key
}

// NewClient creates a new OpenRouter client with the default API key from environment variables
func NewClient() (*Client, error) {
	apiKey := os.Getenv("OPENROUTER_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("OPENROUTER_API_KEY environment variable is not set")
	}

	frontendURL := os.Getenv("FRONTEND_URL")
	frontendTitle := os.Getenv("FRONTEND_TITLE")

	return &Client{
		apiKey:        apiKey,
		frontendURL:   frontendURL,
		frontendTitle: frontendTitle,
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
		isUserKey: false,
	}, nil
}

// NewClientWithAPIKey creates a new OpenRouter client with a user-provided API key
func NewClientWithAPIKey(apiKey string) (*Client, error) {
	if apiKey == "" {
		// Fall back to system key if user key is empty
		return NewClient()
	}

	frontendURL := os.Getenv("FRONTEND_URL")
	frontendTitle := os.Getenv("FRONTEND_TITLE")

	return &Client{
		apiKey:        apiKey,
		frontendURL:   frontendURL,
		frontendTitle: frontendTitle,
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
		isUserKey: true,
	}, nil
}

// IsUsingUserKey returns whether the client is using a user-specific API key
func (c *Client) IsUsingUserKey() bool {
	return c.isUserKey
}

// Message represents a chat message
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ReasoningConfig represents options for model reasoning
type ReasoningConfig struct {
	Effort    string `json:"effort,omitempty"`     // "low", "medium", "high"
	MaxTokens int    `json:"max_tokens,omitempty"` // Specific token budget for reasoning
	Exclude   bool   `json:"exclude,omitempty"`    // Whether to exclude reasoning from response
}

// ChatCompletionRequest represents a request to the chat completions endpoint
type ChatCompletionRequest struct {
	Model       string           `json:"model"`
	Messages    []Message        `json:"messages"`
	Stream      bool             `json:"stream"`
	MaxTokens   int              `json:"max_tokens,omitempty"`
	Temperature float64          `json:"temperature,omitempty"`
	Reasoning   *ReasoningConfig `json:"reasoning,omitempty"`
}

// ChatCompletionResponse represents a response from the chat completions endpoint
type ChatCompletionResponse struct {
	ID      string                 `json:"id"`
	Choices []ChatCompletionChoice `json:"choices"`
	Usage   ChatCompletionUsage    `json:"usage,omitempty"`
}

// ChatCompletionChoice represents a choice in a chat completion response
type ChatCompletionChoice struct {
	Message      ChatCompletionMessage `json:"message"`
	FinishReason string                `json:"finish_reason,omitempty"`
}

// ChatCompletionMessage represents a message in a chat completion choice
type ChatCompletionMessage struct {
	Role      string `json:"role"`
	Content   string `json:"content"`
	Reasoning string `json:"reasoning,omitempty"`
}

// ChatCompletionUsage represents the token usage in a chat completion response
type ChatCompletionUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// StreamResponse represents a response in a stream of chat completions
type StreamResponse struct {
	ID      string               `json:"id"`
	Object  string               `json:"object"`
	Created int64                `json:"created"`
	Model   string               `json:"model"`
	Choices []StreamChoiceData   `json:"choices"`
	Usage   *ChatCompletionUsage `json:"usage,omitempty"`
}

// StreamChoiceData represents a choice in a stream response
type StreamChoiceData struct {
	Index        int         `json:"index"`
	Delta        StreamDelta `json:"delta"`
	FinishReason string      `json:"finish_reason,omitempty"`
}

// StreamDelta represents the delta in a stream choice
type StreamDelta struct {
	Role      string `json:"role,omitempty"`
	Content   string `json:"content,omitempty"`
	Reasoning string `json:"reasoning,omitempty"`
}

// ChatCompletions sends a chat completion request to the OpenRouter API
func (c *Client) ChatCompletions(req ChatCompletionRequest) (*ChatCompletionResponse, error) {
	// Set the model if not provided
	if req.Model == "" {
		req.Model = DefaultModel
	}

	// Add a system message if not present
	hasSystemMessage := false
	for _, message := range req.Messages {
		if message.Role == "system" {
			hasSystemMessage = true
			break
		}
	}

	if !hasSystemMessage {
		systemMessage := Message{
			Role:    "system",
			Content: "Give results in plain text",
		}
		req.Messages = append([]Message{systemMessage}, req.Messages...)
	}

	jsonData, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("error marshaling request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", BaseURL+"/chat/completions", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("error creating request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)

	// Set optional headers if available
	if c.frontendURL != "" {
		httpReq.Header.Set("HTTP-Referer", c.frontendURL)
	}
	if c.frontendTitle != "" {
		httpReq.Header.Set("X-Title", c.frontendTitle)
	}

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("error sending request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("error from OpenRouter API: status %d, body: %s", resp.StatusCode, string(body))
	}

	var result ChatCompletionResponse
	err = json.NewDecoder(resp.Body).Decode(&result)
	if err != nil {
		return nil, fmt.Errorf("error decoding response: %w", err)
	}

	return &result, nil
}

// ChatCompletionsStreamWithContext sends a streaming chat completion request to the OpenRouter API
// and calls the callback function for each chunk received, including comment lines.
// This version accepts a context for cancellation support.
func (c *Client) ChatCompletionsStreamWithContext(
	ctx context.Context,
	req ChatCompletionRequest,
	callback func(StreamResponse, bool, string) error,
) error {
	// Force streaming to be enabled
	req.Stream = true

	// Set the model if not provided
	if req.Model == "" {
		req.Model = DefaultModel
	}

	// Add a system message if not present
	hasSystemMessage := false
	for _, message := range req.Messages {
		if message.Role == "system" {
			hasSystemMessage = true
			break
		}
	}

	if !hasSystemMessage {
		systemMessage := Message{
			Role:    "system",
			Content: "Give results in plain text",
		}
		req.Messages = append([]Message{systemMessage}, req.Messages...)
	}

	jsonData, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("error marshaling request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", BaseURL+"/chat/completions", bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("error creating request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)

	// Set optional headers if available
	if c.frontendURL != "" {
		httpReq.Header.Set("HTTP-Referer", c.frontendURL)
	}
	if c.frontendTitle != "" {
		httpReq.Header.Set("X-Title", c.frontendTitle)
	}

	// Log that we're about to make a request that can be cancelled via the context
	fmt.Println("Sending cancellable streaming request to OpenRouter API")

	// Use a client without any timeout as we're using context for cancellation
	client := &http.Client{
		// Remove timeout - we're controlling this with context
		// Timeout: 60 * time.Second,
		// Add a transport that will close idle connections
		Transport: &http.Transport{
			DisableKeepAlives: true,
		},
	}

	resp, err := client.Do(httpReq)
	if err != nil {
		if ctx.Err() != nil {
			fmt.Println("Request was cancelled via context before completion")
			return ctx.Err()
		}
		return fmt.Errorf("error sending request: %w", err)
	}

	// Make sure we close the response body when we're done
	defer func() {
		fmt.Println("Closing OpenRouter response connection")
		resp.Body.Close()
	}()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("error from OpenRouter API: status %d, body: %s", resp.StatusCode, string(body))
	}

	fmt.Println("Starting to read OpenRouter stream response")

	chunkCount := 0
	reader := bufio.NewReader(resp.Body)

	// Create a separate goroutine to watch for context cancellation
	// and close the response body when that happens
	responseClosed := make(chan struct{})
	defer close(responseClosed)

	go func() {
		select {
		case <-ctx.Done():
			fmt.Println("Context cancelled, aborting OpenRouter request")
			resp.Body.Close() // This will cause the read loop to exit with an error
		case <-responseClosed:
			// Normal exit
		}
	}()

	for {
		// Check for context cancellation before each read
		if ctx.Err() != nil {
			fmt.Printf("Context cancelled (detected before read): %v\n", ctx.Err())
			return ctx.Err()
		}

		// Set a read deadline to make sure we can exit if the context is cancelled
		// while we're blocked on ReadBytes
		deadline, ok := ctx.Deadline()
		if !ok {
			// If context doesn't have a deadline, use a reasonable default
			deadline = time.Now().Add(1 * time.Second)
		} else {
			// Add a small buffer to the context deadline
			if time.Until(deadline) > 2*time.Second {
				deadline = time.Now().Add(2 * time.Second)
			}
		}

		// Set a deadline for the read operation if possible
		if conn, ok := resp.Body.(interface{ SetReadDeadline(time.Time) error }); ok {
			conn.SetReadDeadline(deadline)
		}

		line, err := reader.ReadBytes('\n')

		// Check for context cancellation after each read
		if ctx.Err() != nil {
			fmt.Printf("Context cancelled (detected after read): %v\n", ctx.Err())
			return ctx.Err()
		}

		if err != nil {
			if err == io.EOF {
				fmt.Println("EOF reached in OpenRouter stream")
				break
			}

			// Check if this was due to context cancellation or deadline
			if ctx.Err() != nil {
				fmt.Printf("Stream read cancelled: %v\n", ctx.Err())
				return ctx.Err()
			}

			if netErr, ok := err.(interface{ Timeout() bool }); ok && netErr.Timeout() {
				// This was a timeout, but not a context cancellation - just retry
				fmt.Println("Read timeout, retrying...")
				continue
			}

			return fmt.Errorf("error reading response: %w", err)
		}

		// Process the line
		line = bytes.TrimSpace(line)
		if len(line) == 0 {
			continue
		}

		// Check if this is a comment line (e.g., ": OPENROUTER PROCESSING")
		if bytes.HasPrefix(line, []byte(":")) {
			commentText := string(bytes.TrimSpace(line[1:])) // Remove the ":" prefix

			// Forward comment to the callback with isComment=true
			if err := callback(StreamResponse{}, true, commentText); err != nil {
				return fmt.Errorf("callback error: %w", err)
			}
			continue
		}

		// Lines should start with "data: "
		if !bytes.HasPrefix(line, []byte("data: ")) {
			continue
		}

		// Remove the "data: " prefix
		data := line[6:]

		// Check for the [DONE] message
		if string(data) == "[DONE]" {
			if err := callback(StreamResponse{}, false, "[DONE]"); err != nil {
				fmt.Printf("Callback error ([DONE]): %v\n", err)
				return fmt.Errorf("callback error: %w", err)
			}
			break
		}

		// Parse the JSON data
		var chunk StreamResponse
		if err := json.Unmarshal(data, &chunk); err != nil {
			return fmt.Errorf("error unmarshaling chunk: %w", err)
		}

		chunkCount++

		// Call the callback function with the chunk - regular data chunk
		if err := callback(chunk, false, ""); err != nil {
			return fmt.Errorf("callback error: %w", err)
		}
	}

	fmt.Printf("Finished processing OpenRouter stream with %d chunks total\n", chunkCount)
	return nil
}

// ChatCompletionsStream sends a streaming chat completion request to the OpenRouter API
// and calls the callback function for each chunk received, including comment lines.
// This is a backward compatibility wrapper for the context-aware version.
func (c *Client) ChatCompletionsStream(req ChatCompletionRequest, callback func(StreamResponse, bool, string) error) error {
	return c.ChatCompletionsStreamWithContext(context.Background(), req, callback)
}
