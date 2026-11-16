import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { telegramInitData, telegramUser } from './telegram'
import type { AppData } from './types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const apiUrl = supabaseUrl ? `${supabaseUrl}/functions/v1/telegram-budget` : ''
export const telegramCloudEnabled = Boolean(apiUrl && telegramInitData)
export type Household = { id: string; name: string; invite_code: string; data: AppData; updated_at: string }

async function api<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-telegram-init-data': telegramInitData },
    body: JSON.stringify({ action, ...body }),
  })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error || 'Ошибка синхронизации')
  return payload as T
}

export function useCloudSync(data: AppData, setData: Dispatch<SetStateAction<AppData>>) {
  const [household, setHousehold] = useState<Household | null>(null)
  const [loading, setLoading] = useState(telegramCloudEnabled)
  const [message, setMessage] = useState('')
  const ready = useRef(false)
  const lastVersion = useRef('')

  async function load(applyRemote = true) {
    if (!telegramCloudEnabled) return
    try {
      const result = await api<{ household: Household | null }>('bootstrap')
      if (result.household) {
        setHousehold(result.household)
        if (applyRemote && result.household.updated_at !== lastVersion.current) {
          setData(result.household.data)
          lastVersion.current = result.household.updated_at
        }
        ready.current = true
      } else {
        setHousehold(null)
        ready.current = false
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Ошибка подключения') }
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  useEffect(() => {
    if (!household) return
    const timer = window.setInterval(() => void load(), 5000)
    return () => window.clearInterval(timer)
  }, [household?.id])

  useEffect(() => {
    if (!household || !ready.current) return
    const timer = window.setTimeout(async () => {
      try {
        const result = await api<{ updated_at: string }>('save', { household_id: household.id, data })
        lastVersion.current = result.updated_at
      } catch (error) { setMessage(error instanceof Error ? error.message : 'Не удалось сохранить') }
    }, 650)
    return () => window.clearTimeout(timer)
  }, [data, household?.id])

  async function createHousehold(name: string) {
    setLoading(true); setMessage('')
    try { await api('create', { name, data }); await load() }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Не удалось создать семью') }
    setLoading(false)
  }

  async function joinHousehold(code: string) {
    setLoading(true); setMessage('')
    try { await api('join', { code: code.toUpperCase() }); await load() }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Не удалось присоединиться') }
    setLoading(false)
  }

  return { user: telegramUser, household, loading, message, createHousehold, joinHousehold }
}

