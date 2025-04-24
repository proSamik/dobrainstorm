'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '@/store'
import Image from 'next/image'
import { setEditingNode, NodeContent, updateNodes } from '@/store/boardSlice'
import { RichTextEditor } from './nodes/RichTextEditor'
import { ParentNodeTrace } from './nodes/ParentNodeTrace'
import { authService } from '@/services/auth'
import axios from 'axios'

// Define AI providers
type ApiProvider = 'openai' | 'claude' | 'klusterai';
const PROVIDERS: ApiProvider[] = ['openai', 'claude', 'klusterai'];

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
  
  // Find the selected node
  const selectedNode = nodes.find(node => node.id === nodeId)
  
  // Initialize state with node content
  const [text, setText] = useState<string>('')
  const [images, setImages] = useState<string[]>([])
  const [label, setLabel] = useState<string>('')
  const [isDirty, setIsDirty] = useState(false)
  const [panelWidth, setPanelWidth] = useState(320) // Default width
  const [isDragging, setIsDragging] = useState(false)
  
  // Node context (ascii tree + details)
  const [nodeContext, setNodeContext] = useState<{ asciiTree: string; nodeList: Array<{ label: string; content: string }> }>({ asciiTree: '', nodeList: [] })
  
  // Chat input and API results
  const [chatInput, setChatInput] = useState('')
  const [suggestions, setSuggestions] = useState<any>(null)
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
  
  // Compute nodeContext (reuse ParentNodeTrace logic)
  /**
   * Build ASCII tree and node details list from the board state
   */
  useEffect(() => {
    // Copy buildTreeAndList from ParentNodeTrace
    const getConnectedNodes = (id: string) => {
      const con = { parents: [], siblings: [], children: [] } as any;
      edges.forEach(e => {
        if (e.target === id) con.parents.push(e.source);
        else if (e.source === id) con.children.push(e.target);
      });
      const parentSet = new Set(con.parents);
      edges.forEach(e => {
        if (parentSet.has(e.source) && e.target !== id) con.siblings.push(e.target);
      });
      return con;
    };
    const getPlain = (html: string) => {
      const tmp = document.createElement('div'); tmp.innerHTML = html; return tmp.textContent || '';
    };
    const buildTree = (startId: string) => {
      const list: any[] = [];
      const visited = new Set<string>();
      const collect = (id: string) => {
        if (visited.has(id)) return;
        const n = nodes.find(x => x.id === id);
        if (!n) return; visited.add(id);
        list.push({ label: n.data.label, content: getPlain(n.data.content?.text || '') });
        const con = getConnectedNodes(id);
        con.parents.forEach(collect);
        con.siblings.forEach(collect);
        con.children.forEach(collect);
      };
      collect(startId);
      // ascii
      let tree = '';
      const build = (id: string, prefix = '', last = true) => {
        const n = nodes.find(x => x.id === id);
        if (!n) return;
        tree += prefix + (last ? '└── ' : '├── ') + n.data.label + '\n';
        const con = getConnectedNodes(id);
        con.children.forEach((c: string, i: number) => build(c, prefix + (last ? '    ' : '│   '), i === con.children.length - 1));
      };
      const roots = list.filter(l => getConnectedNodes(l.id).parents.length === 0).map(l => l.id);
      roots.forEach((rid, idx) => build(rid, '', idx === roots.length - 1));
      return { asciiTree: tree, nodeList: list };
    };
    setNodeContext(buildTree(nodeId));
  }, [nodeId, nodes, edges]);
  
  /**
   * Fetch and store API keys, validity, models for each provider; select default provider
   */
  useEffect(() => {
    authService.get('/settings/api-keys')
      .then((data: Record<string, any>) => {
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
  }, []);
  
  /**
   * Send a brainstorming request to the AI API with the node context and user input
   */
  const handleGenerate = async () => {
    setLoadingChat(true); setChatError(null);
    try {
      const contextMsgs = [
        { role: 'user', content: `Node Context Tree:\n${nodeContext.asciiTree}` },
        { role: 'user', content: `Node Details:\n${nodeContext.nodeList.map(n => `${n.label}: ${n.content}`).join('\n')}` }
      ];
      const resp = await axios.post(
        '/api/airequest',
        { model, message: chatInput, context: contextMsgs, apiKey },
        { headers: { 'Content-Type': 'application/json' } }
      );
      setSuggestions(resp.data);
    } catch (e: any) {
      setChatError(e.message || 'Error generating suggestions');
    } finally { setLoadingChat(false); }
  };
  
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
            <pre className="mt-2 p-2 bg-gray-100 rounded text-sm font-mono">{JSON.stringify(suggestions, null, 2)}</pre>
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