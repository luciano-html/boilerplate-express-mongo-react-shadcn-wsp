import { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { Skeleton } from '@/components/ui/skeleton'

const Login = lazy(() => import('@/pages/Login'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const PedidosLive = lazy(() => import('@/pages/PedidosLive'))

const Catalogo = lazy(() => import('@/pages/Catalogo'))
const Historial = () => <div>Historial de Ventas</div>
const Ganancias = () => <div>Módulo de Ganancias</div>
const HojasRuta = () => <div>Hojas de Ruta</div>
const Configuracion = lazy(() => import('@/pages/Configuracion'))

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
      { path: 'catalogo', element: <SuspenseWrapper><Catalogo /></SuspenseWrapper> },
      { path: 'pedidos', element: <PedidosLive /> },
      { path: 'historial', element: <Historial /> },
      { path: 'ganancias', element: <Ganancias /> },
      { path: 'rutas', element: <HojasRuta /> },
      { path: 'configuracion', element: <SuspenseWrapper><Configuracion /></SuspenseWrapper> },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
