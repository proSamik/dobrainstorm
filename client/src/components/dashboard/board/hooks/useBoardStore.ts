import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/store';
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
  setSelectedNode,
  setEditingNode,
  setSelectedNodes
} from '@/store/boardSlice';
import { Node, Edge } from 'reactflow';

/**
 * Custom hook for accessing and manipulating board state in Redux
 * Provides a unified interface for store interactions
 */
export const useBoardStore = () => {
  const dispatch = useDispatch();
  const { 
    nodes: storeNodes, 
    edges: storeEdges, 
    boardName,
    isDirty,
    selectedNodeId,
    selectedNodeIds,
    editingNodeId,
    boardId
  } = useSelector((state: RootState) => state.board);

  /**
   * Updates the board node state in Redux
   */
  const updateNodeState = (nodes: Node[]) => {
    dispatch(updateNodes(nodes));
  };

  /**
   * Updates the board edge state in Redux
   */
  const updateEdgeState = (edges: Edge[]) => {
    dispatch(updateEdges(edges));
  };

  /**
   * Adds a new node to the board
   */
  const addNodeToBoard = (node: Node) => {
    dispatch(addNode(node));
  };

  /**
   * Removes a node from the board
   */
  const removeNodeFromBoard = (nodeId: string) => {
    dispatch(removeNode(nodeId));
  };

  /**
   * Marks the board as saved
   */
  const saveBoard = () => {
    dispatch(markAsSaved());
  };

  /**
   * Undo the last board change
   */
  const undoChange = () => {
    dispatch(undo());
  };

  /**
   * Redo the last undone change
   */
  const redoChange = () => {
    dispatch(redo());
  };

  /**
   * Update the board name
   */
  const updateName = (name: string) => {
    dispatch(updateBoardName(name));
  };

  /**
   * Set the currently selected node
   */
  const selectNode = (nodeId: string | null) => {
    dispatch(setSelectedNode(nodeId));
  };

  /**
   * Set multiple selected nodes
   */
  const selectNodes = (nodeIds: string[]) => {
    dispatch(setSelectedNodes(nodeIds));
  };

  /**
   * Set the node being edited
   */
  const setNodeForEditing = (nodeId: string | null) => {
    dispatch(setEditingNode(nodeId));
  };

  /**
   * Initialize a new board with the given data
   */
  const initializeBoard = (data: {
    nodes: Node[],
    edges: Edge[],
    boardName: string,
    boardId: string
  }) => {
    dispatch(setBoard(data));
  };

  return {
    storeNodes,
    storeEdges,
    boardName,
    isDirty,
    selectedNodeId,
    selectedNodeIds,
    editingNodeId,
    boardId,
    updateNodeState,
    updateEdgeState,
    addNodeToBoard,
    removeNodeFromBoard,
    saveBoard,
    undoChange,
    redoChange,
    updateName,
    selectNode,
    selectNodes,
    setNodeForEditing,
    initializeBoard
  };
}; 