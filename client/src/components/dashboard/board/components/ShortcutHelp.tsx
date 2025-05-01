"use client"

import { X } from "lucide-react"

interface ShortcutHelpProps {
  onClose: () => void
}

export default function ShortcutHelp({ onClose }: ShortcutHelpProps) {
  const shortcuts = [
    { key: "N", description: "Add a new node" },
    { key: "Delete", description: "Delete selected node" },
    { key: "Ctrl + C", description: "Copy selected node" },
    { key: "Ctrl + V", description: "Paste copied node" },
    { key: "Ctrl + Z", description: "Undo last action" },
    { key: "Ctrl + Y", description: "Redo last action" },
    { key: "F", description: "Fit view to see all nodes" },
    { key: "+", description: "Zoom in" },
    { key: "-", description: "Zoom out" },
    { key: "L", description: "Auto-layout nodes" },
    { key: "Double-click", description: "Edit node content" },
    { key: "Ctrl + S", description: "Save board" },
    { key: "Ctrl + E", description: "Export as image" },
    { key: "Space + Drag", description: "Pan the canvas" },
    { key: "Shift + Mouse wheel", description: "Horizontal scroll" },
    { key: "Alt + Drag", description: "Create connection between nodes" },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold dark:text-white">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <X size={20} className="dark:text-gray-300" />
          </button>
        </div>

        <div className="grid gap-2 max-h-[60vh] overflow-y-auto pr-2">
          {shortcuts.map((shortcut, index) => (
            <div key={index} className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="font-medium dark:text-gray-200">{shortcut.key}</span>
              <span className="text-gray-600 dark:text-gray-400">{shortcut.description}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-2 text-center">
          <button 
            onClick={onClose} 
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors dark:text-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
} 