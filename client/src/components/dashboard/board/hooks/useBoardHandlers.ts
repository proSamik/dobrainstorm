import { useCallback, useRef } from 'react';
import { 
  Connection, 
  Edge, 
  EdgeChange, 
  MarkerType, 
  Node, 
  NodeChange, 
  OnEdgesChange, 
  OnNodesChange, 
  addEdge 
} from 'reactflow';
import { useBoardStore } from './useBoardStore';
import { useDebounce } from '@/hooks/useDebounce';

/**
 * Custom hook for ReactFlow event handlers
 * Manages nodes and edges changes, connections, and updates
 */
export const useBoardHandlers = (
  nodes: Node[],
  edges: Edge[],
  onNodesChange: OnNodesChange,
  onEdgesChange: OnEdgesChange,
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>
) => {
  const { updateNodeState, updateEdgeState, selectNode } = useBoardStore();
  
  // Keep reference of current nodes and edges
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  
  // Track pending updates
  const pendingNodeUpdateRef = useRef(false);
  const pendingEdgeUpdateRef = useRef(false);
  
  // Create debounced functions for performance
  const debouncedNodeUpdate = useDebounce(() => {
    if (!pendingNodeUpdateRef.current) return;
    updateNodeState([...nodesRef.current]);
    pendingNodeUpdateRef.current = false;
  }, 300);
  
  const debouncedEdgeUpdate = useDebounce(() => {
    if (!pendingEdgeUpdateRef.current) return;
    updateEdgeState([...edgesRef.current]);
    pendingEdgeUpdateRef.current = false;
  }, 300);
  
  /**
   * Handle node changes (position, selection, etc.)
   * This is the primary function that handles node movement
   */
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // CRITICAL: Apply changes directly to ReactFlow's state first for visual updates
      onNodesChange(changes);
      
      // Process position changes
      const positionChanges = changes.filter(
        change => change.type === 'position' && 'position' in change
      );
      
      if (positionChanges.length > 0) {
        // Update node reference - important for tracking current state
        nodesRef.current = nodes;
        
        // Log changes for debugging
        positionChanges.forEach(change => {
          if (change.type === 'position' && change.position) {
            // Only log final positions to reduce console spam
            if ('dragging' in change && !change.dragging) {
              console.log(`Node ${change.id} final position:`, change.position);
            }
          }
        });
        
        // Check if this is a final position update (when dragging is complete)
        const hasFinalPositionChange = positionChanges.some(
          change => change.type === 'position' && 'dragging' in change && !change.dragging
        );
        
        // If dragging has stopped, update Redux immediately to ensure persistence
        if (hasFinalPositionChange) {
          console.log('Final position detected, updating Redux store');
          // Immediately update Redux with final position
          updateNodeState(nodes);
        }
      }
    },
    [nodes, onNodesChange, updateNodeState]
  );
  
  /**
   * Handle edge changes (adding, removing)
   */
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);
      edgesRef.current = [...edges];
      pendingEdgeUpdateRef.current = true;
      debouncedEdgeUpdate();
    },
    [edges, onEdgesChange, debouncedEdgeUpdate]
  );
  
  /**
   * Handle connecting two nodes
   */
  const handleConnect = useCallback(
    (connection: Connection) => {
      // Create a new edge with a unique ID and styling
      const newEdge = {
        ...connection,
        id: `edge-${Date.now()}`,
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
        style: { strokeWidth: 2 },
        data: { 
          relationship: 'parent-child' 
        }
      };
      
      setEdges((eds: Edge[]) => {
        const newEdges = addEdge(newEdge, eds);
        edgesRef.current = newEdges;
        pendingEdgeUpdateRef.current = true;
        debouncedEdgeUpdate();
        return newEdges;
      });
    },
    [setEdges, debouncedEdgeUpdate]
  );
  
  /**
   * Handle updating an existing edge
   */
  const handleEdgeUpdate = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      setEdges((els: Edge[]) => {
        // Remove the old edge
        const newEdges = els.filter((e: Edge) => e.id !== oldEdge.id);
        
        // Create updated edge with the same id
        const updatedEdge: Edge = {
          ...oldEdge,
          source: newConnection.source || oldEdge.source,
          target: newConnection.target || oldEdge.target,
          sourceHandle: newConnection.sourceHandle,
          targetHandle: newConnection.targetHandle
        };
        
        newEdges.push(updatedEdge);
        edgesRef.current = newEdges;
        pendingEdgeUpdateRef.current = true;
        debouncedEdgeUpdate();
        return newEdges;
      });
    },
    [setEdges, debouncedEdgeUpdate]
  );
  
  /**
   * Handle node click to select it
   */
  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    console.log("Node clicked:", node.id);
    selectNode(node.id);
  }, [selectNode]);
  
  return {
    handleNodesChange,
    handleEdgesChange,
    handleConnect,
    handleEdgeUpdate,
    handleNodeClick
  };
};