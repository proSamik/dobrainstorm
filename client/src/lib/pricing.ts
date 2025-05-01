/**
 * This file contains pricing-related constants and types used throughout the application
 * Following the DRY principle by centralizing pricing data
 */

// Define product IDs from environment variables
export const PRODUCT_IDS = {
  BASIC: process.env.NEXT_PUBLIC_CREEM_PRODUCT_ID_1 || '',
  PLUS: process.env.NEXT_PUBLIC_CREEM_PRODUCT_ID_2 || '',
  PRO: process.env.NEXT_PUBLIC_CREEM_PRODUCT_ID_3 || '',
}

// Define the type for a pricing plan
export interface PricingPlan {
  name: string
  description: string
  price: number
  features: Array<{
    included: boolean
    text: string
  }>
  popular?: boolean
  productId: string
}

// Define pricing plans
export const PRICING_PLANS: PricingPlan[] = [
  {
    name: 'Basic',
    description: 'Perfect for getting started with mind mapping',
    price: 4.99,
    features: [
      { included: true, text: 'Unlimited Mind Maps' },
      { included: true, text: 'Basic Export Options' },
      { included: true, text: 'Bring your API Key' },
      { included: false, text: 'Additional AI Features' },
      { included: false, text: 'Priority Support' },
    ],
    productId: PRODUCT_IDS.BASIC,
  },
  {
    name: 'Plus',
    description: 'Enhanced features for power users',
    price: 9.99,
    features: [
      { included: true, text: 'Unlimited Mind Maps' },
      { included: true, text: 'Basic Export Options' },
      { included: true, text: 'Bring your API Key' },
      { included: true, text: '50 free AI Requests/month' },
      { included: false, text: 'Priority Support' },
    ],
    popular: true,
    productId: PRODUCT_IDS.PLUS,
  },
  {
    name: 'Pro',
    description: 'Maximum power for serious professionals',
    price: 19.99,
    features: [
      { included: true, text: 'Unlimited Mind Maps' },
      { included: true, text: 'Basic Export Options' },
      { included: true, text: 'Bring your API Key' },
      { included: true, text: '500 free AI Requests/month' },
      { included: true, text: 'Priority Support' },
    ],
    productId: PRODUCT_IDS.PRO,
  },
]

/**
 * Gets the plan name based on the product ID
 * @param productId The product ID to look up
 * @returns The plan name as a string
 */
export const getPlanName = (productId: string | null): string => {
  if (!productId) return 'No Plan'
  
  switch (productId) {
    case PRODUCT_IDS.BASIC:
      return 'Basic Plan'
    case PRODUCT_IDS.PLUS:
      return 'Plus Plan'
    case PRODUCT_IDS.PRO:
      return 'Pro Plan'
    default:
      return 'Unknown Plan'
  }
}

/**
 * Gets the CSS class for the status color
 * @param status The subscription status
 * @returns The CSS class for the text color
 */
export const getStatusColor = (status: string | null | undefined): string => {
  if (!status) return 'text-gray-500'
  
  switch (status.toLowerCase()) {
    case 'active':
      return 'text-green-500'
    case 'canceled': // Creem uses "canceled" instead of "cancelled"
      return 'text-yellow-500'
    case 'expired':
      return 'text-red-500'
    case 'trialing':
      return 'text-blue-500'
    default:
      return 'text-gray-500'
  }
}

/**
 * Checks if the user has an active subscription
 * @param userData The user data object
 * @returns Boolean indicating if the user has an active subscription
 */
export const hasActiveSubscription = (userData: { subscription?: { status?: string; productId?: string } }): boolean => {
  // Check for required properties with explicit null handling
  const status = userData?.subscription?.status;
  
  // Active and trialing statuses are both considered active subscriptions
  if (status?.toLowerCase() === 'active' || status?.toLowerCase() === 'trialing') {
    const productId = userData?.subscription?.productId;
    return productId !== undefined && productId !== null;
  }
  
  // Explicit check for 'none' status which means no subscription
  if (status === 'none' || !status) {
    return false;
  }
  
  // Other statuses that are not 'active', 'trialing' or 'none' should return false
  return false;
} 