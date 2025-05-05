'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Button } from './button'
import { Card } from './card'
import { X, StopCircle, MessageSquare, Bot, Info, BrainCircuit } from 'lucide-react'

// Define different message types
interface BaseMessage {
  sender: string;
  content: string;
}

interface UserMessage extends BaseMessage {
  sender: 'user';
}

interface AssistantMessage extends BaseMessage {
  sender: 'assistant';
  isIncomplete?: boolean;
  reasoning?: string;
}

interface SystemMessage extends BaseMessage {
  sender: 'system';
}

type MessageItem = UserMessage | AssistantMessage | SystemMessage;

interface ChatWindowProps {
  windowId: number
  onClose: () => void
  registerCloseFn?: (closeFn: () => void) => void
}

/**
 * Individual chat window component
 * Manages a single websocket connection and chat session
 */
export default function ChatWindow({ windowId, onClose, registerCloseFn }: ChatWindowProps) {
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [inputValue, setInputValue] = useState('')
  const [connected, setConnected] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentStreamContent, setCurrentStreamContent] = useState('')
  const [currentReasoning, setCurrentReasoning] = useState('')
  const [showReasoning, setShowReasoning] = useState(false)
  const socketRef = useRef<WebSocket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hasConnectedRef = useRef(false) // Track if we've already connected
  const lastMessageIsUserRef = useRef(false) // Track if the last sent message was from user

  // Function to scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Handle closing the chat window
  const handleClose = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.close();
    }
    onClose();
  };

  // Register the close function with the parent component
  useEffect(() => {
    if (registerCloseFn) {
      registerCloseFn(handleClose);
    }
  }, [registerCloseFn]);

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
            
            // Check if this is a response to a user message or a user message itself
            if (data.isStreaming === false) {
              // This is the final AI response after streaming or a complete non-streaming response
              console.log('Received complete AI response')
              console.log('Reasoning received:', data.reasoning)
              
              setIsStreaming(false)
              
              // Get reasoning if available
              const reasoning = data.reasoning || currentReasoning || '';
              
              // Check if the message indicates a timeout or incomplete response
              const content = data.value.toString()
              const isIncomplete = content.includes('(response incomplete due to timeout)')
              
              // Remove the timeout suffix from content if present
              const cleanContent = isIncomplete 
                ? content.replace(' (response incomplete due to timeout)', '')
                : content
              
              // If this is an AI response after user message, add it as assistant message
              if (lastMessageIsUserRef.current) {
                setMessages(prev => {
                  const newMessages = [...prev]
                  // Find and remove any system "typing" message
                  const typingIndex = newMessages.findIndex(
                    m => m.sender === 'system' && 
                    (m.content === 'AI is typing...' || m.content.includes('Processing') || m.content.includes('thinking'))
                  )
                  if (typingIndex !== -1) {
                    newMessages.splice(typingIndex, 1)
                  }
                  
                  return [
                    ...newMessages,
                    { 
                      sender: 'assistant', 
                      content: cleanContent,
                      isIncomplete: isIncomplete,
                      reasoning: reasoning || undefined
                    }
                  ]
                })
                
                // Reset the user message flag
                lastMessageIsUserRef.current = false
              } else {
                // This must be a user message being echoed back, ignore it or handle appropriately
                console.log('Received a non-user message in message type - this may be a server echo')
              }
              
              // Clear streaming content after adding to messages
              setCurrentStreamContent('')
              // Don't clear reasoning as we want to keep it
            } else {
              console.log('Received user message')
              // This is a user message
              setMessages(prev => [
                ...prev, 
                { sender: 'user', content: data.value }
              ])
              
              // Mark that we've just received a user message
              lastMessageIsUserRef.current = true
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
            
          case 'reasoning':
            // Handle reasoning content - store it separately
            console.log(`Received reasoning chunk: "${data.value}"`)
            setCurrentReasoning(prev => prev + data.value)
            break
            
          case 'status':
            console.log(`Received status: ${data.value}`)
            if (data.value === 'typing') {
              // AI is starting to respond
              console.log('AI is starting to type')
              setIsStreaming(true)
              // Clear any previous reasoning when starting new response
              setCurrentReasoning('')
              // Update system message to indicate AI is thinking/typing
              setMessages(prev => {
                // Check if we already have a typing message
                const hasTypingMsg = prev.some(
                  m => m.sender === 'system' && 
                  (m.content === 'AI is typing...' || m.content.includes('thinking'))
                )
                
                if (!hasTypingMsg) {
                  return [
                    ...prev, 
                    { sender: 'system', content: 'AI is thinking...' }
                  ]
                }
                return prev
              })
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
                       (m.content === 'AI is typing...' || m.content.includes('Processing') || m.content.includes('thinking'))
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
                console.log(`Adding reasoning: ${currentReasoning.length} chars`)
                setMessages(prev => {
                  const newMessages = [...prev]
                  // Find and remove any system "typing" message
                  const typingIndex = newMessages.findIndex(
                    m => m.sender === 'system' && 
                    (m.content === 'AI is typing...' || m.content.includes('Processing') || m.content.includes('thinking'))
                  )
                  if (typingIndex !== -1) {
                    newMessages.splice(typingIndex, 1)
                  }
                  return [
                    ...newMessages,
                    { 
                      sender: 'assistant', 
                      content: currentStreamContent + ' (stopped)',
                      reasoning: currentReasoning || undefined
                    }
                  ]
                })
                setCurrentStreamContent('')
                // Reset user message flag since we've completed a response
                lastMessageIsUserRef.current = false
              }
            } else if (data.value === 'stream_end') {
              // Server signals end of stream - all content delivered
              console.log('Stream ended naturally')
              setIsStreaming(false)
              
              // If we have partial content, add it as a complete message
              if (currentStreamContent) {
                console.log(`Adding complete streamed content: ${currentStreamContent.length} chars`)
                console.log(`With reasoning: ${currentReasoning.length} chars`)
                setMessages(prev => {
                  const newMessages = [...prev]
                  // Find and remove any system "typing" message
                  const typingIndex = newMessages.findIndex(
                    m => m.sender === 'system' && 
                    (m.content === 'AI is typing...' || m.content.includes('Processing') || m.content.includes('thinking'))
                  )
                  if (typingIndex !== -1) {
                    newMessages.splice(typingIndex, 1)
                  }
                  return [
                    ...newMessages,
                    { 
                      sender: 'assistant', 
                      content: currentStreamContent,
                      reasoning: currentReasoning || undefined
                    }
                  ]
                })
                setCurrentStreamContent('')
                // Reset user message flag since we've completed a response
                lastMessageIsUserRef.current = false
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
            lastMessageIsUserRef.current = false
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
  }, [messages, currentStreamContent, currentReasoning, showReasoning])

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
      
      // Set the flag indicating we're expecting an AI response
      lastMessageIsUserRef.current = true
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

  // Toggle reasoning visibility for all messages
  const toggleAllReasoning = () => {
    setShowReasoning(prev => !prev)
  }

  // Render a message based on its type
  const renderMessage = (msg: MessageItem, idx: number) => {
    switch(msg.sender) {
      case 'user':
        return (
          <div key={idx} className="text-right mb-2">
            <div className="flex justify-end items-start gap-2">
              <div className="inline-block px-3 py-2 rounded-lg bg-blue-500 text-white max-w-[80%]">
                <div className="flex items-start gap-2">
                  <div>{msg.content}</div>
                  <MessageSquare className="h-4 w-4 mt-1 flex-shrink-0" />
                </div>
              </div>
            </div>
          </div>
        );
        
      case 'assistant':
        const assistantMsg = msg as AssistantMessage;
        return (
          <div key={idx} className="text-left mb-3">
            <div className="flex justify-start items-start gap-2">
              <div className={`inline-block px-3 py-2 rounded-lg max-w-[80%] ${
                assistantMsg.isIncomplete 
                  ? 'bg-yellow-100 dark:bg-yellow-900 text-gray-800 dark:text-gray-200 border border-yellow-300 dark:border-yellow-700'
                  : 'bg-slate-200 dark:bg-slate-700 text-gray-800 dark:text-gray-200'
              }`}>
                <div className="flex items-start gap-2">
                  <Bot className="h-4 w-4 mt-1 flex-shrink-0 text-slate-700 dark:text-slate-300" />
                  <div>
                    <div className="text-left">{assistantMsg.content}</div>
                    {assistantMsg.isIncomplete && (
                      <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1 italic">
                        (Response incomplete due to timeout)
                      </div>
                    )}
                    {assistantMsg.reasoning && (
                      <button 
                        onClick={toggleAllReasoning} 
                        className="text-xs text-blue-500 hover:text-blue-700 mt-2 flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900 rounded-md"
                      >
                        <BrainCircuit className="h-3 w-3" />
                        {showReasoning ? 'Hide reasoning' : 'Show reasoning'}
                      </button>
                    )}
                    {assistantMsg.reasoning && showReasoning && (
                      <div className="mt-2 p-2 text-xs bg-gray-100 dark:bg-gray-800 rounded border-l-2 border-blue-500">
                        <div className="font-medium mb-1 text-blue-600 dark:text-blue-400">AI Reasoning:</div>
                        <div className="whitespace-pre-wrap">{assistantMsg.reasoning}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
        
      case 'system':
        return (
          <div key={idx} className="text-center my-2">
            <div className="inline-flex items-center px-3 py-1 rounded-lg bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 text-xs">
              <Info className="h-3 w-3 mr-1" />
              {msg.content}
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <Card className="flex flex-col h-96 w-full shadow-md">
      <div className="flex justify-between items-center p-3 border-b">
        <h3 className="font-medium">Chat Window {windowId}</h3>
        <Button variant="ghost" size="sm" onClick={handleClose} className="h-8 w-8 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {/* Render all messages */}
        {messages.map((msg, idx) => renderMessage(msg, idx))}
        
        {/* Show streaming content */}
        {currentStreamContent && isStreaming && (
          <div className="text-left mb-3">
            <div className="flex justify-start items-start gap-2">
              <div className="inline-block px-3 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-gray-800 dark:text-gray-200 max-w-[80%]">
                <div className="flex items-start gap-2">
                  <Bot className="h-4 w-4 mt-1 flex-shrink-0 text-slate-700 dark:text-slate-300" />
                  <div>
                    <div className="text-left">
                      {currentStreamContent}
                      <span className="inline-block ml-1 animate-pulse">▌</span>
                    </div>
                    {currentReasoning && (
                      <button 
                        onClick={toggleAllReasoning} 
                        className="text-xs text-blue-500 hover:text-blue-700 mt-2 flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900 rounded-md"
                      >
                        <BrainCircuit className="h-3 w-3" />
                        {showReasoning ? 'Hide reasoning' : 'Show reasoning'}
                      </button>
                    )}
                    {currentReasoning && showReasoning && (
                      <div className="mt-2 p-2 text-xs bg-gray-100 dark:bg-gray-800 rounded border-l-2 border-blue-500">
                        <div className="font-medium mb-1 text-blue-600 dark:text-blue-400">AI Reasoning (live):</div>
                        <div className="whitespace-pre-wrap">
                          {currentReasoning}
                          <span className="inline-block ml-1 animate-pulse">▌</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
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