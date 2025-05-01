import { useCallback } from 'react';
import { Node, useReactFlow } from 'reactflow';
import { useBoardStore } from './useBoardStore';

/**
 * Hook for node operations like creation, positioning, and selection
 */
export const useNodeOperations = (
  reactFlowWrapper: React.RefObject<HTMLDivElement | null>,
  nodes: Node[]
) => {
  const { addNodeToBoard, selectNode } = useBoardStore();
  const reactFlowInstance = useReactFlow();

  /**
   * Create a node at the specified position or in viewport center
   * with smooth animation for a better user experience
   */
  const createNode = useCallback((position?: { x: number, y: number }, autoSelect = true) => {
    if (!reactFlowInstance) {
      console.error("ReactFlow instance not available");
      return;
    }
    
    // If no position provided, use the viewport center
    const viewportCenter = position || reactFlowInstance.screenToFlowPosition({
      x: reactFlowWrapper.current?.clientWidth ? reactFlowWrapper.current.clientWidth / 2 : 250,
      y: reactFlowWrapper.current?.clientHeight ? reactFlowWrapper.current.clientHeight / 2 : 150,
    });
    
    // Add a small offset based on the number of existing nodes to prevent overlapping
    const offset = nodes.length * 10;
    
    const newNodeId = `node-${Date.now()}`;
    
    // Create the new node with offset to prevent overlapping
    // Add smooth transition style for better UX
    const newNode: Node = {
      id: newNodeId,
      type: 'textNode',
      position: {
        x: viewportCenter.x + offset,
        y: viewportCenter.y + offset
      },
      data: {
        label: 'New Idea',
        content: {
          text: '',
          images: []
        }
      },
      style: {
        opacity: 0,
        transform: 'scale(0.8)',
        transition: 'all 0.3s ease-in-out',
      },
      draggable: true
    };
    
    // Add the node to the Redux store
    addNodeToBoard(newNode);
    
    // Add a small delay to apply fade-in animation
    setTimeout(() => {
      if (reactFlowInstance) {
        // Update the node style to fade in
        const updatedNodes = reactFlowInstance.getNodes().map(node => {
          if (node.id === newNodeId) {
            return {
              ...node,
              style: {
                ...node.style,
                opacity: 1,
                transform: 'scale(1)',
              }
            };
          }
          return node;
        });
        
        reactFlowInstance.setNodes(updatedNodes);
      }
    }, 10);
    
    // Force a fit view update to ensure the new node is visible
    setTimeout(() => {
      if (reactFlowInstance) {
        reactFlowInstance.fitView({ padding: 0.2, duration: 500 });
      }
      
      // Select the node for editing if autoSelect is true
      if (autoSelect) {
        selectNode(newNodeId);
      }
    }, 300);

    return newNodeId;
  }, [addNodeToBoard, selectNode, reactFlowInstance, reactFlowWrapper, nodes.length]);

  /**
   * Create a node at the position where the user right-clicked
   * with smooth animation effects
   */
  const createNodeAtMousePosition = useCallback((event: React.MouseEvent) => {
    if (!reactFlowWrapper.current || !reactFlowInstance) {
      console.error("ReactFlow instance not available for right-click");
      return;
    }
    
    // Get the position where the user clicked relative to the flow canvas
    const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
    const position = reactFlowInstance.screenToFlowPosition({
      x: event.clientX - reactFlowBounds.left,
      y: event.clientY - reactFlowBounds.top,
    });
    
    const newNodeId = `node-${Date.now()}`;
    
    // Create the new node object with initial invisible state for animation
    const newNode: Node = {
      id: newNodeId,
      type: 'textNode',
      position,
      data: {
        label: 'New Idea',
        content: {
          text: '',
          images: []
        }
      },
      style: {
        opacity: 0,
        transform: 'scale(0.8)',
        transition: 'all 0.3s ease-in-out',
      },
      draggable: true,
    };
    
    // Add directly to ReactFlow state first for immediate rendering
    reactFlowInstance.addNodes(newNode);
    
    // Then also dispatch to Redux store to ensure persistence
    addNodeToBoard(newNode);
    
    // Add a small delay to apply fade-in animation
    setTimeout(() => {
      // Update the node style to fade in
      const updatedNodes = reactFlowInstance.getNodes().map(node => {
        if (node.id === newNodeId) {
          return {
            ...node,
            style: {
              ...node.style,
              opacity: 1,
              transform: 'scale(1)',
            }
          };
        }
        return node;
      });
      
      reactFlowInstance.setNodes(updatedNodes);
    }, 10);
    
    // Select the newly created node for editing
    setTimeout(() => {
      selectNode(newNodeId);
    }, 300);

    return newNodeId;
  }, [addNodeToBoard, selectNode, reactFlowInstance, reactFlowWrapper]);

  return {
    createNode,
    createNodeAtMousePosition
  };
};