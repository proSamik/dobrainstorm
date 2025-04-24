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
  onAddNode,
  onExport,
  onImport,
  onSave,
  cursorMode = 'grab',
  onToggleCursorMode
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
    <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700 z-10">
      <div className="flex items-center space-x-2">
        <button
          onClick={() => router.push('/boards')}
          className="px-3 py-1 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          ← Back
        </button>
        <input
          type="text"
          value={boardName}
          onChange={handleBoardNameChange}
          className="px-2 py-1 border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent font-semibold"
        />
      </div>
      
      <div className="flex items-center space-x-3">
        {onToggleCursorMode && (
          <button
            onClick={onToggleCursorMode}
            className={`flex items-center px-3 py-1 rounded text-sm ${
              cursorMode === 'grab' 
                ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                : 'bg-gray-100 text-gray-700 border border-gray-300'
            }`}
            title={`Click to switch to ${cursorMode === 'grab' ? 'pointer' : 'grab'} mode`}
          >
            <span className="mr-1">
              {cursorMode === 'grab' ? '✋' : '👆'}
            </span>
            {cursorMode === 'grab' ? 'Grab Mode' : 'Pointer Mode'}
          </button>
        )}
        
        <button
          onClick={onAddNode}
          className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
          title="Add a new node"
        >
          + Add Node
        </button>
        
        <button
          onClick={undoChange}
          className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Undo (Cmd+Z)"
        >
          Undo
        </button>
        <button
          onClick={redoChange}
          className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Redo (Cmd+Y)"
        >
          Redo
        </button>
        <button
          onClick={onExport}
          className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Export as JSON"
        >
          Export
        </button>
        <button
          onClick={handleImportClick}
          className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
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
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-300'
          }`}
          disabled={!isDirty}
        >
          {isDirty ? 'Save' : 'Saved'}
        </button>
      </div>
    </div>
  );
}; 