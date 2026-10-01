import React, { useState, useEffect, useRef } from 'react';
import { Buque, Puesto, RegistroViaje, Conductor, ThemeConfig, ItemProductoCarga } from '../types';
import { storage, getStandardDateTime, belongsToCurrentShift } from '../services/storageService';
import { playKeypadBeep } from '../services/soundService';
import { FestiveOverlay } from './FestiveOverlay';
import {
  Ship,
  Camera,
  Trash2,
  CheckCircle,
  Clock,
  ArrowLeft,
  Truck,
  Building2,
  Search,
  Wifi,
  WifiOff,
  RotateCw,
  X,
  Plus,
  Package,
  Layers,
  Check,
  ClipboardList,
  AlertTriangle,
  ChevronDown,
  Sun,
  Moon,
  Type,
} from 'lucide-react';

interface InspectorAppProps {
  activeBuque: Buque;
  allBuques: Buque[];
  onChangeBuque: (buqueId: string) => void;
  onOpenBuqueModal: () => void;
  onExit: () => void;
  themeConfig: ThemeConfig;
}

export const InspectorApp: React.FC<InspectorAppProps> = ({
  activeBuque,
  allBuques,
  onChangeBuque,
  onOpenBuqueModal,
  onExit,
  themeConfig,
}) => {
  const [puesto, setPuesto] = useState<Puesto | null>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'historial'>('form');

  // Form states: TT & Station
  const [valTT, setValTT] = useState<string>('');
  const [viajeIdHeredado, setViajeIdHeredado] = useState<string>('');

  // Multi-Product states: Product 1
  const [prod1, setProd1] = useState<string>(activeBuque.productos[0]?.producto || '');
  const [bols1, setBols1] = useState<number>(0);

  // Multi-Product states: Product 2 (optional via "+")
  const [hasSecondProduct, setHasSecondProduct] = useState<boolean>(false);
  const [prod2, setProd2] = useState<string>(
    activeBuque.productos[1]?.producto || activeBuque.productos[0]?.producto || ''
  );
  const [bols2, setBols2] = useState<number>(0);

  // Currently focused product slot for the numeric keypad (1 or 2)
  const [activeProductSlot, setActiveProductSlot] = useState<1 | 2>(1);

  // Fotos
  const [fotos, setFotos] = useState<string[]>([]);

  // Despacho specific
  const [conductores, setConductores] = useState<Conductor[]>([]);
  const [searchConductor, setSearchConductor] = useState<string>('');
  const [searchPlaca, setSearchPlaca] = useState<string>('');
  const [conductorSeleccionado, setConductorSeleccionado] = useState<string>('');
  const [placaSeleccionada, setPlacaSeleccionada] = useState<string>('');

  // Submitting & Feedback
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [labartheDiscrepancyAlert, setLabartheDiscrepancyAlert] = useState<{
    viajeId: string;
    tt: string;
    muelleBols: number;
    labartheBols: number;
    diff: number;
  } | null>(null);
  const [filtroPuestoHistorial, setFiltroPuestoHistorial] = useState<'todos' | 'muelle' | 'labarthe' | 'despacho'>('todos');
  const [visibleCount, setVisibleCount] = useState<number>(50);
  const [toastMessage, setToastMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [registrosRecientes, setRegistrosRecientes] = useState<RegistroViaje[]>([]);

  // Shift countdown
  const [shiftCountdown, setShiftCountdown] = useState<string>('');
  const [isShiftEnding, setIsShiftEnding] = useState<boolean>(false);

  // Offline status & Network Resilience
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(storage.getPendingOfflineCount());

  // High-Contrast Day/Night Mode for Senior Inspectors (☀️ Diurno / 🌙 Nocturno)
  const [displayMode, setDisplayMode] = useState<'diurno' | 'nocturno'>(() => {
    try {
      const saved = localStorage.getItem('iqbf_inspector_display_mode');
      if (saved === 'diurno' || saved === 'nocturno') return saved;
      // Auto-detect based on current shift (06:50 - 18:50 is daytime)
      const ahora = new Date();
      const mins = ahora.getHours() * 60 + ahora.getMinutes();
      return mins >= 410 && mins < 1130 ? 'diurno' : 'nocturno';
    } catch {
      return 'diurno';
    }
  });

  // Large Font mode for senior inspectors / reading glasses
  const [largeFont, setLargeFont] = useState<boolean>(() => {
    try {
      return localStorage.getItem('iqbf_inspector_large_font') === 'true';
    } catch {
      return false;
    }
  });

  const toggleDisplayMode = () => {
    const nextMode = displayMode === 'diurno' ? 'nocturno' : 'diurno';
    setDisplayMode(nextMode);
    try {
      localStorage.setItem('iqbf_inspector_display_mode', nextMode);
    } catch {}
    setToastMessage({
      text:
        nextMode === 'diurno'
          ? '☀️ Modo Diurno activado: Fondo claro de alta visibilidad para luz solar.'
          : '🌙 Modo Nocturno activado: Fondo oscuro para descanso visual y turno de noche.',
    });
  };

  const toggleLargeFont = () => {
    const nextVal = !largeFont;
    setLargeFont(nextVal);
    try {
      localStorage.setItem('iqbf_inspector_large_font', String(nextVal));
    } catch {}
    setToastMessage({
      text: nextVal ? '🔤 Texto Extra Grande activado para personas mayores.' : '🔤 Texto normal activado.',
    });
  };

  const isDiurno = displayMode === 'diurno';

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastSubmitTimeRef = useRef<number>(0);

  // Total bolsones sum
  const totalBolsones = hasSecondProduct ? bols1 + bols2 : bols1;

  // Load records and conductors
  const reloadData = () => {
    setRegistrosRecientes(storage.getRegistros({ buqueId: activeBuque.id, turnoActual: true }));
    setConductores(storage.getConductores());
    setOfflineQueueCount(storage.getPendingOfflineCount());
  };

  useEffect(() => {
    reloadData();
    const handleUpdate = () => reloadData();
    window.addEventListener('iqbf_data_updated', handleUpdate);

    const handleOnline = () => {
      setIsOnline(true);
      const syncRes = storage.syncPendingOffline();
      const pending = storage.getPendingOfflineCount();
      setOfflineQueueCount(pending);
      if (syncRes.syncedCount > 0) {
        setToastMessage({
          text: `🟢 Conexión restablecida: ${syncRes.syncedCount} registro(s) sincronizados con Centro de Control CCTV.`,
        });
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setOfflineQueueCount(storage.getPendingOfflineCount());
      setToastMessage({
        text: '📡 Señal de red interrumpida. Modo Offline activo: los registros se guardan en el celular sin duplicados.',
        isError: true,
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Heartbeat & connection check every 15 seconds
    const heartbeatInterval = setInterval(() => {
      const currentlyOnline = navigator.onLine;
      setIsOnline(currentlyOnline);
      const pending = storage.getPendingOfflineCount();
      setOfflineQueueCount(pending);

      storage.recordHeartbeat({
        puesto: puesto ? `Inspector ${puesto.toUpperCase()}` : 'Inspector en Selección',
        inspectorNombre: 'Inspector Guardia',
        fechaHora: getStandardDateTime(),
        buqueId: activeBuque.id,
        estadoRed: currentlyOnline ? 'online' : 'offline',
        pendientesCola: pending,
      });
    }, 15000);

    return () => {
      window.removeEventListener('iqbf_data_updated', handleUpdate);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(heartbeatInterval);
    };
  }, [activeBuque.id, puesto, offlineQueueCount]);

  // Sync products when buque changes
  useEffect(() => {
    if (activeBuque.productos.length > 0) {
      if (!prod1) setProd1(activeBuque.productos[0].producto);
      if (!prod2) setProd2(activeBuque.productos[1]?.producto || activeBuque.productos[0].producto);
    }
  }, [activeBuque]);

  // Shift countdown timer (06:50 / 18:50)
  useEffect(() => {
    const timer = setInterval(() => {
      const ahora = new Date();
      const mins = ahora.getHours() * 60 + ahora.getMinutes();
      const startDiurno = 410; // 06:50
      const endDiurno = 1130; // 18:50

      let targetDate = new Date(ahora);
      if (mins >= startDiurno && mins < endDiurno) {
        targetDate.setHours(18, 50, 0, 0);
      } else {
        if (mins >= endDiurno) {
          targetDate.setDate(targetDate.getDate() + 1);
          targetDate.setHours(6, 50, 0, 0);
        } else {
          targetDate.setHours(6, 50, 0, 0);
        }
      }

      const diffSecs = Math.floor((targetDate.getTime() - ahora.getTime()) / 1000);
      if (diffSecs <= 300 && diffSecs > 0) {
        setIsShiftEnding(true);
        const m = Math.floor(diffSecs / 60);
        const s = diffSecs % 60;
        setShiftCountdown(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
      } else {
        setIsShiftEnding(false);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const showToast = (text: string, isError = false) => {
    setToastMessage({ text, isError });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // TT Keypad handlers
  const handleTTKey = (key: string) => {
    playKeypadBeep(700, 0.04);
    if (key === 'C') setValTT('');
    else if (key === '⌫') setValTT((prev) => prev.slice(0, -1));
    else if (valTT.length < 3) setValTT((prev) => prev + key);
  };

  // Set direct quantity for Product 1 or 2 (1-tap presets)
  const setDirectBols = (slot: 1 | 2, amount: number) => {
    playKeypadBeep(750, 0.03);
    setActiveProductSlot(slot);
    if (slot === 1) {
      const other = hasSecondProduct ? bols2 : 0;
      const target = Math.max(0, Math.min(30 - other, amount));
      setBols1(target);
    } else {
      const other = bols1;
      const target = Math.max(0, Math.min(30 - other, amount));
      setBols2(target);
    }
  };

  // Bolsones Keypad handler (targets specified slot or activeProductSlot)
  const handleBolsKey = (key: string, slotOverride?: 1 | 2) => {
    playKeypadBeep(650, 0.04);
    const slot = slotOverride || activeProductSlot;
    if (slotOverride && slotOverride !== activeProductSlot) {
      setActiveProductSlot(slotOverride);
    }
    const currentVal = slot === 1 ? bols1 : bols2;
    let str = currentVal === 0 ? '' : String(currentVal);

    if (key === 'C') {
      if (slot === 1) setBols1(0);
      else setBols2(0);
    } else if (key === '⌫') {
      str = str.slice(0, -1);
      const next = str === '' ? 0 : parseInt(str, 10);
      if (slot === 1) setBols1(next);
      else setBols2(next);
    } else if (str.length < 2) {
      const next = parseInt(str + key, 10);
      const otherVal = slot === 1 ? (hasSecondProduct ? bols2 : 0) : bols1;
      if (next + otherVal > 30) {
        showToast('⚠️ Capacidad máxima del TT: 30 bolsones totales', true);
        const maxAllowed = Math.max(0, 30 - otherVal);
        if (slot === 1) setBols1(maxAllowed);
        else setBols2(maxAllowed);
      } else {
        if (slot === 1) setBols1(next);
        else setBols2(next);
      }
    }
  };

  // Fast photo capture with client-side canvas compression
  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 500;
        let w = img.width;
        let h = img.height;
        if (w > h && w > MAX_SIZE) {
          h = Math.round((h * MAX_SIZE) / w);
          w = MAX_SIZE;
        } else if (h > MAX_SIZE) {
          w = Math.round((w * MAX_SIZE) / h);
          h = MAX_SIZE;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.42);
          setFotos((prev) => [...prev, compressedBase64]);
        }
      };
    };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = '';
  };

  const removePhoto = (index: number) => {
    setFotos((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Reset form
  const resetForm = () => {
    setValTT('');
    setProd1(activeBuque.productos[0]?.producto || '');
    setBols1(0);
    setHasSecondProduct(false);
    setProd2(activeBuque.productos[1]?.producto || activeBuque.productos[0]?.producto || '');
    setBols2(0);
    setActiveProductSlot(1);
    setFotos([]);
    setViajeIdHeredado('');
    setConductorSeleccionado('');
    setPlacaSeleccionada('');
    setSearchConductor('');
    setSearchPlaca('');
  };

  const handleEnterPuesto = (p: Puesto) => {
    setPuesto(p);
    resetForm();
    if (activeBuque.productos.length > 0) {
      setProd1(activeBuque.productos[0].producto);
      setProd2(activeBuque.productos[1]?.producto || activeBuque.productos[0].producto);
    }
  };

  // Labarthe: Detect trucks in transit from Muelle for this vessel
  const muelleRecords = registrosRecientes.filter((r) => r.puesto === 'muelle');
  const labartheRecords = registrosRecientes.filter((r) => r.puesto === 'labarthe');
  const labartheBases = new Set(labartheRecords.map((l) => l.baseViajeId));

  const trucksInTransit = muelleRecords.filter((m) => !labartheBases.has(m.baseViajeId));

  // Labarthe: Selecting a truck in transit loads the TT and products, but leaves quantities at 0 (empty)
  // to force the Labarthe inspector to physically recount the bolsones (blind double-check)
  const handleSelectTransitTruck = (truck: RegistroViaje) => {
    setViajeIdHeredado(truck.viajeId);
    const cleanNumber = truck.tt.replace('TT-', '');
    setValTT(cleanNumber);

    // If registered with itemized products
    if (truck.itemsProductos && truck.itemsProductos.length >= 2) {
      setHasSecondProduct(true);
      setProd1(truck.itemsProductos[0].producto);
      setBols1(0); // VACÍO: obliga a Labarthe a contar físicamente
      setProd2(truck.itemsProductos[1].producto);
      setBols2(0); // VACÍO: obliga a Labarthe a contar físicamente
      setActiveProductSlot(1);
    } else if (truck.itemsProductos && truck.itemsProductos.length === 1) {
      setHasSecondProduct(false);
      setProd1(truck.itemsProductos[0].producto);
      setBols1(0); // VACÍO: obliga a Labarthe a contar físicamente
      setBols2(0);
      setActiveProductSlot(1);
    } else {
      // Check if string contains "+" (mixed products)
      if (truck.productos.includes('+')) {
        const parts = truck.productos.split('+').map((p) => p.trim());
        setHasSecondProduct(true);
        const parsePart = (part: string) => {
          const match = part.match(/^(.*?)\s*\((\d+)\)$/);
          if (match) return { name: match[1] };
          return { name: part };
        };
        const p1 = parsePart(parts[0]);
        const p2 = parsePart(parts[1]);
        setProd1(p1.name);
        setBols1(0); // VACÍO
        setProd2(p2.name);
        setBols2(0); // VACÍO
      } else {
        setHasSecondProduct(false);
        setProd1(truck.productos);
        setBols1(0); // VACÍO
        setBols2(0);
      }
      setActiveProductSlot(1);
    }

    showToast(`🚛 TT-${cleanNumber} seleccionada. Cuente físicamente los bolsones recibidos en balanza.`);
  };

  // Validate before confirmation
  const validateForm = () => {
    if (!puesto) return false;
    if (puesto === 'despacho') {
      if (!conductorSeleccionado || !placaSeleccionada) {
        showToast('⚠️ Seleccione Conductor y Placa de camión', true);
        return false;
      }
    } else {
      if (!valTT) {
        showToast('⚠️ Digite o seleccione el número de TT', true);
        return false;
      }
    }

    if (!prod1) {
      showToast('⚠️ Seleccione el Producto 1', true);
      return false;
    }
    if (bols1 <= 0) {
      showToast('⚠️ Ingrese cantidad de bolsones para el Producto 1', true);
      return false;
    }

    if (hasSecondProduct) {
      if (!prod2) {
        showToast('⚠️ Seleccione el Producto 2', true);
        return false;
      }
      if (bols2 <= 0) {
        showToast('⚠️ Ingrese cantidad de bolsones para el Producto 2', true);
        return false;
      }
    }

    const total = bols1 + (hasSecondProduct ? bols2 : 0);
    if (total <= 0 || total > 30) {
      showToast('⚠️ La carga total del TT debe ser entre 1 y 30 bolsones', true);
      return false;
    }

    if (fotos.length < 2) {
      showToast('⚠️ Se requieren mínimo 2 fotos de evidencia fotográfica', true);
      return false;
    }
    return true;
  };

  const openConfirmation = () => {
    if (validateForm()) {
      setShowConfirmModal(true);
    }
  };

  const handleManualSync = () => {
    const res = storage.syncPendingOffline();
    const pending = storage.getPendingOfflineCount();
    setOfflineQueueCount(pending);
    if (res.syncedCount > 0) {
      showToast(`🟢 ${res.syncedCount} registro(s) sincronizados con Centro de Control CCTV.`);
    } else {
      showToast('✅ Base de datos al día. Todos los registros están sincronizados con CCTV.');
    }
  };

  // Execute registration with Anti-Duplication Content-Deterministic Idempotency Key & Debounce Lock
  const handleFinalSubmit = async () => {
    const now = Date.now();
    // 1. Strict double-click prevention lock (2500ms)
    if (!puesto || isSubmitting || now - lastSubmitTimeRef.current < 2500) {
      return;
    }
    lastSubmitTimeRef.current = now;
    setIsSubmitting(true);
    setShowConfirmModal(false);

    const targetTT = puesto === 'despacho' ? placaSeleccionada : `TT-${valTT}`;
    const totalBols = hasSecondProduct ? bols1 + bols2 : bols1;

    // 2. Build content-deterministic idempotency key (bucketed per 45s to avoid duplicate inserts on retry or network lag)
    const timeBucket = Math.floor(now / 45000);
    const cleanUnit = targetTT.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const idempotencyKey = `idemp_${activeBuque.id}_${puesto}_${cleanUnit}_${totalBols}_${timeBucket}`;

    // Structured items & formatted summary string
    const itemsProductos: ItemProductoCarga[] = hasSecondProduct
      ? [
          { producto: prod1, bolsones: bols1 },
          { producto: prod2, bolsones: bols2 },
        ]
      : [{ producto: prod1, bolsones: bols1 }];

    const productosSummary = hasSecondProduct
      ? `${prod1} (${bols1}) + ${prod2} (${bols2})`
      : prod1;

    try {
      const result = storage.addRegistro({
        idempotencyKey,
        buqueId: activeBuque.id,
        puesto,
        tt: targetTT,
        conductor: puesto === 'despacho' ? conductorSeleccionado : undefined,
        bolsones: totalBols,
        productos: productosSummary,
        itemsProductos,
        fotos,
        viajeIdHeredado: puesto === 'labarthe' ? viajeIdHeredado : undefined,
      });

      // Special check for Labarthe:
      // The record has ALREADY been saved. If count does not match Muelle, show emergency alert modal.
      if (puesto === 'labarthe') {
        const truckMuelle = viajeIdHeredado
          ? registrosRecientes.find((r) => r.viajeId === viajeIdHeredado)
          : registrosRecientes.find((r) => r.puesto === 'muelle' && r.tt === targetTT);

        if (truckMuelle && truckMuelle.bolsones !== totalBols) {
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try {
              navigator.vibrate([250, 150, 250, 150, 500]);
            } catch (e) {
              // ignore
            }
          }
          setLabartheDiscrepancyAlert({
            viajeId: result.registro.viajeId,
            tt: targetTT,
            muelleBols: truckMuelle.bolsones,
            labartheBols: totalBols,
            diff: totalBols - truckMuelle.bolsones,
          });
          resetForm();
          return;
        }
      }

      if (result.isDuplicate) {
        showToast(`ℹ️ Unidad ya registrada en este turno (${result.registro.viajeId}). Sin duplicar.`);
      } else {
        showToast(`✅ ¡Registrado Exitoso! ID: ${result.registro.viajeId}`);
      }

      resetForm();
      setPuesto(null); // Return to puestos selection
    } catch (err) {
      showToast('⚠️ Error de red. Registro preservado en cola local segura.', true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered drivers & plates
  const filteredConductores = conductores.filter((c) =>
    c.nombre.toLowerCase().includes(searchConductor.toLowerCase().trim())
  );
  const filteredPlacas = conductores.filter((c) =>
    c.placa.toLowerCase().includes(searchPlaca.toLowerCase().trim())
  );

  // Shift KPIs
  const muelleTotal = registrosRecientes.filter((r) => r.puesto === 'muelle').reduce((a, b) => a + b.bolsones, 0);
  const labartheTotal = registrosRecientes.filter((r) => r.puesto === 'labarthe').reduce((a, b) => a + b.bolsones, 0);
  const despachoTotal = registrosRecientes.filter((r) => r.puesto === 'despacho').reduce((a, b) => a + b.bolsones, 0);

  return (
    <div
      className={`min-h-screen flex flex-col font-sans select-none pb-24 transition-colors duration-200 ${
        isDiurno ? 'bg-slate-100 text-slate-950' : 'bg-slate-950 text-slate-100'
      } ${largeFont ? 'text-base' : 'text-sm'}`}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl shadow-2xl font-black text-sm text-center border animate-in fade-in slide-in-from-top-4 duration-200 ${
            toastMessage.isError
              ? 'bg-red-600 text-white border-red-400'
              : 'bg-emerald-600 text-white border-emerald-400'
          }`}
        >
          {toastMessage.text}
        </div>
      )}

      {/* Offline Alert Banner */}
      {!isOnline && (
        <div className="bg-amber-600 text-slate-950 font-black text-xs sm:text-sm py-2 px-4 text-center border-b-2 border-amber-400 flex items-center justify-center gap-2 sticky top-0 z-40 shadow-md">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>MODO OFFLINE PUERTO: Registros y fotos se guardan en el celular sin duplicar.</span>
          {offlineQueueCount > 0 && (
            <button
              type="button"
              onClick={handleManualSync}
              className="ml-2 px-2.5 py-0.5 rounded-lg bg-slate-950 text-amber-300 border border-amber-300 font-black text-xs cursor-pointer active:scale-95"
            >
              Reintentar ({offlineQueueCount})
            </button>
          )}
        </div>
      )}

      {/* Shift Countdown Banner */}
      {isShiftEnding && (
        <div className="bg-red-600 text-white font-black text-xs sm:text-sm py-2 px-4 text-center border-b-2 border-red-400 flex items-center justify-center gap-2 animate-pulse sticky top-0 z-40 shadow-md">
          <Clock className="w-4 h-4" />
          <span>¡ATENCIÓN! CAMBIO DE TURNO EN: {shiftCountdown}</span>
        </div>
      )}

      {/* Header */}
      <header
        className={`p-3.5 border-b sticky top-0 z-30 shadow-md transition-colors ${
          isDiurno
            ? 'bg-white border-slate-300 text-slate-950'
            : `${themeConfig.headerBorder} ${themeConfig.headerBg} text-white`
        }`}
      >
        <div className="flex items-center justify-between gap-2 max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            {puesto ? (
              <button
                type="button"
                onClick={() => setPuesto(null)}
                className={`p-2 rounded-xl border flex items-center gap-1 text-xs font-black cursor-pointer transition-all active:scale-95 ${
                  isDiurno
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-900 border-slate-400'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-white border-slate-700'
                }`}
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Puestos</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onExit}
                className={`p-2 rounded-xl border text-xs font-black cursor-pointer transition-all active:scale-95 ${
                  isDiurno
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-900 border-slate-400'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
              >
                Portal
              </button>
            )}

            <div className="leading-tight">
              <div
                className={`flex items-center gap-1.5 font-black ${
                  largeFont ? 'text-base' : 'text-sm'
                } ${isDiurno ? 'text-slate-950' : 'text-white'}`}
              >
                <span>{themeConfig.festiveEmoji}</span>
                <span>{puesto ? `PUESTO: ${puesto.toUpperCase()}` : 'IQBF INSPECCIÓN'}</span>
              </div>
              <div
                className={`text-[10px] font-bold flex items-center gap-1 ${
                  isDiurno ? 'text-slate-600' : 'text-cyan-400'
                }`}
              >
                <span>Turno Activo</span>
                <span>•</span>
                <span className={isDiurno ? 'text-emerald-700' : 'text-emerald-400'}>
                  ⚡ Antiduplicados Activo
                </span>
              </div>
            </div>
          </div>

          {/* Active Vessel Badge & Switcher */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenBuqueModal}
              className={`flex items-center gap-2 py-1.5 px-3 rounded-xl border text-left transition-all active:scale-95 shadow-sm cursor-pointer ${
                isDiurno
                  ? 'bg-sky-50 border-sky-600 hover:border-sky-700 text-sky-950'
                  : 'bg-cyan-950/80 border-cyan-500/50 hover:border-cyan-400 text-white'
              }`}
            >
              <Ship className={`w-4 h-4 shrink-0 ${isDiurno ? 'text-sky-700' : 'text-cyan-400'}`} />
              <div className="leading-tight">
                <div
                  className={`text-[9px] uppercase tracking-wider font-black ${
                    isDiurno ? 'text-sky-800' : 'text-cyan-300/80'
                  }`}
                >
                  Nave Asignada:
                </div>
                <div
                  className={`text-xs font-black truncate max-w-[110px] ${
                    isDiurno ? 'text-slate-950' : 'text-white'
                  }`}
                >
                  {activeBuque.nombre}
                </div>
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Floating Shift Totals (Sticky) */}
      <div
        className={`p-2 max-w-lg mx-auto w-full sticky top-[57px] z-20 shadow-md backdrop-blur-md transition-colors ${
          isDiurno ? 'bg-slate-200/95 border-b-2 border-slate-300' : 'bg-slate-900/95 border-b border-slate-800'
        }`}
      >
        <div
          className={`grid grid-cols-3 divide-x text-center ${
            isDiurno ? 'divide-slate-300' : 'divide-slate-800'
          }`}
        >
          <div>
            <div className={`text-[10px] uppercase font-black ${isDiurno ? 'text-sky-800' : 'text-sky-400'}`}>
              Muelle
            </div>
            <div
              className={`text-lg font-black font-mono ${
                isDiurno ? 'text-sky-900' : 'text-sky-400'
              }`}
            >
              {muelleTotal} <span className="text-[10px] font-sans font-bold">bols</span>
            </div>
          </div>
          <div>
            <div
              className={`text-[10px] uppercase font-black ${
                isDiurno ? 'text-purple-800' : 'text-purple-400'
              }`}
            >
              Labarthe
            </div>
            <div
              className={`text-lg font-black font-mono ${
                isDiurno ? 'text-purple-900' : 'text-purple-400'
              }`}
            >
              {labartheTotal} <span className="text-[10px] font-sans font-bold">bols</span>
            </div>
          </div>
          <div>
            <div
              className={`text-[10px] uppercase font-black ${
                isDiurno ? 'text-amber-800' : 'text-amber-400'
              }`}
            >
              Despacho
            </div>
            <div
              className={`text-lg font-black font-mono ${
                isDiurno ? 'text-amber-900' : 'text-amber-400'
              }`}
            >
              {despachoTotal} <span className="text-[10px] font-sans font-bold">bols</span>
            </div>
          </div>
        </div>
      </div>

      {/* BARRA DE ACCESIBILIDAD PARA PERSONAS MAYORES Y RED PORTUARIA */}
      <div
        className={`p-2.5 max-w-lg mx-auto w-full sticky top-[106px] z-20 shadow-md transition-all ${
          isDiurno ? 'bg-white border-b-2 border-slate-300' : 'bg-slate-900 border-b border-slate-800'
        }`}
      >
        <div className="flex items-center justify-between gap-1.5">
          {/* Botón 1: Modo Diurno / Modo Nocturno */}
          <button
            type="button"
            onClick={toggleDisplayMode}
            className={`flex-1 py-2 px-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer border-2 transition-all active:scale-95 shadow-sm ${
              isDiurno
                ? 'bg-amber-100 text-amber-950 border-amber-500 hover:bg-amber-200 ring-2 ring-amber-400/40'
                : 'bg-slate-800 text-amber-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="Cambiar entre fondo claro de sol y fondo oscuro de noche"
          >
            {isDiurno ? (
              <Sun className="w-4 h-4 text-amber-600 shrink-0" />
            ) : (
              <Moon className="w-4 h-4 text-amber-300 shrink-0" />
            )}
            <span className="truncate">{isDiurno ? '☀️ MODO DIURNO (SOL)' : '🌙 MODO NOCTURNO'}</span>
          </button>

          {/* Botón 2: Tamaño de Texto para Personas Mayores con Lentes */}
          <button
            type="button"
            onClick={toggleLargeFont}
            className={`py-2 px-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer border-2 transition-all active:scale-95 shadow-sm ${
              largeFont
                ? 'bg-cyan-500 text-slate-950 border-cyan-300 ring-2 ring-cyan-300'
                : isDiurno
                ? 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="Aumentar tamaño de letras y botones para vista cansada"
          >
            <Type className="w-4 h-4 shrink-0" />
            <span>{largeFont ? '🔤 LETRA EXTRA' : '🔤 LETRA'}</span>
          </button>

          {/* Botón 3: Estado de Red Portuaria & Sincronización Antiduplicados */}
          <button
            type="button"
            onClick={handleManualSync}
            className={`py-2 px-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer border-2 transition-all active:scale-95 shadow-sm ${
              offlineQueueCount > 0
                ? 'bg-amber-500 text-slate-950 border-amber-300 animate-pulse'
                : isOnline
                ? isDiurno
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-400 hover:bg-emerald-200'
                  : 'bg-emerald-950/60 text-emerald-300 border-emerald-600/50 hover:bg-emerald-900/60'
                : 'bg-red-500 text-white border-red-300 animate-bounce'
            }`}
            title="Ver estado de red y sincronizar con Centro de Control CCTV"
          >
            {isOnline ? <Wifi className="w-3.5 h-3.5 shrink-0" /> : <WifiOff className="w-3.5 h-3.5 shrink-0" />}
            <span className="truncate">
              {offlineQueueCount > 0
                ? `🔄 Sinc (${offlineQueueCount})`
                : isOnline
                ? '🟢 Red OK'
                : '📡 Offline'}
            </span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-lg w-full mx-auto p-4">
        {activeTab === 'historial' ? (
          /* HISTORIAL VIEW WITH PUESTO FILTER TABS (MUELLE, LABARTHE, DESPACHOS) */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3
                className={`font-black uppercase tracking-wider flex items-center gap-2 ${
                  largeFont ? 'text-lg' : 'text-base'
                } ${isDiurno ? 'text-slate-950' : 'text-white'}`}
              >
                <ClipboardList className={`w-5 h-5 ${isDiurno ? 'text-sky-700' : 'text-cyan-400'}`} />
                <span>Movimientos del Turno</span>
              </h3>
              <span
                className={`text-xs font-black px-2.5 py-1 rounded-full border ${
                  isDiurno
                    ? 'bg-slate-200 text-slate-900 border-slate-400'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                Total: {registrosRecientes.length}
              </span>
            </div>

            {/* TABS DE SELECCIÓN DE PUESTO (MUELLE, LABARTHE, DESPACHO) - FÁCIL PARA PERSONAS CON LENTES */}
            <div
              className={`grid grid-cols-4 gap-1.5 p-1.5 rounded-2xl border-2 shadow-md ${
                isDiurno ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-800'
              }`}
            >
              <button
                type="button"
                onClick={() => setFiltroPuestoHistorial('todos')}
                className={`py-2.5 px-1 rounded-xl text-xs font-black transition-all cursor-pointer text-center ${
                  filtroPuestoHistorial === 'todos'
                    ? isDiurno
                      ? 'bg-slate-950 text-white shadow-md ring-2 ring-slate-400'
                      : 'bg-cyan-500 text-slate-950 shadow-md ring-2 ring-cyan-300'
                    : isDiurno
                    ? 'text-slate-700 hover:text-slate-950 hover:bg-slate-100'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <div>TODOS</div>
                <div className="text-[10px] font-bold opacity-85">({registrosRecientes.length})</div>
              </button>

              <button
                type="button"
                onClick={() => setFiltroPuestoHistorial('muelle')}
                className={`py-2.5 px-1 rounded-xl text-xs font-black transition-all cursor-pointer text-center ${
                  filtroPuestoHistorial === 'muelle'
                    ? isDiurno
                      ? 'bg-sky-600 text-white shadow-md ring-2 ring-sky-300'
                      : 'bg-sky-500 text-slate-950 shadow-md ring-2 ring-sky-300'
                    : isDiurno
                    ? 'text-sky-800 hover:bg-sky-50'
                    : 'text-sky-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <div>MUELLE</div>
                <div className="text-[10px] font-bold opacity-85">
                  ({registrosRecientes.filter((r) => r.puesto === 'muelle').length})
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFiltroPuestoHistorial('labarthe')}
                className={`py-2.5 px-1 rounded-xl text-xs font-black transition-all cursor-pointer text-center ${
                  filtroPuestoHistorial === 'labarthe'
                    ? isDiurno
                      ? 'bg-purple-600 text-white shadow-md ring-2 ring-purple-300'
                      : 'bg-purple-500 text-slate-950 shadow-md ring-2 ring-purple-300'
                    : isDiurno
                    ? 'text-purple-800 hover:bg-purple-50'
                    : 'text-purple-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <div>LABARTHE</div>
                <div className="text-[10px] font-bold opacity-85">
                  ({registrosRecientes.filter((r) => r.puesto === 'labarthe').length})
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFiltroPuestoHistorial('despacho')}
                className={`py-2.5 px-1 rounded-xl text-xs font-black transition-all cursor-pointer text-center ${
                  filtroPuestoHistorial === 'despacho'
                    ? isDiurno
                      ? 'bg-amber-600 text-white shadow-md ring-2 ring-amber-300'
                      : 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-300'
                    : isDiurno
                    ? 'text-amber-800 hover:bg-amber-50'
                    : 'text-amber-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <div>DESPACHO</div>
                <div className="text-[10px] font-bold opacity-85">
                  ({registrosRecientes.filter((r) => r.puesto === 'despacho').length})
                </div>
              </button>
            </div>

            {/* LISTA DE REGISTROS CON LETRA GRANDE, ALTO CONTRASTE Y DETALLE CLARO */}
            {(() => {
              const filtrados = registrosRecientes.filter((r) => {
                if (filtroPuestoHistorial === 'todos') return true;
                return r.puesto === filtroPuestoHistorial;
              });

              if (filtrados.length === 0) {
                return (
                  <div
                    className={`text-center py-12 p-6 rounded-2xl border-2 font-bold text-sm space-y-2 ${
                      isDiurno
                        ? 'bg-white border-slate-300 text-slate-700'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="text-3xl">📋</div>
                    <div className={isDiurno ? 'text-slate-950 text-base font-black' : 'text-white text-base font-black'}>
                      No hay registros en {filtroPuestoHistorial.toUpperCase()}
                    </div>
                    <p className={isDiurno ? 'text-xs text-slate-600' : 'text-xs text-slate-500'}>
                      Aún no se han completado operaciones en esta estación para {activeBuque.nombre}.
                    </p>
                  </div>
                );
              }

              const displayed = filtrados.slice(0, visibleCount);

              return (
                <div className="space-y-3">
                  {displayed.map((r) => {
                    const puestoCardStyle = isDiurno
                      ? r.puesto === 'muelle'
                        ? 'border-sky-500 bg-sky-50/70 text-slate-950'
                        : r.puesto === 'labarthe'
                        ? 'border-purple-500 bg-purple-50/70 text-slate-950'
                        : 'border-amber-500 bg-amber-50/70 text-slate-950'
                      : r.puesto === 'muelle'
                      ? 'border-sky-500/50 bg-sky-950/20 text-white'
                      : r.puesto === 'labarthe'
                      ? 'border-purple-500/50 bg-purple-950/20 text-white'
                      : 'border-amber-500/50 bg-amber-950/20 text-white';

                    const puestoBadge =
                      r.puesto === 'muelle'
                        ? isDiurno ? 'bg-sky-600 text-white' : 'bg-sky-500 text-slate-950'
                        : r.puesto === 'labarthe'
                        ? isDiurno ? 'bg-purple-600 text-white' : 'bg-purple-500 text-slate-950'
                        : isDiurno ? 'bg-amber-600 text-white' : 'bg-amber-500 text-slate-950';

                    return (
                      <div
                        key={r.id}
                        className={`p-4 rounded-2xl border-2 ${puestoCardStyle} space-y-3 shadow-md`}
                      >
                        {/* Fila 1: Puesto + TT / Placa + Total Bolsones */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase ${puestoBadge}`}>
                              {r.puesto}
                            </span>
                            <span
                              className={`font-mono font-black ${
                                largeFont ? 'text-2xl' : 'text-xl'
                              } ${isDiurno ? 'text-slate-950' : 'text-white'}`}
                            >
                              🚛 {r.tt}
                            </span>
                          </div>
                          <div className="text-right">
                            <span
                              className={`font-black font-mono ${
                                largeFont ? 'text-3xl' : 'text-2xl'
                              } ${isDiurno ? 'text-emerald-700' : 'text-emerald-400'}`}
                            >
                              {r.bolsones}{' '}
                              <span
                                className={`text-xs font-sans font-bold ${
                                  isDiurno ? 'text-emerald-800' : 'text-emerald-300'
                                }`}
                              >
                                bols.
                              </span>
                            </span>
                          </div>
                        </div>

                        {/* Desglose de productos (Caja 1 Cyan, Caja 2 Ámbar) */}
                        {r.itemsProductos && r.itemsProductos.length >= 2 ? (
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div
                              className={`p-2.5 rounded-xl border space-y-0.5 ${
                                isDiurno
                                  ? 'bg-sky-100 border-sky-400 text-sky-950'
                                  : 'bg-cyan-950/70 border-cyan-500/40 text-cyan-100'
                              }`}
                            >
                              <div
                                className={`text-[10px] font-black uppercase ${
                                  isDiurno ? 'text-sky-800' : 'text-cyan-300'
                                }`}
                              >
                                1. {r.itemsProductos[0].producto}
                              </div>
                              <div
                                className={`font-black ${
                                  largeFont ? 'text-lg' : 'text-base'
                                } ${isDiurno ? 'text-slate-950' : 'text-cyan-100'}`}
                              >
                                {r.itemsProductos[0].bolsones} bolsones
                              </div>
                            </div>
                            <div
                              className={`p-2.5 rounded-xl border space-y-0.5 ${
                                isDiurno
                                  ? 'bg-amber-100 border-amber-400 text-amber-950'
                                  : 'bg-amber-950/70 border-amber-500/40 text-amber-100'
                              }`}
                            >
                              <div
                                className={`text-[10px] font-black uppercase ${
                                  isDiurno ? 'text-amber-800' : 'text-amber-300'
                                }`}
                              >
                                2. {r.itemsProductos[1].producto}
                              </div>
                              <div
                                className={`font-black ${
                                  largeFont ? 'text-lg' : 'text-base'
                                } ${isDiurno ? 'text-slate-950' : 'text-amber-100'}`}
                              >
                                {r.itemsProductos[1].bolsones} bolsones
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div
                            className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                              isDiurno
                                ? 'bg-white border-slate-300 text-slate-950'
                                : 'bg-slate-950 border-slate-800 text-white'
                            }`}
                          >
                            <span className={isDiurno ? 'text-slate-800 font-bold text-sm' : 'text-slate-300 font-bold text-sm'}>
                              🧴 {r.productos}
                            </span>
                            <span className="font-black text-sm">{r.bolsones} bolsones</span>
                          </div>
                        )}

                        {/* Conductor en caso de despacho */}
                        {r.conductor && r.conductor !== '—' && (
                          <div
                            className={`text-xs font-semibold p-2 rounded-lg border flex items-center justify-between ${
                              isDiurno
                                ? 'bg-white border-slate-300 text-slate-800'
                                : 'bg-slate-950/80 border-slate-800 text-slate-300'
                            }`}
                          >
                            <span>
                              👤 Conductor:{' '}
                              <strong className={isDiurno ? 'text-slate-950' : 'text-white'}>
                                {r.conductor}
                              </strong>
                            </span>
                            <span className={`font-mono font-bold ${isDiurno ? 'text-amber-700' : 'text-amber-400'}`}>
                              {r.tt}
                            </span>
                          </div>
                        )}

                        {/* Footer con fecha, hora y fotos */}
                        <div
                          className={`text-xs font-mono flex items-center justify-between pt-2 border-t ${
                            isDiurno ? 'border-slate-300 text-slate-600' : 'border-slate-800/80 text-slate-400'
                          }`}
                        >
                          <span
                            className={`font-sans text-xs font-bold ${
                              isDiurno ? 'text-sky-700' : 'text-cyan-400'
                            }`}
                          >
                            📷 {r.fotos ? r.fotos.length : 0} fotos de evidencia
                          </span>
                          <span>{r.fechaHora}</span>
                        </div>
                      </div>
                    );
                  })}

                  {filtrados.length > visibleCount && (
                    <button
                      type="button"
                      onClick={() => setVisibleCount((prev) => prev + 50)}
                      className={`w-full py-3.5 px-4 rounded-2xl border font-black text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-98 transition-all ${
                        isDiurno
                          ? 'bg-white hover:bg-slate-50 border-slate-300 text-slate-950'
                          : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-cyan-300'
                      }`}
                    >
                      <ChevronDown className="w-5 h-5" />
                      <span>Cargar 50 registros más (Mostrando {visibleCount} de {filtrados.length})</span>
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        ) : !puesto ? (
          /* PUESTO SELECTOR SCREEN (with Festive Particle Effects as requested) */
          <div className="space-y-4 pt-2 relative">
            <FestiveOverlay themeConfig={themeConfig} />
            <div className="text-center space-y-1 mb-6">
              <h2 className={`font-black ${largeFont ? 'text-2xl' : 'text-xl'} ${isDiurno ? 'text-slate-950' : 'text-white'}`}>
                Selecciona tu Puesto de Trabajo
              </h2>
              <p className={`text-xs ${isDiurno ? 'text-slate-700 font-bold' : 'text-slate-400'}`}>
                Registra la descarga o salida para <strong className={isDiurno ? 'text-sky-800' : 'text-cyan-400'}>{activeBuque.nombre}</strong>.
              </p>
            </div>

            {/* Muelle */}
            <button
              type="button"
              onClick={() => handleEnterPuesto('muelle')}
              className={`w-full p-5 rounded-2xl border-2 text-left flex items-center gap-4 transition-all active:scale-[0.98] shadow-lg group cursor-pointer ${
                isDiurno
                  ? 'bg-sky-50 hover:bg-sky-100 border-sky-600 hover:border-sky-700 text-slate-950 ring-1 ring-sky-300'
                  : 'bg-gradient-to-r from-sky-950/80 to-slate-900 border-sky-500/40 hover:border-sky-400 text-white'
              }`}
            >
              <div
                className={`p-4 rounded-xl transition-transform group-hover:scale-110 ${
                  isDiurno
                    ? 'bg-sky-600 text-white shadow-md'
                    : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                }`}
              >
                <Ship className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className={`font-black ${largeFont ? 'text-xl' : 'text-lg'} ${isDiurno ? 'text-slate-950' : 'text-white'}`}>
                    1. Muelle (Descarga Inicial)
                  </h3>
                  <span className={`text-xs font-black uppercase px-2 py-0.5 rounded ${isDiurno ? 'bg-sky-200 text-sky-900' : 'text-sky-400'}`}>
                    Origen
                  </span>
                </div>
                <p className={`text-xs mt-1 font-semibold ${isDiurno ? 'text-slate-700' : 'text-slate-400'}`}>
                  Recepción desde buque a Terminal Truck (TT). Soporta 1 o 2 productos por TT.
                </p>
              </div>
            </button>

            {/* Labarthe */}
            <button
              type="button"
              onClick={() => handleEnterPuesto('labarthe')}
              className={`w-full p-5 rounded-2xl border-2 text-left flex items-center gap-4 transition-all active:scale-[0.98] shadow-lg group cursor-pointer ${
                isDiurno
                  ? 'bg-purple-50 hover:bg-purple-100 border-purple-600 hover:border-purple-700 text-slate-950 ring-1 ring-purple-300'
                  : 'bg-gradient-to-r from-purple-950/80 to-slate-900 border-purple-500/40 hover:border-purple-400 text-white'
              }`}
            >
              <div
                className={`p-4 rounded-xl transition-transform group-hover:scale-110 ${
                  isDiurno
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                }`}
              >
                <Building2 className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className={`font-black ${largeFont ? 'text-xl' : 'text-lg'} ${isDiurno ? 'text-slate-950' : 'text-white'}`}>
                    2. Labarthe (Recepción)
                  </h3>
                  {trucksInTransit.length > 0 && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-500 text-slate-950 animate-bounce shadow-md">
                      {trucksInTransit.length} en camino
                    </span>
                  )}
                </div>
                <p className={`text-xs mt-1 font-semibold ${isDiurno ? 'text-slate-700' : 'text-slate-400'}`}>
                  Confirmación de TT. Verifique la cantidad de ambos productos recibidos sin merma.
                </p>
              </div>
            </button>

            {/* Despacho */}
            <button
              type="button"
              onClick={() => handleEnterPuesto('despacho')}
              className={`w-full p-5 rounded-2xl border-2 text-left flex items-center gap-4 transition-all active:scale-[0.98] shadow-lg group cursor-pointer ${
                isDiurno
                  ? 'bg-amber-50 hover:bg-amber-100 border-amber-600 hover:border-amber-700 text-slate-950 ring-1 ring-amber-300'
                  : 'bg-gradient-to-r from-amber-950/80 to-slate-900 border-amber-500/40 hover:border-amber-400 text-white'
              }`}
            >
              <div
                className={`p-4 rounded-xl transition-transform group-hover:scale-110 ${
                  isDiurno
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}
              >
                <Truck className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className={`font-black ${largeFont ? 'text-xl' : 'text-lg'} ${isDiurno ? 'text-slate-950' : 'text-white'}`}>
                    3. Despacho (Salida de Carga)
                  </h3>
                  <span className={`text-xs font-black uppercase px-2 py-0.5 rounded ${isDiurno ? 'bg-amber-200 text-amber-900' : 'text-amber-400'}`}>
                    Destino
                  </span>
                </div>
                <p className={`text-xs mt-1 font-semibold ${isDiurno ? 'text-slate-700' : 'text-slate-400'}`}>
                  Salida de carga en camión externo con Chofer, Placa y soporte multi-producto.
                </p>
              </div>
            </button>
          </div>
        ) : (
          /* FORM VIEW */
          <div className="space-y-4">
            {/* TT SELECTION / KEYPAD */}
            {puesto !== 'despacho' ? (
              <div
                className={`rounded-2xl border-2 p-4 space-y-3 shadow-md ${
                  isDiurno ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                      isDiurno ? 'text-slate-800' : 'text-slate-400'
                    }`}
                  >
                    <Truck className={`w-4 h-4 ${isDiurno ? 'text-sky-700' : 'text-cyan-400'}`} />
                    <span>N° Terminal Truck (TT)</span>
                  </span>
                  {puesto === 'labarthe' && (
                    <span className={`text-[11px] font-black ${isDiurno ? 'text-amber-800' : 'text-amber-400'}`}>
                      {trucksInTransit.length} unidades en tránsito
                    </span>
                  )}
                </div>

                {puesto === 'labarthe' ? (
                  /* Labarthe TT Transit Selection */
                  <div className="space-y-2">
                    <div className={`text-[11px] font-bold ${isDiurno ? 'text-slate-700' : 'text-slate-400'}`}>
                      Seleccione el camión en tránsito de Muelle para confirmar su llegada:
                    </div>
                    {trucksInTransit.length === 0 ? (
                      <div
                        className={`p-4 rounded-xl border text-center text-xs font-bold ${
                          isDiurno
                            ? 'bg-slate-50 border-slate-300 text-slate-600'
                            : 'bg-slate-950 border-slate-800 text-slate-500'
                        }`}
                      >
                        No hay TTs en tránsito registrados desde Muelle en este turno.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
                        {trucksInTransit.map((truck) => {
                          const isSelected = viajeIdHeredado === truck.viajeId;
                          return (
                            <button
                              key={truck.viajeId}
                              type="button"
                              onClick={() => handleSelectTransitTruck(truck)}
                              className={`p-3 rounded-xl border-2 text-left cursor-pointer transition-all ${
                                isSelected
                                  ? isDiurno
                                    ? 'border-purple-600 bg-purple-100 text-slate-950 font-black ring-2 ring-purple-400'
                                    : 'border-purple-400 bg-purple-950/80 text-white font-black ring-2 ring-purple-400/20'
                                  : isDiurno
                                  ? 'border-slate-300 bg-slate-50 text-slate-900 hover:border-purple-400 hover:bg-purple-50/50'
                                  : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className={`font-black text-lg ${isDiurno ? 'text-purple-900' : 'text-cyan-400'}`}>
                                  🚛 {truck.tt}
                                </span>
                                <span
                                  className={`font-bold text-xs px-2.5 py-1 rounded-lg border ${
                                    isDiurno
                                      ? 'bg-purple-200 text-purple-900 border-purple-400'
                                      : 'bg-purple-900/80 text-purple-300 border-purple-500/50'
                                  }`}
                                >
                                  ⏳ Pendiente Conteo
                                </span>
                              </div>
                              <div className={`text-xs mt-1 font-semibold ${isDiurno ? 'text-slate-800' : 'text-slate-200'}`}>
                                {truck.itemsProductos && truck.itemsProductos.length >= 2 ? (
                                  <span className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`font-black ${isDiurno ? 'text-amber-800' : 'text-amber-300'}`}>
                                      📦 Carga Mixta:
                                    </span>
                                    <span
                                      className={`px-2 py-0.5 rounded border ${
                                        isDiurno ? 'bg-white border-slate-300 text-slate-950 font-black' : 'bg-slate-900 border-slate-700 text-white'
                                      }`}
                                    >
                                      {truck.itemsProductos[0].producto}
                                    </span>
                                    <span>+</span>
                                    <span
                                      className={`px-2 py-0.5 rounded border ${
                                        isDiurno ? 'bg-white border-slate-300 text-slate-950 font-black' : 'bg-slate-900 border-slate-700 text-white'
                                      }`}
                                    >
                                      {truck.itemsProductos[1].producto}
                                    </span>
                                  </span>
                                ) : (
                                  <span>
                                    🧴 Producto: <strong className={isDiurno ? 'text-slate-950 font-black' : 'text-white'}>{truck.productos}</strong>
                                  </span>
                                )}
                              </div>
                              <div
                                className={`text-[11px] mt-1 flex items-center justify-between border-t pt-1 ${
                                  isDiurno ? 'border-slate-300 text-slate-600' : 'border-slate-800/80 text-slate-400'
                                }`}
                              >
                                <span>Salida: {truck.fechaHora}</span>
                                <span className={`font-bold ${isDiurno ? 'text-purple-800' : 'text-purple-300'}`}>
                                  👉 Toque para contar bolsones
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Muelle Manual TT Keypad */
                  <div className="space-y-3">
                    <div
                      className={`border-2 rounded-xl p-3 text-center shadow-inner ${
                        isDiurno
                          ? 'bg-sky-50 border-sky-600 text-sky-950'
                          : 'bg-slate-950 border-cyan-500/40 text-cyan-400'
                      }`}
                    >
                      <span className={`font-mono font-black tracking-widest ${largeFont ? 'text-4xl' : 'text-3xl'}`}>
                        TT - {valTT.padEnd(3, '_')}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 max-w-[280px] mx-auto">
                      {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => handleTTKey(k)}
                          className={`rounded-xl font-black transition-all active:scale-90 border shadow-sm cursor-pointer ${
                            largeFont ? 'py-4 text-2xl min-h-[58px]' : 'py-3.5 text-xl'
                          } ${
                            k === 'C'
                              ? isDiurno
                                ? 'bg-red-100 text-red-900 border-red-400 hover:bg-red-200'
                                : 'bg-red-950/50 text-red-400 border-red-500/40'
                              : k === '⌫'
                              ? isDiurno
                                ? 'bg-sky-100 text-sky-950 border-sky-400 hover:bg-sky-200'
                                : 'bg-cyan-950/50 text-cyan-400 border-cyan-500/40'
                              : isDiurno
                              ? 'bg-white text-slate-950 border-slate-400 hover:bg-slate-100 active:bg-cyan-100 font-black'
                              : 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          {k}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* DESPACHO: Driver & License Plate Picker */
              <div
                className={`rounded-2xl border-2 p-4 space-y-4 shadow-md ${
                  isDiurno ? 'bg-white border-slate-300 text-slate-950' : 'bg-slate-900 border-slate-800 text-white'
                }`}
              >
                <span
                  className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                    isDiurno ? 'text-amber-800' : 'text-slate-400'
                  }`}
                >
                  <Truck className="w-4 h-4 text-amber-500" />
                  <span>Datos de Camión Externo (Despacho)</span>
                </span>

                {/* 1. Conductor */}
                <div className="space-y-2">
                  <div
                    className={`flex items-center justify-between text-xs font-black ${
                      isDiurno ? 'text-slate-800' : 'text-slate-300'
                    }`}
                  >
                    <span>1. Seleccionar Chofer:</span>
                    {conductorSeleccionado && (
                      <span className={`font-black ${isDiurno ? 'text-emerald-700' : 'text-emerald-400'}`}>
                        ✓ {conductorSeleccionado}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="🔎 Buscar Chofer por nombre..."
                      value={searchConductor}
                      onChange={(e) => setSearchConductor(e.target.value)}
                      className={`w-full rounded-xl px-3 py-2 text-xs font-bold focus:outline-none ${
                        isDiurno
                          ? 'bg-slate-50 border-2 border-slate-300 text-slate-950 placeholder-slate-500 focus:border-sky-600'
                          : 'bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:border-cyan-500'
                      }`}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto pr-1">
                    {filteredConductores.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setConductorSeleccionado(c.nombre);
                          setPlacaSeleccionada(c.placa);
                        }}
                        className={`p-2.5 rounded-xl border text-left text-xs font-black transition-all flex items-center justify-between cursor-pointer ${
                          conductorSeleccionado === c.nombre
                            ? isDiurno
                              ? 'border-amber-600 bg-amber-100 text-amber-950 ring-2 ring-amber-400'
                              : 'border-amber-400 bg-amber-950/60 text-white'
                            : isDiurno
                            ? 'border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100'
                            : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span>👤 {c.nombre}</span>
                        <span className={`text-[10px] ${isDiurno ? 'text-slate-600' : 'text-slate-400'}`}>
                          Placa: {c.placa}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Placa */}
                <div className={`space-y-2 border-t pt-3 ${isDiurno ? 'border-slate-200' : 'border-slate-800'}`}>
                  <div
                    className={`flex items-center justify-between text-xs font-black ${
                      isDiurno ? 'text-slate-800' : 'text-slate-300'
                    }`}
                  >
                    <span>2. Seleccionar Placa:</span>
                    {placaSeleccionada && (
                      <span className={`font-black ${isDiurno ? 'text-emerald-700' : 'text-emerald-400'}`}>
                        ✓ {placaSeleccionada}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="🔎 Buscar Placa..."
                      value={searchPlaca}
                      onChange={(e) => setSearchPlaca(e.target.value)}
                      className={`w-full rounded-xl px-3 py-2 text-xs font-bold focus:outline-none ${
                        isDiurno
                          ? 'bg-slate-50 border-2 border-slate-300 text-slate-950 placeholder-slate-500 focus:border-sky-600'
                          : 'bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:border-cyan-500'
                      }`}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 max-h-28 overflow-y-auto pr-1">
                    {filteredPlacas.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setPlacaSeleccionada(c.placa)}
                        className={`p-2 rounded-xl border text-center text-xs font-black transition-all cursor-pointer ${
                          placaSeleccionada === c.placa
                            ? isDiurno
                              ? 'border-amber-600 bg-amber-100 text-amber-950 ring-2 ring-amber-400'
                              : 'border-amber-400 bg-amber-950/60 text-white'
                            : isDiurno
                            ? 'border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100'
                            : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        🚛 {c.placa}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 2. PRODUCTO 01 (CAJA COLOR AZUL / CYAN) */}
            <div
              onClick={() => setActiveProductSlot(1)}
              className={`p-4 rounded-2xl border-2 transition-all space-y-3.5 shadow-md ${
                activeProductSlot === 1
                  ? isDiurno
                    ? 'border-sky-600 bg-sky-50 ring-2 ring-sky-400'
                    : 'border-cyan-400 bg-gradient-to-b from-cyan-950/40 via-slate-900 to-slate-950 ring-2 ring-cyan-500/30'
                  : isDiurno
                  ? 'border-slate-300 bg-white hover:border-sky-500'
                  : 'border-cyan-500/40 bg-slate-900/90 hover:border-cyan-400/70'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center ${
                    isDiurno ? 'bg-sky-600 text-white' : 'bg-cyan-500 text-slate-950'
                  }`}>
                    2
                  </span>
                  <span className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                    isDiurno ? 'text-sky-900' : 'text-cyan-300'
                  }`}>
                    <Package className={`w-4 h-4 ${isDiurno ? 'text-sky-700' : 'text-cyan-400'}`} />
                    <span>PRODUCTO 01 (Caja Cyan)</span>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-black px-2.5 py-1 rounded-lg border ${
                    isDiurno
                      ? 'bg-sky-100 text-sky-950 border-sky-400'
                      : 'bg-cyan-950 text-cyan-300 border-cyan-500/50'
                  }`}>
                    {bols1 > 0 ? `${bols1} bolsones` : '0 bols.'}
                  </span>
                </div>
              </div>

              {/* A. Elegir Producto 01 */}
              <div className="space-y-1.5">
                <div className={`text-[11px] font-black flex items-center justify-between ${
                  isDiurno ? 'text-slate-800' : 'text-slate-300'
                }`}>
                  <span>A. Selecciona el Producto 01:</span>
                  {prod1 && <span className={`font-black text-[11px] ${isDiurno ? 'text-sky-800' : 'text-cyan-400'}`}>✓ {prod1}</span>}
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {activeBuque.productos.map((p) => {
                    const isSelected = prod1 === p.producto;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setProd1(p.producto);
                          setActiveProductSlot(1);
                        }}
                        className={`p-2.5 rounded-xl border text-left text-xs font-black flex items-center justify-between transition-all cursor-pointer ${
                          isSelected
                            ? isDiurno
                              ? 'border-sky-600 bg-sky-600 text-white shadow-md ring-2 ring-sky-300'
                              : 'border-cyan-400 bg-cyan-500 text-slate-950 shadow-md ring-2 ring-cyan-400/40'
                            : isDiurno
                            ? 'border-slate-300 bg-slate-50 text-slate-900 hover:bg-slate-100'
                            : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span>{isSelected ? '✓' : '•'}</span>
                          <span>{p.producto}</span>
                        </div>
                        <span className="text-[10px] font-bold opacity-90">
                          Disponible: {p.cantidadBuque} bols.
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* B. Elegir Cantidad Producto 01 */}
              <div className={`space-y-2 border-t pt-3 ${isDiurno ? 'border-sky-200' : 'border-cyan-500/20'}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-black ${isDiurno ? 'text-slate-800' : 'text-slate-300'}`}>
                    B. Cantidad de Bolsones para Producto 01:
                  </span>
                  <span className={`text-xs font-black ${isDiurno ? 'text-sky-800' : 'text-cyan-400'}`}>
                    {prod1 || 'Producto 1'}
                  </span>
                </div>

                {/* Display */}
                <div className={`border-2 rounded-xl p-3 text-center shadow-inner ${
                  isDiurno
                    ? 'bg-white border-sky-600 text-sky-950'
                    : 'bg-slate-950 border-cyan-500/50 text-cyan-300'
                }`}>
                  <span className={`font-mono font-black tracking-widest ${largeFont ? 'text-4xl' : 'text-3xl'}`}>
                    {bols1 > 0 ? bols1 : '0'}{' '}
                    <span className={`text-sm font-sans font-black ${isDiurno ? 'text-slate-600' : 'text-slate-400'}`}>
                      Bolsones
                    </span>
                  </span>
                </div>

                {/* Direct Presets (1 tap) */}
                <div className="space-y-1.5">
                  <span className={`text-xs font-black uppercase tracking-wide ${isDiurno ? 'text-sky-900' : 'text-cyan-300'}`}>
                    Pulsación directa de cantidad:
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {[5, 10, 12, 14, 15, 20, 25, 30].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDirectBols(1, num);
                        }}
                        className={`rounded-xl font-black border transition-all cursor-pointer shadow-sm active:scale-95 ${
                          largeFont ? 'py-3.5 text-base' : 'py-3 text-sm'
                        } ${
                          bols1 === num
                            ? isDiurno
                              ? 'bg-sky-600 text-white border-sky-800 shadow-md ring-2 ring-sky-300 scale-105'
                              : 'bg-cyan-500 text-slate-950 border-cyan-200 shadow-md ring-2 ring-cyan-300 scale-105'
                            : isDiurno
                            ? 'bg-white text-sky-950 border-sky-400 hover:bg-sky-100 hover:border-sky-600'
                            : 'bg-slate-950 text-cyan-300 border-cyan-500/40 hover:border-cyan-400 hover:bg-cyan-950/50'
                        }`}
                      >
                        {num} bols
                      </button>
                    ))}
                  </div>
                </div>

                {/* Direct Keypad for custom numbers */}
                <div className={`pt-2 border-t ${isDiurno ? 'border-sky-200' : 'border-cyan-500/20'}`}>
                  <div className={`text-xs font-black mb-2 text-center ${isDiurno ? 'text-slate-700' : 'text-slate-300'}`}>
                    O digite con teclado numérico:
                  </div>
                  <div className="grid grid-cols-3 gap-2 max-w-[280px] mx-auto">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBolsKey(k, 1);
                        }}
                        className={`rounded-xl font-black transition-all active:scale-90 border shadow-sm cursor-pointer ${
                          largeFont ? 'py-4 text-2xl min-h-[56px]' : 'py-3 rounded-xl text-xl'
                        } ${
                          k === 'C'
                            ? isDiurno
                              ? 'bg-red-100 text-red-900 border-red-500 hover:bg-red-200'
                              : 'bg-red-950/70 text-red-400 border-red-500/50'
                            : k === '⌫'
                            ? isDiurno
                              ? 'bg-sky-100 text-sky-950 border-sky-500 hover:bg-sky-200'
                              : 'bg-cyan-950/70 text-cyan-300 border-cyan-500/50'
                            : isDiurno
                            ? 'bg-white text-slate-950 border-slate-400 hover:bg-slate-100 active:bg-sky-100'
                            : 'bg-slate-950 text-white border-slate-700 hover:border-cyan-400'
                        }`}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. BOTÓN O CAJA PRODUCTO 02 (ÁMBAR / NARANJA DORADO) */}
            {!hasSecondProduct ? (
              <button
                type="button"
                onClick={() => {
                  setHasSecondProduct(true);
                  setActiveProductSlot(2);
                  if (!prod2) {
                    setProd2(activeBuque.productos[1]?.producto || activeBuque.productos[0]?.producto || '');
                  }
                }}
                className={`w-full py-4 px-4 rounded-2xl border-2 border-dashed font-black text-sm flex flex-col items-center justify-center gap-1 cursor-pointer transition-all shadow-md group ${
                  isDiurno
                    ? 'border-amber-600 bg-amber-50 hover:bg-amber-100 text-amber-950'
                    : 'border-amber-500/60 hover:border-amber-400 bg-amber-950/20 hover:bg-amber-950/30 text-amber-300'
                }`}
              >
                <div className={`flex items-center gap-2 group-hover:scale-105 transition-transform ${isDiurno ? 'text-amber-800' : 'text-amber-400'}`}>
                  <Plus className="w-5 h-5" />
                  <span className="text-sm font-black">+ AGREGAR PRODUCTO 02 A ESTA TT (CARGA MIXTA)</span>
                </div>
                <span className={`text-[11px] font-bold text-center ${isDiurno ? 'text-amber-900' : 'text-amber-400/80'}`}>
                  ¿Este camión transporta dos productos diferentes? Pulsa aquí para añadir el 2do producto y cantidad
                </span>
              </button>
            ) : (
              <div
                onClick={() => setActiveProductSlot(2)}
                className={`p-4 rounded-2xl border-2 transition-all space-y-3.5 shadow-md animate-in fade-in slide-in-from-top-2 duration-200 ${
                  activeProductSlot === 2
                    ? isDiurno
                      ? 'border-amber-600 bg-amber-50 ring-2 ring-amber-400'
                      : 'border-amber-400 bg-gradient-to-b from-amber-950/40 via-slate-900 to-slate-950 ring-2 ring-amber-500/30'
                    : isDiurno
                    ? 'border-slate-300 bg-white hover:border-amber-500'
                    : 'border-amber-500/40 bg-slate-900/90 hover:border-amber-400/70'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center ${
                      isDiurno ? 'bg-amber-600 text-white' : 'bg-amber-500 text-slate-950'
                    }`}>
                      3
                    </span>
                    <span className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                      isDiurno ? 'text-amber-900' : 'text-amber-300'
                    }`}>
                      <Layers className={`w-4 h-4 ${isDiurno ? 'text-amber-700' : 'text-amber-400'}`} />
                      <span>PRODUCTO 02 (Caja Ámbar / Carga Mixta)</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-black px-2.5 py-1 rounded-lg border ${
                      isDiurno
                        ? 'bg-amber-100 text-amber-950 border-amber-400'
                        : 'bg-amber-950 text-amber-300 border-amber-500/50'
                    }`}>
                      {bols2 > 0 ? `${bols2} bolsones` : '0 bols.'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setHasSecondProduct(false);
                        setBols2(0);
                        setActiveProductSlot(1);
                      }}
                      className={`p-1.5 rounded-lg border text-xs font-black flex items-center gap-1 cursor-pointer transition-all active:scale-95 ${
                        isDiurno
                          ? 'bg-red-100 text-red-900 border-red-400 hover:bg-red-200'
                          : 'bg-red-950 text-red-400 hover:bg-red-900 border-red-800'
                      }`}
                      title="Eliminar segundo producto"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Quitar</span>
                    </button>
                  </div>
                </div>

                {/* A. Elegir Producto 02 */}
                <div className="space-y-1.5">
                  <div className={`text-[11px] font-black flex items-center justify-between ${
                    isDiurno ? 'text-slate-800' : 'text-slate-300'
                  }`}>
                    <span>A. Selecciona el Producto 02:</span>
                    {prod2 && <span className={`font-black text-[11px] ${isDiurno ? 'text-amber-800' : 'text-amber-400'}`}>✓ {prod2}</span>}
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {activeBuque.productos.map((p) => {
                      const isSelected = prod2 === p.producto;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setProd2(p.producto);
                            setActiveProductSlot(2);
                          }}
                          className={`p-2.5 rounded-xl border text-left text-xs font-black flex items-center justify-between transition-all cursor-pointer ${
                            isSelected
                              ? isDiurno
                                ? 'border-amber-600 bg-amber-600 text-white shadow-md ring-2 ring-amber-300'
                                : 'border-amber-400 bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400/40'
                              : isDiurno
                              ? 'border-slate-300 bg-slate-50 text-slate-900 hover:bg-slate-100'
                              : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span>{isSelected ? '✓' : '•'}</span>
                            <span>{p.producto}</span>
                          </div>
                          <span className="text-[10px] font-bold opacity-90">
                            Disponible: {p.cantidadBuque} bols.
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* B. Elegir Cantidad Producto 02 */}
                <div className={`space-y-2 border-t pt-3 ${isDiurno ? 'border-amber-200' : 'border-amber-500/20'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-black ${isDiurno ? 'text-slate-800' : 'text-slate-300'}`}>
                      B. Cantidad de Bolsones para Producto 02:
                    </span>
                    <span className={`text-xs font-black ${isDiurno ? 'text-amber-800' : 'text-amber-400'}`}>
                      {prod2 || 'Producto 2'}
                    </span>
                  </div>

                  {/* Display */}
                  <div className={`border-2 rounded-xl p-3 text-center shadow-inner ${
                    isDiurno
                      ? 'bg-white border-amber-600 text-amber-950'
                      : 'bg-slate-950 border-amber-500/50 text-amber-300'
                  }`}>
                    <span className={`font-mono font-black tracking-widest ${largeFont ? 'text-4xl' : 'text-3xl'}`}>
                      {bols2 > 0 ? bols2 : '0'}{' '}
                      <span className={`text-sm font-sans font-black ${isDiurno ? 'text-slate-600' : 'text-slate-400'}`}>
                        Bolsones
                      </span>
                    </span>
                  </div>

                  {/* Direct Presets (1 tap) */}
                  <div className="space-y-1.5">
                    <span className={`text-xs font-black uppercase tracking-wide ${isDiurno ? 'text-amber-900' : 'text-amber-300'}`}>
                      Pulsación directa de cantidad:
                    </span>
                    <div className="grid grid-cols-4 gap-2">
                      {[5, 10, 12, 14, 15, 20].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDirectBols(2, num);
                          }}
                          className={`rounded-xl font-black border transition-all cursor-pointer shadow-sm active:scale-95 ${
                            largeFont ? 'py-3.5 text-base' : 'py-3 text-sm'
                          } ${
                            bols2 === num
                              ? isDiurno
                                ? 'bg-amber-600 text-white border-amber-800 shadow-md ring-2 ring-amber-300 scale-105'
                                : 'bg-amber-500 text-slate-950 border-amber-200 shadow-md ring-2 ring-amber-300 scale-105'
                              : isDiurno
                              ? 'bg-white text-amber-950 border-amber-400 hover:bg-amber-100 hover:border-amber-600'
                              : 'bg-slate-950 text-amber-300 border-amber-500/40 hover:border-amber-400 hover:bg-amber-950/50'
                          }`}
                        >
                          {num} bols
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Direct Keypad for custom numbers */}
                  <div className={`pt-2 border-t ${isDiurno ? 'border-amber-200' : 'border-amber-500/20'}`}>
                    <div className={`text-xs font-black mb-2 text-center ${isDiurno ? 'text-slate-700' : 'text-slate-300'}`}>
                      O digite con teclado numérico:
                    </div>
                    <div className="grid grid-cols-3 gap-2 max-w-[280px] mx-auto">
                      {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBolsKey(k, 2);
                          }}
                          className={`rounded-xl font-black transition-all active:scale-90 border shadow-sm cursor-pointer ${
                            largeFont ? 'py-4 text-2xl min-h-[56px]' : 'py-3 rounded-xl text-xl'
                          } ${
                            k === 'C'
                              ? isDiurno
                                ? 'bg-red-100 text-red-900 border-red-500 hover:bg-red-200'
                                : 'bg-red-950/70 text-red-400 border-red-500/50'
                              : k === '⌫'
                              ? isDiurno
                                ? 'bg-amber-100 text-amber-950 border-amber-500 hover:bg-amber-200'
                                : 'bg-amber-950/70 text-amber-300 border-amber-500/50'
                              : isDiurno
                              ? 'bg-white text-slate-950 border-slate-400 hover:bg-slate-100 active:bg-amber-100'
                              : 'bg-slate-950 text-white border-slate-700 hover:border-amber-400'
                          }`}
                        >
                          {k}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. RESUMEN COMPLETO DE LA CARGA EN UNA SOLA LISTA */}
            <div
              className={`rounded-2xl border-2 p-4 space-y-3 shadow-md ${
                isDiurno
                  ? 'bg-emerald-50 border-emerald-600 text-slate-950'
                  : 'bg-slate-900 border-emerald-500/40 text-white shadow-xl'
              }`}
            >
              <div className={`flex items-center justify-between border-b pb-2 ${isDiurno ? 'border-emerald-200' : 'border-slate-800'}`}>
                <div className="flex items-center gap-2">
                  <ClipboardList className={`w-5 h-5 ${isDiurno ? 'text-emerald-700' : 'text-emerald-400'}`} />
                  <span className={`text-xs font-black uppercase tracking-wider ${isDiurno ? 'text-emerald-950' : 'text-white'}`}>
                    📋 RESUMEN DE LA CARGA (En una sola lista)
                  </span>
                </div>
                <span
                  className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${
                    totalBolsones > 0 && totalBolsones <= 30
                      ? isDiurno
                        ? 'bg-emerald-200 text-emerald-950 border-emerald-500'
                        : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : 'bg-red-500/20 text-red-500 border-red-500 animate-pulse'
                  }`}
                >
                  Total: {totalBolsones} / 30 bols.
                </span>
              </div>

              <div className="space-y-2 text-xs">
                {/* Fila 1: Unidad TT */}
                <div
                  className={`flex items-center justify-between p-2.5 rounded-xl border ${
                    isDiurno ? 'bg-white border-slate-300 text-slate-950' : 'bg-slate-950 border-slate-800 text-white'
                  }`}
                >
                  <span className={`font-black flex items-center gap-1.5 ${isDiurno ? 'text-slate-800' : 'text-slate-400'}`}>
                    <Truck className={`w-4 h-4 ${isDiurno ? 'text-sky-700' : 'text-cyan-400'}`} />
                    <span>Unidad / TT:</span>
                  </span>
                  <span className={`font-mono text-sm font-black ${isDiurno ? 'text-slate-950' : 'text-white'}`}>
                    {puesto === 'despacho'
                      ? (placaSeleccionada || '⚠️ Sin placa seleccionada')
                      : (valTT ? `TT-${valTT}` : '⚠️ Sin número de TT')}
                  </span>
                </div>

                {/* Fila 2: Producto 01 */}
                <div
                  className={`flex items-center justify-between p-2.5 rounded-xl border ${
                    isDiurno ? 'bg-sky-100 border-sky-400 text-sky-950' : 'bg-cyan-950/40 border-cyan-500/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-md font-black text-[11px] flex items-center justify-center ${
                      isDiurno ? 'bg-sky-600 text-white' : 'bg-cyan-500 text-slate-950'
                    }`}>
                      1
                    </span>
                    <div className="leading-tight">
                      <div className={`text-[10px] font-black uppercase ${isDiurno ? 'text-sky-800' : 'text-cyan-300'}`}>
                        Producto 01 (Cyan)
                      </div>
                      <div className={`font-black text-xs ${isDiurno ? 'text-slate-950' : 'text-white'}`}>
                        {prod1 || 'Sin asignar'}
                      </div>
                    </div>
                  </div>
                  <span className={`font-black text-sm ${isDiurno ? 'text-sky-900' : 'text-cyan-300'}`}>
                    {bols1} bolsones
                  </span>
                </div>

                {/* Fila 3: Producto 02 si existe */}
                {hasSecondProduct ? (
                  <div
                    className={`flex items-center justify-between p-2.5 rounded-xl border ${
                      isDiurno ? 'bg-amber-100 border-amber-400 text-amber-950' : 'bg-amber-950/40 border-amber-500/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-md font-black text-[11px] flex items-center justify-center ${
                        isDiurno ? 'bg-amber-600 text-white' : 'bg-amber-500 text-slate-950'
                      }`}>
                        2
                      </span>
                      <div className="leading-tight">
                        <div className={`text-[10px] font-black uppercase ${isDiurno ? 'text-amber-800' : 'text-amber-300'}`}>
                          Producto 02 (Ámbar)
                        </div>
                        <div className={`font-black text-xs ${isDiurno ? 'text-slate-950' : 'text-white'}`}>
                          {prod2 || 'Sin asignar'}
                        </div>
                      </div>
                    </div>
                    <span className={`font-black text-sm ${isDiurno ? 'text-amber-900' : 'text-amber-300'}`}>
                      {bols2} bolsones
                    </span>
                  </div>
                ) : (
                  <div
                    className={`p-2 rounded-xl border text-[11px] font-bold text-center ${
                      isDiurno ? 'bg-white border-slate-300 text-slate-700' : 'bg-slate-950/50 border-slate-800 text-slate-400'
                    }`}
                  >
                    <span>Carga Simple (1 solo producto en esta TT). Si lleva 2 productos, use el botón '+' arriba.</span>
                  </div>
                )}

                {/* Fila 4: Total & Status */}
                <div
                  className={`p-2.5 rounded-xl border flex items-center justify-between font-black ${
                    isDiurno ? 'bg-white border-slate-300 text-slate-950' : 'bg-slate-950 border-slate-800 text-white'
                  }`}
                >
                  <span className={isDiurno ? 'text-slate-800' : 'text-slate-300'}>Capacidad Total de la Carga:</span>
                  <div className="text-right">
                    <span className={`font-black text-base ${isDiurno ? 'text-emerald-800' : 'text-emerald-400'}`}>
                      {totalBolsones}
                    </span>
                    <span className={`text-xs ${isDiurno ? 'text-slate-600' : 'text-slate-400'}`}> / 30 bols. máx</span>
                  </div>
                </div>
              </div>
            </div>

            {/* PHOTOS OF EVIDENCE */}
            <div
              className={`rounded-2xl border-2 p-4 space-y-3 shadow-md ${
                isDiurno ? 'bg-white border-slate-300 text-slate-950' : 'bg-slate-900 border-slate-800 text-white shadow-xl'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                    isDiurno ? 'text-slate-800' : 'text-slate-400'
                  }`}
                >
                  <Camera className={`w-4 h-4 ${isDiurno ? 'text-emerald-700' : 'text-emerald-400'}`} />
                  <span>Fotos de Evidencia (Mín 2, Máx 5)</span>
                </span>
                <span
                  className={`text-xs font-black ${
                    fotos.length >= 2
                      ? isDiurno ? 'text-emerald-700' : 'text-emerald-400'
                      : isDiurno ? 'text-red-700' : 'text-red-400'
                  }`}
                >
                  {fotos.length} / 5 capturadas
                </span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoCapture}
                className="hidden"
              />

              <div className="grid grid-cols-3 gap-2">
                {fotos.map((src, idx) => (
                  <div
                    key={idx}
                    className={`relative aspect-square rounded-xl overflow-hidden border-2 ${
                      isDiurno ? 'border-emerald-600 bg-slate-100' : 'border-emerald-500/50 bg-slate-950'
                    }`}
                  >
                    <img src={src} alt="Evidencia" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-red-600 text-white shadow-md cursor-pointer active:scale-95"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <span
                      className={`absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-black ${
                        isDiurno ? 'bg-white/95 text-slate-950 border border-slate-300' : 'bg-slate-950/80 text-slate-300'
                      }`}
                    >
                      Foto {idx + 1}
                    </span>
                  </div>
                ))}

                {fotos.length < 5 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      isDiurno
                        ? 'border-slate-400 bg-slate-50 text-slate-700 hover:border-sky-600 hover:text-sky-700 hover:bg-sky-50'
                        : 'border-slate-700 hover:border-cyan-400 bg-slate-950/60 text-slate-400 hover:text-cyan-400'
                    }`}
                  >
                    <Camera className="w-6 h-6" />
                    <span className="text-[11px] font-black">+ Tomar Foto</span>
                  </button>
                )}
              </div>
            </div>

            {/* ACTION BUTTON */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={openConfirmation}
              className={`w-full py-4 rounded-2xl font-black text-lg shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50 ${
                isDiurno
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-700/30 border-2 border-emerald-700'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 shadow-emerald-500/20'
              } ${largeFont ? 'text-xl py-5' : 'text-lg'}`}
            >
              <CheckCircle className={`${largeFont ? 'w-7 h-7' : 'w-6 h-6'}`} />
              <span>REVISAR Y GUARDAR REGISTRO</span>
            </button>
          </div>
        )}
      </main>

      {/* BOTTOM NAVIGATION BAR */}
      <nav
        className={`fixed bottom-0 left-0 right-0 p-2 z-30 transition-colors ${
          isDiurno
            ? 'bg-white border-t-2 border-slate-300 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]'
            : 'bg-slate-900 border-t border-slate-800'
        }`}
      >
        <div className="max-w-lg mx-auto grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`py-2.5 rounded-xl font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
              largeFont ? 'text-sm' : 'text-xs'
            } ${
              activeTab === 'form'
                ? isDiurno
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'bg-cyan-500 text-slate-950'
                : isDiurno
                ? 'text-slate-700 hover:bg-slate-100'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>✏️</span>
            <span>Registrar</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('historial')}
            className={`py-2.5 rounded-xl font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
              largeFont ? 'text-sm' : 'text-xs'
            } ${
              activeTab === 'historial'
                ? isDiurno
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'bg-cyan-500 text-slate-950'
                : isDiurno
                ? 'text-slate-700 hover:bg-slate-100'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>📋</span>
            <span>Registros Turno ({registrosRecientes.length})</span>
          </button>
        </div>
      </nav>

      {/* CONFIRMATION POPUP MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
          <div
            className={`border-2 rounded-3xl sm:rounded-2xl max-w-md w-full shadow-2xl overflow-hidden p-6 space-y-4 ${
              isDiurno
                ? 'bg-white border-emerald-600 text-slate-950 shadow-2xl'
                : 'bg-slate-900 border-emerald-500/60 text-white shadow-2xl'
            }`}
          >
            <h3
              className={`text-xl font-black text-center ${
                isDiurno ? 'text-slate-950' : 'text-white'
              }`}
            >
              ¿Confirmar Datos de Envío?
            </h3>

            <div
              className={`space-y-2 p-4 rounded-xl border text-sm ${
                isDiurno
                  ? 'bg-slate-50 border-slate-300 text-slate-900'
                  : 'bg-slate-950 border-slate-800 text-slate-100'
              }`}
            >
              <div
                className={`flex justify-between border-b pb-2 ${
                  isDiurno ? 'border-slate-300' : 'border-slate-800/80'
                }`}
              >
                <span className={isDiurno ? 'text-slate-600 font-bold' : 'text-slate-400'}>
                  Buque:
                </span>
                <span className={`font-black ${isDiurno ? 'text-sky-700' : 'text-cyan-400'}`}>
                  {activeBuque.nombre}
                </span>
              </div>
              <div
                className={`flex justify-between border-b py-2 ${
                  isDiurno ? 'border-slate-300' : 'border-slate-800/80'
                }`}
              >
                <span className={isDiurno ? 'text-slate-600 font-bold' : 'text-slate-400'}>
                  Puesto:
                </span>
                <span
                  className={`font-black uppercase ${
                    isDiurno ? 'text-slate-950' : 'text-white'
                  }`}
                >
                  {puesto}
                </span>
              </div>
              <div
                className={`flex justify-between border-b py-2 ${
                  isDiurno ? 'border-slate-300' : 'border-slate-800/80'
                }`}
              >
                <span className={isDiurno ? 'text-slate-600 font-bold' : 'text-slate-400'}>
                  Unidad / TT:
                </span>
                <span
                  className={`font-black ${
                    isDiurno ? 'text-slate-950' : 'text-white'
                  }`}
                >
                  {puesto === 'despacho' ? placaSeleccionada : `TT-${valTT}`}
                </span>
              </div>
              {puesto === 'despacho' && (
                <div
                  className={`flex justify-between border-b py-2 ${
                    isDiurno ? 'border-slate-300' : 'border-slate-800/80'
                  }`}
                >
                  <span className={isDiurno ? 'text-slate-600 font-bold' : 'text-slate-400'}>
                    Chofer:
                  </span>
                  <span
                    className={`font-black ${
                      isDiurno ? 'text-slate-950' : 'text-white'
                    }`}
                  >
                    {conductorSeleccionado}
                  </span>
                </div>
              )}
              <div
                className={`flex justify-between border-b py-2 ${
                  isDiurno ? 'border-slate-300' : 'border-slate-800/80'
                }`}
              >
                <span className={isDiurno ? 'text-slate-600 font-bold' : 'text-slate-400'}>
                  Carga Total TT:
                </span>
                <span
                  className={`font-black text-base ${
                    isDiurno ? 'text-emerald-700' : 'text-emerald-400'
                  }`}
                >
                  {totalBolsones} Bolsones
                </span>
              </div>

              {/* Product itemized summary */}
              <div
                className={`border-b py-2 space-y-1 ${
                  isDiurno ? 'border-slate-300' : 'border-slate-800/80'
                }`}
              >
                <div
                  className={`text-xs font-bold ${
                    isDiurno ? 'text-slate-600' : 'text-slate-400'
                  }`}
                >
                  Detalle de Productos:
                </div>
                <div className="flex justify-between text-xs">
                  <span className={isDiurno ? 'text-slate-800 font-bold' : 'text-slate-200'}>
                    1. {prod1}:
                  </span>
                  <span
                    className={`font-black ${
                      isDiurno ? 'text-sky-700' : 'text-cyan-300'
                    }`}
                  >
                    {bols1} bolsones
                  </span>
                </div>
                {hasSecondProduct && (
                  <div className="flex justify-between text-xs">
                    <span className={isDiurno ? 'text-slate-800 font-bold' : 'text-slate-200'}>
                      2. {prod2}:
                    </span>
                    <span
                      className={`font-black ${
                        isDiurno ? 'text-amber-700' : 'text-amber-300'
                      }`}
                    >
                      {bols2} bolsones
                    </span>
                  </div>
                )}
              </div>

              <div
                className={`flex justify-between pt-2 border-t ${
                  isDiurno ? 'border-slate-300' : 'border-slate-800/80'
                }`}
              >
                <span className={isDiurno ? 'text-slate-600 font-bold' : 'text-slate-400'}>
                  Evidencias:
                </span>
                <span
                  className={`font-black ${
                    isDiurno ? 'text-slate-800' : 'text-slate-300'
                  }`}
                >
                  {fotos.length} fotos adjuntas
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className={`py-3 px-4 rounded-xl font-black text-sm cursor-pointer ${
                  isDiurno
                    ? 'bg-slate-200 hover:bg-slate-300 text-slate-800 border border-slate-300'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                Volver
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleFinalSubmit}
                className={`py-3 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-1.5 shadow-lg cursor-pointer disabled:opacity-50 ${
                  isDiurno
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-700/30'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/25'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <span>Sí, Guardar</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de ALERTA para Labarthe: Conteo no coincide con Muelle (Solo DESPUÉS de guardar) */}
      {labartheDiscrepancyAlert && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            className={`border-4 rounded-3xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 text-center ${
              isDiurno
                ? 'bg-white border-red-600 text-slate-950 shadow-red-200'
                : 'bg-slate-900 border-red-500 text-white shadow-red-950/70'
            }`}
          >
            <div
              className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center mx-auto shadow-lg animate-pulse ${
                isDiurno
                  ? 'bg-red-100 border-red-500 text-red-600 shadow-red-300'
                  : 'bg-red-950/80 border-red-500/80 text-red-400 shadow-red-500/30'
              }`}
            >
              <AlertTriangle className="w-10 h-10" />
            </div>

            <div>
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border mb-2 ${
                  isDiurno
                    ? 'bg-red-100 text-red-800 border-red-400'
                    : 'bg-red-500/20 text-red-400 border-red-500/40'
                }`}
              >
                ⚠️ Discrepancia con Muelle
              </span>
              <h2
                className={`text-lg sm:text-xl font-black uppercase leading-snug ${
                  isDiurno ? 'text-slate-950' : 'text-white'
                }`}
              >
                ¡ALERTA! COMUNICAR AL CENTRO DE CONTROL PARA QUE CORRIJA
              </h2>
            </div>

            <div
              className={`border rounded-2xl p-4 text-left space-y-3 ${
                isDiurno
                  ? 'bg-slate-50 border-red-300'
                  : 'bg-slate-950/90 border-red-500/40'
              }`}
            >
              <p
                className={`text-sm font-black ${
                  isDiurno ? 'text-slate-950' : 'text-slate-200'
                }`}
              >
                Los datos no coinciden con muelle:
              </p>

              <div className="grid grid-cols-2 gap-2 text-center py-1">
                <div
                  className={`border rounded-xl p-3 ${
                    isDiurno
                      ? 'bg-sky-50 border-sky-400 text-slate-950'
                      : 'bg-cyan-950/50 border-cyan-500/40 text-cyan-300'
                  }`}
                >
                  <div
                    className={`text-[10px] uppercase font-black ${
                      isDiurno ? 'text-sky-800' : 'text-cyan-400'
                    }`}
                  >
                    Muelle registró
                  </div>
                  <div
                    className={`text-2xl font-black ${
                      isDiurno ? 'text-sky-900' : 'text-cyan-300'
                    }`}
                  >
                    {labartheDiscrepancyAlert.muelleBols}
                  </div>
                  <div
                    className={`text-[11px] font-bold ${
                      isDiurno ? 'text-sky-700' : 'text-cyan-400/80'
                    }`}
                  >
                    bolsones
                  </div>
                </div>

                <div
                  className={`border rounded-xl p-3 ${
                    isDiurno
                      ? 'bg-amber-50 border-amber-400 text-slate-950'
                      : 'bg-amber-950/50 border-amber-500/40 text-amber-300'
                  }`}
                >
                  <div
                    className={`text-[10px] uppercase font-black ${
                      isDiurno ? 'text-amber-800' : 'text-amber-400'
                    }`}
                  >
                    Tú como Labarthe
                  </div>
                  <div
                    className={`text-2xl font-black ${
                      isDiurno ? 'text-amber-900' : 'text-amber-300'
                    }`}
                  >
                    {labartheDiscrepancyAlert.labartheBols}
                  </div>
                  <div
                    className={`text-[11px] font-bold ${
                      isDiurno ? 'text-amber-700' : 'text-amber-400/80'
                    }`}
                  >
                    bolsones
                  </div>
                </div>
              </div>

              <div
                className={`text-center border rounded-xl py-2 px-3 text-xs font-black ${
                  isDiurno
                    ? 'bg-red-100 border-red-400 text-red-950'
                    : 'bg-red-950/60 border-red-600/40 text-red-200'
                }`}
              >
                Diferencia:{' '}
                <strong
                  className={`text-sm ${
                    isDiurno ? 'text-red-900' : 'text-white'
                  }`}
                >
                  {labartheDiscrepancyAlert.diff > 0
                    ? `+${labartheDiscrepancyAlert.diff}`
                    : labartheDiscrepancyAlert.diff}{' '}
                  bolsones
                </strong>{' '}
                ({labartheDiscrepancyAlert.diff < 0 ? 'Faltante en balanza' : 'Excedente en balanza'})
              </div>

              <div
                className={`rounded-xl p-3 border text-[11px] space-y-1.5 ${
                  isDiurno
                    ? 'bg-white border-slate-300 text-slate-800'
                    : 'bg-slate-900/95 border-slate-800 text-slate-300'
                }`}
              >
                <div
                  className={`flex items-center gap-1.5 font-black ${
                    isDiurno ? 'text-emerald-700' : 'text-emerald-400'
                  }`}
                >
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>Registro guardado en sistema (ID: {labartheDiscrepancyAlert.viajeId})</span>
                </div>
                <p
                  className={`leading-tight font-medium ${
                    isDiurno ? 'text-slate-700' : 'text-slate-400'
                  }`}
                >
                  🔒 Por política de control ciego y seguridad,{' '}
                  <strong className={isDiurno ? 'text-red-700' : 'text-red-300'}>
                    no tienes la opción de corregir los datos
                  </strong>{' '}
                  desde este celular.
                </p>
                <p
                  className={`leading-tight font-bold ${
                    isDiurno ? 'text-amber-800' : 'text-amber-300/90'
                  }`}
                >
                  📢 Comunícate de inmediato con el Centro de Control (CCTV / Supervisor) para reportar la diferencia y que ellos revisen cámaras para autorizar la corrección.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setLabartheDiscrepancyAlert(null);
                setPuesto(null);
              }}
              className="w-full py-3.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-red-600/30 cursor-pointer active:scale-95 transition-all"
            >
              Comprendido (Notificar a Centro de Control)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
