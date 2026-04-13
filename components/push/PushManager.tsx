'use client';

import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Share, PlusSquare } from 'lucide-react';
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

    if ('Notification' in window) {
      setPermission(Notification.permission);
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          setIsSubscribed(!!sub);
        });
      });
    }

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

  // En iOS, el botón solo se muestra si está instalado (standalone)
  if (isIOS && !isStandalone) return null;

  if (mode === 'inline') {
    return (
      <div className="flex items-center">
        <button
          onClick={handleSubscribe}
          disabled={permission === 'granted' && isSubscribed}
          className={`shrink-0 p-3 rounded-2xl shadow-xl border transition-all active:scale-95 group relative ${
            permission === 'granted'
              ? 'bg-emerald-50 text-emerald-600 border-emerald-100 cursor-default'
              : 'bg-white text-rose-500 border-rose-100 hover:scale-110 animate-bounce'
          }`}
          title={permission === 'granted' ? "Notificaciones Activas" : "Activar Notificaciones"}
        >
          {permission === 'granted' ? (
            <Bell className="w-6 h-6" />
          ) : (
            <>
              <Bell className="w-6 h-6" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-600 rounded-full border-2 border-white animate-ping"></span>
            </>
          )}
        </button>
      </div>
    );
  }

  // Modo flotante original (backup)
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
    </div>
  );
}
