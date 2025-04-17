import { useCallback } from 'react';
import { Node, Edge } from 'reactflow';
import { useDispatch } from 'react-redux';
import { useBoardStore } from './useBoardStore';
import { authService } from '@/services/auth';
import { markAsSaved } from '@/store/boardSlice';

/**
 * Hook for file operations such as saving, exporting and importing board data
 */
export const useFileOperations = (boardId: string) => {
  const { 
    storeNodes, 
    storeEdges, 
    boardName,
    isDirty,
    initializeBoard 
  } = useBoardStore();
  const dispatch = useDispatch();

  /**
   * Check if there are unsaved changes and prompt the user
   * Returns true if it's safe to proceed, false otherwise
   */
  const checkUnsavedChanges = useCallback(() => {
    if (!isDirty) return true;
    
    return window.confirm('You have unsaved changes. Are you sure you want to proceed without saving?');
  }, [isDirty]);

  /**
   * Save the board state to both localStorage and server
   */
  const handleSave = useCallback(async () => {
    // Generate the JSON representation of the board
    const boardData = {
      name: boardName,
      nodes: storeNodes,
      edges: storeEdges,
      lastSaved: new Date().toISOString()
    };

    let localSaved = false;
    let serverSaved = false;

    // Step 1: Save to localStorage for offline/backup functionality
    try {
      localStorage.setItem(`board-${boardId}`, JSON.stringify({
        id: boardId,
        ...boardData
      }));
      console.log('Board saved to localStorage');
      localSaved = true;
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
    
    // Step 2: Send to server API using authService
    try {
      // Use the correct endpoint and send board ID as URL parameter
      const response = await authService.post(`/api/boards/update?id=${boardId}`, boardData);
      
      if (!response || !response.data) {
        throw new Error('Invalid response from server');
      }
      
      console.log('Server save result:', response.data);
      serverSaved = true;
    } catch (error) {
      console.error('Error saving to server:', error);
    }
    
    // Step 3: Mark as saved in Redux store if either local or server save succeeded
    if (localSaved || serverSaved) {
      dispatch(markAsSaved());
      return true;
    }
    
    return false;
  }, [boardId, boardName, dispatch, storeEdges, storeNodes]);

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
    
    // Check for unsaved changes before importing
    if (!checkUnsavedChanges()) {
      // Reset file input to allow reimporting the same file
      if (event.target) {
        event.target.value = '';
      }
      return;
    }
    
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
          
          // Save the imported data to localStorage and server
          setTimeout(() => {
            handleSave();
          }, 100);
        } else {
          console.error('Invalid board data format');
          alert('Invalid board data format. File must contain nodes and edges arrays.');
        }
      } catch (error) {
        console.error('Error parsing imported JSON:', error);
        alert('Error parsing imported JSON. Please make sure the file is valid JSON.');
      }
      
      // Reset file input to allow reimporting the same file
      if (event.target) {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  }, [boardId, boardName, checkUnsavedChanges, handleSave, initializeBoard]);

  return {
    handleSave,
    handleExport,
    handleImportFile,
    checkUnsavedChanges
  };
}; 