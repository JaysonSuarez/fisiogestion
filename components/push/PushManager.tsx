'use client';

import React, { useState, useEffect } from 'react';
import { Bell, Share, PlusSquare, X, CheckCircle2, Send, Info } from 'lucide-react';
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
  const [showModal, setShowModal] = useState(false);
  const [testLoading, setTestLoading] = useState(false);

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
          if (sub) setIsSubscribed(true);
        });
      });
    }

    if (ios && !standalone) {
      setShowIOSBanner(true);
    }
  }, []);

  const handleSubscribe = async () => {
    // Si ya está activo, abrir el modal de gestión
    if (permission === 'granted' && isSubscribed) {
      setShowModal(true);
      return;
    }

    try {
      const success = await subscribeUser();
      if (success) {
        setIsSubscribed(true);
        setPermission('granted');
        setShowModal(true); // Abrir modal al suscribirse con éxito para confirmar
      }
    } catch (e) {
      console.error('handleSubscribe error:', e);
    }
  };

  const sendTestNotification = async () => {
    setTestLoading(true);
    try {
      const response = await fetch('/api/push/test', { method: 'POST' });
      const result = await response.json();
      
      if (response.ok) {
        alert('¡Mensaje enviado! Debería llegar a tu iPhone en unos segundos.');
      } else {
        alert('Error: ' + (result.error || 'No se pudo enviar la prueba'));
      }
    } catch (error) {
      console.error('Error enviando prueba:', error);
      alert('Error de conexión al intentar enviar la prueba.');
    } finally {
      setTestLoading(false);
    }
  };

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

  if (isIOS && !isStandalone) return null;

  const isActive = permission === 'granted' && isSubscribed;

  return (
    <>
      <div className={mode === 'inline' ? "flex items-center" : "fixed bottom-24 right-6 z-40"}>
        <button
          onClick={handleSubscribe}
          className={`transition-all duration-300 active:scale-95 relative group ${
            mode === 'inline' 
              ? `shrink-0 p-3 rounded-2xl shadow-xl border ${
                  isActive 
                    ? 'bg-emerald-500 text-white border-emerald-600 shadow-emerald-500/30' 
                    : 'bg-white text-rose-500 border-rose-100 hover:scale-110 animate-bounce'
                }`
              : `p-4 rounded-full shadow-lg ${
                  isActive 
                    ? 'bg-emerald-500 text-white shadow-emerald-500/30' 
                    : 'bg-pink-500 text-white hover:bg-pink-600'
                }`
          }`}
          title={isActive ? 'Gestionar Notificaciones' : 'Activar Notificaciones'}
        >
          <Bell className={`w-6 h-6 ${isActive ? 'animate-none' : 'animate-pulse'}`} />
          {!isActive && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-600 rounded-full border-2 border-white animate-ping" />
          )}
        </button>
      </div>

      {/* Modal de Gestión de Notificaciones */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-rose-950/20 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[40px] shadow-2xl overflow-hidden border border-rose-100/50 animate-in zoom-in-95 duration-300">
            <div className="relative p-8 text-center pt-12">
              <button 
                onClick={() => setShowModal(false)}
                className="absolute top-6 right-6 p-2 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-all"
              >
                <X size={20} />
              </button>

              <div className="inline-flex p-4 bg-emerald-50 rounded-[24px] mb-6">
                <CheckCircle2 className="text-emerald-500" size={40} />
              </div>

              <h3 className="text-2xl font-black text-rose-950 italic mb-2">¡Todo Listo!</h3>
              <p className="text-rose-400 text-sm font-medium mb-8 leading-relaxed">
                Tus notificaciones están activas. Recibirás recordatorios de citas automáticamente.
              </p>

              <div className="space-y-3">
                <button
                  onClick={sendTestNotification}
                  disabled={testLoading}
                  className="w-full py-4 bg-rose-500 text-white rounded-3xl font-bold text-sm shadow-lg shadow-rose-200 hover:bg-rose-600 transition-all flex items-center justify-center gap-2 group active:scale-95 disabled:opacity-50"
                >
                  {testLoading ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <>Enviar Prueba <Send size={16} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" /></>
                  )}
                </button>
                
                <div className="flex items-center gap-2 p-4 bg-rose-50/50 rounded-2xl text-[10px] text-rose-400 text-left font-bold uppercase tracking-wider leading-tight">
                  <Info size={16} className="shrink-0" />
                  <span>Si no recibes el mensaje en 1 minuto, verifica los ajustes de tu iPhone.</span>
                </div>
              </div>
            </div>
            
            <div className="bg-rose-50/30 p-4 text-center border-t border-rose-50">
              <p className="text-[9px] font-black text-rose-300 uppercase tracking-[0.2em]">FisioGestión v2.0</p>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(10deg); }
          75% { transform: rotate(-10deg); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out infinite;
        }
      `}</style>
    </>
  );
}

function Loader2({ className, size }: { className?: string, size?: number }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
