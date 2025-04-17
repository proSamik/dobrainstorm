'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useUserData } from '@/contexts/UserDataContext'
import { hasActiveSubscription } from '@/lib/pricing'
import { ReduxProvider } from '@/providers/ReduxProvider'
import BoardCanvas from '@/components/dashboard/BoardCanvas'

/**
 * Specific board page component that displays and manages a single brainstorming board.
 * Requires subscription and wraps the board canvas with the Redux provider.
 */
export default function BoardPage() {
  const params = useParams()
  const router = useRouter()
  const { userData, loading } = useUserData()
  const [mounted, setMounted] = useState(false)
  const [boardLoading, setBoardLoading] = useState(true)
  const [boardError, setBoardError] = useState<string | null>(null)

  // Used to prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Check subscription status and redirect if not subscribed
  useEffect(() => {
    if (!mounted || loading) return

    if (userData) {
      const subscriptionData = {
        subscription: {
          status: userData.subscription.status === null ? undefined : userData.subscription.status,
          variantId: userData.subscription.variantId === null ? undefined : userData.subscription.variantId
        }
      }
      
      const isSubscribed = hasActiveSubscription(subscriptionData)
      const isActive = userData.subscription.status?.toLowerCase() === 'active'
      
      if (!isSubscribed && !isActive) {
        router.replace('/overview')
      }
    }
  }, [userData, loading, router, mounted])

  // Load board data
  useEffect(() => {
    if (!mounted || loading) return
    
    const boardId = params.boardId as string
    
    // Fetch board data from API
    const fetchBoardData = async () => {
      setBoardLoading(true)
      setBoardError(null)
      
      try {
        // TODO: Replace with actual API call
        // For now we just simulate loading
        await new Promise(resolve => setTimeout(resolve, 1000))
        setBoardLoading(false)
      } catch (error) {
        console.error('Error loading board:', error)
        setBoardError('Failed to load board. Please try again.')
        setBoardLoading(false)
      }
    }
    
    fetchBoardData()
  }, [params.boardId, mounted, loading])

  if (!mounted || loading || boardLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Loading board...</h2>
          <p className="text-sm text-gray-500">This may take a moment</p>
        </div>
      </div>
    )
  }

  if (boardError) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2 text-red-500">Error</h2>
          <p className="text-gray-600">{boardError}</p>
          <button 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() => router.push('/dashboard')}
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <ReduxProvider>
      <BoardCanvas boardId={params.boardId as string} />
    </ReduxProvider>
  )
} 