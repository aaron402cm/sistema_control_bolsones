import React, { useState, useEffect } from 'react';
import { Buque, ThemeId } from './types';
import { THEMES } from './utils/themes';
import { storage } from './services/storageService';
import { FestiveOverlay } from './components/FestiveOverlay';
import { VesselModal } from './components/VesselModal';
import { ThemeSelectorModal } from './components/ThemeSelectorModal';
import { PortalHome } from './components/PortalHome';
import { InspectorApp } from './components/InspectorApp';
import { CCTVPanel } from './components/CCTVPanel';

export default function App() {
  const [currentView, setCurrentView] = useState<'portal' | 'inspector' | 'cctv'>('portal');
  const [buques, setBuques] = useState<Buque[]>([]);
  const [activeBuqueId, setActiveBuqueId] = useState<string>('');
  const [themeId, setThemeId] = useState<ThemeId>(storage.getTheme());
  const [isAutoTheme, setIsAutoTheme] = useState<boolean>(storage.isAutoTheme());

  // Modals
  const [isVesselModalOpen, setIsVesselModalOpen] = useState<boolean>(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState<boolean>(false);

  // Sync state on mount and when events occur
  useEffect(() => {
    const syncState = () => {
      const allBuques = storage.getBuques();
      setBuques(allBuques);
      if (!activeBuqueId && allBuques.length > 0) {
        setActiveBuqueId(allBuques[0].id);
      }
      setThemeId(storage.getTheme());
      setIsAutoTheme(storage.isAutoTheme());
    };

    syncState();
    window.addEventListener('iqbf_data_updated', syncState);
    return () => window.removeEventListener('iqbf_data_updated', syncState);
  }, [activeBuqueId]);

  const currentThemeConfig = THEMES[themeId] || THEMES.normal;

  // Active vessel entity
  const activeBuque = buques.find((b) => b.id === activeBuqueId) || buques[0];

  // Handlers for entering stations
  const handleEnterInspector = (buqueId: string) => {
    const targetBuqueId = buqueId || buques[0]?.id || '';
    setActiveBuqueId(targetBuqueId);
    // Show confirmation modal to grant conformity before starting
    setIsVesselModalOpen(true);
  };

  const handleEnterCCTV = (buqueId: string) => {
    const targetBuqueId = buqueId || 'all';
    setActiveBuqueId(targetBuqueId);
    setCurrentView('cctv');
  };

  const handleConfirmVessel = (buqueId: string) => {
    setActiveBuqueId(buqueId);
    setIsVesselModalOpen(false);
    setCurrentView('inspector');
  };

  const handleSelectTheme = (newTheme: ThemeId, auto: boolean) => {
    storage.setTheme(newTheme, auto);
    setThemeId(newTheme);
    setIsAutoTheme(auto);
  };

  return (
    <div className="relative min-h-screen bg-slate-950 font-sans antialiased text-slate-100">
      {/* Main View Switcher */}
      {currentView === 'portal' && (
        <PortalHome
          buques={buques}
          onEnterInspector={handleEnterInspector}
          onEnterCCTV={handleEnterCCTV}
          onOpenThemeModal={() => setIsThemeModalOpen(true)}
          themeConfig={currentThemeConfig}
        />
      )}

      {currentView === 'inspector' && activeBuque && (
        <InspectorApp
          activeBuque={activeBuque}
          allBuques={buques}
          onChangeBuque={(id) => setActiveBuqueId(id)}
          onOpenBuqueModal={() => setIsVesselModalOpen(true)}
          onExit={() => setCurrentView('portal')}
          themeConfig={currentThemeConfig}
        />
      )}

      {currentView === 'cctv' && (
        <CCTVPanel
          buques={buques}
          activeBuqueId={activeBuqueId}
          onSelectBuque={(id) => setActiveBuqueId(id)}
          onOpenThemeModal={() => setIsThemeModalOpen(true)}
          onExit={() => setCurrentView('portal')}
          themeConfig={currentThemeConfig}
        />
      )}

      {/* Vessel Conformity & Selection Modal */}
      <VesselModal
        isOpen={isVesselModalOpen}
        buques={buques}
        selectedBuqueId={activeBuqueId}
        onConfirm={handleConfirmVessel}
        onCancel={currentView === 'portal' ? () => setIsVesselModalOpen(false) : undefined}
      />

      {/* Theme Studio Modal */}
      <ThemeSelectorModal
        isOpen={isThemeModalOpen}
        currentTheme={themeId}
        isAuto={isAutoTheme}
        onSelectTheme={handleSelectTheme}
        onClose={() => setIsThemeModalOpen(false)}
      />
    </div>
  );
}
