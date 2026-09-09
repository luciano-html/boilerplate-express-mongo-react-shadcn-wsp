import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd'
import { Bike, GripVertical, MapPin, Plus, Trash2 } from 'lucide-react'
import api from '@/services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Stop = {
  _id: string
  orderNumber: number
  customerName: string
  customerPhone: string
  deliveryAddress?: string
  deliveryNeighborhood?: string
  total: number
  paymentStatus: 'pending' | 'confirmed'
  status?: string
}

type Route = {
  _id: string
  routeNumber: number
  courierName: string
  status: 'open' | 'dispatched' | 'closed'
  stops: Stop[]
}

const money = (n: number) => `$ ${n.toLocaleString('es-AR')}`

function StopCard({ stop, index }: { stop: Stop; index: number }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-border bg-card p-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-heading text-sm font-bold">#{stop.orderNumber}</span>
          <span className="whitespace-nowrap text-sm font-bold">{money(stop.total)}</span>
        </div>
        <div className="text-sm">{stop.customerName}</div>
        {/* La dirección es lo que el cadete necesita leer de un vistazo. */}
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <MapPin size={12} className="mt-0.5 shrink-0" />
          <span>
            {stop.deliveryAddress ?? 'Sin dirección'}
            {stop.deliveryNeighborhood && ` · ${stop.deliveryNeighborhood}`}
          </span>
        </div>
        {stop.paymentStatus === 'pending' && (
          <span className="mt-1 inline-block text-[11px] font-semibold text-[#b45309]">Falta comprobante</span>
        )}
      </div>
    </div>
  )
}

export default function HojasRuta() {
  const queryClient = useQueryClient()
  const [courier, setCourier] = useState('')

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['routes'] })
    queryClient.invalidateQueries({ queryKey: ['routes', 'available'] })
    queryClient.invalidateQueries({ queryKey: ['orders', 'active'] })
  }

  const { data: available = [] } = useQuery<Stop[]>({
    queryKey: ['routes', 'available'],
    queryFn: () => api.get('/rutas/disponibles').then((r) => r.data),
    refetchInterval: 20_000,
  })

  const { data: routes = [], isLoading } = useQuery<Route[]>({
    queryKey: ['routes'],
    queryFn: () => api.get('/rutas').then((r) => r.data),
    refetchInterval: 20_000,
  })

  const onError = (err: any) => alert(err?.response?.data?.error ?? 'No se pudo completar la operación')

  const createMutation = useMutation({
    mutationFn: (courierName: string) => api.post('/rutas', { courierName }),
    onSuccess: () => {
      setCourier('')
      invalidate()
    },
    onError,
  })

  const stopsMutation = useMutation({
    mutationFn: ({ id, stops }: { id: string; stops: string[] }) => api.put(`/rutas/${id}/stops`, { stops }),
    onSuccess: invalidate,
    onError,
  })

  const dispatchMutation = useMutation({
    mutationFn: (id: string) => api.put(`/rutas/${id}/dispatch`),
    onSuccess: invalidate,
    onError,
  })

  const closeMutation = useMutation({
    mutationFn: (id: string) => api.put(`/rutas/${id}/close`),
    onSuccess: invalidate,
    onError,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/rutas/${id}`),
    onSuccess: invalidate,
    onError,
  })

  const openRoutes = routes.filter((r) => r.status === 'open')

  const onDragEnd = (result: any) => {
    if (!result.destination) return
    const { source, destination, draggableId } = result

    // Reordenar dentro de la misma hoja.
    if (source.droppableId === destination.droppableId) {
      if (source.droppableId === 'available') return
      const route = openRoutes.find((r) => r._id === source.droppableId)
      if (!route) return
      const ids = route.stops.map((s) => s._id)
      const [moved] = ids.splice(source.index, 1)
      ids.splice(destination.index, 0, moved)
      stopsMutation.mutate({ id: route._id, stops: ids })
      return
    }

    // De disponibles a una hoja.
    if (source.droppableId === 'available') {
      const route = openRoutes.find((r) => r._id === destination.droppableId)
      if (!route) return
      const ids = route.stops.map((s) => s._id)
      ids.splice(destination.index, 0, draggableId)
      stopsMutation.mutate({ id: route._id, stops: ids })
      return
    }

    // De una hoja a disponibles: se saca la parada.
    if (destination.droppableId === 'available') {
      const route = openRoutes.find((r) => r._id === source.droppableId)
      if (!route) return
      stopsMutation.mutate({ id: route._id, stops: route.stops.filter((s) => s._id !== draggableId).map((s) => s._id) })
    }
  }

  if (isLoading) return <div className="p-4">Cargando hojas de ruta...</div>

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-3xl font-bold tracking-tight">Hojas de Ruta</h1>
          <p className="text-sm text-muted-foreground">
            Agrupá los pedidos listos y despachalos juntos. Al despachar, cada cliente recibe su aviso.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (courier.trim()) createMutation.mutate(courier.trim())
          }}
          className="flex items-end gap-2"
        >
          <Input
            value={courier}
            onChange={(e) => setCourier(e.target.value)}
            placeholder="Nombre del cadete"
            className="w-[180px]"
          />
          <Button type="submit" disabled={!courier.trim() || createMutation.isPending}>
            <Plus size={15} className="mr-2" /> Nueva hoja
          </Button>
        </form>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
          <Droppable droppableId="available">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="flex max-h-[70vh] flex-col gap-2.5 overflow-y-auto rounded-[10px] bg-secondary p-3"
              >
                <div className="flex items-center justify-between px-1 pb-1">
                  <span className="font-heading text-sm font-bold">Listos para salir</span>
                  <span className="flex h-[22px] min-w-[24px] items-center justify-center rounded-full border border-border bg-card px-[7px] text-xs font-semibold">
                    {available.length}
                  </span>
                </div>

                {available.length === 0 && (
                  <p className="py-8 text-center text-xs text-muted-foreground">
                    No hay pedidos de delivery en “Listo”.
                  </p>
                )}

                {available.map((stop, i) => (
                  <Draggable draggableId={stop._id} index={i} key={stop._id}>
                    {(drag) => (
                      <div ref={drag.innerRef} {...drag.draggableProps} {...drag.dragHandleProps}>
                        <StopCard stop={stop} index={i} />
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>

          <div className="flex flex-col gap-4">
            {routes.length === 0 && (
              <p className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
                Creá una hoja con el nombre del cadete para empezar.
              </p>
            )}

            {routes.map((route) => {
              const total = route.stops.reduce((acc, s) => acc + s.total, 0)
              const sinPago = route.stops.filter((s) => s.paymentStatus === 'pending')

              return (
                <div key={route._id} className="rounded-lg border border-border bg-card">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
                    <div className="flex items-center gap-3">
                      <Bike size={18} className="text-muted-foreground" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-heading text-base font-bold">Hoja #{route.routeNumber}</span>
                          <Badge variant={route.status === 'open' ? 'secondary' : 'default'}>
                            {route.status === 'open' ? 'Armando' : route.status === 'dispatched' ? 'En calle' : 'Cerrada'}
                          </Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {route.courierName} · {route.stops.length}{' '}
                          {route.stops.length === 1 ? 'parada' : 'paradas'} · {money(total)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {route.status === 'open' && (
                        <>
                          <Button
                            size="sm"
                            disabled={route.stops.length === 0 || dispatchMutation.isPending}
                            onClick={() => dispatchMutation.mutate(route._id)}
                          >
                            Despachar
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(route._id)}>
                            <Trash2 size={15} className="text-destructive" />
                          </Button>
                        </>
                      )}
                      {route.status === 'dispatched' && (
                        <Button size="sm" variant="outline" onClick={() => closeMutation.mutate(route._id)}>
                          Volvió el cadete
                        </Button>
                      )}
                    </div>
                  </div>

                  {sinPago.length > 0 && route.status === 'open' && (
                    <div className="border-b border-border bg-[#fdf0dd] px-4 py-2.5 text-xs font-semibold text-[#b45309]">
                      No sale hasta confirmar el pago de {sinPago.map((s) => `#${s.orderNumber}`).join(', ')}.
                    </div>
                  )}

                  <Droppable droppableId={route._id} isDropDisabled={route.status !== 'open'}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                          'flex min-h-[90px] flex-col gap-2.5 p-4',
                          route.status !== 'open' && 'opacity-90'
                        )}
                      >
                        {route.stops.length === 0 && (
                          <p className="py-6 text-center text-xs text-muted-foreground">
                            Arrastrá pedidos desde la izquierda. El orden de la lista es el orden del recorrido.
                          </p>
                        )}

                        {route.stops.map((stop, i) =>
                          route.status === 'open' ? (
                            <Draggable draggableId={stop._id} index={i} key={stop._id}>
                              {(drag) => (
                                <div
                                  ref={drag.innerRef}
                                  {...drag.draggableProps}
                                  className="flex items-center gap-1"
                                >
                                  <span {...drag.dragHandleProps} className="cursor-grab text-muted-foreground">
                                    <GripVertical size={16} />
                                  </span>
                                  <div className="flex-1">
                                    <StopCard stop={stop} index={i} />
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ) : (
                            <StopCard key={stop._id} stop={stop} index={i} />
                          )
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              )
            })}
          </div>
        </div>
      </DragDropContext>
    </div>
  )
}
