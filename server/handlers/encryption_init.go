package handlers

import (
	"log"
	"os"
	"saas-server/pkg/encryption"
)

// InitEncryption initializes the encryption system with the appropriate key
// This should be called during server startup before any handlers are used
func InitEncryption() {
	// Use a secure key from environment
	key := os.Getenv("ENCRYPTION_KEY")
	if key == "" {
		// Fallback to JWT_SECRET if ENCRYPTION_KEY is not set
		key = os.Getenv("JWT_SECRET")
		if key == "" {
			log.Fatalf("No encryption key found. Set ENCRYPTION_KEY or JWT_SECRET environment variable.")
		}
	}

	// Log that we found a key (without revealing the key itself)
	keySource := "JWT_SECRET"
	if os.Getenv("ENCRYPTION_KEY") != "" {
		keySource = "ENCRYPTION_KEY"
	}
	log.Printf("[SettingsHandler] Encryption key found from %s", keySource)

	// Ensure key is exactly 32 bytes for AES-256
	encKey := make([]byte, 32)

	// If key is shorter than 32 bytes, it will be padded with zeros
	// If key is longer than 32 bytes, it will be truncated
	copy(encKey, []byte(key))

	// Initialize the encryption package with our key
	encryption.SetEncryptionKey(encKey)
}
