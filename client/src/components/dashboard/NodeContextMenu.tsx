'use client'

import { useRef, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { removeNode } from '@/store/boardSlice'

interface NodeContextMenuProps {
  nodeId: string
  x: number
  y: number
  onClose: () => void
}

/**
 * Context menu that appears when right-clicking on a node
 * Provides options like delete, duplicate, etc.
 */
const NodeContextMenu = ({ nodeId, x, y, onClose }: NodeContextMenuProps) => {
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
    dispatch(removeNode(nodeId))
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
            Delete Node
          </button>
        </li>
        {/* Can add more options here like duplicate, change colors, etc. */}
      </ul>
    </div>
  )
}

export default NodeContextMenu 