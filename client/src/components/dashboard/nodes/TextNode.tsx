'use client'

import { memo, useState, useCallback } from 'react'
import { Handle, NodeProps, Position, useReactFlow, MarkerType, Edge, Connection } from 'reactflow'
import { useDispatch, useSelector } from 'react-redux'
import { setSelectedNode, updateNodes, updateEdges, setEditingNode } from '@/store/boardSlice'
import { NodeContent } from '@/store/boardSlice'
import { RootState } from '@/store'

interface TextNodeData {
  label: string
  content: NodeContent
}

/**
 * Enhanced TextNode component with editable label
 */
const TextNode = ({ id, data, selected }: NodeProps<TextNodeData>) => {
  const dispatch = useDispatch()
  const { getNode, setNodes, setEdges, getEdges } = useReactFlow()
  const allNodes = useSelector((state: RootState) => state.board.nodes)
  const allEdges = useSelector((state: RootState) => state.board.edges)
  
  // State for editing label
  const [isEditingLabel, setIsEditingLabel] = useState(false)
  const [editedLabel, setEditedLabel] = useState(data?.label || '')
  
  // State for connecting mode
  const [isConnectingMode, setIsConnectingMode] = useState(false)
  
  if (!data) {
    return <div>Invalid node data</div>
  }
  
  // Handle node selection
  const handleClick = (e: React.MouseEvent) => {
    // Don't trigger selection when clicking on label input
    if (isEditingLabel) {
      e.stopPropagation()
      return
    }
    
    // Simply select the node, but don't open the edit panel
    // The edit panel will only open on double-click
    dispatch(setSelectedNode(id))
  }
  
  // Handle label edit
  const handleLabelDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent selection change
    setEditedLabel(data.label)
    setIsEditingLabel(true)
  }
  
  // Handle content double-click to open edit panel
  const handleContentDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent other events
    
    // First select the node
    dispatch(setSelectedNode(id))
    
    // Then set it as the node being edited
    dispatch(setEditingNode(id))
  }
  
  // Save label after editing
  const handleLabelSave = () => {
    if (editedLabel.trim() !== data.label) {
      // Get all nodes from the store
      const updatedNodes = allNodes.map(node => {
        if (node.id === id) {
          // Update the node label
          return {
            ...node,
            data: {
              ...node.data,
              label: editedLabel.trim()
            }
          }
        }
        return node
      })
      
      // Update nodes in Redux
      dispatch(updateNodes(updatedNodes))
      
      // Also update in ReactFlow
      setNodes(updatedNodes)
    }
    setIsEditingLabel(false)
  }
  
  // Handle Enter key to save label
  const handleLabelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLabelSave()
    }
  }
  
  // Handle outside click to save
  const handleLabelBlur = () => {
    handleLabelSave()
  }
  
  // Toggle connection mode
  const toggleConnectionMode = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsConnectingMode(!isConnectingMode)
  }
  
  // Create a new connected node when clicking the "+" button
  const createConnectedNode = useCallback((position: Position) => (event: React.MouseEvent) => {
    event.stopPropagation() // Prevent node selection
    
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
    
    // Create edge for the connection with proper source/target based on position
    const newEdge: Edge = {
      id: `edge-${Date.now()}`,
      source: id, // Default source (will be overridden for some positions)
      target: newNodeId, // Default target (will be overridden for some positions)
      sourceHandle: null,
      targetHandle: null,
      type: 'bezier',
      animated: false,
      style: { strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 15,
        height: 15
      }
    }

    // Set source and target based on the position
    switch (position) {
      case Position.Top:
        newEdge.source = newNodeId
        newEdge.target = id
        newEdge.sourceHandle = Position.Bottom
        newEdge.targetHandle = Position.Top
        break
      case Position.Right:
        newEdge.source = id
        newEdge.target = newNodeId
        newEdge.sourceHandle = Position.Right
        newEdge.targetHandle = Position.Left
        break
      case Position.Bottom:
        newEdge.source = id
        newEdge.target = newNodeId
        newEdge.sourceHandle = Position.Bottom
        newEdge.targetHandle = Position.Top
        break
      case Position.Left:
        newEdge.source = newNodeId
        newEdge.target = id
        newEdge.sourceHandle = Position.Right
        newEdge.targetHandle = Position.Left
        break
    }
    
    console.log("Creating edge:", newEdge)
    
    // Add the new node and edge to ReactFlow
    setNodes(nodes => [...nodes, newNode])
    setEdges(edges => [...edges, newEdge])
    
    // Update Redux store
    const updatedNodes = [...allNodes, newNode]
    dispatch(updateNodes(updatedNodes))
    
    // Also update the edges in Redux store
    const updatedEdges = [...allEdges, newEdge]
    dispatch(updateEdges(updatedEdges))
    
    // Select the new node
    setTimeout(() => {
      dispatch(setSelectedNode(newNodeId))
    }, 100)
  }, [id, getNode, setNodes, setEdges, allNodes, allEdges, dispatch])
  
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
            onBlur={handleLabelBlur}
            onKeyDown={handleLabelKeyDown}
            autoFocus
            className="flex-1 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 no-drag"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span 
            onDoubleClick={handleLabelDoubleClick}
            className="cursor-text"
            title="Double-click to edit label"
          >
            {data.label}
          </span>
        )}
        
        {/* Connect icon */}
        <div 
          className={`ml-auto w-5 h-5 rounded-full ${isConnectingMode ? 'bg-green-500' : 'bg-gray-500'} flex items-center justify-center text-white cursor-pointer hover:bg-green-600 no-drag`}
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            // Prevent the event from reaching the + buttons
            e.nativeEvent.stopImmediatePropagation()
            toggleConnectionMode(e)
          }}
          title={isConnectingMode ? "Exit connection mode" : "Enter connection mode (click to connect to other nodes)"}
        >
          <span className="text-xs">⟋⟍</span>
        </div>
      </div>
      
      <div 
        className="text-sm mt-1 cursor-text"
        onDoubleClick={handleContentDoubleClick}
        title="Double-click to edit content"
      >
        {data.content?.text || <span className="text-gray-400 italic">Double-click to edit content</span>}
      </div>
      
      {/* Connection buttons with "+" icons */}
      <div 
        className={`w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white cursor-pointer hover:bg-blue-600 absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 no-drag ${isConnectingMode ? 'hidden' : ''}`}
        onClick={(e) => {
          if (!isConnectingMode) {
            createConnectedNode(Position.Top)(e)
          }
        }}
      >
        +
      </div>
      {/* Top Handle */}
      <Handle
        id={Position.Top}
        type="target"
        position={Position.Top}
        className={`${isConnectingMode ? 'w-4 h-4 bg-blue-200 border-2 border-blue-500' : 'w-0 h-0 opacity-0'}`}
        style={{ 
          top: 0, 
          left: '50%', 
          transform: 'translate(-50%, -50%)', 
          zIndex: 1000,
          cursor: isConnectingMode ? 'crosshair' : 'default',
          touchAction: 'none',
          borderRadius: '50%',
          transition: 'all 0.2s ease',
          pointerEvents: isConnectingMode ? 'auto' : 'none'
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        isConnectable={isConnectingMode}
      />
      
      <div 
        className={`w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white cursor-pointer hover:bg-blue-600 absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 no-drag ${isConnectingMode ? 'hidden' : ''}`}
        onClick={(e) => {
          if (!isConnectingMode) {
            createConnectedNode(Position.Right)(e)
          }
        }}
      >
        +
      </div>
      {/* Right Handle */}
      <Handle
        id={Position.Right}
        type="source"
        position={Position.Right}
        className={`${isConnectingMode ? 'w-4 h-4 bg-blue-200 border-2 border-blue-500' : 'w-0 h-0 opacity-0'}`}
        style={{ 
          right: 0, 
          top: '50%', 
          transform: 'translate(50%, -50%)', 
          zIndex: 1000,
          cursor: isConnectingMode ? 'crosshair' : 'default',
          touchAction: 'none',
          borderRadius: '50%',
          transition: 'all 0.2s ease',
          pointerEvents: isConnectingMode ? 'auto' : 'none'
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        isConnectable={isConnectingMode}
      />
      
      <div 
        className={`w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white cursor-pointer hover:bg-blue-600 absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 no-drag ${isConnectingMode ? 'hidden' : ''}`}
        onClick={(e) => {
          if (!isConnectingMode) {
            createConnectedNode(Position.Bottom)(e)
          }
        }}
      >
        +
      </div>
      {/* Bottom Handle */}
      <Handle
        id={Position.Bottom}
        type="source"
        position={Position.Bottom}
        className={`${isConnectingMode ? 'w-24 h-24 bg-blue-200 border-2 border-blue-500' : 'w-0 h-0 opacity-0'}`}
        style={{ 
          bottom: 0, 
          left: '50%', 
          transform: 'translate(-50%, 50%)', 
          zIndex: 1000,
          cursor: isConnectingMode ? 'crosshair' : 'default',
          touchAction: 'none',
          borderRadius: '50%',
          transition: 'all 0.2s ease',
          pointerEvents: isConnectingMode ? 'auto' : 'none'
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        isConnectable={isConnectingMode}
      />
      
      <div 
        className={`w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white cursor-pointer hover:bg-blue-600 absolute left-0 top-1/2 transform -translate-x-1/2 -translate-y-1/2 no-drag ${isConnectingMode ? 'hidden' : ''}`}
        onClick={(e) => {
          if (!isConnectingMode) {
            createConnectedNode(Position.Left)(e)
          }
        }}
      >
        +
      </div>
      {/* Left Handle */}
      <Handle
        id={Position.Left}
        type="target"
        position={Position.Left}
        className={`${isConnectingMode ? 'w-4 h-4 bg-blue-200 border-2 border-blue-500' : 'w-0 h-0 opacity-0'}`}
        style={{ 
          left: 0, 
          top: '50%', 
          transform: 'translate(-50%, -50%)', 
          zIndex: 1000,
          cursor: isConnectingMode ? 'crosshair' : 'default',
          touchAction: 'none',
          borderRadius: '50%',
          transition: 'all 0.2s ease',
          pointerEvents: isConnectingMode ? 'auto' : 'none'
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        isConnectable={isConnectingMode}
      />
    </div>
  )
}

export default memo(TextNode)