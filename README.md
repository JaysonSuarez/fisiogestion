# FisioGestión

Panel de gestión para fisioterapeutas. Construido con **Next.js 14**, **TypeScript** y **Tailwind CSS**. Listo para conectar **Supabase** cuando lo necesites.

---

## Módulos incluidos

| Módulo | Descripción |
|---|---|
| Dashboard | Resumen del día: citas, deudores, diezmo pendiente |
| Pacientes | Lista, crear, ver detalle con sesiones y pagos |
| Agenda | Vista semanal sin cruce de horarios |
| Finanzas | Historial de pagos por sesión, método y estado |
| Sesiones | Registro clínico con nota de evolución |
| Diezmo | Cálculo 10% mensual, marcar como entregado |

---

## Instalación y uso

```bash
# 1. Entra a la carpeta
cd fisiogestion

# 2. Instala dependencias
npm install

# 3. Corre en desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## Conectar Supabase

### Paso 1 — Crear el archivo de entorno
```bash
cp .env.example .env
```

Edita `.env` con tus credenciales de Supabase:
```
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
```

### Paso 2 — Crear las tablas
En el **Editor SQL** de tu proyecto Supabase, copia y ejecuta el contenido de `supabase-schema.sql`.

### Paso 3 — Reemplazar los mocks
Cada página actualmente lee de `lib/mock-data.ts`. Cuando tengas Supabase configurado, reemplaza las llamadas a los mocks por consultas reales. Ejemplo:

```ts
// Antes (mock)
import { PACIENTES } from '@/lib/mock-data'
const pacientes = PACIENTES

// Después (Supabase)
import { supabase } from '@/lib/supabase'
const { data: pacientes } = await supabase.from('pacientes').select('*')
```

El cliente de Supabase ya está configurado en `lib/supabase.ts`.

---

## Estructura del proyecto

```
fisiogestion/
├── app/
│   ├── layout.tsx          # Layout raíz con sidebar
│   ├── page.tsx            # Dashboard
│   ├── pacientes/
│   │   ├── page.tsx        # Lista de pacientes
│   │   ├── nuevo/page.tsx  # Formulario nuevo paciente
│   │   └── [id]/page.tsx   # Detalle del paciente
│   ├── agenda/page.tsx     # Agenda semanal
│   ├── finanzas/page.tsx   # Historial financiero
│   ├── sesiones/
│   │   ├── page.tsx        # Lista de sesiones
│   │   └── nueva/page.tsx  # Registrar sesión
│   └── diezmo/page.tsx     # Gestión del diezmo
├── components/
│   └── layout/Sidebar.tsx  # Navegación lateral
├── lib/
│   ├── mock-data.ts        # Datos de prueba (reemplazar con Supabase)
│   └── supabase.ts         # Cliente Supabase
├── types/index.ts          # Tipos TypeScript globales
└── supabase-schema.sql     # Schema SQL para crear las tablas
```

---

## Stack tecnológico

- **Next.js 14** — App Router
- **TypeScript** — tipado completo
- **Tailwind CSS** — estilos
- **Supabase** — base de datos PostgreSQL + Auth (cuando conectes)
- **date-fns** — manejo de fechas
- **lucide-react** — íconos
