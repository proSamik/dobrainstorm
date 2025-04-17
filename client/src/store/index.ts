import { configureStore } from '@reduxjs/toolkit'
import boardReducer from './boardSlice'

/**
 * Configure and create the Redux store with all reducers
 */
export const store = configureStore({
  reducer: {
    board: boardReducer,
  },
})

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch 