import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import type { Product, StoreConfig } from 'shared'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Edit, Plus, Trash2, SwitchCamera } from 'lucide-react'
import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export default function Catalogo() {
  const queryClient = useQueryClient()
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Las categorías salen del navbar: son la misma cosa. Antes esto era un input
  // libre, así que cada typo creaba una categoría fantasma que no existía en
  // ningún menú y dejaba el producto invisible en la tienda.
  const { data: config } = useQuery<StoreConfig>({
    queryKey: ['store-config'],
    queryFn: () => api.get('/config').then(res => res.data),
  })

  const categories = (config?.navSections ?? []).filter(s => s.type === 'category')
  const labelFor = (slug: string) => categories.find(c => c.slug === slug)?.label ?? slug

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () => api.get('/products?all=true').then(res => res.data)
  })

  const saveMutation = useMutation({
    mutationFn: (prod: Partial<Product>) => {
      if (prod._id) {
        return api.put(`/products/${prod._id}`, prod)
      }
      return api.post('/products', prod)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      setIsDialogOpen(false)
      setEditingProduct(null)
    }
  })

  const toggleStatusMutation = useMutation({
    mutationFn: (prod: Product) => api.put(`/products/${prod._id}`, { isActive: !prod.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] })
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] })
  })

  const handleEdit = (prod: Product) => {
    setEditingProduct(prod)
    setIsDialogOpen(true)
  }

  const handleNew = () => {
    setEditingProduct({ name: '', price: 0, categorySlug: categories[0]?.slug ?? '', stock: 100, isActive: true })
    setIsDialogOpen(true)
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingProduct) saveMutation.mutate(editingProduct)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('image', file);
    
    try {
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.url) {
        setEditingProduct(prev => prev ? { ...prev, images: [res.data.url] } : null);
      }
    } catch (err) {
      alert('Error subiendo imagen');
    }
  };

  if (isLoading) return <div>Cargando catálogo...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Catálogo</h1>
          <p className="text-muted-foreground">Administra tus productos, precios y categorías.</p>
        </div>
        <Button onClick={handleNew}><Plus size={16} className="mr-2"/> Nuevo Producto</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products?.map(prod => (
          <Card key={prod._id} className={!prod.isActive ? 'opacity-60' : ''}>
            {prod.images && prod.images.length > 0 ? (
              <div className="w-full h-48 bg-muted rounded-t-xl overflow-hidden">
                <img src={prod.images[0]} alt={prod.name} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-full h-48 bg-muted/50 rounded-t-xl flex items-center justify-center text-muted-foreground text-sm">
                Sin imagen
              </div>
            )}
            
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{prod.name}</CardTitle>
                <Badge variant={prod.isActive ? 'default' : 'secondary'}>
                  {prod.isActive ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{labelFor(prod.categorySlug)}</p>
            </CardHeader>
            <CardContent>
              <p className="font-bold text-xl mb-4">${prod.price}</p>
              
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(prod)}>
                  <Edit size={14} className="mr-2" /> Editar
                </Button>
                <Button variant="outline" size="sm" onClick={() => toggleStatusMutation.mutate(prod)}>
                  <SwitchCamera size={14} />
                </Button>
                <Button variant="destructive" size="sm" onClick={() => {
                  if(window.confirm('¿Seguro de eliminar este producto?')) deleteMutation.mutate(prod._id)
                }}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogHeader>
          <DialogTitle>{editingProduct?._id ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle>
        </DialogHeader>
        {editingProduct && (
          <form onSubmit={handleSave} className="space-y-4">
            
            <div className="space-y-2">
              <Label>Imagen del Producto</Label>
              <div className="flex items-center gap-4">
                {editingProduct.images && editingProduct.images.length > 0 ? (
                  <img src={editingProduct.images[0]} alt="Preview" className="w-16 h-16 object-cover rounded-md border" />
                ) : (
                  <div className="w-16 h-16 bg-muted border rounded-md flex items-center justify-center text-xs text-muted-foreground text-center p-1">
                    Sin img
                  </div>
                )}
                <Input type="file" accept="image/*" onChange={handleImageUpload} className="flex-1" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} required />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input value={editingProduct.description || ''} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Precio</Label>
                <Input type="number" value={editingProduct.price} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} required />
              </div>
              <div className="space-y-2">
                <Label>Categoría</Label>
                <select
                  value={editingProduct.categorySlug}
                  onChange={e => setEditingProduct({...editingProduct, categorySlug: e.target.value})}
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {categories.length === 0 && <option value="">Creá una categoría en Navegación</option>}
                  {categories.map(c => (
                    <option key={c.slug} value={c.slug}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Guardando...' : 'Guardar Producto'}
            </Button>
          </form>
        )}
      </Dialog>
    </div>
  )
}
