import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useLiveSockets } from '@/hooks/useLiveSockets'
import { useQueryClient } from '@tanstack/react-query'

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/ingreso-stock': 'Ingreso de stock',
  '/componentes': 'Componentes',
  '/tipos-silla': 'Tipos de silla',
  '/ordenes-trabajo': 'Órdenes de trabajo',
  '/usuarios': 'Usuarios',
  '/perfil': 'Mi perfil',
}

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const title = titles[location.pathname] ?? 'Admin Panel'
  const { socket } = useLiveSockets()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!socket) return;
    const handleWorkOrderCreated = () => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-trabajo'] })
      queryClient.invalidateQueries({ queryKey: ['ordenes-trabajo', 'counts'] })
      queryClient.invalidateQueries({ queryKey: ['ordenes-trabajo-dash'] })
      queryClient.invalidateQueries({ queryKey: ['tipos-silla'] })
    }
    const handleWorkOrderUpdated = (data: { id: string }) => {
      queryClient.invalidateQueries({ queryKey: ['orden-trabajo', data.id] })
      queryClient.invalidateQueries({ queryKey: ['ordenes-trabajo'] })
      queryClient.invalidateQueries({ queryKey: ['ordenes-trabajo', 'counts'] })
      queryClient.invalidateQueries({ queryKey: ['ordenes-trabajo-dash'] })
      queryClient.invalidateQueries({ queryKey: ['tipos-silla'] })
      queryClient.invalidateQueries({ queryKey: ['stock-resumen'] })
    }
    
    const handleCatalogUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ['tipos-silla'] })
    }

    socket.on('work_order:created', handleWorkOrderCreated)
    socket.on('work_order:updated', handleWorkOrderUpdated)
    socket.on('catalog:updated', handleCatalogUpdated)
    
    return () => {
      socket.off('work_order:created', handleWorkOrderCreated)
      socket.off('work_order:updated', handleWorkOrderUpdated)
      socket.off('catalog:updated', handleCatalogUpdated)
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
