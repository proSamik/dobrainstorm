import { createSlice, PayloadAction } from '@reduxjs/toolkit'

// Define types for the chat state
export interface ChatSession {
  id: string;
  sessionId: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  model?: string;
}

interface ChatState {
  sessions: ChatSession[];
  activeSessions: string[]; // List of active session IDs
}

// Initial state
const initialState: ChatState = {
  sessions: [],
  activeSessions: [],
}

// Create the slice
const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    // Add a new session
    addSession: (state, action: PayloadAction<ChatSession>) => {
      // Check if the session already exists
      const existingIndex = state.sessions.findIndex(
        session => session.sessionId === action.payload.sessionId
      );
      
      if (existingIndex >= 0) {
        // Update existing session
        state.sessions[existingIndex] = {
          ...state.sessions[existingIndex],
          ...action.payload,
          updatedAt: new Date().toISOString(),
        };
      } else {
        // Add new session
        state.sessions.push({
          ...action.payload,
          createdAt: action.payload.createdAt || new Date().toISOString(),
          updatedAt: action.payload.updatedAt || new Date().toISOString(),
        });
      }
      
      // Add to active sessions if not already there
      if (!state.activeSessions.includes(action.payload.sessionId)) {
        state.activeSessions.push(action.payload.sessionId);
      }
    },
    
    // Mark a session as active
    activateSession: (state, action: PayloadAction<string>) => {
      if (!state.activeSessions.includes(action.payload)) {
        state.activeSessions.push(action.payload);
      }
    },
    
    // Mark a session as inactive
    deactivateSession: (state, action: PayloadAction<string>) => {
      state.activeSessions = state.activeSessions.filter(
        sessionId => sessionId !== action.payload
      );
    },
    
    // Update a session's info
    updateSession: (state, action: PayloadAction<{ sessionId: string | null; title?: string; model?: string }>) => {
      const { sessionId, ...updates } = action.payload;
      
      // Skip if sessionId is null
      if (!sessionId) return;
      
      const sessionIndex = state.sessions.findIndex(
        session => session.sessionId === sessionId
      );
      
      if (sessionIndex >= 0) {
        state.sessions[sessionIndex] = {
          ...state.sessions[sessionIndex],
          ...updates,
          updatedAt: new Date().toISOString(),
        };
      }
    },
    
    // Remove a session
    removeSession: (state, action: PayloadAction<string>) => {
      state.sessions = state.sessions.filter(
        session => session.sessionId !== action.payload
      );
      state.activeSessions = state.activeSessions.filter(
        sessionId => sessionId !== action.payload
      );
    },
    
    // Clear all sessions
    clearSessions: (state) => {
      state.sessions = [];
      state.activeSessions = [];
    },
    
    // Set the full list of sessions (e.g., from API)
    setSessions: (state, action: PayloadAction<ChatSession[]>) => {
      state.sessions = action.payload;
    },
  },
});

// Export actions
export const {
  addSession,
  activateSession,
  deactivateSession,
  updateSession,
  removeSession,
  clearSessions,
  setSessions,
} = chatSlice.actions;

// Export reducer
export default chatSlice.reducer; 