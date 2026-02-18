'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import { DatasetUploadModal } from '@/components/DatasetUploadModal'
import type { ChatContext } from '@/types'

type UploadModalContextValue = {
    openUploadModal: (chatContext?: ChatContext) => void
}

const UploadModalContext = createContext<UploadModalContextValue | null>(null)

export function UploadModalProvider({ children }: { children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false)
    const [chatContext, setChatContext] = useState<ChatContext>({})

    const openUploadModal = useCallback((ctx?: ChatContext) => {
        setChatContext(ctx ?? {})
        setIsOpen(true)
    }, [])

    const closeModal = useCallback(() => setIsOpen(false), [])

    return (
        <UploadModalContext.Provider value={{ openUploadModal }}>
            {children}
            <DatasetUploadModal
                isOpen={isOpen}
                onClose={closeModal}
                chatContext={chatContext}
            />
        </UploadModalContext.Provider>
    )
}

export function useUploadModal(): UploadModalContextValue {
    const ctx = useContext(UploadModalContext)
    if (!ctx) throw new Error('useUploadModal must be used within UploadModalProvider')
    return ctx
}
