import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ListOrdered, LayoutDashboard, Settings } from 'lucide-react'

export default function Dashboard() {
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Panel Principal</h1>
        <p className="text-muted-foreground">Bienvenido, {user?.email} 👋</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListOrdered className="text-primary" />
              Pedidos Live
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Tablero Kanban para gestionar los pedidos en tiempo real. Arrastra las órdenes a Preparación o Despachado.
            </p>
            <Link to="/pedidos">
              <Button className="w-full">Ir al Kanban</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LayoutDashboard className="text-primary" />
              Catálogo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Gestiona tus hamburguesas, combos y configuraciones de extras (Toppings).
            </p>
            <Link to="/catalogo">
              <Button variant="secondary" className="w-full">Editar Catálogo</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="text-primary" />
              Configuración & WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Vincula tu WhatsApp, edita las Zonas de Envío y variables de tiempo (ETA).
            </p>
            <Link to="/configuracion">
              <Button variant="secondary" className="w-full">Configuraciones</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
