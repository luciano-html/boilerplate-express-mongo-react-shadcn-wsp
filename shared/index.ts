export interface ProductOption {
  name: string;
  additionalPrice: number;
}

export interface ProductOptionGroup {
  name: string;
  minSelect: number;
  maxSelect: number;
  options: ProductOption[];
}

export interface Product {
  _id?: string;
  id?: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  /** Slug de la NavSection a la que pertenece. NO es el label visible. */
  categorySlug: string;
  isActive: boolean;
  images?: string[];
  optionGroups?: ProductOptionGroup[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SelectedOption {
  groupName: string;
  optionName: string;
  additionalPrice: number;
}

export interface OrderItem {
  productId: string;
  /**
   * Snapshot del nombre al momento del pedido. El producto se puede renombrar o
   * borrar; el historial de lo que se vendio esa noche no tiene que cambiar con
   * el. Ademas evita un populate en cada refresco del tablero.
   */
  name?: string;
  quantity: number;
  unitPrice: number;
  selectedOptions?: SelectedOption[];
  notes?: string;
}

export interface Order {
  _id?: string;
  id?: string;
  items: OrderItem[];
  total: number;
  customerName: string;
  customerPhone: string;
  orderType: 'delivery' | 'takeaway';
  deliveryCity?: 'Santo Tomé' | 'Santa Fe';
  /**
   * ZONA de reparto: tiene que coincidir con un `neighborhood` de
   * StoreConfig.deliveryZones, porque de ahi sale el costo de envio y por aca
   * se agrupan las hojas de ruta. No es texto libre.
   */
  deliveryNeighborhood?: string;
  /**
   * Calle y numero. Texto libre, lo que el cliente escribe.
   * Es a donde va el cadete; el barrio solo dice cuanto se cobra.
   */
  deliveryAddress?: string;
  paymentMethod: 'cash' | 'transfer';
  discounts: number;
  surcharges: number;
  /** Numero corto y legible para cantar el pedido en el local. */
  orderNumber: number;
  status: OrderStatus;
  /**
   * Eje INDEPENDIENTE del avance fisico: responde "hay algo que verificar
   * antes de cocinar". Efectivo nace 'confirmed' porque no hay nada que
   * chequear; transferencia nace 'pending' hasta que alguien mira el
   * comprobante. No dice si la plata entro: eso pasa al entregar.
   */
  paymentStatus: PaymentStatus;
  /** Traza de cada cambio de estado. Es lo que alimenta el ETA medido. */
  statusHistory: OrderStatusEvent[];
  estimatedTime?: number;
  /**
   * Codigo corto que el cliente manda por WhatsApp para vincular el pedido.
   * Sirve para una sola cosa importante: quedarnos con el JID REAL desde el que
   * escribio, en vez del telefono que tipeo en un formulario.
   */
  handshakeCode?: string;
  /** JID verificado del cliente, una vez que mando el codigo. */
  customerJid?: string;
  /** Cuando llego el handshake. Sin esto el pedido esta "sin confirmar". */
  confirmedAt?: Date;
  /** Ultimo aviso por WhatsApp que fallo. Se muestra en el tablero. */
  lastNotificationError?: { at: Date; message: string };
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  _id?: string;
  id?: string;
  email: string;
  role: 'admin' | 'staff';
  createdAt: Date;
  updatedAt: Date;
}

export interface DeliveryZone {
  _id?: string;
  id?: string;
  city: 'Santo Tomé' | 'Santa Fe';
  neighborhood: string;
  cost: number;
  isActive: boolean;
}

export interface StoreConfig {
  _id?: string;
  id?: string;
  name: string;
  whatsapp: string;
  currency: string;
  logoUrl?: string;
  deliveryZones?: DeliveryZone[];
  basePrepTime: number;
  delayPerPendingOrder: number;
  deliveryTimePerOrderInQueue: number;
  baseCourierTravelTime: number;
  isBotActive: boolean;
  navSections?: NavSection[];
  socials?: {
    instagram?: string;
    facebook?: string;
    twitter?: string;
  };
  businessHours?: string;
  /** Alias o CBU al que el cliente transfiere. Se muestra en la tienda y lo manda el bot. */
  transferAlias?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type NavSectionType = 'category' | 'page';

export type NavContentBlockType = 'heading' | 'text' | 'image';

export interface NavContentBlock {
  type: NavContentBlockType;
  value: string;
}

/**
 * Item del navbar del storefront, editable por el duenio desde el admin.
 *
 * `slug` es el identificador ESTABLE: no cambia cuando se renombra el `label`.
 * `Product.categorySlug` guarda este slug, nunca el label. Por eso renombrar
 * "Hamburguesas" -> "Burgers" no desasocia ningun producto.
 *
 * - type 'category': renderiza la grilla de productos filtrada por este slug.
 * - type 'page': contenido libre (Nosotros, Como pedir, Promos).
 */
export interface NavSection {
  slug: string;
  label: string;
  type: NavSectionType;
  order: number;
  isActive: boolean;
  content?: { blocks: NavContentBlock[] };
}

/**
 * Estados del pedido. Un solo eje: donde esta fisicamente.
 * El pago vive en `paymentStatus` y la confirmacion del cliente en `confirmedAt`.
 *
 *   pending     entro, todavia no arranco
 *   cooking     en la parrilla
 *   ready       salio de cocina: espera al cadete, o que lo retiren
 *   on_the_way  el cadete salio (solo delivery; takeaway va de ready a closed)
 *   closed      entregado o retirado
 *   cancelled   terminal
 */
export type OrderStatus =
  | 'pending'
  | 'cooking'
  | 'ready'
  | 'on_the_way'
  | 'closed'
  | 'cancelled';

export type PaymentStatus = 'pending' | 'confirmed';

export interface OrderStatusEvent {
  status: OrderStatus;
  at: Date;
}

/** Estados que ocupan una columna del tablero. El resto sale del tablero. */
export const ACTIVE_ORDER_STATUSES: OrderStatus[] = ['pending', 'cooking', 'ready', 'on_the_way'];

/**
 * Convierte un label editable en un slug estable (kebab-case, sin acentos).
 * Se usa UNA sola vez, al crear la NavSection: despues el slug no se toca nunca,
 * porque es lo que referencia Product.categorySlug.
 */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
