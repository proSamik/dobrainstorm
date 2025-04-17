'use client'

import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  ConnectionMode,
  useNodesState,
  useEdgesState,
  addEdge,
  NodeChange,
  EdgeChange,
  Connection,
  MarkerType,
  Panel,
  useReactFlow,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '@/store'
import {
  setBoard,
  updateNodes,
  updateEdges,
  addNode,
  removeNode,
  markAsSaved,
  undo,
  redo,
  updateBoardName,
  NodeContent,
  setSelectedNode
} from '@/store/boardSlice'
import NodeContextMenu from './NodeContextMenu'
import NodeEditPanel from './NodeEditPanel'
import TextNode from './nodes/TextNode'
import { useRouter } from 'next/navigation'

// Simple debounce utility
const useDebounce = (fn: Function, delay: number) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  return useCallback((...args: any[]) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      fn(...args);
    }, delay);
  }, [fn, delay]);
};

// Define custom node types OUTSIDE of the component to prevent recreation on each render
// Use useMemo to ensure this doesn't change across renders
const nodeTypes = {
  textNode: TextNode,
}

interface BoardCanvasProps {
  boardId: string
}

/**
 * Main canvas component for the brainstorming board
 * Handles node and edge management, interactions, and rendering
 */
const BoardCanvas = ({ boardId }: BoardCanvasProps) => {
  const dispatch = useDispatch()
  const router = useRouter()
  const { 
    nodes: storeNodes, 
    edges: storeEdges, 
    boardName,
    isDirty,
    selectedNodeId
  } = useSelector((state: RootState) => state.board)
  
  // Memoize node types to prevent recreation
  const memoizedNodeTypes = useMemo(() => nodeTypes, []);
  
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  
  const [contextMenu, setContextMenu] = useState<{
    id: string
    x: number
    y: number
  } | null>(null)
  
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const reactFlow = useReactFlow()
  const [reactFlowInstance, setReactFlowInstance] = useState<ReturnType<typeof useReactFlow> | null>(null)
  const [pendingNodeUpdate, setPendingNodeUpdate] = useState(false)
  const [pendingEdgeUpdate, setPendingEdgeUpdate] = useState(false)
  const nodesRef = useRef<Node[]>([])
  const edgesRef = useRef<Edge[]>([])
  
  // Import file reference
  const importInputRef = useRef<HTMLInputElement>(null)
  
  // Debug log to track component lifecycle
  useEffect(() => {
    console.log('BoardCanvas mounted with boardId:', boardId);
    console.log('Initial store nodes:', storeNodes.length);
    
    // Cleanup function
    return () => {
      console.log('BoardCanvas unmounting');
    };
  }, []);
  
  // Initialize the board from Redux state or load from API
  useEffect(() => {
    const initializeBoard = async () => {
      try {
        console.log('Initializing board with ID:', boardId);
        console.log('Current store nodes length:', storeNodes.length);
        
        // TODO: Replace with actual API call when the backend is ready
        // For now we'll set up a demo board
        if (storeNodes.length === 0) {
          console.log('Creating initial demo board');
          // If Redux store is empty, set up a new board
          const initialNodes: Node[] = [
            {
              id: '1',
              type: 'textNode',
              position: { x: 250, y: 150 },
              data: { 
                label: 'Main Idea',
                content: {
                  text: 'Start your brainstorming here',
                  images: []
                }
              },
            },
          ]
          
          const initialEdges: Edge[] = []
          
          dispatch(setBoard({
            nodes: initialNodes,
            edges: initialEdges,
            boardName: 'New Brainstorm',
            boardId
          }))
          
          console.log('Demo board created with nodes:', initialNodes.length);
        }
      } catch (error) {
        console.error('Failed to initialize board:', error)
      }
    }
    
    initializeBoard()
  }, [boardId, dispatch, storeNodes.length])
  
  // Sync Redux state with React Flow state - only when storeNodes/storeEdges change
  useEffect(() => {
    console.log('Syncing store nodes to ReactFlow, count:', storeNodes.length);
    
    // Use a more robust way to check for changes - stringify with a replacer function
    // to handle potential circular references
    const nodesEqual = (a: Node[], b: Node[]) => {
      if (a.length !== b.length) return false;
      
      // Compare only essential properties that affect rendering
      const simplifyNode = (node: Node) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data,
      });
      
      const aSimple = a.map(simplifyNode);
      const bSimple = b.map(simplifyNode);
      
      return JSON.stringify(aSimple) === JSON.stringify(bSimple);
    };
    
    const edgesEqual = (a: Edge[], b: Edge[]) => {
      if (a.length !== b.length) return false;
      
      // Compare only essential properties
      const simplifyEdge = (edge: Edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type,
      });
      
      const aSimple = a.map(simplifyEdge);
      const bSimple = b.map(simplifyEdge);
      
      return JSON.stringify(aSimple) === JSON.stringify(bSimple);
    };
    
    // Check if we actually need to update
    const nodesChanged = !nodesEqual(storeNodes, nodes);
    const edgesChanged = !edgesEqual(storeEdges, edges);
    
    if (nodesChanged) {
      console.log('Nodes changed, updating ReactFlow nodes');
      setNodes(storeNodes);
    }
    
    if (edgesChanged) {
      console.log('Edges changed, updating ReactFlow edges');
      setEdges(storeEdges);
    }
  }, [storeNodes, storeEdges, setNodes, setEdges, nodes, edges]);
  
  // Update Redux store when there are pending node updates
  useEffect(() => {
    if (pendingNodeUpdate) {
      dispatch(updateNodes([...nodesRef.current]))
      setPendingNodeUpdate(false)
    }
  }, [dispatch, pendingNodeUpdate])
  
  // Create debounced version of node/edge updates to reduce Redux updates
  const debouncedSetPendingNodeUpdate = useDebounce(() => {
    setPendingNodeUpdate(true);
  }, 300); // 300ms debounce

  const debouncedSetPendingEdgeUpdate = useDebounce(() => {
    setPendingEdgeUpdate(true);
  }, 300); // 300ms debounce

  // Update Redux store when there are pending edge updates
  useEffect(() => {
    if (pendingEdgeUpdate) {
      dispatch(updateEdges([...edgesRef.current]))
      setPendingEdgeUpdate(false)
    }
  }, [dispatch, pendingEdgeUpdate])
  
  // Save the board when user navigates away or closes the window
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
        return e.returnValue
      }
    }
    
    const saveBeforeLeave = () => {
      if (isDirty) {
        handleSave()
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('blur', saveBeforeLeave)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('blur', saveBeforeLeave)
    }
  }, [isDirty])
  
  // Set up keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo: Cmd+Z (Mac) or Ctrl+Z (Windows)
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        dispatch(undo())
      }
      
      // Redo: Cmd+Shift+Z or Cmd+Y (Mac) or Ctrl+Shift+Z or Ctrl+Y (Windows)
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        dispatch(redo())
      }
      
      // Delete node: Delete or Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId) {
        e.preventDefault()
        dispatch(removeNode(selectedNodeId))
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [dispatch, selectedNodeId])
  
  // Handle node changes
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      console.log("Node changes:", changes);
      
      // IMPORTANT: First apply changes directly to ReactFlow's internal state
      // This is critical for dragging to work correctly
      onNodesChange(changes);
      
      // Create a copy of the current nodes to directly update with position changes
      const updatedNodes = [...nodes];
      
      // Process position changes
      changes.forEach(change => {
        if (change.type === 'position' && 'position' in change && !change.dragging) {
          // This is a final position update after dragging stops
          console.log(`Node ${change.id} final position update:`, change.position);
          
          // Find this node in our list and update its position
          const nodeIndex = updatedNodes.findIndex(n => n.id === change.id);
          if (nodeIndex >= 0 && change.position) {
            updatedNodes[nodeIndex] = {
              ...updatedNodes[nodeIndex],
              position: change.position
            };
          }
        }
      });
      
      // Only update the Redux store when there are complete position changes (not during dragging)
      const hasFinalPositionChange = changes.some(
        change => change.type === 'position' && 'position' in change && !change.dragging
      );
      
      if (hasFinalPositionChange) {
        // Only update the Redux store after dragging is complete
        console.log("Saving final node positions to Redux store");
        nodesRef.current = updatedNodes;
        debouncedSetPendingNodeUpdate();
      }
    },
    [nodes, onNodesChange, debouncedSetPendingNodeUpdate]
  );
  
  // Handle edge changes
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes)
      // Use a ref to store current edges instead of setState in render
      edgesRef.current = [...edges];
      debouncedSetPendingEdgeUpdate();
    },
    [edges, onEdgesChange, debouncedSetPendingEdgeUpdate]
  )
  
  // Handle edge updates (replace deprecated updateEdge with modern approach)
  const handleEdgeUpdate = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      setEdges(els => {
        // Remove the old edge
        const newEdges = els.filter(e => e.id !== oldEdge.id);
        
        // Create the new edge with the same id to preserve any custom data
        const updatedEdge: Edge = {
          ...oldEdge,
          source: newConnection.source || oldEdge.source,
          target: newConnection.target || oldEdge.target,
          sourceHandle: newConnection.sourceHandle,
          targetHandle: newConnection.targetHandle
        };
        
        // Add the updated edge
        newEdges.push(updatedEdge);
        
        edgesRef.current = newEdges;
        debouncedSetPendingEdgeUpdate();
        return newEdges;
      });
    },
    [setEdges, debouncedSetPendingEdgeUpdate]
  );
  
  // Handle connecting two nodes
  const handleConnect = useCallback(
    (connection: Connection) => {
      // Create a new edge with a unique ID
      const newEdge = {
        ...connection,
        id: `edge-${Date.now()}`,
        // Use arrow marker for parent-child relationship visual
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
        // Add some styling for the parent-child relationship
        style: { strokeWidth: 2 },
        // Add data to represent parent-child relationship
        data: { 
          relationship: 'parent-child' 
        }
      }
      
      setEdges(eds => {
        const newEdges = addEdge(newEdge, eds);
        edgesRef.current = newEdges;
        debouncedSetPendingEdgeUpdate();
        return newEdges;
      });
    },
    [setEdges, debouncedSetPendingEdgeUpdate]
  );
  
  // Create a new node
  const handleCreateNode = useCallback(
    (event: React.MouseEvent) => {
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
      
      console.log("Creating node at right-click position:", position);
      
      const newNodeId = `node-${Date.now()}`;
      
      // Create the new node object
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
        draggable: true,
      };
      
      console.log("Adding new node with draggable:", newNode.draggable);
      
      // Add directly to ReactFlow state first for immediate rendering
      reactFlowInstance.addNodes(newNode);
      
      // Then also dispatch to Redux store to ensure persistence
      dispatch(addNode(newNode));
      
      // Select the newly created node for editing
      setTimeout(() => {
        dispatch(setSelectedNode(newNodeId));
      }, 100);
    },
    [dispatch, reactFlowInstance]
  );
  
  // Add a node via button click (alternative way)
  const handleAddNodeButton = useCallback(() => {
    if (!reactFlowInstance) {
      console.error("ReactFlow instance not available");
      return;
    }
    
    // Get current viewport center
    const viewportCenter = reactFlowInstance.screenToFlowPosition({
      x: reactFlowWrapper.current?.clientWidth ? reactFlowWrapper.current.clientWidth / 2 : 250,
      y: reactFlowWrapper.current?.clientHeight ? reactFlowWrapper.current.clientHeight / 2 : 150,
    });
    
    // Add a small offset based on the number of existing nodes to prevent overlapping
    const offset = nodes.length * 20;
    
    console.log("Creating node at viewport center:", viewportCenter);
    
    const newNodeId = `node-${Date.now()}`;
    
    // Create the new node with offset to prevent overlapping
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
      draggable: true // Explicitly set node to be draggable
    };
    
    // Add the node to the Redux store first
    dispatch(addNode(newNode));
    
    // Force a fit view update to ensure the new node is visible
    setTimeout(() => {
      if (reactFlowInstance) {
        reactFlowInstance.fitView({ padding: 0.2 });
      }
      
      // Select the node for editing - ensure this happens AFTER the node is added
      dispatch(setSelectedNode(newNodeId));
    }, 100);
  }, [dispatch, reactFlowInstance, reactFlowWrapper, nodes.length]);
  
  // Handle context menu
  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault()
      setContextMenu({
        id: node.id,
        x: event.clientX,
        y: event.clientY,
      })
    },
    []
  )
  
  // Close context menu when clicked outside
  const handlePaneClick = useCallback(() => {
    setContextMenu(null)
  }, [])
  
  // Save the board state
  const handleSave = useCallback(() => {
    // Generate the JSON representation of the board
    const boardData = {
      id: boardId,
      name: boardName,
      nodes: storeNodes,
      edges: storeEdges,
      lastSaved: new Date().toISOString()
    }
    
    // TODO: Send to server API
    console.log('Saving board data:', boardData)
    
    // In a real application, this would be an API call to save the data
    // For now, just mark the board as saved in Redux
    dispatch(markAsSaved())
  }, [boardId, boardName, dispatch, storeEdges, storeNodes])
  
  // Export the board data as JSON
  const handleExport = useCallback(() => {
    const boardData = {
      id: boardId,
      name: boardName,
      nodes: storeNodes,
      edges: storeEdges,
      exportedAt: new Date().toISOString()
    }
    
    // Create a JSON file
    const dataStr = JSON.stringify(boardData, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    
    // Create a download link and trigger it
    const exportFileName = `${boardName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.json`
    
    const downloadLink = document.createElement('a')
    downloadLink.setAttribute('href', dataUri)
    downloadLink.setAttribute('download', exportFileName)
    document.body.appendChild(downloadLink)
    downloadLink.click()
    document.body.removeChild(downloadLink)
  }, [boardId, boardName, storeNodes, storeEdges])
  
  // Trigger the file input when import button is clicked
  const handleImportClick = useCallback(() => {
    if (importInputRef.current) {
      importInputRef.current.click()
    }
  }, [])
  
  // Handle the file selection for import
  const handleImportFile = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target?.result as string)
        if (jsonData.nodes && jsonData.edges) {
          dispatch(setBoard({
            nodes: jsonData.nodes,
            edges: jsonData.edges,
            boardName: jsonData.name || boardName,
            boardId
          }))
          console.log('Board data imported successfully')
        } else {
          console.error('Invalid board data format')
        }
      } catch (error) {
        console.error('Error parsing imported JSON:', error)
      }
      
      // Reset file input to allow reimporting the same file
      if (importInputRef.current) {
        importInputRef.current.value = ''
      }
    }
    reader.readAsText(file)
  }, [boardId, boardName, dispatch])
  
  // Update board name
  const handleBoardNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(updateBoardName(e.target.value))
  }
  
  // Force create a demo node if the board is still empty after a timeout
  useEffect(() => {
    if (storeNodes.length === 0) {
      const timer = setTimeout(() => {
        console.log("Board still empty after timeout, forcing demo node creation");
        handleAddNodeButton();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [storeNodes.length, handleAddNodeButton]);
  
  return (
    <div className="h-screen w-full flex flex-col">
      {/* Top toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700 z-10">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => router.push('/boards')}
            className="px-3 py-1 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            ← Back
          </button>
          <input
            type="text"
            value={boardName}
            onChange={handleBoardNameChange}
            className="px-2 py-1 border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent font-semibold"
          />
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleAddNodeButton}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Add new node"
          >
            Add Node
          </button>
          <button
            onClick={() => dispatch(undo())}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Undo (Cmd+Z)"
          >
            Undo
          </button>
          <button
            onClick={() => dispatch(redo())}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Redo (Cmd+Y)"
          >
            Redo
          </button>
          <button
            onClick={handleExport}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Export as JSON"
          >
            Export
          </button>
          <button
            onClick={handleImportClick}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Import from JSON"
          >
            Import
          </button>
          <input 
            type="file" 
            ref={importInputRef} 
            onChange={handleImportFile} 
            accept=".json" 
            className="hidden" 
          />
          <button
            onClick={handleSave}
            className={`px-4 py-2 rounded font-medium ${
              isDirty
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-300'
            }`}
            disabled={!isDirty}
          >
            {isDirty ? 'Save' : 'Saved'}
          </button>
        </div>
      </div>
      
      {/* Main canvas */}
      <div className="flex-1 h-full" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={handleConnect}
          onEdgeUpdate={handleEdgeUpdate}
          onPaneClick={handlePaneClick}
          onPaneContextMenu={handleCreateNode}
          onNodeContextMenu={handleNodeContextMenu}
          onInit={(instance) => {
            console.log("ReactFlow initialized with instance:", instance);
            setReactFlowInstance(instance);
            // Only run this once when instance is first initialized
            if (instance && !reactFlowInstance) {
              setTimeout(() => {
                console.log("Forcing node visibility refresh, nodes count:", nodes.length);
                // Check if nodes need rescuing (have invalid positions)
                const resetNodes = [...nodes.map(node => ({
                  ...node,
                  position: { 
                    x: node.position?.x || 250, 
                    y: node.position?.y || 150 
                  },
                  // Ensure nodes are draggable
                  draggable: true
                }))];
                
                console.log("Setting nodes with draggable property:", 
                  resetNodes.map(n => `${n.id}: ${n.draggable}`).join(', '));
                
                instance.setNodes(resetNodes);
                instance.fitView({ padding: 0.2 });
              }, 500);
            }
          }}
          nodeTypes={memoizedNodeTypes}
          connectionMode={ConnectionMode.Loose}
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
          onNodeDragStart={(event, node) => {
            console.log("Node drag started:", node.id, node.position);
            // Add class to body to disable text selection while dragging
            document.body.classList.add('node-drag-active');
          }}
          onNodeDrag={(event, node) => {
            console.log("Node dragging:", node.id, node.position);
            // Using requestAnimationFrame for smoother updates
            requestAnimationFrame(() => {
              // We could update visual elements during drag here if needed
            });
          }}
          onNodeDragStop={(event, node) => {
            console.log("Node drag stopped:", node.id, "Final position:", node.position);
            
            // Remove class from body
            document.body.classList.remove('node-drag-active');
            
            // Manual position update to ensure the node positions are saved
            dispatch(updateNodes(
              nodes.map(n => 
                n.id === node.id 
                  ? { ...n, position: { ...node.position } } 
                  : n
              )
            ));
          }}
          deleteKeyCode={null} // Disable the delete key to prevent accidental deletion
          multiSelectionKeyCode={null} // Disable multi-selection to simplify interaction
          panOnScroll={false} // Disable pan on scroll for more stable behavior
          panOnDrag={true} // Keep pan on drag enabled
          selectionOnDrag={false} // Disable selection on drag for simpler interaction
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
          <Panel position="top-left">
            <div className="bg-white dark:bg-gray-800 p-2 rounded shadow text-sm">
              <strong>Node count:</strong> {nodes.length} nodes
            </div>
          </Panel>
          <Panel position="bottom-right">
            <button
              onClick={handleAddNodeButton}
              className="p-3 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-all transform hover:scale-105"
              title="Add new node"
            >
              + Add Node
            </button>
          </Panel>
          
          {/* Debug Panel */}
          <Panel position="bottom-left">
            <div className="bg-white dark:bg-gray-800 p-3 rounded shadow text-xs max-w-xs">
              <div className="font-bold mb-1">Debug Info:</div>
              <div>Nodes: {nodes.length}</div>
              <div>Node IDs: {nodes.map(n => n.id).join(', ')}</div>
              <div>Selected: {selectedNodeId || 'none'}</div>
              <div>Board ID: {boardId}</div>
              <button 
                onClick={() => {
                  if (reactFlowInstance) {
                    reactFlowInstance.fitView({ padding: 0.2 });
                    console.log("Current viewport:", reactFlowInstance.getViewport());
                    console.log("All nodes:", nodes);
                  }
                }}
                className="mt-1 px-2 py-1 bg-blue-500 text-white rounded text-xs"
              >
                Fit View
              </button>
              <button 
                onClick={handleAddNodeButton}
                className="mt-1 ml-1 px-2 py-1 bg-green-500 text-white rounded text-xs"
              >
                Add Node
              </button>
            </div>
          </Panel>
        </ReactFlow>
      </div>
      
      {/* Context menu */}
      {contextMenu && (
        <NodeContextMenu
          nodeId={contextMenu.id}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
      
      {/* Node edit panel */}
      {selectedNodeId && (
        <NodeEditPanel nodeId={selectedNodeId} />
      )}
    </div>
  )
}

export default BoardCanvas 