import { useEffect, useRef } from 'react';
import { Node, Edge } from 'reactflow';

/**
 * Hook to handle synchronization between ReactFlow state and Redux store
 * Ensures that the visual state matches the data store
 */
export const useBoardSync = (
  storeNodes: Node[],
  storeEdges: Edge[],
  nodes: Node[],
  edges: Edge[],
  setNodes: (nodes: Node[]) => void,
  setEdges: (edges: Edge[]) => void
) => {
  // Track if a node is currently being dragged
  const isDraggingRef = useRef(false);
  
  // Check if any node is in dragging state
  useEffect(() => {
    const checkDragging = () => {
      const draggingNode = nodes.find(node => node.dragging === true);
      isDraggingRef.current = !!draggingNode;
    };
    
    checkDragging();
  }, [nodes]);
  
  useEffect(() => {
    console.log('Syncing store nodes to ReactFlow, count:', storeNodes.length);
    
    // Don't sync if a node is being dragged to avoid interrupting the drag operation
    if (isDraggingRef.current) {
      console.log('Skipping sync while dragging in progress');
      return;
    }
    
    /**
     * Compare nodes for equality checking only essential properties
     */
    const nodesEqual = (a: Node[], b: Node[]) => {
      if (a.length !== b.length) return false;
      
      // Compare only essential properties that affect rendering
      const simplifyNode = (node: Node) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data,
      });
      
      const aSimple = a.map(simplifyNode);
      const bSimple = b.map(simplifyNode);
      
      return JSON.stringify(aSimple) === JSON.stringify(bSimple);
    };
    
    /**
     * Compare edges for equality checking only essential properties
     */
    const edgesEqual = (a: Edge[], b: Edge[]) => {
      if (a.length !== b.length) return false;
      
      // Compare only essential properties
      const simplifyEdge = (edge: Edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type,
      });
      
      const aSimple = a.map(simplifyEdge);
      const bSimple = b.map(simplifyEdge);
      
      return JSON.stringify(aSimple) === JSON.stringify(bSimple);
    };
    
    // Check if we actually need to update
    const nodesChanged = !nodesEqual(storeNodes, nodes);
    const edgesChanged = !edgesEqual(storeEdges, edges);
    
    if (nodesChanged) {
      console.log('Nodes changed, updating ReactFlow nodes');
      setNodes(storeNodes);
    }
    
    if (edgesChanged) {
      console.log('Edges changed, updating ReactFlow edges');
      setEdges(storeEdges);
    }
  }, [storeNodes, storeEdges, setNodes, setEdges, nodes, edges]);
}; 