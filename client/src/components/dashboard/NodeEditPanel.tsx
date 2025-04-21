'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '@/store'
import { setEditingNode, NodeContent, updateNodes } from '@/store/boardSlice'
import { RichTextEditor } from './RichTextEditor'
import Image from 'next/image'

interface NodeEditPanelProps {
  nodeId: string
}

/**
 * Panel for editing node content (text and images)
 * Appears when a node is selected
 * Features rich text editing and responsive sizing
 */
const NodeEditPanel = ({ nodeId }: NodeEditPanelProps) => {
  const dispatch = useDispatch()
  const nodes = useSelector((state: RootState) => state.board.nodes)
  const panelRef = useRef<HTMLDivElement>(null)
  
  // Find the selected node
  const selectedNode = nodes.find(node => node.id === nodeId)
  
  // Initialize state with node content
  const [text, setText] = useState<string>('')
  const [images, setImages] = useState<string[]>([])
  const [label, setLabel] = useState<string>('')
  const [isDirty, setIsDirty] = useState(false)
  const [panelWidth, setPanelWidth] = useState(320) // Default width
  const [isDragging, setIsDragging] = useState(false)
  
  // Update local state when the selected node changes
  useEffect(() => {
    if (selectedNode) {
      setText(selectedNode.data.content?.text || '')
      setImages(selectedNode.data.content?.images || [])
      setLabel(selectedNode.data.label || '')
      setIsDirty(false)
    }
  }, [selectedNode])
  
  // Close the panel
  const handleClose = useCallback(() => {
    dispatch(setEditingNode(null))
  }, [dispatch])
  
  // Handle keyboard shortcuts and clicks outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleClose])

  // Handle panel resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && panelRef.current) {
        const newWidth = window.innerWidth - e.clientX
        // Set min and max width constraints
        const constrainedWidth = Math.min(Math.max(newWidth, 280), 800)
        setPanelWidth(constrainedWidth)
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])
  
  // Save the node content
  const handleSave = () => {
    if (!selectedNode) return
    
    // Update the node content in Redux
    const updatedContent: NodeContent = {
      text,
      images: [...images],
      isHtml: true // Always set isHtml to true since we're using rich text
    }
    
    const updatedNode = { ...selectedNode };
    let nodeChanged = false;
    
    // Update node content if changed
    if (text !== selectedNode.data.content?.text || 
        JSON.stringify(images) !== JSON.stringify(selectedNode.data.content?.images)) {
      updatedNode.data = {
        ...updatedNode.data,
        content: updatedContent
      };
      nodeChanged = true;
    }
    
    // Update node label if changed
    if (label.trim() !== selectedNode.data.label) {
      updatedNode.data = {
        ...updatedNode.data,
        label: label.trim()
      };
      nodeChanged = true;
    }
    
    // Only update if something actually changed
    if (nodeChanged) {
      // Update the node in Redux
      const updatedNodes = nodes.map(node => 
        node.id === nodeId ? updatedNode : node
      );
      
      dispatch(updateNodes(updatedNodes));
      console.log('Node updated:', updatedNode);
    }
    
    setIsDirty(false);
    
    // Close the panel after saving
    dispatch(setEditingNode(null))
  }
  
  // Update node content when text changes
  const handleTextChange = (newHtml: string) => {
    setText(newHtml)
    setIsDirty(true)
  }
  
  // Update node label when label changes
  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newLabel = e.target.value
    setLabel(newLabel)
    setIsDirty(true)
  }
  
  // Add an image to the node
  const handleAddImage = () => {
    // In a real app, this would open a file picker or URL input
    // For now, we'll just add a placeholder image
    const placeholderImage = 'https://via.placeholder.com/150'
    
    const updatedImages = [...images, placeholderImage]
    setImages(updatedImages)
    setIsDirty(true)
  }
  
  // Remove an image from the node
  const handleRemoveImage = (index: number) => {
    const updatedImages = images.filter((_, i) => i !== index)
    setImages(updatedImages)
    setIsDirty(true)
  }
  
  // If no node is selected, don't render anything
  if (!selectedNode) {
    return null
  }
  
  return (
    <div 
      ref={panelRef}
      className="absolute right-0 top-0 bottom-0 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-lg z-10 flex flex-col"
      style={{ width: panelWidth }}
    >
      {/* Resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-500 transition-colors"
        onMouseDown={() => setIsDragging(true)}
      />
      
      <div className="flex-none p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Edit Node</h3>
        </div>
        
        {/* Node label (title) */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Label
          </label>
          <input
            type="text"
            value={label}
            onChange={handleLabelChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            placeholder="Enter node label..."
          />
        </div>
      </div>
      
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto p-4 pt-0">
        {/* Rich text editor */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Content
          </label>
          <div className="border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden">
            <RichTextEditor
              content={text}
              onChange={handleTextChange}
              placeholder="Enter text for this node..."
            />
          </div>
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
                  <div className="relative w-full h-32">
                    <Image
                      src={image}
                      alt={`Image ${index + 1}`}
                      fill
                      className="object-cover rounded border border-gray-300 dark:border-gray-600"
                    />
                  </div>
                  <button
                    onClick={() => handleRemoveImage(index)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <ParentNodeTrace nodeId={nodeId} />
        </div>

        <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className={`px-3 py-1 rounded text-sm font-medium ${
                isDirty
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-300'
              }`}
              disabled={!isDirty}
            >
              {isDirty ? 'Save' : 'Saved'}
            </button>
            <button
              onClick={handleClose}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Close (ESC)"
            >
              &times;
            </button>
          </div>
      </div>
    </div>
  )
}

/**
 * Component to display the parent node trace
 */
const ParentNodeTrace = ({ nodeId }: { nodeId: string }) => {
  const nodes = useSelector((state: RootState) => state.board.nodes)
  const edges = useSelector((state: RootState) => state.board.edges)
  const [trace, setTrace] = useState<Array<{ id: string; content: string; label: string }>>([])

  useEffect(() => {
    // Function to get parent node and its content
    const getParentNode = (nodeId: string): { id: string; content: string; label: string } | null => {
      // Find edge where this node is the target
      const parentEdge = edges.find(edge => edge.target === nodeId)
      if (!parentEdge) return null

      // Find the parent node
      const parentNode = nodes.find(node => node.id === parentEdge.source)
      if (!parentNode) return null

      return {
        id: parentNode.id,
        content: parentNode.data.content?.text?.slice(0, 100) || '',
        label: parentNode.data.label || ''
      }
    }

    // Build the trace array
    const buildTrace = (startNodeId: string) => {
      const traceArray = []
      let currentNodeId = startNodeId
      const visitedNodes = new Set()

      while (true) {
        const parentNode = getParentNode(currentNodeId)
        if (!parentNode || visitedNodes.has(parentNode.id)) break
        
        visitedNodes.add(parentNode.id)
        traceArray.push(parentNode)
        currentNodeId = parentNode.id
      }

      return traceArray
    }

    setTrace(buildTrace(nodeId))
  }, [nodeId, nodes, edges])

  if (trace.length === 0) return null

  return (
    <div className="mt-4">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Parent Node Trace
      </label>
      <div className="max-h-40 overflow-y-auto space-y-2">
        {trace.map((node, index) => (
          <div 
            key={node.id} 
            className="p-2 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600"
          >
            <div className="font-medium text-sm">{node.label}</div>
            <div className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2" 
                 dangerouslySetInnerHTML={{ __html: node.content }} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default NodeEditPanel 