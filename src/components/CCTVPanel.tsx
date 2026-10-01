import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Buque, RegistroViaje, ThemeConfig, ThemeId, TelemetriaPing, TelemetriaLog } from '../types';
import {
  storage,
  getStandardDateTime,
  belongsToCurrentShift,
  getCurrentShiftLabel,
  getBaseViajeId,
  parseStandardDateTime,
} from '../services/storageService';
import {
  startEmergencySiren,
  stopEmergencySiren,
  muteSirenPermanently,
  isMuted,
  speakNotification,
  playVictoryFanfare,
  unlockAudioAndSpeech,
} from '../services/soundService';
import confetti from 'canvas-confetti';
import { MigrationModal } from './MigrationModal';
import { PphAnalyticsDashboard } from './PphAnalyticsDashboard';
import { DeviceDiagnosticsDashboard } from './DeviceDiagnosticsDashboard';
import {
  Ship,
  ShieldAlert,
  Volume2,
  VolumeX,
  Palette,
  RotateCw,
  Search,
  Download,
  AlertTriangle,
  Clock,
  Truck,
  Building2,
  CheckCircle,
  Activity,
  Layers,
  FolderArchive,
  Edit3,
  Image as ImageIcon,
  LogOut,
  ChevronRight,
  TrendingUp,
  ListOrdered,
  Mic,
} from 'lucide-react';

interface CCTVPanelProps {
  buques: Buque[];
  activeBuqueId: string;
  onSelectBuque: (id: string) => void;
  onOpenThemeModal: () => void;
  onExit: () => void;
  themeConfig: ThemeConfig;
}

export const CCTVPanel: React.FC<CCTVPanelProps> = ({
  buques,
  activeBuqueId,
  onSelectBuque,
  onOpenThemeModal,
  onExit,
  themeConfig,
}) => {
  const [registros, setRegistros] = useState<RegistroViaje[]>([]);
  const [activeTab, setActiveTab] = useState<'dash' | 'kpis' | 'descarga' | 'despacho' | 'soporte' | 'buscador'>('dash');
  const [descargaSubTab, setDescargaSubTab] = useState<'muelle' | 'labarthe' | 'comparativo'>('comparativo');

  // Search & Filters
  const [dashFilter, setDashFilter] = useState<string>('');
  const [dashPuestoFilter, setDashPuestoFilter] = useState<'todos' | 'muelle' | 'labarthe' | 'despacho'>('todos');
  const [dashLimit, setDashLimit] = useState<number>(50);
  const [dateStart, setDateStart] = useState<string>('');
  const [dateEnd, setDateEnd] = useState<string>('');
  const [searchResults, setSearchResults] = useState<RegistroViaje[]>([]);

  // Modals
  const [evidencePhotos, setEvidencePhotos] = useState<{ title: string; photos: string[] } | null>(null);
  const [selectedTTFicha, setSelectedTTFicha] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<RegistroViaje | null>(null);
  const [editBolsones, setEditBolsones] = useState<number>(0);
  const [editProducto, setEditProducto] = useState<string>('');
  const [editDni, setEditDni] = useState<string>('');

  // Siren & Mute
  const [sirenMuted, setSirenMuted] = useState<boolean>(isMuted());
  const [showMutePrompt, setShowMutePrompt] = useState<boolean>(false);
  const [muteDni, setMuteDni] = useState<string>('');
  const [mutedByDni, setMutedByDni] = useState<string>('');

  // Voice assistant timers
  const lastDiscrepancyVoiceRef = useRef<number>(Date.now());
  const lastDelayedVoiceRef = useRef<number>(Date.now());
  const previousRegistrosCountRef = useRef<number>(0);

  // Migration Modal state
  const [showMigrationModal, setShowMigrationModal] = useState<boolean>(false);

  // Clock
  const [currentTimeStr, setCurrentTimeStr] = useState<string>(getStandardDateTime());

  // Heartbeats
  const [pings, setPings] = useState<TelemetriaPing[]>([]);
  const [logs, setLogs] = useState<TelemetriaLog[]>([]);

  // Function to announce any new incoming record with feminine voice
  const announceRecordVocal = (reg: RegistroViaje) => {
    if (!reg) return;
    const ttText = reg.tt.replace('TT-', 'T T ');
    let msg = '';
    if (reg.puesto === 'muelle') {
      if (reg.itemsProductos && reg.itemsProductos.length >= 2) {
        msg = `Nuevo registro en Muelle, unidad ${ttText}, carga mixta con ${reg.itemsProductos[0].bolsones} bolsones de ${reg.itemsProductos[0].producto} y ${reg.itemsProductos[1].bolsones} de ${reg.itemsProductos[1].producto} en nave ${reg.buqueNombre}.`;
      } else {
        msg = `Nuevo registro en Muelle, unidad ${ttText}, con ${reg.bolsones} bolsones de ${reg.productos} en nave ${reg.buqueNombre}.`;
      }
    } else if (reg.puesto === 'labarthe') {
      const allCurrentRegs = storage.getRegistros();
      const muelleMatch = allCurrentRegs.find((r) => r.puesto === 'muelle' && r.baseViajeId === reg.baseViajeId);
      if (muelleMatch && muelleMatch.bolsones !== reg.bolsones) {
        msg = `¡Atención centro de control! Discrepancia detectada en Labarthe, unidad ${ttText}. Muelle registró ${muelleMatch.bolsones} bolsones, pero en Labarthe se colocaron ${reg.bolsones} bolsones. Por favor verificar cámaras.`;
      } else if (reg.itemsProductos && reg.itemsProductos.length >= 2) {
        msg = `Llegada confirmada en Labarthe, unidad ${ttText}, con ${reg.itemsProductos[0].bolsones} bolsones de ${reg.itemsProductos[0].producto} y ${reg.itemsProductos[1].bolsones} de ${reg.itemsProductos[1].producto}.`;
      } else {
        msg = `Llegada confirmada en Labarthe, unidad ${ttText}, con ${reg.bolsones} bolsones.`;
      }
    } else {
      if (reg.itemsProductos && reg.itemsProductos.length >= 2) {
        msg = `Despacho fiscalizado, unidad ${ttText}, con ${reg.itemsProductos[0].bolsones} bolsones de ${reg.itemsProductos[0].producto} y ${reg.itemsProductos[1].bolsones} de ${reg.itemsProductos[1].producto}.`;
      } else {
        msg = `Despacho fiscalizado, unidad ${ttText}, con ${reg.bolsones} bolsones.`;
      }
    }
    speakNotification(msg);
  };

  // Load and subscribe to real-time events
  const refreshData = () => {
    const fresh = storage.getRegistros();
    if (previousRegistrosCountRef.current > 0 && fresh.length > previousRegistrosCountRef.current) {
      const newest = fresh[0];
      if (newest && Date.now() - newest.timestamp < 10000) {
        announceRecordVocal(newest);
      }
    }
    previousRegistrosCountRef.current = fresh.length;
    setRegistros(fresh);
    setPings(storage.getHeartbeats());
    setLogs(storage.getLogs());
  };

  useEffect(() => {
    refreshData();
    const handleUpdate = () => refreshData();
    window.addEventListener('iqbf_data_updated', handleUpdate);

    const handleVoice = (e: any) => {
      announceRecordVocal(e.detail);
    };
    window.addEventListener('iqbf_new_record_voice', handleVoice);

    const clockTimer = setInterval(() => {
      setCurrentTimeStr(getStandardDateTime());
      setNowTimestamp(Date.now());
    }, 1000);

    return () => {
      window.removeEventListener('iqbf_data_updated', handleUpdate);
      window.removeEventListener('iqbf_new_record_voice', handleVoice);
      clearInterval(clockTimer);
      stopEmergencySiren();
    };
  }, []);

  const [nowTimestamp, setNowTimestamp] = useState<number>(Date.now());

  // Target vessel: supports 'all' (Ambas Naves Consolidado) or individual ship selection
  const [selectedBuqueId, setSelectedBuqueId] = useState<string>(activeBuqueId || 'all');

  useEffect(() => {
    if (activeBuqueId) {
      setSelectedBuqueId(activeBuqueId);
    }
  }, [activeBuqueId]);

  const handleSwitchBuque = (id: string) => {
    setSelectedBuqueId(id);
    onSelectBuque(id);
    if (id === 'all') {
      speakNotification('Visualizando ambas naves simultáneamente en modo consolidado.');
    } else {
      const b = buques.find((x) => x.id === id);
      if (b) {
        speakNotification(`Seguimiento activado para nave ${b.nombre}, atracada en ${b.muelle}.`);
      }
    }
  };

  const isAllVessels = selectedBuqueId === 'all' || !selectedBuqueId;
  const currentBuque = isAllVessels
    ? null
    : (buques.find((b) => b.id === selectedBuqueId) || buques[0] || null);

  const vesselRegistros = useMemo(() => {
    if (isAllVessels || !currentBuque) return registros;
    return registros.filter((r) => r.buqueId === currentBuque.id);
  }, [registros, isAllVessels, currentBuque]);

  // Real-time metrics per individual vessel for the Command Deck Switcher cards
  const buqueMetrics = useMemo(() => {
    const map = new Map<string, { totalMuelle: number; totalLabarthe: number; inTransit: number; viajesCount: number }>();
    buques.forEach((b) => {
      const bRegs = registros.filter((r) => r.buqueId === b.id && belongsToCurrentShift(r.fechaHora));
      const mRegs = bRegs.filter((r) => r.puesto === 'muelle');
      const lRegs = bRegs.filter((r) => r.puesto === 'labarthe');
      const lMap = new Set(lRegs.map((l) => l.baseViajeId));
      const inTransit = mRegs.filter((m) => !lMap.has(m.baseViajeId)).length;
      const tMuelle = mRegs.reduce((sum, r) => sum + r.bolsones, 0);
      const tLabarthe = lRegs.reduce((sum, r) => sum + r.bolsones, 0);
      map.set(b.id, { totalMuelle: tMuelle, totalLabarthe: tLabarthe, inTransit, viajesCount: mRegs.length });
    });
    return map;
  }, [buques, registros]);

  // Simulated transit trucks for testing the moving truck, TT display, and >10 min red blinking alert
  const [simulatedTransits, setSimulatedTransits] = useState<Array<{
    id: string;
    tt: string;
    elapsedSecs: number;
    bolsones: number;
    producto: string;
    buqueNombre: string;
    isDelayed: boolean;
  }>>([]);

  useEffect(() => {
    if (simulatedTransits.length === 0) return;
    const interval = setInterval(() => {
      setSimulatedTransits((prev) =>
        prev.map((t) => {
          const nextSecs = t.elapsedSecs + 1;
          const isDelayed = nextSecs >= 600;
          return { ...t, elapsedSecs: nextSecs, isDelayed };
        })
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [simulatedTransits.length]);

  const handleAddSimulatedTransit = (forceDelayed = false) => {
    const randomTTNum = Math.floor(Math.random() * 20) + 1;
    const ttId = `TT-${String(randomTTNum).padStart(2, '0')}`;
    const startSecs = forceDelayed ? 660 : 180; // 11 min vs 3 min
    const shipName = currentBuque?.nombre || buques[0]?.nombre || 'M/N PACIFIC VOYAGER';
    const newSim = {
      id: `sim_${Date.now()}`,
      tt: ttId,
      elapsedSecs: startSecs,
      bolsones: 20,
      producto: 'Harina de Trigo',
      buqueNombre: shipName,
      isDelayed: forceDelayed,
    };
    setSimulatedTransits((prev) => [newSim, ...prev]);

    if (forceDelayed) {
      speakNotification(`Alerta de prueba: Unidad ${ttId} lleva más de 10 minutos en tránsito. Carrito parpadeando en rojo con sirena de emergencia activa.`);
    } else {
      speakNotification(`Simulación activada: Unidad ${ttId} avanzando en autovía hacia Balanza Labarthe.`);
    }
  };

  const handleClearSimulation = () => {
    setSimulatedTransits([]);
    speakNotification('Simulación de radar restablecida.');
  };

  const turnoRegistros = useMemo(() => {
    return vesselRegistros.filter((r) => belongsToCurrentShift(r.fechaHora));
  }, [vesselRegistros]);

  const muelleTurno = useMemo(() => turnoRegistros.filter((r) => r.puesto === 'muelle'), [turnoRegistros]);
  const labartheTurno = useMemo(() => turnoRegistros.filter((r) => r.puesto === 'labarthe'), [turnoRegistros]);
  const despachoTurno = useMemo(() => turnoRegistros.filter((r) => r.puesto === 'despacho'), [turnoRegistros]);

  // Labarthe map to detect transit and discrepancies
  const labartheTurnoMap = useMemo(() => {
    const map = new Map<string, RegistroViaje>();
    labartheTurno.forEach((l) => map.set(l.baseViajeId, l));
    return map;
  }, [labartheTurno]);

  // Discrepancy & Transit analysis (Live ticking second by second)
  const { discrepanciesCount, transitList, delayedTransitCount } = useMemo(() => {
    let disc = 0;
    const transit: Array<{
      muelleReg: RegistroViaje;
      elapsedMins: number;
      elapsedSecs: number;
      isDelayed: boolean;
    }> = [];
    const now = nowTimestamp;

    muelleTurno.forEach((m) => {
      const l = labartheTurnoMap.get(m.baseViajeId);
      if (!l) {
        // In transit
        const elapsedSecs = Math.max(0, Math.round((now - m.timestamp) / 1000));
        const elapsedMins = Math.floor(elapsedSecs / 60);
        const isDelayed = elapsedMins >= 10;
        transit.push({ muelleReg: m, elapsedMins, elapsedSecs, isDelayed });
      } else {
        // Reached Labarthe -> verify
        const diffBols = m.bolsones !== l.bolsones;
        let diffProd = m.productos.trim().toLowerCase() !== l.productos.trim().toLowerCase();

        // If both have structured item breakdowns, check individual product quantities
        if (m.itemsProductos && l.itemsProductos && m.itemsProductos.length === l.itemsProductos.length) {
          const matched = m.itemsProductos.every((mItem, idx) => {
            const lItem = l.itemsProductos![idx];
            return mItem.producto === lItem?.producto && mItem.bolsones === lItem?.bolsones;
          });
          diffProd = !matched;
        }

        if (diffBols || diffProd) {
          disc++;
        }
      }
    });

    const delayed = transit.filter((t) => t.isDelayed).length;
    return { discrepanciesCount: disc, transitList: transit, delayedTransitCount: delayed };
  }, [muelleTurno, labartheTurnoMap, nowTimestamp]);

  // Unified transit list (Real + Simulated) for the Radar Highway
  const allTransits = useMemo(() => {
    const list = [...transitList];
    simulatedTransits.forEach((st) => {
      list.push({
        muelleReg: {
          id: st.id,
          idempotencyKey: st.id,
          buqueId: currentBuque?.id || 'buque_pacific_01',
          buqueNombre: st.buqueNombre,
          puesto: 'muelle',
          tt: st.tt,
          bolsones: st.bolsones,
          productos: st.producto,
          fechaHora: getStandardDateTime(new Date(Date.now() - st.elapsedSecs * 1000)),
          timestamp: Date.now() - st.elapsedSecs * 1000,
          fotos: [],
          baseViajeId: `viaje_${st.id}`,
          viajeId: `viaje_${st.id}_muelle`,
        },
        elapsedMins: Math.floor(st.elapsedSecs / 60),
        elapsedSecs: st.elapsedSecs,
        isDelayed: st.isDelayed,
      });
    });
    return list;
  }, [transitList, simulatedTransits, currentBuque]);

  const allDelayedCount = useMemo(() => {
    return allTransits.filter((t) => t.isDelayed).length;
  }, [allTransits]);

  // Alarm management (Triggers for discrepancies OR transit delay > 10m)
  useEffect(() => {
    if (discrepanciesCount > 0 || allDelayedCount > 0) {
      if (!sirenMuted) {
        startEmergencySiren();
      } else {
        stopEmergencySiren();
      }
    } else {
      stopEmergencySiren();
    }
  }, [discrepanciesCount, allDelayedCount, sirenMuted]);

  // Periodic voice reminder for unresolved discrepancies & transit delays
  useEffect(() => {
    const reminderInterval = setInterval(() => {
      const now = Date.now();

      // If active discrepancies exist, remind every 2 minutes (120,000ms) to correct the quantity of trip (X)
      if (discrepanciesCount > 0 && now - lastDiscrepancyVoiceRef.current >= 120000) {
        for (const m of muelleTurno) {
          const l = labartheTurnoMap.get(m.baseViajeId);
          if (l) {
            const diffBols = m.bolsones !== l.bolsones;
            let diffProd = m.productos.trim().toLowerCase() !== l.productos.trim().toLowerCase();
            if (m.itemsProductos && l.itemsProductos && m.itemsProductos.length === l.itemsProductos.length) {
              const matched = m.itemsProductos.every((mItem, idx) => {
                const lItem = l.itemsProductos![idx];
                return mItem.producto === lItem?.producto && mItem.bolsones === lItem?.bolsones;
              });
              diffProd = !matched;
            }

            if (diffBols || diffProd) {
              const ttName = m.tt.replace('TT-', 'T T ');
              const reminderText = `Atención Centro de Control: por favor verificar y corregir la cantidad registrada del viaje ${l.viajeId}, unidad ${ttName}. Muelle registró ${m.bolsones} bolsones y Labarthe tiene ${l.bolsones} bolsones. Continúa la discrepancia activa sin corregir.`;
              speakNotification(reminderText);
              lastDiscrepancyVoiceRef.current = now;
              break;
            }
          }
        }
      }

      // Delayed TT transit reminder every 3 minutes
      if (delayedTransitCount > 0 && now - lastDelayedVoiceRef.current >= 180000) {
        const delayedTruck = transitList.find((t) => t.isDelayed);
        if (delayedTruck) {
          const ttName = delayedTruck.muelleReg.tt.replace('TT-', 'T T ');
          speakNotification(`Alerta de ruta: La unidad ${ttName} lleva ${delayedTruck.elapsedMins} minutos en tránsito desde Muelle hacia Labarthe.`);
          lastDelayedVoiceRef.current = now;
        }
      }
    }, 10000);

    return () => clearInterval(reminderInterval);
  }, [discrepanciesCount, delayedTransitCount, muelleTurno, labartheTurnoMap, transitList]);

  // Totals
  const totalMuelle = muelleTurno.reduce((acc, r) => acc + r.bolsones, 0);
  const totalLabarthe = labartheTurno.reduce((acc, r) => acc + r.bolsones, 0);
  const totalDespacho = despachoTurno.reduce((acc, r) => acc + r.bolsones, 0);

  // Speedometer (PPH)
  const pphDescarga = useMemo(() => {
    if (muelleTurno.length === 0) return 0;
    const earliestTime = Math.min(...muelleTurno.map((m) => m.timestamp));
    const hoursElapsed = Math.max(0.2, (Date.now() - earliestTime) / 3600000);
    return Math.round(totalLabarthe / hoursElapsed);
  }, [muelleTurno, totalLabarthe]);

  // Handle Mute Siren
  const handleExecuteMute = () => {
    const val = muteDni.trim();
    if (val.length >= 4) {
      muteSirenPermanently(true);
      setSirenMuted(true);
      setMutedByDni(val);
      setShowMutePrompt(false);
      setMuteDni('');
      speakNotification(`Alarma sonora desactivada por el supervisor con credencial ${val}. Mantenga la atención visual en la pantalla para corregir la discrepancia.`);
    } else {
      alert('⚠️ Ingrese un DNI o clave de Coordinador válida (mínimo 4 dígitos).');
    }
  };

  // Handle Auditable Record Edit
  const handleSaveEdit = () => {
    if (!editingRecord || !editDni.trim()) {
      alert('⚠️ Debe ingresar el DNI de Coordinador que autoriza la corrección.');
      return;
    }
    const res = storage.editRegistro(editingRecord.viajeId, editBolsones, editProducto, editDni.trim());
    if (res.success) {
      alert('✅ Corrección registrada y auditada con éxito en la base de datos.');
      lastDiscrepancyVoiceRef.current = Date.now();
      speakNotification(`Corrección guardada con éxito para el viaje ${editingRecord.viajeId}. Cantidad registrada actualizada a ${editBolsones} bolsones.`);
      setEditingRecord(null);
      refreshData();
    } else {
      alert('❌ Error al modificar el registro.');
    }
  };

  // Export to CSV (supports up to 10,000 records for the vessel or date search)
  const handleExportCSV = () => {
    const dataToExport = activeTab === 'buscador' ? searchResults : vesselRegistros;
    if (dataToExport.length === 0) {
      alert('No hay registros en la nave seleccionada para exportar.');
      return;
    }

    let csv = '\uFEFFNave;Puesto;ID Viaje;TT/Placa;Conductor;Bolsones;Producto;FechaHora\n';
    dataToExport.forEach((r) => {
      csv += `"${r.buqueNombre}";"${r.puesto.toUpperCase()}";"${r.viajeId}";"${r.tt}";"${r.conductor || '—'}";"${r.bolsones}";"${r.productos}";"${r.fechaHora}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const vesselNameClean = (currentBuque?.nombre || 'IQBF').replace(/[^a-zA-Z0-9]/g, '_');
    a.download = `REPORTE_EXCEL_${vesselNameClean}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  // Search by Date/Time Range
  const handleExecuteSearch = () => {
    if (!dateStart || !dateEnd) {
      alert('Seleccione rango Desde y Hasta');
      return;
    }
    const dStart = new Date(dateStart).getTime();
    const dEnd = new Date(dateEnd).getTime();

    const filtered = vesselRegistros.filter((r) => r.timestamp >= dStart && r.timestamp <= dEnd);
    setSearchResults(filtered);
  };

  // Dash table filtered by search string, station filter, and limit
  const filteredDash = useMemo(() => {
    let list = vesselRegistros;
    if (dashPuestoFilter !== 'todos') {
      list = list.filter((r) => r.puesto === dashPuestoFilter);
    }
    const q = dashFilter.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (r) =>
          r.tt.toLowerCase().includes(q) ||
          r.viajeId.toLowerCase().includes(q) ||
          r.productos.toLowerCase().includes(q) ||
          r.puesto.toLowerCase().includes(q) ||
          (r.conductor && r.conductor.toLowerCase().includes(q)) ||
          (r.buqueNombre && r.buqueNombre.toLowerCase().includes(q))
      );
    }
    // Strict reverse chronological order (newest movements first)
    const sorted = [...list].sort((a, b) => b.timestamp - a.timestamp);
    if (dashLimit > 0) {
      return sorted.slice(0, dashLimit);
    }
    return sorted;
  }, [vesselRegistros, dashFilter, dashPuestoFilter, dashLimit]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      {/* Top Emergency Banners */}
      {discrepanciesCount > 0 && (
        <div className="bg-red-600 text-white font-black px-6 py-2.5 flex items-center justify-between text-sm shadow-xl sticky top-0 z-50 animate-pulse">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>
              🚨 SIRENA DE EMERGENCIA ACTIVA: Se detectaron {discrepanciesCount} discrepancia(s) de carga entre Muelle y
              Labarthe.
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!sirenMuted ? (
              <button
                type="button"
                onClick={() => setShowMutePrompt(true)}
                className="px-3 py-1 rounded-lg bg-slate-950 text-white hover:bg-slate-900 border border-red-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95"
              >
                <VolumeX className="w-4 h-4 text-red-400" />
                <span>Desactivar Alarma Sonora (DNI)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  muteSirenPermanently(false);
                  setSirenMuted(false);
                  setMutedByDni('');
                  speakNotification('Alarma sonora reactivada en Centro de Control.');
                }}
                className="text-xs font-bold bg-slate-950 hover:bg-slate-900 px-3 py-1 rounded-lg border border-emerald-400 text-emerald-300 flex items-center gap-1.5 cursor-pointer shadow-md"
                title="Haga clic para reactivar la sirena acústica"
              >
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <span>🔕 Alarma Silenciada ({mutedByDni || 'DNI'}) • Reactivar</span>
              </button>
            )}
          </div>
        </div>
      )}

      {delayedTransitCount > 0 && (
        <div className="bg-amber-600 text-slate-950 font-black px-6 py-2 flex items-center justify-between text-xs sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>
              ⚠️ ALERTA DE TRÁNSITO: {delayedTransitCount} Terminal Truck(s) llevan más de 10 minutos en ruta sin ingresar
              a Labarthe.
            </span>
          </div>
        </div>
      )}

      {/* Main Topbar */}
      <header className={`p-4 border-b ${themeConfig.headerBorder} ${themeConfig.headerBg} shadow-lg sticky top-0 z-40 backdrop-blur-md`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          {/* Brand & Shift */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-white tracking-wide">🎛️ PANEL CCTV MONITOREO</h1>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span> En Vivo
                </span>
                <span className="text-sm">{themeConfig.festiveEmoji}</span>
              </div>
              <div className="text-xs text-cyan-300/80 font-bold flex items-center gap-2">
                <span>{getCurrentShiftLabel()}</span>
                <span>•</span>
                <span>{currentTimeStr}</span>
              </div>
            </div>
          </div>

          {/* High-Tech Vessel Selector (Seguimiento ordenado Nave 1, Nave 2 o Ambas) */}
          <div className="flex items-center bg-slate-900/90 p-1.5 rounded-2xl border border-cyan-500/40 shadow-inner gap-1.5 flex-wrap">
            <span className="text-[11px] font-black text-slate-400 px-2 flex items-center gap-1.5">
              <Ship className="w-4 h-4 text-cyan-400" />
              <span>Nave:</span>
            </span>

            {/* Ambas Naves */}
            <button
              type="button"
              onClick={() => handleSwitchBuque('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                isAllVessels
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 shadow-md shadow-cyan-500/30 ring-2 ring-cyan-300 font-black scale-[1.02]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span>🌐 Ambas Naves</span>
              <span className="text-[10px] opacity-80">(Consolidado)</span>
            </button>

            {/* Individual Ships */}
            {buques.map((b) => {
              const isSelected = !isAllVessels && currentBuque?.id === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => handleSwitchBuque(b.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30 ring-2 ring-cyan-300 scale-[1.02]'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Ship className={`w-3.5 h-3.5 ${isSelected ? 'text-slate-950' : 'text-cyan-400'}`} />
                  <span>{b.nombre}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${isSelected ? 'bg-slate-950/30 text-slate-950' : 'bg-slate-800 text-cyan-300'}`}>
                    {b.muelle}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Assistant Voice Test */}
            <button
              type="button"
              onClick={async () => {
                await unlockAudioAndSpeech();
                speakNotification('Centro de control CCTV activado. Asistente de voz femenina en línea, monitoreando Muelle, Labarthe y Despachos en tiempo real.');
              }}
              className="p-2 px-3 rounded-xl bg-purple-950/80 hover:bg-purple-900 text-purple-300 border border-purple-500/40 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95"
              title="Probar y asegurar la voz femenina del asistente de audio"
            >
              <Volume2 className="w-4 h-4 text-purple-400 animate-pulse" />
              <span className="hidden sm:inline">🔊 Voz Femenina (Probar)</span>
              <span className="sm:hidden">🔊 Voz</span>
            </button>

            {/* Vocal Shift Summary */}
            <button
              type="button"
              onClick={async () => {
                await unlockAudioAndSpeech();
                const text = `Resumen del turno: ${totalMuelle} bolsones descargados en Muelle, ${totalLabarthe} recibidos en Balanza Labarthe, y ${totalDespacho} fiscalizados en Despacho. ${discrepanciesCount > 0 ? `Atención, hay ${discrepanciesCount} discrepancia pendiente de corrección.` : 'Operación normal sin discrepancias.'}`;
                speakNotification(text);
              }}
              className="p-2 px-3 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95"
              title="Escuchar reporte hablado del estado actual del turno"
            >
              <Mic className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline">🎙️ Resumen Hablado</span>
              <span className="sm:hidden">🎙️ Resumen</span>
            </button>

            <button
              type="button"
              onClick={onOpenThemeModal}
              className="p-2 px-3 rounded-xl bg-gradient-to-r from-pink-950/70 to-purple-950/70 hover:from-pink-900/90 hover:to-purple-900/90 text-pink-300 border border-pink-500/40 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md active:scale-95"
              title="Cambiar temática y efectos de fondo para los Inspectores y Portal"
            >
              <Palette className="w-4 h-4 text-pink-400" />
              <div className="text-left leading-tight hidden lg:block">
                <div className="text-[9px] text-pink-400 font-bold uppercase tracking-wider">Efectos Inspectores</div>
                <div className="text-xs font-black text-white flex items-center gap-1">
                  <span>{themeConfig.festiveEmoji}</span>
                  <span>{themeConfig.name.split(' ')[0]}</span>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!currentBuque) {
                  alert('Por favor seleccione una nave específica para migrar sus datos.');
                  return;
                }
                setShowMigrationModal(true);
              }}
              className="p-2.5 px-3.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-amber-600/30 transition-all cursor-pointer active:scale-95"
              title="Cerrar nave, descargar Excel y carpeta ZIP con fotos de evidencias y limpiar base de datos"
            >
              <FolderArchive className="w-4 h-4 text-slate-950" />
              <span>📦 MIGRAR</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="p-2.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Excel</span>
            </button>

            <button
              type="button"
              onClick={onExit}
              className="p-2.5 rounded-xl bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-500/40 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs (Sticky) */}
      <div className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 sticky top-[73px] z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 flex gap-2 overflow-x-auto py-2">
          {[
            { id: 'dash', label: '📊 Cuadro de Mando En Vivo' },
            { id: 'kpis', label: '📈 Analítica & Rendimiento PPH' },
            { id: 'descarga', label: '📥 Muelle vs Labarthe' },
            { id: 'despacho', label: '📤 Salidas Despacho' },
            { id: 'soporte', label: '🛠️ Diagnóstico de Dispositivos' },
            { id: 'buscador', label: '🔍 Buscador por Rango' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sticky Mini Live Counters Ribbon - Pinned so counters and headers remain visible at all times */}
      <div className="bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80 px-4 py-1.5 sticky top-[117px] z-20 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs overflow-x-auto">
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Totales Turno:</span>
            </span>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-sky-950/50 border border-sky-500/40 text-sky-300 font-bold text-[11px]">
              <Ship className="w-3 h-3 text-sky-400" />
              <span>Muelle: <strong className="text-white text-xs">{totalMuelle}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-purple-950/50 border border-purple-500/40 text-purple-300 font-bold text-[11px]">
              <Building2 className="w-3 h-3 text-purple-400" />
              <span>Labarthe: <strong className="text-white text-xs">{totalLabarthe}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 font-bold text-[11px]">
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              <span>Despacho: <strong className="text-white text-xs">{totalDespacho}</strong></span>
            </div>
            <div
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border font-bold text-[11px] ${
                discrepanciesCount > 0
                  ? 'bg-red-950/80 border-red-500 text-red-300 animate-pulse'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              <ShieldAlert className="w-3 h-3" />
              <span>Discrepancias: <strong className={discrepanciesCount > 0 ? 'text-red-400 text-xs' : 'text-emerald-400 text-xs'}>{discrepanciesCount}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-amber-950/50 border border-amber-500/40 text-amber-300 font-bold text-[11px]">
              <Truck className="w-3 h-3 text-amber-400" />
              <span>En Tránsito: <strong className="text-white text-xs">{transitList.length}</strong></span>
            </div>
          </div>
          <div className="text-[10px] text-slate-400 shrink-0 font-medium hidden sm:block">
            Nave Activa: <strong className="text-cyan-400">{isAllVessels ? '🌐 AMBAS NAVES (CONSOLIDADO)' : `${currentBuque?.nombre} (${currentBuque?.muelle})`}</strong>
          </div>
        </div>
      </div>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto w-full p-4 space-y-6 flex-1">
        {/* HERO COMMAND DECK VESSEL SELECTOR (Seguimiento ordenado y selección directa de Naves) */}
        {activeTab === 'dash' && (
          <div className="bg-slate-900/95 rounded-3xl border-2 border-slate-800 p-4 sm:p-5 shadow-2xl space-y-3 relative overflow-hidden backdrop-blur-xl">
            {/* Subtle cyber ambient glow */}
            <div className="absolute top-0 right-0 w-96 h-32 bg-cyan-500/10 blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-slate-800/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-md">
                  <Ship className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <span>PANEL DE CONTROL DE NAVES • SELECCIÓN Y SEGUIMIENTO OPERATIVO</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                      Puerto APM Callao 2026
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Haga clic en cualquiera de las dos naves para auditar su ciclo independiente de manera ordenada, o elija la vista consolidada multi-buque.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                <span>Modo de Seguimiento:</span>
                <span className="px-3 py-1 rounded-xl bg-slate-950 border border-cyan-500/50 text-cyan-300 font-black flex items-center gap-1.5 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                  {isAllVessels ? '🌐 AMBAS NAVES (CONSOLIDADO)' : `🚢 ${currentBuque?.nombre} (${currentBuque?.muelle})`}
                </span>
              </div>
            </div>

            {/* 3 Interactive Vessel Command Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
              {/* NAVE 1 & NAVE 2 CARDS */}
              {buques.map((b, idx) => {
                const isSelected = !isAllVessels && currentBuque?.id === b.id;
                const metrics = buqueMetrics.get(b.id) || { totalMuelle: 0, totalLabarthe: 0, inTransit: 0, viajesCount: 0 };
                const naveNum = idx + 1;

                return (
                  <div
                    key={b.id}
                    onClick={() => handleSwitchBuque(b.id)}
                    className={`p-4 rounded-2xl border-2 transition-all duration-300 cursor-pointer flex flex-col justify-between group relative overflow-hidden ${
                      isSelected
                        ? 'bg-gradient-to-b from-cyan-950/80 via-slate-900 to-slate-900 border-cyan-400 shadow-xl shadow-cyan-500/25 ring-2 ring-cyan-400/60 scale-[1.01]'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900/70 shadow-md'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-0 right-0 w-28 h-28 bg-cyan-400/10 rounded-full blur-xl pointer-events-none" />
                    )}

                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`p-2.5 rounded-xl border transition-all ${
                              isSelected
                                ? 'bg-cyan-500 text-slate-950 border-cyan-300 font-black shadow-md shadow-cyan-500/30'
                                : 'bg-slate-900 text-cyan-400 border-slate-800 group-hover:border-cyan-500/40'
                            }`}
                          >
                            <Ship className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                              <span>NAVE {naveNum}</span>
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                              <span className="text-slate-400">{b.muelle}</span>
                            </div>
                            <h3 className="text-sm font-black text-white group-hover:text-cyan-300 transition-colors">
                              {b.nombre}
                            </h3>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                            isSelected
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                              : 'bg-slate-900 text-slate-400 border-slate-800'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isSelected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                            }`}
                          ></span>
                          {isSelected ? 'EN MONITOREO' : 'ATRACADO'}
                        </span>
                      </div>

                      {/* Vessel Quick Metrics */}
                      <div className="grid grid-cols-3 gap-1.5 text-center pt-1 border-t border-slate-800/80">
                        <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800/80">
                          <div className="text-[9px] uppercase font-bold text-slate-400">Muelle</div>
                          <div className="text-base font-black text-sky-400">{metrics.totalMuelle}</div>
                          <div className="text-[8px] text-slate-500">bolsones</div>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800/80">
                          <div className="text-[9px] uppercase font-bold text-slate-400">Labarthe</div>
                          <div className="text-base font-black text-purple-400">{metrics.totalLabarthe}</div>
                          <div className="text-[8px] text-slate-500">bolsones</div>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800/80">
                          <div className="text-[9px] uppercase font-bold text-slate-400">En Ruta</div>
                          <div
                            className={`text-base font-black ${
                              metrics.inTransit > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-400'
                            }`}
                          >
                            {metrics.inTransit}
                          </div>
                          <div className="text-[8px] text-slate-500">TTs activos</div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 mt-3 border-t border-slate-800/80">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSwitchBuque(b.id);
                        }}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md ${
                          isSelected
                            ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/30 font-black'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-cyan-500/40'
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping"></span>
                            <span>⚡ SEGUIMIENTO ACTIVO (NAVE {naveNum})</span>
                          </>
                        ) : (
                          <>
                            <span>👉 HACER SEGUIMIENTO NAVE {naveNum}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* AMBAS NAVES CONSOLIDADO */}
              {(() => {
                const totalMuelleAll = buques.reduce((sum, b) => sum + (buqueMetrics.get(b.id)?.totalMuelle || 0), 0);
                const totalLabartheAll = buques.reduce((sum, b) => sum + (buqueMetrics.get(b.id)?.totalLabarthe || 0), 0);
                const totalTransitAll = allTransits.length;

                return (
                  <div
                    onClick={() => handleSwitchBuque('all')}
                    className={`p-4 rounded-2xl border-2 transition-all duration-300 cursor-pointer flex flex-col justify-between group relative overflow-hidden ${
                      isAllVessels
                        ? 'bg-gradient-to-b from-blue-950/80 via-slate-900 to-slate-900 border-blue-400 shadow-xl shadow-blue-500/25 ring-2 ring-blue-400/60 scale-[1.01]'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900/70 shadow-md'
                    }`}
                  >
                    {isAllVessels && (
                      <div className="absolute top-0 right-0 w-28 h-28 bg-blue-400/10 rounded-full blur-xl pointer-events-none" />
                    )}

                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`p-2.5 rounded-xl border transition-all ${
                              isAllVessels
                                ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-slate-950 border-blue-300 font-black shadow-md shadow-blue-500/30'
                                : 'bg-slate-900 text-blue-400 border-slate-800 group-hover:border-blue-500/40'
                            }`}
                          >
                            <Layers className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                              <span>CONTROL TOTAL MULTIBUQUE</span>
                            </div>
                            <h3 className="text-sm font-black text-white group-hover:text-blue-300 transition-colors">
                              🌐 AMBAS NAVES (CONSOLIDADO)
                            </h3>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                            isAllVessels
                              ? 'bg-blue-500/20 text-blue-300 border-blue-400/40'
                              : 'bg-slate-900 text-slate-400 border-slate-800'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isAllVessels ? 'bg-blue-400 animate-pulse' : 'bg-slate-500'
                            }`}
                          ></span>
                          {isAllVessels ? 'VISTA SIMULTÁNEA' : 'GLOBAL'}
                        </span>
                      </div>

                      {/* Consolidated Quick Metrics */}
                      <div className="grid grid-cols-3 gap-1.5 text-center pt-1 border-t border-slate-800/80">
                        <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800/80">
                          <div className="text-[9px] uppercase font-bold text-slate-400">Total Muelle</div>
                          <div className="text-base font-black text-sky-400">{totalMuelleAll}</div>
                          <div className="text-[8px] text-slate-500">2 naves</div>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800/80">
                          <div className="text-[9px] uppercase font-bold text-slate-400">Total Labarthe</div>
                          <div className="text-base font-black text-purple-400">{totalLabartheAll}</div>
                          <div className="text-[8px] text-slate-500">2 naves</div>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800/80">
                          <div className="text-[9px] uppercase font-bold text-slate-400">Total En Ruta</div>
                          <div
                            className={`text-base font-black ${
                              totalTransitAll > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-400'
                            }`}
                          >
                            {totalTransitAll}
                          </div>
                          <div className="text-[8px] text-slate-500">TTs activos</div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 mt-3 border-t border-slate-800/80">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSwitchBuque('all');
                        }}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md ${
                          isAllVessels
                            ? 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-slate-950 font-black shadow-blue-500/30'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-blue-500/40'
                        }`}
                      >
                        {isAllVessels ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping"></span>
                            <span>⚡ MONITOREO CONSOLIDADO ACTIVO</span>
                          </>
                        ) : (
                          <>
                            <span>👉 VER AMBAS NAVES SIMULTÁNEAMENTE</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* KPI CARDS (Always visible on Dash) */}
        {activeTab === 'dash' && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {/* Muelle */}
            <div className="p-4 rounded-2xl bg-slate-900 border-2 border-sky-500/30 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-bold text-sky-400 uppercase">
                <span>Descarga Muelle</span>
                <Ship className="w-4 h-4" />
              </div>
              <div className="text-3xl font-black text-white mt-2">{totalMuelle}</div>
              <div className="text-[11px] text-slate-400 mt-1">{muelleTurno.length} viajes registrados</div>
            </div>

            {/* Labarthe */}
            <div className="p-4 rounded-2xl bg-slate-900 border-2 border-purple-500/30 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-bold text-purple-400 uppercase">
                <span>Recibido Labarthe</span>
                <Building2 className="w-4 h-4" />
              </div>
              <div className="text-3xl font-black text-white mt-2">{totalLabarthe}</div>
              <div className="text-[11px] text-slate-400 mt-1">{labartheTurno.length} arribos confirmados</div>
            </div>

            {/* Discrepancies */}
            <div
              className={`p-4 rounded-2xl border-2 flex flex-col justify-between ${
                discrepanciesCount > 0
                  ? 'bg-red-950/70 border-red-500 animate-pulse'
                  : 'bg-slate-900 border-slate-800'
              }`}
            >
              <div
                className={`flex items-center justify-between text-xs font-bold uppercase ${
                  discrepanciesCount > 0 ? 'text-red-400' : 'text-slate-400'
                }`}
              >
                <span>Discrepancias</span>
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div
                className={`text-3xl font-black mt-2 ${
                  discrepanciesCount > 0 ? 'text-red-400' : 'text-emerald-400'
                }`}
              >
                {discrepanciesCount}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {discrepanciesCount === 0 ? '✅ Sin descuadres' : '⚠️ Requiere revisión'}
              </div>
            </div>

            {/* In Transit */}
            <div
              className={`p-4 rounded-2xl border-2 flex flex-col justify-between ${
                delayedTransitCount > 0
                  ? 'bg-amber-950/70 border-amber-500'
                  : 'bg-slate-900 border-slate-800'
              }`}
            >
              <div
                className={`flex items-center justify-between text-xs font-bold uppercase ${
                  delayedTransitCount > 0 ? 'text-amber-400' : 'text-slate-400'
                }`}
              >
                <span>TTs en Tránsito</span>
                <Truck className="w-4 h-4" />
              </div>
              <div className="text-3xl font-black text-amber-400 mt-2">{transitList.length}</div>
              <div className="text-[11px] text-slate-400 mt-1">
                {delayedTransitCount > 0 ? `🚨 ${delayedTransitCount} con retraso (>10m)` : 'En ruta normal'}
              </div>
            </div>

            {/* Despacho */}
            <div className="p-4 rounded-2xl bg-slate-900 border-2 border-emerald-500/30 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-400 uppercase">
                <span>Despachados</span>
                <TrendingUp className="w-4 h-4" />
              </div>
              <div className="text-3xl font-black text-white mt-2">{totalDespacho}</div>
              <div className="text-[11px] text-slate-400 mt-1">{despachoTurno.length} camiones fiscalizados</div>
            </div>
          </div>
        )}

        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dash' && (
          <div className="space-y-6">
            {/* CARGO BALANCE & LIVE TRANSIT HIGHWAY RADAR */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              {/* Product Balances (Left Column - 5 cols) */}
              <div className="xl:col-span-5 bg-slate-900 rounded-2xl border-2 border-slate-800 p-5 space-y-4 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                      <Layers className="w-4 h-4 text-cyan-400" />
                      <span>Balance de Carga por Producto</span>
                    </h3>
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-cyan-950/90 text-cyan-300 border border-cyan-500/40">
                      {isAllVessels ? '🌐 Consolidado Ambas Naves' : currentBuque?.nombre}
                    </span>
                  </div>

                  <div className="space-y-3 mt-4">
                    {(isAllVessels
                      ? buques.flatMap((b) =>
                          b.productos.map((p) => ({ ...p, buqueNombre: b.nombre, buqueMuelle: b.muelle }))
                        )
                      : (currentBuque ? currentBuque.productos : []).map((p) => ({
                          ...p,
                          buqueNombre: currentBuque?.nombre,
                          buqueMuelle: currentBuque?.muelle,
                        }))
                    ).map((p, idx) => {
                      const descargado = labartheTurno.reduce((acc, r) => {
                        if (p.buqueNombre && r.buqueNombre !== p.buqueNombre) return acc;
                        if (r.itemsProductos && r.itemsProductos.length > 0) {
                          const item = r.itemsProductos.find(
                            (it) => it.producto.toLowerCase() === p.producto.toLowerCase()
                          );
                          return acc + (item ? item.bolsones : 0);
                        }
                        if (r.productos.toLowerCase().includes(p.producto.toLowerCase())) {
                          return acc + r.bolsones;
                        }
                        return acc;
                      }, 0);

                      const saldo = Math.max(0, p.cantidadBuque - descargado);
                      const pct = Math.min(100, Math.round((descargado / p.cantidadBuque) * 100));

                      return (
                        <div
                          key={`${p.id}_${idx}`}
                          className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800/90 space-y-2 hover:border-slate-700 transition-all shadow-sm"
                        >
                          <div className="flex justify-between items-center text-xs flex-wrap gap-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-black text-white text-sm">🧴 {p.producto}</span>
                              {isAllVessels && p.buqueNombre && (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-cyan-300 font-mono">
                                  {p.buqueNombre.split(' ')[0]}
                                </span>
                              )}
                            </div>
                            <span className="font-bold text-cyan-400 font-mono text-xs">
                              {descargado} / {p.cantidadBuque} bols ({pct}%)
                            </span>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-700 rounded-full ${
                                pct >= 100
                                  ? 'bg-gradient-to-r from-emerald-400 to-teal-500'
                                  : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>

                          <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                            <span>
                              Saldo pendiente: <strong className="text-white">{saldo} bolsones</strong>
                            </span>
                            <span>{pct >= 100 ? '🏁 Descarga Completada' : 'Operando'}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-500 flex justify-between items-center">
                  <span>Balance auditado de tolvas y bodegas</span>
                  <span className="text-cyan-400 font-bold">
                    {isAllVessels ? 'Control de Ambas Naves' : currentBuque?.nombre}
                  </span>
                </div>
              </div>

              {/* Ritmo de Operación & Radar de Tránsito en Vivo (Right Column - 7 cols) */}
              <div className="xl:col-span-7 bg-slate-900 rounded-3xl border-2 border-slate-800 p-5 space-y-4 shadow-xl flex flex-col justify-between backdrop-blur-xl">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                        <Activity className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                          <span>Ritmo de Operación & Radar de Tránsito</span>
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Supervisión visual en vivo: Autovía Muelle ➔ Balanza Labarthe
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Interactive Simulation / Test Buttons */}
                      <button
                        type="button"
                        onClick={() => handleAddSimulatedTransit(false)}
                        className="px-2.5 py-1 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-sm"
                        title="Simular un camión TT avanzando en la autovía portuaria"
                      >
                        <Truck className="w-3.5 h-3.5 text-cyan-400" />
                        <span>+ Simular TT</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddSimulatedTransit(true)}
                        className="px-2.5 py-1 rounded-xl bg-red-950/90 hover:bg-red-900 border border-red-500/60 text-red-200 font-black text-[11px] flex items-center gap-1 cursor-pointer transition-all active:scale-95 animate-pulse shadow-md shadow-red-600/30"
                        title="Probar un camión que superó los 10 minutos (se pone rojo, parpadea y suena la sirena)"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                        <span>🚨 Probar Excedido (&gt;10m)</span>
                      </button>

                      {simulatedTransits.length > 0 && (
                        <button
                          type="button"
                          onClick={handleClearSimulation}
                          className="px-2 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-[11px] font-bold cursor-pointer transition-colors"
                          title="Restablecer simulaciones del radar"
                        >
                          ✕ Limpiar
                        </button>
                      )}

                      {allDelayedCount > 0 ? (
                        <span className="text-xs px-3 py-1 rounded-xl bg-red-600 text-white font-black animate-bounce flex items-center gap-1.5 shadow-lg shadow-red-600/50">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>{allDelayedCount} TT(s) RETRASADOS (&gt;10m)</span>
                        </span>
                      ) : allTransits.length > 0 ? (
                        <span className="text-xs px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                          <span>{allTransits.length} en Autovía</span>
                        </span>
                      ) : (
                        <span className="text-xs px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Ruta Despejada</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Telemetry Row */}
                  <div className="grid grid-cols-3 gap-2.5 text-center">
                    <div className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800 shadow-inner">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Velocidad PPH</div>
                      <div className="text-2xl sm:text-3xl font-black text-cyan-400 tracking-tight">{pphDescarga}</div>
                      <div className="text-[10px] text-cyan-400/80 font-medium">bolsones / hora</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800 shadow-inner">
                      <div className="text-[10px] uppercase font-bold text-slate-400">TTs en Tránsito</div>
                      <div className="text-2xl sm:text-3xl font-black text-amber-400 tracking-tight">{allTransits.length}</div>
                      <div className="text-[10px] text-slate-400 font-medium">unidades en ruta</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800 shadow-inner">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Límite Permitido</div>
                      <div className="text-2xl sm:text-3xl font-black text-purple-400 tracking-tight">10 min</div>
                      <div className="text-[10px] text-purple-400/80 font-medium">alarma sonora &gt;10m</div>
                    </div>
                  </div>
                </div>

                {/* Radar Highway Track (Autovía Portuaria en Vivo con Dibujo de Carros Avanzando) */}
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between text-xs font-black text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                      <span className="uppercase text-[11px] text-cyan-300 font-black">
                        Radar Autovía Portuaria: 🏗️ Muelle ➔ ⚖️ Balanza Labarthe
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      Rango Estándar: 4 - 8 min | Máx Permitido: 10 min
                    </span>
                  </div>

                  {allTransits.length === 0 ? (
                    <div className="p-6 sm:p-8 rounded-2xl bg-slate-950 border-2 border-slate-800 flex flex-col items-center justify-center text-center space-y-4 relative overflow-hidden shadow-inner">
                      {/* Radar Sonar Rings Effect */}
                      <div className="relative w-28 h-28 flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full border border-cyan-500/20 animate-ping [animation-duration:3s]"></div>
                        <div className="absolute inset-3 rounded-full border border-cyan-500/30"></div>
                        <div className="absolute inset-6 rounded-full border border-cyan-500/40"></div>
                        <div className="w-5 h-5 rounded-full bg-cyan-500 shadow-lg shadow-cyan-500"></div>
                        {/* Radar sweep beam */}
                        <div className="absolute inset-0 rounded-full border-t-2 border-cyan-400 animate-spin [animation-duration:3s] opacity-80"></div>
                      </div>
                      <div>
                        <div className="text-sm font-black text-emerald-400 tracking-wide">
                          🟢 AUTOVÍA DESPEJADA • 0 CAMIONES EN RUTA
                        </div>
                        <p className="text-xs text-slate-400 max-w-md mt-1">
                          Todos los camiones despachados desde Muelle han completado su arribo en Balanza Labarthe. Puede presionar los botones superiores para simular el avance de un camión o probar la alarma sonora.
                        </p>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleAddSimulatedTransit(false)}
                          className="px-3 py-1.5 rounded-xl bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
                        >
                          <Truck className="w-4 h-4 text-cyan-400" />
                          <span>+ Simular Carrito Avanzando</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddSimulatedTransit(true)}
                          className="px-3 py-1.5 rounded-xl bg-red-950 hover:bg-red-900 border border-red-500/50 text-red-300 text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-md animate-pulse"
                        >
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                          <span>🚨 Probar Carrito Excedido (&gt;10m)</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3.5 max-h-96 overflow-y-auto pr-1">
                      {allTransits.map((t, idx) => {
                        const progressPct = Math.min(88, Math.max(8, (t.elapsedSecs / 600) * 80 + 8));
                        const isDelayed = t.isDelayed;

                        return (
                          <div
                            key={t.muelleReg.id}
                            className={`p-3.5 rounded-2xl border-2 transition-all relative overflow-hidden ${
                              isDelayed
                                ? 'bg-gradient-to-r from-red-950/90 via-red-900/80 to-red-950/90 border-red-500 shadow-2xl shadow-red-600/60 ring-4 ring-red-500/60 animate-pulse'
                                : 'bg-slate-950 border-slate-800 hover:border-slate-700 shadow-md'
                            }`}
                          >
                            {/* Road Checkpoints Header */}
                            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 border-b border-slate-800/80 pb-1.5 mb-2">
                              <span className="flex items-center gap-1 text-cyan-400">
                                <span>🏗️ Salida Muelle ({t.muelleReg.buqueNombre?.split(' ')[0] || 'Muelle'})</span>
                              </span>
                              <span className="text-slate-500 hidden sm:inline">Punto Medio (5 min)</span>
                              <span
                                className={
                                  isDelayed
                                    ? 'text-red-300 font-black animate-pulse flex items-center gap-1'
                                    : 'text-purple-400 font-bold'
                                }
                              >
                                {isDelayed && <span>🚨 ¡LÍMITE SUPERADO!</span>}
                                <span>⚖️ Balanza Labarthe (10m máx)</span>
                              </span>
                            </div>

                            {/* The Highway Road Track */}
                            <div className="relative h-28 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 rounded-2xl border border-slate-800 overflow-hidden flex items-center">
                              {/* Center road divider line with moving dashes animation */}
                              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-b-2 border-dashed border-slate-700/70 z-0"></div>

                              {/* Distance Milestone Lines */}
                              <div className="absolute top-0 bottom-0 left-[25%] border-r border-slate-800/80 flex flex-col justify-end p-1">
                                <span className="text-[9px] text-slate-600 font-mono">2.5m</span>
                              </div>
                              <div className="absolute top-0 bottom-0 left-[50%] border-r border-slate-800/80 flex flex-col justify-end p-1">
                                <span className="text-[9px] text-slate-600 font-mono">5.0m</span>
                              </div>
                              <div className="absolute top-0 bottom-0 left-[75%] border-r border-slate-800/80 flex flex-col justify-end p-1">
                                <span className="text-[9px] text-slate-600 font-mono">7.5m</span>
                              </div>

                              {/* Critical Red Danger Zone (>= 10 min mark) */}
                              <div className="absolute top-0 bottom-0 right-0 w-[15%] bg-red-950/50 border-l-2 border-dashed border-red-500/70 flex items-center justify-center">
                                <span className="text-[8px] font-black text-red-400 uppercase rotate-90 tracking-widest whitespace-nowrap">
                                  LÍMITE 10m
                                </span>
                              </div>

                              {/* THE MOVING TRUCK (Dibujo del Carro Avanzando con Número de TT) */}
                              <div
                                style={{ left: `${progressPct}%` }}
                                onClick={() => setSelectedTTFicha(t.muelleReg.tt)}
                                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-1000 ease-out z-20 cursor-pointer group"
                                title={`Haga clic para ver ficha y ciclos de ${t.muelleReg.tt}`}
                              >
                                {/* TT Number Pill & Live Seconds Timer (Flotante arriba del carro) */}
                                <div className="flex flex-col items-center mb-1">
                                  <div
                                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider flex items-center gap-1.5 shadow-lg border whitespace-nowrap ${
                                      isDelayed
                                        ? 'bg-red-600 text-white border-red-200 animate-bounce ring-4 ring-red-400 shadow-red-600/90'
                                        : 'bg-slate-900 text-cyan-300 border-cyan-400/80 shadow-cyan-500/30'
                                    }`}
                                  >
                                    <span className="font-mono text-xs">{t.muelleReg.tt}</span>
                                    <span>•</span>
                                    <span className="font-mono text-white">
                                      {t.elapsedMins}m {t.elapsedSecs % 60}s
                                    </span>
                                    {isDelayed && (
                                      <span className="animate-ping text-yellow-300 font-black">🚨</span>
                                    )}
                                  </div>
                                </div>

                                {/* Truck Physical Drawing Body (SVG) - SE PONE ROJO Y PARPADEA SI >10m */}
                                <div
                                  className={`relative px-2 py-1 rounded-xl border transition-all duration-300 flex items-center gap-1.5 ${
                                    isDelayed
                                      ? 'bg-red-600 border-red-300 text-white shadow-[0_0_35px_rgba(239,68,68,1)] ring-4 ring-red-400 animate-pulse scale-105'
                                      : 'bg-slate-900/95 border-cyan-400 text-cyan-300 shadow-lg shadow-cyan-500/30 group-hover:scale-105'
                                  }`}
                                >
                                  {/* Truck SVG */}
                                  <svg
                                    className="w-14 h-9 drop-shadow"
                                    viewBox="0 0 68 40"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                  >
                                    {/* Roof Warning Beacon (Flashing strobe when delayed) */}
                                    <circle
                                      cx="48"
                                      cy="6"
                                      r="3.5"
                                      className={
                                        isDelayed
                                          ? 'fill-red-200 animate-ping'
                                          : 'fill-amber-400 animate-pulse'
                                      }
                                    />
                                    <circle
                                      cx="48"
                                      cy="6"
                                      r="2"
                                      className={isDelayed ? 'fill-white' : 'fill-amber-200'}
                                    />

                                    {/* Flatbed Trailer Platform */}
                                    <rect
                                      x="2"
                                      y="19"
                                      width="36"
                                      height="5"
                                      rx="1.5"
                                      className={isDelayed ? 'fill-red-900' : 'fill-slate-700'}
                                    />

                                    {/* Cargo Big Bags on trailer (Bolsones IQBF) */}
                                    <rect
                                      x="5"
                                      y="8"
                                      width="13"
                                      height="11"
                                      rx="2"
                                      className={isDelayed ? 'fill-red-500' : 'fill-cyan-400'}
                                    />
                                    <rect
                                      x="20"
                                      y="8"
                                      width="14"
                                      height="11"
                                      rx="2"
                                      className={isDelayed ? 'fill-red-400' : 'fill-teal-300'}
                                    />
                                    <line x1="11" y1="8" x2="11" y2="19" stroke="#0f172a" strokeWidth="1.2" />
                                    <line x1="27" y1="8" x2="27" y2="19" stroke="#0f172a" strokeWidth="1.2" />

                                    {/* Truck Cabin (Facing Right towards Labarthe) - SE PONE ROJO SI EXCEDIDO */}
                                    <path
                                      d="M 38 24 L 38 9 L 50 9 L 58 16 L 60 24 Z"
                                      className={isDelayed ? 'fill-red-700' : 'fill-cyan-600'}
                                      stroke={isDelayed ? '#ffffff' : '#38bdf8'}
                                      strokeWidth="1.4"
                                    />
                                    <path d="M 49 11 L 56 16 L 49 16 Z" className="fill-sky-100" opacity="0.9" />

                                    {/* Headlights Beaming Light Cone */}
                                    <polygon
                                      points="60,19 68,16 68,23"
                                      className={isDelayed ? 'fill-red-300 animate-pulse' : 'fill-amber-300/80'}
                                    />

                                    {/* Wheels with motion rims */}
                                    <circle
                                      cx="10"
                                      cy="26"
                                      r="4.5"
                                      className="fill-slate-950 stroke-slate-300"
                                      strokeWidth="1.2"
                                    />
                                    <circle
                                      cx="23"
                                      cy="26"
                                      r="4.5"
                                      className="fill-slate-950 stroke-slate-300"
                                      strokeWidth="1.2"
                                    />
                                    <circle
                                      cx="51"
                                      cy="26"
                                      r="5"
                                      className="fill-slate-950 stroke-slate-300"
                                      strokeWidth="1.2"
                                    />
                                  </svg>

                                  <div className="text-[10px] font-mono leading-none pr-1">
                                    <div className="font-black text-white">{t.muelleReg.tt}</div>
                                    <div className="text-[9px] text-slate-200 opacity-90">{t.muelleReg.bolsones}b</div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Truck Footer Info */}
                            <div className="flex justify-between items-center text-[11px] pt-1.5 mt-1 font-medium">
                              <span className="text-slate-300">
                                Unidad: <strong className="text-white font-mono font-bold">{t.muelleReg.tt}</strong> • Carga: <strong className="text-cyan-300">{t.muelleReg.productos}</strong> ({t.muelleReg.bolsones} bolsones)
                              </span>
                              {isDelayed ? (
                                <span className="text-red-300 font-black animate-pulse flex items-center gap-1 bg-red-950/80 px-2 py-0.5 rounded-lg border border-red-500">
                                  <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                                  <span>🚨 TIEMPO MÁXIMO SUPERADO: {t.elapsedMins}m {t.elapsedSecs % 60}s en ruta (Sirena Activa)</span>
                                </span>
                              ) : (
                                <span className="text-emerald-400 font-bold">
                                  ✓ En tránsito normal ({t.elapsedMins}m {t.elapsedSecs % 60}s)
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* LIVE MOVEMENTS TABLE */}
            <div className="bg-slate-900 rounded-2xl border-2 border-slate-800 overflow-hidden shadow-lg">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <ListOrdered className="w-4 h-4 text-cyan-400" />
                    <span>Últimos Movimientos Registrados</span>
                  </h3>
                  <span className="text-xs bg-slate-800 text-cyan-300 border border-slate-700 px-2.5 py-0.5 rounded-lg font-bold">
                    {filteredDash.length} registros
                  </span>
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                    <span>Más recientes arriba</span>
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Station filter pills */}
                  <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                    {(['todos', 'muelle', 'labarthe', 'despacho'] as const).map((pst) => (
                      <button
                        key={pst}
                        type="button"
                        onClick={() => setDashPuestoFilter(pst)}
                        className={`px-2.5 py-1 rounded-lg font-bold uppercase text-[10px] transition-all cursor-pointer ${
                          dashPuestoFilter === pst
                            ? 'bg-cyan-500 text-slate-950 shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {pst}
                      </button>
                    ))}
                  </div>

                  {/* Limit selector */}
                  <select
                    value={dashLimit}
                    onChange={(e) => setDashLimit(Number(e.target.value))}
                    className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-2.5 py-1.5 font-bold focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value={25}>25 filas</option>
                    <option value={50}>50 filas</option>
                    <option value={100}>100 filas</option>
                    <option value={0}>Todas</option>
                  </select>

                  {/* Search box */}
                  <div className="relative min-w-[200px]">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Filtrar TT, placa, producto..."
                      value={dashFilter}
                      onChange={(e) => setDashFilter(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>

              {/* Contained scroll area with sticky header so column labels stay visible */}
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-left text-xs relative">
                  <thead className="bg-slate-950/95 backdrop-blur-md text-slate-400 uppercase text-[10px] font-black tracking-wider border-b border-slate-800 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="py-3 px-4">ID Viaje</th>
                      <th className="py-3 px-4">Puesto</th>
                      <th className="py-3 px-4">TT / Placa</th>
                      <th className="py-3 px-4">Bolsones</th>
                      <th className="py-3 px-4">Producto</th>
                      <th className="py-3 px-4">Fecha / Hora</th>
                      <th className="py-3 px-4">Nave</th>
                      <th className="py-3 px-4">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-medium">
                    {filteredDash.map((r) => {
                      const isMuelle = r.puesto === 'muelle';
                      const isLabarthe = r.puesto === 'labarthe';

                      return (
                        <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-300">{r.viajeId}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                isMuelle
                                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                                  : isLabarthe
                                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              }`}
                            >
                              {r.puesto}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={() => setSelectedTTFicha(r.tt)}
                              className="font-black text-cyan-400 hover:underline cursor-pointer"
                            >
                              {r.tt}
                            </button>
                            {r.conductor && r.conductor !== '—' && (
                              <div className="text-[10px] text-slate-500">👤 {r.conductor}</div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-black text-white text-sm">{r.bolsones}</div>
                            {r.itemsProductos && r.itemsProductos.length >= 2 && (
                              <span className="inline-block text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase mt-0.5">
                                2 Prod
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            {r.itemsProductos && r.itemsProductos.length >= 2 ? (
                              <div className="space-y-0.5 text-xs">
                                <div className="text-cyan-300">
                                  1. {r.itemsProductos[0].producto}: <strong className="text-white">{r.itemsProductos[0].bolsones}</strong>
                                </div>
                                <div className="text-amber-300">
                                  2. {r.itemsProductos[1].producto}: <strong className="text-white">{r.itemsProductos[1].bolsones}</strong>
                                </div>
                              </div>
                            ) : (
                              <span>{r.productos}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-[11px]">{r.fechaHora}</td>
                          <td className="py-3 px-4 text-slate-400 text-[11px] truncate max-w-[120px]">
                            {r.buqueNombre}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              {r.fotos && r.fotos.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEvidencePhotos({
                                      title: `Evidencias: ${r.viajeId} (${r.tt})`,
                                      photos: r.fotos,
                                    })
                                  }
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700"
                                  title="Ver fotos"
                                >
                                  <ImageIcon className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingRecord(r);
                                  setEditBolsones(r.bolsones);
                                  setEditProducto(r.productos);
                                  setEditDni('');
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700"
                                title="Corregir registro con DNI"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: KPIS & ANALYTICS - FUTURISTIC DASHBOARD */}
        {activeTab === 'kpis' && (
          <PphAnalyticsDashboard
            buque={currentBuque}
            muelleTurno={muelleTurno}
            labartheTurno={labartheTurno}
            despachoTurno={despachoTurno}
            vesselRegistros={vesselRegistros}
            pphDescarga={pphDescarga}
            discrepanciesCount={discrepanciesCount}
            onSelectTT={setSelectedTTFicha}
          />
        )}

        {/* TAB 3: DESCARGA (MUELLE VS LABARTHE) */}
        {activeTab === 'descarga' && (
          <div className="space-y-4">
            <div className="flex gap-2 border-b border-slate-800 pb-3">
              {[
                { id: 'comparativo', label: '⚖️ Tabla Comparativa (Muelle vs Labarthe)' },
                { id: 'muelle', label: '🚢 Registros Muelle' },
                { id: 'labarthe', label: '🏭 Registros Labarthe' },
              ].map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setDescargaSubTab(sub.id as any)}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    descargaSubTab === sub.id
                      ? 'bg-cyan-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white bg-slate-900'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            {/* COMPARATIVE TABLE */}
            {descargaSubTab === 'comparativo' && (
              <div className="bg-slate-900 rounded-2xl border-2 border-slate-800 overflow-hidden shadow-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-black tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Terminal Truck</th>
                      <th className="py-3 px-4">Muelle (Carga)</th>
                      <th className="py-3 px-4">Labarthe (Recepción)</th>
                      <th className="py-3 px-4">Diferencia</th>
                      <th className="py-3 px-4">Estado Operativo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-medium">
                    {muelleTurno.map((m) => {
                      const l = labartheTurnoMap.get(m.baseViajeId);
                      const diffBols = l ? m.bolsones - l.bolsones : null;
                      const hasDiff = l && (diffBols !== 0 || m.productos !== l.productos);

                      return (
                        <tr
                          key={m.id}
                          className={`${
                            hasDiff
                              ? 'bg-red-950/40 text-red-200'
                              : !l
                              ? 'bg-amber-950/20 text-slate-300'
                              : 'hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="py-3 px-4 font-black text-cyan-400">{m.tt}</td>
                          <td className="py-3 px-4">
                            <span className="font-black text-white">{m.bolsones}</span> bols • {m.productos}
                            <div className="text-[10px] text-slate-500">{m.fechaHora}</div>
                          </td>
                          <td className="py-3 px-4">
                            {l ? (
                              <>
                                <span className="font-black text-white">{l.bolsones}</span> bols • {l.productos}
                                <div className="text-[10px] text-slate-500">{l.fechaHora}</div>
                              </>
                            ) : (
                              <span className="text-amber-400 font-bold">⏳ En Tránsito...</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-black">
                            {diffBols === null ? (
                              '—'
                            ) : diffBols === 0 ? (
                              <span className="text-emerald-400">0 (Exacto)</span>
                            ) : (
                              <span className="text-red-400">{diffBols} bols</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {hasDiff ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-red-600 text-white">
                                ⚠️ DISCREPANCIA DETECTADA
                              </span>
                            ) : !l ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500 text-slate-950">
                                EN TRÁNSITO
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                ✅ CONFORME
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {descargaSubTab === 'muelle' && (
              <div className="p-4 bg-slate-900 rounded-2xl border-2 border-slate-800">
                <h4 className="font-black text-white mb-2">Registros de Muelle ({muelleTurno.length})</h4>
                <div className="space-y-2">
                  {muelleTurno.map((m) => (
                    <div key={m.id} className="p-3 bg-slate-950 rounded-xl flex justify-between items-center text-xs">
                      <div>
                        <strong className="text-cyan-400">{m.tt}</strong> — {m.bolsones} bolsones ({m.productos})
                      </div>
                      <div className="text-slate-400">{m.fechaHora}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {descargaSubTab === 'labarthe' && (
              <div className="p-4 bg-slate-900 rounded-2xl border-2 border-slate-800">
                <h4 className="font-black text-white mb-2">Registros de Labarthe ({labartheTurno.length})</h4>
                <div className="space-y-2">
                  {labartheTurno.map((l) => (
                    <div key={l.id} className="p-3 bg-slate-950 rounded-xl flex justify-between items-center text-xs">
                      <div>
                        <strong className="text-purple-400">{l.tt}</strong> — {l.bolsones} bolsones ({l.productos})
                      </div>
                      <div className="text-slate-400">{l.fechaHora}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: DESPACHO */}
        {activeTab === 'despacho' && (
          <div className="bg-slate-900 rounded-2xl border-2 border-slate-800 overflow-hidden shadow-lg">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                Historial de Despachos ({despachoTurno.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-black border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">ID Despacho</th>
                    <th className="py-3 px-4">Chofer</th>
                    <th className="py-3 px-4">Placa</th>
                    <th className="py-3 px-4">Bolsones</th>
                    <th className="py-3 px-4">Producto</th>
                    <th className="py-3 px-4">Fecha / Hora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-medium">
                  {despachoTurno.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono font-bold text-slate-300">{d.viajeId}</td>
                      <td className="py-3 px-4 font-bold text-white">{d.conductor}</td>
                      <td className="py-3 px-4 font-black text-amber-400">{d.tt}</td>
                      <td className="py-3 px-4 font-black text-white text-sm">{d.bolsones}</td>
                      <td className="py-3 px-4 text-slate-300">{d.productos}</td>
                      <td className="py-3 px-4 text-slate-400">{d.fechaHora}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: SOPORTE Y DIAGNÓSTICO - TELEMETRY & NETWORK RADAR */}
        {activeTab === 'soporte' && (
          <DeviceDiagnosticsDashboard pings={pings} onRefresh={refreshData} />
        )}

        {/* TAB 6: BUSCADOR POR RANGO */}
        {activeTab === 'buscador' && (
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-slate-900 border-2 border-slate-800 space-y-4">
              <h3 className="text-sm font-black text-white uppercase">🔍 Búsqueda de Registros por Rango de Tiempo</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Fecha/Hora Inicial:</label>
                  <input
                    type="datetime-local"
                    value={dateStart}
                    onChange={(e) => setDateStart(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Fecha/Hora Final:</label>
                  <input
                    type="datetime-local"
                    value={dateEnd}
                    onChange={(e) => setDateEnd(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleExecuteSearch}
                  className="py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs cursor-pointer shadow-md"
                >
                  Consultar Rango
                </button>
              </div>
            </div>

            {searchResults.length > 0 && (
              <div className="bg-slate-900 rounded-2xl border-2 border-slate-800 overflow-hidden p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-black text-white text-xs">
                    Resultados encontrados: {searchResults.length}
                  </span>
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar Resultados</span>
                  </button>
                </div>
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {searchResults.map((r) => (
                    <div
                      key={r.id}
                      className="p-3 bg-slate-950 rounded-xl flex justify-between items-center text-xs border border-slate-800"
                    >
                      <div>
                        <strong className="text-cyan-400">{r.tt}</strong> ({r.puesto.toUpperCase()}) — {r.bolsones}{' '}
                        bolsones de {r.productos}
                      </div>
                      <div className="text-slate-400">{r.fechaHora}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL 1: MUTE SIREN WITH DNI / PASSWORD */}
      {showMutePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 border-2 border-red-500/80 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <VolumeX className="w-5 h-5 text-red-400" />
              <span>Desactivar Alarma Sonora</span>
            </h3>
            <p className="text-xs text-slate-300">
              Por protocolo portuario de seguridad, ingrese el <strong>DNI o Clave de Coordinador</strong> para autorizar el silenciado:
            </p>
            <input
              type="password"
              placeholder="Ingrese DNI o Clave..."
              value={muteDni}
              onChange={(e) => setMuteDni(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleExecuteMute();
              }}
              autoFocus
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-center text-lg font-black text-white tracking-widest focus:outline-none focus:border-red-400"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowMutePrompt(false);
                  setMuteDni('');
                }}
                className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteMute}
                className="py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs cursor-pointer shadow-lg shadow-red-600/30 active:scale-95"
              >
                Desactivar Alarma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: AUDITABLE RECORD EDIT */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border-2 border-amber-500/80 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-amber-400" />
              <span>Corrección Auditable de Registro</span>
            </h3>
            <div className="text-xs text-slate-400 space-y-1">
              <div>ID Viaje: <strong className="text-white">{editingRecord.viajeId}</strong></div>
              <div>Unidad / TT: <strong className="text-cyan-400">{editingRecord.tt}</strong></div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Bolsones Corregidos:</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={editBolsones}
                  onChange={(e) => setEditBolsones(parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-black text-lg focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Producto:</label>
                <input
                  type="text"
                  value={editProducto}
                  onChange={(e) => setEditProducto(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-semibold text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-amber-400 block mb-1">🔑 DNI del Coordinador Autorizador:</label>
                <input
                  type="password"
                  placeholder="DNI requerimiento de auditoría..."
                  value={editDni}
                  onChange={(e) => setEditDni(e.target.value)}
                  className="w-full bg-slate-950 border border-amber-500/50 rounded-xl px-4 py-2.5 text-center text-white font-black tracking-widest focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs"
              >
                Guardar Corrección
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: TT OPERATIONS FICHA */}
      {selectedTTFicha && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border-2 border-cyan-500/80 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-cyan-400" />
                <span>Historial de Ciclos: {selectedTTFicha}</span>
              </h3>
              <button
                onClick={() => setSelectedTTFicha(null)}
                className="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto space-y-2 flex-1">
              {vesselRegistros
                .filter((r) => r.tt === selectedTTFicha)
                .map((r) => (
                  <div key={r.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1.5">
                    <div className="flex justify-between font-bold">
                      <span className="text-cyan-400 uppercase font-black">{r.puesto}</span>
                      <span className="text-white font-black">{r.bolsones} bolsones</span>
                    </div>
                    {r.itemsProductos && r.itemsProductos.length >= 2 ? (
                      <div className="p-1.5 rounded bg-slate-900 border border-slate-800 text-[11px] space-y-0.5">
                        <div className="text-cyan-300">1. {r.itemsProductos[0].producto}: <strong>{r.itemsProductos[0].bolsones} bols.</strong></div>
                        <div className="text-amber-300">2. {r.itemsProductos[1].producto}: <strong>{r.itemsProductos[1].bolsones} bols.</strong></div>
                      </div>
                    ) : (
                      <div className="text-slate-300">{r.productos}</div>
                    )}
                    <div className="text-[10px] text-slate-500">{r.fechaHora} • Buque: {r.buqueNombre}</div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: PHOTO EVIDENCE PREVIEW */}
      {evidencePhotos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <div className="bg-slate-900 border-2 border-cyan-500/60 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white">{evidencePhotos.title}</h3>
              <button
                onClick={() => setEvidencePhotos(null)}
                className="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 overflow-y-auto flex-1">
              {evidencePhotos.photos.map((src, idx) => (
                <div key={idx} className="rounded-xl overflow-hidden border border-slate-800 aspect-video bg-black">
                  <img src={src} alt="Evidencia" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: FULL DATA MIGRATION WITH ZIP, EXCEL & PHOTO FOLDERS */}
      {showMigrationModal && currentBuque && (
        <MigrationModal
          isOpen={showMigrationModal}
          onClose={() => setShowMigrationModal(false)}
          activeBuque={currentBuque}
          registros={registros}
          onMigrationComplete={() => {
            confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
            playVictoryFanfare();
            refreshData();
          }}
        />
      )}
    </div>
  );
};
