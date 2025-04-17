'use client'

import { memo } from 'react'
import { Handle, NodeProps, Position } from 'reactflow'
import { useDispatch } from 'react-redux'
import { setSelectedNode } from '@/store/boardSlice'
import { NodeContent } from '@/store/boardSlice'

interface TextNodeData {
  label: string
  content: NodeContent
}

/**
 * TextNode component that displays text and image content
 * Includes handles on all four sides for connections
 */
const TextNode = ({ id, data, selected }: NodeProps<TextNodeData>) => {
  const dispatch = useDispatch()
  
  // Select the node when clicked
  const handleClick = () => {
    dispatch(setSelectedNode(id))
  }
  
  return (
    <div
      className={`p-4 min-w-[200px] max-w-[300px] bg-white dark:bg-gray-800 rounded-lg shadow-md border-2 ${
        selected ? 'border-blue-500' : 'border-gray-200 dark:border-gray-700'
      }`}
      onClick={handleClick}
    >
      {/* Handles on all four sides */}
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        className="w-3 h-3 bg-blue-500"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="w-3 h-3 bg-blue-500"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="w-3 h-3 bg-blue-500"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        className="w-3 h-3 bg-blue-500"
      />
      
      {/* Node content */}
      <div className="mb-2 font-bold text-gray-800 dark:text-gray-200 border-b pb-2 text-sm">
        {data.label}
      </div>
      
      <div className="text-gray-700 dark:text-gray-300 break-words text-sm">
        {data.content.text ? (
          <p>{data.content.text}</p>
        ) : (
          <p className="text-gray-400 italic">Click to add text...</p>
        )}
        
        {/* Image gallery */}
        {data.content.images && data.content.images.length > 0 && (
          <div className="mt-2 grid grid-cols-2 gap-1">
            {data.content.images.map((image, index) => (
              <img
                key={index}
                src={image}
                alt={`Image ${index + 1}`}
                className="w-full h-auto rounded border border-gray-200 dark:border-gray-700"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Use memo to prevent unnecessary re-renders
export default memo(TextNode) 