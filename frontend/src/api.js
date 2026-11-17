const API_ROOT = '/api'
let csrfToken = ''

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {})
  if (options.body !== undefined) headers.set('Content-Type', 'application/json')
  if (options.csrf) {
    if (!csrfToken) await getCsrfToken()
    headers.set('X-CSRF-Token', csrfToken)
  }
  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    headers,
    credentials: 'same-origin',
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  if (response.status === 204) return null
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.errors?.join(' ') || data.error || 'No se pudo completar la solicitud.')
    error.status = response.status
    throw error
  }
  if (data.csrfToken) csrfToken = data.csrfToken
  return data
}

export async function getCsrfToken() {
  const data = await request('/auth/csrf')
  csrfToken = data.csrfToken
  return csrfToken
}

export const api = {
  me: () => request('/auth/me'),
  register: async (payload) => {
    await getCsrfToken()
    const result = await request('/auth/register', { method: 'POST', body: payload, csrf: true })
    await getCsrfToken()
    return result
  },
  login: async (payload) => {
    await getCsrfToken()
    const result = await request('/auth/login', { method: 'POST', body: payload, csrf: true })
    await getCsrfToken()
    return result
  },
  logout: () => request('/auth/logout', { method: 'POST', csrf: true }),
  tasks: (status = '') => request(`/tasks${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  createTask: (payload) => request('/tasks', { method: 'POST', body: payload, csrf: true }),
  updateTask: (id, payload) => request(`/tasks/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload, csrf: true }),
  deleteTask: (id) => request(`/tasks/${encodeURIComponent(id)}`, { method: 'DELETE', csrf: true }),
}
