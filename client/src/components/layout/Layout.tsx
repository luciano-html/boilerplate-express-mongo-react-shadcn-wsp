import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useLiveSockets } from '@/hooks/useLiveSockets'
import { useQueryClient } from '@tanstack/react-query'

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/catalogo': 'Catálogo',
  '/pedidos': 'Pedidos Live',
  '/historial': 'Historial de Ventas',
  '/ganancias': 'Ganancias',
  '/rutas': 'Hojas de Ruta',
  '/configuracion': 'Configuración',
}

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const title = titles[location.pathname] ?? 'Admin Panel'
  const { socket } = useLiveSockets()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!socket) return;
    const handleOrderCreated = () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    }
    const handleOrderUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    }
    
    socket.on('order:created', handleOrderCreated)
    socket.on('order:updated', handleOrderUpdated)
    
    return () => {
      socket.off('order:created', handleOrderCreated)
      socket.off('order:updated', handleOrderUpdated)
    }
  }, [socket, queryClient])

  return (
    <div className="flex h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} title={title} />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
