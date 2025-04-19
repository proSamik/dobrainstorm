import { useState, useEffect } from 'react';
import { useBoardStore } from '../board/hooks/useBoardStore';

/**
 * Hook to handle board initialization by fetching data from the server
 */
export const useBoardInitialization = (boardId: string) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { boardId: currentBoardId, storeNodes, initializeBoard } = useBoardStore();

  useEffect(() => {
    const fetchBoard = async () => {
      try {
        // Check if we already have this board loaded
        if (currentBoardId === boardId && storeNodes.length > 0) {
          setIsLoading(false);
          return;
        }

        // Try to load from localStorage first
        const localStorageKey = `board-${boardId}`;
        const localData = localStorage.getItem(localStorageKey);

        if (localData) {
          try {
            const parsedData = JSON.parse(localData);
            
            initializeBoard({
              boardId: parsedData.id,
              boardName: parsedData.name,
              nodes: parsedData.nodes || [],
              edges: parsedData.edges || []
            });
            
            setIsLoading(false);
            return;
          } catch (parseError) {
            console.warn('Failed to parse localStorage data:', parseError);
            console.warn('Fetching from server instead');
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
      } catch (fetchError) {
        console.error('Error loading board:', fetchError);
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load board');
        
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