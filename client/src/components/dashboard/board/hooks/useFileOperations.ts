import { useCallback } from 'react';
import { Node, Edge } from 'reactflow';
import { useBoardStore } from './useBoardStore';

/**
 * Hook for file operations such as saving, exporting and importing board data
 */
export const useFileOperations = (boardId: string) => {
  const { 
    storeNodes, 
    storeEdges, 
    boardName, 
    saveBoard, 
    initializeBoard 
  } = useBoardStore();

  /**
   * Save the board state
   */
  const handleSave = useCallback(() => {
    // Generate the JSON representation of the board
    const boardData = {
      id: boardId,
      name: boardName,
      nodes: storeNodes,
      edges: storeEdges,
      lastSaved: new Date().toISOString()
    };
    
    // TODO: Send to server API
    console.log('Saving board data:', boardData);
    
    // In a real application, this would be an API call to save the data
    // For now, just mark the board as saved in Redux
    saveBoard();
  }, [boardId, boardName, saveBoard, storeEdges, storeNodes]);

  /**
   * Export the board data as JSON file
   */
  const handleExport = useCallback(() => {
    const boardData = {
      id: boardId,
      name: boardName,
      nodes: storeNodes,
      edges: storeEdges,
      exportedAt: new Date().toISOString()
    };
    
    // Create a JSON file
    const dataStr = JSON.stringify(boardData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    // Create a download link and trigger it
    const exportFileName = `${boardName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.json`;
    
    const downloadLink = document.createElement('a');
    downloadLink.setAttribute('href', dataUri);
    downloadLink.setAttribute('download', exportFileName);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  }, [boardId, boardName, storeNodes, storeEdges]);

  /**
   * Import board data from a JSON file
   */
  const handleImportFile = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target?.result as string);
        if (jsonData.nodes && jsonData.edges) {
          initializeBoard({
            nodes: jsonData.nodes as Node[],
            edges: jsonData.edges as Edge[],
            boardName: jsonData.name || boardName,
            boardId
          });
          console.log('Board data imported successfully');
        } else {
          console.error('Invalid board data format');
        }
      } catch (error) {
        console.error('Error parsing imported JSON:', error);
      }
      
      // Reset file input to allow reimporting the same file
      if (event.target) {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  }, [boardId, boardName, initializeBoard]);

  return {
    handleSave,
    handleExport,
    handleImportFile
  };
}; 