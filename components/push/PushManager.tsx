'use client';

import React, { useState, useEffect } from 'react';
import { Bell, Share, PlusSquare } from 'lucide-react';
import { subscribeUser } from '@/lib/push-subscription';

interface PushManagerProps {
  mode?: 'floating' | 'inline';
}

export default function PushManager({ mode = 'floating' }: PushManagerProps) {
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showIOSBanner, setShowIOSBanner] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    setIsStandalone(!!standalone);

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    // Leer el estado actual del permiso del navegador
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }

    // Verificar si ya existe una suscripción activa en el PushManager
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          if (sub) setIsSubscribed(true);
        });
      });
    }

    // Mostrar banner de instalación solo si está en iOS NO instalado
    if (ios && !standalone) {
      setShowIOSBanner(true);
    }
  }, []);

  const handleSubscribe = async () => {
    // Si ya tiene permiso, no hacer nada
    if (permission === 'granted') return;

    try {
      const success = await subscribeUser();
      if (success) {
        setIsSubscribed(true);
        setPermission('granted');
      }
    } catch (e) {
      console.error('handleSubscribe error:', e);
    }
  };

  // Banner de instalación para iOS no instalado
  if (showIOSBanner) {
    return (
      <div className="fixed bottom-4 left-4 right-4 bg-white p-4 rounded-xl shadow-2xl border border-pink-100 z-50">
        <div className="flex items-start gap-3">
          <div className="bg-pink-100 p-2 rounded-lg">
            <PlusSquare className="w-6 h-6 text-pink-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">
              Instala la App para recibir notificaciones
            </p>
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
              Pulsa <Share className="w-3 h-3" /> y luego "Añadir a la pantalla de inicio"
            </p>
          </div>
          <button
            onClick={() => setShowIOSBanner(false)}
            className="text-gray-400 hover:text-gray-600 ml-auto"
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  // En iOS, la campana solo se muestra si la app está instalada (standalone)
  if (isIOS && !isStandalone) return null;

  // Verde si el permiso ya fue aceptado — sin esperar confirmación de Supabase
  const isActive = permission === 'granted';

  if (mode === 'inline') {
    return (
      <div className="flex items-center">
        <button
          onClick={handleSubscribe}
          className={`shrink-0 p-3 rounded-2xl shadow-xl border transition-all duration-300 active:scale-95 relative ${
            isActive
              ? 'bg-emerald-500 text-white border-emerald-600 shadow-emerald-500/30 cursor-default'
              : 'bg-white text-rose-500 border-rose-100 hover:scale-110 animate-bounce'
          }`}
          title={isActive ? 'Notificaciones Activas ✓' : 'Activar Notificaciones'}
        >
          <Bell className="w-6 h-6" />
          {!isActive && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-600 rounded-full border-2 border-white animate-ping" />
          )}
        </button>
      </div>
    );
  }

  // Modo flotante
  if (!isStandalone) return null;

  return (
    <div className="fixed bottom-24 right-6 z-40">
      <button
        onClick={handleSubscribe}
        className={`p-4 rounded-full shadow-lg transition-all active:scale-95 ${
          isActive
            ? 'bg-emerald-500 text-white cursor-default'
            : 'bg-pink-500 text-white hover:bg-pink-600'
        }`}
      >
        <Bell className="w-6 h-6" />
      </button>
    </div>
  );
}
