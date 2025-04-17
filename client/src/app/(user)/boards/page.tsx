'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUserData } from '@/contexts/UserDataContext'
import { hasActiveSubscription } from '@/lib/pricing'
import Link from 'next/link'
import { Card } from '@/components/ui/card'

/**
 * Boards page component that displays user boards and allows creation of new boards
 * Only accessible to subscribed users
 */
export default function Boards() {
  const router = useRouter()
  const { userData, loading } = useUserData()
  const [boards, setBoards] = useState<any[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [newBoardName, setNewBoardName] = useState('')
  const [mounted, setMounted] = useState(false)

  // Used to prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch user boards
  useEffect(() => {
    if (!mounted || loading) return
    
    // Fetch boards from API
    const fetchBoards = async () => {
      try {
        // TODO: Replace with actual API call
        // For now, we'll use mock data
        const mockBoards = [
          { id: '1', name: 'Project Brainstorm', updatedAt: new Date().toISOString() },
          { id: '2', name: 'Marketing Ideas', updatedAt: new Date(Date.now() - 86400000).toISOString() }
        ]
        setBoards(mockBoards)
      } catch (error) {
        console.error('Error fetching boards:', error)
      }
    }
    
    fetchBoards()
  }, [mounted, loading])

  // Create new board
  const handleCreateBoard = async () => {
    if (!newBoardName.trim()) return
    
    setIsCreating(true)
    try {
      // TODO: Replace with actual API call
      const newBoardId = Date.now().toString()
      const newBoard = {
        id: newBoardId,
        name: newBoardName,
        updatedAt: new Date().toISOString()
      }
      
      setBoards([newBoard, ...boards])
      setNewBoardName('')
      router.push(`/boards/${newBoardId}`)
    } catch (error) {
      console.error('Error creating board:', error)
    } finally {
      setIsCreating(false)
    }
  }

  if (!mounted || loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">My Brainstorm Boards</h1>
        <div className="flex space-x-4">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              placeholder="New board name"
              className="px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
            />
            <button
              onClick={handleCreateBoard}
              disabled={isCreating || !newBoardName.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? 'Creating...' : 'Create Board'}
            </button>
          </div>
        </div>
      </div>

      {boards.length === 0 ? (
        <div className="text-center py-12">
          <h2 className="text-xl font-medium text-gray-600 dark:text-gray-400">No boards yet</h2>
          <p className="mt-2 text-gray-500 dark:text-gray-500">Create your first brainstorm board to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {boards.map((board) => (
            <Link href={`/boards/${board.id}`} key={board.id}>
              <Card className="p-6 hover:shadow-lg transition-shadow duration-200 cursor-pointer">
                <h3 className="text-xl font-semibold mb-2">{board.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Last updated: {new Date(board.updatedAt).toLocaleDateString()}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
} 