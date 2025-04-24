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
          } else if (typeof item === 'object' && item !== null) {
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
                item.sub_branches.forEach((subItem: any, subIndex: number) => {
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
    const SUB_BRANCH_X_OFFSET = 200; // Horizontal offset for sub-branches
    const SUB_BRANCH_Y_OFFSET = 100; // Vertical spacing between sub-branches
    
    // Calculate total height needed for all categories and their concepts
    const getCategoryHeight = (categoryItems: any[]) => {
      // Base height for the category and its direct concepts
      let height = NODE_HEIGHT + (categoryItems.length * NODE_HEIGHT);
      
      // Add height for sub-branches if present
      categoryItems.forEach(item => {
        if (item.sub_branches && Array.isArray(item.sub_branches)) {
          // Add space for each sub-branch
          height += item.sub_branches.length * SUB_BRANCH_Y_OFFSET;
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
    
    // All nodes and edges including existing ones
    const createdNodes = [...nodes];
    const createdEdges = [...edges];
    
    // Starting vertical position - center the entire structure
    let currentY = selectedNode.position.y - totalHeight / 2;
    
    // For each category, create a section with its concepts
    categories.forEach((category, categoryIndex) => {
      const categoryItems = currentSuggestions[category];
      if (!Array.isArray(categoryItems) || categoryItems.length === 0) return;
      
      // Calculate spacing for this category's section
      const categoryHeight = getCategoryHeight(categoryItems);
      
      // Position category node to the right of the parent node
      const categoryNodePosition = {
        x: selectedNode.position.x + 500, // Horizontal distance from parent
        y: currentY + NODE_HEIGHT // Position at the top of its section
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
            text: '', // No need to duplicate the category name in the content
            images: [],
            isHtml: true // Ensure isHtml is set to true
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
        let safeConceptTitle = typeof conceptTitle === 'string' ? conceptTitle : JSON.stringify(conceptTitle);
        let safeConceptReason = typeof conceptReason === 'string' ? conceptReason : JSON.stringify(conceptReason);
        
        // Create HTML content with ONLY the reason (no title)
        let conceptContent = "";
        if (safeConceptReason && safeConceptReason.trim() !== '') {
          // Display only the reason text, since title is already shown as node label
          conceptContent = `<p style="color: #4b5563; font-style: italic;">${safeConceptReason}</p>`;
        } else {
          console.warn(`Missing reason for concept: ${safeConceptTitle}`);
          conceptContent = `<p class="text-gray-400 italic">No description provided</p>`;
        }
        
        // DEBUG: Log the final HTML content
        console.log(`Final concept HTML content: ${conceptContent}`);
        
        const conceptNodeId = `node-concept-${Date.now()}-${categoryIndex}-${itemIndex}`;
        const conceptNode: Node = {
          id: conceptNodeId,
          type: 'textNode',
          position: {
            x: categoryNodePosition.x + 300, // Horizontal distance from category
            y: conceptY
          },
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
        
        // Connect concept to category
        const conceptEdge: Edge = {
          id: `edge-${categoryNodeId}-${conceptNodeId}`,
          source: categoryNodeId,
          target: conceptNodeId,
          type: 'default',
          sourceHandle: Position.Right,
          targetHandle: Position.Left
        };
        
        createdNodes.push(conceptNode);
        createdEdges.push(conceptEdge);
        
        // Create sub-branches if present
        if (item.sub_branches && Array.isArray(item.sub_branches) && item.sub_branches.length > 0) {
          // Starting Y position for sub-branches
          let subBranchY = conceptY;
          
          item.sub_branches.forEach((subItem: any, subIndex: number) => {
            console.log(`Processing sub-branch ${subIndex}:`, subItem);
            
            // Handle sub-branch items correctly
            let subBranchTitle, subBranchReason;
            
            if (typeof subItem === 'string') {
              console.log(`Sub-branch ${subIndex} is a string:`, subItem);
              subBranchTitle = subItem;
              subBranchReason = '';
            } else if (subItem && typeof subItem === 'object') {
              console.log(`Sub-branch ${subIndex} is an object with properties:`, Object.keys(subItem));
              
              // Handle subItem.title correctly
              if (typeof subItem.title === 'string') {
                subBranchTitle = subItem.title;
              } else if (subItem.title) {
                console.warn(`Sub-branch ${subIndex} has non-string title:`, subItem.title);
                subBranchTitle = String(subItem.title); // Convert to string if possible
              } else {
                console.warn(`Sub-branch ${subIndex} missing title, using placeholder`);
                subBranchTitle = `Sub-concept ${subIndex + 1}`;
              }
              
              // Handle subItem.reason correctly
              if (typeof subItem.reason === 'string') {
                subBranchReason = subItem.reason;
              } else if (subItem.reason) {
                console.warn(`Sub-branch ${subIndex} has non-string reason:`, subItem.reason);
                subBranchReason = String(subItem.reason); // Convert to string if possible
              } else {
                subBranchReason = '';
              }
            } else {
              console.error(`Sub-branch ${subIndex} has unexpected type:`, typeof subItem);
              subBranchTitle = `Sub-concept ${subIndex + 1}`;
              subBranchReason = '';
            }
            
            // DEBUG: Log the processed title and reason
            console.log(`Processed sub-branch: "${subBranchTitle}" with reason: "${subBranchReason}"`);
            
            // Make sure we're not directly converting objects to strings in the HTML, which would display as [object Object]
            let safeSubBranchTitle = typeof subBranchTitle === 'string' ? subBranchTitle : JSON.stringify(subBranchTitle);
            let safeSubBranchReason = typeof subBranchReason === 'string' ? subBranchReason : JSON.stringify(subBranchReason);
            
            // Create HTML content with ONLY the reason (no title)
            let subBranchContent = "";
            if (safeSubBranchReason && safeSubBranchReason.trim() !== '') {
              // Display only the reason text, since title is already shown as node label
              subBranchContent = `<p style="color: #4b5563; font-style: italic;">${safeSubBranchReason}</p>`;
            } else {
              console.warn(`Missing reason for sub-branch: ${safeSubBranchTitle}`);
              subBranchContent = `<p class="text-gray-400 italic">No description provided</p>`;
            }
            
            // DEBUG: Log the final HTML content
            console.log(`Final sub-branch HTML content: ${subBranchContent}`);
            
            const subBranchNodeId = `node-sub-${Date.now()}-${categoryIndex}-${itemIndex}-${subIndex}`;
            const subBranchNode: Node = {
              id: subBranchNodeId,
              type: 'textNode',
              position: {
                x: conceptNode.position.x + SUB_BRANCH_X_OFFSET,
                y: subBranchY
              },
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
              id: `edge-${conceptNodeId}-${subBranchNodeId}`,
              source: conceptNodeId,
              target: subBranchNodeId,
              type: 'default',
              sourceHandle: Position.Right,
              targetHandle: Position.Left
            };
            
            createdNodes.push(subBranchNode);
            createdEdges.push(subBranchEdge);
            
            // Update Y position for next sub-branch
            subBranchY += SUB_BRANCH_Y_OFFSET;
          });
          
          // Update the conceptY for the next concept, accounting for sub-branches
          conceptY = subBranchY + NODE_HEIGHT;
        } else {
          // No sub-branches, just move to next concept
          conceptY += NODE_HEIGHT;
        }
      });
      
      // Update current Y position for the next category section
      currentY += categoryHeight;
    });
    
    // Now update the Redux store with all created nodes and edges at once
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