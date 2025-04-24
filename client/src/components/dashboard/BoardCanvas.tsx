'use client'

import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ConnectionMode,
  useNodesState,
  useEdgesState,
  Node,
  useReactFlow,
  EdgeMouseHandler,
  NodeMouseHandler,
  NodeDragHandler
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useDispatch } from 'react-redux'
import { updateNodes, updateEdges, setSelectedNode, setSelectedNodes } from '@/store/boardSlice'

// Import node types
import TextNode from './nodes/TextNode'

// Import contexts
import { useBoardStore } from './board/hooks/useBoardStore'

// Import hooks
import { useBoardHandlers } from './board/hooks/useBoardHandlers'
import { useNodeOperations } from './board/hooks/useNodeOperations'
import { useBoardInitialization } from './board/hooks/useBoardInitialization'
import { useBoardSync } from './board/hooks/useBoardSync'
import { useFileOperations } from './board/hooks/useFileOperations'
import { useKeyboardShortcuts } from './board/hooks/useKeyboardShortcuts'

// Import components
import NodeEditPanel from './NodeEditPanel'
import NodeContextMenu from './NodeContextMenu'
import { BoardTools } from './board/components/BoardTools'
// import { DebugPanel } from './board/components/DebugPanel'
import { NodeCountDisplay } from './board/components/NodeCountDisplay'

// Define base node types outside component
const baseNodeTypes = {
  textNode: TextNode,
};

interface BoardCanvasProps {
  boardId: string
}

// Interface for selection box
interface SelectionBox {
  startX: number
  startY: number
  currentX: number
  currentY: number
  isActive: boolean
}

/**
 * Main canvas component for the brainstorming board
 * Orchestrates the board functionality through custom hooks
 */
const BoardCanvas = ({ boardId }: BoardCanvasProps) => {
  // Memoize nodeTypes to prevent recreation
  const nodeTypes = useMemo(() => baseNodeTypes, []);
  
  // Access Redux store
  const { storeNodes, storeEdges, editingNodeId, isDirty, selectedNodeIds } = useBoardStore();
  const dispatch = useDispatch();
  
  // ReactFlow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  // Selection box state
  const [selectionBox, setSelectionBox] = useState<SelectionBox>({
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    isActive: false
  });
  
  // State to track if we're in multi-selection mode
  const [isMultiSelectionDrag, setIsMultiSelectionDrag] = useState(false);
  
  // Track start positions of nodes for multi-drag
  const nodesStartPositionRef = useRef<Record<string, { x: number, y: number }>>({});
  
  // Reference for tracking mouse selection
  const selectionStartPosRef = useRef<{ x: number, y: number } | null>(null);
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    id: string
    x: number
    y: number
    isEdge?: boolean
  } | null>(null);
  
  // DOM references
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useReactFlow();
  
  // Initialize board
  useBoardInitialization(boardId);
  
  // Sync board state between Redux and ReactFlow
  useBoardSync(storeNodes, storeEdges, nodes, edges, setNodes, setEdges);
  
  // Register keyboard shortcuts
  useKeyboardShortcuts();
  
  // File operations (save, export, import)
  const { handleSave, handleExport, handleImportFile } = useFileOperations(boardId);
  
  // Node operations
  const { createNode, createNodeAtMousePosition } = useNodeOperations(reactFlowWrapper, nodes);
  
  // Board event handlers
  const { 
    onConnect, 
    onEdgeUpdate
  } = useBoardHandlers();
  
  // Add state to track if Cmd/Ctrl is pressed for panning the canvas
  const [isPanningMode, setIsPanningMode] = useState(false);
  
  // Add state to track the cursor mode (grab or pointer)
  const [cursorMode, setCursorMode] = useState<'grab' | 'pointer'>('grab');
  
  // Listen for modifier key presses to toggle panning mode
  useEffect(() => {
    // Add a CSS rule to set the default cursor for the ReactFlow pane
    const style = document.createElement('style');
    style.textContent = `
      .react-flow__pane {
        cursor: ${cursorMode === 'grab' ? 'grab' : 'default'} !important;
      }
      body.panning .react-flow__pane {
        cursor: grab !important;
      }
      body.selecting .react-flow__pane {
        cursor: crosshair !important;
      }
    `;
    document.head.appendChild(style);

    const handleKeyDown = (e: KeyboardEvent) => {
      // In grab mode, we use Cmd/Ctrl to temporarily switch to pointer mode
      // In pointer mode, we use Cmd/Ctrl to temporarily switch to grab/pan mode
      if (e.metaKey || e.ctrlKey) {
        setIsPanningMode(cursorMode === 'pointer');
        document.body.classList.toggle('panning', cursorMode === 'pointer');
        document.body.style.cursor = cursorMode === 'pointer' ? 'grab' : 'default';
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Exit temporary mode when Cmd/Ctrl is released
      if (e.key === 'Meta' || e.key === 'Control') {
        setIsPanningMode(cursorMode === 'grab');
        document.body.classList.toggle('panning', cursorMode === 'grab');
        document.body.style.cursor = cursorMode === 'grab' ? 'grab' : 'default';
      }
    };

    // Initialize the correct cursor mode on load
    setIsPanningMode(cursorMode === 'grab');
    document.body.classList.toggle('panning', cursorMode === 'grab');
    document.body.style.cursor = cursorMode === 'grab' ? 'grab' : 'default';

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      document.body.classList.remove('panning');
      document.body.classList.remove('selecting');
      document.head.removeChild(style);
      // Reset cursor when component unmounts
      document.body.style.cursor = 'default';
    };
  }, [cursorMode]);
  
  // Toggle between cursor modes
  const toggleCursorMode = useCallback(() => {
    const newMode = cursorMode === 'grab' ? 'pointer' : 'grab';
    setCursorMode(newMode);
    // Update panning mode based on the new cursor mode
    setIsPanningMode(newMode === 'grab');
    document.body.classList.toggle('panning', newMode === 'grab');
    document.body.style.cursor = newMode === 'grab' ? 'grab' : 'default';
  }, [cursorMode]);
  
  // Force create a demo node if the board is still empty after a timeout
  useEffect(() => {
    if (storeNodes.length === 0) {
      const timer = setTimeout(() => {
        console.log("Board still empty after timeout, forcing demo node creation");
        createNode();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [storeNodes.length, createNode]);
  
  // Save the board when user navigates away or closes the window
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Check if there are unsaved changes
      if (isDirty) {
        // Standard way to show confirmation dialog
        const confirmationMessage = 'You have unsaved changes. Are you sure you want to leave?';
        e.preventDefault();
        e.returnValue = confirmationMessage;
        
        // Attempt to save before leaving
        handleSave();
        
        return confirmationMessage;
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [handleSave, isDirty]);
  
  // Handle node context menu
  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setContextMenu({
        id: node.id,
        x: event.clientX,
        y: event.clientY,
      });
    },
    []
  );
  
  // Handle edge context menu
  const handleEdgeContextMenu: EdgeMouseHandler = useCallback(
    (event, edge) => {
      event.preventDefault();
      setContextMenu({
        id: edge.id,
        x: event.clientX,
        y: event.clientY,
        isEdge: true
      });
    },
    []
  );
  
  // Helper to transform viewport coordinates to flow coordinates
  const screenToFlowPosition = useCallback((screenX: number, screenY: number) => {
    if (!reactFlowInstance) return { x: 0, y: 0 };
    return reactFlowInstance.screenToFlowPosition({ x: screenX, y: screenY });
  }, [reactFlowInstance]);
  
  // Start multi-selection with a box
  const handleSelectionStart = useCallback((event: React.MouseEvent) => {
    // Only start selection if we're clicking on the pane (not a node)
    if ((event.target as HTMLElement).classList.contains('react-flow__pane')) {
      // Don't start selection if right button
      if (event.button !== 0) return;
      
      // If in panning mode (Cmd/Ctrl held), don't start selection
      if (isPanningMode) return;
      
      // Set cursor to crosshair during selection
      document.body.classList.add('selecting');
      document.body.style.cursor = 'crosshair';
      
      // Get the position in flow coordinates
      const flowPos = screenToFlowPosition(event.clientX, event.clientY);
      selectionStartPosRef.current = flowPos;
      
      setSelectionBox({
        startX: flowPos.x,
        startY: flowPos.y,
        currentX: flowPos.x,
        currentY: flowPos.y,
        isActive: true
      });
      
      // Prevent default behavior
      event.preventDefault();
    }
  }, [screenToFlowPosition, isPanningMode]);
  
  // Update selection box as mouse moves
  const handleSelectionMove = useCallback((event: React.MouseEvent) => {
    if (selectionBox.isActive) {
      // Ensure cursor remains crosshair during selection
      document.body.style.cursor = 'crosshair';
      
      // Get current position in flow coordinates
      const flowPos = screenToFlowPosition(event.clientX, event.clientY);
      
      setSelectionBox(prev => ({
        ...prev,
        currentX: flowPos.x,
        currentY: flowPos.y
      }));
      
      // Preview selection highlights can be implemented here if needed
    }
  }, [selectionBox.isActive, screenToFlowPosition]);
  
  // End selection process
  const handleSelectionEnd = useCallback((event: React.MouseEvent) => {
    if (selectionBox.isActive) {
      // Reset cursor style based on panning mode
      document.body.classList.remove('selecting');
      document.body.style.cursor = isPanningMode ? 'grab' : 'default';
      
      // Calculate selection box dimensions
      const selectionRect = {
        left: Math.min(selectionBox.startX, selectionBox.currentX),
        top: Math.min(selectionBox.startY, selectionBox.currentY),
        right: Math.max(selectionBox.startX, selectionBox.currentX),
        bottom: Math.max(selectionBox.startY, selectionBox.currentY)
      };
      
      // Find nodes inside the selection box
      const nodesInSelection = nodes.filter(node => {
        const nodeLeft = node.position.x;
        const nodeTop = node.position.y;
        const nodeRight = node.position.x + (node.width || 150);
        const nodeBottom = node.position.y + (node.height || 50);
        
        return (
          nodeLeft < selectionRect.right &&
          nodeRight > selectionRect.left &&
          nodeTop < selectionRect.bottom &&
          nodeBottom > selectionRect.top
        );
      }).map(node => node.id);
      
      // Update selected nodes based on selection behavior
      if (nodesInSelection.length > 0) {
        if (event.shiftKey) {
          // If shift is pressed, toggle selection state of the nodes in selection
          const newSelectedIds = [...selectedNodeIds];
          nodesInSelection.forEach(nodeId => {
            const index = newSelectedIds.indexOf(nodeId);
            if (index !== -1) {
              // Remove if already selected
              newSelectedIds.splice(index, 1);
            } else {
              // Add if not selected
              newSelectedIds.push(nodeId);
            }
          });
          dispatch(setSelectedNodes(newSelectedIds));
        } else {
          // Normal selection replaces current selection with new selection
          dispatch(setSelectedNodes(nodesInSelection));
        }
      }
      
      selectionStartPosRef.current = null;
      
      setSelectionBox(prev => ({
        ...prev,
        isActive: false
      }));
    }
  }, [selectionBox.isActive, selectionBox.startX, selectionBox.startY, selectionBox.currentX, selectionBox.currentY, nodes, dispatch, selectedNodeIds, isPanningMode]);
  
  // Update node position after drag
  const handleNodeDragStart: NodeDragHandler = useCallback((event, node) => {
    document.body.style.cursor = 'grabbing';
    
    // Check if this node is in the selected nodes
    const isSelected = selectedNodeIds.includes(node.id);
    
    // If this node is not already selected, make it the only selected node
    if (!isSelected) {
      // Only select this node if not holding shift/ctrl/meta for multi-select
      if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
        dispatch(setSelectedNode(node.id));
      }
    }
    
    // Store original positions of all selected nodes
    if (selectedNodeIds.length > 0) {
      const positions: Record<string, { x: number, y: number }> = {};
      nodes.forEach(n => {
        if (selectedNodeIds.includes(n.id)) {
          positions[n.id] = { ...n.position };
        }
      });
      nodesStartPositionRef.current = positions;
      
      // Set flag that we're dragging multiple nodes
      setIsMultiSelectionDrag(selectedNodeIds.length > 1);
    }
  }, [nodes, selectedNodeIds, dispatch]);
  
  const handleNodeDrag: NodeDragHandler = useCallback((event, node) => {
    // If we're dragging multiple nodes, update all selected nodes
    if (isMultiSelectionDrag && selectedNodeIds.includes(node.id)) {
      // Calculate the delta from the start position
      const startPos = nodesStartPositionRef.current[node.id];
      if (!startPos) return;
      
      const deltaX = node.position.x - startPos.x;
      const deltaY = node.position.y - startPos.y;
      
      // Update all selected nodes with the same delta
      const updatedNodes = nodes.map(n => {
        if (n.id !== node.id && selectedNodeIds.includes(n.id)) {
          const startPos = nodesStartPositionRef.current[n.id];
          if (!startPos) return n;
          
          return {
            ...n,
            position: {
              x: startPos.x + deltaX,
              y: startPos.y + deltaY
            }
          };
        }
        return n;
      });
      
      setNodes(updatedNodes);
    }
  }, [isMultiSelectionDrag, selectedNodeIds, nodes, setNodes]);
  
  const handleNodeDragStop: NodeDragHandler = useCallback((event, node) => {
    document.body.style.cursor = 'default';
    
    // Reset multi-drag flag
    setIsMultiSelectionDrag(false);
    
    // If we were dragging multiple nodes, update their positions in the store
    if (selectedNodeIds.length > 1 && selectedNodeIds.includes(node.id)) {
      // Force update the Redux store directly with all nodes
      dispatch(updateNodes(nodes));
      console.log("Updated multiple node positions in Redux store");
    } else {
      // Single node update, same as before
      setNodes(nodes => nodes.map(n => 
        n.id === node.id 
          ? { ...n, position: { ...node.position }, dragging: false }
          : n
      ));
      
      // Force update the Redux store directly
      setTimeout(() => {
        const updatedNode = { ...node, position: { ...node.position }, dragging: false };
        const updatedNodes = nodes.map(n => n.id === node.id ? updatedNode : n);
        dispatch(updateNodes(updatedNodes));
      }, 10);
    }
  }, [nodes, selectedNodeIds, dispatch, setNodes]);
  
  // Handle node click with multi-selection support
  const handleNodeClick: NodeMouseHandler = useCallback((event, node) => {
    console.log("Node clicked:", node.id);
    
    // If Cmd/Ctrl is held for panning, don't change selection
    if (isPanningMode) {
      event.stopPropagation();
      return;
    }
    
    if (event.shiftKey) {
      // Shift click toggles this node's selection
      const isSelected = selectedNodeIds.includes(node.id);
      
      if (isSelected) {
        // Deselect the node
        const newSelectedIds = selectedNodeIds.filter(id => id !== node.id);
        dispatch(setSelectedNodes(newSelectedIds));
      } else {
        // Add the node to selection
        const newSelectedIds = [...selectedNodeIds, node.id];
        dispatch(setSelectedNodes(newSelectedIds));
      }
    } else {
      // Regular click - select only this node
      dispatch(setSelectedNode(node.id));
    }
    
    // Prevent selection box from activating
    event.stopPropagation();
  }, [selectedNodeIds, dispatch, isPanningMode]);
  
  // Handle deletion of multiple nodes
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Delete selected nodes on Delete or Backspace
      if (
        (event.key === 'Delete' || event.key === 'Backspace') && 
        selectedNodeIds.length > 0 &&
        !editingNodeId // Don't delete when editing a node
      ) {
        // If we have multiple nodes selected, remove them all
        if (selectedNodeIds.length > 1) {
          // Remove nodes from React Flow state
          const remainingNodes = nodes.filter(node => !selectedNodeIds.includes(node.id));
          setNodes(remainingNodes);
          
          // Remove connected edges
          const remainingEdges = edges.filter(
            edge => !selectedNodeIds.includes(edge.source) && !selectedNodeIds.includes(edge.target)
          );
          setEdges(remainingEdges);
          
          // Update Redux store
          dispatch(updateNodes(remainingNodes));
          dispatch(updateEdges(remainingEdges));
          dispatch(setSelectedNodes([]));
        } else if (selectedNodeIds.length === 1) {
          // Just handle single node deletion through normal flow
          const nodeId = selectedNodeIds[0];
          
          // Remove the node from ReactFlow
          const remainingNodes = nodes.filter(node => node.id !== nodeId);
          setNodes(remainingNodes);
          
          // Remove connected edges
          const remainingEdges = edges.filter(
            edge => edge.source !== nodeId && edge.target !== nodeId
          );
          setEdges(remainingEdges);
          
          // Update Redux store
          dispatch(updateNodes(remainingNodes));
          dispatch(updateEdges(remainingEdges));
          dispatch(setSelectedNode(null));
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [nodes, edges, selectedNodeIds, editingNodeId, dispatch, setNodes, setEdges]);
  
  // Close context menu when clicked outside
  const handlePaneClick = useCallback((event: React.MouseEvent) => {
    // Close context menu
    setContextMenu(null);
    
    // Clear selection when clicking on the pane, unless shift is held or we're in a selection
    if (
      !event.shiftKey && 
      !selectionBox.isActive &&
      !isPanningMode // Don't clear selection in panning mode
    ) {
      dispatch(setSelectedNodes([]));
    }
  }, [dispatch, selectionBox.isActive, isPanningMode]);
  
  // // Fit view to ensure all nodes are visible
  // const handleFitView = useCallback(() => {
  //   if (reactFlowInstance) {
  //     reactFlowInstance.fitView({ padding: 0.2 });
  //   }
  // }, [reactFlowInstance]);
  
  return (
    <div className="h-[90vh] w-full flex flex-col">
      {/* Top toolbar */}
      <BoardTools
        onAddNode={createNode}
        onExport={handleExport}
        onImport={handleImportFile}
        onSave={handleSave}
        cursorMode={cursorMode}
        onToggleCursorMode={toggleCursorMode}
      />
      
      {/* Main canvas */}
      <div 
        className={`flex-1 h-full ${isPanningMode ? 'cursor-grab' : 'cursor-default'}`}
        ref={reactFlowWrapper}
        onMouseDown={handleSelectionStart}
        onMouseMove={handleSelectionMove}
        onMouseUp={handleSelectionEnd}
        onMouseLeave={handleSelectionEnd}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgeUpdate={onEdgeUpdate}
          onPaneClick={handlePaneClick}
          onPaneContextMenu={createNodeAtMousePosition}
          onNodeContextMenu={handleNodeContextMenu}
          onNodeClick={handleNodeClick}
          onEdgeContextMenu={handleEdgeContextMenu}
          onInit={(instance) => {
            console.log("ReactFlow initialized");
            setTimeout(() => {
              instance.fitView({ padding: 0.2 });
            }, 500);
          }}
          onNodeDragStart={handleNodeDragStart}
          onNodeDrag={handleNodeDrag}
          onNodeDragStop={handleNodeDragStop}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Strict}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          minZoom={0.1}
          maxZoom={2}
          fitView={true}
          fitViewOptions={{ padding: 0.2 }}
          snapToGrid={false}
          snapGrid={[15, 15]}
          nodesDraggable={true}
          draggable={true}
          nodesConnectable={true}
          elementsSelectable={true}
          noDragClassName="no-drag"
          deleteKeyCode={['Delete', 'Backspace']}
          multiSelectionKeyCode={[]} // Remove modifier key requirement for multi-selection
          panOnScroll={false}
          panOnDrag={isPanningMode} // Only enable panning when in panning mode
          selectionOnDrag={!isPanningMode} // Only enable selection when not in panning mode
          zoomOnScroll={false}
          zoomOnPinch={true}
          preventScrolling={true}
          proOptions={{ hideAttribution: true }}
          style={{ 
            background: '#f8fafc',
            cursor: isPanningMode ? 'grab' : 'default'
          }}
        >
          <Background color="#aaa" gap={16} />
          <Controls showInteractive={true} />
          <MiniMap 
            nodeStrokeWidth={3}
            zoomable 
            pannable
          />
          
          {/* Node count display */}
          <NodeCountDisplay count={nodes.length} />
          
          {/* Debug panel
          <DebugPanel 
            nodes={nodes} 
            onFitView={handleFitView} 
            onAddNode={createNode} 
          /> */}
          
          {/* Selection Box Overlay */}
          {selectionBox.isActive && (
            <div
              className="absolute border-2 border-blue-500 bg-blue-100 bg-opacity-20 pointer-events-none z-10"
              style={{
                position: 'absolute',
                left: Math.min(selectionBox.startX, selectionBox.currentX),
                top: Math.min(selectionBox.startY, selectionBox.currentY),
                width: Math.abs(selectionBox.currentX - selectionBox.startX),
                height: Math.abs(selectionBox.currentY - selectionBox.startY),
                zIndex: 10,
              }}
            />
          )}
        </ReactFlow>
      </div>
      
      {/* Context menu */}
      {contextMenu && (
        contextMenu.isEdge ? (
          <div
            className="fixed bg-white shadow-lg rounded-md py-2 px-0 min-w-40 z-50"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
            }}
          >
            <button
              className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center text-red-600"
              onClick={() => {
                // Delete the edge
                const currentEdges = reactFlowInstance.getEdges();
                const updatedEdges = currentEdges.filter(edge => edge.id !== contextMenu.id);
                
                // Update in ReactFlow
                setEdges(updatedEdges);
                
                // Update in Redux
                dispatch(updateEdges(updatedEdges));
                
                // Close context menu
                setContextMenu(null);
              }}
            >
              <span className="mr-2">🗑️</span>
              Delete Connection
            </button>
          </div>
        ) : (
          <NodeContextMenu
            nodeId={contextMenu.id}
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
          />
        )
      )}
      
      {/* Node edit panel - only show when a node is explicitly being edited */}
      {editingNodeId && (
        <NodeEditPanel nodeId={editingNodeId} />
      )}
    </div>
  );
};

export default BoardCanvas; 