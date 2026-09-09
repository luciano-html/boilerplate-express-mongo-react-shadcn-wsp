import { StoreConfig } from '../models/StoreConfig';
import { Order } from '../models/Order';
import logger from '../utils/logger';

/**
 * Ventana de actividad. Un pedido que entro hace 4 horas y sigue en 'pending' no
 * esta en la cola de la cocina: esta olvidado. Contarlo envenena el ETA de todos
 * los pedidos siguientes, y el error crece solo con el correr de la noche.
 */
const ACTIVE_WINDOW_MINUTES = Number(process.env.ETA_ACTIVE_WINDOW_MINUTES ?? 180);

/** Cuantos pedidos cerrados se miran para calcular las medianas. */
const SAMPLE_SIZE = Number(process.env.ETA_SAMPLE_SIZE ?? 50);

/** Debajo de esto no hay historia suficiente y se usan las constantes de config. */
const MIN_SAMPLES = Number(process.env.ETA_MIN_SAMPLES ?? 15);

export interface EtaBreakdown {
  /** Minutos totales que se le prometen al cliente. */
  total: number;
  kitchen: number;
  courier: number;
  /** De donde salieron los tiempos base: medidos de la historia o de config. */
  source: 'measured' | 'config';
  /** false cuando el local no mantiene los estados y se cayo al modo degradado. */
  statesMaintained: boolean;
}

/** Mediana, no promedio: un pedido catastrofico no tiene que correr la aguja. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function minutesBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 60000;
}

type HistoryDoc = { statusHistory?: { status: string; at: Date }[]; createdAt?: Date };

async function recentClosedOrders(): Promise<HistoryDoc[]> {
  return Order.find({ status: 'closed' })
    .sort({ createdAt: -1 })
    .limit(SAMPLE_SIZE)
    .select('statusHistory createdAt')
    .lean<HistoryDoc[]>();
}

function firstAt(doc: HistoryDoc, status: string): Date | null {
  const event = (doc.statusHistory ?? []).find((e) => e.status === status);
  return event ? new Date(event.at) : null;
}

/**
 * Duracion mediana entre dos estados en los ultimos pedidos cerrados.
 * Devuelve null si no hay muestras suficientes.
 */
function medianBetween(docs: HistoryDoc[], from: string, to: string): number | null {
  const durations: number[] = [];

  for (const doc of docs) {
    const start = firstAt(doc, from) ?? (from === 'pending' && doc.createdAt ? new Date(doc.createdAt) : null);
    const end = firstAt(doc, to);
    if (!start || !end) continue;

    const minutes = minutesBetween(start, end);
    // Descarta absurdos: negativos por relojes desfasados, y pedidos que quedaron
    // abiertos toda la noche y se cerraron al dia siguiente.
    if (minutes <= 0 || minutes > 240) continue;
    durations.push(minutes);
  }

  return durations.length >= MIN_SAMPLES ? median(durations) : null;
}

/**
 * Los estados solo sirven como senal si alguien efectivamente los mueve. Si la
 * mayoria de los pedidos cerrados nunca paso por 'cooking', el tablero no se esta
 * manteniendo y cualquier cuenta basada en estados es ficcion.
 */
function statesAreMaintained(docs: HistoryDoc[]): boolean {
  if (docs.length < MIN_SAMPLES) return true; // sin evidencia, se asume que si
  const passed = docs.filter((d) => (d.statusHistory ?? []).some((e) => e.status === 'cooking')).length;
  return passed / docs.length >= 0.5;
}

export const calculateETA = async (isDelivery: boolean): Promise<EtaBreakdown> => {
  const config = await StoreConfig.findOne();

  const basePrepTime = config?.basePrepTime ?? 15;
  const delayPerPendingOrder = config?.delayPerPendingOrder ?? 8;
  const deliveryTimePerOrderInQueue = config?.deliveryTimePerOrderInQueue ?? 3;
  const baseCourierTravelTime = config?.baseCourierTravelTime ?? 10;

  const closed = await recentClosedOrders();
  const maintained = statesAreMaintained(closed);

  // Los tiempos base salen de la historia real cuando la hay. Las constantes de
  // config son la semilla para el dia uno, no la verdad permanente: nadie
  // recalibra "basePrepTime" cuando entra un cocinero nuevo, pero la mediana si.
  const measuredPrep = medianBetween(closed, 'pending', 'ready');
  const measuredCourier = medianBetween(closed, 'on_the_way', 'closed');

  const prepBase = measuredPrep ?? basePrepTime;
  const courierBase = measuredCourier ?? baseCourierTravelTime;
  const source: EtaBreakdown['source'] = measuredPrep !== null ? 'measured' : 'config';

  const since = new Date(Date.now() - ACTIVE_WINDOW_MINUTES * 60_000);

  let kitchenQueue: number;
  let courierQueue: number;

  if (maintained) {
    kitchenQueue = await Order.countDocuments({
      status: { $in: ['pending', 'cooking'] },
      createdAt: { $gte: since },
    });
    courierQueue = isDelivery
      ? await Order.countDocuments({
          status: 'ready',
          orderType: 'delivery',
          createdAt: { $gte: since },
        })
      : 0;
  } else {
    // MODO DEGRADADO. Nadie mueve las tarjetas, asi que se usa la unica senal que
    // no depende de que alguien se acuerde: createdAt. Se cuentan los pedidos
    // abiertos que entraron dentro de una tanda de cocina. Es menos preciso, pero
    // es honesto, mientras que confiar en estados muertos no lo es.
    const oneBatchAgo = new Date(Date.now() - prepBase * 60_000);
    kitchenQueue = await Order.countDocuments({
      status: { $nin: ['closed', 'cancelled'] },
      createdAt: { $gte: oneBatchAgo },
    });
    courierQueue = 0;
    logger.warn('ETA en modo degradado: los estados de los pedidos no se estan manteniendo');
  }

  const kitchen = Math.round(prepBase + kitchenQueue * delayPerPendingOrder);
  const courier = isDelivery
    ? Math.round(courierBase + courierQueue * deliveryTimePerOrderInQueue)
    : 0;

  return {
    total: kitchen + courier,
    kitchen,
    courier,
    source,
    statesMaintained: maintained,
  };
};
