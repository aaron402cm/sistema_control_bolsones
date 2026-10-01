import { ThemeConfig, ThemeId } from '../types';

export const THEMES: Record<ThemeId, ThemeConfig> = {
  normal: {
    id: 'normal',
    name: 'Normal (Alta Tecnología Portuaria)',
    icon: '⚡',
    description: 'Estilo portuario industrial con acentos azul cian y azul marino de alta precisión.',
    headerBg: 'bg-slate-900',
    headerBorder: 'border-cyan-500/40',
    accentBg: 'bg-cyan-500',
    accentText: 'text-cyan-400',
    cardBorder: 'border-slate-700/60',
    badgeStyle: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    festiveEmoji: '🚢',
  },
  fiestas_patrias: {
    id: 'fiestas_patrias',
    name: 'Fiestas Patrias 🇵🇪',
    icon: '🇵🇪',
    description: 'Rojo y blanco patriótico con laureles y escarapelas peruanas.',
    autoMonth: 6, // Julio (0-indexed: 6)
    headerBg: 'bg-gradient-to-r from-red-900 via-red-800 to-red-950',
    headerBorder: 'border-red-500',
    accentBg: 'bg-red-600',
    accentText: 'text-red-400',
    cardBorder: 'border-red-300/40',
    badgeStyle: 'bg-red-600 text-white font-bold',
    festiveEmoji: '🇵🇪',
    particleType: 'confetti',
  },
  navidad: {
    id: 'navidad',
    name: 'Navidad 🎄',
    icon: '🎄',
    description: 'Verde pino, rojo escarlata y copos de nieve suaves cayendo en vivo.',
    autoMonth: 11, // Diciembre
    headerBg: 'bg-gradient-to-r from-emerald-950 via-red-950 to-emerald-900',
    headerBorder: 'border-amber-400',
    accentBg: 'bg-emerald-600',
    accentText: 'text-amber-300',
    cardBorder: 'border-emerald-600/40',
    badgeStyle: 'bg-emerald-600 text-amber-200 border-amber-400/50',
    festiveEmoji: '🎅',
    particleType: 'snow',
  },
  ano_nuevo: {
    id: 'ano_nuevo',
    name: 'Año Nuevo 🎆',
    icon: '🎆',
    description: 'Dorado gala, medianoche y fuegos artificiales con destellos resplandecientes.',
    autoMonth: 0, // Enero
    headerBg: 'bg-gradient-to-r from-neutral-950 via-amber-950 to-neutral-900',
    headerBorder: 'border-amber-400',
    accentBg: 'bg-amber-500',
    accentText: 'text-amber-400',
    cardBorder: 'border-amber-500/40',
    badgeStyle: 'bg-amber-500/30 text-amber-300 border-amber-400',
    festiveEmoji: '🥂',
    particleType: 'sparkles',
  },
  primavera: {
    id: 'primavera',
    name: 'Primavera 🌸',
    icon: '🌸',
    description: 'Tonos esmeralda frescos, floración y pétalos danzantes en pantalla.',
    autoMonth: 8, // Septiembre
    headerBg: 'bg-gradient-to-r from-teal-950 via-emerald-900 to-rose-950',
    headerBorder: 'border-emerald-400',
    accentBg: 'bg-teal-600',
    accentText: 'text-emerald-300',
    cardBorder: 'border-teal-500/40',
    badgeStyle: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
    festiveEmoji: '🌺',
    particleType: 'petals',
  },
  san_valentin: {
    id: 'san_valentin',
    name: 'San Valentín ❤️',
    icon: '❤️',
    description: 'Rubí elegante y corazones sutiles que celebran la amistad y el amor.',
    autoMonth: 1, // Febrero
    headerBg: 'bg-gradient-to-r from-pink-950 via-rose-950 to-red-950',
    headerBorder: 'border-rose-400',
    accentBg: 'bg-rose-600',
    accentText: 'text-rose-300',
    cardBorder: 'border-rose-400/40',
    badgeStyle: 'bg-rose-500/20 text-rose-300 border-rose-400/40',
    festiveEmoji: '💖',
    particleType: 'hearts',
  },
  dia_madre: {
    id: 'dia_madre',
    name: 'Día de la Madre 💐',
    icon: '💐',
    description: 'Lavanda suave y oro rosado en homenaje maternal.',
    autoMonth: 4, // Mayo
    headerBg: 'bg-gradient-to-r from-purple-950 via-fuchsia-950 to-pink-950',
    headerBorder: 'border-pink-400',
    accentBg: 'bg-fuchsia-600',
    accentText: 'text-pink-300',
    cardBorder: 'border-fuchsia-400/40',
    badgeStyle: 'bg-fuchsia-500/20 text-pink-300 border-pink-400/40',
    festiveEmoji: '🌷',
    particleType: 'petals',
  },
  dia_padre: {
    id: 'dia_padre',
    name: 'Día del Padre 👔',
    icon: '👔',
    description: 'Azul cobalto regio y detalles en bronce en conmemoración paternal.',
    autoMonth: 5, // Junio
    headerBg: 'bg-gradient-to-r from-slate-950 via-blue-950 to-indigo-950',
    headerBorder: 'border-blue-400',
    accentBg: 'bg-blue-600',
    accentText: 'text-blue-300',
    cardBorder: 'border-blue-500/40',
    badgeStyle: 'bg-blue-500/20 text-blue-300 border-blue-400/40',
    festiveEmoji: '🏆',
    particleType: 'sparkles',
  },
};

export function getAutoDetectedTheme(): ThemeId {
  const currentMonth = new Date().getMonth();
  for (const [themeKey, config] of Object.entries(THEMES)) {
    if (config.autoMonth === currentMonth) {
      return themeKey as ThemeId;
    }
  }
  return 'normal';
}
