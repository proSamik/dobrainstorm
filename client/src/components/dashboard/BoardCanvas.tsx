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
  const { createNode } = useNodeOperations(reactFlowWrapper, nodes);
  
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