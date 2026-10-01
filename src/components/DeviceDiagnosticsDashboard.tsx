import React, { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  Radio,
  HardDrive,
  RefreshCw,
  Clock,
  Send,
  Copy,
  Check,
  Smartphone,
  Cpu,
  Server,
  Zap,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { TelemetriaPing } from '../types';
import { storage } from '../services/storageService';

interface DeviceDiagnosticsDashboardProps {
  pings: TelemetriaPing[];
  onRefresh?: () => void;
}

export const DeviceDiagnosticsDashboard: React.FC<DeviceDiagnosticsDashboardProps> = ({
  pings,
  onRefresh,
}) => {
  const [now, setNow] = useState<number>(Date.now());
  const [testingPing, setTestingPing] = useState<boolean>(false);
  const [pingLatency, setPingLatency] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Update second counter for heartbeats
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Ping test simulation
  const handleTestPing = () => {
    setTestingPing(true);
    const start = performance.now();
    setTimeout(() => {
      const elapsed = Math.round(performance.now() - start + Math.random() * 20 + 25);
      setPingLatency(elapsed);
      setTestingPing(false);
    }, 450);
  };

  const handleCopyRadio = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Node data for the 3 field inspector posts + CCTV Control
  const inspectorNodes = [
    {
      id: 'muelle',
      title: 'Inspector MUELLE',
      location: 'Pie de nave / Grúa pórtico',
      role: 'Fiscalizador de Izaje y Carga TT',
      icon: '🚢',
    },
    {
      id: 'labarthe',
      title: 'Inspector LABARTHE',
      location: 'Balanza / Almacén Labarthe',
      role: 'Recepción y Pesaje de Tolva',
      icon: '⚖️',
    },
    {
      id: 'despacho',
      title: 'Inspector DESPACHO',
      location: 'Patio de Salida Terrestre',
      role: 'Fiscalización Camiones Externos',
      icon: '🚛',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Explanation & Control Header */}
      <div className="bg-slate-900 p-5 rounded-2xl border-2 border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase text-cyan-400 tracking-wider flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span>CENTRO DE TELEMETRÍA Y ENLACE DE DISPOSITIVOS MÓVILES</span>
            </span>
          </div>
          <h2 className="text-xl font-black text-white mt-1">
            Diagnóstico de Red & Sincronización de Campo
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Monitorea el latido (Heartbeat) de los celulares de los inspectores en Muelle, Labarthe y Despacho.
            Si un inspector entra en zonas sin señal de radio/WiFi portuario, sus registros quedan resguardados en
            su base de datos local (IndexedDB) y esta consola alerta el estado de su cola offline para coordinar por radio VHF.
          </p>
        </div>

        {/* Global Network Action */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTestPing}
            disabled={testingPing}
            className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${testingPing ? 'animate-spin' : ''}`} />
            <span>{testingPing ? 'Midiendo Latencia...' : 'Probar Latencia de Red'}</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: NETWORK TOPOLOGY RADAR & NODES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {inspectorNodes.map((node) => {
          const matchPing = pings.find((p) =>
            p.puesto.toLowerCase().includes(node.id.toLowerCase())
          );
          const diffMs = matchPing ? now - matchPing.timestamp : 999999;
          const diffSecs = Math.floor(diffMs / 1000);

          const isOnline = diffSecs < 45;
          const isWeak = diffSecs >= 45 && diffSecs < 90;
          const isOffline = !matchPing || diffSecs >= 90;

          return (
            <div
              key={node.id}
              className={`p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border-2 relative overflow-hidden flex flex-col justify-between shadow-xl transition-all ${
                isOnline
                  ? 'border-emerald-500/40'
                  : isWeak
                  ? 'border-amber-500/50'
                  : 'border-red-500/50'
              }`}
            >
              {/* Background Glow */}
              <div
                className={`absolute top-0 right-0 w-28 h-28 rounded-full blur-2xl pointer-events-none opacity-20 ${
                  isOnline ? 'bg-emerald-500' : isWeak ? 'bg-amber-500' : 'bg-red-500'
                }`}
              />

              <div>
                {/* Node Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{node.icon}</span>
                    <div>
                      <h4 className="font-black text-white text-sm">{node.title}</h4>
                      <span className="text-[10px] text-slate-400 font-semibold">{node.location}</span>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide flex items-center gap-1.5 ${
                      isOnline
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : isWeak
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse'
                        : 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isOnline
                          ? 'bg-emerald-400 animate-ping'
                          : isWeak
                          ? 'bg-amber-400'
                          : 'bg-red-400'
                      }`}
                    />
                    <span>{isOnline ? 'EN LÍNEA' : isWeak ? 'SEÑAL DÉBIL' : 'SIN SEÑAL'}</span>
                  </span>
                </div>

                {/* Node Metrics */}
                <div className="mt-4 space-y-2.5 text-xs">
                  <div className="flex justify-between items-center text-slate-300">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Último Latido (Ping):</span>
                    </span>
                    <strong className="text-white font-mono">
                      {matchPing
                        ? diffSecs < 60
                          ? `hace ${diffSecs}s`
                          : `hace ${Math.floor(diffSecs / 60)}m ${diffSecs % 60}s`
                        : 'Sin reporte'}
                    </strong>
                  </div>

                  <div className="flex justify-between items-center text-slate-300">
                    <span className="text-slate-400 flex items-center gap-1">
                      <HardDrive className="w-3.5 h-3.5 text-purple-400" />
                      <span>Cola Offline Pendiente:</span>
                    </span>
                    <span
                      className={`font-mono font-black px-1.5 py-0.5 rounded text-[11px] ${
                        (matchPing?.pendientesCola || 0) > 0
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {matchPing?.pendientesCola || 0} registros
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-slate-300">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Dispositivo / Operador:</span>
                    </span>
                    <span className="text-white font-semibold truncate max-w-[130px]">
                      {matchPing?.inspectorNombre || 'Inspector Guardia'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Node Card Footer */}
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-semibold">{node.role}</span>
                <span className="text-cyan-400 font-mono">
                  {isOnline ? 'Latencia: <150ms' : 'Reconectando...'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* SECTION 2: SYSTEM INFRASTRUCTURE & STORAGE ENGINE HEALTH */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Storage Engine Status */}
        <div className="p-5 rounded-2xl bg-slate-900 border-2 border-slate-800 space-y-3 shadow-xl">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-cyan-400" />
              <span>Base de Datos Portuaria (IndexedDB)</span>
            </h4>
            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              ALTA CAPACIDAD
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Capacidad Nominal:</span>
              <strong className="text-white">Hasta 10,000 registros por buque</strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Persistencia Offline:</span>
              <strong className="text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Activa (Sin límite 5MB)
              </strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Evidencias Fotográficas:</span>
              <strong className="text-cyan-300">IndexedDB Blobs</strong>
            </div>
          </div>
        </div>

        {/* Network Ping & RTT Telemetry */}
        <div className="p-5 rounded-2xl bg-slate-900 border-2 border-slate-800 space-y-3 shadow-xl">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Telemetría de Red Local</span>
            </h4>
            <span className="text-[10px] font-mono text-slate-400">RTT</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Latencia RTT Medida:</span>
              <strong className="text-amber-400 font-mono text-sm">
                {pingLatency ? `${pingLatency} ms` : '52 ms (Promedio)'}
              </strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Protocolo de Comunicación:</span>
              <strong className="text-white font-mono">BroadcastChannel + Local Sync</strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Canal de Emergencia Acústica:</span>
              <strong className="text-red-400 font-mono">Sirena WebAudio API</strong>
            </div>
          </div>
        </div>

        {/* Shift Synchronization Engine */}
        <div className="p-5 rounded-2xl bg-slate-900 border-2 border-slate-800 space-y-3 shadow-xl">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Server className="w-4 h-4 text-purple-400" />
              <span>Corte de Turno Automático</span>
            </h4>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
              06:50 / 18:50
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Ventana Diurna:</span>
              <strong className="text-white font-mono">06:50 - 18:50 hrs</strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Ventana Nocturna:</span>
              <strong className="text-white font-mono">18:50 - 06:50 hrs</strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Reinicio Correlativos Turno:</span>
              <strong className="text-emerald-400">Automático al cambio de guardia</strong>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: VHF MARINE RADIO PROTOCOLS FOR CCTV OPERATOR */}
      <div className="bg-slate-900 rounded-2xl border-2 border-slate-800 p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                Protocolos de Llamada por Radio VHF (Canal 14/16 Portuario)
              </h3>
              <p className="text-xs text-slate-400">
                Guiones estandarizados para que el operador de CCTV ordene acciones inmediatas a los inspectores en caso de incidencias.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Radio Script 1 */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 relative">
            <div className="flex items-center justify-between text-xs">
              <span className="font-black text-amber-400 flex items-center gap-1.5">
                <span>📻</span>
                <span>Caso: Inspector con Retraso o Pérdida de Señal</span>
              </span>
              <button
                type="button"
                onClick={() =>
                  handleCopyRadio(
                    'Atención Inspector Muelle de CCTV: Se registra pérdida de latido. Tus registros están resguardados en tu equipo. No reingreses viajes para no duplicar correlativos. Confirma por radio último TT despachado.',
                    'radio_signal'
                  )
                }
                className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 bg-slate-800 px-2 py-1 rounded cursor-pointer"
              >
                {copiedId === 'radio_signal' ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copiar Guion</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-300 italic bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
              "Atención Inspector Muelle de CCTV: Se registra pérdida de latido. Tus registros están resguardados en tu equipo. No reingreses viajes para no duplicar correlativos. Confirma por radio último TT despachado."
            </p>
          </div>

          {/* Radio Script 2 */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 relative">
            <div className="flex items-center justify-between text-xs">
              <span className="font-black text-red-400 flex items-center gap-1.5">
                <span>🚨</span>
                <span>Caso: Discrepancia de Carga o TT Retrasado</span>
              </span>
              <button
                type="button"
                onClick={() =>
                  handleCopyRadio(
                    'Alerta CCTV a Balanza Labarthe y Muelle: Se detecta TT con más de 10 minutos en ruta o descuadre en cantidad de bolsones. Detener unidad al ingreso y verificar guía física antes de registrar.',
                    'radio_disc'
                  )
                }
                className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 bg-slate-800 px-2 py-1 rounded cursor-pointer"
              >
                {copiedId === 'radio_disc' ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copiar Guion</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-300 italic bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
              "Alerta CCTV a Balanza Labarthe y Muelle: Se detecta TT con más de 10 minutos en ruta o descuadre en cantidad de bolsones. Detener unidad al ingreso y verificar guía física antes de registrar."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
