import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { GripVertical, Plus, Trash2, Eye, EyeOff, ChevronDown, ChevronRight } from 'lucide-react'
import api from '@/services/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { slugify, type NavSection, type StoreConfig, type Product } from 'shared'

type Draft = NavSection & { isNew?: boolean }

const BLOCK_LABEL: Record<string, string> = {
  heading: 'Título',
  text: 'Párrafo',
  image: 'Imagen (URL)',
}

export default function Navegacion() {
  const queryClient = useQueryClient()
  const [sections, setSections] = useState<Draft[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { data: config, isLoading } = useQuery<StoreConfig>({
    queryKey: ['store-config'],
    queryFn: () => api.get('/config').then((r) => r.data),
  })

  // Los productos solo se usan para avisar qué categorías están vacías. El
  // storefront las oculta, así que sin este aviso el dueño publica un ítem de
  // nav que sus clientes nunca ven y no entiende por qué.
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products', 'all'],
    queryFn: () => api.get('/products?all=true').then((r) => r.data),
  })

  useEffect(() => {
    if (config?.navSections) setSections(config.navSections as Draft[])
  }, [config])

  const saveMutation = useMutation({
    mutationFn: (navSections: NavSection[]) => api.put('/config/nav', { navSections }),
    onSuccess: () => {
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['store-config'] })
    },
    // El server rechaza borrar una categoría que todavía tiene productos.
    // Ese "no" es información, no un fallo: hay que mostrarlo tal cual.
    onError: (err: any) => setError(err?.response?.data?.error ?? 'No se pudo guardar'),
  })

  const countFor = (slug: string) => products.filter((p) => p.categorySlug === slug).length

  const update = (index: number, patch: Partial<Draft>) =>
    setSections((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))

  const add = (type: 'category' | 'page') => {
    const base = type === 'category' ? 'Nueva categoría' : 'Nueva página'
    let slug = slugify(base)
    let n = 2
    while (sections.some((s) => s.slug === slug)) slug = `${slugify(base)}-${n++}`

    setSections((prev) => [
      ...prev,
      {
        slug,
        label: base,
        type,
        order: prev.length,
        isActive: false, // nace oculta: nadie publica algo sin terminar de escribirlo
        ...(type === 'page' ? { content: { blocks: [{ type: 'text' as const, value: '' }] } } : {}),
        isNew: true,
      },
    ])
    setExpanded(slug)
  }

  const remove = (index: number) => {
    const section = sections[index]
    if (section.type === 'category' && countFor(section.slug) > 0) {
      setError(`"${section.label}" tiene ${countFor(section.slug)} producto(s). Movelos a otra categoría antes de borrarla.`)
      return
    }
    if (!window.confirm(`¿Borrar "${section.label}"?`)) return
    setSections((prev) => prev.filter((_, i) => i !== index))
  }

  const onDragEnd = (result: any) => {
    if (!result.destination) return
    const next = [...sections]
    const [moved] = next.splice(result.source.index, 1)
    next.splice(result.destination.index, 0, moved)
    setSections(next.map((s, i) => ({ ...s, order: i })))
  }

  const save = () => {
    setError(null)
    saveMutation.mutate(
      sections.map(({ isNew, ...s }, i) => ({ ...s, order: i })) as NavSection[]
    )
  }

  if (isLoading) return <div className="p-4">Cargando navegación...</div>

  const dirty = JSON.stringify(sections.map(({ isNew, ...s }) => s)) !== JSON.stringify(config?.navSections ?? [])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-3xl font-bold tracking-tight">Navegación</h1>
          <p className="text-sm text-muted-foreground">
            Lo que ven tus clientes en el menú de la tienda. Arrastrá para cambiar el orden.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => add('category')}>
            <Plus size={15} className="mr-2" /> Categoría
          </Button>
          <Button variant="outline" onClick={() => add('page')}>
            <Plus size={15} className="mr-2" /> Página
          </Button>
          <Button onClick={save} disabled={!dirty || saveMutation.isPending}>
            {saveMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive bg-[#fdecee] px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="nav">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-col gap-2">
              {sections.length === 0 && (
                <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                  Todavía no hay secciones. Agregá una categoría para empezar.
                </p>
              )}

              {sections.map((section, index) => {
                const count = countFor(section.slug)
                const isEmpty = section.type === 'category' && count === 0
                const isOpen = expanded === section.slug

                return (
                  <Draggable draggableId={section.slug} index={index} key={section.slug}>
                    {(drag) => (
                      <div
                        ref={drag.innerRef}
                        {...drag.draggableProps}
                        className={cn(
                          'rounded-lg border bg-card',
                          section.isActive ? 'border-border' : 'border-dashed border-border opacity-70'
                        )}
                      >
                        <div className="flex items-center gap-3 p-3">
                          <span {...drag.dragHandleProps} className="cursor-grab text-muted-foreground">
                            <GripVertical size={17} />
                          </span>

                          <Input
                            value={section.label}
                            onChange={(e) => update(index, { label: e.target.value })}
                            className="max-w-[240px]"
                          />

                          <Badge variant="secondary">{section.type === 'category' ? 'Categoría' : 'Página'}</Badge>

                          {/* El slug se muestra pero no se edita: es lo que referencian
                              los productos. Cambiarlo los desasociaría a todos. */}
                          <code className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">{section.slug}</code>

                          {section.type === 'category' && (
                            <span className={cn('text-xs', isEmpty ? 'font-medium text-[#b45309]' : 'text-muted-foreground')}>
                              {isEmpty ? 'sin productos · no se muestra' : `${count} producto${count === 1 ? '' : 's'}`}
                            </span>
                          )}

                          <div className="ml-auto flex items-center gap-1">
                            {section.type === 'page' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setExpanded(isOpen ? null : section.slug)}
                              >
                                {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                                <span className="ml-1 text-xs">Contenido</span>
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              title={section.isActive ? 'Ocultar de la tienda' : 'Mostrar en la tienda'}
                              onClick={() => update(index, { isActive: !section.isActive })}
                            >
                              {section.isActive ? <Eye size={15} /> : <EyeOff size={15} />}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => remove(index)}>
                              <Trash2 size={15} className="text-destructive" />
                            </Button>
                          </div>
                        </div>

                        {section.type === 'page' && isOpen && (
                          <div className="flex flex-col gap-3 border-t border-border p-4">
                            {(section.content?.blocks ?? []).map((block, bi) => (
                              <div key={bi} className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between">
                                  <Label className="text-xs">{BLOCK_LABEL[block.type]}</Label>
                                  <button
                                    className="cursor-pointer text-xs text-muted-foreground hover:text-destructive"
                                    onClick={() =>
                                      update(index, {
                                        content: {
                                          blocks: (section.content?.blocks ?? []).filter((_, i) => i !== bi),
                                        },
                                      })
                                    }
                                  >
                                    Quitar
                                  </button>
                                </div>
                                <textarea
                                  value={block.value}
                                  rows={block.type === 'text' ? 3 : 1}
                                  onChange={(e) =>
                                    update(index, {
                                      content: {
                                        blocks: (section.content?.blocks ?? []).map((b, i) =>
                                          i === bi ? { ...b, value: e.target.value } : b
                                        ),
                                      },
                                    })
                                  }
                                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                />
                              </div>
                            ))}

                            <div className="flex gap-2">
                              {(['heading', 'text', 'image'] as const).map((t) => (
                                <Button
                                  key={t}
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    update(index, {
                                      content: {
                                        blocks: [...(section.content?.blocks ?? []), { type: t, value: '' }],
                                      },
                                    })
                                  }
                                >
                                  <Plus size={13} className="mr-1" /> {BLOCK_LABEL[t]}
                                </Button>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Texto plano, sin formato. Se renderiza tal cual en la tienda.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </Draggable>
                )
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {dirty && (
        <p className="text-xs text-muted-foreground">
          Hay cambios sin guardar. Nada de esto se ve en la tienda hasta que toques Guardar.
        </p>
      )}
    </div>
  )
}
