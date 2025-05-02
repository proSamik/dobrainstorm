'use client'

import { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '@/store'
import { getPlainText } from '@/lib/utils/text-helpers'

interface ParentNodeTraceProps {
  nodeId: string
}

/**
 * Component to display the parent node trace
 * Shows an ASCII tree representation of the node hierarchy
 * and a list of connected nodes with their content
 */
export const ParentNodeTrace = ({ nodeId }: ParentNodeTraceProps) => {
  const nodes = useSelector((state: RootState) => state.board.nodes)
  const edges = useSelector((state: RootState) => state.board.edges)
  const [nodeContext, setNodeContext] = useState<{
    asciiTree: string;
    nodeList: Array<{ 
      id: string; 
      content: string; 
      label: string;
    }>;
  }>({ asciiTree: '', nodeList: [] })

  useEffect(() => {
    // Cache for storing connections to avoid repeated calculations
    const connectionsCache = new Map()
    
    // Function to get all connected nodes
    const getConnectedNodes = (nodeId: string) => {
      // Return from cache if we've already calculated this
      if (connectionsCache.has(nodeId)) {
        return connectionsCache.get(nodeId)
      }
      
      const connections = {
        parents: [] as Array<{ id: string; label: string }>,
        siblings: [] as Array<{ id: string; label: string }>,
        children: [] as Array<{ id: string; label: string }>
      }

      edges.forEach(edge => {
        if (edge.target === nodeId) {
          // This is a parent
          const node = nodes.find(n => n.id === edge.source)
          if (node) {
            connections.parents.push({
              id: node.id,
              label: node.data.label || ''
            })
          }
        } else if (edge.source === nodeId) {
          // This is a child
          const node = nodes.find(n => n.id === edge.target)
          if (node) {
            connections.children.push({
              id: node.id,
              label: node.data.label || ''
            })
          }
        }
      })

      // Find siblings (nodes that share the same parent)
      const parentIds = new Set(connections.parents.map(p => p.id))
      edges.forEach(edge => {
        if (parentIds.has(edge.source) && edge.target !== nodeId) {
          const node = nodes.find(n => n.id === edge.target)
          if (node) {
            connections.siblings.push({
              id: node.id,
              label: node.data.label || ''
            })
          }
        }
      })
      
      // Cache the result for future calls
      connectionsCache.set(nodeId, connections)
      return connections
    }

    // Build the ASCII tree and node list
    const buildTreeAndList = (startNodeId: string) => {
      const nodeList: Array<{ id: string; label: string; content: string }> = []
      const visitedNodes = new Set<string>()
      let asciiTree = ''

      const collectNodeInfo = (nodeId: string) => {
        if (visitedNodes.has(nodeId)) return
        const node = nodes.find(n => n.id === nodeId)
        if (!node) return

        visitedNodes.add(nodeId)
        nodeList.push({
          id: nodeId,
          label: node.data.label || '',
          content: getPlainText(node.data.content?.text || '')
        })

        const connections = getConnectedNodes(nodeId)
        
        // Process parents that we haven't visited yet
        connections.parents
          .filter((parent: { id: string; label: string }) => !visitedNodes.has(parent.id))
          .forEach((parent: { id: string; label: string }) => collectNodeInfo(parent.id))
        
        // Process siblings that we haven't visited yet
        connections.siblings
          .filter((sibling: { id: string; label: string }) => !visitedNodes.has(sibling.id))
          .forEach((sibling: { id: string; label: string }) => collectNodeInfo(sibling.id))
        
        // Process children that we haven't visited yet
        connections.children
          .filter((child: { id: string; label: string }) => !visitedNodes.has(child.id))
          .forEach((child: { id: string; label: string }) => collectNodeInfo(child.id))
      }

      // First collect all connected nodes
      collectNodeInfo(startNodeId)

      // Build ASCII tree structure
      const rootNodes = nodeList.filter(node => {
        const connections = getConnectedNodes(node.id)
        return connections.parents.length === 0
      })

      // Create a set to track visited nodes in the tree building process
      const visitedInTree = new Set<string>()

      // Helper function to build tree lines
      const buildTreeLines = (nodeId: string, prefix: string = '', isLast: boolean = true) => {
        const node = nodes.find(n => n.id === nodeId)
        if (!node || visitedInTree.has(nodeId)) return
        
        // Mark this node as visited to prevent cycles
        visitedInTree.add(nodeId)

        const connections = getConnectedNodes(nodeId)
        const label = node.data.label || 'Untitled'
        
        asciiTree += prefix + (isLast ? '└── ' : '├── ') + label + '\n'

        const newPrefix = prefix + (isLast ? '    ' : '│   ')
        const children = [...connections.children]
        
        children.forEach((child, index) => {
          buildTreeLines(child.id, newPrefix, index === children.length - 1)
        })
      }

      // Build the tree starting from root nodes
      rootNodes.forEach((root, index) => {
        buildTreeLines(root.id, '', index === rootNodes.length - 1)
      })

      return { asciiTree, nodeList }
    }

    setNodeContext(buildTreeAndList(nodeId))
  }, [nodeId, nodes, edges])

  if (nodeContext.nodeList.length === 0) return null

  return (
    <div className="mt-4">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Node Context Tree
      </label>
      
      {/* ASCII Tree View */}
      <div className="mb-4 p-2 bg-gray-50 max-h-20 overflow-y-scroll space-y-3 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
        <pre className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre font-mono">
          {nodeContext.asciiTree}
        </pre>
      </div>

      {/* Node List */}
      <div className="space-y-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Node Details
        </label>
        <div className="max-h-40 overflow-y-scroll space-y-3">
          {nodeContext.nodeList.map((node) => (
            <div 
              key={node.id}
              className="p-2 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600"
            >
              <div className="font-medium text-sm mb-1">{node.label}</div>
              {node.content && (
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  {node.content}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
} 