'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from './button'
import { Card } from './card'
import { X, StopCircle, MessageSquare, Bot, Info, BrainCircuit } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { authService } from '@/services/auth'
import ChatModelSelector from './ChatModelSelector'
import { useAppSelector } from '@/hooks/useRedux'

// Define different message types
interface BaseMessage {
  sender: string;
  content: string;
  id?: string;
}

interface UserMessage extends BaseMessage {
  sender: 'user';
}

interface AssistantMessage extends BaseMessage {
  sender: 'assistant';
  isIncomplete?: boolean;
  reasoning?: string;
  reasoningTime?: number; // Time spent thinking in seconds
  isThinking?: boolean;   // Currently in thinking phase
  isStreaming?: boolean;  // Currently streaming content
  processedContent?: string; // Processed markdown content
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
  const [showReasoning, setShowReasoning] = useState(true) // Start with reasoning visible
  const [isStopping, setIsStopping] = useState(false) // Track stop in progress for UI
  
  // Get the selected model from Redux store
  const selectedModel = useAppSelector(state => state.models.selectedModel);
  
  // Refs
  const socketRef = useRef<WebSocket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hasConnectedRef = useRef(false) // Track if we've already connected
  const sentMessagesRef = useRef<Set<string>>(new Set()) // Track sent message contents
  const activeMessageRef = useRef<number | null>(null) // Track active message index
  const reasoningStartTimeRef = useRef<number | null>(null) // Track reasoning start time
  const isUserScrollingRef = useRef(false) // Track if the user is scrolling
  const stoppingRef = useRef(false) // Track stop in progress

  // Function to scroll to bottom of chat
  const scrollToBottom = () => {
    if (!isUserScrollingRef.current) {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  // Handle user scroll
  const handleUserScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    isUserScrollingRef.current = scrollTop + clientHeight < scrollHeight;
  }

  // Handle closing the chat window
  const handleClose = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.close();
    }
    onClose();
  }, [onClose]);

  // Register the close function with the parent component
  useEffect(() => {
    if (registerCloseFn) {
      registerCloseFn(handleClose);
    }
  }, [registerCloseFn, handleClose]);

  // Process markdown with a small delay
  const processMarkdown = useCallback((messageIndex: number, content: string) => {
    // Small delay before processing markdown
    setTimeout(() => {
      setMessages(prev => {
        const newMessages = [...prev];
        if (messageIndex >= 0 && messageIndex < newMessages.length) {
          const message = newMessages[messageIndex];
          if (message && message.sender === 'assistant') {
            const assistantMsg = message as AssistantMessage;
            // Normalize line breaks for proper markdown rendering
            const normalizedContent = content
              .replace(/\r\n/g, '\n')
              .replace(/\r/g, '\n')
              // Fix for math formulas rendering 
              .replace(/\\\(/g, '$')
              .replace(/\\\)/g, '$')
              // Format multiline code blocks properly
              .replace(/```(.+?)\n/g, '```$1\n')
              .replace(/```\n/g, '```\n');
              
            newMessages[messageIndex] = {
              ...assistantMsg,
              processedContent: normalizedContent
            };
          }
        }
        return newMessages;
      });
    }, 5); // 5ms delay for markdown processing
  }, []);

  // Update thinking timer for active message
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    
    // Find active thinking message
    const activeThinkingMessage = activeMessageRef.current !== null && 
      messages[activeMessageRef.current] && 
      messages[activeMessageRef.current].sender === 'assistant'
        ? messages[activeMessageRef.current] as AssistantMessage
        : null;
      
    if (activeThinkingMessage && activeThinkingMessage.isThinking && reasoningStartTimeRef.current) {
      // Update timer every second
      intervalId = setInterval(() => {
        setMessages(prev => {
          const newMessages = [...prev];
          if (activeMessageRef.current !== null && 
              activeMessageRef.current < newMessages.length && 
              newMessages[activeMessageRef.current] && 
              newMessages[activeMessageRef.current].sender === 'assistant') {
            
            const currentTime = Math.round((Date.now() - reasoningStartTimeRef.current!) / 1000);
            const assistantMessage = newMessages[activeMessageRef.current] as AssistantMessage;
            
            // Only update if time has changed to minimize rerenders
            if (assistantMessage.reasoningTime !== currentTime) {
              newMessages[activeMessageRef.current] = {
                ...assistantMessage,
                reasoningTime: currentTime
              };
              return newMessages;
            }
          }
          return prev;
        });
      }, 1000);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [messages]);

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
            // Connection established
            setMessages(prev => [
              ...prev, 
              { sender: 'system', content: data.value }
            ])
            break
            
          case 'user':
            // User message from server - should rarely happen with our modifications
            if (typeof data.value !== 'string') {
              console.error('Invalid message value type:', typeof data.value);
              break;
            }
            
            // Only add if not a duplicate
            if (!sentMessagesRef.current.has(data.value)) {
              setMessages(prev => [
                ...prev, 
                { sender: 'user', content: data.value, id: data.messageId || `server-${Date.now()}` }
              ]);
            }
            break;
            
          case 'status':
            const statusValue = data.value;
            console.log(`Received status: ${statusValue}`);
            
            if (statusValue === 'typing') {
              // AI is starting to think - create a new message in thinking state
              console.log('AI is starting to think');
              reasoningStartTimeRef.current = Date.now();
              
              // Remove any processing/thinking system messages
              setMessages(prev => {
                const newMessages = [...prev];
                const processingIndex = newMessages.findIndex(
                  m => m && m.sender === 'system' && 
                     (m.content === 'AI is typing...' || 
                      m.content.includes('Processing') || 
                      m.content.includes('thinking'))
                );
                
                if (processingIndex !== -1) {
                  newMessages.splice(processingIndex, 1);
                }
                
                // Add new assistant message in thinking state
                newMessages.push({
                  sender: 'assistant',
                  content: '',
                  reasoning: '',
                  isThinking: true,
                  reasoningTime: 0
                });
                
                // Set active message to the new message
                activeMessageRef.current = newMessages.length - 1;
                
                return newMessages;
              });
            } 
            else if (statusValue === 'processing') {
              // Show processing message if no active message yet
              if (activeMessageRef.current === null) {
                reasoningStartTimeRef.current = Date.now();
                
                setMessages(prev => {
                  // Check if we already have a processing indicator
                  const hasProcessingMsg = prev.some(
                    m => m && m.sender === 'system' && 
                    (m.content.includes('Processing') || m.content.includes('thinking'))
                  );
                  
                  if (!hasProcessingMsg) {
                    return [
                      ...prev,
                      { sender: 'system', content: 'Processing your request...' }
                    ];
                  }
                  return prev;
                });
              }
            }
            else if (statusValue === 'stopped') {
              // Streaming was stopped by user - server confirmed
              console.log('Server confirmed stream stopped');
              
              // Reset stopping state
              stoppingRef.current = false;
              setIsStopping(false);
              
              setMessages(prev => {
                const newMessages = [...prev];
                if (activeMessageRef.current !== null && 
                    activeMessageRef.current < newMessages.length &&
                    newMessages[activeMessageRef.current] &&
                    newMessages[activeMessageRef.current].sender === 'assistant') {
                  const current = newMessages[activeMessageRef.current] as AssistantMessage;
                  newMessages[activeMessageRef.current] = {
                    ...current,
                    isThinking: false,
                    isStreaming: false,
                    content: current.content.replace(' (stopping...)', '') + ' (stopped)'
                  };
                }
                return newMessages;
              });
              
              // Reset active message
              activeMessageRef.current = null;
              reasoningStartTimeRef.current = null;
            }
            else if (statusValue === 'stream_end') {
              // Streaming has completed naturally
              console.log('Stream ended naturally');
              
              // Finalize the active message
              setMessages(prev => {
                const newMessages = [...prev];
                
                // Update all messages that might be streaming
                return newMessages.map(msg => {
                  if (msg && msg.sender === 'assistant') {
                    const assistantMsg = msg as AssistantMessage;
                    if (assistantMsg.isStreaming) {
                      return {
                        ...assistantMsg,
                        isThinking: false,
                        isStreaming: false
                      };
                    }
                  }
                  return msg;
                });
              });
              
              // Reset active message
              activeMessageRef.current = null;
              reasoningStartTimeRef.current = null;
              
              // Also reset stopping state if it was set
              stoppingRef.current = false;
              setIsStopping(false);
            }
            break;
            
          case 'reasoning':
            // Received reasoning chunk
            if (typeof data.value !== 'string') {
              console.error('Invalid reasoning value type:', typeof data.value);
              break;
            }
            
            console.log(`Received reasoning chunk: "${data.value}"`);
            
            // Initialize thinking time if not yet set
            if (reasoningStartTimeRef.current === null) {
              reasoningStartTimeRef.current = Date.now();
            }
            
            // Update the active message with new reasoning content
            setMessages(prev => {
              const newMessages = [...prev];
              
              // If no active message, create one or find the most recent assistant message
              if (activeMessageRef.current === null || 
                  activeMessageRef.current >= newMessages.length || 
                  !newMessages[activeMessageRef.current] ||
                  newMessages[activeMessageRef.current].sender !== 'assistant') {
                // Remove any processing messages
                const processingIndex = newMessages.findIndex(
                  m => m.sender === 'system' && 
                     (m.content === 'AI is typing...' || 
                      m.content.includes('Processing') || 
                      m.content.includes('thinking'))
                );
                
                if (processingIndex !== -1) {
                  newMessages.splice(processingIndex, 1);
                }
                
                // Create a new assistant message
                newMessages.push({
                  sender: 'assistant',
                  content: '',
                  reasoning: data.value,
                  isThinking: true,
                  reasoningTime: reasoningStartTimeRef.current 
                    ? Math.round((Date.now() - reasoningStartTimeRef.current) / 1000)
                    : 0
                });
                
                activeMessageRef.current = newMessages.length - 1;
              } else {
                // Update existing message
                const current = newMessages[activeMessageRef.current] as AssistantMessage;
                newMessages[activeMessageRef.current] = {
                  ...current,
                  reasoning: (current.reasoning || '') + data.value,
                  isThinking: true,
                  reasoningTime: reasoningStartTimeRef.current 
                    ? Math.round((Date.now() - reasoningStartTimeRef.current) / 1000)
                    : 0
                };
              }
              
              return newMessages;
            });
            break;
            
          case 'stream':
            // Received content chunk
            if (typeof data.value !== 'string') {
              console.error('Invalid stream value type:', typeof data.value);
              break;
            }
            
            console.log(`Received stream chunk: "${data.value}"`);
            
            // Update the active message with new content
            setMessages(prev => {
              const newMessages = [...prev];
              
              if (activeMessageRef.current === null || 
                  activeMessageRef.current >= newMessages.length || 
                  !newMessages[activeMessageRef.current] ||
                  newMessages[activeMessageRef.current].sender !== 'assistant') {
                // No active message or invalid reference - create one
                // Remove any processing messages
                const processingIndex = newMessages.findIndex(
                  m => m.sender === 'system' && 
                     (m.content === 'AI is typing...' || 
                      m.content.includes('Processing') || 
                      m.content.includes('thinking'))
                );
                
                if (processingIndex !== -1) {
                  newMessages.splice(processingIndex, 1);
                }
                
                // Create a new assistant message
                newMessages.push({
                  sender: 'assistant',
                  content: data.value,
                  isStreaming: true
                });
                
                activeMessageRef.current = newMessages.length - 1;
                
                // Process markdown for the new message
                setTimeout(() => {
                  processMarkdown(activeMessageRef.current!, data.value);
                }, 5);
              } else {
                // Update existing message (with safe type checking)
                const current = newMessages[activeMessageRef.current] as AssistantMessage;
                
                // If transitioning from thinking to streaming, store thinking time
                const finalReasoningTime = current && current.isThinking && reasoningStartTimeRef.current
                  ? Math.round((Date.now() - reasoningStartTimeRef.current) / 1000)
                  : current.reasoningTime;
                
                const updatedContent = (current.content || '') + data.value;
                
                newMessages[activeMessageRef.current] = {
                  ...current,
                  content: updatedContent,
                  isThinking: false,
                  isStreaming: true,
                  reasoningTime: finalReasoningTime
                };
                
                // Process markdown for updated content
                setTimeout(() => {
                  if (activeMessageRef.current !== null) {
                    processMarkdown(activeMessageRef.current, updatedContent);
                  }
                }, 5);
              }
              
              return newMessages;
            });
            break;
            
          case 'error':
            // Error messages
            setMessages(prev => [
              ...prev, 
              { sender: 'system', content: `Error: ${data.value}` }
            ]);
            
            // Reset active message
            activeMessageRef.current = null;
            reasoningStartTimeRef.current = null;
            break;
            
          default:
            console.log(`Unknown message type: ${data.type}`);
        }
      } catch (error) {
        console.error('Error parsing message:', error);
        setMessages(prev => [...prev, { 
          sender: 'system', 
          content: 'Error processing server message.' 
        }]);
      }
    });

    // Clean up on unmount
    return () => {
      console.log(`Closing socket for chat window ${windowId}`);
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowId, processMarkdown]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, showReasoning]);

  // Handle sending a message
  const handleSendMessage = () => {
    if (!inputValue.trim() || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN || stoppingRef.current) return;

    try {
      // Store the message content for deduplication
      const messageContent = inputValue.trim();
      const messageId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      // Check if this message content was already sent
      if (sentMessagesRef.current.has(messageContent)) {
        console.log(`Preventing duplicate send of message: ${messageContent}`);
        setInputValue('');
        return;
      }
      
      // Add to tracking set
      sentMessagesRef.current.add(messageContent);
      
      // Add the message to the UI immediately (don't wait for server echo)
      setMessages(prev => [
        ...prev,
        { sender: 'user', content: messageContent, id: messageId }
      ]);
      
      // Send the message to the server with model information
      socketRef.current.send(JSON.stringify({
        type: "message", 
        value: messageContent,
        sessionId: sessionId,
        messageId: messageId, // Send ID to server to help with deduplication
        model: selectedModel // Include selected model
      }));

      // Clear input field
      setInputValue('');
      
      // Reset references
      activeMessageRef.current = null;
      reasoningStartTimeRef.current = null;
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };
  
  // Handle stopping the AI response stream
  const handleStopStream = () => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN || stoppingRef.current || !sessionId) return;
    
    try {
      // Mark as stopping immediately - both for UI and internal tracking
      stoppingRef.current = true;
      setIsStopping(true);
      
      // Update the UI immediately - without waiting for server confirmation
      setMessages(prev => {
        const newMessages = [...prev];
        if (activeMessageRef.current !== null && 
            activeMessageRef.current < newMessages.length &&
            newMessages[activeMessageRef.current] &&
            newMessages[activeMessageRef.current].sender === 'assistant') {
          const current = newMessages[activeMessageRef.current] as AssistantMessage;
          newMessages[activeMessageRef.current] = {
            ...current,
            isThinking: false,
            isStreaming: false,
            content: current.content + ' (stopping...)'
          };
        }
        return newMessages;
      });
      
      // IMPORTANT: Use a direct HTTP call to stop the stream instead of WebSocket
      // This bypasses the WebSocket message queue that might be blocked by incoming stream chunks
      console.log('Sending stop request via direct HTTP call');
      
      // Use authService.post which handles auth headers and cookies automatically
      authService.post('/api/chat/stop', { sessionId })
        .then(response => {
          // Axios response has data property instead of json() method
          console.log('Stop request successful:', response.data);
          // Note: We don't need to do anything here as we'll get a WebSocket message when the stop is processed
        })
        .catch(error => {
          console.error('Error stopping stream via HTTP:', error);
          // On error, reset the stopping state after a short delay
          setTimeout(() => {
            stoppingRef.current = false;
            setIsStopping(false);
          }, 1000);
        });
      
      // Set a timeout to reset the stopping state if we don't get a server response
      setTimeout(() => {
        if (stoppingRef.current) {
          stoppingRef.current = false;
          setIsStopping(false);
          console.log('Stop request timed out, resetting stopping state');
        }
      }, 5000); // 5 second timeout
    } catch (error) {
      stoppingRef.current = false;
      setIsStopping(false);
      console.error('Error sending stop command:', error);
    }
  };

  // Toggle reasoning visibility for all messages
  const toggleAllReasoning = () => {
    setShowReasoning(prev => !prev);
  };

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
        const hasReasoning = assistantMsg && !!assistantMsg.reasoning && assistantMsg.reasoning.length > 0;
        
        return (
          <div key={idx} className="text-left mb-3">
            <div className="flex justify-start items-start gap-2">
              <div className={`inline-block px-3 py-2 rounded-lg max-w-[80%] ${
                assistantMsg.isIncomplete 
                  ? 'bg-yellow-100 dark:bg-yellow-900 text-gray-800 dark:text-gray-200 border border-yellow-300 dark:border-yellow-700'
                  : assistantMsg.isThinking
                    ? 'bg-purple-50 dark:bg-purple-900 text-gray-800 dark:text-gray-200 border border-purple-200 dark:border-purple-800'
                    : assistantMsg.isStreaming
                      ? 'bg-blue-50 dark:bg-blue-900 text-gray-800 dark:text-gray-200 border border-blue-200 dark:border-blue-800' 
                      : 'bg-slate-200 dark:bg-slate-700 text-gray-800 dark:text-gray-200'
              }`}>
                <div className="flex items-start gap-2">
                  <Bot className="h-4 w-4 mt-1 flex-shrink-0 text-slate-700 dark:text-slate-300" />
                  <div className="w-full">
                    {/* Reasoning Section - Always show first */}
                    {hasReasoning && (
                      <div className="mb-3">
                        {/* Thinking indicator with live timer */}
                        {assistantMsg.isThinking && (
                          <div className="text-xs text-purple-500 mb-1 flex items-center animate-pulse">
                            <div className="mr-1">●</div> 
                            Thinking for {assistantMsg.reasoningTime || 0}s
                          </div>
                        )}
                        
                        {/* Toggle button with reasoning time if not thinking */}
                        <button 
                          onClick={toggleAllReasoning} 
                          className="text-xs text-blue-500 hover:text-blue-700 mb-1 flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900 rounded-md"
                        >
                          <BrainCircuit className="h-3 w-3" />
                          {showReasoning ? 'Hide reasoning' : 'Show reasoning'}
                          
                          {!assistantMsg.isThinking && assistantMsg.reasoningTime !== undefined && (
                            <span className="ml-1 text-xs text-gray-500">
                              (thought for {assistantMsg.reasoningTime}s)
                            </span>
                          )}
                        </button>
                        
                        {/* Reasoning content */}
                        {showReasoning && (
                          <div className="mb-2 p-2 text-xs bg-gray-100 dark:bg-gray-800 rounded border-l-2 border-blue-500">
                            <div className="font-medium mb-1 text-blue-600 dark:text-blue-400">
                              AI Reasoning:
                            </div>
                            <div className="whitespace-pre-wrap">{assistantMsg.reasoning}</div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Content Section with Markdown */}
                    <div className="text-left break-words">
                      {assistantMsg && assistantMsg.processedContent ? (
                        <div className="prose dark:prose-invert prose-sm max-w-none markdown-container">
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeKatex]}
                          >
                            {assistantMsg.processedContent}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        assistantMsg && assistantMsg.content ? assistantMsg.content : ''
                      )}
                    </div>
                    
                    {/* Incomplete response indicator */}
                    {assistantMsg.isIncomplete && (
                      <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1 italic">
                        (Response incomplete due to timeout)
                      </div>
                    )}
                    
                    {/* Streaming indicator */}
                    {assistantMsg.isStreaming && (
                      <div className="text-xs text-blue-500 mt-1 flex items-center animate-pulse">
                        <div className="mr-1">●</div> Streaming...
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

  // Determine if we're in a state where we can't send new messages
  const isResponding = activeMessageRef.current !== null;

  // Add custom styles for the markdown content
  const markdownStyles = `
    .markdown-container pre {
      background-color: #f6f8fa;
      border-radius: 6px;
      padding: 16px;
      overflow-x: auto;
    }
    
    .markdown-container code {
      background-color: rgba(175, 184, 193, 0.2);
      border-radius: 3px;
      padding: 0.2em 0.4em;
      font-size: 85%;
    }
    
    .markdown-container pre code {
      background-color: transparent;
      padding: 0;
      font-size: 100%;
    }
    
    .dark .markdown-container pre {
      background-color: #1e293b;
    }
    
    .dark .markdown-container code {
      background-color: rgba(80, 90, 100, 0.5);
    }
  `;

  return (
    <Card className="flex flex-col h-96 w-full shadow-md">
      <div className="flex justify-between items-center p-3 border-b">
        <h3 className="font-medium">Chat Window {windowId}</h3>
        <Button variant="ghost" size="sm" onClick={handleClose} className="h-8 w-8 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <style>{markdownStyles}</style>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-2" onScroll={handleUserScroll}>
        {/* Render all messages */}
        {messages.map((msg, idx) => renderMessage(msg, idx))}
        
        <div ref={messagesEndRef} />
      </div>
      
      <div className="flex flex-col p-3 border-t gap-2">
        {/* Input row - full width */}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Type a message..."
          className="flex-1 px-3 py-2 border rounded-md focus:outline-none w-full"
          disabled={!connected || isResponding || isStopping}
        />
        
        {/* Controls row - model selector on left, send/stop button on right */}
        <div className="flex justify-between items-center">
          {/* Model selector - left side */}
          <ChatModelSelector compact={true} className="flex-1 max-w-[300px]" />
          
          {/* Send/Stop button - right side */}
          {isResponding ? (
            <Button 
              onClick={handleStopStream}
              className={`${isStopping ? 'bg-gray-500 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'}`}
              disabled={isStopping}
            >
              <StopCircle className="h-4 w-4 mr-1" />
              {isStopping ? 'Stopping...' : 'Stop'}
            </Button>
          ) : (
          <Button 
            onClick={handleSendMessage} 
            disabled={!connected || isStopping}
          >
            Send
          </Button>
          )}
        </div>
      </div>
    </Card>
  )
} 