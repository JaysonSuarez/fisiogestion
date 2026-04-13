import { supabase } from './supabase';

const OFFLINE_QUEUE_KEY = 'fisio_offline_queue';
const CACHE_PREFIX = 'fisio_cache_';

export interface PendingAction {
  id: string;
  table: string;
  action: 'insert' | 'update' | 'delete';
  payload: any;
  timestamp: number;
}

export const OfflineSync = {
  // Guardar datos en caché local (Lectura offline)
  saveToCache: (key: string, data: any) => {
    try {
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.error('Error saving to cache', e);
    }
  },

  // Recuperar datos de la caché local
  getFromCache: (key: string) => {
    const cached = localStorage.getItem(CACHE_PREFIX + key);
    if (!cached) return null;
    return JSON.parse(cached).data;
  },

  // Añadir una acción a la cola de sincronización (Escritura offline)
  queueAction: (table: string, action: 'insert' | 'update' | 'delete', payload: any) => {
    const queue = OfflineSync.getQueue();
    const newAction: PendingAction = {
      id: Math.random().toString(36).substr(2, 9),
      table,
      action,
      payload,
      timestamp: Date.now()
    };
    queue.push(newAction);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    
    // Intentar procesar inmediatamente si hay internet
    if (navigator.onLine) {
      OfflineSync.processQueue();
    }
  },

  getQueue: (): PendingAction[] => {
    const queue = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return queue ? JSON.parse(queue) : [];
  },

  // Procesar la cola de acciones pendientes
  processQueue: async () => {
    if (!navigator.onLine) return;
    
    const queue = OfflineSync.getQueue();
    if (queue.length === 0) return;

    console.log(`Sincronizando ${queue.length} cambios pendientes...`);

    const remainingActions: PendingAction[] = [];

    for (const item of queue) {
      try {
        let error;
        if (item.action === 'insert') {
          ({ error } = await supabase.from(item.table).insert(item.payload));
        } else if (item.action === 'update') {
          ({ error } = await supabase.from(item.table).update(item.payload).eq('id', item.payload.id));
        } else if (item.action === 'delete') {
          ({ error } = await supabase.from(item.table).delete().eq('id', item.payload.id));
        }

        if (error) throw error;
      } catch (e) {
        console.error(`Error sincronizando tabla ${item.table}:`, e);
        remainingActions.push(item); // Reintentar después
      }
    }

    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remainingActions));
    if (remainingActions.length === 0) {
      console.log('Sincronización completada exitosamente.');
    }
  }
};

// Escuchar cambios de conexión
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => OfflineSync.processQueue());
}
