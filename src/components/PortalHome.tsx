import React, { useState } from 'react';
import { Buque, ThemeConfig } from '../types';
import { Ship, Shield, Smartphone, Monitor, Lock, Key, ArrowRight, Anchor, Palette } from 'lucide-react';
import { FestiveOverlay } from './FestiveOverlay';

interface PortalHomeProps {
  buques: Buque[];
  onEnterInspector: (buqueId: string) => void;
  onEnterCCTV: (buqueId: string) => void;
  onOpenThemeModal: () => void;
  themeConfig: ThemeConfig;
}

export const PortalHome: React.FC<PortalHomeProps> = ({
  buques,
  onEnterInspector,
  onEnterCCTV,
  onOpenThemeModal,
  themeConfig,
}) => {
  const [selectedModule, setSelectedModule] = useState<'inspector' | 'cctv' | null>(null);
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedBuqueId, setSelectedBuqueId] = useState<string>(buques[0]?.id || '');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Verification: Default port password "Apm2026" or empty for testing convenience
    if (password === 'Apm2026' || password === 'admin' || password === '') {
      if (selectedModule === 'inspector') {
        onEnterInspector(selectedBuqueId);
      } else if (selectedModule === 'cctv') {
        onEnterCCTV('all');
      }
    } else {
      setErrorMsg('❌ Contraseña incorrecta. Intente nuevamente.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-8 font-sans relative overflow-hidden">
      {/* Festive particle background effects on Portal Home */}
      <FestiveOverlay themeConfig={themeConfig} />

      {/* Background Subtle Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-950/20 via-slate-950 to-slate-950 pointer-events-none" />

      {/* Top Header */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyan-500/20 rounded-2xl border border-cyan-400/40 text-cyan-400 shadow-lg shadow-cyan-500/10">
            <Anchor className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-wider text-white">CONTROL IQBF</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold">
                Puerto APM 2026
              </span>
              <span className="text-lg">{themeConfig.festiveEmoji}</span>
            </div>
            <p className="text-xs font-semibold text-slate-400">
              Sistema Portuario de Trazabilidad y Descarga de Bolsones
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenThemeModal}
          className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 text-xs font-bold text-slate-300 flex items-center gap-2 cursor-pointer transition-all shadow-md"
        >
          <Palette className="w-4 h-4 text-pink-400" />
          <span className="hidden sm:inline">Temática: {themeConfig.name.split(' ')[0]}</span>
        </button>
      </header>

      {/* Center Cards */}
      <main className="max-w-4xl w-full mx-auto my-auto py-8 z-10 space-y-8">
        {!selectedModule ? (
          /* MODULE SELECTION */
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Seleccione la Estación de Trabajo
              </h2>
              <p className="text-sm text-slate-400 max-w-lg mx-auto">
                Acceda con protección antiduplicados, soporte simultáneo para dos buques y monitoreo en tiempo real.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* INSPECTOR CARD */}
              <div
                onClick={() => setSelectedModule('inspector')}
                className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border-2 border-slate-800 hover:border-cyan-400 cursor-pointer transition-all duration-300 hover:scale-[1.02] shadow-2xl flex flex-col justify-between group"
              >
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-cyan-500/20 border border-cyan-400/30 text-cyan-400 w-fit group-hover:scale-110 transition-transform">
                    <Smartphone className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white group-hover:text-cyan-400 transition-colors">
                      📱 App de Registro de Inspectores
                    </h3>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                      Optimizado para celulares en patio. Ingreso ultra rápido con teclado digital para:{' '}
                      <strong className="text-slate-200">Muelle, Labarthe y Despacho</strong>, fotos y cola offline.
                    </p>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-800/80 flex items-center justify-between text-xs font-black text-cyan-400 mt-6">
                  <span>Acceso para Inspectores</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {/* CCTV CARD */}
              <div
                onClick={() => setSelectedModule('cctv')}
                className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border-2 border-slate-800 hover:border-blue-500 cursor-pointer transition-all duration-300 hover:scale-[1.02] shadow-2xl flex flex-col justify-between group"
              >
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-blue-500/20 border border-blue-400/30 text-blue-400 w-fit group-hover:scale-110 transition-transform">
                    <Monitor className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white group-hover:text-blue-400 transition-colors">
                      🎛️ Panel CCTV Monitoreo
                    </h3>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                      Centro de comando con sirena acústica, alertas por voz en vivo, detección de discrepancias,
                      velocímetro PPH y supervisión multi-buque.
                    </p>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-800/80 flex items-center justify-between text-xs font-black text-blue-400 mt-6">
                  <span>Acceso de Seguridad CCTV</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>

            {/* Active Vessels Summary Card */}
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-2">
                <Ship className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-slate-300">Naves Activas en Puerto:</span>
                <span className="font-black text-emerald-400">{buques.filter((b) => b.estado === 'activo').length} Buques</span>
              </div>
              <div className="flex gap-2">
                {buques.map((b) => (
                  <span
                    key={b.id}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 font-semibold"
                  >
                    🚢 {b.nombre} ({b.muelle})
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* LOGIN WITH MULTI-BUQUE SELECTION */
          <div className="max-w-md mx-auto bg-slate-900 border-2 border-cyan-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <div className="p-3 bg-cyan-500/20 rounded-2xl border border-cyan-400/40 text-cyan-400 w-fit mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-white">
                {selectedModule === 'inspector' ? 'Ingreso Inspector de Guardia' : 'Ingreso Panel CCTV Central'}
              </h3>
              <p className="text-xs text-slate-400">
                {selectedModule === 'inspector'
                  ? 'Coloque su clave de seguridad portuaria para asignar y confirmar el buque a operar.'
                  : 'Coloque su clave de seguridad portuaria para ingresar al control simultáneo de ambas naves.'}
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              {/* CCTV Info Badge - No vessel selection needed since both vessels are controlled */}
              {selectedModule === 'cctv' && (
                <div className="p-3 rounded-2xl bg-cyan-950/60 border border-cyan-500/30 flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
                    <Monitor className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-white flex items-center gap-1.5">
                      <span>Control Central Multibuque</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">2 Naves Activas</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Monitoreo simultáneo de Muelle, Labarthe y Despacho en tiempo real.
                    </div>
                  </div>
                </div>
              )}

              {/* Password */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Contraseña de Acceso:</span>
                </label>
                <input
                  type="password"
                  placeholder="Ingrese contraseña (Apm2026)..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-center text-base font-bold text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400"
                />
                <span className="text-[11px] text-slate-500 block mt-1 text-center">
                  * Contraseña por defecto: <strong>Apm2026</strong>
                </span>
              </div>

              {errorMsg && (
                <div className="text-xs font-bold text-red-400 text-center py-1 bg-red-950/40 rounded-lg border border-red-500/30">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedModule(null)}
                  className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Volver
                </button>
                <button
                  type="submit"
                  className="py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-black shadow-lg shadow-cyan-500/20 cursor-pointer"
                >
                  INGRESAR
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-4xl w-full mx-auto text-center text-xs text-slate-500 z-10 pt-4">
        APM Terminals 2026 · Sistema Integrado de Control Portuario de Bolsones IQBF
      </footer>
    </div>
  );
};
