import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { Node, Edge, XYPosition } from 'reactflow'

/**
 * Interface for node content
 */
export interface NodeContent {
  text: string
  images: string[]
}

/**
 * Interface for the board state
 */
interface BoardState {
  nodes: Node[]
  edges: Edge[]
  history: {
    past: { nodes: Node[], edges: Edge[] }[]
    future: { nodes: Node[], edges: Edge[] }[]
  }
  selectedNodeId: string | null
  boardName: string
  boardId: string | null
  isDirty: boolean
  lastSaved: string | null
}

/**
 * Initial state for the board
 */
const initialState: BoardState = {
  nodes: [],
  edges: [],
  history: {
    past: [],
    future: []
  },
  selectedNodeId: null,
  boardName: 'Untitled Board',
  boardId: null,
  isDirty: false,
  lastSaved: null
}

/**
 * Board slice for Redux store
 */
const boardSlice = createSlice({
  name: 'board',
  initialState,
  reducers: {
    // Set the entire board state (used when loading a board)
    setBoard: (state, action: PayloadAction<{
      nodes: Node[],
      edges: Edge[], 
      boardName: string, 
      boardId: string
    }>) => {
      state.nodes = action.payload.nodes
      state.edges = action.payload.edges
      state.boardName = action.payload.boardName
      state.boardId = action.payload.boardId
      state.isDirty = false
      state.lastSaved = new Date().toISOString()
      state.history = {
        past: [],
        future: []
      }
    },
    
    // Update nodes (used when nodes are moved, added, etc.)
    updateNodes: (state, action: PayloadAction<Node[]>) => {
      // Save current state to history before updating
      state.history.past.push({
        nodes: [...state.nodes],
        edges: [...state.edges]
      })
      state.history.future = []
      
      state.nodes = action.payload
      state.isDirty = true
    },
    
    // Update edges (used when connections are made, removed, etc.)
    updateEdges: (state, action: PayloadAction<Edge[]>) => {
      // Save current state to history before updating
      state.history.past.push({
        nodes: [...state.nodes],
        edges: [...state.edges]
      })
      state.history.future = []
      
      state.edges = action.payload
      state.isDirty = true
    },
    
    // Add a new node
    addNode: (state, action: PayloadAction<{
      id: string,
      position: XYPosition,
      data: { label: string, content: NodeContent },
      type?: string
    }>) => {
      // Save current state to history before updating
      state.history.past.push({
        nodes: [...state.nodes],
        edges: [...state.edges]
      })
      state.history.future = []
      
      const newNode: Node = {
        id: action.payload.id,
        position: action.payload.position,
        data: action.payload.data,
        type: action.payload.type || 'default'
      }
      
      state.nodes.push(newNode)
      state.selectedNodeId = newNode.id
      state.isDirty = true
    },
    
    // Update a node's content
    updateNodeContent: (state, action: PayloadAction<{
      id: string,
      content: NodeContent
    }>) => {
      // Save current state to history before updating
      state.history.past.push({
        nodes: [...state.nodes],
        edges: [...state.edges]
      })
      state.history.future = []
      
      const node = state.nodes.find(node => node.id === action.payload.id)
      if (node) {
        node.data = {
          ...node.data,
          content: action.payload.content
        }
      }
      state.isDirty = true
    },
    
    // Remove a node and its connected edges
    removeNode: (state, action: PayloadAction<string>) => {
      // Save current state to history before updating
      state.history.past.push({
        nodes: [...state.nodes],
        edges: [...state.edges]
      })
      state.history.future = []
      
      state.nodes = state.nodes.filter(node => node.id !== action.payload)
      state.edges = state.edges.filter(
        edge => edge.source !== action.payload && edge.target !== action.payload
      )
      
      if (state.selectedNodeId === action.payload) {
        state.selectedNodeId = null
      }
      
      state.isDirty = true
    },
    
    // Set the selected node
    setSelectedNode: (state, action: PayloadAction<string | null>) => {
      state.selectedNodeId = action.payload
    },
    
    // Update board name
    updateBoardName: (state, action: PayloadAction<string>) => {
      state.boardName = action.payload
      state.isDirty = true
    },
    
    // Mark board as saved
    markAsSaved: (state) => {
      state.isDirty = false
      state.lastSaved = new Date().toISOString()
    },
    
    // Undo an action (move an item from past to present, and present to future)
    undo: (state) => {
      if (state.history.past.length === 0) return
      
      const previous = state.history.past[state.history.past.length - 1]
      const newPast = state.history.past.slice(0, state.history.past.length - 1)
      
      state.history.future = [
        {
          nodes: [...state.nodes],
          edges: [...state.edges]
        },
        ...state.history.future
      ]
      
      state.nodes = previous.nodes
      state.edges = previous.edges
      state.history.past = newPast
      state.isDirty = true
    },
    
    // Redo an action (move an item from future to present, and present to past)
    redo: (state) => {
      if (state.history.future.length === 0) return
      
      const next = state.history.future[0]
      const newFuture = state.history.future.slice(1)
      
      state.history.past = [
        ...state.history.past,
        {
          nodes: [...state.nodes],
          edges: [...state.edges]
        }
      ]
      
      state.nodes = next.nodes
      state.edges = next.edges
      state.history.future = newFuture
      state.isDirty = true
    },
    
    // Clear the board
    clearBoard: (state) => {
      state.history.past.push({
        nodes: [...state.nodes],
        edges: [...state.edges]
      })
      state.history.future = []
      
      state.nodes = []
      state.edges = []
      state.selectedNodeId = null
      state.isDirty = true
    }
  }
})

export const {
  setBoard,
  updateNodes,
  updateEdges,
  addNode,
  updateNodeContent,
  removeNode,
  setSelectedNode,
  updateBoardName,
  markAsSaved,
  undo,
  redo,
  clearBoard
} = boardSlice.actions

export default boardSlice.reducer 