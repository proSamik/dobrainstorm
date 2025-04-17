import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { setBoard } from '../../../store/boardSlice';
import { Node, Edge } from 'reactflow';

/**
 * Hook to handle board initialization by fetching data from the server
 */
export const useBoardInitialization = (boardId: string) => {
  const dispatch = useDispatch();
  const { 
    nodes: storeNodes, 
    boardId: currentBoardId 
  } = useSelector((state: RootState) => state.board);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const initializeBoard = useCallback(({ 
    boardId, 
    boardName, 
    nodes, 
    edges 
  }: {
    boardId: string;
    boardName: string;
    nodes: Node[];
    edges: Edge[];
  }) => {
    dispatch(setBoard({
      boardId,
      boardName,
      nodes,
      edges
    }));
  }, [dispatch]);
  
  useEffect(() => {
    // Only fetch if boardId is provided and board is not already loaded
    if (!boardId || (currentBoardId === boardId && storeNodes.length > 0)) {
      return;
    }
    
    const fetchBoard = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // First check localStorage for faster loading and offline support
        const localData = localStorage.getItem(`board-${boardId}`);
        
        if (localData) {
          try {
            const parsedData = JSON.parse(localData);
            console.log('Board loaded from localStorage:', boardId);
            
            initializeBoard({
              boardId: parsedData.id,
              boardName: parsedData.name,
              nodes: parsedData.nodes || [],
              edges: parsedData.edges || []
            });
            
            setIsLoading(false);
            return;
          } catch (e) {
            console.warn('Failed to parse localStorage data, fetching from server');
          }
        }
        
        // Fetch from server if not in localStorage
        const response = await fetch(`/api/boards/get?id=${boardId}`);
        
        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }
        
        const data = await response.json();
        
        initializeBoard({
          boardId: data.id,
          boardName: data.name,
          nodes: data.nodes || [],
          edges: data.edges || []
        });
        
        // Also save to localStorage for faster loading next time
        localStorage.setItem(`board-${boardId}`, JSON.stringify(data));
        
        console.log('Board loaded from server:', boardId);
      } catch (err) {
        console.error('Error loading board:', err);
        setError(err instanceof Error ? err.message : 'Failed to load board');
        
        // If both localStorage and server fail, create an empty board
        if (storeNodes.length === 0) {
          initializeBoard({
            boardId,
            boardName: 'New Board',
            nodes: [],
            edges: []
          });
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchBoard();
  }, [boardId, currentBoardId, storeNodes.length, initializeBoard]);
  
  return { isLoading, error };
}; 