import { useCallback } from 'react';
import { Node, useReactFlow, XYPosition } from 'reactflow';
import { addNode } from '../../../../store/boardSlice';
import { useDispatch } from 'react-redux';
import { v4 as uuidv4 } from 'uuid';

/**
 * Hook for node creation operations
 */
export const useNodeOperations = (
  reactFlowWrapper: React.RefObject<HTMLDivElement>,
  nodes: Node[]
) => {
  const dispatch = useDispatch();
  const reactFlowInstance = useReactFlow();
  
  /**
   * Create a new node at a specified position or center of the viewport
   */
  const createNode = useCallback((position?: XYPosition) => {
    const id = uuidv4();
    let nodePosition: XYPosition;
    
    if (position) {
      // Use provided position
      nodePosition = { 
        x: Number.isFinite(position.x) ? position.x : 0,
        y: Number.isFinite(position.y) ? position.y : 0
      };
    } else if (reactFlowInstance) {
      // Calculate position based on viewport center
      const viewport = reactFlowInstance.getViewport();
      const center = reactFlowInstance.screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      
      // Apply viewport zoom to offset for better positioning
      const zoomOffset = viewport.zoom > 1 ? 100 / viewport.zoom : 100;
      
      // Ensure we have valid numbers
      nodePosition = { 
        x: Number.isFinite(center.x) ? center.x + zoomOffset : 0,
        y: Number.isFinite(center.y) ? center.y + zoomOffset : 0
      };
    } else {
      // Fallback if ReactFlow isn't initialized
      nodePosition = { x: 100, y: 100 };
    }
    
    console.log("Creating new node at position:", nodePosition);
    
    // Calculate a slight offset from existing nodes to avoid exact overlaps
    const offset = nodes.length * 15;
    
    const newNode = {
      id,
      position: {
        x: nodePosition.x + offset,
        y: nodePosition.y + offset
      },
      data: {
        label: `Node ${nodes.length + 1}`,
        content: {
          text: '',
          images: []
        }
      },
      type: 'textNode',
      draggable: true
    };
    
    dispatch(addNode(newNode));
    return id;
  }, [dispatch, reactFlowInstance, nodes]);
  
  /**
   * Create a node at the position of a mouse event
   */
  const createNodeAtMousePosition = useCallback((event: React.MouseEvent) => {
    if (!reactFlowWrapper.current || !reactFlowInstance) return;
    
    const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
    const position = reactFlowInstance.screenToFlowPosition({
      x: event.clientX - reactFlowBounds.left,
      y: event.clientY - reactFlowBounds.top,
    });
    
    // Validate position values
    const safePosition = {
      x: Number.isFinite(position.x) ? position.x : 0,
      y: Number.isFinite(position.y) ? position.y : 0
    };
    
    createNode(safePosition);
  }, [reactFlowInstance, reactFlowWrapper, createNode]);
  
  return {
    createNode,
    createNodeAtMousePosition
  };
}; 