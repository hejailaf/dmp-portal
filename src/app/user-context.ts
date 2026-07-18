import { createContext, useContext } from 'react'
import type { User } from '@/domain/types'

export const UserContext = createContext<User | null>(null)

export function useCurrentUser(): User {
  const user = useContext(UserContext)
  if (!user) throw new Error('UserContext missing — App must provide it')
  return user
}
