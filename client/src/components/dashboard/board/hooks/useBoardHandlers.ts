import { useCallback, useRef } from 'react';
import { 
  Connection, 
  Edge, 
  EdgeChange, 
  Node, 
  NodeChange, 
  useReactFlow,
  MarkerType
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
  const { setNodes, setEdges, getEdges } = useReactFlow();
  
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
      // Check for edge removals and update the Redux store
      const removals = changes.filter(change => change.type === 'remove');
      if (removals.length > 0) {
        // Get the current edges from ReactFlow
        const currentEdges = getEdges();
        // Filter out removed edges
        const remainingEdges = currentEdges.filter(
          edge => !removals.some(removal => removal.id === edge.id)
        );
        
        // Update Redux store with remaining edges
        dispatch(updateEdges(remainingEdges));
        console.log(`${removals.length} edges removed`);
      }
    },
    [dispatch, getEdges]
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

      // Create a new edge with the connection data
      const newEdge: Edge = {
        id: `edge-${Date.now()}`,
        source: connection.source!,
        target: connection.target!,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        type: 'bezier',
        animated: false,
        style: { strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 15,
          height: 15
        }
      };

      // Add the edge to the ReactFlow state
      setEdges(edges => [...edges, newEdge]);
      
      // Also update the Redux store
      const currentEdges = getEdges();
      dispatch(updateEdges([...currentEdges, newEdge]));
      console.log('Edge created between:', connection.source, connection.target);
    },
    [dispatch, setEdges, getEdges]
  );
  
  /**
   * Handle updating an existing edge
   */
  const onEdgeUpdate = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      // Let ReactFlow handle the edge update
      if (!newConnection.source || !newConnection.target) {
        console.warn('Invalid edge update: missing source or target', newConnection);
        return;
      }
      
      // Create updated edge
      const updatedEdge: Edge = {
        id: oldEdge.id,
        source: newConnection.source!,
        target: newConnection.target!,
        sourceHandle: newConnection.sourceHandle,
        targetHandle: newConnection.targetHandle,
        type: oldEdge.type,
        style: oldEdge.style,
        markerEnd: oldEdge.markerEnd
      };
      
      // Update edges in ReactFlow
      setEdges(edges => 
        edges.map(edge => (edge.id === oldEdge.id ? updatedEdge : edge))
      );
      
      // Update Redux store
      const currentEdges = getEdges();
      const updatedEdges = currentEdges.map(edge => 
        edge.id === oldEdge.id ? updatedEdge : edge
      );
      dispatch(updateEdges(updatedEdges));
      
      console.log('Edge updated:', oldEdge.id);
    },
    [dispatch, setEdges, getEdges]
  );
  
  /**
   * Handle node click to select it
   */
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    console.log("Node clicked:", node.id);
    // Only select the node, but don't open the edit panel
    // The edit panel will only open when handleContentDoubleClick in TextNode is called
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