// ─── User ───────────────────────────────────────────
export interface User {
  id: number
  name: string
  username: string
  role: 'admin' | 'cleaner'
  phone?: string
  zone?: string
  shift?: 'morning' | 'evening' | 'night' | null
  status: 'active' | 'inactive'
  last_seen?: string | null
  created_at: string
}

export interface UserCreate {
  name: string
  username: string
  role: 'admin' | 'cleaner'
  password: string
  phone?: string
  zone?: string
  shift?: 'morning' | 'evening' | 'night'
}

export interface UserUpdate {
  name?: string
  role?: 'admin' | 'cleaner'
  phone?: string
  zone?: string
  shift?: 'morning' | 'evening' | 'night'
  status?: 'active' | 'inactive'
}

// ─── Block ──────────────────────────────────────────
export interface Block {
  id: number
  name: string
  total_floors: number
  bins_per_floor: number
  created_at: string
}

// ─── Bin ────────────────────────────────────────────
export interface Bin {
  id: number
  block_id: number
  floor: number
  bin_number: number
  sensor_id: string
  current_fill: number
  status: 'normal' | 'warning' | 'full'
  updated_at: string | null
}

// ─── Task ───────────────────────────────────────────
export type TaskResult = 'cleaned' | 'false_alarm' | 'damaged' | 'unable'

export interface Task {
  id: number
  bin_id: number
  cleaner_id?: number | null
  status: 'pending' | 'in_progress' | 'completed' | 'rated'
  created_at: string
  accepted_at?: string | null
  completed_at?: string | null
  result?: TaskResult | null
  photos?: string[] | null
  rating?: number | null
  comment?: string | null
  rated_by?: number | null
  rated_at?: string | null
}

export interface TaskStats {
  total: number
  pending: number
  in_progress: number
  completed: number
  rated: number
}

// ─── Auth ───────────────────────────────────────────
export interface LoginResponse {
  access_token: string
  token_type: string
  expires_in: number
  user: User
}