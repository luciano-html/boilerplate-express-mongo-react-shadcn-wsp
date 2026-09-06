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
  category: string;
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
  deliveryNeighborhood?: string;
  paymentMethod: 'cash' | 'transfer';
  discounts: number;
  surcharges: number;
  status: 'pending_payment' | 'pending' | 'in_preparation' | 'in_expedition' | 'dispatched' | 'delivered' | 'cancelled';
  estimatedTime?: number;
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
  socials?: {
    instagram?: string;
    facebook?: string;
    twitter?: string;
  };
  businessHours?: string;
  createdAt: Date;
  updatedAt: Date;
}
