import React, { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useBoardStore } from '../hooks/useBoardStore';

interface BoardToolsProps {
  onAddNode: () => void;
  onExport: () => void;
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSave: () => void;
  cursorMode?: 'grab' | 'pointer';
  onToggleCursorMode?: () => void;
}

/**
 * Toolbar component with board operation buttons
 */
export const BoardTools: React.FC<BoardToolsProps> = ({
  onExport,
  onImport,
  onSave,
}) => {
  const router = useRouter();
  const { boardName, isDirty, updateName, undoChange, redoChange } = useBoardStore();
  const importInputRef = useRef<HTMLInputElement>(null);

  /**
   * Handle board name change
   */
  const handleBoardNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateName(e.target.value);
  };

  /**
   * Trigger file input click
   */
  const handleImportClick = () => {
    if (importInputRef.current) {
      importInputRef.current.click();
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-2 bg-light-background dark:bg-dark-background border-b border-light-accent dark:border-dark-accent z-10">
      <div className="flex items-center space-x-2 w-full sm:w-auto mb-2 sm:mb-0">
        <button
          onClick={() => router.push('/boards')}
          className="px-3 py-1 text-sm rounded text-light-foreground dark:text-dark-foreground hover:bg-light-accent/20 dark:hover:bg-dark-accent/20"
        >
          ← Back
        </button>
        <input
          type="text"
          value={boardName}
          onChange={handleBoardNameChange}
          className="px-2 py-1 border-b border-transparent hover:border-light-accent dark:hover:border-dark-accent focus:border-primary-500 focus:outline-none bg-transparent font-semibold text-light-foreground dark:text-dark-foreground w-full"
        />
      </div>
      
      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
        <button
          onClick={undoChange}
          className="p-2 rounded text-light-foreground dark:text-dark-foreground hover:bg-light-accent/20 dark:hover:bg-dark-accent/20"
          title="Undo (Cmd+Z)"
        >
          Undo
        </button>

        <button
          onClick={redoChange}
          className="p-2 rounded text-light-foreground dark:text-dark-foreground hover:bg-light-accent/20 dark:hover:bg-dark-accent/20"
          title="Redo (Cmd+Y)"
        >
          Redo
        </button>

        <button
          onClick={onExport}
          className="p-2 rounded text-light-foreground dark:text-dark-foreground hover:bg-light-accent/20 dark:hover:bg-dark-accent/20"
          title="Export as JSON"
        >
          Export
        </button>

        
        <button
          onClick={handleImportClick}
          className="p-2 rounded text-light-foreground dark:text-dark-foreground hover:bg-light-accent/20 dark:hover:bg-dark-accent/20"
          title="Import from JSON"
        >
          Import
        </button>
        <input 
          type="file" 
          ref={importInputRef} 
          onChange={onImport} 
          accept=".json" 
          className="hidden" 
        />
        <button
          onClick={onSave}
          className={`px-4 py-2 rounded font-medium ${
            isDirty
              ? 'bg-primary-600 dark:bg-primary-700 text-white hover:bg-primary-700 dark:hover:bg-primary-800'
              : 'bg-light-accent/30 dark:bg-dark-accent/30 text-light-muted dark:text-dark-muted'
          }`}
          disabled={!isDirty}
        >
          {isDirty ? 'Save' : 'Saved'}
        </button>
      </div>
    </div>
  );
}; 