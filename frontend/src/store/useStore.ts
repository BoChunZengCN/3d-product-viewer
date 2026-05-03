import { create } from 'zustand'
import type { ParsedFile, SheetData, ChatMessage, AnalysisResult } from '../types'

interface AppState {
  // 文件状态
  parsedFile: ParsedFile | null
  activeSheet: SheetData | null
  isUploading: boolean

  // 对话状态
  messages: ChatMessage[]
  isQuerying: boolean

  // 结果状态
  latestResult: AnalysisResult | null

  // Actions
  setParsedFile: (file: ParsedFile) => void
  setActiveSheet: (sheet: SheetData) => void
  setIsUploading: (v: boolean) => void
  addMessage: (msg: ChatMessage) => void
  setIsQuerying: (v: boolean) => void
  setLatestResult: (result: AnalysisResult | null) => void
  reset: () => void
}

export const useStore = create<AppState>((set) => ({
  parsedFile: null,
  activeSheet: null,
  isUploading: false,
  messages: [],
  isQuerying: false,
  latestResult: null,

  setParsedFile: (file) =>
    set({ parsedFile: file, activeSheet: file.sheets[0] ?? null }),

  setActiveSheet: (sheet) => set({ activeSheet: sheet }),

  setIsUploading: (v) => set({ isUploading: v }),

  addMessage: (msg) =>
    set((state) => ({ messages: [...state.messages, msg] })),

  setIsQuerying: (v) => set({ isQuerying: v }),

  setLatestResult: (result) => set({ latestResult: result }),

  reset: () =>
    set({
      parsedFile: null,
      activeSheet: null,
      messages: [],
      latestResult: null,
    }),
}))
