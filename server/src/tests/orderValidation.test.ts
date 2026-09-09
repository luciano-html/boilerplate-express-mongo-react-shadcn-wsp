import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateOrderData } from '../utils/orderValidator';
import { Product } from '../models/Product';
import { StoreConfig } from '../models/StoreConfig';

// Mock mongoose models
vi.mock('../models/Product', () => ({
  Product: {
    findById: vi.fn(),
  },
}));

vi.mock('../models/StoreConfig', () => ({
  StoreConfig: {
    findOne: vi.fn(),
  },
}));

describe('Order Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockProduct = {
    _id: 'prod1',
    name: 'Hamburguesa Doble',
    price: 1000,
    isActive: true,
    optionGroups: [
      {
        name: 'Salsas',
        minSelect: 0,
        maxSelect: 2,
        options: [
          { name: 'Ketchup', additionalPrice: 0 },
          { name: 'Cheddar Extra', additionalPrice: 200 }
        ]
      },
      {
        name: 'Papas',
        minSelect: 1, // Required
        maxSelect: 1,
        options: [
          { name: 'Papas Fritas', additionalPrice: 500 }
        ]
      }
    ]
  };

  const mockStoreConfig = {
    deliveryZones: [
      { city: 'Centro', cost: 300, isActive: true },
      { city: 'Norte', cost: 500, isActive: false }
    ]
  };

  it('should validate a correct delivery order', async () => {
    vi.mocked(Product.findById).mockResolvedValue(mockProduct);
    vi.mocked(StoreConfig.findOne).mockResolvedValue(mockStoreConfig);

    const orderData = {
      orderType: 'delivery',
      deliveryCity: 'Centro',
      total: 1500, // 1000 (burger) + 0 (ketchup) + 500 (papas) + 0 (delivery cost wait it's 300! So total = 1800)
      items: [
        {
          productId: 'prod1',
          quantity: 1,
          selectedOptions: [
            { groupName: 'Salsas', optionName: 'Ketchup' },
            { groupName: 'Papas', optionName: 'Papas Fritas' }
          ]
        }
      ]
    };
    
    orderData.total = 1800; // 1000 base + 500 options + 300 delivery

    const result = await validateOrderData(orderData);
    expect(result.isValid).toBe(true);
    expect(result.computedTotal).toBe(1800);
  });

  it('should reject if a product is inactive', async () => {
    vi.mocked(Product.findById).mockResolvedValue({ ...mockProduct, isActive: false });
    
    const orderData = {
      orderType: 'takeaway',
      total: 1000,
      items: [{ productId: 'prod1', quantity: 1, selectedOptions: [] }]
    };

    const result = await validateOrderData(orderData);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('no está activo');
  });

  it('should reject if required options are missing', async () => {
    vi.mocked(Product.findById).mockResolvedValue(mockProduct);
    
    const orderData = {
      orderType: 'takeaway',
      total: 1000,
      items: [
        {
          productId: 'prod1',
          quantity: 1,
          selectedOptions: [
            { groupName: 'Salsas', optionName: 'Ketchup' }
            // Missing 'Papas' which has minSelect: 1
          ]
        }
      ]
    };

    const result = await validateOrderData(orderData);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Falta selección obligatoria para el grupo: Papas');
  });

  it('should reject if maxSelect is exceeded', async () => {
    vi.mocked(Product.findById).mockResolvedValue(mockProduct);
    
    const orderData = {
      orderType: 'takeaway',
      total: 1500,
      items: [
        {
          productId: 'prod1',
          quantity: 1,
          selectedOptions: [
            { groupName: 'Salsas', optionName: 'Ketchup' },
            { groupName: 'Salsas', optionName: 'Cheddar Extra' },
            { groupName: 'Salsas', optionName: 'Cheddar Extra' }, // Exceeded maxSelect: 2
            { groupName: 'Papas', optionName: 'Papas Fritas' }
          ]
        }
      ]
    };

    const result = await validateOrderData(orderData);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('permite máximo 2');
  });

  it('should reject if delivery zone is inactive', async () => {
    vi.mocked(Product.findById).mockResolvedValue(mockProduct);
    vi.mocked(StoreConfig.findOne).mockResolvedValue(mockStoreConfig);
    
    const orderData = {
      orderType: 'delivery',
      deliveryCity: 'Norte', // Inactive zone
      total: 2000,
      items: [
        {
          productId: 'prod1',
          quantity: 1,
          selectedOptions: [{ groupName: 'Papas', optionName: 'Papas Fritas' }]
        }
      ]
    };

    const result = await validateOrderData(orderData);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('deshabilitada');
  });

  it('should reject if total price is tampered', async () => {
    vi.mocked(Product.findById).mockResolvedValue(mockProduct);
    vi.mocked(StoreConfig.findOne).mockResolvedValue(mockStoreConfig);
    
    const orderData = {
      orderType: 'takeaway',
      total: 50, // User hacked total
      items: [
        {
          productId: 'prod1',
          quantity: 1,
          selectedOptions: [{ groupName: 'Papas', optionName: 'Papas Fritas' }] // Real cost 1500
        }
      ]
    };

    const result = await validateOrderData(orderData);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Desajuste de precio');
  });
});
