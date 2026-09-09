import { useEffect, useState } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bike, ShoppingBag, AlertCircle, ChevronRight, Clock, MessageSquareX, Trash2 } from 'lucide-react'
import api from '@/services/api'
import { cn } from '@/lib/utils'
import { OrderSheet } from '@/components/orders/OrderSheet'
import type { Order, OrderStatus } from 'shared'

/**
 * Cuatro columnas, no cinco. El pago salio del tablero y vive como badge en la
 * tarjeta: era una columna vacia el 90% del tiempo porque casi todos pagan en
 * efectivo. Y aparecio el cierre, que antes no existia: los pedidos se
 * acumulaban en "En Camino" para siempre.
 */
const COLUMNS: { id: OrderStatus; title: string; next?: OrderStatus; nextLabel?: string }[] = [
  { id: 'pending', title: 'Pendiente', next: 'cooking', nextLabel: 'Pasar a cocina' },
  { id: 'cooking', title: 'En cocina', next: 'ready', nextLabel: 'Marcar listo' },
  { id: 'ready', title: 'Listo', next: 'on_the_way', nextLabel: 'Sale el cadete' },
  { id: 'on_the_way', title: 'En camino', next: 'closed', nextLabel: 'Cerrar pedido' },
]

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return isMobile
}

/** Reloj propio: los minutos de espera tienen que avanzar sin recargar la pagina. */
function useTick(intervalMs = 30_000) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
}

type Urgency = 'ok' | 'warn' | 'late'

/**
 * Los cortes son RELATIVOS al ETA prometido de ese pedido, no absolutos: un
 * takeaway de 15 minutos y un delivery de 45 no envejecen al mismo ritmo.
 */
function urgencyOf(minutes: number, eta?: number): Urgency {
  const target = eta && eta > 0 ? eta : 30
  if (minutes >= target) return 'late'
  if (minutes >= target * 0.5) return 'warn'
  return 'ok'
}

const URGENCY_CHIP: Record<Urgency, string> = {
  ok: 'bg-[#e8f5ec] text-[#15803d]',
  warn: 'bg-[#fdf0dd] text-[#b45309]',
  late: 'bg-[#fdecee] text-[#d9261f] font-bold',
}

function minutesSince(iso: string | Date) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
}

function OrderCard({
  order,
  onAdvance,
  onConfirmPayment,
  onDelete,
  onOpen,
  showAction,
}: {
  order: Order
  onAdvance?: () => void
  onConfirmPayment: () => void
  onDelete: () => void
  onOpen: () => void
  showAction?: string
}) {
  const waiting = minutesSince(order.createdAt)
  const urgency = urgencyOf(waiting, order.estimatedTime)
  const needsPayment = order.paymentStatus === 'pending'
  const items = order.items ?? []

  return (
    <div
      className={cn(
        'flex flex-col gap-[9px] rounded-lg border bg-card p-3',
        urgency === 'late' ? 'border-destructive' : 'border-border'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-heading text-[15px] font-bold">#{order.orderNumber}</span>
          {order.orderType === 'delivery' ? (
            <Bike size={16} className="text-muted-foreground" />
          ) : (
            <ShoppingBag size={16} className="text-muted-foreground" />
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn('rounded-xl px-[9px] py-[3px] text-xs font-semibold', URGENCY_CHIP[urgency])}>
            {waiting} min
          </span>
          {/* Botón chico a propósito: si el click abriera desde el cuerpo de la
              tarjeta competiría con el gesto de arrastrar. */}
          <button
            onClick={onOpen}
            aria-label="Ver detalle"
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded border border-border bg-card text-muted-foreground hover:text-foreground"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      <div className="text-sm font-semibold">{order.customerName}</div>

      <div className="flex flex-col gap-0.5 text-[13px] leading-tight text-muted-foreground">
        {items.map((item, i) => (
          <span key={i}>
            {item.quantity} × {(item as any).name ?? 'Producto'}
            {item.notes ? <span className="text-[#b45309]"> · {item.notes}</span> : null}
          </span>
        ))}
      </div>

      {!order.confirmedAt && order.status === 'pending' && (
        <div className="flex items-center gap-2 rounded-md bg-secondary px-[9px] py-[7px] text-xs text-muted-foreground">
          <Clock size={13} className="shrink-0" />
          <span>Sin confirmar por WhatsApp</span>
        </div>
      )}

      {order.lastNotificationError && (
        <div className="flex items-start gap-2 rounded-md bg-[#fdecee] px-[9px] py-[7px] text-xs font-semibold text-destructive">
          <MessageSquareX size={13} className="mt-px shrink-0" />
          <span>No se pudo avisar al cliente por WhatsApp. Llamalo.</span>
        </div>
      )}

      {needsPayment && (
        <div className="flex items-center gap-2 rounded-md bg-[#fdf0dd] px-[9px] py-[7px] text-xs font-semibold text-[#b45309]">
          <AlertCircle size={13} />
          <span className="flex-1">Falta comprobante</span>
          <button
            onClick={onConfirmPayment}
            className="h-[26px] cursor-pointer rounded border border-[#b45309] px-2.5 text-[11px] font-bold"
          >
            Confirmar
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2">
        <span className={cn('text-xs', urgency === 'late' ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
          {urgency === 'late'
            ? `Pasó el ETA de ${order.estimatedTime ?? 30} min`
            : order.orderType === 'delivery'
              ? order.deliveryNeighborhood ?? 'Delivery'
              : 'Retira en local'}
        </span>
        <span className="text-sm font-bold">$ {order.total.toLocaleString('es-AR')}</span>
      </div>

      {showAction && onAdvance && (
        <button
          onClick={onAdvance}
          className="h-9 w-full cursor-pointer rounded-md border border-border bg-card text-[13px] font-semibold hover:bg-secondary"
        >
          {showAction}
        </button>
      )}

      <button
        onClick={onDelete}
        className="flex cursor-pointer items-center gap-1.5 self-start text-[11px] text-muted-foreground hover:text-destructive"
      >
        <Trash2 size={12} /> Eliminar
      </button>
    </div>
  )
}

export default function PedidosLive() {
  const queryClient = useQueryClient()
  const isMobile = useIsMobile()
  const [activeColumn, setActiveColumn] = useState<OrderStatus>('pending')
  const [detail, setDetail] = useState<Order | null>(null)
  useTick()

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ['orders', 'active'],
    // ?active=true: sin esto el tablero se trae todo el historico del local.
    queryFn: () => api.get('/orders?active=true').then((res) => res.data),
    refetchInterval: 20_000,
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      api.put(`/orders/${id}/status`, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['orders', 'active'] })
      const previous = queryClient.getQueryData(['orders', 'active'])
      queryClient.setQueryData(['orders', 'active'], (old: Order[] = []) =>
        old.map((o) => (o._id === id ? { ...o, status } : o))
      )
      return { previous }
    },
    onError: (err: any, _vars, context: any) => {
      queryClient.setQueryData(['orders', 'active'], context?.previous)
      // El server rechaza despachar sin el pago confirmado. Ese "no" es util.
      alert(err?.response?.data?.error ?? 'No se pudo cambiar el estado')
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['orders', 'active'] }),
  })

  const paymentMutation = useMutation({
    mutationFn: (id: string) => api.put(`/orders/${id}/payment`, { paymentStatus: 'confirmed' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders', 'active'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/orders/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders', 'active'] }),
  })

  const handleDelete = (id: string) => {
    if (window.confirm('¿Seguro que querés eliminar esta comanda?')) deleteMutation.mutate(id)
  }

  const byStatus = (status: OrderStatus) => orders.filter((o) => o.status === status)

  if (isLoading) return <div className="p-4">Cargando pedidos...</div>

  if (isMobile) {
    const column = COLUMNS.find((c) => c.id === activeColumn)!
    const list = byStatus(activeColumn)

    return (
      <div className="flex flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5">
          <h1 className="font-heading text-[19px] font-bold">Pedidos Live</h1>
          <span className="rounded-2xl bg-secondary px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            {orders.length} activos
          </span>
        </header>

        <div className="flex gap-[7px] overflow-x-auto px-4 pb-1 pt-3">
          {COLUMNS.map((col) => (
            <button
              key={col.id}
              onClick={() => setActiveColumn(col.id)}
              className={cn(
                'h-11 shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-[15px] text-[13px]',
                activeColumn === col.id
                  ? 'border-primary bg-primary font-semibold text-primary-foreground'
                  : 'border-border bg-card font-medium text-muted-foreground'
              )}
            >
              {col.title} {byStatus(col.id).length}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 px-4 pb-5 pt-3">
          {list.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Sin pedidos acá.</p>}
          {list.map((order) => (
            <OrderCard
              key={order._id}
              order={order}
              showAction={column.nextLabel}
              onAdvance={() => statusMutation.mutate({ id: order._id!, status: column.next! })}
              onConfirmPayment={() => paymentMutation.mutate(order._id!)}
              onDelete={() => handleDelete(order._id!)}
              onOpen={() => setDetail(order)}
            />
          ))}
        </div>

        <OrderSheet order={detail} onClose={() => setDetail(null)} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold">Pedidos Live</h1>
        <p className="text-[13px] text-muted-foreground">
          Arrastrá una tarjeta para cambiar el estado. El cliente recibe el aviso solo la primera vez que entra a cada
          columna.
        </p>
      </div>

      <DragDropContext
        onDragEnd={(result) => {
          if (!result.destination) return
          if (result.source.droppableId === result.destination.droppableId) return
          statusMutation.mutate({
            id: result.draggableId,
            status: result.destination.droppableId as OrderStatus,
          })
        }}
      >
        <div className="grid grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const list = byStatus(col.id)
            return (
              <Droppable droppableId={col.id} key={col.id}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="flex min-h-[640px] flex-col gap-2.5 rounded-[10px] bg-secondary p-3"
                  >
                    <div className="flex items-center justify-between px-1 pb-1.5">
                      <span className="font-heading text-sm font-bold">{col.title}</span>
                      <span className="flex h-[22px] min-w-[24px] items-center justify-center rounded-full border border-border bg-card px-[7px] text-xs font-semibold">
                        {list.length}
                      </span>
                    </div>

                    {list.map((order, index) => (
                      <Draggable draggableId={order._id!} index={index} key={order._id}>
                        {(dragProvided) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}
                          >
                            <OrderCard
                              order={order}
                              showAction={col.id === 'on_the_way' || col.id === 'ready' ? col.nextLabel : undefined}
                              onAdvance={() => statusMutation.mutate({ id: order._id!, status: col.next! })}
                              onConfirmPayment={() => paymentMutation.mutate(order._id!)}
                              onDelete={() => handleDelete(order._id!)}
                              onOpen={() => setDetail(order)}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            )
          })}
        </div>
      </DragDropContext>

      <OrderSheet order={detail} onClose={() => setDetail(null)} />
    </div>
  )
}
