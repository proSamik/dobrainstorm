import type { Node, Edge } from 'reactflow'
import dagre from 'dagre'

/**
 * Automatically arranges nodes in a hierarchical layout
 * Using the dagre library for graph layout
 */
export function autoLayout(nodes: Node[], edges: Edge[], direction: 'LR' | 'TB' = 'TB') {
  // Return original nodes if none to layout
  if (!nodes.length) return { nodes, edges }

  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))

  // Set the direction of the graph (TB = top to bottom, LR = left to right)
  dagreGraph.setGraph({ 
    rankdir: direction,
    nodesep: 100, 
    ranksep: 200,
    marginx: 50,
    marginy: 50
  })

  // Add nodes to the dagre graph
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: 200,
      height: 100,
    })
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