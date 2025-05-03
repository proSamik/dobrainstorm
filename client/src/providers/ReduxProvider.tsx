'use client'

import { store, persistor } from '@/store'
import { Provider } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'
import { Spinner } from '@/components/ui/spinner'

/**
 * Redux provider component that wraps the application with the Redux store
 * and persistence layer
 */
export function ReduxProvider({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <PersistGate loading={<div className="flex justify-center items-center h-screen"><Spinner size="lg" /></div>} persistor={persistor}>
        {children}
      </PersistGate>
    </Provider>
  )
} 