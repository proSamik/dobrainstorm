import React from 'react';
import { Panel } from 'reactflow';

interface NodeCountDisplayProps {
  count: number;
}

/**
 * Component that displays the current node count
 */
export const NodeCountDisplay: React.FC<NodeCountDisplayProps> = ({ count }) => {
  return (
    <Panel position="top-left">
      <div className="bg-white dark:bg-gray-800 p-2 rounded shadow text-sm">
        <strong>Node count:</strong> {count} nodes
      </div>
    </Panel>
  );
}; 