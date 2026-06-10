import axios from 'axios'
import { message } from 'antd'
import type { LoginResponse, User, Block, Bin, Task } from '@/types'

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
      message.error('无权限操作')
    } else if (status === 422) {
      message.error('参数错误')
    } else {
      message.error(err.response?.data?.detail || '请求失败')
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
export const resetPassword = (id: number, new_password: string) =>
  http.post(`/users/${id}/reset-password`, { new_password })

// Cleaners
export const getCleanerBlocks = (id: number) => http.get<Block[]>(`/cleaners/${id}/blocks`)
export const assignBlock = (id: number, block_id: number) =>
  http.post(`/cleaners/${id}/blocks`, { block_ids: [block_id] })
export const removeBlock = (id: number, block_id: number) =>
  http.delete(`/cleaners/${id}/blocks/${block_id}`)

// Tasks
export const getTasks = (params?: { status?: string; cleaner_id?: number; bin_id?: number }) =>
  http.get<Task[]>('/tasks', { params })
export const getTaskStats = () => http.get('/tasks/stats')
export const createTask = (data: { bin_id: number; cleaner_id?: number }) =>
  http.post<Task>('/tasks', data)
export const rateTask = (id: number, rating: number, note?: string) =>
  http.post(`/tasks/${id}/rate`, { rating, note })
export const deleteTask = (id: number) => http.delete(`/tasks/${id}`)