'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
  updateEdge,
  MarkerType,
  Panel,
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
  setSelectedNode
} from '@/store/boardSlice'
import NodeContextMenu from './NodeContextMenu'
import NodeEditPanel from './NodeEditPanel'
import TextNode from './nodes/TextNode'
import { useRouter } from 'next/navigation'

// Define custom node types
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
  
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  
  const [contextMenu, setContextMenu] = useState<{
    id: string
    x: number
    y: number
  } | null>(null)
  
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null)
  const [pendingNodeUpdate, setPendingNodeUpdate] = useState(false)
  const [pendingEdgeUpdate, setPendingEdgeUpdate] = useState(false)
  const nodesRef = useRef<Node[]>([])
  const edgesRef = useRef<Edge[]>([])
  
  // Import file reference
  const importInputRef = useRef<HTMLInputElement>(null)
  
  // Initialize the board from Redux state or load from API
  useEffect(() => {
    const initializeBoard = async () => {
      try {
        // TODO: Replace with actual API call when the backend is ready
        // For now we'll set up a demo board
        if (storeNodes.length === 0) {
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
        }
      } catch (error) {
        console.error('Failed to initialize board:', error)
      }
    }
    
    initializeBoard()
  }, [boardId, dispatch, storeNodes.length])
  
  // Sync Redux state with React Flow state
  useEffect(() => {
    setNodes(storeNodes)
    setEdges(storeEdges)
  }, [storeNodes, storeEdges, setNodes, setEdges])
  
  // Update Redux store when there are pending node updates
  useEffect(() => {
    if (pendingNodeUpdate) {
      dispatch(updateNodes([...nodesRef.current]))
      setPendingNodeUpdate(false)
    }
  }, [dispatch, pendingNodeUpdate])
  
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
      onNodesChange(changes)
      // Update Redux store only if the changes are complete (not during dragging)
      const shouldUpdateStore = changes.every(change => 
        change.type !== 'position' || (change.type === 'position' && !change.dragging)
      )
      
      if (shouldUpdateStore) {
        // Use a ref to store current nodes instead of setState in render
        nodesRef.current = nodes;
        setPendingNodeUpdate(true);
      }
    },
    [nodes, onNodesChange]
  )
  
  // Handle edge changes
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes)
      // Use a ref to store current edges instead of setState in render
      edgesRef.current = edges;
      setPendingEdgeUpdate(true);
    },
    [edges, onEdgesChange]
  )
  
  // Handle connecting two nodes
  const handleConnect = useCallback(
    (connection: Connection) => {
      // Create a new edge with a unique ID
      const newEdge = {
        ...connection,
        id: `edge-${Date.now()}`,
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
      }
      
      setEdges(eds => {
        const newEdges = addEdge(newEdge, eds)
        edgesRef.current = newEdges;
        setPendingEdgeUpdate(true);
        return newEdges
      })
    },
    [setEdges]
  )
  
  // Handle edge updates
  const handleEdgeUpdate = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      setEdges(els => {
        const newEdges = updateEdge(oldEdge, newConnection, els)
        edgesRef.current = newEdges;
        setPendingEdgeUpdate(true);
        return newEdges
      })
    },
    [setEdges]
  )
  
  // Create a new node
  const handleCreateNode = useCallback(
    (event: React.MouseEvent) => {
      if (!reactFlowWrapper.current || !reactFlowInstance) return
      
      // Get the position where the user clicked relative to the flow canvas
      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect()
      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      })
      
      const newNodeId = `node-${Date.now()}`
      
      dispatch(
        addNode({
          id: newNodeId,
          position,
          data: {
            label: 'New Idea',
            content: {
              text: '',
              images: []
            }
          },
          type: 'textNode'
        })
      )
      
      // Select the newly created node for editing
      dispatch(setSelectedNode(newNodeId))
    },
    [dispatch, reactFlowInstance]
  )
  
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
          onInit={setReactFlowInstance}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          fitView
          snapToGrid
          snapGrid={[15, 15]}
        >
          <Background color="#aaa" gap={16} />
          <Controls />
          <MiniMap 
            nodeStrokeWidth={3}
            zoomable 
            pannable
          />
          <Panel position="top-right">
            <div className="p-2 bg-white dark:bg-gray-800 rounded shadow">
              <p className="text-sm">
                <strong>Tip:</strong> Right-click on canvas to add a new node
              </p>
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