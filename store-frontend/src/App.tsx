import { useEffect, useMemo, useState } from 'react';
import type { Product, StoreConfig, OrderItem, NavSection } from '../../shared/index';
import { ShoppingCart, Plus } from 'lucide-react';
import { CartDrawer } from './components/CartDrawer';
import { ProductSheet } from './components/ProductSheet';

const API_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
  : 'http://localhost:5000/api';

function BurgerGlyph({ size = 34, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 9.5C3 6.46 7.03 4 12 4s9 2.46 9 5.5" />
      <path d="M3 9.5h18" />
      <path d="M3.5 13h17" />
      <path d="M4 16.5h16c0 1.93-1.57 3.5-3.5 3.5h-9C5.57 20 4 18.43 4 16.5Z" />
    </svg>
  );
}

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [config, setConfig] = useState<StoreConfig | null>(null);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [detail, setDetail] = useState<Product | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/config`).then((res) => res.json()).then(setConfig);
    fetch(`${API_URL}/products`).then((res) => res.json()).then(setProducts);
  }, []);

  const currency = config?.currency === 'ARS' ? '$' : config?.currency ?? '$';
  const money = (n: number) => `${currency} ${n.toLocaleString('es-AR')}`;

  // El navbar sale de la config, no de constantes en el código. Una categoría
  // activa pero sin productos no se muestra: un filtro que abre una grilla
  // vacía parece un error de la tienda.
  const navSections: NavSection[] = useMemo(
    () => (config?.navSections ?? []).filter((s) => s.isActive).sort((a, b) => a.order - b.order),
    [config]
  );

  const visibleCategories = useMemo(
    () => navSections.filter((s) => s.type === 'category' && products.some((p) => p.categorySlug === s.slug)),
    [navSections, products]
  );

  const currentSlug = activeSlug ?? visibleCategories[0]?.slug ?? null;
  const visibleProducts = currentSlug ? products.filter((p) => p.categorySlug === currentSlug) : products;
  const currentLabel = visibleCategories.find((c) => c.slug === currentSlug)?.label ?? 'Nuestro menú';

  const lineTotal = (item: OrderItem) => {
    const extras = (item.selectedOptions ?? []).reduce((s, o) => s + o.additionalPrice, 0);
    return (item.unitPrice + extras) * item.quantity;
  };
  const cartTotal = cart.reduce((acc, item) => acc + lineTotal(item), 0);
  const cartCount = cart.reduce((acc, i) => acc + i.quantity, 0);

  if (!config) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Cargando…</div>;
  }

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground lg:pb-10">
      <header className="sticky top-0 z-20 border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 lg:h-[76px] lg:px-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-[38px] w-[38px] items-center justify-center rounded-xl bg-primary text-primary-foreground lg:h-10 lg:w-10">
              <BurgerGlyph size={22} />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-display text-[15px] uppercase tracking-wide lg:text-[17px]">{config.name}</span>
              {config.businessHours && (
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 lg:hidden">
                  <span className="h-[7px] w-[7px] rounded-full bg-emerald-400" />
                  {config.businessHours}
                </span>
              )}
            </div>
          </div>

          {/* En desktop las categorías son navegación, no chips: hay lugar y
              se lee de una. En mobile van como chips debajo del hero. */}
          <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex">
            {visibleCategories.map((cat) => (
              <button
                key={cat.slug}
                onClick={() => setActiveSlug(cat.slug)}
                className={`rounded-[10px] px-4 py-2.5 text-[15px] transition-colors ${
                  currentSlug === cat.slug
                    ? 'bg-muted font-bold text-foreground'
                    : 'font-medium text-muted-foreground hover:text-foreground'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <div className="hidden flex-col items-end gap-0.5 lg:flex">
              {config.businessHours && (
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-emerald-400">
                  <span className="h-[7px] w-[7px] rounded-full bg-emerald-400" />
                  {config.businessHours}
                </span>
              )}
              {config.whatsapp && (
                <span className="text-sm font-semibold text-muted-foreground">{config.whatsapp}</span>
              )}
            </div>

            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-secondary lg:hidden"
              aria-label="Ver carrito"
            >
              <ShoppingCart size={20} />
              {cartCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl gap-8 px-0 lg:flex lg:items-start lg:px-8 lg:pt-9">
        <div className="min-w-0 flex-1">
          <section className="border-b border-border bg-card px-4 pb-6 pt-6 lg:flex lg:items-center lg:gap-8 lg:rounded-2xl lg:border lg:px-9 lg:py-8">
            <div className="min-w-0 flex-1">
              <h1 className="mb-2.5 font-display text-[32px] uppercase leading-none tracking-tight lg:text-[44px]">
                Hamburguesas
                <br />a la parrilla
              </h1>
              <p className="max-w-[290px] text-sm leading-snug text-muted-foreground lg:max-w-[460px] lg:text-[17px] lg:leading-relaxed">
                Pedí online y te avisamos por WhatsApp cuando salga de la parrilla.
              </p>
            </div>
            <div className="hidden h-[190px] w-[300px] shrink-0 items-center justify-center rounded-xl border border-border bg-muted lg:flex">
              <BurgerGlyph size={64} className="text-border" />
            </div>
          </section>

          {visibleCategories.length > 1 && (
            <nav className="flex gap-2 overflow-x-auto px-4 pb-1 pt-4 lg:hidden">
              {visibleCategories.map((cat) => (
                <button
                  key={cat.slug}
                  onClick={() => setActiveSlug(cat.slug)}
                  className={`h-11 shrink-0 whitespace-nowrap rounded-full border px-[18px] text-sm transition-colors ${
                    currentSlug === cat.slug
                      ? 'border-primary bg-primary font-bold text-primary-foreground'
                      : 'border-border bg-card font-semibold text-muted-foreground'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </nav>
          )}

          <main className="px-4 pb-4 pt-5 lg:px-0 lg:pt-8">
            <h2 className="mb-3 text-[13px] font-bold uppercase tracking-[0.12em] text-muted-foreground lg:mb-4">
              {currentLabel}
            </h2>

            {visibleProducts.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">No hay productos en esta categoría.</p>
            )}

            {/* Mobile: filas. Desktop: grilla de cards verticales, que es como
                se mira un menú cuando hay ancho para las fotos. */}
            <div className="flex flex-col gap-3 sm:grid sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
              {visibleProducts.map((p) => {
                const out = p.stock === 0;
                return (
                  <article
                    key={p.id || (p as any)._id}
                    onClick={() => !out && setDetail(p)}
                    className={`flex items-center gap-3.5 rounded-2xl border border-border bg-card p-3.5 sm:flex-col sm:items-stretch sm:gap-0 sm:p-4 ${
                      out ? 'opacity-55' : 'cursor-pointer sm:transition-colors sm:hover:border-muted-foreground/40'
                    }`}
                  >
                    <div className="flex h-[88px] w-[88px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted sm:mb-3.5 sm:h-40 sm:w-full">
                      {p.images?.[0] ? (
                        <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <BurgerGlyph size={40} className="text-border" />
                      )}
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-none">
                      <h3 className="text-[17px] font-bold leading-tight sm:text-[19px]">{p.name}</h3>
                      {p.description && (
                        <p className="line-clamp-2 text-[13px] leading-snug text-muted-foreground sm:text-sm sm:leading-normal">
                          {p.description}
                        </p>
                      )}
                      {out && (
                        <span className="mt-1 text-[13px] font-bold uppercase tracking-wide text-muted-foreground">
                          Sin stock
                        </span>
                      )}
                    </div>

                    {!out && (
                      <>
                        <span className="mt-0.5 hidden text-[17px] font-extrabold text-primary sm:mt-3.5 sm:flex sm:items-center sm:justify-between sm:gap-3 sm:text-xl">
                          {money(p.price)}
                          <span className="flex h-11 items-center rounded-xl bg-primary px-5 text-[15px] font-bold text-primary-foreground">
                            Agregar
                          </span>
                        </span>
                        <span className="mt-0.5 text-[17px] font-extrabold text-primary sm:hidden">
                          {money(p.price)}
                        </span>
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground sm:hidden">
                          <Plus size={20} strokeWidth={2.5} />
                        </span>
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          </main>
        </div>

        {/* Carrito fijo a la derecha en desktop. En mobile no existe: ahí vive
            en el drawer, porque no hay ancho para dos columnas. */}
        <aside className="sticky top-[100px] hidden w-[352px] shrink-0 flex-col gap-4 rounded-2xl border border-border bg-card p-5 lg:flex">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-[18px]">Tu pedido</h2>
            <span className="text-[13px] font-semibold text-muted-foreground">
              {cartCount} {cartCount === 1 ? 'ítem' : 'ítems'}
            </span>
          </div>

          {cart.length === 0 ? (
            <p className="py-8 text-center text-sm leading-relaxed text-muted-foreground">
              Todavía no agregaste nada.
              <br />
              Tocá un producto para empezar.
            </p>
          ) : (
            <>
              <div className="flex max-h-[320px] flex-col gap-2.5 overflow-y-auto">
                {cart.map((item, i) => (
                  <div key={i} className="flex flex-col gap-1.5 rounded-xl border border-border bg-secondary p-3">
                    <div className="flex items-start justify-between gap-2.5">
                      <span className="text-[15px] font-bold leading-tight">
                        {item.quantity} × {item.name ?? 'Producto'}
                      </span>
                      <span className="whitespace-nowrap text-[15px] font-extrabold">{money(lineTotal(item))}</span>
                    </div>
                    {(item.selectedOptions ?? []).length > 0 && (
                      <span className="text-[13px] text-muted-foreground">
                        {(item.selectedOptions ?? []).map((o) => o.optionName).join(' · ')}
                      </span>
                    )}
                    {item.notes && <span className="text-[13px] text-amber-400">{item.notes}</span>}
                    <button
                      onClick={() => setCart((prev) => prev.filter((_, idx) => idx !== i))}
                      className="self-start text-[11px] text-muted-foreground hover:text-primary"
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>

              <div className="h-px bg-border" />

              <div className="flex items-baseline justify-between">
                <span className="text-[15px] font-bold">Subtotal</span>
                <span className="font-display text-[22px] text-primary">{money(cartTotal)}</span>
              </div>
              <p className="-mt-2 text-[11px] leading-relaxed text-muted-foreground">
                El envío se calcula al elegir la zona.
              </p>

              <button
                onClick={() => setIsCartOpen(true)}
                className="h-[52px] w-full rounded-xl bg-primary text-base font-bold text-primary-foreground"
              >
                Continuar
              </button>
            </>
          )}
        </aside>
      </div>

      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background p-4 lg:hidden">
          <button
            onClick={() => setIsCartOpen(true)}
            className="mx-auto flex h-[54px] w-full max-w-md items-center justify-between rounded-2xl bg-primary px-5 text-base font-bold text-primary-foreground"
          >
            <span>Ver carrito · {cartCount} {cartCount === 1 ? 'ítem' : 'ítems'}</span>
            <span>{money(cartTotal)}</span>
          </button>
        </div>
      )}

      <ProductSheet
        product={detail}
        currency={currency}
        onClose={() => setDetail(null)}
        onAdd={(item) => setCart((prev) => [...prev, item])}
      />

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
