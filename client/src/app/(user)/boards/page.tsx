'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUserData } from '@/contexts/UserDataContext'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { authService } from '@/services/auth'
import { Spinner } from '@/components/ui/spinner'

interface Board {
  id: string
  name: string
  updatedAt: string
  createdAt: string
}

/**
 * Boards page component that displays user boards and allows creation of new boards
 * Only accessible to subscribed users
 */
export default function Boards() {
  const router = useRouter()
  const { userData, loading: userLoading } = useUserData()
  const [boards, setBoards] = useState<Board[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [newBoardName, setNewBoardName] = useState('')

  // Fetch user boards from server
  useEffect(() => {
    if (userLoading) return
    
    const fetchBoards = async () => {
      setIsLoading(true)
      setError(null)
      
      try {
        // Use authService to make the API call
        const response = await authService.get<Board[]>('/api/boards/list')
        
        if (Array.isArray(response)) {
          // Sort boards by most recently updated
          const sortedBoards = [...response].sort((a, b) => 
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          )
          setBoards(sortedBoards)
        } else {
          setBoards([])
          console.warn('Invalid board data format:', response)
        }
      } catch (err) {
        console.error('Error fetching boards:', err)
        setError('Failed to load boards. Please try again.')
        
        // For development, use mock data if API fails
        if (process.env.NODE_ENV === 'development') {
          const mockBoards = [
            { 
              id: '1', 
              name: 'Project Brainstorm', 
              updatedAt: new Date().toISOString(),
              createdAt: new Date(Date.now() - 86400000).toISOString()
            },
            { 
              id: '2', 
              name: 'Marketing Ideas', 
              updatedAt: new Date(Date.now() - 86400000).toISOString(),
              createdAt: new Date(Date.now() - 172800000).toISOString()
            }
          ]
          setBoards(mockBoards)
          setError('Using mock data (API connection failed)')
        }
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchBoards()
  }, [userLoading])

  // Create new board
  const handleCreateBoard = async () => {
    if (!newBoardName.trim()) return
    
    setIsCreating(true)
    setError(null)
    
    try {
      // Send create request to API
      const response = await authService.post('/api/boards/create', {
        name: newBoardName.trim()
      })
      
      if (response && response.data && response.data.id) {
        const newBoard: Board = {
          id: response.data.id,
          name: newBoardName.trim(),
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        }
        
        // Add the new board to the top of the list
        setBoards(prevBoards => [newBoard, ...prevBoards])
        setNewBoardName('')
        
        // Navigate to the new board
        router.push(`/boards/${newBoard.id}`)
      } else {
        throw new Error('Invalid response from server')
      }
    } catch (err) {
      console.error('Error creating board:', err)
      setError('Failed to create board. Please try again.')
      
      // For development, create a local board if API fails
      if (process.env.NODE_ENV === 'development') {
        const newBoardId = Date.now().toString()
        const newBoard: Board = {
          id: newBoardId,
          name: newBoardName.trim(),
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        }
        
        setBoards(prevBoards => [newBoard, ...prevBoards])
        setNewBoardName('')
        router.push(`/boards/${newBoardId}`)
      }
    } finally {
      setIsCreating(false)
    }
  }
  
  // Delete a board
  const handleDeleteBoard = async (boardId: string, event: React.MouseEvent) => {
    // Stop event propagation to prevent navigation
    event.preventDefault()
    event.stopPropagation()
    
    // Confirm deletion
    if (!confirm('Are you sure you want to delete this board? This cannot be undone.')) {
      return
    }
    
    setIsDeleting(boardId)
    
    try {
      // Send delete request to API
      await authService.post(`/api/boards/delete?id=${boardId}`, {})
      
      // Remove board from state
      setBoards(prevBoards => prevBoards.filter(board => board.id !== boardId))
      
      // Also remove from localStorage
      localStorage.removeItem(`board-${boardId}`)
    } catch (err) {
      console.error('Error deleting board:', err)
      alert('Failed to delete board. Please try again.')
    } finally {
      setIsDeleting(null)
    }
  }

  // Handle Enter key press in the input field
  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && newBoardName.trim() && !isCreating) {
      handleCreateBoard()
    }
  }

  if (userLoading || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-600">Loading boards...</p>
        </div>
      </div>
    )
  }

  // Add authentication check
  if (!userData) {
    router.push('/auth/login')
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-8 gap-4">
        <div className="flex items-center">
          <h1 className="text-3xl font-bold">My Brainstorm Boards</h1>
          <Link href="/boards/settings" className="ml-4">
            <button 
              className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              title="Settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </Link>
        </div>
        <div className="flex flex-col md:flex-row gap-4">
          {error && (
            <div className="text-red-500 text-sm">{error}</div>
          )}
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="New board name"
              className="px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700 w-full md:w-auto"
            />
            <button
              onClick={handleCreateBoard}
              disabled={isCreating || !newBoardName.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {isCreating ? 'Creating...' : 'Create Board'}
            </button>
          </div>
        </div>
      </div>

      {boards.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h2 className="text-xl font-medium text-gray-600 dark:text-gray-400">No boards yet</h2>
          <p className="mt-2 text-gray-500 dark:text-gray-500">Create your first brainstorm board to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {boards.map((board) => (
            <Link href={`/boards/${board.id}`} key={board.id}>
              <Card className="p-6 hover:shadow-lg transition-shadow duration-200 cursor-pointer relative group">
                <h3 className="text-xl font-semibold mb-2">{board.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Last updated: {new Date(board.updatedAt).toLocaleDateString()}
                </p>
                <button 
                  onClick={(e) => handleDeleteBoard(board.id, e)}
                  disabled={isDeleting === board.id}
                  className="absolute top-2 right-2 p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  aria-label="Delete board"
                >
                  {isDeleting === board.id ? (
                    <Spinner size="sm" />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
} 