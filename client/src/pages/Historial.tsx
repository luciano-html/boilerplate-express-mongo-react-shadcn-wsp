import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import api from '@/services/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { Order } from 'shared'

type Row = Pick<
  Order,
  | '_id'
  | 'orderNumber'
  | 'customerName'
  | 'customerPhone'
  | 'orderType'
  | 'paymentMethod'
  | 'paymentStatus'
  | 'status'
  | 'total'
  | 'deliveryNeighborhood'
  | 'createdAt'
>

type Response = {
  data: Row[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  cooking: 'En cocina',
  ready: 'Listo',
  on_the_way: 'En camino',
  closed: 'Entregado',
  cancelled: 'Cancelado',
}

const isoDaysAgo = (days: number) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

const money = (n: number) => `$ ${n.toLocaleString('es-AR')}`

export default function Historial() {
  const [from, setFrom] = useState(isoDaysAgo(30))
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10))
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  // El texto tipeado y el que se consulta son dos cosas: sin eso cada tecla
  // dispara un request.
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading, isFetching } = useQuery<Response>({
    queryKey: ['order-history', from, to, status, query, page],
    queryFn: () => {
      const params = new URLSearchParams({ from, to, page: String(page), limit: '20' })
      if (status) params.set('status', status)
      if (query) params.set('q', query)
      return api.get(`/orders/historial?${params}`).then((res) => res.data)
    },
    // Mantener la página anterior mientras carga la nueva evita que la tabla
    // colapse a "Cargando..." y el layout salte en cada click de paginación.
    placeholderData: keepPreviousData,
  })

  const rows = data?.data ?? []
  const pag = data?.pagination

  const applySearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    setQuery(search.trim())
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl font-bold tracking-tight">Historial de Ventas</h1>
        <p className="text-sm text-muted-foreground">Todos los pedidos del período, entregados y cancelados.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Desde</label>
          <Input
            type="date"
            value={from}
            max={to}
            onChange={(e) => {
              setFrom(e.target.value)
              setPage(1)
            }}
            className="w-[150px]"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Hasta</label>
          <Input
            type="date"
            value={to}
            min={from}
            onChange={(e) => {
              setTo(e.target.value)
              setPage(1)
            }}
            className="w-[150px]"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Estado</label>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
            className="flex h-10 w-[160px] rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Todos</option>
            {Object.entries(STATUS_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <form onSubmit={applySearch} className="flex flex-1 items-end gap-2">
          <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Buscar</label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nombre, teléfono o número de pedido"
            />
          </div>
          <Button type="submit" variant="outline">
            <Search size={15} />
          </Button>
        </form>
      </div>

      <div className={cn('rounded-lg border border-border', isFetching && 'opacity-60 transition-opacity')}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[70px]">#</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Entrega</TableHead>
              <TableHead>Pago</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            )}

            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No hay pedidos con esos filtros.
                </TableCell>
              </TableRow>
            )}

            {rows.map((order) => (
              <TableRow key={order._id}>
                <TableCell className="font-bold tabular-nums">{order.orderNumber}</TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {new Date(order.createdAt).toLocaleString('es-AR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </TableCell>
                <TableCell>
                  <div className="font-medium">{order.customerName}</div>
                  <div className="text-xs text-muted-foreground">{order.customerPhone}</div>
                </TableCell>
                <TableCell className="text-sm">
                  {order.orderType === 'delivery' ? (
                    <>
                      Delivery
                      {order.deliveryNeighborhood && (
                        <span className="block text-xs text-muted-foreground">{order.deliveryNeighborhood}</span>
                      )}
                    </>
                  ) : (
                    'Retiro'
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {order.paymentMethod === 'cash' ? 'Efectivo' : 'Transferencia'}
                  {order.paymentStatus === 'pending' && (
                    <span className="block text-xs font-semibold text-[#b45309]">sin confirmar</span>
                  )}
                </TableCell>
                <TableCell>
                  {/* Estado por texto, no por color solo. */}
                  <Badge variant={order.status === 'cancelled' ? 'destructive' : 'secondary'}>
                    {STATUS_LABEL[order.status] ?? order.status}
                  </Badge>
                </TableCell>
                <TableCell
                  className={cn(
                    'text-right font-bold tabular-nums',
                    order.status === 'cancelled' && 'text-muted-foreground line-through'
                  )}
                >
                  {money(order.total)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {pag && pag.total > 0 && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            {pag.total} {pag.total === 1 ? 'pedido' : 'pedidos'} · página {pag.page} de {pag.totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft size={15} className="mr-1" /> Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pag.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente <ChevronRight size={15} className="ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
