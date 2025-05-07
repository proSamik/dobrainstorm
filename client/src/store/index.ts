import { configureStore } from '@reduxjs/toolkit'
import boardReducer from './boardSlice'
import settingsReducer from './settingsSlice'
import modelsReducer from './modelsSlice'
import chatReducer from './chatSlice'
import { persistStore, persistReducer } from 'redux-persist'
import storage from 'redux-persist/lib/storage'
import { combineReducers } from 'redux'

/**
 * Configure redux-persist for settings
 */
const persistConfig = {
  key: 'root',
  storage,
  // Only whitelist specific slices for persistence
  whitelist: ['settings', 'models', 'chat']
}

/**
 * Combine all reducers
 */
const rootReducer = combineReducers({
  board: boardReducer,
  settings: settingsReducer,
  models: modelsReducer,
  chat: chatReducer,
})

/**
 * Create persisted reducer
 */
const persistedReducer = persistReducer(persistConfig, rootReducer)

/**
 * Configure and create the Redux store with all reducers
 */
export const store = configureStore({
  reducer: persistedReducer,
  // Disable SerializableStateInvariantMiddleware to improve performance
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false, // Disable the serializable state check
    }),
})

/**
 * Create the persistor for the store
 */
export const persistor = persistStore(store)

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch 