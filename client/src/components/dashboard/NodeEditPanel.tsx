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
import { getPlainText } from '@/lib/utils/text-helpers'

// Define AI providers
type ApiProvider = 'openai' | 'claude' | 'klusterai';
const PROVIDERS: ApiProvider[] = ['openai', 'claude', 'klusterai'];

// Define interfaces for suggestion data structure
interface SubBranchItem {
  title: string;
  reason: string;
  sub_branches?: SubBranchItem[];
}

interface ConceptItem {
  title: string;
  reason: string;
  sub_branches?: SubBranchItem[];
}

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

// Add counters for each type of ID to ensure uniqueness
let nodeCounter = 0;
let edgeCounter = 0;
let conceptCounter = 0;
let subBranchCounter = 0;
let subSubBranchCounter = 0;

/**
 * Format text with line breaks after every 3 words to make nodes more compact
 * @param text The text to format
 * @returns Formatted text with line breaks
 */
const formatCompactText = (text: string): string => {
  if (!text) return '';
  
  // Split into words
  const words = text.split(/\s+/);
  
  // Group into chunks of 3 words
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += 3) {
    chunks.push(words.slice(i, i + 3).join(' '));
  }
  
  // Join with line breaks and wrap in paragraph tag with styling
  return `<p style="color: #4b5563; font-style: italic;">${chunks.join('<br />')}</p>`;
};

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
  
  // State for editing JSON suggestions
  const [editableSuggestions, setEditableSuggestions] = useState<string>('');
  const [isEditingSuggestions, setIsEditingSuggestions] = useState<boolean>(false);
  
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
  
  // Parse JSON from a string
  const parseJSON = useCallback((jsonString: string) => {
    console.log("Parsing JSON:", jsonString);
    
    if (!jsonString || jsonString.trim() === '') {
      console.warn("Empty JSON string provided");
      setChatError('Empty JSON. Please add content before creating a mind map.');
      return null;
    }
    
    try {
      const parsed = JSON.parse(jsonString);
      
      // Validate that it's an object with arrays
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        console.warn("JSON is not an object:", parsed);
        setChatError('JSON must be an object with categories and arrays of concepts.');
        return null;
      }
      
      // Check for valid structure (keys with array values)
      let isValid = true;
      Object.keys(parsed).forEach(key => {
        // Check each category has an array value
        if (!Array.isArray(parsed[key])) {
          console.warn(`Value for key "${key}" is not an array:`, parsed[key]);
          isValid = false;
          return;
        }
        
        // Check each item in category array has title and reason
        parsed[key].forEach((item, index) => {
          // Support both new and old format
          if (typeof item === 'string') {
            // Old format - convert to new format
            parsed[key][index] = {
              title: item,
              reason: "No reason provided"
            };
          } else if (item && typeof item === 'object' && item !== null) {
            // New format - validate required fields
            if (!item.title) {
              console.warn(`Item at index ${index} in category "${key}" is missing title`);
              isValid = false;
            }
            
            // Ensure reason exists
            if (!item.reason) {
              item.reason = "No reason provided";
            }
            
            // Validate sub_branches if present
            if (item.sub_branches) {
              if (!Array.isArray(item.sub_branches)) {
                console.warn(`sub_branches for item "${item.title}" is not an array`);
                isValid = false;
              } else {
                // Validate each sub-branch
                item.sub_branches.forEach((subItem: SubBranchItem, subIndex: number) => {
                  if (typeof subItem !== 'object' || !subItem.title) {
                    console.warn(`Sub-branch at index ${subIndex} for item "${item.title}" is invalid`);
                    isValid = false;
                  }
                  // Ensure reason exists for sub-branches
                  if (!subItem.reason) {
                    subItem.reason = "No reason provided";
                  }
                });
              }
            }
          } else {
            console.warn(`Item at index ${index} in category "${key}" is not an object or string`);
            isValid = false;
          }
        });
      });
      
      if (!isValid) {
        setChatError('The JSON structure is invalid. Each category must have an array of concept objects with title and reason properties.');
        return null;
      }
      
      console.log("Successfully parsed JSON:", parsed);
      setChatError('');
      return parsed;
    } catch (error) {
      console.error("JSON parse error:", error);
      setChatError('Invalid JSON format. Please fix before creating mind map.');
      return null;
    }
  }, [setChatError]);

  /**
   * Toggle between viewing and editing suggestions
   */
  const toggleEditMode = useCallback(() => {
    console.log("toggleEditMode called, current state:", { isEditingSuggestions, editableSuggestions });
    
    if (isEditingSuggestions) {
      // When exiting edit mode, parse the JSON
      try {
        const parsedJson = parseJSON(editableSuggestions);
        console.log("Parsed JSON:", parsedJson);
        
        // Update suggestions if valid JSON
        if (parsedJson) {
          console.log("Updating suggestions with parsed JSON");
          setSuggestions(parsedJson);
        }
        
        // Always turn off edit mode, even if parsing failed
        console.log("Setting isEditingSuggestions to false");
        setIsEditingSuggestions(false);
        
      } catch (error) {
        console.error("Error in toggleEditMode:", error);
        // Still exit edit mode even if there was an error
        setIsEditingSuggestions(false);
      }
    } else {
      console.log("Entering edit mode");
      setIsEditingSuggestions(true);
    }
    
    // Add a timeout to verify the state was changed
    setTimeout(() => {
      console.log("State after toggleEditMode:", { isEditingSuggestions });
    }, 100);
    
  }, [isEditingSuggestions, editableSuggestions, parseJSON, setSuggestions]);

  /**
   * Format the JSON to make it more readable
   */
  const formatJSON = useCallback(() => {
    try {
      const parsed = JSON.parse(editableSuggestions);
      const formatted = JSON.stringify(parsed, null, 2);
      setEditableSuggestions(formatted);
      setChatError('');
      console.log("JSON formatted successfully");
    } catch (error) {
      console.error("Error formatting JSON:", error);
      setChatError('Invalid JSON format. Please fix before creating mind map.');
    }
  }, [editableSuggestions, setEditableSuggestions, setChatError]);

  /**
   * Handle editing the JSON suggestions
   */
  const handleEditSuggestions = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditableSuggestions(e.target.value);
    // Clear error message as user types to fix the issue
    if (chatError?.includes('Invalid JSON')) {
      setChatError(null);
    }
  }, [chatError, setChatError]);

  /**
   * Clear the AI suggestions and reset related state
   */
  const clearSuggestions = useCallback(() => {
    setSuggestions(null);
    setEditableSuggestions('');
    setChatError(null);
    setIsEditingSuggestions(false);
  }, [setSuggestions, setEditableSuggestions, setChatError, setIsEditingSuggestions]);

  /**
   * Generate a unique ID for nodes and edges
   * Uses a combination of timestamp, counter, and random component to ensure uniqueness
   */
  const generateUniqueId = (prefix: string): string => {
    let counter;
    switch (prefix) {
      case 'node':
        counter = ++nodeCounter;
        break;
      case 'edge':
        counter = ++edgeCounter;
        break;
      case 'node-concept':
        counter = ++conceptCounter;
        break;
      case 'node-sub':
        counter = ++subBranchCounter;
        break;
      case 'node-subsub':
        counter = ++subSubBranchCounter;
        break;
      default:
        counter = Math.floor(Math.random() * 10000);
    }
    
    return `${prefix}-${Date.now()}-${counter}-${Math.random().toString(36).substring(2, 9)}`;
  };

  /**
   * Create branch nodes from AI suggestions
   * This will automatically create new nodes based on the AI response
   * and connect them to the current node
   */
  const createBranchesFromSuggestions = useCallback(() => {
    console.log("Creating branches with state:", { 
      isEditingSuggestions, 
      editableSuggestions, 
      suggestions 
    });
    
    // Reset counters for this new mind map
    nodeCounter = 0;
    edgeCounter = 0;
    conceptCounter = 0;
    subBranchCounter = 0;
    subSubBranchCounter = 0;
    
    // Track IDs to ensure uniqueness
    const idSet = new Set<string>();
    
    // Helper function to ensure unique IDs
    const ensureUniqueId = (id: string): string => {
      if (idSet.has(id)) {
        const newId = `${id}-${Math.random().toString(36).substring(2, 9)}`;
        console.warn(`Duplicate ID detected: ${id}. Created new ID: ${newId}`);
        idSet.add(newId);
        return newId;
      }
      idSet.add(id);
      return id;
    };
    
    // Always try to use the editableSuggestions first since it's the most up-to-date
    let currentSuggestions = null;
    
    try {
      if (editableSuggestions) {
        // Parse the current editable suggestions
        const parsedJson = JSON.parse(editableSuggestions);
        console.log("Using parsed editable suggestions:", parsedJson);
        currentSuggestions = parsedJson;
      } else if (suggestions) {
        // Fall back to the suggestions state if no editable text
        console.log("Using stored suggestions:", suggestions);
        currentSuggestions = suggestions;
      }
    } catch (error) {
      console.error("Error parsing suggestions:", error);
      setChatError('Invalid JSON format. Please fix before creating mind map.');
      return;
    }

    if (!currentSuggestions || !selectedNode) {
      console.warn("No suggestions or node selected");
      return;
    }
    
    console.log("Creating mind map with suggestions:", currentSuggestions);
    
    // Get the categories and concepts from the suggestions
    const categories = Object.keys(currentSuggestions);
    if (categories.length === 0) {
      console.warn('No categories found in suggestions');
      return;
    }
    
    // Define node size and spacing constants
    const NODE_HEIGHT = 150;
    const CATEGORY_MARGIN_BOTTOM = 40; // Extra margin between category sections
    const BASE_HORIZONTAL_SPACING = 300; // Base horizontal distance between parent and children
    const NODE_WIDTH_ESTIMATION_FACTOR = 15; // Pixels per character for width estimation
    const MIN_NODE_WIDTH = 150; // Minimum width for a node
    const HORIZONTAL_SAFETY_MARGIN = 50; // Extra safety margin to prevent horizontal overlaps
    const VERTICAL_SAFETY_MARGIN = 30; // Extra safety margin to prevent vertical overlaps
    const CATEGORY_X_OFFSET = BASE_HORIZONTAL_SPACING; // Distance from parent to category
    const CONCEPT_X_OFFSET = BASE_HORIZONTAL_SPACING; // Distance from category to concept
    const SUB_BRANCH_X_OFFSET = BASE_HORIZONTAL_SPACING; // Horizontal offset for sub-branches
    const SUB_BRANCH_Y_OFFSET = 150; // Vertical spacing between sub-branches (increased from 100)
    const SUB_SUB_BRANCH_X_OFFSET = BASE_HORIZONTAL_SPACING; // Horizontal offset for sub-sub-branches
    const SUB_SUB_BRANCH_Y_OFFSET = 150; // Vertical spacing between sub-sub-branches (increased from 100)
    
    /**
     * Estimate node dimensions based on content
     * @param label The node label text
     * @param content The node content HTML
     * @returns Estimated width and height
     */
    const estimateNodeDimensions = (label: string, content: string = '') => {
      // Since we're now formatting with max 3 words per line,
      // calculate the max width needed for any line
      const getLongestLine = (text: string): number => {
        if (!text) return 0;
        
        const words = text.split(/\s+/);
        let maxLength = 0;
        
        // Check length of each 3-word group
        for (let i = 0; i < words.length; i += 3) {
          const lineWords = words.slice(i, Math.min(i + 3, words.length));
          const lineLength = lineWords.join(' ').length;
          maxLength = Math.max(maxLength, lineLength);
        }
        
        return maxLength;
      };
      
      // Get the longest line from content, removing HTML tags first
      const contentText = content.replace(/<[^>]*>/g, '');
      const contentLongestLine = getLongestLine(contentText);
      
      // Get the longest line from label
      const labelLongestLine = getLongestLine(label);
      
      // Calculate width based on the longer of label or content's longest line
      const longestText = Math.max(labelLongestLine, contentLongestLine);
      
      // Calculate width (characters * estimation factor, with minimum width)
      const estimatedWidth = Math.max(
        MIN_NODE_WIDTH,
        longestText * NODE_WIDTH_ESTIMATION_FACTOR
      );
      
      // Calculate height based on content complexity
      let estimatedHeight = NODE_HEIGHT;
      
      // Count <br> tags to estimate lines
      if (content) {
        const lineCount = (content.match(/<br \/>/g) || []).length + 1;
        // Add height for each line
        estimatedHeight += lineCount * 20;
      }
      
      return { width: estimatedWidth, height: estimatedHeight };
    };
    
    /**
     * Check if a proposed node position would overlap with existing nodes and newly created nodes
     * @param x Proposed X position
     * @param y Proposed Y position
     * @param width Node width
     * @param height Node height
     * @param createdNodesInSession Array of nodes created in the current session
     * @returns True if position is clear, false if overlapping
     */
    const isPositionClear = (
      x: number, 
      y: number, 
      width: number, 
      height: number, 
      createdNodesInSession: Node[] = []
    ) => {
      // Add safety margins to dimensions
      const safetyWidth = width + HORIZONTAL_SAFETY_MARGIN;
      const safetyHeight = height + VERTICAL_SAFETY_MARGIN;
      
      // Check against all existing nodes
      const allNodesToCheck = [...nodes, ...createdNodesInSession];
      
      for (const node of allNodesToCheck) {
        // Skip nodes without valid position
        if (!node.position) continue;
        
        // Estimate existing node dimensions
        const nodeContent = node.data.content?.text || '';
        const nodeDimensions = estimateNodeDimensions(node.data.label || '', nodeContent);
        
        // Check for overlap using bounding boxes with safety margins
        const existingLeft = node.position.x - HORIZONTAL_SAFETY_MARGIN/2;
        const existingRight = node.position.x + nodeDimensions.width + HORIZONTAL_SAFETY_MARGIN/2;
        const existingTop = node.position.y - VERTICAL_SAFETY_MARGIN/2;
        const existingBottom = node.position.y + nodeDimensions.height + VERTICAL_SAFETY_MARGIN/2;
        
        const newLeft = x - HORIZONTAL_SAFETY_MARGIN/2;
        const newRight = x + safetyWidth;
        const newTop = y - VERTICAL_SAFETY_MARGIN/2;
        const newBottom = y + safetyHeight;
        
        // If there's overlap in both x and y directions, the nodes overlap
        if (
          newRight > existingLeft && 
          newLeft < existingRight && 
          newBottom > existingTop && 
          newTop < existingBottom
        ) {
          console.log(`Overlap detected between new node at (${x},${y}) and existing node at (${node.position.x},${node.position.y})`);
          return false;
        }
      }
      
      return true;
    };
    
    /**
     * Find a clear position for a new node
     * @param baseX Desired X position
     * @param baseY Desired Y position
     * @param width Node width
     * @param height Node height
     * @param createdNodesInSession Array of nodes created in the current session
     * @returns Clear position coordinates
     */
    const findClearPosition = (
      baseX: number, 
      baseY: number, 
      width: number, 
      height: number,
      createdNodesInSession: Node[] = []
    ) => {
      // Try the original position first
      if (isPositionClear(baseX, baseY, width, height, createdNodesInSession)) {
        return { x: baseX, y: baseY };
      }
      
      console.log(`Finding clear position for node. Base position: (${baseX},${baseY})`);
      
      // Try increasing vertical offsets first
      for (let yOffset = 50; yOffset <= 500; yOffset += 50) {
        // Try below
        if (isPositionClear(baseX, baseY + yOffset, width, height, createdNodesInSession)) {
          console.log(`Found clear position below at (${baseX},${baseY + yOffset})`);
          return { x: baseX, y: baseY + yOffset };
        }
        
        // Try above
        if (isPositionClear(baseX, baseY - yOffset, width, height, createdNodesInSession)) {
          console.log(`Found clear position above at (${baseX},${baseY - yOffset})`);
          return { x: baseX, y: baseY - yOffset };
        }
      }
      
      // If vertical adjustments don't work, try increasing horizontal distance
      for (let xOffset = 50; xOffset <= 500; xOffset += 50) {
        if (isPositionClear(baseX + xOffset, baseY, width, height, createdNodesInSession)) {
          console.log(`Found clear position with extra horizontal offset at (${baseX + xOffset},${baseY})`);
          return { x: baseX + xOffset, y: baseY };
        }
      }
      
      // Try a grid of positions with both horizontal and vertical offsets
      for (let xOffset = 50; xOffset <= 500; xOffset += 50) {
        for (let yOffset = 50; yOffset <= 500; yOffset += 50) {
          if (isPositionClear(baseX + xOffset, baseY + yOffset, width, height, createdNodesInSession)) {
            console.log(`Found clear position with combined offsets at (${baseX + xOffset},${baseY + yOffset})`);
            return { x: baseX + xOffset, y: baseY + yOffset };
          }
        }
      }
      
      // Last resort: place far away
      console.log(`Using last resort positioning with large offsets`);
      return { x: baseX + 600, y: baseY + 300 };
    };
    
    // Make sure we're not creating the mind map if there's no selected node
    if (!selectedNode) {
      console.error("Cannot create mind map: No node selected");
      setChatError("Please select a node before creating a mind map");
      return;
    }
    
    // Calculate total height needed for all categories and their concepts
    const getCategoryHeight = (categoryItems: ConceptItem[]) => {
      // Base height for the category and its direct concepts
      let height = NODE_HEIGHT + (categoryItems.length * NODE_HEIGHT);
      
      // Add height for sub-branches and sub-sub-branches
      categoryItems.forEach(item => {
        if (item.sub_branches && Array.isArray(item.sub_branches)) {
          const subBranchCount = item.sub_branches.length;
          
          // Calculate height needed for all sub-branches
          let subBranchesHeight = subBranchCount * SUB_BRANCH_Y_OFFSET;
          
          // Check for sub-sub-branches and add their height
          item.sub_branches.forEach((subItem: SubBranchItem) => {
            if (subItem.sub_branches && Array.isArray(subItem.sub_branches)) {
              // For each sub-branch that has sub-sub-branches, add extra height
              const subSubBranchCount = subItem.sub_branches.length;
              subBranchesHeight += subSubBranchCount * SUB_SUB_BRANCH_Y_OFFSET;
            }
          });
          
          // Add the calculated sub-branch height to total height
          height += subBranchesHeight;
        }
      });
      
      // Add margin between categories
      return height + CATEGORY_MARGIN_BOTTOM;
    };
    
    // Calculate total height needed for the entire mind map
    let totalHeight = 0;
    categories.forEach(category => {
      const categoryItems = currentSuggestions[category];
      if (!Array.isArray(categoryItems) || categoryItems.length === 0) return;
      totalHeight += getCategoryHeight(categoryItems);
    });
    
    // Calculate safe starting positions for the mind map
    const getBasePosition = () => {
      if (!selectedNode) {
        console.warn("No selected node found, using default position");
        return { x: window.innerWidth / 2 - BASE_HORIZONTAL_SPACING, y: window.innerHeight / 2 };
      }
      
      // Check if the selected node has a valid position
      if (selectedNode.position && 
          typeof selectedNode.position.x === 'number' && 
          typeof selectedNode.position.y === 'number') {
        return selectedNode.position;
      }
      
      // If position is undefined or has invalid coordinates
      console.warn("Selected node has invalid position properties:", selectedNode.position);
      
      // Look for other nodes to get a reasonable position
      const otherNodes = nodes.filter(n => n.id !== selectedNode.id && n.position);
      if (otherNodes.length > 0) {
        // Use the position of another node as reference
        const referenceNode = otherNodes[0];
        console.log("Using reference node for positioning:", referenceNode.id);
        return {
          x: referenceNode.position.x,
          y: referenceNode.position.y
        };
      }
      
      // Fallback to center of viewport if position is invalid
      console.warn("No valid reference positions found, using center of viewport");
      return { x: window.innerWidth / 2 - BASE_HORIZONTAL_SPACING, y: window.innerHeight / 2 };
    };
    
    // Get base position for the mind map
    const basePosition = getBasePosition();
    
    // Keep track of nodes created in this session
    const sessionNodes: Node[] = [];
    const sessionEdges: Edge[] = [];
    
    // All nodes and edges including existing ones
    const createdNodes = [...nodes];
    const createdEdges = [...edges];
    
    // Starting vertical position - center the entire structure
    let currentY = basePosition.y - totalHeight / 2;
    
    // For each category, create a section with its concepts
    categories.forEach((category) => {
      // Track nodes created for this category branch
      const categoryBranchNodes: Node[] = [];
      
      const categoryItems = currentSuggestions[category];
      if (!Array.isArray(categoryItems) || categoryItems.length === 0) return;
      
      // Calculate spacing for this category's section
      const categoryHeight = getCategoryHeight(categoryItems);
      
      // Calculate desired position for category node
      const desiredCategoryPosition = {
        x: basePosition.x + CATEGORY_X_OFFSET, // Distance from parent to category
        y: currentY + NODE_HEIGHT // Position at the top of its section
      };
      
      // Estimate dimensions for category node
      const categoryDimensions = estimateNodeDimensions(category);
      
      // Find a clear position for the category node
      const categoryNodePosition = findClearPosition(
        desiredCategoryPosition.x, 
        desiredCategoryPosition.y, 
        categoryDimensions.width, 
        categoryDimensions.height,
        sessionNodes
      );
      
      // Create the category node
      const categoryNodeId = ensureUniqueId(generateUniqueId('node'));
      const categoryNode: Node = {
        id: categoryNodeId,
        type: 'textNode',
        position: categoryNodePosition,
        data: {
          label: category,
          content: {
            text: '', // No need to duplicate the category name in the content
            images: [],
            isHtml: true // Ensure isHtml is set to true
          }
        },
        draggable: true
      };
      
      // Debug node positions
      console.log(`Created category node "${category}" at position:`, categoryNodePosition);
      
      // Connect from the parent node to this category
      const categoryEdge: Edge = {
        id: ensureUniqueId(generateUniqueId('edge')),
        source: selectedNode.id,
        target: categoryNodeId,
        type: 'default',
        sourceHandle: Position.Right,
        targetHandle: Position.Left
      };
      
      // Add to session tracking arrays
      sessionNodes.push(categoryNode);
      sessionEdges.push(categoryEdge);
      categoryBranchNodes.push(categoryNode);
      
      // Add to main creation arrays
      createdNodes.push(categoryNode);
      createdEdges.push(categoryEdge);
      
      // Track vertical position for concepts
      let conceptY = categoryNodePosition.y + NODE_HEIGHT;
      
      // Create concept nodes for this category
      categoryItems.forEach((item, itemIndex) => {
        console.log(`Processing item ${itemIndex}:`, item);
        
        // Make sure item is correctly processed - this is the core issue
        let conceptTitle, conceptReason;
        
        if (typeof item === 'string') {
          console.log(`Item ${itemIndex} is a string:`, item);
          conceptTitle = item;
          conceptReason = '';
        } else if (item && typeof item === 'object') {
          console.log(`Item ${itemIndex} is an object with properties:`, Object.keys(item));
          
          // Handle item.title correctly
          if (typeof item.title === 'string') {
            conceptTitle = item.title;
          } else if (item.title) {
            console.warn(`Item ${itemIndex} has non-string title:`, item.title);
            conceptTitle = String(item.title); // Convert to string if possible
          } else {
            console.warn(`Item ${itemIndex} missing title, using placeholder`);
            conceptTitle = `Concept ${itemIndex + 1}`;
          }
          
          // Handle item.reason correctly
          if (typeof item.reason === 'string') {
            conceptReason = item.reason;
          } else if (item.reason) {
            console.warn(`Item ${itemIndex} has non-string reason:`, item.reason);
            conceptReason = String(item.reason); // Convert to string if possible
          } else {
            conceptReason = '';
          }
        } else {
          console.error(`Item ${itemIndex} has unexpected type:`, typeof item);
          conceptTitle = `Concept ${itemIndex + 1}`;
          conceptReason = '';
        }
        
        // DEBUG: Log the processed title and reason
        console.log(`Processed concept node: "${conceptTitle}" with reason: "${conceptReason}"`);
        
        // Make sure we're not directly converting objects to strings in the HTML, which would display as [object Object]
        const safeConceptTitle = typeof conceptTitle === 'string' ? conceptTitle : JSON.stringify(conceptTitle);
        const safeConceptReason = typeof conceptReason === 'string' ? conceptReason : JSON.stringify(conceptReason);
        
        // Create HTML content with ONLY the reason (no title)
        let conceptContent = "";
        if (safeConceptReason && safeConceptReason.trim() !== '') {
          // Display only the reason text, since title is already shown as node label
          conceptContent = formatCompactText(safeConceptReason);
        } else {
          console.warn(`Missing reason for concept: ${safeConceptTitle}`);
          conceptContent = `<p class="text-gray-400 italic">No description provided</p>`;
        }
        
        // Calculate desired position for concept node
        const desiredConceptPosition = {
          x: categoryNodePosition.x + CONCEPT_X_OFFSET, // Distance from category to concept
          y: conceptY
        };
        
        // Estimate dimensions for concept node
        const conceptDimensions = estimateNodeDimensions(safeConceptTitle, conceptContent);
        
        // Find a clear position for the concept node
        const conceptNodePosition = findClearPosition(
          desiredConceptPosition.x, 
          desiredConceptPosition.y, 
          conceptDimensions.width, 
          conceptDimensions.height,
          sessionNodes
        );
        
        // Debug node positions
        console.log(`Creating concept node "${safeConceptTitle}" with dimensions ${conceptDimensions.width}x${conceptDimensions.height}`);
        console.log(`Desired position: (${desiredConceptPosition.x},${desiredConceptPosition.y}), Actual clear position: (${conceptNodePosition.x},${conceptNodePosition.y})`);
        
        const conceptNodeId = ensureUniqueId(generateUniqueId('node-concept'));
        const conceptNode: Node = {
          id: conceptNodeId,
          type: 'textNode',
          position: conceptNodePosition,
          data: {
            label: safeConceptTitle,
            content: {
              text: conceptContent,
              images: [],
              isHtml: true // Ensure isHtml is set to true
            }
          },
          draggable: true
        };
        
        // Debug node positions
        console.log(`Created concept node "${safeConceptTitle}" at position:`, conceptNode.position, 
          `(X offset from category: ${CONCEPT_X_OFFSET}, total X from root: ${basePosition.x + CATEGORY_X_OFFSET + CONCEPT_X_OFFSET})`);
        
        // Connect concept to category
        const conceptEdge: Edge = {
          id: ensureUniqueId(generateUniqueId('edge')),
          source: categoryNodeId,
          target: conceptNodeId,
          type: 'default',
          sourceHandle: Position.Right,
          targetHandle: Position.Left
        };
        
        sessionNodes.push(conceptNode);
        sessionEdges.push(conceptEdge);
        categoryBranchNodes.push(conceptNode);
        
        // Create sub-branches if present
        if (item.sub_branches && Array.isArray(item.sub_branches) && item.sub_branches.length > 0) {
          // Starting Y position for sub-branches
          let subBranchY = conceptY - ((item.sub_branches.length * SUB_BRANCH_Y_OFFSET) / 2);
          let previousSubBranchHeight = 0;
          
          // Track sub-branch nodes to handle potential sub-sub-branches
          const conceptBranchNodes: Node[] = [];
          
          item.sub_branches.forEach((subItem: SubBranchItem, subIndex: number) => {
            // Create sub-branch node
            const subBranchTitle = typeof subItem === 'string' ? subItem : 
              (typeof subItem.title === 'string' ? subItem.title : `Sub-concept ${subIndex + 1}`);
            const subBranchReason = typeof subItem === 'string' ? '' : 
              (typeof subItem.reason === 'string' ? subItem.reason : '');
            
            // Make sure we're not directly converting objects to strings in the HTML
            const safeSubBranchTitle = typeof subBranchTitle === 'string' ? subBranchTitle : JSON.stringify(subBranchTitle);
            const safeSubBranchReason = typeof subBranchReason === 'string' ? subBranchReason : JSON.stringify(subBranchReason);
            
            // Create HTML content with ONLY the reason (no title)
            let subBranchContent = "";
            if (safeSubBranchReason && safeSubBranchReason.trim() !== '') {
              // Display only the reason text, since title is already shown as node label
              subBranchContent = formatCompactText(safeSubBranchReason);
            } else {
              console.warn(`Missing reason for sub-branch: ${safeSubBranchTitle}`);
              subBranchContent = `<p class="text-gray-400 italic">No description provided</p>`;
            }
            
            // Apply some spacing adjustment based on previous sub-branch's height
            subBranchY += previousSubBranchHeight;
            
            // Check for sub-sub-branches and calculate extra height requirements
            const hasSubSubBranches = subItem.sub_branches && 
                                     Array.isArray(subItem.sub_branches) && 
                                     subItem.sub_branches.length > 0;
            
            const subSubBranchCount = hasSubSubBranches && subItem.sub_branches ? subItem.sub_branches.length : 0;
            
            // Calculate desired position for sub-branch node
            const desiredSubBranchPosition = {
              x: conceptNode.position.x + SUB_BRANCH_X_OFFSET,
              y: subBranchY
            };
            
            // Estimate dimensions for sub-branch node
            const subBranchDimensions = estimateNodeDimensions(safeSubBranchTitle, subBranchContent);
            
            // Find a clear position for the sub-branch node
            const subBranchNodePosition = findClearPosition(
              desiredSubBranchPosition.x, 
              desiredSubBranchPosition.y, 
              subBranchDimensions.width, 
              subBranchDimensions.height,
              sessionNodes
            );
            
            // Debug node positions
            console.log(`Creating sub-branch node "${safeSubBranchTitle}" with dimensions ${subBranchDimensions.width}x${subBranchDimensions.height}`);
            console.log(`Desired position: (${desiredSubBranchPosition.x},${desiredSubBranchPosition.y}), Actual clear position: (${subBranchNodePosition.x},${subBranchNodePosition.y})`);
            
            const subBranchNodeId = ensureUniqueId(generateUniqueId('node-sub'));
            const subBranchNode: Node = {
              id: subBranchNodeId,
              type: 'textNode',
              position: subBranchNodePosition,
              data: {
                label: safeSubBranchTitle,
                content: {
                  text: subBranchContent,
                  images: [],
                  isHtml: true // Ensure isHtml is set to true
                }
              },
              draggable: true
            };

            // Connect sub-branch to concept
            const subBranchEdge: Edge = {
              id: ensureUniqueId(generateUniqueId('edge')),
              source: conceptNodeId,
              target: subBranchNodeId,
              type: 'default',
              sourceHandle: Position.Right,
              targetHandle: Position.Left
            };
            
            // Add to session tracking arrays
            sessionNodes.push(subBranchNode);
            sessionEdges.push(subBranchEdge);
            conceptBranchNodes.push(subBranchNode);
            
            // Handle sub-sub-branches if present
            if (hasSubSubBranches && subItem.sub_branches) {
              // Starting Y position for sub-sub-branches, centered on parent sub-branch
              let subSubBranchY = subBranchY - ((subSubBranchCount * SUB_SUB_BRANCH_Y_OFFSET) / 2);
              
              // Ensure minimum spacing between sub-branches with sub-sub-branches
              previousSubBranchHeight = Math.max(
                SUB_BRANCH_Y_OFFSET * 1.5, // Ensure at least 1.5x normal spacing
                subSubBranchCount * SUB_SUB_BRANCH_Y_OFFSET / 2 // Or half the space needed for sub-sub-branches
              );
              
              // Track sub-sub-branch nodes
              const subSubBranchNodes: Node[] = [];
              
              subItem.sub_branches.forEach((subSubItem: SubBranchItem, subSubIndex: number) => {
                // Extract title and reason
                const subSubBranchTitle = typeof subSubItem === 'string' ? subSubItem : 
                  (typeof subSubItem.title === 'string' ? subSubItem.title : `Sub-sub-concept ${subSubIndex + 1}`);
                const subSubBranchReason = typeof subSubItem === 'string' ? '' : 
                  (typeof subSubItem.reason === 'string' ? subSubItem.reason : '');
                
                // Make safe versions for HTML
                const safeSubSubBranchTitle = typeof subSubBranchTitle === 'string' ? 
                  subSubBranchTitle : JSON.stringify(subSubBranchTitle);
                const safeSubSubBranchReason = typeof subSubBranchReason === 'string' ? 
                  subSubBranchReason : JSON.stringify(subSubBranchReason);
                
                // Create HTML content for sub-sub-branch
                let subSubBranchContent = "";
                if (safeSubSubBranchReason && safeSubSubBranchReason.trim() !== '') {
                  subSubBranchContent = formatCompactText(safeSubSubBranchReason);
                } else {
                  subSubBranchContent = `<p class="text-gray-400 italic">No description provided</p>`;
                }
                
                // Calculate desired position for sub-sub-branch node
                const desiredSubSubBranchPosition = {
                  x: subBranchNodePosition.x + SUB_SUB_BRANCH_X_OFFSET,
                  y: subSubBranchY
                };
                
                // Estimate dimensions for sub-sub-branch node
                const subSubBranchDimensions = estimateNodeDimensions(safeSubSubBranchTitle, subSubBranchContent);
                
                // Find a clear position for the sub-sub-branch node
                const subSubBranchNodePosition = findClearPosition(
                  desiredSubSubBranchPosition.x, 
                  desiredSubSubBranchPosition.y, 
                  subSubBranchDimensions.width, 
                  subSubBranchDimensions.height,
                  sessionNodes
                );
                
                // Debug node positions
                console.log(`Creating sub-sub-branch node "${safeSubSubBranchTitle}" with dimensions ${subSubBranchDimensions.width}x${subSubBranchDimensions.height}`);
                
                const subSubBranchNodeId = ensureUniqueId(generateUniqueId('node-subsub'));
                const subSubBranchNode: Node = {
                  id: subSubBranchNodeId,
                  type: 'textNode',
                  position: subSubBranchNodePosition,
                  data: {
                    label: safeSubSubBranchTitle,
                    content: {
                      text: subSubBranchContent,
                      images: [],
                      isHtml: true
                    }
                  },
                  draggable: true
                };

                // Connect to parent sub-branch
                const subSubBranchEdge: Edge = {
                  id: ensureUniqueId(generateUniqueId('edge')),
                  source: subBranchNodeId,
                  target: subSubBranchNodeId,
                  type: 'default',
                  sourceHandle: Position.Right,
                  targetHandle: Position.Left
                };
                
                // Add to tracking arrays
                sessionNodes.push(subSubBranchNode);
                sessionEdges.push(subSubBranchEdge);
                subSubBranchNodes.push(subSubBranchNode);
                conceptBranchNodes.push(subSubBranchNode);
                
                // Update Y position for next sub-sub-branch
                subSubBranchY += SUB_SUB_BRANCH_Y_OFFSET;
              });
              
            } else {
              // Regular sub-branch without children
              previousSubBranchHeight = SUB_BRANCH_Y_OFFSET;
            }
          });
          
          // Update conceptY to account for sub-branches
          conceptY += Math.max(NODE_HEIGHT, previousSubBranchHeight * item.sub_branches.length);
        } else {
          // No sub-branches, just move to next concept
          conceptY += NODE_HEIGHT;
        }
      });
      
      // Update current Y position for the next category section
      currentY += categoryHeight;
    });
    
    // Now update the Redux store with all created nodes and edges at once
    createdNodes.push(...sessionNodes);
    createdEdges.push(...sessionEdges);
    
    dispatch(updateNodes(createdNodes));
    dispatch(updateEdges(createdEdges));
    
    // Clear the suggestions after creating the mind map
    setSuggestions(null);
    setEditableSuggestions('');
    
  }, [suggestions, editableSuggestions, selectedNode, nodes, edges, dispatch, isEditingSuggestions, setSuggestions, setEditableSuggestions, setChatError]);
  
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
        content: `Please provide your response in a valid JSON format with categories as keys and arrays of concept objects as values. Each concept object should include a "title" and a "reason" explaining why it's important. Optionally, concepts can have "sub_branches" for deeper exploration. For example: 
{
  "Category 1": [
    {
      "title": "Concept 1",
      "reason": "Why this concept is important",
      "sub_branches": [
        {"title": "Sub-concept A", "reason": "Explanation for this sub-concept"}
      ]
    }
  ],
  "Category 2": [
    {"title": "Concept 2", "reason": "Justification for this concept"}
  ]
}
This structure will be used to automatically create a mind map with meaningful content.`
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
        console.log("Raw API response data type:", typeof resp.data);
        console.log("Raw API response:", JSON.stringify(resp.data, null, 2));
        
        // Verify that we've actually got the right format - Object with array values
        let hasCorrectFormat = true;
        try {
          if (typeof resp.data !== 'object' || Array.isArray(resp.data)) {
            console.error("API response is not an object:", resp.data);
            hasCorrectFormat = false;
          } else {
            // Check each category and its items
            Object.entries(resp.data).forEach(([category, items], categoryIndex) => {
              console.log(`Category ${categoryIndex}: "${category}" with items:`, items);
              
              if (!Array.isArray(items)) {
                console.error(`Category "${category}" does not contain an array:`, items);
                hasCorrectFormat = false;
                // Try to fix it by converting to an array if possible
                if (items && typeof items === 'object') {
                  console.log(`Attempting to convert category "${category}" to proper format`);
                  const fixedItems = [];
                  for (const [key, value] of Object.entries(items)) {
                    console.log(`Processing entry with key "${key}" and value:`, value);
                    if (typeof value === 'string') {
                      fixedItems.push({ title: key, reason: value });
                    } else if (value && typeof value === 'object') {
                      fixedItems.push({ 
                        title: key, 
                        reason: JSON.stringify(value)
                      });
                    }
                  }
                  console.log(`Fixed items for category "${category}":`, fixedItems);
                  resp.data[category] = fixedItems;
                }
              } else {
                // Process each item in the array
                items.forEach((item, itemIndex) => {
                  console.log(`Item ${itemIndex} in category "${category}":`, item);
                  
                  if (typeof item === 'string') {
                    console.log(`Converting string item to object: ${item}`);
                    resp.data[category][itemIndex] = {
                      title: item,
                      reason: "No reason provided"
                    };
                  } else if (item && typeof item === 'object') {
                    if (!item.title) {
                      console.warn(`Item ${itemIndex} in category "${category}" missing title:`, item);
                      resp.data[category][itemIndex].title = `Concept ${itemIndex + 1}`;
                    } else if (typeof item.title !== 'string') {
                      console.warn(`Item ${itemIndex} in category "${category}" has non-string title:`, item.title);
                      resp.data[category][itemIndex].title = String(item.title);
                    }
                    
                    if (!item.reason) {
                      console.warn(`Item ${itemIndex} in category "${category}" missing reason`);
                      resp.data[category][itemIndex].reason = "No reason provided";
                    } else if (typeof item.reason !== 'string') {
                      console.warn(`Item ${itemIndex} in category "${category}" has non-string reason:`, item.reason);
                      resp.data[category][itemIndex].reason = String(item.reason);
                    }
                  } else {
                    console.warn(`Invalid item ${itemIndex} in category "${category}":`, item);
                    resp.data[category][itemIndex] = {
                      title: `Concept ${itemIndex + 1}`,
                      reason: "Invalid data converted to concept"
                    };
                  }
                });
              }
            });
          }
        } catch (err) {
          console.error("Error validating/fixing response structure:", err);
          hasCorrectFormat = false;
        }
        
        if (!hasCorrectFormat) {
          console.warn("API response format issues detected, attempted to fix");
        }
        
        console.log("Final processed data:", JSON.stringify(resp.data, null, 2));
        
        setSuggestions(resp.data);
        // Initialize editable suggestions with the JSON response
        setEditableSuggestions(JSON.stringify(resp.data, null, 2));
        setIsEditingSuggestions(false); // Make sure we're in view mode initially
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
   * Fetch and store API keys, validity, models for each provider; select default provider
   */
  useEffect(() => {
    const fetchApiKeys = async () => {
      try {
        const data = await authService.get('/settings/api-keys') as Record<string, {
          key: string;
          isValid: boolean;
          models?: string[];
          selectedModel?: string;
        }>;
        
        // Build new providers map without referencing the existing providers state
        const updated: Record<ApiProvider, {
          key: string;
          isValid: boolean;
          models: string[];
          selectedModel: string;
        }> = {} as Record<ApiProvider, {
          key: string;
          isValid: boolean;
          models: string[];
          selectedModel: string;
        }>; 
        
        PROVIDERS.forEach((p) => {
          const pd = data[p];
          if (pd) {
            updated[p] = {
              key: pd.key,
              isValid: !!pd.isValid,
              models: pd.models || [],
              selectedModel: pd.selectedModel || (pd.models?.[0] || ''),
            };
          } else {
            // Initialize with empty values if no data found
            updated[p] = {
              key: '',
              isValid: false,
              models: [],
              selectedModel: '',
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
      } catch (err) {
        console.error('Failed to load API keys', err);
      }
    };
    
    fetchApiKeys();
  }, []);
  
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
          
          {/* Editable AI Suggestions */}
          {editableSuggestions && (
            <div className="mt-4 border border-gray-300 rounded p-2">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-medium">AI Suggestions</h4>
                <div className="flex gap-2">
                  {isEditingSuggestions && (
                    <button
                      onClick={formatJSON}
                      className="px-2 py-1 text-gray-600 text-xs rounded hover:bg-gray-100"
                      title="Format JSON"
                    >
                      📋 Format
                    </button>
                  )}
                  <button
                    onClick={clearSuggestions}
                    className="px-2 py-1 text-gray-600 text-xs rounded hover:bg-gray-100"
                    title="Clear suggestions"
                  >
                    🗑️ Clear
                  </button>
                  <button
                    onClick={toggleEditMode}
                    className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                    title={isEditingSuggestions ? "Save changes" : "Edit suggestions"}
                  >
                    {isEditingSuggestions ? "✓ Done" : "✎ Edit"}
                  </button>
                  <button
                    onClick={createBranchesFromSuggestions}
                    className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                    title="Create a mind map from these suggestions"
                    disabled={isEditingSuggestions && chatError?.includes('Invalid JSON')}
                  >
                    ✨ Create Mind Map
                  </button>
                </div>
              </div>
              
              {isEditingSuggestions ? (
                <textarea 
                  value={editableSuggestions}
                  onChange={handleEditSuggestions}
                  className="w-full h-64 p-2 bg-gray-50 font-mono text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder='{
  "Category 1": ["Idea 1", "Idea 2"],
  "Category 2": ["Idea 3", "Idea 4"]
}'
                />
              ) : (
                <div className="bg-gray-50 p-2 rounded-b h-64 overflow-auto">
                  <pre className="text-sm font-mono text-gray-800">{editableSuggestions}</pre>
                </div>
              )}
              
              {isEditingSuggestions && (
                <div className="mt-2 text-xs text-gray-500">
                  <p>Edit the JSON above to customize your mind map. Make sure to maintain the correct JSON format.</p>
                  <ul className="list-disc ml-4 mt-1">
                    <li>Each key becomes a category node</li>
                    <li>Each array item becomes a child idea node</li>
                    <li>You can add, remove, or modify categories and ideas</li>
                  </ul>
                </div>
              )}
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