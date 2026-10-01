import React, { useState } from 'react';
import { Buque } from '../types';
import { Ship, Anchor, CheckCircle, Package, ArrowRight } from 'lucide-react';

interface VesselModalProps {
  isOpen: boolean;
  buques: Buque[];
  selectedBuqueId: string;
  onConfirm: (buqueId: string) => void;
  onCancel?: () => void;
}

export const VesselModal: React.FC<VesselModalProps> = ({
  isOpen,
  buques,
  selectedBuqueId,
  onConfirm,
  onCancel,
}) => {
  const [chosenId, setChosenId] = useState<string>(selectedBuqueId || buques[0]?.id || '');

  React.useEffect(() => {
    if (selectedBuqueId) {
      setChosenId(selectedBuqueId);
    } else if (buques[0]?.id && !chosenId) {
      setChosenId(buques[0].id);
    }
  }, [selectedBuqueId, buques]);

  if (!isOpen) return null;

  const currentChosenBuque = buques.find((b) => b.id === chosenId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-cyan-500/60 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-cyan-950 to-slate-900 p-6 border-b border-cyan-500/30 flex items-center gap-3">
          <div className="p-3 bg-cyan-500/20 rounded-xl border border-cyan-400/40 text-cyan-400">
            <Ship className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-wider flex items-center gap-2">
              🚢 Asignación de Buque de Operación
            </h2>
            <p className="text-sm font-medium text-cyan-300/80">
              Seleccione la nave para registrar o monitorear y otorgue conformidad.
            </p>
          </div>
        </div>

        {/* Vessel selection list */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {buques.map((buque) => {
            const isSelected = chosenId === buque.id;
            const totalBolsones = buque.productos.reduce((acc, p) => acc + p.cantidadBuque, 0);

            return (
              <div
                key={buque.id}
                onClick={() => setChosenId(buque.id)}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-cyan-400 bg-cyan-950/60 shadow-lg shadow-cyan-950/60 ring-2 ring-cyan-500/20'
                    : 'border-slate-800 bg-slate-800/40 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-xl ${
                        isSelected ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      <Anchor className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-white text-lg">{buque.nombre}</h3>
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          {buque.estado.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-cyan-400 flex items-center gap-2 mt-0.5">
                        <span>📍 {buque.muelle}</span>
                        <span>•</span>
                        <span>⏱️ Arribo: {buque.fechaArribo}</span>
                      </div>
                    </div>
                  </div>
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      isSelected ? 'border-cyan-400 bg-cyan-500 text-slate-950' : 'border-slate-600'
                    }`}
                  >
                    {isSelected && <CheckCircle className="w-4 h-4" />}
                  </div>
                </div>

                {/* Cargo preview tags */}
                <div className="mt-3 pt-3 border-t border-slate-700/50 flex flex-wrap gap-2">
                  <span className="text-xs text-slate-400 font-bold flex items-center gap-1">
                    <Package className="w-3.5 h-3.5 text-cyan-400" /> Carga ({totalBolsones.toLocaleString()} bolsones):
                  </span>
                  {buque.productos.map((prod) => (
                    <span
                      key={prod.id}
                      className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-medium"
                    >
                      {prod.producto}: <strong className="text-cyan-300">{prod.cantidadBuque}</strong>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Confirmation Footer */}
        <div className="p-6 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between gap-4">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-3 rounded-xl border border-slate-700 text-slate-400 hover:text-white font-bold text-sm transition-all"
            >
              Cancelar
            </button>
          ) : (
            <div className="text-xs text-slate-500">
              * Podrá alternar de nave en cualquier momento desde la cabecera.
            </div>
          )}

          <button
            type="button"
            disabled={!chosenId}
            onClick={() => onConfirm(chosenId)}
            className="flex-1 py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-base shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <span>✅ CONFIRMAR Y ENTRAR AL BUQUE</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
