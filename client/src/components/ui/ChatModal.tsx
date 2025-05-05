'use client'

import React, { useState, useEffect, lazy, Suspense } from 'react'
import { Button } from './button'
import { Plus } from 'lucide-react'
import { authService } from '@/services/auth'

const LazyChatWindow = lazy(() => import('./ChatWindow'))

/**
 * Main modal component that displays chat windows
 * Allows creating multiple chat sessions
 */
export default function ChatModal({ 
  isOpen, 
  onClose 
}: { 
  isOpen: boolean
  onClose: () => void 
}) {
  // Start with just one chat window
  const [chatWindows, setChatWindows] = useState<number[]>([1])
  const [nextWindowId, setNextWindowId] = useState(2)
  const [loading, setLoading] = useState(true)

  console.log("Rendering ChatModal", { isOpen, chatWindows });

  useEffect(() => {
    // Verify user and update state
    authService.verifyUser().catch(error => {
      console.error('User verification failed:', error)
    }).finally(() => {
      setLoading(false)
    })
  }, [])

  if (!isOpen) return null

  // Add a new chat window
  const handleAddChatWindow = () => {
    setChatWindows(prev => [...prev, nextWindowId])
    setNextWindowId(prev => prev + 1)
  }

  // Close a specific chat window
  const handleCloseWindow = (windowId: number) => {
    setChatWindows(prev => prev.filter(id => id !== windowId))
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Chat Sessions</h2>
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              onClick={handleAddChatWindow}
              className="flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              New Chat
            </Button>
            <Button variant="outline" onClick={onClose}>Close All</Button>
          </div>
        </div>
        
        {chatWindows.length === 0 ? (
          <div className="text-center p-8">
            <p>All chat windows closed.</p>
            <Button className="mt-4" onClick={onClose}>Close Modal</Button>
          </div>
        ) : (
          <div className="flex flex-col space-y-4">
            {chatWindows.map(id => (
              <Suspense fallback={<div>Loading...</div>}>
                {loading ? (
                  <div>Loading...</div>
                ) : (
                  <LazyChatWindow 
                    key={id} 
                    windowId={id} 
                    onClose={() => handleCloseWindow(id)} 
                  />
                )}
              </Suspense>
            ))}
          </div>
        )}
      </div>
    </div>
  )
} 