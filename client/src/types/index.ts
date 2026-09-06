export type * from 'shared'

export interface AuthResponse {
  token: string
  user: {
    id: string
    email: string
    role: 'admin' | 'staff'
  }
}

export type AxiosErrorType = {
  response?: {
    data?: {
      error?: string
      message?: string
    }
  }
}
