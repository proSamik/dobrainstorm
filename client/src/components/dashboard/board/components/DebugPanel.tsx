import React from 'react';
import { Panel } from 'reactflow';
import { useBoardStore } from '../hooks/useBoardStore';

interface DebugPanelProps {
  nodes: any[];
  onFitView: () => void;
  onAddNode: () => void;
}

/**
 * Debug panel component that displays information about the board state
 * Useful during development for debugging
 */
export const DebugPanel: React.FC<DebugPanelProps> = ({ nodes, onFitView, onAddNode }) => {
  const { selectedNodeId, boardId } = useBoardStore();

  return (
    <Panel position="bottom-left">
      <div className="bg-white dark:bg-gray-800 p-3 rounded shadow text-xs max-w-xs">
        <div className="font-bold mb-1">Debug Info:</div>
        <div>Nodes: {nodes.length}</div>
        <div>Node IDs: {nodes.map(n => n.id).join(', ')}</div>
        <div>Selected: {selectedNodeId || 'none'}</div>
        <div>Board ID: {boardId}</div>
        <button 
          onClick={onFitView}
          className="mt-1 px-2 py-1 bg-blue-500 text-white rounded text-xs"
        >
          Fit View
        </button>
        <button 
          onClick={onAddNode}
          className="mt-1 ml-1 px-2 py-1 bg-green-500 text-white rounded text-xs"
        >
          Add Node
        </button>
      </div>
    </Panel>
  );
}; 