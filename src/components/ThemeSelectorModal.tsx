import React from 'react';
import { THEMES } from '../utils/themes';
import { ThemeId } from '../types';
import { Palette, Check, Sparkles, X, RotateCcw } from 'lucide-react';

interface ThemeSelectorModalProps {
  isOpen: boolean;
  currentTheme: ThemeId;
  isAuto: boolean;
  onSelectTheme: (themeId: ThemeId, auto: boolean) => void;
  onClose: () => void;
}

export const ThemeSelectorModal: React.FC<ThemeSelectorModalProps> = ({
  isOpen,
  currentTheme,
  isAuto,
  onSelectTheme,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-cyan-500/40 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-pink-500 to-amber-500 rounded-xl text-white">
              <Palette className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                🎨 Estudio de Temáticas Festivas y Estilos
              </h2>
              <p className="text-xs text-slate-400">
                Personaliza la apariencia para el Panel CCTV y los celulares de los Inspectores en tiempo real.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="p-5 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-300">Modo de Activación:</span>
            <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => onSelectTheme(currentTheme, true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  isAuto ? 'bg-cyan-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Automático por Calendario</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectTheme(currentTheme, false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  !isAuto ? 'bg-cyan-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>Manual Personalizado</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSelectTheme('normal', false)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
            <span>Restablecer a Modo Normal</span>
          </button>
        </div>

        {/* Theme cards list */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-3.5 overflow-y-auto">
          {Object.values(THEMES).map((th) => {
            const isSelected = currentTheme === th.id;
            return (
              <div
                key={th.id}
                onClick={() => onSelectTheme(th.id, false)}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'border-cyan-400 bg-slate-800/90 ring-2 ring-cyan-400/20 shadow-lg'
                    : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{th.icon}</span>
                    <div>
                      <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                        {th.name}
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5 leading-snug">{th.description}</p>
                    </div>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-500 text-slate-950'
                        : 'border-slate-600 bg-slate-800'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-semibold">
                  <span className="text-slate-500">
                    {th.particleType ? `Efecto: ${th.particleType.toUpperCase()}` : 'Efecto: Ninguno'}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs">{th.festiveEmoji}</span>
                    <span className="text-cyan-400">Vista previa</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-sm transition-all"
          >
            Listo / Aplicar
          </button>
        </div>
      </div>
    </div>
  );
};
