import { useEffect } from 'react';
import { useBoardStore } from './useBoardStore';

/**
 * Hook for registering keyboard shortcuts for board operations
 */
export const useKeyboardShortcuts = () => {
  const { undoChange, redoChange, removeNodeFromBoard, selectedNodeId } = useBoardStore();

  useEffect(() => {
    /**
     * Handle keyboard shortcut events
     */
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo: Cmd+Z (Mac) or Ctrl+Z (Windows)
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoChange();
      }
      
      // Redo: Cmd+Shift+Z or Cmd+Y (Mac) or Ctrl+Shift+Z or Ctrl+Y (Windows)
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redoChange();
      }
      
      // Delete node: Delete or Backspace when a node is selected
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId) {
        e.preventDefault();
        removeNodeFromBoard(selectedNodeId);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoChange, redoChange, removeNodeFromBoard, selectedNodeId]);
}; 