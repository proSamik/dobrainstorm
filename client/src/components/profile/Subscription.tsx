'use client'

import { useState, useEffect, Suspense } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useUserData } from '@/contexts/UserDataContext'
import { authService } from '@/services/auth'
import { useRouter } from 'next/navigation'
import { PRICING_PLANS, getPlanName, getStatusColor } from '@/lib/pricing'
import toast from 'react-hot-toast'

interface BillingPortalResponse {
  portal_url: string
}

const ManageSubscriptionButton = ({ customerId }: { customerId: number }) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleManageClick = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await authService.get<BillingPortalResponse>(`/creem/customerportal`)
      if (response?.portal_url) {
        window.location.href = response.portal_url
      } else {
        setError('Failed to get billing portal URL')
      }
    } catch {
      console.error('[Subscription] Failed to fetch billing portal')
      setError('Failed to access billing portal. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={handleManageClick}
        disabled={loading}
      >
        {loading ? 'Loading...' : 'Manage Subscription'}
    </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}

const SubscriptionCard = ({ 
  plan, 
  isCurrentPlan, 
  onUpgrade, 
  isLoading 
}: { 
  plan: typeof PRICING_PLANS[0], 
  isCurrentPlan: boolean, 
  onUpgrade: () => void, 
  isLoading: boolean 
}) => {
  return (
    <div className={`flex flex-col justify-between rounded-lg ${isCurrentPlan ? 'bg-primary-50 dark:bg-primary-900/10 ring-primary-500' : 'bg-light-card dark:bg-dark-card ring-light-accent dark:ring-dark-accent'} p-6 ring-1 shadow-sm`}>
      <div>
        <div className="flex items-center justify-between gap-x-4">
          <h3 className="text-lg font-semibold leading-8 text-light-foreground dark:text-dark-foreground">{plan.name}</h3>
          {plan.popular && (
            <p className="rounded-full bg-primary-600/10 px-2.5 py-1 text-xs font-semibold leading-5 text-primary-600">
              Most popular
            </p>
          )}
          {isCurrentPlan && (
            <p className="rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-1 text-xs font-semibold leading-5 text-green-700 dark:text-green-400">
              Current plan
            </p>
          )}
        </div>
        <p className="mt-2 text-sm leading-6 text-light-muted dark:text-dark-muted">{plan.description}</p>
        <p className="mt-4 flex items-baseline gap-x-1">
          <span className="text-3xl font-bold text-light-foreground dark:text-dark-foreground">${plan.price}</span>
          <span className="text-sm font-semibold leading-6 text-light-muted dark:text-dark-muted">/month</span>
        </p>
        <ul role="list" className="mt-4 space-y-2 text-sm leading-6">
          {plan.features.map((feature, index) => (
            <li key={index} className="flex gap-x-3 text-light-muted dark:text-dark-muted">
              {feature.included ? (
                <svg className="h-5 w-4 flex-none text-primary-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-5 w-4 flex-none text-light-muted dark:text-dark-muted" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              )}
              {feature.text}
            </li>
          ))}
        </ul>
      </div>
      
      <button
        onClick={onUpgrade}
        disabled={isLoading || isCurrentPlan}
        className={`mt-6 block w-full rounded-md px-3 py-2 text-center text-sm font-semibold leading-6 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:opacity-50
          ${isCurrentPlan 
            ? 'bg-green-600 text-white cursor-default' 
            : 'bg-primary-600 text-white hover:bg-primary-700'}`}
      >
        {isLoading ? 'Processing...' : isCurrentPlan ? 'Current Plan' : 'Change Plan'}
      </button>
    </div>
  )
}

const hasActiveSubscription = (data: any): boolean => {
  const status = data?.subscription?.status;
  
  // Active and trialing statuses are both considered active subscriptions
  if (status === 'active' || status === 'trialing') {
    const productId = data?.subscription?.productId;
    return productId !== undefined && productId !== null;
  }
  
  return false;
}

export default function Subscription() {
  const { auth } = useAuth()
  const { userData, loading: userDataLoading } = useUserData()
  const router = useRouter()
  const [detailsLoading, setDetailsLoading] = useState(true)
  const [subscriptionDetails, setSubscriptionDetails] = useState<any>(null)
  const [error, setError] = useState('')
  const [isUpgrading, setIsUpgrading] = useState(false)
  
  useEffect(() => {
    // If not authenticated, redirect to auth page
    if (!auth) {
      router.push('/auth')
      return
    }
    
    // Fetch additional subscription details if we have an active subscription
    if (userData && hasActiveSubscription(userData)) {
      fetchSubscriptionDetails()
    } else {
      setDetailsLoading(false)
    }
  }, [auth, userData, router])
  
  const fetchSubscriptionDetails = async () => {
    try {
      setDetailsLoading(true)
      const response = await authService.get('/creem/customerportal')
      setSubscriptionDetails(response && response.length > 0 ? response[0] : null)
    } catch (err) {
      console.error('[Subscription] Failed to fetch subscription details:', err)
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to fetch subscription details. Please try again later.')
      }
    } finally {
      setDetailsLoading(false)
    }
  }
  
  const handleUpgrade = async (productId: string) => {
    // Don't do anything if this is the current plan
    if (userData?.subscription?.productId?.toString() === productId) {
      return
    }
    
    setIsUpgrading(true)
    try {
      // Get the customer portal link instead of creating a checkout
      console.log('Getting customer portal for upgrade process')
      const response = await authService.get('/creem/customerportal')
      
      if (response && response.customer_portal_link) {
        // Redirect to the customer portal link
        window.location.href = response.customer_portal_link
      } else {
        console.error('No customer portal link in response:', response)
        toast.error('No valid portal URL received. Please try again.')
      }
    } catch (error: unknown) {
      console.error('Customer portal error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to access customer portal. Please try again.')
    } finally {
      setIsUpgrading(false)
    }
  }

  // Show nothing during redirect
  if (!auth) {
    return null
  }

  if (userDataLoading || detailsLoading) {
    return (
      <div className="space-y-6 p-4">
        <h3 className="text-2xl font-semibold text-light-foreground dark:text-dark-foreground">
          Subscription
        </h3>
        <div className="rounded-lg bg-light-card dark:bg-dark-card p-6 shadow-sm">
          <p className="text-light-muted dark:text-dark-muted">Loading subscription details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6 p-4">
        <h3 className="text-2xl font-semibold text-light-foreground dark:text-dark-foreground">
          Subscription
        </h3>
        <div className="rounded-lg bg-light-card dark:bg-dark-card p-6 shadow-sm">
          <p className="text-red-500 dark:text-red-400">{error}</p>
        </div>
      </div>
    )
  }
  
  // Get current plan details
  const hasSubscription = hasActiveSubscription(userData || {})
  const currentProductId = userData?.subscription?.productId?.toString() || ''
  const subscriptionStatus = userData?.subscription?.status || 'none'
  
  return (
    <div className="space-y-8 p-4">
      <h3 className="text-2xl font-semibold text-light-foreground dark:text-dark-foreground">
        Subscription
      </h3>
      
      {/* Status summary */}
      {hasSubscription && (
        <div className="rounded-lg bg-light-card dark:bg-dark-card p-6 shadow-sm">
          <h4 className="text-lg font-medium text-light-foreground dark:text-dark-foreground mb-4">
            Subscription Status
          </h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-light-muted dark:text-dark-muted">
                Plan
              </label>
              <div className="mt-1">
                <p className="text-light-foreground dark:text-dark-foreground">
                  {getPlanName(currentProductId)}
                </p>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-light-muted dark:text-dark-muted">
                Status
              </label>
              <div className="mt-1">
                <p className={`capitalize ${getStatusColor(subscriptionStatus)}`}>
                  {subscriptionStatus}
                </p>
              </div>
            </div>
            
            {subscriptionDetails && (
              <>
                <div>
                  <label className="block text-sm font-medium text-light-muted dark:text-dark-muted">
                    Subscription ID
                  </label>
                  <div className="mt-1">
                    <p className="text-light-foreground dark:text-dark-foreground">
                      {subscriptionDetails.subscription_id}
                    </p>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-light-muted dark:text-dark-muted">
                    Renewal Date
                  </label>
                  <div className="mt-1">
                    <p className="text-light-foreground dark:text-dark-foreground">
                      {new Date(subscriptionDetails.renews_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                <div className="pt-4">
                  <Suspense fallback={<div>Loading...</div>}>
                    {subscriptionDetails.customer_id && (
                      <ManageSubscriptionButton customerId={subscriptionDetails.customer_id} />
                    )}
                  </Suspense>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Plans Grid */}
      <div>
        <h4 className="text-lg font-medium text-light-foreground dark:text-dark-foreground mb-4">
          {hasSubscription ? 'Change Plan' : 'Available Plans'}
        </h4>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PRICING_PLANS.map((plan) => (
            <SubscriptionCard
              key={plan.productId}
              plan={plan}
              isCurrentPlan={plan.productId === currentProductId}
              onUpgrade={() => handleUpgrade(plan.productId)}
              isLoading={isUpgrading}
            />
          ))}
        </div>
      </div>
    </div>
  )
}