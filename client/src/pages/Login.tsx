import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      navigate('/', { replace: true })
    } catch {
      setError('Usuario o contraseña incorrectos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#111111' }}>
      <Card className="w-full max-w-sm border-0 shadow-2xl" style={{ backgroundColor: '#1a1a1a' }}>
        <CardHeader className="text-center">
          <CardTitle className="font-heading text-2xl" style={{ color: '#ffffff' }}>Admin Login</CardTitle>
          <p className="text-sm mt-1" style={{ color: '#9ca3af' }}>Iniciar sesión</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-gray-300">Usuario</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required
                className="border-gray-700 text-white placeholder:text-gray-500"
                style={{ backgroundColor: '#2a2a2a' }} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-300">Contraseña</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                className="border-gray-700 text-white placeholder:text-gray-500"
                style={{ backgroundColor: '#2a2a2a' }} />
            </div>
            {error && <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}
              style={{ backgroundColor: '#E20019' }}>
              {loading ? 'Ingresando...' : 'Ingresar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
