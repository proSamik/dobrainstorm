import { useEffect } from 'react';
import { Node, Edge } from 'reactflow';
import { useBoardStore } from './useBoardStore';

/**
 * Hook to handle board initialization
 * Sets up initial board state if empty or loads from API
 */
export const useBoardInitialization = (boardId: string) => {
  const { storeNodes, initializeBoard } = useBoardStore();

  useEffect(() => {
    const initBoard = async () => {
      try {
        console.log('Initializing board with ID:', boardId);
        console.log('Current store nodes length:', storeNodes.length);
        
        // TODO: Replace with actual API call when the backend is ready
        // For now we'll set up a demo board if empty
        if (storeNodes.length === 0) {
          console.log('Creating initial demo board');
          
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
          
          console.log('Demo board created with nodes:', initialNodes.length);
        }
      } catch (error) {
        console.error('Failed to initialize board:', error);
      }
    };
    
    initBoard();
  }, [boardId, initializeBoard, storeNodes.length]);
};