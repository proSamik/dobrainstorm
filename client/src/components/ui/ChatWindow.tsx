'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Button } from './button'
import { Card } from './card'
import { X } from 'lucide-react'

interface ChatWindowProps {
  windowId: number
  onClose: () => void
}

/**
 * Individual chat window component
 * Manages a single websocket connection and chat session
 */
export default function ChatWindow({ windowId, onClose }: ChatWindowProps) {
  const [messages, setMessages] = useState<{ sender: string; content: string }[]>([])
  const [inputValue, setInputValue] = useState('')
  const [connected, setConnected] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Function to scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Connect to WebSocket when component mounts
  useEffect(() => {
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
      // Add initial system message
      setMessages([
        { sender: 'system', content: 'Connected to chat. Send a number to start.' }
      ])
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

        if (data.type === 'number') {
          // For number messages, show the value received
          const newMessage = { 
            sender: 'system', 
            content: `Server says: ${data.value}`
          }
          setMessages(prev => [...prev, newMessage])
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
  }, [messages])

  // Handle sending a message
  const handleSendMessage = () => {
    if (!inputValue.trim() || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return

    try {
      // Try to parse input as a number
      const num = parseInt(inputValue, 10)
      
      // Check if input is a valid number
      if (isNaN(num)) {
        setMessages(prev => [...prev, { 
          sender: 'system', 
          content: 'Please enter a valid number.' 
        }])
        return
      }

      // Send the number to the server
      socketRef.current.send(JSON.stringify({
        type: 'number',
        value: num,
        sessionId: sessionId
      }))

      // Add sent message to chat
      setMessages(prev => [...prev, { 
        sender: 'user', 
        content: `You sent: ${num}` 
      }])

      // Clear input field
      setInputValue('')
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  return (
    <Card className="flex flex-col h-64 w-full shadow-md">
      <div className="flex justify-between items-center p-3 border-b">
        <h3 className="font-medium">Chat Window {windowId}</h3>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((msg, idx) => (
          <div key={idx} className={`${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
            <span className={`inline-block px-3 py-1 rounded-lg ${
              msg.sender === 'user' 
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
            }`}>
              {msg.content}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-3 border-t flex">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Enter a number..."
          className="flex-1 px-3 py-2 border rounded-l-md focus:outline-none"
          disabled={!connected}
        />
        <Button 
          onClick={handleSendMessage} 
          disabled={!connected}
          className="rounded-l-none"
        >
          Send
        </Button>
      </div>
    </Card>
  )
} 