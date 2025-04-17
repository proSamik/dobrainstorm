import React from 'react';
import { Panel } from 'reactflow';

interface FloatingAddButtonProps {
  onClick: () => void;
}

/**
 * Floating add button for creating new nodes
 * Fixed position in the bottom right of the canvas
 */
export const FloatingAddButton: React.FC<FloatingAddButtonProps> = ({ onClick }) => {
  return (
    <Panel position="bottom-right">
      <button
        onClick={onClick}
        className="p-3 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-all transform hover:scale-105"
        title="Add new node"
      >
        + Add Node
      </button>
    </Panel>
  );
}; 