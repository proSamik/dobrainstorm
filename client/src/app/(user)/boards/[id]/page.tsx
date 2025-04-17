'use client'

import { useParams } from 'next/navigation'
import BoardCanvas from '@/components/dashboard/BoardCanvas'
import { Provider } from 'react-redux'
import { ReactFlowProvider } from 'reactflow'
import { store } from '@/store'


/**
 * Individual board page component that renders the BoardCanvas
 * for a specific board ID
 */
export default function BoardPage() {
  const params = useParams()
  const boardId = params.id as string

  return (
    <div className="h-screen w-full p-0 m-0 overflow-hidden">
      <ReactFlowProvider>
        <Provider store={store}>
          <BoardCanvas boardId={boardId} />
        </Provider>
      </ReactFlowProvider>
    </div>
  )
} 