import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, x-telegram-init-data',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })
const encoder = new TextEncoder()

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index++) difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return difference === 0
}

async function verifyTelegram(initData: string, botToken: string) {
  const params = new URLSearchParams(initData)
  const receivedHash = params.get('hash')
  if (!receivedHash) throw new Error('Telegram signature is missing')
  params.delete('hash')
  const authDate = Number(params.get('auth_date'))
  const age = Date.now() / 1000 - authDate
  if (!authDate || age > 86400 || age < -300) throw new Error('Telegram session has expired')
  const checkString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('\n')

  const webAppKey = await crypto.subtle.importKey('raw', encoder.encode('WebAppData'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const secret = await crypto.subtle.sign('HMAC', webAppKey, encoder.encode(botToken))
  const secretKey = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', secretKey, encoder.encode(checkString))
  const actualHash = [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  if (!constantTimeEqual(actualHash, receivedHash)) throw new Error('Invalid Telegram signature')
  const user = JSON.parse(params.get('user') || 'null')
  if (!user?.id) throw new Error('Telegram user is missing')
  return user as { id: number; first_name: string; last_name?: string; username?: string }
}

function inviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join('')
}

function validateAppData(data: unknown) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid application data')
  const size = encoder.encode(JSON.stringify(data)).byteLength
  if (size > 2_000_000) throw new Error('Application data is too large')
  return data
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
    const url = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!botToken || !url || !serviceKey) throw new Error('Server is not configured')
    const user = await verifyTelegram(request.headers.get('x-telegram-init-data') || '', botToken)
    const body = await request.json()
    const db = createClient(url, serviceKey)

    const membership = async () => {
      const { data, error } = await db.from('household_members').select('household_id').eq('telegram_id', user.id).maybeSingle()
      if (error) throw error
      return data
    }
    const getHousehold = async () => {
      const member = await membership()
      if (!member) return null
      const { data, error } = await db.from('households').select('id,name,invite_code,data,updated_at').eq('id', member.household_id).single()
      if (error) throw error
      return data
    }

    if (body.action === 'bootstrap') return json({ household: await getHousehold() })

    if (body.action === 'create') {
      if (await membership()) return json({ error: 'Вы уже состоите в семье' }, 409)
      const name = String(body.name || '').trim().slice(0, 80)
      if (!name) return json({ error: 'Укажите название семьи' }, 400)
      let household = null
      for (let attempt = 0; attempt < 4 && !household; attempt++) {
        const result = await db.from('households').insert({ name, invite_code: inviteCode(), owner_telegram_id: user.id, data: validateAppData(body.data) }).select('id').single()
        if (!result.error) household = result.data
        else if (result.error.code !== '23505') throw result.error
      }
      if (!household) throw new Error('Не удалось создать код приглашения')
      const { error } = await db.from('household_members').insert({ household_id: household.id, telegram_id: user.id, profile: user })
      if (error) {
        await db.from('households').delete().eq('id', household.id)
        throw error
      }
      return json({ household: await getHousehold() })
    }

    if (body.action === 'join') {
      if (await membership()) return json({ error: 'Вы уже состоите в семье' }, 409)
      const { data: household, error: findError } = await db.from('households').select('id').eq('invite_code', String(body.code || '').trim().toUpperCase()).maybeSingle()
      if (findError) throw findError
      if (!household) return json({ error: 'Код семьи не найден' }, 404)
      const { count, error: countError } = await db.from('household_members').select('*', { count: 'exact', head: true }).eq('household_id', household.id)
      if (countError) throw countError
      if ((count ?? 0) >= 2) return json({ error: 'В этой семье уже два участника' }, 409)
      const { error } = await db.from('household_members').insert({ household_id: household.id, telegram_id: user.id, profile: user })
      if (error) {
        if (error.message.includes('HOUSEHOLD_FULL')) return json({ error: 'В этой семье уже два участника' }, 409)
        throw error
      }
      return json({ household: await getHousehold() })
    }

    if (body.action === 'save') {
      const member = await membership()
      if (!member || member.household_id !== body.household_id) return json({ error: 'Нет доступа к этой семье' }, 403)
      const { data, error } = await db.from('households').update({ data: validateAppData(body.data) }).eq('id', member.household_id).select('updated_at').single()
      if (error) throw error
      return json(data)
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String(error.message)
        : 'Internal error'
    console.error(message)
    return json({ error: message }, 500)
  }
})

