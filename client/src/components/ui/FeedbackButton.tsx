'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import FeedbackModal from './FeedbackModal'

interface FeedbackButtonProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
}

/**
 * A small button that sits in the corner of the page and allows users to submit feedback
 * Opens a modal when clicked and handles authentication check
 */
export default function FeedbackButton({ position = 'bottom-right' }: FeedbackButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { isAuthenticated } = useAuth()
  const router = useRouter()

  // Position styles based on the position prop
  const positionStyles = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  }

  const handleButtonClick = () => {
    if (isAuthenticated) {
      setIsOpen(true)
    } else {
      router.push('/contact')
    }
  }

  return (
    <>
      {/* Feedback button in the corner */}
      <button
        onClick={handleButtonClick}
        className={`fixed ${positionStyles[position]} z-10 bg-primary-500 hover:bg-primary-600 text-white rounded-full p-2 shadow-md transition-all duration-200 ease-in-out hover:scale-105`}
        aria-label="Give feedback"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      </button>

      {/* Feedback modal */}
      <FeedbackModal 
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  )
} 