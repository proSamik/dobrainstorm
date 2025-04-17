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
 * Ultra-optimized TextNode component for smooth dragging
 */
const TextNode = ({ id, data, selected }: NodeProps<TextNodeData>) => {
  const dispatch = useDispatch()
  
  if (!data || !data.label) {
    return <div>Invalid node data</div>
  }
  
  return (
    <div
      className={`px-4 py-3 rounded-lg shadow-md ${
        selected ? 'bg-blue-50 border-2 border-blue-500' : 'bg-white border border-gray-200'
      }`}
      style={{ 
        minWidth: 150,
        touchAction: 'none', // Prevents touch actions from interfering with dragging
        userSelect: 'none',  // Prevents text selection during drag
      }}
      onClick={() => dispatch(setSelectedNode(id))}
    >
      {/* Drag handle - making it very clear this is draggable */}
      <div className="font-bold mb-1 text-sm border-b pb-1 flex items-center cursor-move">
        <div className="mr-2 text-gray-500">
          ≡≡ {/* Clearer drag handle icon */}
        </div>
        <span>{data.label}</span>
      </div>
      
      <div className="text-sm mt-1">
        {data.content?.text || <span className="text-gray-400 italic">Click to edit</span>}
      </div>
      
      {/* Simple connection handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-blue-500 no-drag"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-blue-500 no-drag"
      />
    </div>
  )
}

export default memo(TextNode) 