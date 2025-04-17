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
 * Utility function to clone nodes and edges to avoid reference issues
 */
const deepCloneNodesEdges = (nodes: Node[], edges: Edge[]) => {
  return {
    nodes: nodes.map(node => ({ 
      ...node, 
      // Ensure position is deeply cloned
      position: { ...node.position },
      // Ensure data is deeply cloned
      data: { ...node.data },
      // Ensure draggable property is set
      draggable: true
    })),
    edges: edges.map(edge => ({ ...edge }))
  };
};

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
      // Skip adding to history for minor position updates during dragging
      const isDragging = action.payload.some(node => node.dragging);
      
      if (!isDragging) {
        // Only save to history if we're not in a dragging operation
        state.history.past.push(deepCloneNodesEdges(state.nodes, state.edges));
        state.history.future = [];
      }
      
      // Preserve dragging state during updates
      state.nodes = action.payload.map(updatedNode => {
        // Ensure all required properties are preserved
        return {
          ...updatedNode,
          // Ensure position is properly set
          position: { ...updatedNode.position },
          // Ensure draggable property is set to true unless explicitly false
          draggable: updatedNode.draggable !== false,
          // Ensure data is preserved
          data: { ...updatedNode.data }
        };
      });
      
      state.isDirty = true;
    },
    
    // Update edges (used when connections are made, removed, etc.)
    updateEdges: (state, action: PayloadAction<Edge[]>) => {
      // Save current state to history before updating
      state.history.past.push(deepCloneNodesEdges(state.nodes, state.edges))
      state.history.future = []
      
      state.edges = action.payload
      state.isDirty = true
    },
    
    // Add a new node
    addNode: (state, action: PayloadAction<Node | {
      id: string,
      position: XYPosition,
      data: { label: string, content: NodeContent },
      type?: string,
      draggable?: boolean
    }>) => {
      // Save current state to history before updating
      state.history.past.push(deepCloneNodesEdges(state.nodes, state.edges))
      state.history.future = []
      
      let newNode: Node;
      
      // Check if we're getting a full Node object or just the components
      if ('type' in action.payload && typeof action.payload.type === 'string') {
        // It's already a Node object
        newNode = {
          ...action.payload,
          // Ensure data is cloned to avoid reference issues
          data: { ...action.payload.data },
          // Ensure node is draggable
          draggable: action.payload.draggable !== false // Default to true if not specified
        };
      } else {
        // It's the components to create a Node
        const payload = action.payload as {
          id: string,
          position: XYPosition,
          data: { label: string, content: NodeContent },
          type?: string,
          draggable?: boolean
        };
        
        newNode = {
          id: payload.id,
          position: payload.position,
          data: { ...payload.data },
          type: payload.type || 'textNode',
          draggable: payload.draggable !== false // Default to true if not specified
        };
      }
      
      // Remove any existing node with the same ID
      state.nodes = state.nodes.filter(n => n.id !== newNode.id);
      
      // Add the new node
      state.nodes.push(newNode);
      state.selectedNodeId = newNode.id;
      state.isDirty = true;
    },
    
    // Update a node's content
    updateNodeContent: (state, action: PayloadAction<{
      id: string,
      content: NodeContent
    }>) => {
      // Save current state to history before updating
      state.history.past.push(deepCloneNodesEdges(state.nodes, state.edges))
      state.history.future = []
      
      const node = state.nodes.find(node => node.id === action.payload.id)
      if (node) {
        node.data = {
          ...node.data,
          content: { ...action.payload.content }
        }
      }
      state.isDirty = true
    },
    
    // Remove a node and its connected edges
    removeNode: (state, action: PayloadAction<string>) => {
      // Save current state to history before updating
      state.history.past.push(deepCloneNodesEdges(state.nodes, state.edges))
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
        deepCloneNodesEdges(state.nodes, state.edges),
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
        deepCloneNodesEdges(state.nodes, state.edges)
      ]
      
      state.nodes = next.nodes
      state.edges = next.edges
      state.history.future = newFuture
      state.isDirty = true
    },
    
    // Clear the board
    clearBoard: (state) => {
      state.history.past.push(deepCloneNodesEdges(state.nodes, state.edges))
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