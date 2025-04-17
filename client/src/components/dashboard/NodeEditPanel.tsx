'use client'

import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '@/store'
import { updateNodeContent, setSelectedNode, NodeContent } from '@/store/boardSlice'

interface NodeEditPanelProps {
  nodeId: string
}

/**
 * Panel for editing node content (text and images)
 * Appears when a node is selected
 */
const NodeEditPanel = ({ nodeId }: NodeEditPanelProps) => {
  const dispatch = useDispatch()
  const nodes = useSelector((state: RootState) => state.board.nodes)
  
  // Find the selected node
  const selectedNode = nodes.find(node => node.id === nodeId)
  
  // Initialize state with node content
  const [text, setText] = useState<string>('')
  const [images, setImages] = useState<string[]>([])
  
  // Update local state when the selected node changes
  useEffect(() => {
    if (selectedNode) {
      setText(selectedNode.data.content?.text || '')
      setImages(selectedNode.data.content?.images || [])
    }
  }, [selectedNode])
  
  // Close the edit panel
  const handleClose = () => {
    dispatch(setSelectedNode(null))
  }
  
  // Update node content when text changes
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value
    setText(newText)
    
    // Update the node content in Redux
    const updatedContent: NodeContent = {
      text: newText,
      images: [...images]
    }
    
    dispatch(updateNodeContent({
      id: nodeId,
      content: updatedContent
    }))
  }
  
  // Add an image to the node
  const handleAddImage = () => {
    // In a real app, this would open a file picker or URL input
    // For now, we'll just add a placeholder image
    const placeholderImage = 'https://via.placeholder.com/150'
    
    const updatedImages = [...images, placeholderImage]
    setImages(updatedImages)
    
    // Update the node content in Redux
    const updatedContent: NodeContent = {
      text,
      images: updatedImages
    }
    
    dispatch(updateNodeContent({
      id: nodeId,
      content: updatedContent
    }))
  }
  
  // Remove an image from the node
  const handleRemoveImage = (index: number) => {
    const updatedImages = images.filter((_, i) => i !== index)
    setImages(updatedImages)
    
    // Update the node content in Redux
    const updatedContent: NodeContent = {
      text,
      images: updatedImages
    }
    
    dispatch(updateNodeContent({
      id: nodeId,
      content: updatedContent
    }))
  }
  
  // If no node is selected, don't render anything
  if (!selectedNode) {
    return null
  }
  
  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-lg z-10 p-4 overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Edit Node</h3>
        <button
          onClick={handleClose}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          &times;
        </button>
      </div>
      
      <div className="space-y-4">
        {/* Node label (title) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Label
          </label>
          <input
            type="text"
            value={selectedNode.data.label}
            disabled
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
          <p className="text-xs text-gray-500 mt-1">
            This is the node label (not editable)
          </p>
        </div>
        
        {/* Node content (text) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Content
          </label>
          <textarea
            value={text}
            onChange={handleTextChange}
            rows={5}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-none"
            placeholder="Enter text for this node..."
          />
        </div>
        
        {/* Images */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Images
            </label>
            <button
              onClick={handleAddImage}
              className="text-sm px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Add Image
            </button>
          </div>
          
          {images.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No images added yet
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {images.map((image, index) => (
                <div key={index} className="relative group">
                  <img
                    src={image}
                    alt={`Image ${index + 1}`}
                    className="w-full h-auto rounded border border-gray-200 dark:border-gray-700"
                  />
                  <button
                    onClick={() => handleRemoveImage(index)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default NodeEditPanel 