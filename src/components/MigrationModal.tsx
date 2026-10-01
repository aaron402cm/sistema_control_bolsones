import React, { useState } from 'react';
import { Buque, RegistroViaje } from '../types';
import { executeVesselMigration } from '../utils/migrationService';
import { storage } from '../services/storageService';
import {
  Archive,
  Download,
  AlertTriangle,
  CheckCircle,
  FolderArchive,
  FileSpreadsheet,
  Camera,
  X,
  RotateCw,
} from 'lucide-react';

interface MigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeBuque: Buque;
  registros: RegistroViaje[];
  onMigrationComplete?: () => void;
}

export const MigrationModal: React.FC<MigrationModalProps> = ({
  isOpen,
  onClose,
  activeBuque,
  registros,
  onMigrationComplete,
}) => {
  const [typedWord, setTypedWord] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [exportedFilename, setExportedFilename] = useState('');
  const [exportedPhotos, setExportedPhotos] = useState(0);

  if (!isOpen) return null;

  const buqueRegistros = registros.filter((r) => r.buqueId === activeBuque.id);
  const totalMuelle = buqueRegistros
    .filter((r) => r.puesto === 'muelle')
    .reduce((a, b) => a + (b.bolsones || 0), 0);
  const totalLabarthe = buqueRegistros
    .filter((r) => r.puesto === 'labarthe')
    .reduce((a, b) => a + (b.bolsones || 0), 0);
  const totalDespacho = buqueRegistros
    .filter((r) => r.puesto === 'despacho')
    .reduce((a, b) => a + (b.bolsones || 0), 0);

  const totalPhotosCount = buqueRegistros.reduce((acc, r) => acc + (r.fotos ? r.fotos.length : 0), 0);

  const isWordValid = typedWord.trim().toLowerCase() === 'migrar';

  const handleStartMigration = async () => {
    if (!isWordValid || isProcessing) return;

    try {
      setIsProcessing(true);
      setProgressPct(5);
      setStatusMessage('Iniciando proceso de empaquetado...');

      const result = await executeVesselMigration(
        activeBuque,
        buqueRegistros,
        (pct, text) => {
          setProgressPct(pct);
          setStatusMessage(text);
        }
      );

      setExportedFilename(result.filename);
      setExportedPhotos(result.totalPhotos);

      // Archive buque and clean records for this vessel
      storage.archiveBuque(activeBuque.id);

      setIsSuccess(true);
      setIsProcessing(false);
      onMigrationComplete?.();
    } catch (err: any) {
      console.error(err);
      setIsProcessing(false);
      setStatusMessage('Error durante la migración: ' + (err.message || 'Intente nuevamente'));
    }
  };

  const handleCloseAndReset = () => {
    setTypedWord('');
    setIsProcessing(false);
    setIsSuccess(false);
    setProgressPct(0);
    setStatusMessage('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-amber-500/70 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden p-6 sm:p-8 space-y-6 text-slate-100 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
              <FolderArchive className="w-8 h-8" />
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
                Cierre Final de Operación
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">📦 MIGRAR DATOS</h2>
            </div>
          </div>
          {!isProcessing && (
            <button
              type="button"
              onClick={handleCloseAndReset}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {isSuccess ? (
          /* SUCCESS SCREEN */
          <div className="space-y-6 text-center py-4 animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/50 flex items-center justify-center">
              <CheckCircle className="w-12 h-12" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-black text-white">¡Migración Completada con Éxito!</h3>
              <p className="text-sm text-slate-300">
                Se ha generado y descargado el archivo comprimido ZIP con el nombre de la nave{' '}
                <strong className="text-cyan-400">{activeBuque.nombre}</strong>.
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-left space-y-2 text-sm">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <FileSpreadsheet className="w-5 h-5" />
                <span>Base de datos en Excel (CSV) incluida</span>
              </div>
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <Camera className="w-5 h-5" />
                <span>{exportedPhotos} fotos organizadas en carpetas (Muelle, Labarthe, Despacho)</span>
              </div>
              <div className="text-xs text-slate-400 font-mono pt-2 border-t border-slate-800 truncate">
                Archivo: {exportedFilename}
              </div>
            </div>

            <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 font-medium">
              ✓ Los registros activos han sido respaldados y limpiados para dejar el sistema listo para una nueva nave u operación.
            </div>

            <button
              type="button"
              onClick={handleCloseAndReset}
              className="w-full py-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-base shadow-xl transition-all cursor-pointer"
            >
              Entendido / Finalizar
            </button>
          </div>
        ) : (
          /* REGULAR MIGRATION FORM */
          <div className="space-y-5">
            {/* Warning Banner */}
            <div className="p-4 rounded-2xl bg-amber-950/50 border-2 border-amber-500/50 text-amber-200 text-sm space-y-1.5">
              <div className="flex items-center gap-2 font-black text-amber-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>Atención: Acción de Fin de Operación</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-300 font-medium">
                Al migrar datos de la nave <strong className="text-white">{activeBuque.nombre}</strong>, el sistema descargará
                automáticamente una carpeta ZIP con el <strong>archivo Excel</strong> y las carpetas de{' '}
                <strong>fotos de evidencias (Muelle, Labarthe y Despacho)</strong>. Una vez completado, se limpiará la base de
                datos activa de esta nave.
              </p>
            </div>

            {/* Summary of current Vessel to Migrate */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-sm">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400 font-medium">Nave a Migrar:</span>
                <span className="font-black text-cyan-400">{activeBuque.nombre} ({activeBuque.muelle})</span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-1 text-center">
                <div className="bg-slate-900 p-2 rounded-xl border border-sky-500/30">
                  <div className="text-[10px] text-sky-400 font-bold uppercase">Muelle</div>
                  <div className="text-lg font-black text-white">{totalMuelle}</div>
                  <div className="text-[9px] text-slate-400">bolsones</div>
                </div>
                <div className="bg-slate-900 p-2 rounded-xl border border-purple-500/30">
                  <div className="text-[10px] text-purple-400 font-bold uppercase">Labarthe</div>
                  <div className="text-lg font-black text-white">{totalLabarthe}</div>
                  <div className="text-[9px] text-slate-400">bolsones</div>
                </div>
                <div className="bg-slate-900 p-2 rounded-xl border border-amber-500/30">
                  <div className="text-[10px] text-amber-400 font-bold uppercase">Despacho</div>
                  <div className="text-lg font-black text-white">{totalDespacho}</div>
                  <div className="text-[9px] text-slate-400">bolsones</div>
                </div>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-800 text-xs">
                <span className="text-slate-400">Total Registros: <strong>{buqueRegistros.length}</strong></span>
                <span className="text-slate-400">Total Fotos: <strong>{totalPhotosCount}</strong></span>
              </div>
            </div>

            {/* Verification typing box */}
            <div className="space-y-2">
              <label className="block text-sm font-black text-white">
                Para confirmar, escriba la palabra <span className="text-amber-400 uppercase font-mono px-2 py-0.5 rounded bg-amber-950 border border-amber-500/40">migrar</span> a continuación:
              </label>
              <input
                type="text"
                disabled={isProcessing}
                value={typedWord}
                onChange={(e) => setTypedWord(e.target.value)}
                placeholder="Escribe 'migrar' aquí..."
                className="w-full p-4 rounded-2xl bg-slate-950 border-2 border-slate-700 focus:border-amber-400 focus:outline-none text-white text-lg font-bold tracking-wider placeholder-slate-600 transition-all text-center uppercase"
              />
              <p className="text-[11px] text-slate-400 text-center">
                El botón se activará únicamente cuando la palabra coincida exactamente.
              </p>
            </div>

            {/* Progress Bar (if processing) */}
            {isProcessing && (
              <div className="space-y-2 p-4 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="flex items-center justify-between text-xs font-bold text-amber-300">
                  <span className="flex items-center gap-1.5">
                    <RotateCw className="w-4 h-4 animate-spin text-amber-400" />
                    <span>{statusMessage}</span>
                  </span>
                  <span>{progressPct}%</span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleCloseAndReset}
                className="py-4 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm cursor-pointer transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!isWordValid || isProcessing}
                onClick={handleStartMigration}
                className={`py-4 px-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl transition-all cursor-pointer ${
                  isWordValid && !isProcessing
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/25 active:scale-95'
                    : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-50'
                }`}
              >
                {isProcessing ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Migrando...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>MIGRAR DATOS</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
