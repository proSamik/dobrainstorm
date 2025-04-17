package middleware

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"saas-server/database"
)

// SubscriptionMiddleware checks if users have an active subscription
type SubscriptionMiddleware struct {
	DB *database.DB
}

// NewSubscriptionMiddleware creates a new SubscriptionMiddleware
func NewSubscriptionMiddleware(db *database.DB) *SubscriptionMiddleware {
	return &SubscriptionMiddleware{DB: db}
}

// HasActiveSubscription middleware checks if the user has an active subscription
// and returns 402 Payment Required if not
func (sm *SubscriptionMiddleware) HasActiveSubscription(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("[Subscription Middleware] Checking subscription for request path: %s", r.URL.Path)

		// Log all context keys for debugging
		log.Printf("[Subscription Middleware] Context Values:")
		log.Printf("[Subscription Middleware] Context userID (exported typed key): %v", r.Context().Value(ExportedUserIDKey))
		log.Printf("[Subscription Middleware] Context userID (typed key): %v", r.Context().Value(UserIDKey))
		log.Printf("[Subscription Middleware] Context userID (string key): %v", r.Context().Value(UserIDContextKey))
		log.Printf("[Subscription Middleware] Context userID (direct string): %v", r.Context().Value("userID"))

		// Get user ID using our helper function
		userID := GetUserID(r.Context())
		log.Printf("[Subscription Middleware] Retrieved userID: %q", userID)

		if userID == "" {
			log.Printf("[Subscription Middleware] Error: user_id not found in context")
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// Check if we're in development mode
		isDevelopment := os.Getenv("ENV") != "production"

		// Check if user has an active subscription
		hasSubscription, err := sm.DB.CheckActiveSubscription(userID)
		if err != nil {
			log.Printf("[Subscription Middleware] Error checking subscription: %v", err)

			// In development mode, allow the request to proceed despite errors
			if isDevelopment {
				log.Printf("[Subscription Middleware] DEVELOPMENT MODE: Bypassing subscription check due to error")
				next.ServeHTTP(w, r)
				return
			}

			// In production, block with a server error
			http.Error(w, "Error checking subscription status", http.StatusInternalServerError)
			return
		}

		// If no active subscription, return 402 Payment Required
		if !hasSubscription {
			// In development mode, we can optionally allow users without subscriptions
			if isDevelopment && os.Getenv("BYPASS_SUBSCRIPTION") == "true" {
				log.Printf("[Subscription Middleware] DEVELOPMENT MODE: Bypassing subscription requirement")
				next.ServeHTTP(w, r)
				return
			}

			log.Printf("[Subscription Middleware] No active subscription for user: %s", userID)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusPaymentRequired)
			json.NewEncoder(w).Encode(map[string]string{
				"error":   "subscription_required",
				"message": "This feature requires an active subscription",
			})
			return
		}

		// User has subscription, proceed to next handler
		log.Printf("[Subscription Middleware] User %s has active subscription, proceeding", userID)
		next.ServeHTTP(w, r)
	})
}
