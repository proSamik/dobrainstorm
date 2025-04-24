import { useEffect, useRef, useCallback } from 'react';
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
  
  // Store previous values to compare and prevent unnecessary updates
  const prevStoreNodesRef = useRef<Node[]>([]);
  const prevStoreEdgesRef = useRef<Edge[]>([]);
  const prevNodesRef = useRef<Node[]>([]);
  const prevEdgesRef = useRef<Edge[]>([]);
  
  // Track the last drag end time to prevent immediate sync after drag
  const lastDragEndTimeRef = useRef(0);
  const SYNC_COOLDOWN_MS = 500; // Wait 500ms after drag before allowing sync
  
  // Check if any node is in dragging state
  useEffect(() => {
    const checkDragging = () => {
      const draggingNode = nodes.find(node => node.dragging === true);
      
      if (isDraggingRef.current && !draggingNode) {
        // Drag just ended - record the time
        lastDragEndTimeRef.current = Date.now();
      }
      
      isDraggingRef.current = !!draggingNode;
    };
    
    checkDragging();
  }, [nodes]);
  
  /**
   * Compare nodes for equality checking only essential properties
   */
  const nodesEqual = useCallback((a: Node[], b: Node[]) => {
    if (a.length !== b.length) return false;
    
    // Compare only essential properties that affect rendering
    try {
      const simplifyNode = (node: Node) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: { ...node.data }
      });
      
      const aSimple = a.map(simplifyNode);
      const bSimple = b.map(simplifyNode);
      
      return JSON.stringify(aSimple) === JSON.stringify(bSimple);
    } catch (error) {
      console.error('Error comparing nodes:', error);
      return false;
    }
  }, []);
  
  /**
   * Compare edges for equality checking only essential properties
   */
  const edgesEqual = useCallback((a: Edge[], b: Edge[]) => {
    if (a.length !== b.length) return false;
    
    // Compare only essential properties
    try {
      const simplifyEdge = (edge: Edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type
      });
      
      const aSimple = a.map(simplifyEdge);
      const bSimple = b.map(simplifyEdge);
      
      return JSON.stringify(aSimple) === JSON.stringify(bSimple);
    } catch (error) {
      console.error('Error comparing edges:', error);
      return false;
    }
  }, []);
  
  // Sync store to ReactFlow only when store changes
  useEffect(() => {
    const syncStoreToReactFlow = () => {
      console.log('Checking if sync is needed:', {
        storeNodesLength: storeNodes.length,
        nodesLength: nodes.length
      });
      
      // Don't sync if a node is being dragged to avoid interrupting the drag operation
      if (isDraggingRef.current) {
        console.log('Skipping sync while dragging in progress');
        return;
      }
      
      // Don't sync if we're within the cooldown period after a drag operation
      const timeSinceLastDrag = Date.now() - lastDragEndTimeRef.current;
      if (timeSinceLastDrag < SYNC_COOLDOWN_MS) {
        console.log(`Skipping sync, only ${timeSinceLastDrag}ms since last drag (cooldown: ${SYNC_COOLDOWN_MS}ms)`);
        return;
      }
      
      // Check if store has changed since last sync
      const storeNodesChanged = !nodesEqual(storeNodes, prevStoreNodesRef.current);
      const storeEdgesChanged = !edgesEqual(storeEdges, prevStoreEdgesRef.current);
      
      // Check if ReactFlow has changed since last sync
      const reactFlowNodesChanged = !nodesEqual(nodes, prevNodesRef.current);
      const reactFlowEdgesChanged = !edgesEqual(edges, prevEdgesRef.current);
      
      // Only update if the store has changed and ReactFlow hasn't changed
      // or if the changes are different
      if (storeNodesChanged && (!reactFlowNodesChanged || !nodesEqual(storeNodes, nodes))) {
        console.log('Store nodes changed, updating ReactFlow nodes');
        
        // IMPORTANT: Preserve manually set positions by copying them from the current nodes
        const updatedNodes = storeNodes.map(storeNode => {
          const currentNode = nodes.find(n => n.id === storeNode.id);
          if (currentNode) {
            // Keep the current position if it exists
            return {
              ...storeNode,
              position: currentNode.position
            };
          }
          return storeNode;
        });
        
        // Update ReactFlow nodes
        setNodes(updatedNodes);
        
        // Update refs
        prevStoreNodesRef.current = [...storeNodes];
        prevNodesRef.current = updatedNodes;
      }
      
      if (storeEdgesChanged && (!reactFlowEdgesChanged || !edgesEqual(storeEdges, edges))) {
        console.log('Store edges changed, updating ReactFlow edges');
        
        // Update ReactFlow edges
        setEdges(storeEdges);
        
        // Update refs
        prevStoreEdgesRef.current = [...storeEdges];
        prevEdgesRef.current = [...storeEdges];
      }
    };
    
    // Run sync
    syncStoreToReactFlow();
  }, [storeNodes, storeEdges, nodesEqual, edgesEqual, nodes, edges, setNodes, setEdges]);
  
  // Update refs when ReactFlow state changes
  useEffect(() => {
    // Only update refs if nodes have changed and not during sync
    if (!nodesEqual(nodes, prevNodesRef.current)) {
      prevNodesRef.current = [...nodes];
    }
  }, [nodes, nodesEqual]);
  
  // Update refs when ReactFlow edges change
  useEffect(() => {
    // Only update refs if edges have changed and not during sync
    if (!edgesEqual(edges, prevEdgesRef.current)) {
      prevEdgesRef.current = [...edges];
    }
  }, [edges, edgesEqual]);
}; 