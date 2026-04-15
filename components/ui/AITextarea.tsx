'use client'

import { useState } from 'react'
import { Sparkles, Loader2, Check } from 'lucide-react'

interface AITextareaProps {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  className?: string
}

export function AITextarea({
  label,
  name,
  value,
  onChange,
  placeholder,
  required = false,
  className = ''
}: AITextareaProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRefine = async () => {
    if (!value.trim()) return

    setIsGenerating(true)
    setError(null)
    
    try {
      const res = await fetch('/api/ai/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: value, fieldName: label })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al refinar el texto')
      }

      if (!res.body) throw new Error('No se pudo establecer conexión con la IA')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let resultText = ''

      // Limpiar el campo y empezar a escribir (opcional: podrías agregarlo al final)
      onChange('')

      while (true) {
        const { done, value: chunk } = await reader.read()
        if (done) break
        
        const text = decoder.decode(chunk, { stream: true })
        resultText += text
        onChange(resultText)
      }

      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 2000)
    } catch (err: any) {
      console.error(err)
      setError(err.message)
      setTimeout(() => setError(null), 3000)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className={`space-y-1.5 relative ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-[9px] font-black text-rose-300 uppercase tracking-widest">
          {label} {required && '*'}
        </label>
        {error ? (
          <span className="text-[9px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">{error}</span>
        ) : null}
      </div>
      
      <div className="relative group">
        <textarea
          name={name}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-rose-50/50 border border-rose-100 rounded-2xl px-4 py-3 text-sm font-bold text-rose-950 outline-none focus:border-rose-300 transition-all min-h-[90px] resize-none pr-12"
          placeholder={placeholder}
          required={required}
        />
        
        {value.trim().length > 3 && (
          <button
            type="button"
            onClick={handleRefine}
            disabled={isGenerating}
            title="Mejorar redacción con IA"
            className="absolute bottom-3 right-3 p-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2 size={16} className="animate-spin" />
            ) : showSuccess ? (
              <Check size={16} className="text-emerald-300" />
            ) : (
              <Sparkles size={16} />
            )}
          </button>
        )}
      </div>
    </div>
  )
}
