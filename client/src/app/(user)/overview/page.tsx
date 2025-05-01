'use client'

import { useUserData } from '@/contexts/UserDataContext'
import { useState, useEffect } from 'react'
import { hasActiveSubscription } from '@/lib/pricing'
import { ActiveSubscriptionView } from '@/components/user/overview/ActiveSubscriptionView'
import { PricingView } from '@/components/user/overview/PricingView'
import { LoadingView } from '@/components/user/overview/LoadingView'
import { ErrorView } from '@/components/user/overview/ErrorView'
import { UserData as ComponentUserData } from '@/types/user'

/**
 * Main UserOverview component that conditionally renders the appropriate view
 * based on the user's subscription status
 */
export default function UserOverview() {
  const { userData, loading, error, forceRefreshUserData } = useUserData()
  const [mounted, setMounted] = useState(false)
  const [initialRefreshDone, setInitialRefreshDone] = useState(false)

  // Used to prevent hydration mismatch and force a refresh of subscription data
  useEffect(() => {
    setMounted(true)
    
    // Force refresh user data when component mounts to ensure fresh subscription data
    if (!initialRefreshDone) {
      forceRefreshUserData().then(() => {
        setInitialRefreshDone(true)
      })
    }
  }, [forceRefreshUserData, initialRefreshDone])

  // Convert userData from UserDataContext to format expected by components
  const convertUserData = (contextData: typeof userData): ComponentUserData | null => {
    if (!contextData) return null;
    
    return {
      subscription: {
        status: contextData.subscription.status,
        productId: contextData.subscription.productId,
        variantId: contextData.subscription.productId // Use productId as variantId for backward compatibility
      },
      timestamp: contextData.timestamp
    };
  };
  
  // Create component-compatible user data
  const componentUserData = convertUserData(userData);

  if (!mounted || loading) {
    return <LoadingView />
  }

  if (error) {
    return <ErrorView errorMessage={error} resetUserData={forceRefreshUserData} />
  }
  
  // Check for the 'none' status that represents no subscription
  if (userData?.subscription?.status === 'none') {
    return <PricingView userData={componentUserData} />
  }
  
  // Check direct status first - if status is 'active', show the subscription view
  // This ensures even if hasActiveSubscription has issues, we fallback to the direct status check
  if (userData?.subscription?.status?.toLowerCase() === 'active') {
    if (componentUserData) {
      return <ActiveSubscriptionView userData={componentUserData} />
    }
  }
  
  // Create a safe version of userData for hasActiveSubscription function
  const subscriptionData = {
    subscription: userData ? {
      status: userData.subscription.status === null ? undefined : userData.subscription.status,
      productId: userData.subscription.productId === null ? undefined : String(userData.subscription.productId)
    } : undefined
  };
  
  const isSubscribed = hasActiveSubscription(subscriptionData);
  
  // When the user doesn't have an active subscription, show pricing
  if (!isSubscribed) {
    return <PricingView userData={componentUserData} />
  }

  // Make sure userData is not null before passing to ActiveSubscriptionView
  if (componentUserData) {
    return <ActiveSubscriptionView userData={componentUserData} />
  }
  
  // Fallback if userData is null but somehow we got here
  return <PricingView userData={null} />
} 