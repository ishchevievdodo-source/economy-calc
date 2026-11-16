import { useEffect, useState } from 'react'
import { initialData } from './data'
import type { AppData } from './types'

const STORAGE_KEY = 'wedding-budget-v1'

export function useLocalStore() {
  const [data, setData] = useState<AppData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) as AppData : initialData
    } catch { return initialData }
  })

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }, [data])
  return [data, setData] as const
}

