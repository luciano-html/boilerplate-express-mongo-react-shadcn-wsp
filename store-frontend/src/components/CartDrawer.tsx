import React, { useState } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from './ui/drawer';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { ScrollArea } from './ui/scroll-area';
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

  const [eta, setEta] = useState<number | null>(null);

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

    const orderPayload = {
      customerName,
      customerPhone,
      orderType,
      deliveryCity: orderType === 'delivery' ? selectedCity : undefined,
      deliveryNeighborhood: orderType === 'delivery' ? selectedNeighborhood : undefined,
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
      setEta(data.estimatedTime);
      setCart([]);
    } catch (error) {
      console.error(error);
      alert('Hubo un error al procesar el pedido');
    }
  };

  if (eta !== null) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="max-w-md mx-auto h-[90vh]">
          <DrawerHeader>
            <DrawerTitle className="text-center text-green-600 text-2xl">¡Pedido Confirmado!</DrawerTitle>
          </DrawerHeader>
          <div className="p-4 text-center space-y-4">
            <p>Tu pedido ha sido procesado exitosamente.</p>
            {paymentMethod === 'transfer' && (
              <div className="bg-yellow-50 p-4 rounded-md text-yellow-800">
                <p className="font-bold">Por favor realiza la transferencia de ${total}.</p>
                <p className="text-sm">Envíanos el comprobante por WhatsApp para que empecemos a prepararlo.</p>
              </div>
            )}
            <div className="mt-8">
              <h4 className="text-sm text-gray-500 uppercase">Tiempo estimado</h4>
              <p className="text-5xl font-black mt-2">{eta} <span className="text-xl">min</span></p>
            </div>
            <Button className="w-full mt-8" onClick={() => { setEta(null); onClose(); }}>Cerrar</Button>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-w-md mx-auto h-[90vh] flex flex-col">
        <DrawerHeader>
          <DrawerTitle>Tu Pedido</DrawerTitle>
        </DrawerHeader>

        <ScrollArea className="flex-1 px-4">
          {cart.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Tu carrito está vacío</p>
          ) : (
            <div className="space-y-6">
              {/* Items */}
              <div className="space-y-4">
                {cart.map((item, idx) => {
                  const optionsTotal = (item.selectedOptions || []).reduce((sum, opt) => sum + opt.additionalPrice, 0);
                  return (
                    <div key={idx} className="flex justify-between items-start border-b pb-4">
                      <div>
                        <p className="font-medium">{item.quantity}x Producto ID: {item.productId}</p>
                        {item.selectedOptions?.map(opt => (
                          <p key={opt.optionName} className="text-sm text-gray-500">+ {opt.optionName}</p>
                        ))}
                        {item.notes && <p className="text-xs text-orange-600 mt-1">Nota: {item.notes}</p>}
                      </div>
                      <p className="font-bold">${(item.unitPrice + optionsTotal) * item.quantity}</p>
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
                <div className="space-y-3 bg-gray-50 p-3 rounded-lg">
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
        </ScrollArea>

        <DrawerFooter className="border-t bg-white">
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
