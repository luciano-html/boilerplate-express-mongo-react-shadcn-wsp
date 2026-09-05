import { useEffect, useState } from 'react';
import type { Product, StoreConfig, OrderItem, SelectedOption } from '../../shared/index';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingCart } from 'lucide-react';
import { CartDrawer } from './components/CartDrawer';

const API_URL = 'http://localhost:5000/api';

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [config, setConfig] = useState<StoreConfig | null>(null);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/config`).then(res => res.json()).then(setConfig);
    fetch(`${API_URL}/products`).then(res => res.json()).then(setProducts);
  }, []);

  const addToCart = (product: Product, quantity = 1, options: SelectedOption[] = [], notes = '') => {
    // Para simplificar, agrupamos si tiene los mismos ids, pero como las opciones varían mejor insertarlo nuevo
    setCart(prev => [...prev, {
      productId: product.id || (product as any)._id,
      quantity,
      unitPrice: product.price,
      selectedOptions: options,
      notes
    }]);
  };

  if (!config) return <div>Cargando...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold">{config.name}</h1>
          <Button variant="outline" className="relative" onClick={() => setIsCartOpen(true)}>
            <ShoppingCart className="w-5 h-5 mr-2" />
            Ver Carrito
            {cart.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {cart.length}
              </span>
            )}
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-primary text-primary-foreground py-12 px-4 text-center">
        <h2 className="text-3xl font-extrabold mb-2">¡Las mejores hamburguesas!</h2>
        <p>Hacenos tu pedido online, rápido y fácil.</p>
      </section>

      {/* Catálogo */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <h3 className="text-2xl font-bold mb-6">Nuestro Menú</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map(p => (
            <Card key={p.id || (p as any)._id} className="flex flex-col">
              <CardHeader>
                <CardTitle>{p.name}</CardTitle>
                <p className="text-sm text-gray-500">{p.description}</p>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="font-bold text-lg">${p.price}</p>
                {/* Opciones simplificadas para el boilerplate, un modal sería ideal */}
              </CardContent>
              <CardFooter>
                <Button className="w-full" onClick={() => addToCart(p)}>Agregar</Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </main>

      <CartDrawer 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        setCart={setCart}
        config={config}
      />
    </div>
  );
}

export default App;
