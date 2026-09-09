import React, { useState } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from './ui/drawer';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import type { StoreConfig, OrderItem } from '../../../shared/index';

const API_URL = 'http://localhost:5000/api';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: OrderItem[];
  setCart: React.Dispatch<React.SetStateAction<OrderItem[]>>;
  config: StoreConfig;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose, cart, setCart, config }) => {
  const [orderType, setOrderType] = useState<'delivery' | 'takeaway'>('delivery');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  
  const [selectedCity, setSelectedCity] = useState<'Santo Tomé' | 'Santa Fe'>('Santo Tomé');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>('');
  // La zona define cuanto se cobra; la calle define a donde va el cadete.
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');

  // Se guarda el pedido confirmado en su propio estado. Antes la pantalla de
  // exito leia `total`, que se deriva del carrito -- y el carrito ya estaba
  // vacio, asi que mostraba solo el costo de envio como si fuera el total.
  const [confirmed, setConfirmed] = useState<{
    total: number;
    eta: number;
    orderNumber?: number;
    handshakeCode?: string;
    paymentMethod: 'cash' | 'transfer';
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const availableNeighborhoods = config.deliveryZones?.filter(z => z.city === selectedCity) || [];
  const selectedZoneCost = availableNeighborhoods.find(z => z.neighborhood === selectedNeighborhood)?.cost || 0;

  const subtotal = cart.reduce((acc, item) => {
    const optionsTotal = (item.selectedOptions || []).reduce((sum, opt) => sum + opt.additionalPrice, 0);
    return acc + (item.unitPrice + optionsTotal) * item.quantity;
  }, 0);

  const total = orderType === 'delivery' ? subtotal + selectedZoneCost : subtotal;

  const handleConfirm = async () => {
    if (!customerName || !customerPhone) return alert('Por favor, completa tus datos');
    if (orderType === 'delivery' && !selectedNeighborhood) return alert('Selecciona tu barrio');
    if (orderType === 'delivery' && deliveryAddress.trim().length < 5) return alert('Escribi tu direccion (calle y numero)');

    const orderPayload = {
      customerName,
      customerPhone,
      orderType,
      deliveryCity: orderType === 'delivery' ? selectedCity : undefined,
      deliveryNeighborhood: orderType === 'delivery' ? selectedNeighborhood : undefined,
      deliveryAddress: orderType === 'delivery' ? deliveryAddress.trim() : undefined,
      paymentMethod,
      items: cart,
      total,
      discounts: 0,
      surcharges: 0
    };

    try {
      const response = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });
      const data = await response.json();
      if (!response.ok) {
        alert(data.error ?? 'No se pudo confirmar el pedido');
        return;
      }
      setConfirmed({
        total,
        eta: data.estimatedTime,
        orderNumber: data.orderNumber,
        handshakeCode: data.handshakeCode,
        paymentMethod,
      });
      setCart([]);
    } catch (error) {
      console.error(error);
      alert('Hubo un error al procesar el pedido');
    }
  };

  if (confirmed !== null) {
    const money = (n: number) => `$${n.toLocaleString('es-AR')}`;

    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="max-w-md mx-auto max-h-[92dvh] bg-background flex flex-col">
          <DrawerHeader className="shrink-0">
            <DrawerTitle className="text-center text-emerald-400 text-2xl">¡Pedido confirmado!</DrawerTitle>
          </DrawerHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 text-center space-y-5" data-vaul-no-drag>
            <p className="text-muted-foreground">
              {confirmed.orderNumber
                ? <>Tu pedido es el <span className="font-bold text-foreground">#{confirmed.orderNumber}</span>.</>
                : 'Tu pedido fue recibido.'}
            </p>

            {confirmed.paymentMethod === 'transfer' && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-3 text-left">
                <p className="font-bold text-amber-300">
                  Transferí {money(confirmed.total)} para que empecemos a prepararlo.
                </p>

                {config.transferAlias ? (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-background/40 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">Alias</span>
                      <span className="block truncate font-mono text-base font-bold">{config.transferAlias}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(config.transferAlias!);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="shrink-0 rounded-lg border border-amber-500/40 px-3 py-2 text-xs font-bold text-amber-300"
                    >
                      {copied ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-amber-200/80">
                    Pedinos el alias por WhatsApp y mandanos el comprobante.
                  </p>
                )}

                <p className="text-sm text-amber-200/80">
                  Mandá el comprobante por WhatsApp: hasta que no lo verifiquemos, el pedido no entra a la cocina.
                </p>
              </div>
            )}

            {confirmed.handshakeCode && config.whatsapp && (
              <a
                href={`https://wa.me/${config.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
                  `Hola, mi pedido #${confirmed.handshakeCode}`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="flex h-[52px] w-full items-center justify-center gap-2.5 rounded-xl bg-emerald-600 text-base font-bold text-white"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.5 11.5a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5l1.7-4.3A8.5 8.5 0 1 1 20.5 11.5Z" />
                </svg>
                Confirmar por WhatsApp
              </a>
            )}
            {confirmed.handshakeCode && (
              <p className="-mt-2 text-xs leading-relaxed text-muted-foreground">
                Mandanos ese mensaje y quedás vinculado: a partir de ahí te avisamos por WhatsApp
                cuando entre a la parrilla y cuando salga.
              </p>
            )}

            <div className="pt-2">
              <h4 className="text-sm uppercase tracking-wider text-muted-foreground">Tiempo estimado</h4>
              <p className="mt-2 font-display text-5xl text-primary">
                {confirmed.eta} <span className="text-xl text-foreground">min</span>
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Te avisamos por WhatsApp cuando entre a la parrilla y cuando salga.
              </p>
            </div>
          </div>

          <DrawerFooter className="shrink-0">
            <Button className="w-full" onClick={() => { setConfirmed(null); onClose(); }}>Cerrar</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-w-md mx-auto h-[92dvh] flex flex-col bg-background">
        <DrawerHeader>
          <DrawerTitle>Tu Pedido</DrawerTitle>
        </DrawerHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4" data-vaul-no-drag>
          {cart.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Tu carrito está vacío</p>
          ) : (
            <div className="space-y-6">
              {/* Items */}
              <div className="space-y-4">
                {cart.map((item, idx) => {
                  const optionsTotal = (item.selectedOptions || []).reduce((sum, opt) => sum + opt.additionalPrice, 0);
                  return (
                    <div key={idx} className="flex flex-col gap-2 border-b border-border pb-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium">{item.name ?? 'Producto'}</p>
                          {item.selectedOptions?.map(opt => (
                            <p key={opt.optionName} className="text-sm text-muted-foreground">+ {opt.optionName}</p>
                          ))}
                          {item.notes && <p className="text-xs text-amber-400 mt-1">Nota: {item.notes}</p>}
                        </div>
                        <p className="whitespace-nowrap font-bold">${(item.unitPrice + optionsTotal) * item.quantity}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-1">
                          <button
                            type="button"
                            aria-label="Quitar uno"
                            onClick={() => setCart(prev => prev.map((it, i) =>
                              i === idx ? { ...it, quantity: Math.max(1, it.quantity - 1) } : it
                            ))}
                            className="flex h-9 w-9 items-center justify-center text-muted-foreground"
                          >
                            <Minus size={16} />
                          </button>
                          <span className="min-w-[22px] text-center text-sm font-bold">{item.quantity}</span>
                          <button
                            type="button"
                            aria-label="Agregar uno"
                            onClick={() => setCart(prev => prev.map((it, i) =>
                              i === idx ? { ...it, quantity: it.quantity + 1 } : it
                            ))}
                            className="flex h-9 w-9 items-center justify-center"
                          >
                            <Plus size={16} />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => setCart(prev => prev.filter((_, i) => i !== idx))}
                          className="flex h-9 items-center gap-1.5 rounded-lg px-2 text-xs text-muted-foreground hover:text-primary"
                        >
                          <Trash2 size={14} /> Eliminar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Order Type */}
              <div className="space-y-3">
                <Label className="text-base font-bold">Método de entrega</Label>
                <RadioGroup value={orderType} onValueChange={(v: any) => setOrderType(v)} className="flex space-x-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="delivery" id="delivery" />
                    <Label htmlFor="delivery">Delivery</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="takeaway" id="takeaway" />
                    <Label htmlFor="takeaway">Retirar por local</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Delivery Zone Selector */}
              {orderType === 'delivery' && (
                <div className="space-y-3 bg-secondary p-3 rounded-lg">
                  <Label>Ciudad</Label>
                  <Select value={selectedCity} onValueChange={(v: any) => setSelectedCity(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Santo Tomé">Santo Tomé</SelectItem>
                      <SelectItem value="Santa Fe">Santa Fe</SelectItem>
                    </SelectContent>
                  </Select>

                  <Label className="mt-2 block">Barrio</Label>
                  <Select value={selectedNeighborhood} onValueChange={(v: any) => setSelectedNeighborhood(v)}>
                    <SelectTrigger><SelectValue placeholder="Selecciona tu barrio" /></SelectTrigger>
                    <SelectContent>
                      {availableNeighborhoods.map(z => (
                        <SelectItem key={z.id || z.neighborhood} value={z.neighborhood}>
                          {z.neighborhood} (+${z.cost})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* El barrio dice cuanto se cobra; esto dice a donde va el cadete.
                      Sin este campo el pedido llega al tablero con el barrio y nada mas. */}
                  <Label className="mt-2 block">Dirección</Label>
                  <Input
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Calle y número, piso/depto"
                  />
                  <p className="text-xs text-muted-foreground">
                    Si hay alguna referencia útil (portón, timbre), agregala acá.
                  </p>
                </div>
              )}

              {/* Payment Method */}
              <div className="space-y-3">
                <Label className="text-base font-bold">Medio de pago</Label>
                <RadioGroup value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)} className="flex space-x-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cash" id="cash" />
                    <Label htmlFor="cash">Efectivo</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="transfer" id="transfer" />
                    <Label htmlFor="transfer">Transferencia</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Customer Info */}
              <div className="space-y-3">
                <Label className="text-base font-bold">Tus Datos</Label>
                <Input placeholder="Nombre y Apellido" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                <Input placeholder="WhatsApp (Ej: 3421234567)" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        <DrawerFooter className="shrink-0 border-t border-border bg-card">
          <div className="flex justify-between items-center mb-4">
            <span className="font-bold">Total:</span>
            <span className="text-2xl font-black">${total}</span>
          </div>
          <Button size="lg" className="w-full" disabled={cart.length === 0} onClick={handleConfirm}>
            Confirmar Pedido
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
