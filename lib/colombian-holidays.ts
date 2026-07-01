function getEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const L = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * L) / 451);
  const month = Math.floor((h + L - 7 * m + 114) / 31);
  const day = ((h + L - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function getEmiliani(year: number, month: number, day: number): string {
  const date = new Date(year, month, day);
  const dayOfWeek = date.getDay();
  const daysToAdd = (8 - dayOfWeek) % 7;
  date.setDate(date.getDate() + daysToAdd);
  return formatLocalDate(date);
}

function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getColombianHolidays(year: number): Set<string> {
  const holidays = new Set<string>();
  
  // 1. Fixed
  holidays.add(`${year}-01-01`); // Año Nuevo
  holidays.add(`${year}-05-01`); // Día del Trabajo
  holidays.add(`${year}-07-20`); // Independencia
  holidays.add(`${year}-08-07`); // Batalla de Boyacá
  holidays.add(`${year}-12-08`); // Inmaculada Concepción
  holidays.add(`${year}-12-25`); // Navidad
  
  // 2. Emiliani Law (move to next Monday)
  holidays.add(getEmiliani(year, 0, 6));   // Reyes Magos (Jan 6)
  holidays.add(getEmiliani(year, 2, 19));  // San José (Mar 19)
  holidays.add(getEmiliani(year, 5, 29));  // San Pedro y San Pablo (Jun 29)
  holidays.add(getEmiliani(year, 7, 15));  // Asunción (Aug 15)
  holidays.add(getEmiliani(year, 9, 12));  // Día de la Raza (Oct 12)
  holidays.add(getEmiliani(year, 10, 1));  // Todos los Santos (Nov 1)
  holidays.add(getEmiliani(year, 10, 11)); // Independencia de Cartagena (Nov 11)
  
  // 3. Easter-based (Holy Week, etc.)
  const easter = getEaster(year);
  
  // Jueves Santo (Easter - 3 days)
  const juevesSanto = new Date(easter);
  juevesSanto.setDate(easter.getDate() - 3);
  holidays.add(formatLocalDate(juevesSanto));
  
  // Viernes Santo (Easter - 2 days)
  const viernesSanto = new Date(easter);
  viernesSanto.setDate(easter.getDate() - 2);
  holidays.add(formatLocalDate(viernesSanto));
  
  // Ascensión (Easter + 43 days)
  const ascension = new Date(easter);
  ascension.setDate(easter.getDate() + 43);
  holidays.add(formatLocalDate(ascension));
  
  // Corpus Christi (Easter + 64 days)
  const corpus = new Date(easter);
  corpus.setDate(easter.getDate() + 64);
  holidays.add(formatLocalDate(corpus));
  
  // Sagrado Corazón (Easter + 71 days)
  const sagrado = new Date(easter);
  sagrado.setDate(easter.getDate() + 71);
  holidays.add(formatLocalDate(sagrado));
  
  return holidays;
}

export function isHolidayColombia(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date + 'T12:00:00') : date;
  const year = d.getFullYear();
  const holidays = getColombianHolidays(year);
  
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dayStr = String(d.getDate()).padStart(2, '0');
  const checkStr = `${y}-${m}-${dayStr}`;
  
  return holidays.has(checkStr);
}
