import type { Node, Edge } from 'reactflow'
import dagre from 'dagre'

/**
 * Determines the appropriate layout direction based on edge connections
 * This will help orient nodes based on how they're connected
 */
function determineOptimalDirection(edges: Edge[]): 'LR' | 'TB' {
  // If no edges, default to top-to-bottom layout
  if (!edges.length) return 'TB'
  
  // Count horizontal vs vertical connections based on handles
  let horizontalConnections = 0
  let verticalConnections = 0
  
  edges.forEach(edge => {
    // Check source handle position
    if (edge.sourceHandle?.includes('right') || edge.sourceHandle?.includes('left')) {
      horizontalConnections++
    } else if (edge.sourceHandle?.includes('top') || edge.sourceHandle?.includes('bottom')) {
      verticalConnections++
    }
    
    // Check target handle position
    if (edge.targetHandle?.includes('right') || edge.targetHandle?.includes('left')) {
      horizontalConnections++
    } else if (edge.targetHandle?.includes('top') || edge.targetHandle?.includes('bottom')) {
      verticalConnections++
    }
  })
  
  // Return the dominant direction, or default to TB
  return horizontalConnections > verticalConnections ? 'LR' : 'TB'
}

/**
 * Automatically arranges nodes in a hierarchical layout
 * Using the dagre library for graph layout
 * @param nodes - Nodes to arrange
 * @param edges - Edges connecting the nodes
 * @param direction - Direction of the layout (can be overridden by auto-detection)
 * @param detectDirection - Whether to automatically detect the optimal direction
 */
export function autoLayout(
  nodes: Node[], 
  edges: Edge[], 
  direction: 'LR' | 'TB' = 'TB',
  detectDirection: boolean = false
) {
  // Return original nodes if none to layout
  if (!nodes.length) return { nodes, edges }
  
  // Auto-detect direction if requested
  if (detectDirection) {
    direction = determineOptimalDirection(edges)
  }

  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))

  // Set the direction of the graph (TB = top to bottom, LR = left to right)
  dagreGraph.setGraph({ 
    rankdir: direction,
    nodesep: direction === 'TB' ? 80 : 150, 
    ranksep: direction === 'TB' ? 150 : 100,
    marginx: 50,
    marginy: 50,
    // Enable alignment where possible
    align: 'DL',
    // Use tighter packing
    ranker: 'tight-tree'
  })

  // Add nodes to the dagre graph with size based on node type
  nodes.forEach((node) => {
    // Adjust node dimensions based on node type and content
    let width = 200
    let height = 100
    
    // Look for node content length to adjust size
    if (node.data?.content?.text) {
      const textLength = node.data.content.text.length
      width = Math.max(150, Math.min(400, textLength * 5))
      height = Math.max(80, Math.min(250, textLength / 5))
    }
    
    dagreGraph.setNode(node.id, { width, height })
  })

  // Add edges to the dagre graph
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target)
  })

  // Calculate the layout
  dagre.layout(dagreGraph)

  // Apply the calculated positions to the nodes with smooth animation
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id)

    // Skip nodes with no position data
    if (!nodeWithPosition) return node

    return {
      ...node,
      // Position the node, accounting for its dimensions
      position: {
        x: nodeWithPosition.x - nodeWithPosition.width / 2,
        y: nodeWithPosition.y - nodeWithPosition.height / 2,
      },
      // Add a style property for smooth transition
      style: {
        ...node.style,
        transition: 'all 0.5s ease-in-out',
      },
    }
  })

  return { 
    nodes: layoutedNodes,
    edges
  }
} 