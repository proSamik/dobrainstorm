'use client'

import React, { useState, useEffect, lazy, Suspense, useRef } from 'react'
import { Button } from './button'
import { Plus, ArrowRight, Clock, Search } from 'lucide-react'
import { authService } from '@/services/auth'
import { useAppDispatch, useAppSelector } from '@/hooks/useRedux'
import { 
  addSession, 
  activateSession, 
  deactivateSession, 
} from '@/store/chatSlice'

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
  // Get state from Redux
  const dispatch = useAppDispatch()
  const { sessions } = useAppSelector(state => state.chat)
  
  // State for managing chat windows
  const [chatWindows, setChatWindows] = useState<Array<{id: number, sessionId?: string}>>([])
  const [nextWindowId, setNextWindowId] = useState(1)
  const [loading, setLoading] = useState(true)
  
  // State for chat history UI
  const [historyLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  
  // Ref to store references to chat windows' closeFn
  const chatWindowRefs = useRef<Map<number, () => void>>(new Map())

  console.log("Rendering ChatModal", { isOpen, chatWindows });


  
  // Load user data and chat history when modal opens
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
  const handleAddChatWindow = (sessionId?: string) => {
    const id = nextWindowId
    setChatWindows(prev => [...prev, {id, sessionId}])
    setNextWindowId(prev => prev + 1)
    
    // If continuing an existing session, activate it in Redux
    if (sessionId) {
      dispatch(activateSession(sessionId))
    }
  }

  // Close a specific chat window
  const handleCloseWindow = (windowId: number) => {
    // Find the window to close
    const window = chatWindows.find(w => w.id === windowId)
    
    // If it has a session ID, mark it as inactive in Redux
    if (window?.sessionId) {
      dispatch(deactivateSession(window.sessionId))
    }
    
    // Clean up the ref for this window
    chatWindowRefs.current.delete(windowId)
    setChatWindows(prev => prev.filter(window => window.id !== windowId))
  }
  
  // Register a chat window's close function
  const registerChatWindow = (windowId: number, closeFn: () => void) => {
    console.log(`Registering close function for window ${windowId}`)
    chatWindowRefs.current.set(windowId, closeFn)
  }
  
  // Register a new chat session ID when it's created
  const handleSessionCreated = (windowId: number, sessionId: string) => {
    console.log(`Chat window ${windowId} created session: ${sessionId}`)
    
    // Update window with session ID
    setChatWindows(prev => 
      prev.map(window => 
        window.id === windowId ? {...window, sessionId} : window
      )
    )
    
    // Add to Redux store
    dispatch(addSession({
      id: sessionId,
      sessionId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }))
  }
  
  // Filter chat history based on search term
  const filteredSessions = searchTerm && sessions
    ? sessions.filter(item => 
        item.title?.toLowerCase().includes(searchTerm.toLowerCase()))
    : sessions || [];

  // Determine if we should show the history view (when no chat windows are open)
  const shouldShowHistoryView = chatWindows.length === 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-dark-background rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Chat Sessions</h2>
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              onClick={() => handleAddChatWindow()}
              className="flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              New Chat
            </Button>
            <Button variant="outline" onClick={handleCloseAll}>Close</Button>
          </div>
        </div>
        
        {/* Main Content Area */}
        {shouldShowHistoryView ? (
          // Show chat history when no windows are active
          <div className="mb-6 border rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Previous Conversations</h3>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 py-1 px-3 border rounded-md text-sm"
                />
              </div>
            </div>
            
            {historyLoading ? (
              <div className="flex justify-center items-center p-4">
                <div className="animate-spin h-5 w-5 border-2 border-blue-500 rounded-full border-t-transparent" />
                <span className="ml-2">Loading history...</span>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="text-center text-gray-500 p-4">
                {searchTerm ? 'No matching conversations found.' : 'No previous conversations. Start a new chat!'}
                <div className="mt-4">
                  <Button onClick={() => handleAddChatWindow()}>
                    <Plus className="h-4 w-4 mr-2" /> Start New Chat
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredSessions.map((chat, index) => (
                    <div 
                      key={`${chat.sessionId}-${index}`}
                      className="border rounded-md p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex flex-col"
                      onClick={() => handleAddChatWindow(chat.sessionId)}
                    >
                      <div className="font-medium truncate">{chat.title || 'Untitled Chat'}</div>
                      <div className="text-xs text-gray-500 flex items-center mt-1">
                        <Clock className="h-3 w-3 mr-1" />
                        {new Date(chat.updatedAt).toLocaleString()}
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="self-end mt-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddChatWindow(chat.sessionId);
                        }}
                      >
                        Continue <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 text-center">
                  <Button onClick={() => handleAddChatWindow()}>
                    <Plus className="h-4 w-4 mr-2" /> Start New Chat
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : (
          // Show active chat windows
          <div className="flex flex-col space-y-4">
            {chatWindows.map(window => (
              <Suspense key={window.id} fallback={<div>Loading chat window...</div>}>
                {loading ? (
                  <div className="h-96 flex items-center justify-center border rounded-lg">
                    <div className="animate-spin h-8 w-8 border-2 border-blue-500 rounded-full border-t-transparent" />
                    <span className="ml-2">Loading chat...</span>
                  </div>
                ) : (
                  <LazyChatWindow 
                    key={window.id} 
                    windowId={window.id} 
                    initialSessionId={window.sessionId}
                    onClose={() => handleCloseWindow(window.id)}
                    registerCloseFn={(closeFn) => registerChatWindow(window.id, closeFn)}
                    onHistoryCreated={(sessionId) => handleSessionCreated(window.id, sessionId)}
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