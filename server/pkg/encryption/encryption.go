// Package encryption provides utilities for encrypting and decrypting sensitive data.
package encryption

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"io"
)

var (
	// encryption key
	encKey []byte
)

// SetEncryptionKey sets the encryption key for the package
// This must be called before any encryption/decryption operations
func SetEncryptionKey(key []byte) {
	encKey = key
}

// Encrypt encrypts plaintext string to ciphertext string
func Encrypt(plaintext string) (string, error) {
	if len(encKey) == 0 {
		return "", errors.New("encryption key not initialized")
	}

	block, err := aes.NewCipher(encKey)
	if err != nil {
		return "", err
	}

	// The IV needs to be unique, but not secure
	ciphertext := make([]byte, aes.BlockSize+len(plaintext))
	iv := ciphertext[:aes.BlockSize]
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return "", err
	}

	stream := cipher.NewCFBEncrypter(block, iv)
	stream.XORKeyStream(ciphertext[aes.BlockSize:], []byte(plaintext))

	// Return as base64 encoded string
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// Decrypt decrypts ciphertext string to plaintext string
func Decrypt(encryptedText string) (string, error) {
	if len(encKey) == 0 {
		return "", errors.New("encryption key not initialized")
	}

	ciphertext, err := base64.StdEncoding.DecodeString(encryptedText)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(encKey)
	if err != nil {
		return "", err
	}

	// The IV needs to be unique, but not secure. It's included in the ciphertext.
	if len(ciphertext) < aes.BlockSize {
		return "", errors.New("ciphertext too short")
	}
	iv := ciphertext[:aes.BlockSize]
	ciphertext = ciphertext[aes.BlockSize:]

	stream := cipher.NewCFBDecrypter(block, iv)
	stream.XORKeyStream(ciphertext, ciphertext)

	return string(ciphertext), nil
}
