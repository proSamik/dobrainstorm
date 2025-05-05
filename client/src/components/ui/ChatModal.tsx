'use client'

import React, { useState, useEffect, lazy, Suspense, useRef } from 'react'
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
  
  // Ref to store references to chat windows' closeFn
  const chatWindowRefs = useRef<Map<number, () => void>>(new Map())

  console.log("Rendering ChatModal", { isOpen, chatWindows });

  useEffect(() => {
    if (isOpen) {
      // Verify user and update state when modal is opened
      authService.verifyUser().catch(error => {
        console.error('User verification failed:', error)
      }).finally(() => {
        setLoading(false)
      })
    }
  }, [isOpen])
  
  // Close all websockets and then call the parent onClose function
  const handleCloseAll = () => {
    console.log("Closing all chat windows and websockets")
    // Close all registered websocket connections
    chatWindowRefs.current.forEach((closeFn, windowId) => {
      console.log(`Closing chat window ${windowId}`)
      closeFn()
    })
    
    // Clear the refs map
    chatWindowRefs.current.clear()
    
    // Clear the windows state
    setChatWindows([])
    
    // Call the parent onClose function
    onClose()
  }

  if (!isOpen) return null

  // Add a new chat window
  const handleAddChatWindow = () => {
    setChatWindows(prev => [...prev, nextWindowId])
    setNextWindowId(prev => prev + 1)
  }

  // Close a specific chat window
  const handleCloseWindow = (windowId: number) => {
    // Clean up the ref for this window
    chatWindowRefs.current.delete(windowId)
    setChatWindows(prev => prev.filter(id => id !== windowId))
  }
  
  // Register a chat window's close function
  const registerChatWindow = (windowId: number, closeFn: () => void) => {
    console.log(`Registering close function for window ${windowId}`)
    chatWindowRefs.current.set(windowId, closeFn)
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
            <Button variant="outline" onClick={handleCloseAll}>Close All</Button>
          </div>
        </div>
        
        {chatWindows.length === 0 ? (
          <div className="text-center p-8">
            <p>All chat windows closed.</p>
            <Button className="mt-4" onClick={handleCloseAll}>Close Modal</Button>
          </div>
        ) : (
          <div className="flex flex-col space-y-4">
            {chatWindows.map(id => (
              <Suspense key={id} fallback={<div>Loading...</div>}>
                {loading ? (
                  <div>Loading...</div>
                ) : (
                  <LazyChatWindow 
                    key={id} 
                    windowId={id} 
                    onClose={() => handleCloseWindow(id)}
                    registerCloseFn={(closeFn) => registerChatWindow(id, closeFn)}
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