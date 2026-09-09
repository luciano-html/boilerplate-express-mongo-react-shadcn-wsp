import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : '');

export const useLiveSockets = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [eventsLog, setEventsLog] = useState<{ time: string; event: string; data: any }[]>([]);

  useEffect(() => {
    const socketInstance = io(API_URL, {
      withCredentials: true,
    });

    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      setEventsLog(prev => [{ time: new Date().toLocaleTimeString(), event: 'connected', data: socketInstance.id }, ...prev]);
    });

    socketInstance.on('disconnect', () => {
      setEventsLog(prev => [{ time: new Date().toLocaleTimeString(), event: 'disconnected', data: null }, ...prev]);
    });

    // seat:seed y seat:updated eran de stockOcenter (la app de stock de sillas).
    // Este proyecto no los emite nunca.
    socketInstance.on('order:updated', (data) => {
      setEventsLog(prev => [{ time: new Date().toLocaleTimeString(), event: 'order:updated', data }, ...prev]);
    });

    socketInstance.on('order:created', (data) => {
      setEventsLog(prev => [{ time: new Date().toLocaleTimeString(), event: 'order:created', data }, ...prev]);
    });

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const clearLogs = () => setEventsLog([]);

  return { socket, eventsLog, clearLogs };
};
