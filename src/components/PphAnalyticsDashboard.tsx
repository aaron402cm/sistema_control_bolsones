import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Clock,
  Zap,
  Ship,
  Truck,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowUpRight,
  Info,
  Play,
  RotateCcw,
  Sliders,
  Target
} from 'lucide-react';
import { Buque, RegistroViaje } from '../types';

interface PphAnalyticsDashboardProps {
  buque: Buque | null;
  muelleTurno: RegistroViaje[];
  labartheTurno: RegistroViaje[];
  despachoTurno: RegistroViaje[];
  vesselRegistros: RegistroViaje[];
  pphDescarga: number;
  discrepanciesCount: number;
  onSelectTT?: (tt: string) => void;
}

export const PphAnalyticsDashboard: React.FC<PphAnalyticsDashboardProps> = ({
  buque,
  muelleTurno,
  labartheTurno,
  despachoTurno,
  vesselRegistros,
  pphDescarga,
  discrepanciesCount,
  onSelectTT,
}) => {
  // Simulator State
  const [customPph, setCustomPph] = useState<number | null>(null);
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>('all');
  const [hoveredHour, setHoveredHour] = useState<any | null>(null);
  const [activeSubView, setActiveSubView] = useState<'descarga' | 'despacho'>('descarga');

  // Total ship capacity & accumulated progress
  const totalCapacidadNave = useMemo(() => {
    if (!buque || !buque.productos) return 0;
    return buque.productos.reduce((acc, p) => acc + (p.cantidadBuque || 0), 0);
  }, [buque]);

  // Total discharged to Labarthe across the entire vessel stay (historical + current)
  const totalDescargadoAcumulado = useMemo(() => {
    return vesselRegistros
      .filter((r) => r.puesto === 'labarthe')
      .reduce((acc, r) => acc + r.bolsones, 0);
  }, [vesselRegistros]);

  // Total despachado across entire vessel stay
  const totalDespachadoAcumulado = useMemo(() => {
    return vesselRegistros
      .filter((r) => r.puesto === 'despacho')
      .reduce((acc, r) => acc + r.bolsones, 0);
  }, [vesselRegistros]);

  // Remaining cargo to discharge
  const saldoPendienteDescarga = Math.max(0, totalCapacidadNave - totalDescargadoAcumulado);
  const porcentajeAvanceDescarga = totalCapacidadNave > 0
    ? Math.min(100, Math.round((totalDescargadoAcumulado / totalCapacidadNave) * 100))
    : 0;

  // Effective operational PPH (either simulated or actual)
  const effectivePphDescarga = customPph !== null ? customPph : (pphDescarga > 0 ? pphDescarga : 140);

  // ETA Calculation for Discharge
  const etaDescarga = useMemo(() => {
    if (saldoPendienteDescarga <= 0) {
      return {
        horasRestantes: 0,
        minutosRestantes: 0,
        formattedTime: 'DESCARGA COMPLETADA AL 100%',
        fechaEstimada: 'Operación Finalizada',
        isFinished: true,
      };
    }

    if (effectivePphDescarga <= 0) {
      return {
        horasRestantes: 0,
        minutosRestantes: 0,
        formattedTime: 'Velocidad 0 - Sin estimación',
        fechaEstimada: 'En espera de reinicio',
        isFinished: false,
      };
    }

    const totalHoursFloat = saldoPendienteDescarga / effectivePphDescarga;
    const hours = Math.floor(totalHoursFloat);
    const minutes = Math.round((totalHoursFloat - hours) * 60);

    const completionDate = new Date(Date.now() + totalHoursFloat * 3600 * 1000);
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    };
    const dateStr = completionDate.toLocaleDateString('es-PE', options);

    return {
      horasRestantes: hours,
      minutosRestantes: minutes,
      formattedTime: `${hours}h ${minutes}m restantes`,
      fechaEstimada: dateStr,
      isFinished: false,
    };
  }, [saldoPendienteDescarga, effectivePphDescarga]);

  // Despacho Throughput & ETA
  const pphDespacho = useMemo(() => {
    if (despachoTurno.length === 0) return 0;
    const earliestTime = Math.min(...despachoTurno.map((d) => d.timestamp));
    const hoursElapsed = Math.max(0.2, (Date.now() - earliestTime) / 3600000);
    const totalBolsTurno = despachoTurno.reduce((acc, r) => acc + r.bolsones, 0);
    return Math.round(totalBolsTurno / hoursElapsed);
  }, [despachoTurno]);

  // ETA for Despacho to match total discharged
  const saldoPendienteDespacho = Math.max(0, totalDescargadoAcumulado - totalDespachadoAcumulado);
  const etaDespacho = useMemo(() => {
    const rate = pphDespacho > 0 ? pphDespacho : 80;
    if (saldoPendienteDespacho <= 0) {
      return {
        formattedTime: 'Al día con Labarthe',
        fechaEstimada: 'Sin rezago',
      };
    }
    const totalHoursFloat = saldoPendienteDespacho / rate;
    const hours = Math.floor(totalHoursFloat);
    const minutes = Math.round((totalHoursFloat - hours) * 60);
    const compDate = new Date(Date.now() + totalHoursFloat * 3600 * 1000);
    return {
      formattedTime: `${hours}h ${minutes}m restantes`,
      fechaEstimada: compDate.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
    };
  }, [saldoPendienteDespacho, pphDespacho]);

  // Hourly Breakdown Data for interactive futuristic chart
  const hourlyData = useMemo(() => {
    const map: Record<string, { hora: string; bolsMuelle: number; bolsLabarthe: number; viajes: number; timestamp: number }> = {};
    const now = new Date();

    // Create slots for the last 8 hours
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 3600 * 1000);
      const hStr = `${String(d.getHours()).padStart(2, '0')}:00`;
      map[hStr] = { hora: hStr, bolsMuelle: 0, bolsLabarthe: 0, viajes: 0, timestamp: d.getTime() };
    }

    // Populate with actual records
    vesselRegistros.forEach((r) => {
      const recDate = new Date(r.timestamp);
      const hStr = `${String(recDate.getHours()).padStart(2, '0')}:00`;
      if (map[hStr]) {
        if (r.puesto === 'muelle') map[hStr].bolsMuelle += r.bolsones;
        if (r.puesto === 'labarthe') {
          map[hStr].bolsLabarthe += r.bolsones;
          map[hStr].viajes += 1;
        }
      }
    });

    return Object.values(map);
  }, [vesselRegistros]);

  const maxHourlyVal = Math.max(1, ...hourlyData.map((d) => Math.max(d.bolsMuelle, d.bolsLabarthe, 150)));

  // TT Fleet Turnaround Analytics
  const ttCycleAnalytics = useMemo(() => {
    const ttStats: Record<string, { viajes: number; totalBols: number; duraciones: number[] }> = {};
    
    // Group muelle records
    muelleTurno.forEach((m) => {
      if (!ttStats[m.tt]) {
        ttStats[m.tt] = { viajes: 0, totalBols: 0, duraciones: [] };
      }
      ttStats[m.tt].viajes += 1;
      ttStats[m.tt].totalBols += m.bolsones;

      // Find matching labarthe record
      const matchL = labartheTurno.find((l) => l.baseViajeId === m.baseViajeId);
      if (matchL && matchL.timestamp > m.timestamp) {
        const diffMins = Math.round((matchL.timestamp - m.timestamp) / 60000);
        if (diffMins > 0 && diffMins < 60) {
          ttStats[m.tt].duraciones.push(diffMins);
        }
      }
    });

    return Object.entries(ttStats)
      .map(([tt, st]) => {
        const avgCycle = st.duraciones.length > 0
          ? (st.duraciones.reduce((a, b) => a + b, 0) / st.duraciones.length).toFixed(1)
          : '—';
        return {
          tt,
          viajes: st.viajes,
          totalBols: st.totalBols,
          avgCycle,
          efficiency: st.viajes >= 5 ? 'Óptimo' : 'Activo',
        };
      })
      .sort((a, b) => b.totalBols - a.totalBols);
  }, [muelleTurno, labartheTurno]);

  // Target Pace and deviation
  const targetPph = 180; // Standard IQBF port benchmark
  const paceDeviation = effectivePphDescarga - targetPph;
  const operationalEfficiency = Math.min(130, Math.round((effectivePphDescarga / targetPph) * 100));

  // Cybernetic Radial Gauge parameters
  const gaugeAngle = Math.min(180, Math.max(0, (effectivePphDescarga / 300) * 180));
  // Needle coordinates on semi-circle (radius 80, center 100, 100)
  const needleRad = (180 - gaugeAngle) * (Math.PI / 180);
  const needleX = 100 - 70 * Math.cos(needleRad);
  const needleY = 100 - 70 * Math.sin(needleRad);

  return (
    <div className="space-y-6">
      {/* Top Banner: Active Vessel & Sub-views */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 p-4 rounded-2xl border-2 border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase text-cyan-400 tracking-wider flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span>TELEMETRÍA PREDICTIVA & PPH EN TIEMPO REAL</span>
            </span>
          </div>
          <h2 className="text-xl font-black text-white mt-1 flex items-center gap-2">
            <span>{buque?.nombre || 'Nave Activa'}</span>
            <span className="text-xs text-slate-400 font-normal">({buque?.muelle || 'Muelle Sur'})</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Cálculo dinámico de velocidad operativa, rendimiento por cuadrilla y proyección de finalización.
          </p>
        </div>

        {/* View Switcher: Descarga vs Despacho */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveSubView('descarga')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubView === 'descarga'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Ship className="w-3.5 h-3.5" />
            <span>Descarga Buque</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubView('despacho')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubView === 'despacho'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Despacho Terrestre</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: PREDICTIVE ETA CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: ETA Descarga Principal */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border-2 border-cyan-500/40 relative overflow-hidden flex flex-col justify-between shadow-xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between text-xs font-black text-cyan-400 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span>Tiempo Estimado de Término</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/30 text-cyan-300">
                ETA Descarga
              </span>
            </div>
            
            <div className="mt-4">
              <div className="text-3xl lg:text-4xl font-black text-white tracking-tight">
                {etaDescarga.formattedTime}
              </div>
              <div className="text-sm font-bold text-cyan-300 mt-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Finalización: {etaDescarga.fechaEstimada}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-400 flex justify-between items-center">
            <span>Saldo por descargar:</span>
            <span className="font-mono font-black text-white text-sm">
              {saldoPendienteDescarga.toLocaleString()} bolsones
            </span>
          </div>
        </div>

        {/* Card 2: Cyber Holographic Gauge / Current Pace */}
        <div className="p-5 rounded-2xl bg-slate-900 border-2 border-slate-800 flex flex-col items-center justify-between relative shadow-xl">
          <div className="w-full flex items-center justify-between text-xs font-black uppercase text-slate-400">
            <span>Velocidad de Operación</span>
            <span className={paceDeviation >= 0 ? 'text-emerald-400' : 'text-amber-400'}>
              {paceDeviation >= 0 ? `+${paceDeviation} vs Meta` : `${paceDeviation} vs Meta`}
            </span>
          </div>

          {/* SVG Semi-Circle Cyber Gauge */}
          <div className="relative w-48 h-28 my-1 flex items-center justify-center">
            <svg viewBox="0 0 200 110" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="cyberGaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="50%" stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
                <filter id="gaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Background Arc */}
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="#1e293b"
                strokeWidth="16"
                strokeLinecap="round"
              />

              {/* Progress Arc */}
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="url(#cyberGaugeGrad)"
                strokeWidth="16"
                strokeDasharray="251.2"
                strokeDashoffset={251.2 - (gaugeAngle / 180) * 251.2}
                strokeLinecap="round"
                filter="url(#gaugeGlow)"
                className="transition-all duration-700 ease-out"
              />

              {/* Target Marker at 180 bols/h */}
              {(() => {
                const targetAng = (targetPph / 300) * 180;
                const tRad = (180 - targetAng) * (Math.PI / 180);
                const tx1 = 100 - 68 * Math.cos(tRad);
                const ty1 = 100 - 68 * Math.sin(tRad);
                const tx2 = 100 - 92 * Math.cos(tRad);
                const ty2 = 100 - 92 * Math.sin(tRad);
                return <line x1={tx1} y1={ty1} x2={tx2} y2={ty2} stroke="#f59e0b" strokeWidth="3" />;
              })()}

              {/* Needle */}
              <line
                x1="100"
                y1="100"
                x2={needleX}
                y2={needleY}
                stroke="#ffffff"
                strokeWidth="3.5"
                strokeLinecap="round"
                className="transition-all duration-500 ease-out"
              />
              <circle cx="100" cy="100" r="7" fill="#06b6d4" stroke="#ffffff" strokeWidth="2" />
            </svg>

            {/* Central Value */}
            <div className="absolute bottom-0 text-center">
              <div className="text-3xl font-black text-white leading-none tracking-tight">
                {effectivePphDescarga}
              </div>
              <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider mt-0.5">
                bolsones / hora
              </div>
            </div>
          </div>

          <div className="w-full flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800 pt-2">
            <span>Meta: <strong className="text-amber-400">{targetPph} bols/h</strong></span>
            <span>Eficiencia: <strong className="text-white">{operationalEfficiency}%</strong></span>
          </div>
        </div>

        {/* Card 3: Interactive Pace Simulator ("What-If") */}
        <div className="p-5 rounded-2xl bg-slate-900 border-2 border-slate-800 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between text-xs font-black uppercase text-amber-400">
              <span className="flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-amber-400" />
                <span>Simulador de Ritmo (What-If)</span>
              </span>
              {customPph !== null && (
                <button
                  type="button"
                  onClick={() => setCustomPph(null)}
                  className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  title="Restablecer al ritmo real"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restablecer</span>
                </button>
              )}
            </div>

            <p className="text-[11px] text-slate-400 mt-1">
              Ajuste el control para proyectar la hora de término a diferentes velocidades operativas:
            </p>

            <div className="mt-4 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-bold">Ritmo simulado:</span>
                <span className="font-mono font-black text-amber-400 text-sm">
                  {effectivePphDescarga} bols/h
                </span>
              </div>
              <input
                type="range"
                min="60"
                max="320"
                step="10"
                value={effectivePphDescarga}
                onChange={(e) => setCustomPph(Number(e.target.value))}
                className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <div className="flex justify-between text-[9px] text-slate-500 font-bold">
                <span>60 (Bajo)</span>
                <span>180 (Meta estándar)</span>
                <span>320 (Turbo 2 grúas)</span>
              </div>
            </div>
          </div>

          <div className="mt-3 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 flex items-center justify-between">
            <span className="text-slate-400">Término a este ritmo:</span>
            <span className="font-bold text-white">{etaDescarga.fechaEstimada}</span>
          </div>
        </div>
      </div>

      {/* SECTION 2: INTERACTIVE HOURLY THROUGHPUT & TREND CHART */}
      <div className="bg-slate-900 rounded-2xl border-2 border-slate-800 p-5 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <span>Flujo de Rendimiento Horario (Últimas 8 Horas)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Pase el cursor sobre las barras para auditar el volumen descargado y viajes de cada hora.
            </p>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs font-semibold">
            <div className="flex items-center gap-1.5 text-sky-400">
              <span className="w-3 h-3 rounded bg-sky-500/80"></span>
              <span>Muelle</span>
            </div>
            <div className="flex items-center gap-1.5 text-purple-400">
              <span className="w-3 h-3 rounded bg-purple-500/80"></span>
              <span>Labarthe</span>
            </div>
            <div className="flex items-center gap-1.5 text-amber-400">
              <span className="w-4 h-0.5 bg-amber-400"></span>
              <span>Meta 180 b/h</span>
            </div>
          </div>
        </div>

        {/* SVG Interactive Chart */}
        <div className="relative w-full h-64 select-none">
          <svg viewBox="0 0 800 240" className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id="muelleBarGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#0284c7" />
              </linearGradient>
              <linearGradient id="labartheBarGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c084fc" />
                <stop offset="100%" stopColor="#7e22ce" />
              </linearGradient>
            </defs>

            {/* Grid horizontal lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
              const y = 200 - pct * 170;
              const val = Math.round(pct * maxHourlyVal);
              return (
                <g key={idx}>
                  <line x1="40" y1={y} x2="780" y2={y} stroke="#1e293b" strokeDasharray="3 3" />
                  <text x="35" y={y + 4} fill="#64748b" fontSize="10" textAnchor="end" fontFamily="monospace">
                    {val}
                  </text>
                </g>
              );
            })}

            {/* Target line at 180 */}
            {(() => {
              const yTarget = 200 - (targetPph / maxHourlyVal) * 170;
              if (yTarget >= 30 && yTarget <= 200) {
                return (
                  <g>
                    <line x1="40" y1={yTarget} x2="780" y2={yTarget} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.7" />
                    <text x="775" y={yTarget - 4} fill="#f59e0b" fontSize="9" textAnchor="end" fontWeight="bold">
                      Meta: 180 b/h
                    </text>
                  </g>
                );
              }
              return null;
            })()}

            {/* Bars & Interactive Columns */}
            {hourlyData.map((d, idx) => {
              const colWidth = 720 / hourlyData.length;
              const xCenter = 50 + idx * colWidth + colWidth / 2;
              const barWidth = 18;

              const heightM = (d.bolsMuelle / maxHourlyVal) * 170;
              const heightL = (d.bolsLabarthe / maxHourlyVal) * 170;

              const ym = 200 - heightM;
              const yl = 200 - heightL;

              const isHovered = hoveredHour?.hora === d.hora;

              return (
                <g
                  key={d.hora}
                  className="cursor-pointer transition-opacity"
                  onMouseEnter={() => setHoveredHour(d)}
                  onMouseLeave={() => setHoveredHour(null)}
                >
                  {/* Hover background column */}
                  {isHovered && (
                    <rect
                      x={xCenter - colWidth / 2}
                      y="20"
                      width={colWidth}
                      height="190"
                      fill="#0ea5e9"
                      fillOpacity="0.08"
                      rx="8"
                    />
                  )}

                  {/* Muelle Bar */}
                  <rect
                    x={xCenter - barWidth - 2}
                    y={ym}
                    width={barWidth}
                    height={Math.max(2, heightM)}
                    rx="3"
                    fill="url(#muelleBarGrad)"
                    opacity={isHovered ? 1 : 0.85}
                  />

                  {/* Labarthe Bar */}
                  <rect
                    x={xCenter + 2}
                    y={yl}
                    width={barWidth}
                    height={Math.max(2, heightL)}
                    rx="3"
                    fill="url(#labartheBarGrad)"
                    opacity={isHovered ? 1 : 0.85}
                  />

                  {/* Hour Label */}
                  <text
                    x={xCenter}
                    y="220"
                    fill={isHovered ? '#38bdf8' : '#94a3b8'}
                    fontSize="11"
                    fontWeight={isHovered ? 'bold' : 'normal'}
                    textAnchor="middle"
                  >
                    {d.hora}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Floating Tooltip */}
          {hoveredHour && (
            <div className="absolute top-2 right-4 bg-slate-950/95 border-2 border-cyan-500/60 rounded-xl p-3 shadow-2xl backdrop-blur-md pointer-events-none text-xs space-y-1">
              <div className="font-black text-cyan-400 flex items-center justify-between gap-4">
                <span>⏱️ Ventana {hoveredHour.hora}</span>
                <span className="text-[10px] text-slate-400">{hoveredHour.viajes} viajes Labarthe</span>
              </div>
              <div className="text-sky-300 font-semibold flex justify-between gap-4">
                <span>Descarga Muelle:</span>
                <strong className="text-white">{hoveredHour.bolsMuelle} bolsones</strong>
              </div>
              <div className="text-purple-300 font-semibold flex justify-between gap-4">
                <span>Recepción Labarthe:</span>
                <strong className="text-white">{hoveredHour.bolsLabarthe} bolsones</strong>
              </div>
              <div className="text-amber-400 font-bold pt-1 border-t border-slate-800 text-[11px] flex justify-between">
                <span>Velocidad en esa hora:</span>
                <span>{hoveredHour.bolsLabarthe} bols/h</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 3: PRODUCT-BY-PRODUCT COMPLETION BREAKDOWN */}
      <div className="bg-slate-900 rounded-2xl border-2 border-slate-800 p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>Balance & Proyección de Término por Producto</span>
          </h3>
          <span className="text-xs text-slate-400 font-semibold">
            {buque?.productos.length || 0} producto(s) en manifiesto
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {buque?.productos.map((prod) => {
            // Count total discharged for this specific product
            const descargado = vesselRegistros
              .filter((r) => r.puesto === 'labarthe')
              .reduce((acc, r) => {
                if (r.itemsProductos && r.itemsProductos.length > 0) {
                  const match = r.itemsProductos.find(
                    (item) => item.producto.toLowerCase() === prod.producto.toLowerCase()
                  );
                  return acc + (match ? match.bolsones : 0);
                }
                if (r.productos.toLowerCase().includes(prod.producto.toLowerCase())) {
                  return acc + r.bolsones;
                }
                return acc;
              }, 0);

            const saldo = Math.max(0, prod.cantidadBuque - descargado);
            const pct = Math.min(100, Math.round((descargado / prod.cantidadBuque) * 100));

            // Product-specific ETA based on proportion of current PPH
            const prodEtaHours = effectivePphDescarga > 0 ? (saldo / effectivePphDescarga) : 0;
            const h = Math.floor(prodEtaHours);
            const m = Math.round((prodEtaHours - h) * 60);

            return (
              <div key={prod.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-black text-white text-sm flex items-center gap-1.5">
                    <span className="text-cyan-400">🧴</span>
                    <span>{prod.producto}</span>
                  </div>
                  <span className={`text-xs font-black px-2 py-0.5 rounded ${
                    pct >= 100
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  }`}>
                    {pct}% Completado
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-700 rounded-full ${
                      pct >= 100
                        ? 'bg-gradient-to-r from-emerald-400 to-teal-500'
                        : 'bg-gradient-to-r from-cyan-400 to-blue-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-800/80">
                  <div>
                    <span className="text-slate-400">Descargado: </span>
                    <strong className="text-white">{descargado} / {prod.cantidadBuque} bols</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400">Saldo pendiente: </span>
                    <strong className="text-amber-400">{saldo} bols</strong>
                  </div>
                  <div className="col-span-2 flex items-center justify-between text-slate-300 pt-0.5">
                    <span className="flex items-center gap-1 text-slate-400">
                      <Clock className="w-3 h-3 text-cyan-400" />
                      <span>Tiempo estimado para este producto:</span>
                    </span>
                    <strong className="text-cyan-300">
                      {saldo === 0 ? '✅ Terminado' : `${h}h ${m}m aprox`}
                    </strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 4: TT FLEET TURNAROUND & CYCLE EFFICIENCY */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Turnaround Table */}
        <div className="bg-slate-900 rounded-2xl border-2 border-slate-800 p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Truck className="w-4 h-4 text-cyan-400" />
              <span>Velocidad de Ciclo por TT (Muelle ➔ Labarthe)</span>
            </h3>
            <span className="text-xs text-slate-400 font-bold">{ttCycleAnalytics.length} unidades activas</span>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {ttCycleAnalytics.length === 0 ? (
              <div className="p-4 bg-slate-950 rounded-xl text-center text-xs text-slate-500 font-bold">
                No hay viajes registrados en este turno aún.
              </div>
            ) : (
              ttCycleAnalytics.map((item, idx) => (
                <div
                  key={item.tt}
                  onClick={() => onSelectTT && onSelectTT(item.tt)}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs hover:border-cyan-400 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-slate-500 font-bold">#{idx + 1}</span>
                    <span className="font-black text-cyan-400 group-hover:underline">{item.tt}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-slate-300 font-semibold">{item.viajes} viajes</span>
                    <span className="font-black text-emerald-400">{item.totalBols} bols</span>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Ciclo Promedio</span>
                      <span className="font-mono font-bold text-amber-400">{item.avgCycle} min</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Despacho Throughput Overview */}
        <div className="bg-slate-900 rounded-2xl border-2 border-slate-800 p-5 space-y-4 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                <span>Rendimiento Despacho Terrestre</span>
              </h3>
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                {despachoTurno.length} camiones
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Ritmo de carga y fiscalización de unidades para salida externa a clientes.
            </p>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-[11px] text-slate-400 font-bold uppercase">Ritmo Despacho</div>
                <div className="text-2xl font-black text-emerald-400 mt-1">{pphDespacho} bols/h</div>
                <div className="text-[10px] text-slate-500">en el turno actual</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-[11px] text-slate-400 font-bold uppercase">Despachado Turno</div>
                <div className="text-2xl font-black text-white mt-1">
                  {despachoTurno.reduce((acc, r) => acc + r.bolsones, 0)} bols
                </div>
                <div className="text-[10px] text-slate-500">en {despachoTurno.length} camiones</div>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Brecha con Labarthe (por despachar):</span>
              <strong className="text-white font-mono font-bold">
                {saldoPendienteDespacho.toLocaleString()} bols
              </strong>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Proyección para vaciar almacén:</span>
              <strong className="text-emerald-400 font-bold">
                {etaDespacho.formattedTime}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
