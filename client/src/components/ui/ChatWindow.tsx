'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Button } from './button'
import { Card } from './card'
import { X, StopCircle } from 'lucide-react'

interface MessageItem {
  sender: string;
  content: string;
  isIncomplete?: boolean;
}

interface ChatWindowProps {
  windowId: number
  onClose: () => void
}

/**
 * Individual chat window component
 * Manages a single websocket connection and chat session
 */
export default function ChatWindow({ windowId, onClose }: ChatWindowProps) {
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [inputValue, setInputValue] = useState('')
  const [connected, setConnected] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentStreamContent, setCurrentStreamContent] = useState('')
  const socketRef = useRef<WebSocket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hasConnectedRef = useRef(false) // Track if we've already connected

  // Function to scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Connect to WebSocket when component mounts
  useEffect(() => {
    // Prevent duplicate connections in StrictMode
    if (hasConnectedRef.current) {
      return
    }
    
    hasConnectedRef.current = true
    
    // Get the API URL from environment variable or fallback to default
    const wsBaseUrl = process.env.NEXT_PUBLIC_API_URL 
      ? process.env.NEXT_PUBLIC_API_URL.replace(/^http/, 'ws')
      : 'ws://localhost:8080'
    
    // Create new WebSocket connection
    const socket = new WebSocket(`${wsBaseUrl}/ws/chat`)
    socketRef.current = socket

    // Connection opened
    socket.addEventListener('open', () => {
      console.log(`Chat window ${windowId} connected`)
      setConnected(true)
    })

    // Connection closed
    socket.addEventListener('close', () => {
      console.log(`Chat window ${windowId} disconnected`)
      setConnected(false)
      setMessages(prev => [...prev, { sender: 'system', content: 'Disconnected from chat.' }])
    })

    // Connection error
    socket.addEventListener('error', (error) => {
      console.error(`Chat window ${windowId} error:`, error)
      setMessages(prev => [...prev, { sender: 'system', content: 'Connection error.' }])
    })

    // Listen for messages
    socket.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data)
        console.log(`Chat window ${windowId} received:`, data)

        if (data.sessionId && !sessionId) {
          setSessionId(data.sessionId)
        }

        // Handle different message types
        switch (data.type) {
          case 'connected':
            console.log('Connected to chat server')
            // System message for connection status
            setMessages(prev => [
              ...prev, 
              { sender: 'system', content: data.value }
            ])
            break
            
          case 'message':
            console.log(`Received message type with isStreaming=${data.isStreaming}`)
            // Regular message from user or complete AI response
            if (data.isStreaming === false) {
              console.log('Received complete AI response after streaming')
              // This is the final complete AI response after streaming
              setIsStreaming(false)
              setCurrentStreamContent('')
              
              // Replace the current streaming content with the full content
              setMessages(prev => {
                const newMessages = [...prev]
                // Find and remove any system "typing" message
                const typingIndex = newMessages.findIndex(
                  m => m.sender === 'system' && 
                  (m.content === 'AI is typing...' || m.content.includes('Processing'))
                )
                if (typingIndex !== -1) {
                  newMessages.splice(typingIndex, 1)
                }
                
                // Check if the message indicates a timeout or incomplete response
                const content = data.value.toString()
                const isIncomplete = content.includes('(response incomplete due to timeout)')
                
                // Remove the timeout suffix from content if present
                const cleanContent = isIncomplete 
                  ? content.replace(' (response incomplete due to timeout)', '')
                  : content
                
                return [
                  ...newMessages,
                  { 
                    sender: 'assistant', 
                    content: cleanContent,
                    isIncomplete: isIncomplete
                  }
                ]
              })
            } else {
              console.log('Received user message')
              // Regular message (likely from user)
              setMessages(prev => [
                ...prev, 
                { sender: 'user', content: data.value }
              ])
            }
            break
            
          case 'stream':
            // Partial AI response during streaming - server is streaming content
            console.log(`Received stream chunk: "${data.value}"`)
            if (!isStreaming) {
              console.log('First stream chunk received, setting isStreaming to true')
              setIsStreaming(true)
            }
            setCurrentStreamContent(prev => prev + data.value)
            break
            
          case 'status':
            console.log(`Received status: ${data.value}`)
            if (data.value === 'typing') {
              // AI is starting to respond
              console.log('AI is starting to type')
              setIsStreaming(true)
              setMessages(prev => [
                ...prev, 
                { sender: 'system', content: 'AI is typing...' }
              ])
            } else if (data.value === 'processing') {
              // OpenRouter is processing - update UI to indicate this
              console.log('OpenRouter is processing')
              // Keep streaming state, just update the typing indicator if needed
              if (!isStreaming) {
                setIsStreaming(true)
              }
              
              // Check if we already have a processing indicator
              setMessages(prev => {
                const hasProcessingMsg = prev.some(
                  m => m.sender === 'system' && 
                       (m.content === 'AI is typing...' || m.content.includes('Processing'))
                )
                
                if (!hasProcessingMsg) {
                  return [
                    ...prev,
                    { sender: 'system', content: 'Processing your request...' }
                  ]
                }
                return prev
              })
            } else if (data.value === 'stopped') {
              // Streaming was stopped by user
              console.log('Stream stopped by user')
              setIsStreaming(false)
              
              // If we have partial content, add it as a complete message
              if (currentStreamContent) {
                console.log(`Adding partial content as message: ${currentStreamContent.length} chars`)
                setMessages(prev => {
                  const newMessages = [...prev]
                  // Find and remove any system "typing" message
                  const typingIndex = newMessages.findIndex(
                    m => m.sender === 'system' && 
                    (m.content === 'AI is typing...' || m.content.includes('Processing'))
                  )
                  if (typingIndex !== -1) {
                    newMessages.splice(typingIndex, 1)
                  }
                  return [
                    ...newMessages,
                    { sender: 'assistant', content: currentStreamContent + ' (stopped)' }
                  ]
                })
                setCurrentStreamContent('')
              }
            } else if (data.value === 'stream_end') {
              // Server signals end of stream - all content delivered
              console.log('Stream ended naturally')
              setIsStreaming(false)
              
              // If we have partial content, add it as a complete message
              if (currentStreamContent) {
                console.log(`Adding complete streamed content: ${currentStreamContent.length} chars`)
                setMessages(prev => {
                  const newMessages = [...prev]
                  // Find and remove any system "typing" message
                  const typingIndex = newMessages.findIndex(
                    m => m.sender === 'system' && 
                    (m.content === 'AI is typing...' || m.content.includes('Processing'))
                  )
                  if (typingIndex !== -1) {
                    newMessages.splice(typingIndex, 1)
                  }
                  return [
                    ...newMessages,
                    { sender: 'assistant', content: currentStreamContent }
                  ]
                })
                setCurrentStreamContent('')
              }
            }
            break
            
          case 'error':
            // Error messages
            setMessages(prev => [
              ...prev, 
              { sender: 'system', content: `Error: ${data.value}` }
            ])
            setIsStreaming(false)
            break
            
          default:
            console.log(`Unknown message type: ${data.type}`)
        }
      } catch (error) {
        console.error('Error parsing message:', error)
        setMessages(prev => [...prev, { 
          sender: 'system', 
          content: 'Error processing server message.' 
        }])
      }
    })

    // Clean up on unmount
    return () => {
      console.log(`Closing socket for chat window ${windowId}`)
      if (socket.readyState === WebSocket.OPEN) {
        socket.close()
      }
    }
  }, [windowId])

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages, currentStreamContent])

  // Handle sending a message
  const handleSendMessage = () => {
    if (!inputValue.trim() || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return
    
    if (isStreaming) {
      // Don't send new messages while streaming
      return
    }

    try {
      // Send the message to the server
      socketRef.current.send(JSON.stringify({
        type: 'message',
        value: inputValue,
        sessionId: sessionId
      }))

      // Clear input field
      setInputValue('')
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }
  
  // Handle stopping the AI response stream
  const handleStopStream = () => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return
    
    try {
      // Send stop command to the server
      socketRef.current.send(JSON.stringify({
        type: 'stop',
        sessionId: sessionId
      }))
    } catch (error) {
      console.error('Error sending stop command:', error)
    }
  }

  return (
    <Card className="flex flex-col h-96 w-full shadow-md">
      <div className="flex justify-between items-center p-3 border-b">
        <h3 className="font-medium">Chat Window {windowId}</h3>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((msg, idx) => (
          <div key={idx} className={`${
            msg.sender === 'user' 
              ? 'text-right' 
              : msg.sender === 'system' 
                ? 'text-center' 
                : 'text-left'
          }`}>
            <span className={`inline-block px-3 py-1 rounded-lg ${
              msg.sender === 'user' 
                ? 'bg-blue-500 text-white'
                : msg.sender === 'system'
                  ? 'bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 text-xs'
                  : msg.isIncomplete 
                    ? 'bg-yellow-100 dark:bg-yellow-900 text-gray-800 dark:text-gray-200 border border-yellow-300 dark:border-yellow-700'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
            }`}>
              {msg.content}
              {msg.isIncomplete && (
                <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1 italic">
                  (Response incomplete due to timeout)
                </div>
              )}
            </span>
          </div>
        ))}
        
        {/* Show streaming content */}
        {currentStreamContent && isStreaming && (
          <div className="text-left">
            <span className="inline-block px-3 py-1 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
              {currentStreamContent}
              <span className="inline-block ml-1 animate-pulse">▌</span>
            </span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-3 border-t flex">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Type a message..."
          className="flex-1 px-3 py-2 border rounded-l-md focus:outline-none"
          disabled={!connected || isStreaming}
        />
        {isStreaming ? (
          <Button 
            onClick={handleStopStream}
            className="rounded-l-none bg-red-500 hover:bg-red-600"
          >
            <StopCircle className="h-4 w-4 mr-1" />
            Stop
          </Button>
        ) : (
          <Button 
            onClick={handleSendMessage} 
            disabled={!connected}
            className="rounded-l-none"
          >
            Send
          </Button>
        )}
      </div>
    </Card>
  )
} 