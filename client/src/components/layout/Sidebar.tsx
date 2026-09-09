import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import {
  LayoutDashboard, MenuSquare, ListOrdered, History, DollarSign, Map, Settings, LogOut, X, Compass
} from 'lucide-react'

// Arriba, lo del turno: se mira durante todo el servicio.
const primaryLinks = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/pedidos', label: 'Pedidos Live', icon: ListOrdered },
  { to: '/catalogo', label: 'Catálogo', icon: MenuSquare },
  { to: '/navegacion', label: 'Navegación', icon: Compass },
]

// Abajo, junto a Cerrar sesión: lo que se consulta de vez en cuando. Un local
// mira Pedidos Live ocho horas por día y Ganancias una vez por semana; el
// sidebar tiene que decir eso.
const secondaryLinks = [
  { to: '/historial', label: 'Historial de Ventas', icon: History },
  { to: '/ganancias', label: 'Ganancias', icon: DollarSign },
  { to: '/rutas', label: 'Hojas de Ruta', icon: Map },
  { to: '/configuracion', label: 'Configuración', icon: Settings },
]

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { logout } = useAuth()

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} />}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-64 bg-sidebar-background border-r border-sidebar-border transition-transform md:relative md:translate-x-0 flex flex-col',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
          <span className="font-bold text-lg text-sidebar-primary font-heading">Admin Panel</span>
          <button onClick={onClose} className="md:hidden text-sidebar-foreground cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {primaryLinks.map((link) => {
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )
                }
              >
                <link.icon size={18} />
                <span className="flex-1">{link.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border mt-auto space-y-1">
          {secondaryLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-[13px] transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )
              }
            >
              <link.icon size={16} />
              <span className="flex-1">{link.label}</span>
            </NavLink>
          ))}

          <div className="h-px bg-sidebar-border my-2" />

          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full cursor-pointer"
          >
            <LogOut size={18} />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  )
}

