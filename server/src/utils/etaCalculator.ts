import { StoreConfig } from '../models/StoreConfig';
import { Order } from '../models/Order';

export const calculateETA = async (isDelivery: boolean): Promise<number> => {
  const config = await StoreConfig.findOne();
  if (!config) return 15; // fallback

  const basePrepTime = config.basePrepTime || 15;
  const delayPerPendingOrder = config.delayPerPendingOrder || 8;
  const deliveryTimePerOrderInQueue = config.deliveryTimePerOrderInQueue || 3;
  const baseCourierTravelTime = config.baseCourierTravelTime || 10;

  // Active orders in kitchen (pending payment, pending, or in preparation)
  const activeOrdersInKitchen = await Order.countDocuments({
    status: { $in: ['pending_payment', 'pending', 'in_preparation'] }
  });

  const etaCocina = basePrepTime + (activeOrdersInKitchen * delayPerPendingOrder);

  if (!isDelivery) {
    return etaCocina;
  }

  // Active orders waiting for dispatch
  const activeOrdersInExpedition = await Order.countDocuments({
    status: 'in_expedition',
    orderType: 'delivery'
  });

  const etaEnvio = baseCourierTravelTime + (activeOrdersInExpedition * deliveryTimePerOrderInQueue);

  return etaCocina + etaEnvio;
};
