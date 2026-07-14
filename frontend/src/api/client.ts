import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3008/v1'

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ---------- token refresh logic ----------
let isRefreshing = false
let refreshQueue: Array<(token: string) => void> = []

function doLogout() {
  localStorage.removeItem('auth_token')
  localStorage.removeItem('auth_user')
  window.location.href = '/login'
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const url: string = error.config?.url ?? ''

    // Only intercept 401s from protected endpoints
    if (
      error.response?.status !== 401 ||
      url.includes('/auth/login') ||
      url.includes('/auth/refresh')
    ) {
      return Promise.reject(error)
    }

    // If a refresh is already in progress, queue this request
    if (isRefreshing) {
      return new Promise((resolve) => {
        refreshQueue.push((newToken: string) => {
          error.config.headers.Authorization = `Bearer ${newToken}`
          resolve(apiClient(error.config))
        })
      })
    }

    isRefreshing = true
    const expiredToken = localStorage.getItem('auth_token')

    try {
      const res = await axios.post(
        `${BASE_URL}/auth/refresh`,
        {},
        { headers: { Authorization: `Bearer ${expiredToken}` } },
      )
      const newToken: string = res.data.data.token
      localStorage.setItem('auth_token', newToken)

      // Retry all queued requests with the new token
      refreshQueue.forEach((cb) => cb(newToken))
      refreshQueue = []

      // Retry the original failed request
      error.config.headers.Authorization = `Bearer ${newToken}`
      return apiClient(error.config)
    } catch {
      refreshQueue = []
      doLogout()
      return Promise.reject(error)
    } finally {
      isRefreshing = false
    }
  },
)
