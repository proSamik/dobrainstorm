'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import BoardCanvas from '@/components/dashboard/BoardCanvas'
import { Provider } from 'react-redux'
import { ReactFlowProvider } from 'reactflow'
import { store } from '@/store'
import { Spinner } from '@/components/ui/spinner'

/**
 * Individual board page component that renders the BoardCanvas
 * for a specific board ID
 * Handles loading states and error conditions
 */
export default function BoardPage() {
  const params = useParams()
  const router = useRouter()
  const boardId = params.id as string
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Validate the board ID
  useEffect(() => {
    if (!boardId) {
      setError('Invalid board ID')
      return
    }

    // Simulate a short loading period to ensure store is ready
    const timer = setTimeout(() => {
      setLoading(false)
    }, 500)

    return () => clearTimeout(timer)
  }, [boardId])

  // Handle any errors by redirecting back to boards list
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        router.push('/boards')
      }, 3000)
      
      return () => clearTimeout(timer)
    }
  }, [error, router])

  // Show loading state
  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-600">Loading board...</p>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">Error: {error}</div>
          <p>Redirecting to boards list...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-full p-0 m-0 overflow-hidden">
      <ReactFlowProvider>
        <Provider store={store}>
          <BoardCanvas boardId={boardId} />
        </Provider>
      </ReactFlowProvider>
    </div>
  )
} 