import { create } from 'zustand'
import type { TableData, ChatMessage, QueryResponse } from '../types'

interface AppStore {
  tableData: TableData | null
  setTableData: (data: TableData | null) => void

  messages: ChatMessage[]
  addMessage: (msg: ChatMessage) => void
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void
  clearMessages: () => void

  isQuerying: boolean
  setIsQuerying: (v: boolean) => void

  backendReady: boolean
  setBackendReady: (v: boolean) => void
}

export const useStore = create<AppStore>((set) => ({
  tableData: null,
  setTableData: (data) => set({ tableData: data }),

  messages: [],
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  updateMessage: (id, updates) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    })),
  clearMessages: () => set({ messages: [] }),

  isQuerying: false,
  setIsQuerying: (v) => set({ isQuerying: v }),

  backendReady: false,
  setBackendReady: (v) => set({ backendReady: v }),
}))

export type { QueryResponse }
