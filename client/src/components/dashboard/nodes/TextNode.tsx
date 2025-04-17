'use client'

import { memo, useState, useCallback } from 'react'
import { Handle, NodeProps, Position, useReactFlow } from 'reactflow'
import { useDispatch } from 'react-redux'
import { setSelectedNode, updateNodeContent } from '@/store/boardSlice'
import { NodeContent } from '@/store/boardSlice'

interface TextNodeData {
  label: string
  content: NodeContent
}

/**
 * Optimized TextNode component with editable label and + button connections
 */
const TextNode = ({ id, data, selected }: NodeProps<TextNodeData>) => {
  const dispatch = useDispatch()
  const { getNode, addNodes, addEdges } = useReactFlow()
  
  // State for editing label
  const [isEditingLabel, setIsEditingLabel] = useState(false)
  const [editedLabel, setEditedLabel] = useState(data?.label || '')
  
  if (!data) {
    return <div>Invalid node data</div>
  }
  
  // Handle node selection
  const handleClick = () => {
    dispatch(setSelectedNode(id))
  }
  
  // Handle label edit
  const handleLabelEdit = () => {
    setEditedLabel(data.label)
    setIsEditingLabel(true)
  }
  
  // Save label after editing
  const handleLabelSave = () => {
    if (editedLabel.trim() !== data.label) {
      // Update the node data in Redux store
      const updatedNode = getNode(id);
      if (updatedNode) {
        dispatch(updateNodeContent({
          id,
          content: data.content // Keep the content the same
        }));
        
        // We need to properly update the label outside of content
        // This will likely need a dedicated action in your Redux store
        // For now, log that we would update the label
        console.log(`Updated node ${id} label to: ${editedLabel}`);
      }
    }
    setIsEditingLabel(false);
  }
  
  // Handle Enter key to save label
  const handleLabelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLabelSave()
    }
  }
  
  // Create a new connected node when clicking the "+" button
  const createConnectedNode = useCallback((position: Position) => (event: React.MouseEvent) => {
    event.stopPropagation()
    
    // Get the current node position
    const parentNode = getNode(id)
    if (!parentNode) return
    
    // Calculate position for the new node
    let offsetX = 0
    let offsetY = 0
    const distance = 200
    
    switch (position) {
      case Position.Top:
        offsetY = -distance
        break
      case Position.Right:
        offsetX = distance
        break
      case Position.Bottom:
        offsetY = distance
        break
      case Position.Left:
        offsetX = -distance
        break
    }
    
    // Create a new node
    const newNodeId = `node-${Date.now()}`
    const newNode = {
      id: newNodeId,
      type: 'textNode',
      position: {
        x: parentNode.position.x + offsetX,
        y: parentNode.position.y + offsetY
      },
      data: {
        label: 'New Node',
        content: {
          text: '',
          images: []
        }
      },
      draggable: true
    }
    
    // Create an edge connecting to the new node
    const newEdge = {
      id: `edge-${Date.now()}`,
      source: id,
      target: newNodeId,
      type: 'smoothstep'
    }
    
    // Add the node and edge
    addNodes(newNode)
    addEdges(newEdge)
    
    // Select the new node
    setTimeout(() => {
      dispatch(setSelectedNode(newNodeId))
    }, 100)
  }, [id, getNode, addNodes, addEdges, dispatch])
  
  return (
    <div
      className={`px-4 py-3 rounded-lg shadow-md ${
        selected ? 'bg-blue-50 border-2 border-blue-500' : 'bg-white border border-gray-200'
      }`}
      style={{ 
        minWidth: 150,
        touchAction: 'none',
        userSelect: 'none',
      }}
      onClick={handleClick}
      data-id={id}
    >
      {/* Drag handle and editable label */}
      <div className="font-bold mb-1 text-sm border-b pb-1 flex items-center drag-handle">
        <div className="mr-2 text-gray-500">
          ≡≡
        </div>
        {isEditingLabel ? (
          <input
            type="text"
            value={editedLabel}
            onChange={(e) => setEditedLabel(e.target.value)}
            onBlur={handleLabelSave}
            onKeyDown={handleLabelKeyDown}
            autoFocus
            className="flex-1 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span onDoubleClick={handleLabelEdit}>{data.label}</span>
        )}
      </div>
      
      <div className="text-sm mt-1">
        {data.content?.text || <span className="text-gray-400 italic">Click to edit</span>}
      </div>
      
      {/* Connection handles with + buttons */}
      <div 
        className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white cursor-pointer hover:bg-blue-600 absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 no-drag"
        onClick={createConnectedNode(Position.Top)}
      >
        +
        <Handle
          type="target"
          position={Position.Top}
          className="opacity-0 w-full h-full"
          style={{ top: 0, left: 0 }}
        />
      </div>
      
      <div 
        className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white cursor-pointer hover:bg-blue-600 absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 no-drag"
        onClick={createConnectedNode(Position.Right)}
      >
        +
        <Handle
          type="source"
          position={Position.Right}
          className="opacity-0 w-full h-full"
          style={{ right: 0, top: 0 }}
        />
      </div>
      
      <div 
        className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white cursor-pointer hover:bg-blue-600 absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 no-drag"
        onClick={createConnectedNode(Position.Bottom)}
      >
        +
        <Handle
          type="source"
          position={Position.Bottom}
          className="opacity-0 w-full h-full"
          style={{ bottom: 0, left: 0 }}
        />
      </div>
      
      <div 
        className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white cursor-pointer hover:bg-blue-600 absolute left-0 top-1/2 transform -translate-x-1/2 -translate-y-1/2 no-drag"
        onClick={createConnectedNode(Position.Left)}
      >
        +
        <Handle
          type="target"
          position={Position.Left}
          className="opacity-0 w-full h-full"
          style={{ left: 0, top: 0 }}
        />
      </div>
    </div>
  )
}

export default memo(TextNode) 