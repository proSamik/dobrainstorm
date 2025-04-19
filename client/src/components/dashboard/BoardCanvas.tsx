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
  NodeTypes,
  EdgeMouseHandler
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useDispatch } from 'react-redux'
import { updateNodes, updateEdges } from '@/store/boardSlice'

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
import { DebugPanel } from './board/components/DebugPanel'
import { FloatingAddButton } from './board/components/FloatingAddButton'
import { NodeCountDisplay } from './board/components/NodeCountDisplay'

// Define base node types outside component
const baseNodeTypes = {
  textNode: TextNode,
};

interface BoardCanvasProps {
  boardId: string
}

/**
 * Main canvas component for the brainstorming board
 * Orchestrates the board functionality through custom hooks
 */
const BoardCanvas = ({ boardId }: BoardCanvasProps) => {
  // Memoize nodeTypes to prevent recreation
  const nodeTypes = useMemo(() => baseNodeTypes, []);
  
  // Access Redux store
  const { storeNodes, storeEdges, editingNodeId, isDirty } = useBoardStore();
  const dispatch = useDispatch();
  
  // ReactFlow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
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
    onEdgeUpdate,
    onNodeClick
  } = useBoardHandlers();
  
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
  
  // Close context menu when clicked outside
  const handlePaneClick = useCallback(() => {
    setContextMenu(null);
  }, []);
  
  // Fit view to ensure all nodes are visible
  const handleFitView = useCallback(() => {
    if (reactFlowInstance) {
      reactFlowInstance.fitView({ padding: 0.2 });
    }
  }, [reactFlowInstance]);
  
  // Update node position after drag
  const handleNodeDragStop = useCallback((e: React.MouseEvent, node: Node) => {
    console.log("Node drag stop:", node.id, node.position);
    document.body.style.cursor = 'default';
    
    // AGGRESSIVE: Apply direct update to both React Flow and Redux store
    // 1. First update the React Flow state
    setNodes(nodes => nodes.map(n => 
      n.id === node.id 
        ? { ...n, position: { ...node.position }, dragging: false }
        : n
    ));
    
    // 2. Force update the Redux store directly
    setTimeout(() => {
      const updatedNode = { ...node, position: { ...node.position }, dragging: false };
      const updatedNodes = nodes.map(n => n.id === node.id ? updatedNode : n);
      dispatch(updateNodes(updatedNodes));
      console.log("Forcefully updated node position in Redux store:", node.id, node.position);
    }, 10);
  }, [nodes, dispatch, setNodes]);
  
  return (
    <div className="h-screen w-full flex flex-col">
      {/* Top toolbar */}
      <BoardTools
        onAddNode={createNode}
        onExport={handleExport}
        onImport={handleImportFile}
        onSave={handleSave}
      />
      
      {/* Main canvas */}
      <div className="flex-1 h-full" ref={reactFlowWrapper}>
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
          onNodeClick={onNodeClick}
          onEdgeContextMenu={handleEdgeContextMenu}
          onInit={(instance) => {
            console.log("ReactFlow initialized");
            setTimeout(() => {
              instance.fitView({ padding: 0.2 });
            }, 500);
          }}
          onNodeDragStart={() => {
            document.body.style.cursor = 'grabbing';
          }}
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
          multiSelectionKeyCode={['Control', 'Meta']}
          panOnScroll={false}
          panOnDrag={true}
          selectionOnDrag={false}
          zoomOnScroll={false}
          zoomOnPinch={true}
          preventScrolling={true}
          proOptions={{ hideAttribution: true }}
          style={{ background: '#f8fafc' }}
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
          
          {/* Floating add button */}
          <FloatingAddButton onClick={createNode} />
          
          {/* Debug panel */}
          <DebugPanel 
            nodes={nodes} 
            onFitView={handleFitView} 
            onAddNode={createNode} 
          />
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
  )
}

export default BoardCanvas 