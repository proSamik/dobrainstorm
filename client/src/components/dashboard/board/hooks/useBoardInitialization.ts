import { useEffect, useState, useCallback } from 'react';
import { Node, Edge } from 'reactflow';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { RootState } from '@/store';
import { setBoard } from '@/store/boardSlice';
import { authService } from '@/services/auth';

/**
 * Hook to handle board initialization
 * Implements the data flow for loading board data:
 * 1. First check localStorage for faster loading
 * 2. Fetch from server to get the latest data
 * 3. Store in Redux for UI consumption
 */
export const useBoardInitialization = (boardId: string) => {
  const dispatch = useDispatch();
  const router = useRouter();
  const { 
    nodes: storeNodes, 
    boardId: currentBoardId,
    isDirty
  } = useSelector((state: RootState) => state.board);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Initialize board with data from either localStorage or server
   */
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

  /**
   * Create a default empty board when no data is available
   */
  const createDefaultBoard = useCallback(() => {
    console.log('Creating default empty board');
    
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
    ];
    
    const initialEdges: Edge[] = [];
    
    initializeBoard({
      nodes: initialNodes,
      edges: initialEdges,
      boardName: 'New Brainstorm',
      boardId
    });
  }, [boardId, initializeBoard]);

  useEffect(() => {
    // If we're already viewing this board and it has nodes, don't reinitialize
    if (currentBoardId === boardId && storeNodes.length > 0) {
      console.log('Board already loaded in store:', boardId);
      return;
    }
    
    // If there are unsaved changes in the current board, prompt user
    if (isDirty && currentBoardId && currentBoardId !== boardId) {
      const confirmLeave = window.confirm(
        'You have unsaved changes. Would you like to save before leaving?'
      );
      
      if (confirmLeave) {
        // This would be handled by the navigation component
        console.log('User chose to save changes before loading new board');
        return;
      }
    }
    
    const loadBoard = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Step 1: First check localStorage for faster loading
        let boardData = null;
        const localStorageKey = `board-${boardId}`;
        const localData = localStorage.getItem(localStorageKey);
        
        if (localData) {
          try {
            boardData = JSON.parse(localData);
            console.log('Board loaded from localStorage:', boardId);
            
            // Initialize board with local data for immediate display
            initializeBoard({
              boardId: boardData.id,
              boardName: boardData.name || 'Untitled Board',
              nodes: boardData.nodes || [],
              edges: boardData.edges || []
            });
          } catch (e) {
            console.warn('Failed to parse localStorage data:', e);
            boardData = null;
          }
        }
        
        // Step 2: Fetch from server to get the latest data
        try {
          console.log('Fetching board data from server:', boardId);
          const response = await authService.get(`/api/boards/get?id=${boardId}`);
          
          if (response && response.id) {
            // Server data is valid, update the board
            console.log('Board data fetched from server successfully');
            
            // Initialize Redux store with server data
            initializeBoard({
              boardId: response.id,
              boardName: response.name || 'Untitled Board',
              nodes: response.nodes || [],
              edges: response.edges || []
            });
            
            // Also update localStorage with latest data
            localStorage.setItem(localStorageKey, JSON.stringify(response));
          } else {
            throw new Error('Invalid board data received from server');
          }
        } catch (serverError: any) {
          console.error('Error fetching board from server:', serverError);
          
          // Handle authentication errors
          if (serverError.response && serverError.response.status === 401) {
            setError('Your session has expired. Please log in again.');
            // Redirect to login after a short delay
            setTimeout(() => {
              router.push('/auth/login?redirect=' + encodeURIComponent('/boards/' + boardId));
            }, 2000);
            return;
          }
          
          // Handle access denied
          if (serverError.response && serverError.response.status === 403) {
            setError('You do not have access to this board.');
            setTimeout(() => {
              router.push('/boards');
            }, 2000);
            return;
          }
          
          // If we already loaded data from localStorage, keep using that
          if (!boardData) {
            if (storeNodes.length === 0) {
              // If no data anywhere, create a default board
              createDefaultBoard();
            }
          }
          
          // Show error to user if we couldn't get server data
          setError('Could not fetch the latest board data from server. Using cached data.');
        }
      } catch (err) {
        console.error('Error during board initialization:', err);
        setError(err instanceof Error ? err.message : 'Failed to load board');
        
        // Create a default board if nothing else worked
        if (storeNodes.length === 0) {
          createDefaultBoard();
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    loadBoard();
  }, [boardId, currentBoardId, storeNodes.length, isDirty, initializeBoard, createDefaultBoard, router]);
  
  return { isLoading, error };
};