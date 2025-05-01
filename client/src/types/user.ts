/**
 * User data types used throughout the application
 */

export interface Subscription {
  status: string | null;
  productId: string | null;
}

export interface UserData {
  subscription: Subscription;
  timestamp?: number;
} 