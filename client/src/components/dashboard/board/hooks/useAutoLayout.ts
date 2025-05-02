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
   * @param direction - The direction of the layout ('TB' for top-to-bottom, 'LR' for left-to-right)
   */
  const applyAutoLayout = useCallback((direction: 'TB' | 'LR' = 'TB') => {
    const nodes = getNodes()
    const edges = getEdges()

    if (nodes.length === 0) return

    const { nodes: layoutedNodes } = autoLayout(nodes, edges, direction)

    // Apply the layout to ReactFlow
    setNodes(layoutedNodes)

    // Also update the Redux store (with a delay to allow for animation)
    setTimeout(() => {
      dispatch(updateNodes(layoutedNodes))
    }, 500)

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
        applyAutoLayout()
      }, 100)
    }

    return newNodeId
  }, [applyAutoLayout])

  return {
    applyAutoLayout,
    createNodeWithLayout
  }
} 