// Package openrouter provides a client for the OpenRouter API.
package openrouter

import (
	"bufio"
	"bytes"
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
}

// NewClient creates a new OpenRouter client
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
	}, nil
}

// Message represents a chat message
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatCompletionRequest represents a request to the chat completions endpoint
type ChatCompletionRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	Stream      bool      `json:"stream"`
	MaxTokens   int       `json:"max_tokens,omitempty"`
	Temperature float64   `json:"temperature,omitempty"`
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
	Role    string `json:"role"`
	Content string `json:"content"`
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
	Role    string `json:"role,omitempty"`
	Content string `json:"content,omitempty"`
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

// ChatCompletionsStream sends a streaming chat completion request to the OpenRouter API
// and calls the callback function for each chunk received
func (c *Client) ChatCompletionsStream(req ChatCompletionRequest, callback func(StreamResponse) error) error {
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

	httpReq, err := http.NewRequest("POST", BaseURL+"/chat/completions", bytes.NewBuffer(jsonData))
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

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("error sending request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("error from OpenRouter API: status %d, body: %s", resp.StatusCode, string(body))
	}

	reader := bufio.NewReader(resp.Body)
	for {
		line, err := reader.ReadBytes('\n')
		if err != nil {
			if err == io.EOF {
				break
			}
			return fmt.Errorf("error reading response: %w", err)
		}

		// Skip empty lines and comments
		line = bytes.TrimSpace(line)
		if len(line) == 0 || bytes.HasPrefix(line, []byte(":")) {
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
			break
		}

		// Parse the JSON data
		var chunk StreamResponse
		if err := json.Unmarshal(data, &chunk); err != nil {
			return fmt.Errorf("error unmarshaling chunk: %w", err)
		}

		// Call the callback function with the chunk
		if err := callback(chunk); err != nil {
			return fmt.Errorf("callback error: %w", err)
		}
	}

	return nil
}
