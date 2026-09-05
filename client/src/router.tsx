import { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { Skeleton } from '@/components/ui/skeleton'

const Login = lazy(() => import('@/pages/Login'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const PedidosLive = lazy(() => import('@/pages/PedidosLive'))

// Creamos placeholders simples por ahora para que compile y la estructura quede armada
const Catalogo = () => <div>Módulo de Catálogo en construcción</div>
const Historial = () => <div>Historial de Ventas</div>
const Ganancias = () => <div>Módulo de Ganancias</div>
const HojasRuta = () => <div>Hojas de Ruta</div>
const Configuracion = () => <div>Configuración y WhatsApp</div>

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<Skeleton className="h-96" />}>{children}</Suspense>
}

const router = createBrowserRouter([
  {
    path: '/login',
    element: <SuspenseWrapper><Login /></SuspenseWrapper>,
  },
  {
    path: '/',
    element: <ProtectedRoute><Layout /></ProtectedRoute>,
    children: [
      { index: true, element: <SuspenseWrapper><Dashboard /></SuspenseWrapper> },
      { path: 'catalogo', element: <Catalogo /> },
      { path: 'pedidos', element: <PedidosLive /> },
      { path: 'historial', element: <Historial /> },
      { path: 'ganancias', element: <Ganancias /> },
      { path: 'rutas', element: <HojasRuta /> },
      { path: 'configuracion', element: <Configuracion /> },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
