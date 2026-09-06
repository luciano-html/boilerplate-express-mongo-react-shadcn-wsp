import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import api from '@/services/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Smartphone, RefreshCcw, CheckCircle2, XCircle } from 'lucide-react'
import { io } from 'socket.io-client'

export default function Configuracion() {
  const queryClient = useQueryClient()
  
  // WhatsApp Status State
  const [qr, setQr] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  const { data: configData, isLoading } = useQuery({
    queryKey: ['store-config'],
    queryFn: () => api.get('/config').then(res => res.data)
  })

  useEffect(() => {
    // Initial fetch for WhatsApp status
    api.get('/whatsapp/status').then(res => {
      setIsConnected(res.data.connected)
      setQr(res.data.qr)
    })

    // Setup socket to listen for WhatsApp events
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

  const handleRefreshQr = async () => {
    // Restarting the server is usually the best way to force whatsapp-web.js to drop and restart if it's stuck, 
    // but fetching status again might give us the latest QR if we missed the socket event.
    const res = await api.get('/whatsapp/status')
    setIsConnected(res.data.connected)
    setQr(res.data.qr)
  }

  if (isLoading) return <div>Cargando configuración...</div>

  const config = configData?.data

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

        {/* BASIC CONFIG (Placeholder for now) */}
        <Card>
          <CardHeader>
            <CardTitle>Configuración de la Tienda</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre del Local</Label>
              <Input defaultValue={config?.name} readOnly />
            </div>
            <div className="space-y-2">
              <Label>Moneda</Label>
              <Input defaultValue={config?.currency} readOnly />
            </div>
            <div className="space-y-2">
              <Label>Horarios</Label>
              <Input defaultValue={config?.businessHours} readOnly />
            </div>
            <p className="text-xs text-muted-foreground">
              (Esta es la estructura genérica. Luego agregaremos el guardado de zonas de envío y ETAs dinámicos).
            </p>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
