'use client'

import { store } from '@/store'
import { Provider } from 'react-redux'

/**
 * Redux provider component that wraps the application with the Redux store
 */
export function ReduxProvider({ children }: { children: React.ReactNode }) {
  return <Provider store={store}>{children}</Provider>
} 