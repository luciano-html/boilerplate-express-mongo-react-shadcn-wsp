import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import api from '@/services/api';

const columns = [
  { id: 'pending_payment', title: 'Pendiente de Pago' },
  { id: 'pending', title: 'Pendiente' },
  { id: 'in_preparation', title: 'En Preparación' },
  { id: 'in_expedition', title: 'En Expedición' },
  { id: 'dispatched', title: 'En Camino / Retiro' },
];

export default function PedidosLive() {
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      const { data } = await api.get('/orders');
      setOrders(data);
    } catch (e) {
      console.error(e);
    }
  };

  const onDragEnd = async (result: any) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId) return;

    const newStatus = destination.droppableId;
    
    // Optistic update
    const updated = orders.map(o => o._id === draggableId ? { ...o, status: newStatus } : o);
    setOrders(updated);

    try {
      await api.put(`/orders/${draggableId}/status`, { status: newStatus });
    } catch (e) {
      console.error('Error updating status', e);
      fetchOrders(); // revert on error
    }
  };

  const getOrdersByStatus = (status: string) => orders.filter(o => o.status === status);

  // Desktop drag and drop, mobile simple list fallback
  const isMobile = window.innerWidth < 768;

  if (isMobile) {
    return (
      <div className="p-4 space-y-4">
        <h1 className="text-2xl font-bold mb-4">Pedidos Live</h1>
        {columns.map(col => (
          <div key={col.id} className="border rounded-md p-4 bg-gray-50">
            <h2 className="font-bold text-lg mb-2">{col.title} ({getOrdersByStatus(col.id).length})</h2>
            <div className="space-y-2">
              {getOrdersByStatus(col.id).map(o => (
                <Card key={o._id}>
                  <CardContent className="p-3 text-sm">
                    <p className="font-bold">{o.customerName} - {o.customerPhone}</p>
                    <p>Total: ${o.total} ({o.paymentMethod})</p>
                    {/* Botones de acción manuales como dicta el Spec para Mobile */}
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {columns.map(c => (
                        c.id !== o.status && (
                          <Badge key={c.id} className="cursor-pointer" onClick={() => onDragEnd({ destination: { droppableId: c.id }, source: { droppableId: o.status }, draggableId: o._id })}>
                            Mover a {c.title}
                          </Badge>
                        )
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="p-4 h-[calc(100vh-4rem)] flex flex-col">
      <h1 className="text-2xl font-bold mb-4">Pedidos Live (Kanban)</h1>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 flex-1 overflow-x-auto pb-4">
          {columns.map(col => (
            <div key={col.id} className="w-80 flex-shrink-0 flex flex-col bg-gray-100 rounded-lg">
              <div className="p-3 font-bold border-b bg-gray-200 rounded-t-lg flex justify-between">
                <span>{col.title}</span>
                <Badge variant="secondary">{getOrdersByStatus(col.id).length}</Badge>
              </div>
              <Droppable droppableId={col.id}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="flex-1 p-2 space-y-2 overflow-y-auto"
                  >
                    {getOrdersByStatus(col.id).map((order, index) => (
                      <Draggable key={order._id} draggableId={order._id} index={index}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                          >
                            <Card className="cursor-grab active:cursor-grabbing">
                              <CardContent className="p-3 text-sm space-y-1">
                                <div className="flex justify-between font-bold">
                                  <span>{order.customerName}</span>
                                  <span>${order.total}</span>
                                </div>
                                <p className="text-xs text-gray-500">{order.orderType} - {order.paymentMethod}</p>
                                <p className="text-xs">{order.items.length} ítems</p>
                              </CardContent>
                            </Card>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
