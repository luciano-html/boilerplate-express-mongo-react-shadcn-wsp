import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import api from '@/services/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Smartphone, RefreshCcw, CheckCircle2, XCircle, Save } from 'lucide-react'
import { io } from 'socket.io-client'
import type { StoreConfig } from 'shared'

export default function Configuracion() {
  const queryClient = useQueryClient()
  
  const [qr, setQr] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [form, setForm] = useState<Partial<StoreConfig>>({})

  const { data: configData, isLoading } = useQuery({
    queryKey: ['store-config'],
    queryFn: () => api.get('/config').then(res => res.data)
  })

  useEffect(() => {
    if (configData) {
      setForm(configData)
    }
  }, [configData])

  useEffect(() => {
    api.get('/whatsapp/status').then(res => {
      setIsConnected(res.data.connected)
      setQr(res.data.qr)
    })

    const socketURL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : '')
    const socket = io(socketURL, { path: '/socket.io', withCredentials: true })

    socket.on('whatsapp_qr', (newQr: string) => {
      setQr(newQr)
      setIsConnected(false)
    })

    socket.on('whatsapp_ready', () => {
      setIsConnected(true)
      setQr(null)
    })

    socket.on('whatsapp_disconnected', () => {
      setIsConnected(false)
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  const updateMutation = useMutation({
    mutationFn: (newConfig: Partial<StoreConfig>) => api.put('/config', newConfig),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-config'] })
      alert('Configuración guardada correctamente')
    }
  })

  const handleRefreshQr = async () => {
    const res = await api.get('/whatsapp/status')
    setIsConnected(res.data.connected)
    setQr(res.data.qr)
  }

  const handleChange = (field: keyof StoreConfig, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateMutation.mutate(form)
  }

  if (isLoading) return <div>Cargando configuración...</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">Administra la tienda y la conexión de WhatsApp.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* WATSAPP CONNECTION */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone /> Conexión WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              Estado: 
              {isConnected ? (
                <span className="flex items-center gap-1 text-green-500 font-bold"><CheckCircle2 size={16}/> Conectado</span>
              ) : (
                <span className="flex items-center gap-1 text-red-500 font-bold"><XCircle size={16}/> Desconectado</span>
              )}
            </div>

            {!isConnected && qr ? (
              <div className="flex flex-col items-center justify-center space-y-4 p-4 border rounded-lg bg-white/5">
                <QRCodeSVG value={qr} size={256} className="bg-white p-2 rounded-md" />
                <p className="text-sm text-center text-muted-foreground">
                  Abre WhatsApp en tu teléfono, ve a Dispositivos Vinculados y escanea este código.
                </p>
              </div>
            ) : !isConnected && !qr ? (
              <div className="p-4 border rounded-lg bg-white/5 text-center text-muted-foreground">
                Esperando código QR del servidor...
              </div>
            ) : null}

            <Button variant="outline" className="w-full" onClick={handleRefreshQr}>
              <RefreshCcw size={16} className="mr-2" />
              Actualizar Estado / Refrescar QR
            </Button>
          </CardContent>
        </Card>

        {/* BASIC CONFIG */}
        <Card>
          <CardHeader>
            <CardTitle>Configuración de la Tienda</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre del Local</Label>
                <Input value={form.name || ''} onChange={(e) => handleChange('name', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp (Para pedidos y notificaciones)</Label>
                <Input value={form.whatsapp || ''} onChange={(e) => handleChange('whatsapp', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Moneda (ej. ARS, USD)</Label>
                <Input value={form.currency || ''} onChange={(e) => handleChange('currency', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Horario de Atención</Label>
                <Input value={form.businessHours || ''} onChange={(e) => handleChange('businessHours', e.target.value)} placeholder="Ej: Lunes a Viernes de 19 a 23" />
              </div>

              <div className="pt-4 border-t border-white/10 mt-4 space-y-4">
                <h3 className="font-semibold text-lg">Variables de Tiempo (ETA)</h3>
                
                <div className="space-y-2">
                  <Label>Tiempo Base de Preparación (Minutos)</Label>
                  <Input type="number" value={form.basePrepTime || 0} onChange={(e) => handleChange('basePrepTime', Number(e.target.value))} />
                  <p className="text-xs text-muted-foreground">Tiempo mínimo si no hay otros pedidos.</p>
                </div>
                
                <div className="space-y-2">
                  <Label>Demora extra por Pedido en Cola (Minutos)</Label>
                  <Input type="number" value={form.delayPerPendingOrder || 0} onChange={(e) => handleChange('delayPerPendingOrder', Number(e.target.value))} />
                  <p className="text-xs text-muted-foreground">Añade esto al ETA por cada pedido que esté 'En Preparación' antes que este.</p>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
                <Save size={16} className="mr-2" /> {updateMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
