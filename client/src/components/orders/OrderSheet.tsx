import { useMutation, useQueryClient } from '@tanstack/react-query'
import { MapPin, MessageCircle, Phone, ShoppingBag } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import api from '@/services/api'
import { cn } from '@/lib/utils'
import type { Order, OrderStatus } from 'shared'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Entró',
  cooking: 'A la parrilla',
  ready: 'Listo',
  on_the_way: 'Salió el cadete',
  closed: 'Entregado',
  cancelled: 'Cancelado',
}

const money = (n: number) => `$ ${n.toLocaleString('es-AR')}`
const hhmm = (d: Date | string) =>
  new Date(d).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

/** Solo dígitos: los links tel:/wa.me no toleran espacios ni paréntesis. */
const digits = (s?: string) => (s ?? '').replace(/\D/g, '')

export function OrderSheet({ order, onClose }: { order: Order | null; onClose: () => void }) {
  const queryClient = useQueryClient()

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      api.put(`/orders/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', 'active'] })
      onClose()
    },
    onError: (err: any) => alert(err?.response?.data?.error ?? 'No se pudo cerrar el pedido'),
  })

  if (!order) return null

  const items = order.items ?? []
  const subtotal = items.reduce((acc, item) => {
    const extras = (item.selectedOptions ?? []).reduce((s, o) => s + o.additionalPrice, 0)
    return acc + (item.unitPrice + extras) * item.quantity
  }, 0)
  const shipping = Math.max(0, order.total - subtotal)

  const waiting = Math.max(0, Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000))
  const late = order.estimatedTime ? waiting >= order.estimatedTime : false

  // La duración real de cocina sale de la misma traza que calibra el ETA.
  const at = (s: string) => order.statusHistory?.find((e) => e.status === s)?.at
  const cookedIn =
    at('pending') && at('ready')
      ? Math.round((new Date(at('ready')!).getTime() - new Date(at('pending')!).getTime()) / 60000)
      : null

  const phone = digits(order.customerPhone)

  return (
    <Sheet open={!!order} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-[460px]">
        <SheetHeader className="space-y-1.5 border-b border-border p-5 text-left">
          <div className="flex items-center gap-2.5">
            <SheetTitle className="font-heading text-[22px]">Pedido #{order.orderNumber}</SheetTitle>
            <span
              className={cn(
                'rounded-xl px-[9px] py-[3px] text-xs font-semibold',
                late ? 'bg-[#fdecee] font-bold text-destructive' : 'bg-[#fdf0dd] text-[#b45309]'
              )}
            >
              {waiting} min
            </span>
          </div>
          <p className="text-[13px] text-muted-foreground">
            {STATUS_LABEL[order.status] ?? order.status} ·{' '}
            {order.orderType === 'delivery' ? 'Delivery' : 'Retiro en local'} ·{' '}
            {order.paymentMethod === 'cash' ? 'Efectivo' : 'Transferencia'}
            {order.paymentStatus === 'pending' && (
              <span className="font-semibold text-[#b45309]"> · falta comprobante</span>
            )}
          </p>
        </SheetHeader>

        {order.lastNotificationError && (
          <div className="border-b border-border bg-[#fdecee] px-5 py-3 text-xs font-semibold text-destructive">
            No se pudo avisar al cliente por WhatsApp ({hhmm(order.lastNotificationError.at)}).
            <span className="block font-normal">{order.lastNotificationError.message}</span>
          </div>
        )}

        <section className="flex flex-col gap-3 border-b border-border p-5">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Cliente</h2>
          <div className="text-base font-semibold">{order.customerName}</div>

          <div className="flex items-start gap-2.5">
            {order.orderType === 'delivery' ? (
              <MapPin size={17} className="mt-0.5 shrink-0 text-muted-foreground" />
            ) : (
              <ShoppingBag size={17} className="mt-0.5 shrink-0 text-muted-foreground" />
            )}
            <div className="flex flex-col gap-0.5">
              {order.orderType === 'delivery' ? (
                <>
                  <span className="text-sm font-medium leading-snug">
                    {order.deliveryAddress ?? 'Sin dirección cargada'}
                  </span>
                  <span className="text-[13px] text-muted-foreground">
                    {[order.deliveryNeighborhood, order.deliveryCity].filter(Boolean).join(', ') || 'Sin zona'}
                    {shipping > 0 && ` · envío ${money(shipping)}`}
                  </span>
                </>
              ) : (
                <span className="text-sm font-medium">Retira por el local</span>
              )}
            </div>
          </div>

          {/* Links reales: un número para leer y tipear a mano no sirve un
              viernes a las 22. */}
          <div className="flex gap-2">
            <a
              href={`https://wa.me/${phone}`}
              target="_blank"
              rel="noreferrer"
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-md border border-border text-[13px] font-semibold"
            >
              <MessageCircle size={15} />
              {order.customerPhone}
            </a>
            <a
              href={`tel:+${phone}`}
              className="flex h-10 w-11 items-center justify-center rounded-md border border-border"
              aria-label="Llamar"
            >
              <Phone size={15} />
            </a>
          </div>
        </section>

        <section className="flex flex-col gap-3 border-b border-border p-5">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Pedido</h2>

          {items.map((item, i) => {
            const extras = (item.selectedOptions ?? []).reduce((s, o) => s + o.additionalPrice, 0)
            return (
              <div key={i} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2.5">
                  <span className="text-sm font-semibold">
                    {item.quantity} × {item.name ?? 'Producto'}
                  </span>
                  <span className="whitespace-nowrap text-sm font-semibold">
                    {money((item.unitPrice + extras) * item.quantity)}
                  </span>
                </div>
                {(item.selectedOptions ?? []).length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {(item.selectedOptions ?? []).map((o) => o.optionName).join(' · ')}
                  </span>
                )}
                {item.notes && <span className="text-xs text-[#b45309]">Nota: {item.notes}</span>}
              </div>
            )
          })}

          <div className="h-px bg-border" />

          <div className="flex flex-col gap-1.5 text-[13px]">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{money(subtotal)}</span>
            </div>
            {shipping > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Envío</span>
                <span>{money(shipping)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-[15px] font-bold">Total</span>
              <span className="text-lg font-bold">{money(order.total)}</span>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3 p-5">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Línea de tiempo</h2>

          <div className="flex flex-col">
            {(order.statusHistory ?? []).map((event, i, all) => (
              <div key={i}>
                <div className="grid grid-cols-[16px_minmax(0,1fr)_auto] items-start gap-3">
                  <span
                    className={cn(
                      'mt-[5px] block h-[9px] w-[9px] rounded-full',
                      i === all.length - 1 ? 'bg-[#b45309]' : 'bg-[#15803d]'
                    )}
                  />
                  <span className={cn('text-[13px]', i === all.length - 1 && 'font-semibold')}>
                    {STATUS_LABEL[event.status] ?? event.status}
                  </span>
                  <span className="text-xs text-muted-foreground">{hhmm(event.at)}</span>
                </div>
                {i < all.length - 1 && <div className="ml-1 h-4 border-l border-border" />}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2.5 rounded-md bg-secondary px-3 py-2.5 text-xs">
            <span className="text-muted-foreground">
              Prometido {order.estimatedTime ?? '—'} min
              {cookedIn !== null && ` · cocina real ${cookedIn} min`}
            </span>
            <span className={cn('font-semibold', late && 'text-destructive')}>{late ? 'Se pasó' : 'Va bien'}</span>
          </div>

          {order.status !== 'closed' && order.status !== 'cancelled' && (
            <Button
              className="h-11 w-full"
              disabled={statusMutation.isPending}
              onClick={() => statusMutation.mutate({ id: order._id!, status: 'closed' })}
            >
              Cerrar pedido
            </Button>
          )}
        </section>
      </SheetContent>
    </Sheet>
  )
}
