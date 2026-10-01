import { Buque, Conductor, ItemProductoCarga, Puesto, RegistroViaje, TelemetriaLog, TelemetriaPing, ThemeId } from '../types';
import { getAutoDetectedTheme } from '../utils/themes';

const STORAGE_KEYS = {
  BUQUES: 'iqbf_v2_buques',
  REGISTROS: 'iqbf_v2_registros',
  CONDUCTORES: 'iqbf_v2_conductores',
  THEME_CONFIG: 'iqbf_v2_theme',
  THEME_AUTO: 'iqbf_v2_theme_auto',
  GAS_URL: 'iqbf_v2_gas_url',
  TELEMETRIA_PINGS: 'iqbf_v2_pings',
  TELEMETRIA_LOGS: 'iqbf_v2_logs',
  OFFLINE_QUEUE: 'iqbf_v2_offline_queue',
};

// Broadcast channel for real-time inter-tab & device synchronization
const channel = typeof window !== 'undefined' && 'BroadcastChannel' in window ? new BroadcastChannel('iqbf_realtime_channel') : null;

// Initial Seeds
const DEFAULT_BUQUES: Buque[] = [
  {
    id: 'buque_pacific_01',
    nombre: 'M/N PACIFIC VOYAGER',
    muelle: 'Muelle 5B',
    estado: 'activo',
    fechaArribo: '23/09/2026 06:00',
    productos: [
      { id: 'p1', producto: 'Harina de Trigo', cantidadBuque: 3500 },
      { id: 'p2', producto: 'Azúcar Refinada', cantidadBuque: 2500 },
      { id: 'p3', producto: 'Torta de Soya', cantidadBuque: 4000 },
    ],
  },
  {
    id: 'buque_ocean_02',
    nombre: 'M/N OCEAN PIONEER',
    muelle: 'Muelle 3A',
    estado: 'activo',
    fechaArribo: '23/09/2026 07:30',
    productos: [
      { id: 'p4', producto: 'Trigo Panadero', cantidadBuque: 4500 },
      { id: 'p5', producto: 'Maíz Amarillo', cantidadBuque: 3000 },
      { id: 'p6', producto: 'Fertilizante IQBF', cantidadBuque: 2000 },
    ],
  },
];

const DEFAULT_CONDUCTORES: Conductor[] = [
  { id: 'c1', nombre: 'Carlos Mendoza Ramos', placa: 'AYZ-892' },
  { id: 'c2', nombre: 'Juan Diego Huamán', placa: 'B7X-914' },
  { id: 'c3', nombre: 'Roberto Quispe Flores', placa: 'T8P-441' },
  { id: 'c4', nombre: 'Eduardo Salazar Peña', placa: 'C9L-320' },
  { id: 'c5', nombre: 'Miguel Ángel Vargas', placa: 'W4R-782' },
  { id: 'c6', nombre: 'Víctor Cáceres León', placa: 'F2Q-109' },
  { id: 'c7', nombre: 'Raúl Chávez Paredes', placa: 'D5K-883' },
];

// Helper: Standardized Peruvian Date/Time
export function getStandardDateTime(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const dia = pad(date.getDate());
  const mes = pad(date.getMonth() + 1);
  const anio = date.getFullYear();

  let horas = date.getHours();
  const mins = pad(date.getMinutes());
  const segs = pad(date.getSeconds());
  const ampm = horas >= 12 ? 'p. m.' : 'a. m.';
  horas = horas % 12;
  horas = horas ? horas : 12;

  return `${dia}/${mes}/${anio} ${pad(horas)}:${mins}:${segs} ${ampm}`;
}

export function parseStandardDateTime(str: string): Date | null {
  if (!str) return null;
  try {
    const parts = str.trim().split(/\s+/);
    if (parts.length < 2) return null;
    const dateParts = parts[0].split('/');
    const timeParts = parts[1].split(':');
    let hours = parseInt(timeParts[0], 10);
    const minutes = parseInt(timeParts[1], 10);
    const seconds = parseInt(timeParts[2], 10) || 0;
    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1;
    const year = parseInt(dateParts[2], 10);

    let ampm = '';
    if (parts.length > 2) ampm = parts.slice(2).join(' ').toLowerCase();
    else if (str.toLowerCase().includes('p.')) ampm = 'pm';
    else if (str.toLowerCase().includes('a.')) ampm = 'am';

    if ((ampm.includes('p') || ampm.includes('pm')) && hours < 12) hours += 12;
    if ((ampm.includes('a') || ampm.includes('am')) && hours === 12) hours = 0;

    return new Date(year, month, day, hours, minutes, seconds);
  } catch (e) {
    return null;
  }
}

export function belongsToCurrentShift(fechaHoraStr: string): boolean {
  const recDate = parseStandardDateTime(fechaHoraStr);
  if (!recDate) return false;

  const ahora = new Date();
  const totalMinsAhora = ahora.getHours() * 60 + ahora.getMinutes();
  const startDiurno = 6 * 60 + 50; // 06:50
  const endDiurno = 18 * 60 + 50; // 18:50

  let startShiftDate: Date;
  let endShiftDate: Date;

  if (totalMinsAhora >= startDiurno && totalMinsAhora < endDiurno) {
    startShiftDate = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 6, 50, 0);
    endShiftDate = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 18, 49, 59);
  } else {
    if (totalMinsAhora >= endDiurno) {
      startShiftDate = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 18, 50, 0);
      endShiftDate = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1, 6, 49, 59);
    } else {
      startShiftDate = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - 1, 18, 50, 0);
      endShiftDate = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 6, 49, 59);
    }
  }
  return recDate >= startShiftDate && recDate <= endShiftDate;
}

export function getCurrentShiftLabel(): string {
  const ahora = new Date();
  const mins = ahora.getHours() * 60 + ahora.getMinutes();
  return mins >= 410 && mins < 1130 ? 'TURNO DIURNO (06:50 - 18:50)' : 'TURNO NOCTURNO (18:50 - 06:50)';
}

export function getBaseViajeId(viajeId: string): string {
  if (!viajeId) return '';
  const parts = viajeId.toString().split('_');
  return parts.slice(0, 2).join('_');
}

// IndexedDB configuration for high-capacity storage (supports 10,000+ records and photos per vessel)
const IDB_NAME = 'iqbf_port_db';
const IDB_VERSION = 1;
const IDB_STORE = 'registros_v2';

function openIDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      resolve(null);
      return;
    }
    try {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

// STORAGE ENGINE
class StorageEngine {
  private buques: Buque[] = [];
  private registros: RegistroViaje[] = [];
  private conductores: Conductor[] = [];
  private theme: ThemeId = 'normal';
  private autoTheme = true;
  private pings: TelemetriaPing[] = [];
  private logs: TelemetriaLog[] = [];
  private idempotencyCache = new Set<string>();

  constructor() {
    this.loadFromLocalStorage();
    this.loadFromIndexedDB();
    this.setupBroadcastListener();
  }

  private async loadFromIndexedDB() {
    try {
      const db = await openIDB();
      if (!db) return;
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const idbRecords: RegistroViaje[] = req.result || [];
        const existingIds = new Set(this.registros.map((r) => r.id));
        const existingViajes = new Set(this.registros.map((r) => r.viajeId).filter(Boolean));
        let changed = false;

        idbRecords.forEach((r) => {
          if (!existingIds.has(r.id) && (!r.viajeId || !existingViajes.has(r.viajeId))) {
            this.registros.push(r);
            existingIds.add(r.id);
            if (r.viajeId) existingViajes.add(r.viajeId);
            if (r.idempotencyKey) this.idempotencyCache.add(r.idempotencyKey);
            changed = true;
          }
        });

        if (changed) {
          this.registros.sort((a, b) => b.timestamp - a.timestamp);
          window.dispatchEvent(new CustomEvent('iqbf_data_updated', { detail: { type: 'registros' } }));
        }
      };
    } catch (e) {
      console.warn('Could not read from IndexedDB:', e);
    }
  }

  private async saveToIndexedDB(records: RegistroViaje[]) {
    try {
      const db = await openIDB();
      if (!db) return;
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      records.forEach((r) => store.put(r));
    } catch (e) {
      console.warn('Could not save to IndexedDB:', e);
    }
  }

  private loadFromLocalStorage() {
    try {
      const bData = localStorage.getItem(STORAGE_KEYS.BUQUES);
      let loadedBuques: Buque[] = bData ? JSON.parse(bData) : DEFAULT_BUQUES;
      if (!Array.isArray(loadedBuques) || loadedBuques.length < 2) {
        const existingIds = new Set((loadedBuques || []).map((b) => b.id));
        const merged = [...(loadedBuques || [])];
        DEFAULT_BUQUES.forEach((db) => {
          if (!existingIds.has(db.id)) {
            merged.push(db);
          }
        });
        loadedBuques = merged.length >= 2 ? merged : DEFAULT_BUQUES;
      }
      this.buques = loadedBuques;

      const rData = localStorage.getItem(STORAGE_KEYS.REGISTROS);
      this.registros = rData ? JSON.parse(rData) : [];

      const cData = localStorage.getItem(STORAGE_KEYS.CONDUCTORES);
      this.conductores = cData ? JSON.parse(cData) : DEFAULT_CONDUCTORES;

      const tAuto = localStorage.getItem(STORAGE_KEYS.THEME_AUTO);
      this.autoTheme = tAuto !== 'false';

      if (this.autoTheme) {
        this.theme = getAutoDetectedTheme();
      } else {
        const tData = localStorage.getItem(STORAGE_KEYS.THEME_CONFIG);
        this.theme = (tData as ThemeId) || 'normal';
      }

      // Populate idempotency cache from existing records
      this.registros.forEach((r) => {
        if (r.idempotencyKey) this.idempotencyCache.add(r.idempotencyKey);
      });
    } catch (e) {
      console.error('Error loading storage:', e);
      this.buques = DEFAULT_BUQUES;
      this.conductores = DEFAULT_CONDUCTORES;
      this.registros = [];
    }
  }

  private saveBuques() {
    localStorage.setItem(STORAGE_KEYS.BUQUES, JSON.stringify(this.buques));
    this.broadcast({ type: 'SYNC_BUQUES', payload: this.buques });
  }

  private saveRegistros() {
    try {
      localStorage.setItem(STORAGE_KEYS.REGISTROS, JSON.stringify(this.registros));
    } catch (quotaErr) {
      console.warn('LocalStorage limit reached. Saving lightweight records to localStorage; full records and photos remain preserved in memory and IndexedDB.');
      try {
        const lightweight = this.registros.map((r) => ({
          ...r,
          fotos: (r.fotos || []).slice(0, 1),
        }));
        localStorage.setItem(STORAGE_KEYS.REGISTROS, JSON.stringify(lightweight));
      } catch (err2) {
        console.error('Could not save even lightweight records:', err2);
      }
    }
    this.saveToIndexedDB(this.registros);
    this.broadcast({ type: 'SYNC_REGISTROS', payload: this.registros });
  }

  private saveConductores() {
    localStorage.setItem(STORAGE_KEYS.CONDUCTORES, JSON.stringify(this.conductores));
    this.broadcast({ type: 'SYNC_CONDUCTORES', payload: this.conductores });
  }

  private saveTheme() {
    localStorage.setItem(STORAGE_KEYS.THEME_CONFIG, this.theme);
    localStorage.setItem(STORAGE_KEYS.THEME_AUTO, String(this.autoTheme));
    this.broadcast({ type: 'SYNC_THEME', payload: { theme: this.theme, autoTheme: this.autoTheme } });
  }

  private broadcast(message: any) {
    if (channel) {
      try {
        channel.postMessage(message);
      } catch (e) {}
    }
  }

  private setupBroadcastListener() {
    if (channel) {
      channel.onmessage = (event) => {
        const { type, payload } = event.data || {};
        if (type === 'SYNC_REGISTROS') {
          const incomingList: RegistroViaje[] = Array.isArray(payload) ? payload : [];
          const existingIds = new Set(this.registros.map((r) => r.id));
          const existingViajes = new Set(this.registros.map((r) => r.viajeId).filter(Boolean));
          let changed = false;

          incomingList.forEach((r) => {
            if (!existingIds.has(r.id) && (!r.viajeId || !existingViajes.has(r.viajeId))) {
              this.registros.push(r);
              existingIds.add(r.id);
              if (r.viajeId) existingViajes.add(r.viajeId);
              if (r.idempotencyKey) this.idempotencyCache.add(r.idempotencyKey);
              changed = true;
            }
          });

          if (changed) {
            this.registros.sort((a, b) => b.timestamp - a.timestamp);
            this.saveToIndexedDB(this.registros);
            try {
              localStorage.setItem(STORAGE_KEYS.REGISTROS, JSON.stringify(this.registros));
            } catch (e) {}
            window.dispatchEvent(new CustomEvent('iqbf_data_updated', { detail: { type: 'registros' } }));
          }
        } else if (type === 'SYNC_BUQUES') {
          this.buques = payload;
          window.dispatchEvent(new CustomEvent('iqbf_data_updated', { detail: { type: 'buques' } }));
        } else if (type === 'SYNC_THEME') {
          this.theme = payload.theme;
          this.autoTheme = payload.autoTheme;
          window.dispatchEvent(new CustomEvent('iqbf_data_updated', { detail: { type: 'theme' } }));
        } else if (type === 'SYNC_CONDUCTORES') {
          this.conductores = payload;
          window.dispatchEvent(new CustomEvent('iqbf_data_updated', { detail: { type: 'conductores' } }));
        } else if (type === 'NEW_RECORD_VOICE') {
          window.dispatchEvent(new CustomEvent('iqbf_new_record_voice', { detail: payload }));
        }
      };
    }
  }

  // --- BUQUES ---
  public getBuques(): Buque[] {
    if (!this.buques || this.buques.length < 2) {
      return [...DEFAULT_BUQUES];
    }
    return [...this.buques];
  }

  public getActiveBuques(): Buque[] {
    return this.buques.filter((b) => b.estado === 'activo');
  }

  public getBuqueById(id: string): Buque | undefined {
    return this.buques.find((b) => b.id === id);
  }

  public addBuque(buque: Omit<Buque, 'id'>): Buque {
    const newBuque: Buque = {
      ...buque,
      id: 'buque_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    };
    this.buques.push(newBuque);
    this.saveBuques();
    return newBuque;
  }

  public updateBuque(id: string, updates: Partial<Buque>): boolean {
    const idx = this.buques.findIndex((b) => b.id === id);
    if (idx === -1) return false;
    this.buques[idx] = { ...this.buques[idx], ...updates };
    this.saveBuques();
    return true;
  }

  public archiveBuque(id: string): { success: boolean; archivedRecordsCount: number } {
    const buque = this.buques.find((b) => b.id === id);
    if (!buque) return { success: false, archivedRecordsCount: 0 };

    // Move buque to finalizado
    buque.estado = 'finalizado';
    const recordsToArchive = this.registros.filter((r) => r.buqueId === id);

    // Store in historical archive
    const histKey = `iqbf_historial_${buque.nombre.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
    localStorage.setItem(
      histKey,
      JSON.stringify({
        buque,
        fechaCierre: getStandardDateTime(),
        registros: recordsToArchive,
      })
    );

    // Remove archived records from active stream
    this.registros = this.registros.filter((r) => r.buqueId !== id);
    this.saveBuques();
    this.saveRegistros();

    return { success: true, archivedRecordsCount: recordsToArchive.length };
  }

  // --- ANTIDUPLICATION & REGISTROS ---
  public generateCorrelativo(buqueId: string, puesto: Puesto, tt: string, bolsones: number): string {
    const registrosPuesto = this.registros.filter((r) => r.buqueId === buqueId && r.puesto === puesto);
    const count = registrosPuesto.length + 1;
    const strCorrelativo = String(count).padStart(2, '0');
    let cleanId = tt.replace(/[^a-zA-Z0-9]/g, '');
    if (puesto !== 'despacho' && !cleanId.toUpperCase().startsWith('TT')) {
      cleanId = 'TT' + cleanId;
    }
    return `${strCorrelativo}_${cleanId}_${bolsones}`;
  }

  public addRegistro(input: {
    idempotencyKey: string;
    buqueId: string;
    puesto: Puesto;
    tt: string;
    conductor?: string;
    bolsones: number;
    productos: string;
    itemsProductos?: ItemProductoCarga[];
    fotos: string[];
    viajeIdHeredado?: string;
  }): { success: boolean; registro: RegistroViaje; isDuplicate: boolean } {
    // 1. Strict Idempotency Check by unique client submission key
    if (this.idempotencyCache.has(input.idempotencyKey)) {
      const existing = this.registros.find((r) => r.idempotencyKey === input.idempotencyKey);
      if (existing) {
        return { success: true, registro: existing, isDuplicate: true };
      }
    }

    // 2. High-speed duplicate filter: Normalized TT and short-window anti-spam (searches recent records for 10k performance)
    const now = Date.now();
    const normalizedInputTT = input.tt.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const recentRecordsWindow = this.registros.length > 200 ? this.registros.slice(-200) : this.registros;

    // Check duplicate by matching normalized TT & puesto within 45s window
    const recentDuplicate = recentRecordsWindow.find((r) => {
      const normalizedRTT = r.tt.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const timeDiff = now - r.timestamp;

      // Same vessel, same station, same TT within 45 seconds -> definite double/multi-tap
      if (r.buqueId === input.buqueId && r.puesto === input.puesto && normalizedRTT === normalizedInputTT && timeDiff < 45000) {
        return true;
      }

      // In Labarthe: if the same inherited trip ID was already recorded in LABARTHE in the current shift
      if (
        input.puesto === 'labarthe' &&
        r.puesto === 'labarthe' &&
        input.viajeIdHeredado &&
        r.baseViajeId === getBaseViajeId(input.viajeIdHeredado)
      ) {
        return true;
      }

      return false;
    });

    if (recentDuplicate) {
      return { success: true, registro: recentDuplicate, isDuplicate: true };
    }

    const buque = this.getBuqueById(input.buqueId);
    const buqueNombre = buque ? buque.nombre : 'Buque General';

    // 3. ID Correlativo generation
    let viajeId = '';
    if (input.puesto === 'labarthe' && input.viajeIdHeredado) {
      const parts = input.viajeIdHeredado.split('_');
      parts[2] = String(input.bolsones);
      viajeId = parts.join('_');
    } else {
      viajeId = this.generateCorrelativo(input.buqueId, input.puesto, input.tt, input.bolsones);
    }

    const baseViajeId = getBaseViajeId(viajeId);

    const newRegistro: RegistroViaje = {
      id: 'reg_' + now + '_' + Math.random().toString(36).substring(2, 7),
      idempotencyKey: input.idempotencyKey,
      viajeId,
      baseViajeId,
      buqueId: input.buqueId,
      buqueNombre,
      puesto: input.puesto,
      tt: input.tt,
      conductor: input.conductor || '—',
      bolsones: input.bolsones,
      productos: input.productos,
      itemsProductos: input.itemsProductos && input.itemsProductos.length > 0 ? input.itemsProductos : undefined,
      fechaHora: getStandardDateTime(),
      timestamp: now,
      fotos: input.fotos || [],
    };

    this.registros.push(newRegistro);
    this.idempotencyCache.add(input.idempotencyKey);
    this.saveRegistros();

    // If client is currently offline, enqueue for sync confirmation
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.enqueueOfflineRecord(newRegistro.id);
    }

    // Broadcast voice alert to CCTV across tabs & current window
    this.broadcast({ type: 'NEW_RECORD_VOICE', payload: newRegistro });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('iqbf_new_record_voice', { detail: newRegistro }));
    }

    return { success: true, registro: newRegistro, isDuplicate: false };
  }

  public getRegistros(filter?: { buqueId?: string; puesto?: Puesto; turnoActual?: boolean }): RegistroViaje[] {
    let list = [...this.registros];
    if (filter?.buqueId && filter.buqueId !== 'all') {
      list = list.filter((r) => r.buqueId === filter.buqueId);
    }
    if (filter?.puesto) {
      list = list.filter((r) => r.puesto === filter.puesto);
    }
    if (filter?.turnoActual) {
      list = list.filter((r) => belongsToCurrentShift(r.fechaHora));
    }
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }

  public editRegistro(
    viajeId: string,
    nuevosBolsones: number,
    nuevoProducto: string,
    dniCoordinador: string
  ): { success: boolean; error?: string } {
    const reg = this.registros.find((r) => r.viajeId === viajeId);
    if (!reg) return { success: false, error: 'Registro no encontrado' };

    reg.editadoPor = {
      dni: dniCoordinador,
      fechaHora: getStandardDateTime(),
      bolsonesPrevios: reg.bolsones,
      productoPrevio: reg.productos,
    };
    reg.bolsones = nuevosBolsones;
    reg.productos = nuevoProducto;

    this.saveRegistros();
    return { success: true };
  }

  // --- CONDUCTORES ---
  public getConductores(): Conductor[] {
    return [...this.conductores];
  }

  public addConductor(nombre: string, placa: string): Conductor {
    const newCond: Conductor = {
      id: 'c_' + Date.now(),
      nombre: nombre.trim(),
      placa: placa.trim().toUpperCase(),
    };
    this.conductores.push(newCond);
    this.saveConductores();
    return newCond;
  }

  public deleteConductor(id: string): boolean {
    const idx = this.conductores.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    this.conductores.splice(idx, 1);
    this.saveConductores();
    return true;
  }

  // --- THEMES ---
  public getTheme(): ThemeId {
    if (this.autoTheme) {
      return getAutoDetectedTheme();
    }
    return this.theme;
  }

  public isAutoTheme(): boolean {
    return this.autoTheme;
  }

  public setTheme(theme: ThemeId, auto = false) {
    this.theme = theme;
    this.autoTheme = auto;
    this.saveTheme();
  }

  // --- TELEMETRY ---
  public recordHeartbeat(ping: Omit<TelemetriaPing, 'timestamp'>) {
    const fullPing: TelemetriaPing = { ...ping, timestamp: Date.now() };
    const idx = this.pings.findIndex((p) => p.puesto === ping.puesto);
    if (idx !== -1) {
      this.pings[idx] = fullPing;
    } else {
      this.pings.push(fullPing);
    }
    this.broadcast({ type: 'SYNC_PINGS', payload: this.pings });
  }

  public getHeartbeats(): TelemetriaPing[] {
    return [...this.pings];
  }

  public recordLog(log: Omit<TelemetriaLog, 'id' | 'fechaHora'>) {
    const newLog: TelemetriaLog = {
      ...log,
      id: 'log_' + Date.now(),
      fechaHora: getStandardDateTime(),
    };
    this.logs.unshift(newLog);
    if (this.logs.length > 50) this.logs.pop();
    this.broadcast({ type: 'SYNC_LOGS', payload: this.logs });
  }

  public getLogs(): TelemetriaLog[] {
    return [...this.logs];
  }

  // --- OFFLINE RESILIENCE & QUEUE ---
  public getPendingOfflineCount(): number {
    try {
      const q = localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
      const arr = q ? JSON.parse(q) : [];
      return Array.isArray(arr) ? arr.length : 0;
    } catch {
      return 0;
    }
  }

  public enqueueOfflineRecord(recordId: string) {
    try {
      const q = localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
      const arr: string[] = q ? JSON.parse(q) : [];
      if (!arr.includes(recordId)) {
        arr.push(recordId);
        localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(arr));
      }
    } catch (e) {
      console.warn('Could not enqueue offline record:', e);
    }
  }

  public syncPendingOffline(): { syncedCount: number } {
    try {
      const q = localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
      const arr: string[] = q ? JSON.parse(q) : [];
      if (arr.length === 0) return { syncedCount: 0 };

      // Broadcast all records so all open CCTV or Inspector windows receive current snapshot
      this.broadcast({ type: 'SYNC_REGISTROS', payload: this.registros });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('iqbf_data_updated', { detail: { type: 'registros' } }));
      }

      // Clear the queue
      const count = arr.length;
      localStorage.removeItem(STORAGE_KEYS.OFFLINE_QUEUE);
      return { syncedCount: count };
    } catch {
      return { syncedCount: 0 };
    }
  }
}

export const storage = new StorageEngine();
