package storage

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"path/filepath"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// R2Client handles operations with Cloudflare R2 storage
type R2Client struct {
	client     *s3.Client
	bucketName string
	publicURL  string
}

// NewR2Client creates a new Cloudflare R2 client
func NewR2Client(accountID, accessKeyID, secretAccessKey, bucketName string) (*R2Client, error) {
	// Configure the S3 client to use R2
	cfg, err := config.LoadDefaultConfig(context.TODO(),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(accessKeyID, secretAccessKey, "")),
		config.WithRegion("auto"),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	// Create S3 client with R2 configuration using BaseEndpoint
	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(fmt.Sprintf("https://%s.r2.cloudflarestorage.com", accountID))
	})

	return &R2Client{
		client:     client,
		bucketName: bucketName,
		publicURL:  fmt.Sprintf("https://%s.r2.dev", bucketName), // Adjust if using custom domain
	}, nil
}

// UploadFile uploads a file to R2 storage
func (r *R2Client) UploadFile(ctx context.Context, file multipart.File, header *multipart.FileHeader) (string, error) {
	// Read the file content
	buffer := make([]byte, header.Size)
	if _, err := file.Read(buffer); err != nil {
		return "", fmt.Errorf("failed to read file: %w", err)
	}

	// Reset the file reader to beginning
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return "", fmt.Errorf("failed to seek file: %w", err)
	}

	// Generate a unique filename to avoid collisions
	fileExt := filepath.Ext(header.Filename)
	objectKey := fmt.Sprintf("uploads/%d%s", time.Now().UnixNano(), fileExt)

	// Set content type based on file extension
	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	// Upload the file to R2
	_, err := r.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(r.bucketName),
		Key:         aws.String(objectKey),
		Body:        bytes.NewReader(buffer),
		ContentType: aws.String(contentType),
	})
	if err != nil {
		return "", fmt.Errorf("failed to upload file: %w", err)
	}

	// Return the public URL of the uploaded file
	return fmt.Sprintf("%s/%s", r.publicURL, objectKey), nil
}

// DeleteFile removes a file from R2 storage
func (r *R2Client) DeleteFile(ctx context.Context, objectKey string) error {
	_, err := r.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(r.bucketName),
		Key:    aws.String(objectKey),
	})
	if err != nil {
		return fmt.Errorf("failed to delete file: %w", err)
	}

	return nil
}
