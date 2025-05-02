'use client'

import { memo, useState, useCallback } from 'react'
import { Handle, NodeProps, Position, useReactFlow, Edge, MarkerType } from 'reactflow'
import { useDispatch, useSelector } from 'react-redux'
import { setSelectedNode, updateNodes, updateEdges, setEditingNode } from '@/store/boardSlice'
import { NodeContent } from '@/store/boardSlice'
import { RootState } from '@/store'
import { Plus, Link as LinkIcon, Maximize2 } from 'lucide-react'

interface TextNodeData {
  label: string
  content: NodeContent
}

/**
 * Enhanced TextNode component with editable label and improved connection handling
 */
const TextNode = ({ id, data, selected }: NodeProps<TextNodeData>) => {
  const dispatch = useDispatch()
  const { getNode, setNodes, setEdges } = useReactFlow()
  const allNodes = useSelector((state: RootState) => state.board.nodes)
  const allEdges = useSelector((state: RootState) => state.board.edges)
  const selectedNodeIds = useSelector((state: RootState) => state.board.selectedNodeIds)
  
  // Check if this node is multi-selected
  const isMultiSelected = selectedNodeIds.includes(id)
  
  // State for editing label
  const [isEditingLabel, setIsEditingLabel] = useState(false)
  const [editedLabel, setEditedLabel] = useState(data?.label || '')

  // Custom double-click tracking
  const [lastClickTime, setLastClickTime] = useState<number>(0)
  
  // Function to handle node clicks with double-click detection
  const handleNodeClick = () => {
    const currentTime = new Date().getTime();
    const timeSinceLastClick = currentTime - lastClickTime;
    
    // Select the node on all clicks
    dispatch(setSelectedNode(id));
    
    // Check if this is a double click (within 300ms)
    if (timeSinceLastClick < 300) {
      console.log('Double click detected on node', id);
      // Open edit panel on double click
      dispatch(setEditingNode(id));
      // Reset click time to prevent triple-click being detected as another double-click
      setLastClickTime(0);
    } else {
      // Update last click time for single clicks
      setLastClickTime(currentTime);
    }
  };
  
  // Handle label edit
  const handleLabelDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation() // Prevent selection change
    setEditedLabel(data?.label || '')
    setIsEditingLabel(true)
  }, [data?.label])
  
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
  
  // Create a new node at the specified position
  const createNewNode = useCallback((position: Position) => (event: React.MouseEvent) => {
    event.stopPropagation() // Prevent node selection
    
    // Get the current node position
    const parentNode = getNode(id)
    if (!parentNode) return
    
    // Calculate position for the new node
    let offsetX = 0
    let offsetY = 0
    const distanceHorizontal = 300
    const distanceVertical = 200
    
    switch (position) {
      case Position.Top:
        offsetY = -distanceVertical
        break
      case Position.Right:
        offsetX = distanceHorizontal
        break
      case Position.Bottom:
        offsetY = distanceVertical
        break
      case Position.Left:
        offsetX = -distanceHorizontal
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
      draggable: true,
      // Add smooth animation for node creation
      style: {
        opacity: 0,
        transform: 'scale(0.8)',
        transition: 'all 0.3s ease-in-out',
      },
    }
    
    // Create edge for the connection
    const newEdge: Edge = {
      id: `edge-${Date.now()}`,
      source: id,
      target: newNodeId,
      sourceHandle: position,
      targetHandle: getOppositePosition(position),
      animated: false,
      // Add arrow marker to edge
      markerEnd: {
        type: MarkerType.ArrowClosed,
      },
      style: { 
        strokeWidth: 2,
      }
    }
    
    // Add the new node and edge
    setNodes(nodes => [...nodes, newNode])
    setEdges(edges => [...edges, newEdge])
    
    // Update Redux store
    const updatedNodes = [...allNodes, newNode]
    dispatch(updateNodes(updatedNodes))
    
    const updatedEdges = [...allEdges, newEdge]
    dispatch(updateEdges(updatedEdges))
    
    // Animate the new node appearance
    setTimeout(() => {
      setNodes(nodes => nodes.map(node => {
        if (node.id === newNodeId) {
          return {
            ...node,
            style: {
              ...node.style,
              opacity: 1,
              transform: 'scale(1)',
            },
          };
        }
        return node;
      }));
    }, 10);
    
    // Select the new node
    setTimeout(() => {
      dispatch(setSelectedNode(newNodeId))
    }, 300)
  }, [id, getNode, setNodes, setEdges, allNodes, allEdges, dispatch])
  
  // Get the opposite position for connection handles
  const getOppositePosition = (position: Position): Position => {
    switch (position) {
      case Position.Top: return Position.Bottom
      case Position.Right: return Position.Left
      case Position.Bottom: return Position.Top
      case Position.Left: return Position.Right
      default: return Position.Bottom
    }
  }
  
  // Handle invalid data case
  if (!data) {
    console.error('TextNode: Invalid node data')
    return <div>Invalid node data</div>
  }
  
  return (
    <div
      className={`px-4 py-3 rounded-lg shadow-md relative ${
        selected 
          ? 'bg-blue-50 dark:bg-blue-900 border-2 border-blue-500' 
          : isMultiSelected
            ? 'bg-blue-50 dark:bg-blue-900 border-2 border-blue-300 dark:border-blue-700' 
            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
      }`}
      style={{ 
        minWidth: 180,
        touchAction: 'none',
        userSelect: 'none',
        boxShadow: selected 
          ? '0 0 0 2px rgba(59, 130, 246, 0.5), 0 4px 6px -1px rgba(0, 0, 0, 0.1)' 
          : isMultiSelected 
            ? '0 0 0 2px rgba(59, 130, 246, 0.3), 0 4px 6px -1px rgba(0, 0, 0, 0.1)' 
            : '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}
      onClick={handleNodeClick}
      data-id={id}
      data-selected={selected ? 'true' : 'false'}
      data-multiselected={isMultiSelected ? 'true' : 'false'}
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
        
        {/* Edit button to open full editor */}
        <button 
          className="ml-auto p-1 text-gray-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/50 rounded no-drag"
          onClick={(e) => {
            e.stopPropagation()
            dispatch(setEditingNode(id))
          }}
          title="Edit node content"
        >
          <Maximize2 size={14} />
        </button>
      </div>
      
      {/* Content area */}
      {data.content?.text ? (
        <div className="relative">
          <div 
            className="text-sm mt-1 cursor-text prose dark:prose-invert dark:text-white max-w-none px-1 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 rounded"
            dangerouslySetInnerHTML={{ __html: data.content.text }}
          />
        </div>
      ) : (
        <div className="relative">
          <div 
            className="text-sm mt-1 cursor-text prose dark:prose-invert dark:text-white max-w-none px-1 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 rounded min-h-[30px]"
            title="Double-click to edit content"
          >
            <span className="text-gray-400 dark:text-white italic">Double-click to edit content</span>
          </div>
        </div>
      )}
      
      {/* Connection Points with separate buttons for creating and connecting */}
      {/* Top */}
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-[14px] flex items-center gap-1">
        <Handle
          id={Position.Top}
          type="target"
          position={Position.Top}
          className="w-3 h-3 !bg-blue-500 border-2 border-white"
          isConnectable={true}
        />
        <button
          className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white cursor-pointer hover:bg-green-600 no-drag"
          onClick={createNewNode(Position.Top)}
          title="Create a new connected node above"
        >
          <Plus size={12} />
        </button>
      </div>
      
      {/* Right */}
      <div className="absolute right-0 top-1/2 transform translate-x-[14px] -translate-y-1/2 flex flex-col items-center gap-1">
        <Handle
          id={Position.Right}
          type="source"
          position={Position.Right}
          className="w-3 h-3 !bg-blue-500 border-2 border-white"
          isConnectable={true}
        />
        <button
          className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white cursor-pointer hover:bg-green-600 no-drag"
          onClick={createNewNode(Position.Right)}
          title="Create a new connected node to the right"
        >
          <Plus size={12} />
        </button>
      </div>
      
      {/* Bottom */}
      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-[14px] flex items-center gap-1">
        <Handle
          id={Position.Bottom}
          type="source"
          position={Position.Bottom}
          className="w-3 h-3 !bg-blue-500 border-2 border-white"
          isConnectable={true}
        />
        <button
          className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white cursor-pointer hover:bg-green-600 no-drag"
          onClick={createNewNode(Position.Bottom)}
          title="Create a new connected node below"
        >
          <Plus size={12} />
        </button>
      </div>
      
      {/* Left */}
      <div className="absolute left-0 top-1/2 transform -translate-x-[14px] -translate-y-1/2 flex flex-col items-center gap-1">
        <Handle
          id={Position.Left}
          type="target"
          position={Position.Left}
          className="w-3 h-3 !bg-blue-500 border-2 border-white"
          isConnectable={true}
        />
        <button
          className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white cursor-pointer hover:bg-green-600 no-drag"
          onClick={createNewNode(Position.Left)}
          title="Create a new connected node to the left"
        >
          <Plus size={12} />
        </button>
      </div>
    </div>
  )
}

export default memo(TextNode)