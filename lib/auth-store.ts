import { create } from 'zustand'

type AuthState = {
  bearerToken: string | null
  setBearerToken: (token: string | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  bearerToken: null,
  setBearerToken: (token) => set({ bearerToken: token }),
}))
