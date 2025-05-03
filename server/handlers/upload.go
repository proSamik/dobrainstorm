package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"

	"saas-server/database"
	"saas-server/pkg/storage"
)

// Define maximum file size (1MB)
const maxUploadSize = 1 * 1024 * 1024

// UploadHandler manages image uploads to Cloudflare R2
type UploadHandler struct {
	DB *database.DB
}

// NewUploadHandler creates a new upload handler
func NewUploadHandler(db *database.DB) *UploadHandler {
	return &UploadHandler{
		DB: db,
	}
}

// UploadResponseBody represents the response sent back after an upload
type UploadResponseBody struct {
	URL      string `json:"url"`
	Filename string `json:"filename"`
	Size     int64  `json:"size"`
}

// UploadImage handles image uploads to R2 storage
func (h *UploadHandler) UploadImage(w http.ResponseWriter, r *http.Request) {
	// Ensure request method is POST
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse multipart form with size limit
	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		http.Error(w, "File too large (max 1MB) or invalid form", http.StatusBadRequest)
		return
	}

	// Get the file
	file, header, err := r.FormFile("image")
	if err != nil {
		http.Error(w, "Failed to get file from request", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Validate file size
	if header.Size > maxUploadSize {
		http.Error(w, "File size exceeds 1MB limit", http.StatusBadRequest)
		return
	}

	// Validate file type (only accept images)
	contentType := header.Header.Get("Content-Type")
	if contentType != "image/jpeg" && contentType != "image/png" && contentType != "image/gif" && contentType != "image/webp" {
		http.Error(w, "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed", http.StatusBadRequest)
		return
	}

	// Initialize R2 client
	r2Client, err := storage.NewR2Client(
		os.Getenv("CLOUDFLARE_ACCOUNT_ID"),
		os.Getenv("CLOUDFLARE_ACCESS_KEY_ID"),
		os.Getenv("CLOUDFLARE_SECRET_ACCESS_KEY"),
		os.Getenv("CLOUDFLARE_BUCKET_NAME"),
	)
	if err != nil {
		http.Error(w, "Failed to initialize storage client", http.StatusInternalServerError)
		return
	}

	// Upload the file
	objectKey, err := r2Client.UploadFile(r.Context(), file, header)
	if err != nil {
		http.Error(w, "Failed to upload file", http.StatusInternalServerError)
		return
	}

	// Get the public URL prefix from environment
	publicURLPrefix := os.Getenv("CLOUDFLARE_PUBLIC_URL")
	if publicURLPrefix == "" {
		// Fallback to development URL if production URL is not set
		publicURLPrefix = os.Getenv("CLOUDFLARE_PUBLIC_DEVELOPMENT_URL")
	}

	// Ensure the URL doesn't have a trailing slash
	if publicURLPrefix != "" && publicURLPrefix[len(publicURLPrefix)-1] == '/' {
		publicURLPrefix = publicURLPrefix[:len(publicURLPrefix)-1]
	}

	// Construct the final public URL
	fileURL := fmt.Sprintf("%s/%s", publicURLPrefix, objectKey)

	// Return the URL of the uploaded file
	response := UploadResponseBody{
		URL:      fileURL,
		Filename: header.Filename,
		Size:     header.Size,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}
