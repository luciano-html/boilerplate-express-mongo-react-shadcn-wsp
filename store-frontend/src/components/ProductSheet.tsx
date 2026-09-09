import { useMemo, useState } from 'react';
import { Drawer, DrawerContent } from './ui/drawer';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Check, Minus, Plus, X } from 'lucide-react';
import type { Product, SelectedOption, OrderItem } from '../../../shared/index';

interface ProductSheetProps {
  product: Product | null;
  onClose: () => void;
  onAdd: (item: OrderItem) => void;
  currency?: string;
}

/**
 * Detalle del producto con sus grupos de opciones.
 *
 * Las reglas del grupo (minSelect / maxSelect) se aplican acá y también las
 * revalida el server en orderValidator: el precio y la validez de un pedido no
 * pueden depender de lo que diga el navegador.
 */
export function ProductSheet({ product, onClose, onAdd, currency = '$' }: ProductSheetProps) {
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState('');
  const [quantity, setQuantity] = useState(1);

  const groups = product?.optionGroups ?? [];

  // Reset al abrir otro producto.
  const key = product?._id ?? product?.id ?? '';
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setSelected({});
    setNotes('');
    setQuantity(1);
  }

  const toggle = (groupName: string, optionName: string, maxSelect: number) => {
    setSelected((prev) => {
      const current = prev[groupName] ?? [];
      if (current.includes(optionName)) {
        return { ...prev, [groupName]: current.filter((o) => o !== optionName) };
      }
      // maxSelect 1 se comporta como radio: elegir reemplaza.
      if (maxSelect === 1) return { ...prev, [groupName]: [optionName] };
      if (current.length >= maxSelect) return prev;
      return { ...prev, [groupName]: [...current, optionName] };
    });
  };

  const selectedOptions: SelectedOption[] = useMemo(() => {
    const out: SelectedOption[] = [];
    for (const group of groups) {
      for (const optionName of selected[group.name] ?? []) {
        const option = group.options.find((o) => o.name === optionName);
        if (option) {
          out.push({ groupName: group.name, optionName: option.name, additionalPrice: option.additionalPrice });
        }
      }
    }
    return out;
  }, [selected, groups]);

  const missing = groups.filter((g) => (selected[g.name] ?? []).length < g.minSelect);
  const optionsTotal = selectedOptions.reduce((sum, o) => sum + o.additionalPrice, 0);
  const unitPrice = (product?.price ?? 0) + optionsTotal;
  const total = unitPrice * quantity;

  const handleAdd = () => {
    if (!product || missing.length > 0) return;
    onAdd({
      productId: (product.id || (product as any)._id) as string,
      name: product.name,
      quantity,
      unitPrice: product.price,
      selectedOptions,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <Drawer open={!!product} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="mx-auto flex h-[92vh] max-w-md flex-col bg-background">
        {product && (
          <>
            <div className="relative flex h-44 shrink-0 items-center justify-center border-b border-border bg-muted">
              {product.images?.[0] ? (
                <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-border">
                  <path d="M3 9.5C3 6.46 7.03 4 12 4s9 2.46 9 5.5" />
                  <path d="M3 9.5h18M3.5 13h17" />
                  <path d="M4 16.5h16c0 1.93-1.57 3.5-3.5 3.5h-9C5.57 20 4 18.43 4 16.5Z" />
                </svg>
              )}
              <button
                onClick={onClose}
                className="absolute left-3 top-3 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background/85"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <ScrollArea className="flex-1">
              <div className="flex flex-col gap-2 px-4 pt-5">
                <h1 className="font-display text-2xl leading-tight">{product.name}</h1>
                {product.description && (
                  <p className="text-sm leading-relaxed text-muted-foreground">{product.description}</p>
                )}
                <div className="text-xl font-extrabold text-primary">
                  {currency} {product.price.toLocaleString('es-AR')}
                </div>
              </div>

              {groups.map((group) => {
                const chosen = selected[group.name] ?? [];
                const required = group.minSelect > 0;
                const single = group.maxSelect === 1;

                return (
                  <section key={group.name} className="flex flex-col gap-2.5 px-4 pt-6">
                    <div className="flex items-baseline justify-between gap-3">
                      <h2 className="text-[15px] font-bold">{group.name}</h2>
                      <span
                        className={`text-[11px] font-bold uppercase tracking-wider ${
                          required ? 'text-primary' : 'text-muted-foreground'
                        }`}
                      >
                        {required ? 'Obligatorio' : `Hasta ${group.maxSelect}`}
                      </span>
                    </div>

                    <div className="flex flex-col gap-2">
                      {group.options.map((option) => {
                        const isOn = chosen.includes(option.name);
                        const blocked = !isOn && !single && chosen.length >= group.maxSelect;

                        return (
                          <button
                            key={option.name}
                            onClick={() => toggle(group.name, option.name, group.maxSelect)}
                            disabled={blocked}
                            className={`flex min-h-[48px] items-center gap-3 rounded-xl border px-3.5 text-left transition-colors ${
                              isOn ? 'border-primary/60 bg-secondary' : 'border-border bg-card'
                            } ${blocked ? 'opacity-40' : ''}`}
                          >
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 ${
                                single ? 'rounded-full' : 'rounded-md'
                              } ${isOn ? 'border-primary bg-primary' : 'border-muted-foreground/60'}`}
                            >
                              {isOn &&
                                (single ? (
                                  <span className="h-2 w-2 rounded-full bg-primary-foreground" />
                                ) : (
                                  <Check size={13} strokeWidth={3} className="text-primary-foreground" />
                                ))}
                            </span>
                            <span className={`flex-1 text-[15px] ${isOn ? 'font-semibold' : 'text-foreground/85'}`}>
                              {option.name}
                            </span>
                            {option.additionalPrice > 0 && (
                              <span className="text-sm font-bold text-muted-foreground">
                                + {currency} {option.additionalPrice.toLocaleString('es-AR')}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}

              <section className="flex flex-col gap-2.5 px-4 pt-6 pb-6">
                <h2 className="text-[15px] font-bold">Notas para la cocina</h2>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  maxLength={200}
                  placeholder="Ej: sin cebolla, cortada al medio…"
                  className="w-full rounded-xl border border-border bg-card px-3.5 py-3 text-sm leading-relaxed placeholder:text-muted-foreground/70"
                />
              </section>
            </ScrollArea>

            <div className="flex shrink-0 items-center gap-3 border-t border-border px-4 py-4">
              <div className="flex h-[54px] shrink-0 items-center gap-1 rounded-2xl border border-border bg-card px-1.5">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="flex h-[42px] w-[42px] items-center justify-center rounded-xl text-muted-foreground"
                  aria-label="Menos"
                >
                  <Minus size={18} />
                </button>
                <span className="min-w-[26px] text-center text-[17px] font-bold">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => q + 1)}
                  className="flex h-[42px] w-[42px] items-center justify-center rounded-xl"
                  aria-label="Más"
                >
                  <Plus size={18} />
                </button>
              </div>

              <Button
                onClick={handleAdd}
                disabled={missing.length > 0}
                className="h-[54px] flex-1 justify-between rounded-2xl px-5 text-base font-bold"
              >
                <span>{missing.length > 0 ? `Elegí ${missing[0].name.toLowerCase()}` : 'Agregar'}</span>
                {missing.length === 0 && <span>{currency} {total.toLocaleString('es-AR')}</span>}
              </Button>
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
