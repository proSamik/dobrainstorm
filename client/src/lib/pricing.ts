/**
 * This file contains pricing-related constants and types used throughout the application
 * Following the DRY principle by centralizing pricing data
 */

// Define variant IDs from environment variables
export const VARIANT_IDS = {
  BASIC: process.env.NEXT_PUBLIC_LEMON_SQUEEZY_VARIANT_ID_1 || '',
  PLUS: process.env.NEXT_PUBLIC_LEMON_SQUEEZY_VARIANT_ID_2 || '',
  PRO: process.env.NEXT_PUBLIC_LEMON_SQUEEZY_VARIANT_ID_3 || '',
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
  variantId: string
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
    productId: process.env.NEXT_PUBLIC_LEMON_SQUEEZY_PRODUCT_ID || '',
    variantId: VARIANT_IDS.BASIC,
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
    productId: process.env.NEXT_PUBLIC_LEMON_SQUEEZY_PRODUCT_ID || '',
    variantId: VARIANT_IDS.PLUS,
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
    productId: process.env.NEXT_PUBLIC_LEMON_SQUEEZY_PRODUCT_ID || '',
    variantId: VARIANT_IDS.PRO,
  },
]

/**
 * Gets the plan name based on the variant ID
 * @param variantId The variant ID to look up
 * @returns The plan name as a string
 */
export const getPlanName = (variantId: string | number | null): string => {
  if (!variantId) return 'No Plan'
  
  const variantStr = variantId.toString()
  switch (variantStr) {
    case VARIANT_IDS.BASIC:
      return 'Basic Plan'
    case VARIANT_IDS.PLUS:
      return 'Plus Plan'
    case VARIANT_IDS.PRO:
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
    case 'cancelled':
      return 'text-yellow-500'
    case 'expired':
      return 'text-red-500'
    default:
      return 'text-gray-500'
  }
}

/**
 * Checks if the user has an active subscription
 * @param userData The user data object
 * @returns Boolean indicating if the user has an active subscription
 */
export const hasActiveSubscription = (userData: { subscription?: { status?: string; variantId?: string | number } }): boolean => {
  // Check for required properties with explicit null handling
  const status = userData?.subscription?.status;
  
  // Fast path - if status is explicitly 'active', return true as long as it has a variantId
  if (status?.toLowerCase() === 'active') {
    const variantId = userData?.subscription?.variantId;
    return variantId !== undefined && variantId !== null;
  }
  
  // Explicit check for 'none' status which means no subscription
  if (status === 'none' || !status) {
    return false;
  }
  
  // Other statuses that are not 'active' or 'none' should return false
  return false;
} 