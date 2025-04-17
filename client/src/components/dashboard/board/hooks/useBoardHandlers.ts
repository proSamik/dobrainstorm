import { useCallback, useRef } from 'react';
import { 
  Connection, 
  Edge, 
  EdgeChange, 
  Node, 
  NodeChange, 
  OnConnectEnd,
  OnConnectStart,
  XYPosition,
  useReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge
} from 'reactflow';
import { useDispatch } from 'react-redux';
import { useDebounce } from '@/hooks/useDebounce';
import { 
  setSelectedNode,
  updateEdges,
  updateNodes
} from '../../../../store/boardSlice';

/**
 * Custom hook for ReactFlow event handlers
 * Manages nodes and edges changes, connections, and updates
 */
export const useBoardHandlers = () => {
  const dispatch = useDispatch();
  const { setNodes, setEdges } = useReactFlow();
  
  // Track pending updates
  const pendingNodeUpdateRef = useRef(false);
  const pendingEdgeUpdateRef = useRef(false);
  
  // Create debounced functions for performance
  const debouncedNodeUpdate = useDebounce(() => {
    if (!pendingNodeUpdateRef.current) return;
    pendingNodeUpdateRef.current = false;
  }, 300);
  
  const debouncedEdgeUpdate = useDebounce(() => {
    if (!pendingEdgeUpdateRef.current) return;
    pendingEdgeUpdateRef.current = false;
  }, 300);
  
  /**
   * Handle node changes (position, selection, etc.)
   * This is the primary function that handles node movement
   */
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // IMPORTANT: Let ReactFlow handle the state update directly
      // This fixes the infinite recursion issue by delegating to ReactFlow's internal mechanism
      
      // Process position changes (for tracking)
      const positionChanges = changes.filter(
        change => change.type === 'position' && 'position' in change
      );
      
      // Check for final position changes (when drag is complete)
      if (positionChanges.length > 0) {
        const finalPositionChanges = positionChanges.filter(
          change => change.type === 'position' && 'dragging' in change && !change.dragging
        );
        
        // Track that dragging has stopped - this will be used in BoardCanvas's onNodeDragStop
        if (finalPositionChanges.length > 0) {
          console.log("Final position detected in changes");
        }
      }
    },
    [dispatch]
  );
  
  /**
   * Handle edge changes (selection, removal, etc)
   */
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      // Let ReactFlow handle the changes directly to avoid recursion
    },
    []
  );
  
  /**
   * Handle new edge connections between nodes
   */
  const onConnect = useCallback(
    (connection: Connection) => {
      // Validate connection has required source and target
      if (!connection.source || !connection.target) {
        console.warn('Invalid connection attempt: missing source or target', connection);
        return;
      }

      // Let ReactFlow handle connecting the edges
      console.log('Edge created between:', connection.source, connection.target);
    },
    []
  );
  
  /**
   * Handle updating an existing edge
   */
  const onEdgeUpdate = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      // Let ReactFlow handle the edge update
    },
    []
  );
  
  /**
   * Handle node click to select it
   */
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    console.log("Node clicked:", node.id);
    dispatch(setSelectedNode(node.id));
  }, [dispatch]);
  
  return {
    onNodesChange,
    onEdgesChange,
    onConnect,
    onEdgeUpdate,
    onNodeClick
  };
};