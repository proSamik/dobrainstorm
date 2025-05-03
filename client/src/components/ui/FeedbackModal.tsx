'use client'

import { useState, useRef } from 'react'
import { X, X as XIcon, Image as ImageIcon } from 'lucide-react'
import { authService } from '@/services/auth'
import { toast } from 'sonner'

interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
}

interface UploadedImage {
  url: string;
  filename: string;
  size: number;
  preview: string;
}

/**
 * Modal component for submitting feedback with optional image attachments
 * Allows users to submit text feedback and up to 2 images
 */
export default function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [images, setImages] = useState<UploadedImage[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reset states when modal is closed
  const handleClose = () => {
    if (!isSubmitting && !isUploading) {
      setFeedback('')
      setImages([])
      onClose()
    }
  }

  // Handle file selection for image uploads
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const file = files[0]

    // Check if we already have 2 images
    if (images.length >= 2) {
      toast.error('Maximum of 2 images allowed')
      return
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Only image files are allowed')
      return
    }

    // Validate file size (1MB = 1048576 bytes)
    if (file.size > 1048576) {
      toast.error('Image size should not exceed 1MB')
      return
    }

    // Create a temporary URL for preview
    const reader = new FileReader()
    reader.onload = async (e) => {
      const preview = e.target?.result as string
      
      try {
        setIsUploading(true)
        // Upload the image to R2
        const uploadedImage = await authService.uploadImage(file)
        
        // Add the uploaded image to the state
        setImages([...images, { 
          ...uploadedImage, 
          preview // Keep the preview for display
        }])
        
        toast.success('Image uploaded successfully')
      } catch (error) {
        console.error('Error uploading image:', error)
        toast.error('Failed to upload image. Please try again.')
      } finally {
        setIsUploading(false)
      }
    }
    reader.readAsDataURL(file)

    // Reset the input to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Remove an image from the selected images
  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index))
  }

  // Submit feedback with images
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!feedback.trim()) return
    
    setIsSubmitting(true)
    
    try {
      // Format message with feedback text and image URLs
      let fullMessage = `feedback-\n"${feedback.trim()}"`;
      
      // Add image URLs if any
      if (images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          fullMessage += `\n\nimage${i+1}- "${images[i].url}"`;
        }
      }
      
      await authService.submitFeedback(fullMessage)
      toast.success('Thank you for your feedback!')
      setFeedback('')
      setImages([])
      onClose()
    } catch (error) {
      console.error('Error submitting feedback:', error)
      toast.error('Failed to submit feedback. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Share Your Feedback
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4">
          <div className="mb-4">
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Tell us what you think or suggest improvements..."
              className="w-full px-3 py-2 text-gray-700 dark:text-gray-300 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600"
              rows={5}
              required
            />
          </div>
          
          {/* Image upload section */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Attach Images (Optional)
              </label>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Max 2 images, 1MB each
              </span>
            </div>
            
            {/* Image preview area */}
            {images.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                {images.map((image, index) => (
                  <div key={index} className="relative group">
                    <img 
                      src={image.preview} 
                      alt={`Attachment ${index + 1}`} 
                      width={100} // Adjust width as needed
                      height={100} // Adjust height as needed
                      className="w-full h-24 object-cover rounded-md border border-gray-300 dark:border-gray-600"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-80 hover:opacity-100"
                      aria-label="Remove image"
                    >
                      <XIcon size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Upload button */}
            {images.length < 2 && (
              <div className="flex items-center justify-center">
                <label className={`cursor-pointer flex items-center justify-center w-full p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-primary-500 dark:hover:border-primary-400 transition-colors ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <div className="flex flex-col items-center">
                    {isUploading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-500 mb-2"></div>
                        <span className="text-sm text-gray-500 dark:text-gray-400">Uploading...</span>
                      </>
                    ) : (
                      <>
                        <ImageIcon size={24} className="text-gray-400 dark:text-gray-500 mb-2" />
                        <span className="text-sm text-gray-500 dark:text-gray-400">Click to add image</span>
                      </>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={isUploading}
                  />
                </label>
              </div>
            )}
          </div>
          
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="mr-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              disabled={isUploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isUploading || !feedback.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-md hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
} 