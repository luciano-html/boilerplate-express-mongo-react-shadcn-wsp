import { Product } from '../models/Product';
import { StoreConfig } from '../models/StoreConfig';

export const validateOrderData = async (orderData: any) => {
  let computedTotal = 0;
  
  if (!orderData.items || orderData.items.length === 0) {
    return { isValid: false, error: 'La orden debe contener al menos un item.' };
  }

  for (const item of orderData.items) {
    const product = await Product.findById(item.productId);
    if (!product) {
      return { isValid: false, error: `Producto no encontrado (ID: ${item.productId})` };
    }
    if (!product.isActive) {
      return { isValid: false, error: `El producto ${product.name} no está activo o no tiene stock.` };
    }

    let itemPrice = product.price;

    // Validate options
    if (item.selectedOptions && item.selectedOptions.length > 0) {
      // Group selected options by groupName
      const groupedSelections: Record<string, any[]> = {};
      for (const selOpt of item.selectedOptions) {
        if (!groupedSelections[selOpt.groupName]) groupedSelections[selOpt.groupName] = [];
        groupedSelections[selOpt.groupName].push(selOpt);
      }

      // optionGroups es opcional en el modelo: un producto sin grupos llega undefined.
      const optionGroups = product.optionGroups ?? [];

      for (const groupName of Object.keys(groupedSelections)) {
        const prodGroup = optionGroups.find((g: any) => g.name === groupName);
        if (!prodGroup) {
          return { isValid: false, error: `Grupo de opciones inválido: ${groupName}` };
        }

        const selectedCount = groupedSelections[groupName].length;
        if (selectedCount < prodGroup.minSelect) {
          return { isValid: false, error: `El grupo ${groupName} requiere al menos ${prodGroup.minSelect} selección(es).` };
        }
        if (selectedCount > prodGroup.maxSelect) {
          return { isValid: false, error: `El grupo ${groupName} permite máximo ${prodGroup.maxSelect} selección(es).` };
        }

        for (const selOpt of groupedSelections[groupName]) {
          const prodOpt = prodGroup.options.find((o: any) => o.name === selOpt.optionName);
          if (!prodOpt) {
            return { isValid: false, error: `Opción inválida: ${selOpt.optionName} en el grupo ${groupName}` };
          }
          itemPrice += prodOpt.additionalPrice;
        }
      }
      
      // Also verify that required groups were provided
      for (const prodGroup of optionGroups) {
        if (prodGroup.minSelect > 0 && !groupedSelections[prodGroup.name]) {
          return { isValid: false, error: `Falta selección obligatoria para el grupo: ${prodGroup.name}` };
        }
      }
    } else {
      // No options selected, check if any group is required
      for (const prodGroup of product.optionGroups ?? []) {
        if (prodGroup.minSelect > 0) {
          return { isValid: false, error: `Falta selección obligatoria para el grupo: ${prodGroup.name}` };
        }
      }
    }

    computedTotal += itemPrice * item.quantity;
  }

  // Validate Delivery Cost
  if (orderData.orderType === 'delivery') {
    const storeConfig = await StoreConfig.findOne();
    if (storeConfig && storeConfig.deliveryZones) {
      const zone = storeConfig.deliveryZones.find(z => z.city === orderData.deliveryCity);
      if (!zone) {
        return { isValid: false, error: `Zona de envío inválida: ${orderData.deliveryCity}` };
      }
      if (!zone.isActive) {
        return { isValid: false, error: `La zona de envío ${orderData.deliveryCity} está deshabilitada temporalmente.` };
      }
      computedTotal += zone.cost;
    }
  }

  if (computedTotal !== orderData.total) {
    return { isValid: false, error: `Desajuste de precio. Total calculado: $${computedTotal}, Total recibido: $${orderData.total}.` };
  }

  return { isValid: true, computedTotal };
};
