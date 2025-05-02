'use client'

import { useRef, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { removeNode, removeEdge } from '@/store/boardSlice'

interface NodeContextMenuProps {
  nodeId: string
  x: number
  y: number
  isEdge?: boolean
  onClose: () => void
}

/**
 * Context menu that appears when right-clicking on a node or edge
 * Provides options like delete, duplicate, etc.
 */
const NodeContextMenu = ({ nodeId, x, y, isEdge = false, onClose }: NodeContextMenuProps) => {
  const dispatch = useDispatch()
  const menuRef = useRef<HTMLDivElement>(null)
  
  // Close the menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [onClose])
  
  // Handle deleting a node
  const handleDelete = () => {
    if (isEdge) {
      // If it's an edge, use the removeEdge action
      dispatch(removeEdge(nodeId))
    } else {
      // If it's a node, use the removeNode action
      dispatch(removeNode(nodeId))
    }
    onClose()
  }
  
  return (
    <div
      ref={menuRef}
      className="absolute z-50 bg-white dark:bg-gray-800 shadow-lg rounded-md overflow-hidden border border-gray-200 dark:border-gray-700"
      style={{
        top: y,
        left: x,
        minWidth: '150px',
      }}
    >
      <ul className="py-1">
        <li>
          <button
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900 dark:hover:bg-opacity-30"
            onClick={handleDelete}
          >
            Delete {isEdge ? 'Connection' : 'Node'}
          </button>
        </li>
        {!isEdge && (
          <>
            {/* Node-specific actions */}
            <li>
              <button
                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => {
                  // Future implementation for duplicate node
                  onClose()
                }}
              >
                Duplicate
              </button>
            </li>
          </>
        )}
      </ul>
    </div>
  )
}

export default NodeContextMenu 