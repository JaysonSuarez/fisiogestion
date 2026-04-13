'use client';

import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Share, PlusSquare } from 'lucide-react';
import { subscribeUser } from '@/lib/push-subscription';

export default function PushManager() {
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showIOSBanner, setShowIOSBanner] = useState(false);

  useEffect(() => {
    // Detectar modo standalone
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    setIsStandalone(!!standalone);

    // Detectar iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    // Verificar permiso inicial
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }

    // Verificar si ya tiene una suscripción activa en el navegador
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          setIsSubscribed(!!sub);
        });
      });
    }

    // Lógica para mostrar el banner de iOS
    if (ios && !standalone) {
      setShowIOSBanner(true);
    }
  }, []);

  const handleSubscribe = async () => {
    const success = await subscribeUser();
    if (success) {
      setIsSubscribed(true);
      setPermission('granted');
    }
  };

  // Si es iOS y no está instalado, mostrar instrucciones
  if (showIOSBanner) {
    return (
      <div className="fixed bottom-4 left-4 right-4 bg-white p-4 rounded-xl shadow-2xl border border-pink-100 z-50 animate-bounce-subtle">
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

  // Si no está instalado (en otros dispositivos), tal vez no mostramos el botón o sí. 
  // Pero el paso 7 dice: "Solo muestra el botón de 'Activar Notificaciones' una vez que la app haya sido instalada."
  if (!isStandalone) return null;

  return (
    <div className="fixed bottom-24 right-6 z-40">
      <button
        onClick={handleSubscribe}
        disabled={permission === 'granted' && isSubscribed}
        className={`p-4 rounded-full shadow-lg transition-all active:scale-95 ${
          isSubscribed && permission === 'granted'
            ? 'bg-green-500 text-white opacity-80 cursor-default'
            : 'bg-pink-500 text-white hover:bg-pink-600'
        }`}
      >
        {isSubscribed && permission === 'granted' ? (
          <Bell className="w-6 h-6" />
        ) : (
          <BellOff className="w-6 h-6 animate-pulse" />
        )}
      </button>
      
      {!isSubscribed && (
        <div className="absolute -top-12 right-0 bg-white px-3 py-1 rounded-lg shadow-md border border-pink-50 whitespace-nowrap text-xs text-pink-600 font-medium">
          Activar notificaciones
        </div>
      )}
    </div>
  );
}
