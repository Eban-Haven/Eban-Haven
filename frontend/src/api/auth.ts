import { apiFetch, parseJson } from './client'

export async function login(username: string, password: string, rememberMe = false): Promise<void> {
  const res = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password, rememberMe }),
  })
  await parseJson<{ ok: boolean }>(res)
}

export async function logout(): Promise<void> {
  const res = await apiFetch('/api/auth/logout', { method: 'POST' })
  if (!res.ok && res.status !== 401) await parseJson(res)
}

export async function getMe(): Promise<{ user: string } | null> {
  try {
    const res = await apiFetch('/api/auth/me')
    if (res.status === 401) return null
    return await parseJson<{ user: string }>(res)
  } catch {
    return null
  }
}
