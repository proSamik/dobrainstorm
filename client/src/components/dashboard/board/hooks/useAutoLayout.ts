import { useCallback } from 'react'
import { useReactFlow } from 'reactflow'
import { autoLayout } from '@/lib/utils/layoutUtils'
import { useDispatch } from 'react-redux'
import { updateNodes } from '@/store/boardSlice'

/**
 * Hook that provides functionality for automatic layout of board nodes
 */
export const useAutoLayout = () => {
  const { getNodes, getEdges, setNodes } = useReactFlow()
  const dispatch = useDispatch()

  /**
   * Applies automatic layout to the current nodes using dagre
   * @param direction - The direction of the layout ('TB' for top-to-bottom, 'LR' for left-to-right, 'auto' for auto-detection)
   * @param animate - Whether to animate the transition (defaults to true)
   */
  const applyAutoLayout = useCallback((direction: 'TB' | 'LR' | 'auto' = 'TB', animate = true) => {
    const nodes = getNodes()
    const edges = getEdges()

    if (nodes.length === 0) return

    // Use auto-detection if direction is 'auto'
    const useAutoDetection = direction === 'auto'
    const layoutDirection = useAutoDetection ? 'TB' : direction // Initial direction, will be overridden if auto-detecting

    const { nodes: layoutedNodes } = autoLayout(nodes, edges, layoutDirection, useAutoDetection)

    // Apply the layout to ReactFlow with animation
    if (animate) {
      // Add transition styles for smooth animation
      const animatedNodes = layoutedNodes.map(node => ({
        ...node,
        style: {
          ...node.style,
          transition: 'all 0.5s ease-in-out',
        }
      }))
      setNodes(animatedNodes)
    } else {
      // Apply without animation for immediate effect
      setNodes(layoutedNodes)
    }

    // Also update the Redux store (with a delay to allow for animation if enabled)
    setTimeout(() => {
      dispatch(updateNodes(layoutedNodes))
    }, animate ? 500 : 0)

  }, [getNodes, getEdges, setNodes, dispatch])

  /**
   * Creates a new node with smooth animation and auto-layout adjustment
   * @param createNodeFn - The function that creates the node
   * @param autoAdjust - Whether to automatically adjust layout after adding the node
   */
  const createNodeWithLayout = useCallback((
    createNodeFn: () => string | undefined,
    autoAdjust = true
  ) => {
    // Create the node using the provided function
    const newNodeId = createNodeFn()

    // If auto-adjust is enabled, apply the auto-layout after a short delay
    if (autoAdjust && newNodeId) {
      setTimeout(() => {
        // Use auto-detection for optimal layout
        applyAutoLayout('auto')
      }, 100)
    }

    return newNodeId
  }, [applyAutoLayout])

  return {
    applyAutoLayout,
    createNodeWithLayout
  }
} 