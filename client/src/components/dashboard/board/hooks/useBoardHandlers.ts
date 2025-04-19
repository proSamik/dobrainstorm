import { useCallback, useRef } from 'react';
import { 
  Connection, 
  Edge, 
  EdgeChange, 
  Node, 
  NodeChange, 
  useReactFlow
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
    setNodes(nodes => {
      dispatch(updateNodes(nodes));
      return nodes;
    });
  }, 300);
  
  const debouncedEdgeUpdate = useDebounce(() => {
    if (!pendingEdgeUpdateRef.current) return;
    pendingEdgeUpdateRef.current = false;
    const currentEdges = getEdges();
    dispatch(updateEdges(currentEdges));
  }, 300);
  
  /**
   * Handle node changes (position, selection, etc.)
   */
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Process position changes
      const positionChanges = changes.filter(
        change => change.type === 'position' && 'position' in change
      );
      
      if (positionChanges.length > 0) {
        pendingNodeUpdateRef.current = true;
        debouncedNodeUpdate();
      }
    },
    [debouncedNodeUpdate]
  );
  
  /**
   * Handle edge changes (selection, removal, etc)
   */
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      // Check for edge removals and update the Redux store
      const removals = changes.filter(change => change.type === 'remove');
      if (removals.length > 0) {
        pendingEdgeUpdateRef.current = true;
        debouncedEdgeUpdate();
      }
    },
    [debouncedEdgeUpdate]
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
        type: 'default',
        animated: false,
        style: { strokeWidth: 2 }
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