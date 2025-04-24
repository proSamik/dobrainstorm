'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '@/store'
import Image from 'next/image'
import { setEditingNode, updateNodes, updateEdges } from '@/store/boardSlice'
import { RichTextEditor } from './nodes/RichTextEditor'
import { ParentNodeTrace } from './nodes/ParentNodeTrace'
import { authService } from '@/services/auth'
import axios from 'axios'
import { Node, Edge, Position } from 'reactflow'

// Define AI providers
type ApiProvider = 'openai' | 'claude' | 'klusterai';
const PROVIDERS: ApiProvider[] = ['openai', 'claude', 'klusterai'];

// Helper function to get plain text from HTML
const getPlainText = (html: string) => {
  const tmp = document.createElement('div'); 
  tmp.innerHTML = html; 
  return tmp.textContent || '';
};

// First, update the currentNode's type to include content
interface NodeContent {
  text?: string;
  images?: string[];
  isHtml?: boolean;
}

interface NodeData {
  label?: string;
  content?: NodeContent;
  [key: string]: unknown;
}

// Define the node context type
interface NodeContextData {
  asciiTree: string;
  nodeList: Array<{ id: string; label: string; content: string }>;
  boardTitle: string;
  currentNode: NodeData | null;
}

/**
 * Custom hook to build node context tree
 * IMPORTANT: This hook must be called in a React component at the top level,
 * we pass in boardTitle instead of using useSelector inside to avoid invalid hook calls.
 */
function useNodeTreeBuilder(nodeId: string, nodes: Node[], edges: Edge[], boardTitle: string) {
  // Create and memoize node context
  const [nodeContext, setNodeContext] = useState<NodeContextData>({
    asciiTree: '',
    nodeList: [],
    boardTitle,
    currentNode: null
  });

  // Build the tree whenever nodes, edges, or the selected node changes
  useEffect(() => {
    // Build tree function
    const buildTree = () => {
      // Track visited nodes
      const visited = new Set<string>();
      const nodeList: Array<{ id: string; label: string; content: string }> = [];
      let asciiTree = '';
      
      // Collect connected nodes data
      const collectNodes = (id: string, prefix = '', isLast = true) => {
        if (!id || visited.has(id)) return;
        visited.add(id);
        
        // Find this node
        const node = nodes.find(n => n.id === id);
        if (!node) return;
        
        // Add to list
        nodeList.push({
          id: node.id,
          label: node.data.label || 'Unnamed Node',
          content: getPlainText(node.data.content?.text || '')
        });
        
        // Add to tree with formatting
        const label = node.data.label || 'Unnamed Node';
        asciiTree += `${prefix}${isLast ? '└── ' : '├── '}${label}${id === nodeId ? ' (current)' : ''}\n`;
        
        // Get children
        const children = edges
          .filter(edge => edge.source === id)
          .map(edge => edge.target);
        
        // Add children with proper formatting
        children.forEach((childId, index) => {
          collectNodes(
            childId, 
            prefix + (isLast ? '    ' : '│   '), 
            index === children.length - 1
          );
        });
      };
      
      // Find root nodes (no parents)
      const rootNodes = nodes.filter(node => 
        !edges.some(edge => edge.target === node.id)
      ).map(node => node.id);
      
      // Build the tree
      if (rootNodes.length > 0) {
        rootNodes.forEach((rootId, index) => {
          collectNodes(rootId, '', index === rootNodes.length - 1);
        });
      } else if (nodeId) {
        // No root nodes, start with selected node
        collectNodes(nodeId, '', true);
      }
      
      // If tree is empty, at least show the current node
      if (asciiTree === '' && nodeId) {
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
          asciiTree = `└── ${node.data.label || 'Unnamed Node'} (current)\n`;
          
          // Make sure we have this node in the list
          if (!nodeList.some(n => n.id === nodeId)) {
            nodeList.push({
              id: node.id,
              label: node.data.label || 'Unnamed Node',
              content: getPlainText(node.data.content?.text || '')
            });
          }
        }
      }
      
      return {
        asciiTree,
        nodeList,
        boardTitle,
        currentNode: nodes.find(n => n.id === nodeId)?.data || null
      };
    };
    
    // Build and update
    const result = buildTree();
    console.log("Built node tree:", result.asciiTree);
    setNodeContext(result);
  }, [nodeId, nodes, edges, boardTitle]);
  
  return nodeContext;
}

interface NodeEditPanelProps {
  nodeId: string
}

/**
 * Panel for editing node content (text and images)
 * Appears when a node is selected
 * Features rich text editing and responsive sizing
 */
const NodeEditPanel = ({ nodeId }: NodeEditPanelProps) => {
  const dispatch = useDispatch()
  const nodes = useSelector((state: RootState) => state.board.nodes)
  const edges = useSelector((state: RootState) => state.board.edges)
  const panelRef = useRef<HTMLDivElement>(null)
  
  // Use our custom hook to build the node tree
  const nodeContext = useNodeTreeBuilder(nodeId, nodes, edges, useSelector((state: RootState) => state.board.boardName) || 'Untitled Board');
  
  // Find the selected node
  const selectedNode = nodes.find(node => node.id === nodeId)
  
  // Initialize state with node content
  const [text, setText] = useState<string>('')
  const [images, setImages] = useState<string[]>([])
  const [label, setLabel] = useState<string>('')
  const [isDirty, setIsDirty] = useState(false)
  const [panelWidth, setPanelWidth] = useState(320) // Default width
  const [isDragging, setIsDragging] = useState(false)
  
  // Chat input and API results
  const [chatInput, setChatInput] = useState('')
  const [suggestions, setSuggestions] = useState<Record<string, string[]> | null>(null)
  const [loadingChat, setLoadingChat] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  
  // All providers' credentials and status
  const [providers, setProviders] = useState<Record<ApiProvider, { key: string; isValid: boolean; models: string[]; selectedModel: string }>>({
    openai: { key: '', isValid: false, models: [], selectedModel: '' },
    claude: { key: '', isValid: false, models: [], selectedModel: '' },
    klusterai: { key: '', isValid: false, models: [], selectedModel: '' },
  });
  // Which provider is currently selected in this chat
  const [selectedProvider, setSelectedProvider] = useState<ApiProvider>('openai');
  const [apiKey, setApiKey] = useState<string>('');
  const [model, setModel] = useState<string>('');
  
  // Update local state when the selected node changes
  useEffect(() => {
    if (selectedNode) {
      setText(selectedNode.data.content?.text || '')
      setImages(selectedNode.data.content?.images || [])
      setLabel(selectedNode.data.label || '')
      setIsDirty(false)
    }
  }, [selectedNode])
  
  // Close the panel
  const handleClose = useCallback(() => {
    dispatch(setEditingNode(null))
  }, [dispatch])
  
  // Handle keyboard shortcuts and clicks outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleClose])

  // Handle panel resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && panelRef.current) {
        const newWidth = window.innerWidth - e.clientX
        // Set min and max width constraints
        const constrainedWidth = Math.min(Math.max(newWidth, 280), 800)
        setPanelWidth(constrainedWidth)
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])
  
  // Save the node content
  const handleSave = () => {
    if (!selectedNode) return
    
    // Update the node content in Redux
    const updatedContent: NodeContent = {
      text,
      images: [...images],
      isHtml: true // Always set isHtml to true since we're using rich text
    }
    
    const updatedNode = { ...selectedNode };
    let nodeChanged = false;
    
    // Update node content if changed
    if (text !== selectedNode.data.content?.text || 
        JSON.stringify(images) !== JSON.stringify(selectedNode.data.content?.images)) {
      updatedNode.data = {
        ...updatedNode.data,
        content: updatedContent
      };
      nodeChanged = true;
    }
    
    // Update node label if changed
    if (label.trim() !== selectedNode.data.label) {
      updatedNode.data = {
        ...updatedNode.data,
        label: label.trim()
      };
      nodeChanged = true;
    }
    
    // Only update if something actually changed
    if (nodeChanged) {
      // Update the node in Redux
      const updatedNodes = nodes.map(node => 
        node.id === nodeId ? updatedNode : node
      );
      
      dispatch(updateNodes(updatedNodes));
      console.log('Node updated:', updatedNode);
    }
    
    setIsDirty(false);
    
    // Close the panel after saving
    dispatch(setEditingNode(null))
  }
  
  // Update node content when text changes
  const handleTextChange = (newHtml: string) => {
    setText(newHtml)
    setIsDirty(true)
  }
  
  // Update node label when label changes
  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newLabel = e.target.value
    setLabel(newLabel)
    setIsDirty(true)
  }
  
  // Add an image to the node
  const handleAddImage = () => {
    // In a real app, this would open a file picker or URL input
    // For now, we'll just add a placeholder image
    const placeholderImage = 'https://via.placeholder.com/150'
    
    const updatedImages = [...images, placeholderImage]
    setImages(updatedImages)
    setIsDirty(true)
  }
  
  // Remove an image from the node
  const handleRemoveImage = (index: number) => {
    const updatedImages = images.filter((_, i) => i !== index)
    setImages(updatedImages)
    setIsDirty(true)
  }
  
  /**
   * Fetch and store API keys, validity, models for each provider; select default provider
   */
  useEffect(() => {
    authService.get('/settings/api-keys')
      .then((data: Record<string, {
        key: string;
        isValid: boolean;
        models?: string[];
        selectedModel?: string;
      }>) => {
        // Build new providers map
        const updated: typeof providers = { ...providers };
        PROVIDERS.forEach((p) => {
          const pd = data[p];
          if (pd) {
            updated[p] = {
              key: pd.key,
              isValid: !!pd.isValid,
              models: pd.models || [],
              selectedModel: pd.selectedModel || (pd.models?.[0] || ''),
            };
          }
        });
        setProviders(updated);
        // Default select openai if valid, else first valid provider
        const defaultProv = updated.openai.isValid
          ? 'openai'
          : PROVIDERS.find(p => updated[p].isValid) || 'openai';
        setSelectedProvider(defaultProv);
        setApiKey(updated[defaultProv].key);
        setModel(updated[defaultProv].selectedModel);
      })
      .catch(err => console.error('Failed to load API keys', err));
  }, [providers]);
  
  /**
   * Send a brainstorming request to the AI API with the node context and user input
   */
  const handleGenerate = async () => {
    setLoadingChat(true); 
    setChatError(null);
    
    try {
      // Get context data
      const treeText = nodeContext.asciiTree || '';
      const nodeDetails = nodeContext.nodeList || [];
      const boardTitle = nodeContext.boardTitle || 'Untitled Board';
      const currentNode = nodeContext.currentNode || { label: 'Unnamed Node' };
      
      // Structure context messages properly for the API
      const contextMsgs: {role: string; content: string}[] = [];
      
      // 1. Add current node details
      const currentNodeName = currentNode.label || 'Unnamed Node';
      const currentNodeContent = currentNode.content?.text || '';
      
      contextMsgs.push({ 
        role: 'user' as const, 
        content: `Current node: ${currentNodeName}\nDetails: ${getPlainText(currentNodeContent)}` as const
      });
      
      // 2. Add board title
      contextMsgs.push({ 
        role: 'user', 
        content: `Board title: ${boardTitle}` 
      });
      
      // 3. Add the complete node tree
      if (treeText.trim() !== '') {
        contextMsgs.push({ 
          role: 'user', 
          content: `Node Context Tree:\n${treeText}` 
        });
      } else {
        console.warn('ASCII tree is empty, using fallback structure');
        contextMsgs.push({ 
          role: 'user', 
          content: `Node Context Tree: ${currentNodeName}` 
        });
      }
      
      // 4. Add all node details
      if (nodeDetails.length > 0) {
        const detailsText = nodeDetails
          .map(n => `${n.label || 'Unnamed'}: ${n.content || 'No content'}`)
          .join('\n');
        contextMsgs.push({ 
          role: 'user', 
          content: `Node Details:\n${detailsText}` 
        });
      }
      
      // 5. Add specific instruction for JSON format to enable branching
      contextMsgs.push({
        role: 'user',
        content: `Please provide your response in a valid JSON format with categories as keys and arrays of ideas as values. For example: { "Category 1": ["Idea 1", "Idea 2"], "Category 2": ["Idea 3", "Idea 4"] }. This will be used to automatically create a mind map.`
      });
      
      // Log the context being sent
      console.log('Sending context to API:', contextMsgs);
      
      // Send the request with structured context
      const resp = await axios.post(
        '/api/airequest',
        { 
          model, 
          message: chatInput, 
          context: contextMsgs, 
          apiKey,
          provider: selectedProvider
        },
        { headers: { 'Content-Type': 'application/json' } }
      );
      
      // Handle the response
      if (resp.data && Object.keys(resp.data).length > 0) {
        setSuggestions(resp.data);
      } else {
        setChatError('Received empty response from AI');
      }
    } catch (error: unknown) {
      console.error('Error generating suggestions:', error);
      setChatError(error instanceof Error 
        ? error.message 
        : (error && typeof error === 'object' && 'message' in error 
            ? String(error.message) 
            : 'Error generating suggestions'
          )
      );
    } finally { 
      setLoadingChat(false); 
    }
  };
  
  /**
   * Create branch nodes from AI suggestions
   * This will automatically create new nodes based on the AI response
   * and connect them to the current node
   */
  const createBranchesFromSuggestions = useCallback(() => {
    if (!suggestions || !selectedNode) return;
    
    // Get the categories and ideas from the suggestions
    const categories = Object.keys(suggestions);
    if (categories.length === 0) {
      console.warn('No categories found in suggestions');
      return;
    }
    
    // Define node size and spacing constants
    const NODE_HEIGHT = 150;
    const CATEGORY_MARGIN_BOTTOM = 40; // Extra margin between category sections
    
    // Calculate total height needed for all categories and their ideas
    const getCategoryHeight = (ideaCount: number) => {
      // Height of a category includes the category node itself plus all its ideas
      // We add some padding between groups
      return NODE_HEIGHT + (ideaCount * NODE_HEIGHT) + CATEGORY_MARGIN_BOTTOM;
    };
    
    // Calculate total height needed for the entire mind map
    let totalHeight = 0;
    categories.forEach(category => {
      const ideas = suggestions[category];
      if (!Array.isArray(ideas) || ideas.length === 0) return;
      totalHeight += getCategoryHeight(ideas.length);
    });
    
    // All nodes and edges including existing ones
    const createdNodes = [...nodes];
    const createdEdges = [...edges];
    
    // Starting vertical position - center the entire structure
    let currentY = selectedNode.position.y - totalHeight / 2;
    
    // For each category, create a section with its ideas
    categories.forEach((category, categoryIndex) => {
      const ideas = suggestions[category];
      if (!Array.isArray(ideas) || ideas.length === 0) return;
      
      // Calculate spacing for this category's section
      const categoryHeight = getCategoryHeight(ideas.length);
      // Position category node at the vertical center of its section
      const categoryY = currentY + (categoryHeight / 2);
      
      // Position category node to the right of the parent node
      const categoryNodePosition = {
        x: selectedNode.position.x + 300, // Horizontal distance from parent
        y: categoryY - (ideas.length * NODE_HEIGHT) / 2 // Align with the center of this category's ideas
      };
      
      const categoryNodeId = `node-${Date.now()}-${categoryIndex}`;
      
      // Create the category node
      const categoryNode: Node = {
        id: categoryNodeId,
        type: 'textNode',
        position: categoryNodePosition,
        data: {
          label: category,
          content: {
            text: `<p>${category}</p>`,
            images: []
          }
        },
        draggable: true
      };
      
      // Connect from the parent node to this category
      const categoryEdge: Edge = {
        id: `edge-${selectedNode.id}-${categoryNodeId}`,
        source: selectedNode.id,
        target: categoryNodeId,
        type: 'default',
        sourceHandle: Position.Right,
        targetHandle: Position.Left
      };
      
      createdNodes.push(categoryNode);
      createdEdges.push(categoryEdge);
      
      // Create idea nodes for this category
      ideas.forEach((idea, ideaIndex) => {
        // Position ideas vertically in a column
        const ideaY = categoryNodePosition.y + (ideaIndex * NODE_HEIGHT);
        
        const ideaNodeId = `node-idea-${Date.now()}-${categoryIndex}-${ideaIndex}`;
        const ideaNode: Node = {
          id: ideaNodeId,
          type: 'textNode',
          position: {
            x: categoryNodePosition.x + 300, // Horizontal distance from category
            y: ideaY
          },
          data: {
            label: typeof idea === 'string' ? idea : `Idea ${ideaIndex + 1}`,
            content: {
              text: `<p>${idea}</p>`,
              images: []
            }
          },
          draggable: true
        };
        
        // Connect idea to category
        const ideaEdge: Edge = {
          id: `edge-${categoryNodeId}-${ideaNodeId}`,
          source: categoryNodeId,
          target: ideaNodeId,
          type: 'default',
          sourceHandle: Position.Right,
          targetHandle: Position.Left
        };
        
        createdNodes.push(ideaNode);
        createdEdges.push(ideaEdge);
      });
      
      // Update current Y position for the next category section
      currentY += categoryHeight;
    });
    
    // Now update the Redux store with all created nodes and edges at once
    dispatch(updateNodes(createdNodes));
    dispatch(updateEdges(createdEdges));
    
    // Clear the suggestions
    setSuggestions(null);
    
  }, [suggestions, selectedNode, nodes, edges, dispatch]);
  
  // If no node is selected, don't render anything
  if (!selectedNode) {
    return null
  }
  
  return (
    <div 
      ref={panelRef}
      className="absolute right-0 top-0 bottom-0 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-lg z-10 flex flex-col"
      style={{ width: panelWidth }}
    >
      {/* Resize handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-500 transition-colors"
        onMouseDown={() => setIsDragging(true)}
      />
      
      <div className="flex-none p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Edit Node</h3>
        </div>
        
        {/* Node label (title) */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Label
          </label>
          <input
            type="text"
            value={label}
            onChange={handleLabelChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            placeholder="Enter node label..."
          />
        </div>
      </div>
      
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto p-4 pt-0">
        {/* Rich text editor */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Content
          </label>
          <div className="border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden">
            <RichTextEditor
              content={text}
              onChange={handleTextChange}
              placeholder="Enter text for this node..."
            />
          </div>
        </div>
        
        {/* Images */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Images
            </label>
            <button
              onClick={handleAddImage}
              className="text-sm px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Add Image
            </button>
          </div>
          
          {images.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No images added yet
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {images.map((image, index) => (
                <div key={index} className="relative group">
                  <div className="relative w-full h-32">
                    <Image
                      src={image}
                      alt={`Image ${index + 1}`}
                      fill
                      className="object-cover rounded border border-gray-300 dark:border-gray-600"
                    />
                  </div>
                  <button
                    onClick={() => handleRemoveImage(index)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chat window */}
        <div className="mb-4">
          <label className="block text-sm font-medium">Ask AI</label>
          {/* Provider selector */}
          <select
            className="block mt-1 mb-2 border rounded p-1"
            value={selectedProvider}
            onChange={(e) => {
              const p = e.target.value as ApiProvider;
              setSelectedProvider(p);
              setApiKey(providers[p].key);
              setModel(providers[p].selectedModel);
            }}
          >
            {PROVIDERS.map((p) => (
              <option key={p} value={p} disabled={!providers[p].isValid}>
                {p} {providers[p].isValid ? '' : '(no key)'}
              </option>
            ))}
          </select>
          <textarea
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="Type your request, e.g. 'suggest me 10 domain name ideas'"
          />
          <button
            onClick={handleGenerate}
            disabled={loadingChat || !chatInput}
            className="mt-2 px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
          >{loadingChat ? 'Generating...' : 'Generate'}</button>
          {chatError && <p className="text-red-500">{chatError}</p>}
          {suggestions && (
            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-medium">AI Suggestions</h4>
                <button
                  onClick={createBranchesFromSuggestions}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                  title="Create a mind map from these suggestions"
                >
                  ✨ Create Mind Map
                </button>
              </div>
              <pre className="mt-2 p-2 bg-gray-100 rounded text-sm font-mono overflow-auto max-h-40">{JSON.stringify(suggestions, null, 2)}</pre>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className={`px-3 py-1 rounded text-sm font-medium ${
                isDirty
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-300'
              }`}
              disabled={!isDirty}
            >
              {isDirty ? 'Save' : 'Saved'}
            </button>
            <button
              onClick={handleClose}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Close (ESC)"
            >
              &times;
            </button>
          </div>

        <div>
          <ParentNodeTrace nodeId={nodeId} />
        </div>

      </div>
    </div>
  )
}

export default NodeEditPanel 