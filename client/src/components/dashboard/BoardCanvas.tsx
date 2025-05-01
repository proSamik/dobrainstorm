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
  Edge,
  useReactFlow,
  EdgeMouseHandler,
  NodeMouseHandler,
  NodeDragHandler,
  BackgroundVariant,
  ReactFlowInstance
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
import { useTheme } from '@/components/ThemeProvider'

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
  // Get theme from context
  const { theme } = useTheme();
  
  // Memoize nodeTypes to prevent recreation
  const nodeTypes = useMemo(() => baseNodeTypes, []);
  
  // Access Redux store
  const { storeNodes, storeEdges, editingNodeId, isDirty, selectedNodeIds } = useBoardStore();
  const dispatch = useDispatch();
  
  // ReactFlow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  // Define theme-aware colors
  const bgColor = useMemo(() => theme === 'light' ? '#f8fafc' : '#1a1a1a', [theme]);
  const gridColor = useMemo(() => theme === 'light' ? '#aaa' : '#555', [theme]);
  const nodeSelectedBorder = useMemo(() => theme === 'light' ? 'rgb(59, 130, 246)' : 'rgb(96, 165, 250)', [theme]);
  
  // Track current viewport size for responsive behavior
  const [isMobile, setIsMobile] = useState(false);
  
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
  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const reactFlowInstance = useReactFlow();
  
  // Helper to transform viewport coordinates to flow coordinates
  const screenToFlowPosition = useCallback((screenX: number, screenY: number) => {
    if (!reactFlowInstance) return { x: 0, y: 0 };
    return reactFlowInstance.screenToFlowPosition({ x: screenX, y: screenY });
  }, [reactFlowInstance]);
  
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
  
  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Initial check
    checkMobile();
    
    // Add event listener for window resize
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);
  
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
  
  // Handle touch events for mobile devices
  useEffect(() => {
    if (!reactFlowWrapper.current) return;
    
    const touchTimeout = 300; // Timeout to differentiate between tap and long press
    let touchTimer: NodeJS.Timeout | null = null;
    let lastTouchX = 0;
    let lastTouchY = 0;
    
    // Handle touch start
    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 1) {
        const touch = event.touches[0];
        lastTouchX = touch.clientX;
        lastTouchY = touch.clientY;
        
        // Start timer to detect long press
        touchTimer = setTimeout(() => {
          // Simulate right-click (context menu) on long press
          const element = document.elementFromPoint(lastTouchX, lastTouchY);
          const nodeElement = element?.closest('[data-id]');
          
          if (nodeElement && nodeElement instanceof HTMLElement) {
            const nodeId = nodeElement.getAttribute('data-id');
            if (nodeId) {
              // Create a synthetic mouse event for context menu
              const contextMenuEvent = new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true,
                clientX: lastTouchX,
                clientY: lastTouchY,
              });
              
              nodeElement.dispatchEvent(contextMenuEvent);
            }
          }
          
          touchTimer = null;
        }, touchTimeout);
      }
    };
    
    // Handle touch end
    const handleTouchEnd = () => {
      if (touchTimer) {
        clearTimeout(touchTimer);
        touchTimer = null;
      }
    };
    
    // Add mobile touch event listeners if on mobile
    if (isMobile) {
      const wrapperEl = reactFlowWrapper.current;
      wrapperEl.addEventListener('touchstart', handleTouchStart, { passive: true });
      wrapperEl.addEventListener('touchend', handleTouchEnd, { passive: true });
      
      return () => {
        wrapperEl.removeEventListener('touchstart', handleTouchStart);
        wrapperEl.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isMobile, reactFlowWrapper]);
  
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
  
  // Store reactFlow instance when it's initialized
  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstanceRef.current = instance;
    
    // Center the view after a small delay to ensure nodes are rendered
    setTimeout(() => {
      if (storeNodes.length > 0) {
        instance.fitView({ padding: 0.2 });
      }
    }, 200);
  }, [storeNodes.length]);
  
  // Handle node context menu
  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setContextMenu({
        id: node.id,
        x: event.clientX,
        y: event.clientY
      });
    },
    []
  );
  
  // Handle edge context menu
  const handleEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
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
  
  // Close context menu
  const handleBackgroundClick = () => {
    setContextMenu(null);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };
  
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
  
  // Render the canvas with theme-aware styling
  return (
    <div className="w-full h-full flex flex-col" data-theme={theme}>
      <BoardTools
        onAddNode={createNode}
        onExport={handleExport}
        onImport={handleImportFile}
        onSave={handleSave}
        cursorMode={cursorMode}
        onToggleCursorMode={toggleCursorMode}
      />
      
      {editingNodeId && (
        <NodeEditPanel 
          nodeId={editingNodeId}
        />
      )}
      
      <div className="flex-grow relative" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgeUpdate={onEdgeUpdate}
          onNodeClick={(_, node) => dispatch(setSelectedNode(node.id))}
          onNodeContextMenu={handleNodeContextMenu}
          onEdgeContextMenu={handleEdgeContextMenu}
          onPaneClick={handleBackgroundClick}
          nodeTypes={nodeTypes}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          minZoom={0.1}
          maxZoom={2}
          onlyRenderVisibleElements
          deleteKeyCode={['Backspace', 'Delete']}
          multiSelectionKeyCode={['Control', 'Meta']}
          selectionKeyCode={['Shift']}
          panOnDrag={isPanningMode}
          selectionOnDrag={!isPanningMode}
          panOnScroll={isPanningMode}
          zoomOnScroll={!isMobile}
          zoomOnPinch={true}
          snapToGrid={false}
          snapGrid={[15, 15]}
          connectionMode={ConnectionMode.Loose}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          onInit={onInit}
          style={{ background: bgColor }}
          className="touch-manipulation"
        >
          {/* Background with theme-aware colors */}
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color={gridColor}
            style={{ backgroundColor: bgColor }}
          />
          
          {/* Controls with theme-aware styling */}
          <Controls
            showInteractive={!isMobile}
            style={{
              border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #334155',
              borderRadius: '8px',
              backgroundColor: theme === 'light' ? 'white' : '#1e293b',
              boxShadow: theme === 'light' 
                ? '0 1px 3px rgba(0, 0, 0, 0.1)' 
                : '0 1px 3px rgba(0, 0, 0, 0.5)',
            }}
            position={isMobile ? 'bottom-right' : 'bottom-left'}
            showZoom={true}
            showFitView={true}
          />
          
          {/* Minimap with theme-aware styling */}
          {!isMobile && (
            <MiniMap
              nodeStrokeWidth={3}
              nodeColor={(node) => {
                if (selectedNodeIds.includes(node.id)) {
                  return nodeSelectedBorder;
                }
                return theme === 'light' ? '#e2e8f0' : '#475569';
              }}
              nodeBorderRadius={4}
              style={{
                backgroundColor: theme === 'light' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(30, 41, 59, 0.9)',
                border: theme === 'light' ? '1px solid #e2e8f0' : '1px solid #334155',
                borderRadius: '8px',
                boxShadow: theme === 'light' 
                  ? '0 1px 3px rgba(0, 0, 0, 0.1)' 
                  : '0 1px 3px rgba(0, 0, 0, 0.5)',
              }}
            />
          )}
          
          {/* Node count display */}
          <NodeCountDisplay count={nodes.length} />
        </ReactFlow>
        
        {/* Render the context menu if needed */}
        {contextMenu && (
          <NodeContextMenu
            nodeId={contextMenu.id}
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
          />
        )}
      </div>
    </div>
  );
};

export default BoardCanvas; 