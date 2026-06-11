import axios from 'axios'
import { message } from 'antd'
import type { LoginResponse, User, Block, Bin, BinStats, Task, Role, RoleCreate, RoleUpdate, UserPerformance } from '@/types'

const http = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

// 请求拦截器：自动注入 JWT
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器：统一错误处理
http.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status
    if (status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    } else if (status === 403) {
      message.error('Permission denied')
    } else if (status === 422) {
      message.error('Invalid request parameters')
    } else {
      message.error(err.response?.data?.detail || 'Request failed')
    }
    return Promise.reject(err)
  }
)

// Auth
export const login = (username: string, password: string) =>
  http.post<LoginResponse>('/auth/login', { username, password })

export const getMe = () => http.get<User>('/auth/me')

// Blocks
export const getBlocks = () => http.get<Block[]>('/blocks')
export const getBlock = (id: number) => http.get<Block>(`/blocks/${id}`)
export const createBlock = (data: Partial<Block>) => http.post<Block>('/blocks', data)
export const updateBlock = (id: number, data: Partial<Block>) => http.patch<Block>(`/blocks/${id}`, data)
export const deleteBlock = (id: number) => http.delete(`/blocks/${id}`)

// Bins
export const getBins = (params?: { block_id?: number; min_fill?: number }) =>
  http.get<Bin[]>('/bins', { params })
export const getBin = (id: number) => http.get<Bin>(`/bins/${id}`)
export const getBinStats = () => http.get<BinStats>('/bins/stats')
export const createBin = (data: Partial<Bin>) => http.post<Bin>('/bins', data)
export const updateBin = (id: number, data: Partial<Bin>) => http.patch<Bin>(`/bins/${id}`, data)
export const deleteBin = (id: number) => http.delete(`/bins/${id}`)

// Users
export const getUsers = (params?: { role?: string; status?: string }) =>
  http.get<User[]>('/users', { params })
export const createUser = (data: Partial<User> & { password: string }) =>
  http.post<User>('/users', data)
export const updateUser = (id: number, data: Partial<User>) => http.patch<User>(`/users/${id}`, data)
export const deleteUser = (id: number) => http.delete(`/users/${id}`)
export const restoreUser = (id: number) => http.patch(`/users/${id}`, { status: 'active' })
export const resetPassword = (id: number, new_password: string) =>
  http.post(`/users/${id}/reset-password`, { new_password })
export const changePassword = (old_password: string, new_password: string) =>
  http.post('/users/me/change-password', { old_password, new_password })
export const getUserPerformance = (id: number) =>
  http.get<UserPerformance>(`/users/${id}/performance`)

// Cleaners
export const getCleanerBlocks = (id: number) => http.get<Block[]>(`/cleaners/${id}/blocks`)
export const assignBlock = (id: number, block_id: number) =>
  http.post(`/cleaners/${id}/blocks`, { block_ids: [block_id] })
export const removeBlock = (id: number, block_id: number) =>
  http.delete(`/cleaners/${id}/blocks/${block_id}`)

// Roles
export const getRoles = () => http.get<Role[]>('/roles')
export const getRole = (id: number) => http.get<Role>(`/roles/${id}`)
export const createRole = (data: RoleCreate) => http.post<Role>('/roles', data)
export const updateRole = (id: number, data: RoleUpdate) => http.patch<Role>(`/roles/${id}`, data)
export const deactivateRole = (id: number) => http.post<Role>(`/roles/${id}/deactivate`)
export const restoreRole = (id: number) => http.post<Role>(`/roles/${id}/restore`)

// Tasks
export const getTasks = (params?: {
  status?: string
  cleaner_id?: number
  bin_id?: number
  start_date?: string
  end_date?: string
}) => http.get<Task[]>('/tasks', { params })
export const getTaskStats = () => http.get('/tasks/stats')
export const createTask = (data: { bin_id: number; cleaner_id?: number }) =>
  http.post<Task>('/tasks', data)
export const assignTask = (id: number, cleaner_id: number) =>
  http.post<Task>(`/tasks/${id}/assign`, { cleaner_id })
export const rateTask = (id: number, rating: number, comment?: string) =>
  http.post(`/tasks/${id}/rate`, { rating, comment })
export const deleteTask = (id: number) => http.delete(`/tasks/${id}`)