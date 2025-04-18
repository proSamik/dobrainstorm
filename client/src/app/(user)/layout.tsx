'use client'

import { UserAuthProvider } from '@/middleware/userAuth'
import { UserDataProvider, useUserData } from '@/contexts/UserDataContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { hasActiveSubscription, PRICING_PLANS } from '@/lib/pricing'
import { PriceCard } from '@/components/landing/PriceCard'

/**
 * BlurredContentView component that shows a blurred version of the content
 * with embedded pricing cards for immediate subscription
 */
function BlurredContentView({ children, userData }: { 
  children: React.ReactNode; 
  userData: any; 
}) {
  return (
    <div className="flex flex-col min-h-screen bg-light-background dark:bg-dark-background mt-10">
      <div className="relative flex-1">
        {/* Actual content in the background - blurred */}
        <div className="opacity-30 pointer-events-none blur-sm">
          {children}
        </div>
        
        {/* Overlay with subscription plans */}
        <div className="absolute inset-0 bg-light-background/70 dark:bg-dark-background/80 backdrop-blur-md flex flex-col items-center justify-start z-10 overflow-y-auto py-6 md:py-10 px-4">
          <div className="max-w-5xl w-full p-4 md:p-8 bg-light-background dark:bg-dark-background rounded-xl shadow-xl">
            <div className="text-center mb-6 md:mb-8">
              <h2 className="text-xl md:text-2xl font-bold mb-2 md:mb-4 text-light-foreground dark:text-dark-foreground">
                Premium Feature
              </h2>
              <p className="text-sm md:text-base text-light-muted dark:text-dark-muted max-w-lg mx-auto">
                This content requires an active subscription. Choose a plan below to unlock all premium features.
              </p>
            </div>
            
            {/* Pricing Grid - responsive layout */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              {PRICING_PLANS.map((plan) => (
                <div key={plan.variantId} className={`${plan.popular ? 'order-first md:order-none scale-105 md:transform' : ''}`}>
                  <PriceCard
                    name={plan.name}
                    description={plan.description}
                    price={plan.price}
                    features={plan.features}
                    popular={plan.popular}
                    productId={plan.productId}
                    variantId={plan.variantId}
                  />
                </div>
              ))}
            </div>
            
            {/* Debug info - can be removed in production */}
            {process.env.NODE_ENV !== 'production' && (
              <div className="mt-6 md:mt-8 text-xs text-left bg-light-accent/20 dark:bg-dark-accent/20 p-3 rounded mx-auto max-w-lg">
                <p className="font-semibold mb-1">Debug Information:</p>
                <p>Subscription Status: {userData?.subscription?.status || 'None'}</p>
                <p>Variant ID: {userData?.subscription?.variantId || 'None'}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Content component for the user layout that handles authentication logic,
 * subscription checks, and data loading states
 */
function UserLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter()
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
      }).catch(error => {
        console.error('Error refreshing user data:', error)
        setInitialRefreshDone(true)
      })
    }
  }, [forceRefreshUserData, initialRefreshDone])

  // Redirect unauthenticated users
  useEffect(() => {
    if (!loading && !userData) {
      router.replace('/profile')
    }
  }, [userData, loading, router])

  if (!mounted || loading) {
    return (
      <div className="flex min-h-screen bg-light-background dark:bg-dark-background mt-10">
        <main className="flex-1 p-8">
          <div className="flex items-center justify-center h-full">
            <div className="animate-pulse">Loading...</div>
          </div>
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen bg-light-background dark:bg-dark-background mt-10">
        <main className="flex-1 p-8">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-red-500 mb-2">Error Loading Data</h2>
            <p className="text-light-muted dark:text-dark-muted mb-4">{error}</p>
            <button 
              onClick={() => forceRefreshUserData()}
              className="px-4 py-2 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors"
            >
              Try Again
            </button>
          </div>
        </main>
      </div>
    )
  }

  if (!userData) {
    return null
  }

  // Check if the user has an active subscription
  const subscriptionData = {
    subscription: userData ? {
      status: userData.subscription?.status === null ? undefined : userData.subscription?.status,
      variantId: userData.subscription?.variantId === null ? undefined : userData.subscription?.variantId
    } : undefined
  };
  
  const isSubscribed = hasActiveSubscription(subscriptionData);

  // If the user doesn't have an active subscription, show the blurred content view
  if (!isSubscribed) {
    return <BlurredContentView userData={userData}>
      {children}
    </BlurredContentView>
  }

  // User is authenticated and has an active subscription, show the actual content
  return (
    <div className="flex min-h-screen bg-light-background dark:bg-dark-background mt-10">
      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  )
}

/**
 * User layout wrapper that provides authentication and user data context
 * Note: This is a client component due to authentication requirements,
 * so SEO metadata must be defined in individual page components.
 */
export default function UserLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <UserDataProvider>
      <UserAuthProvider>
        <UserLayoutContent>
          {children}
        </UserLayoutContent>
      </UserAuthProvider>
    </UserDataProvider>
  )
} 