import React from 'react';
import { Telescope, Sliders, BarChart2, Bot } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useUIStore, MobileTab } from '../../stores/useUIStore';
import { useLabStore } from '../../stores/useLabStore';
import { labSound } from '../../utils/soundEngine';

export interface BottomNavigationBarProps {
  recordsCount?: number;
  hasLowR2Alert?: boolean;
}

export const BottomNavigationBar: React.FC<BottomNavigationBarProps> = ({
  recordsCount = 0,
  hasLowR2Alert = false,
}) => {
  const { mobileTab, setMobileTab, setDrawerTab, setDrawerOpen } = useUIStore(
    useShallow((s) => ({
      mobileTab: s.mobileTab,
      setMobileTab: s.setMobileTab,
      setDrawerTab: s.setDrawerTab,
      setDrawerOpen: s.setDrawerOpen,
    }))
  );
  const setWorkflowStep = useLabStore((s) => s.setWorkflowStep);

  const navItems: Array<{
    id: MobileTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string | number;
    alert?: boolean;
  }> = [
    {
      id: 'canvas',
      label: 'Kanvas 3D',
      icon: Telescope,
    },
    {
      id: 'variables',
      label: 'Variabel',
      icon: Sliders,
    },
    {
      id: 'worksheet',
      label: 'Data/LKS',
      icon: BarChart2,
      badge: recordsCount > 0 ? recordsCount : undefined,
    },
    {
      id: 'ai',
      label: 'Dr. LabMu',
      icon: Bot,
      alert: hasLowR2Alert,
    },
  ];

  return (
    <nav
      aria-label="Navigasi Bawah Ruang Laboratorium"
      className="lg:hidden shrink-0 h-16 bg-slate-950/95 border-t border-slate-800 backdrop-blur-md px-2 flex items-center justify-around z-30 select-none"
    >
      {navItems.map((item) => {
        const isActive = mobileTab === item.id;
        const IconComponent = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              labSound.playClick();
              if (item.id === 'worksheet') {
                setMobileTab('canvas');
                setWorkflowStep(3);
                return;
              }
              setMobileTab(item.id);
              if (item.id === 'ai') {
                setDrawerTab('ai');
                setDrawerOpen(true);
              }
            }}
            aria-selected={isActive}
            aria-label={`Tampilkan ${item.label}`}
            className={`min-h-[48px] min-w-[64px] flex-1 flex flex-col items-center justify-center gap-1 rounded-xl transition-all cursor-pointer relative ${
              isActive
                ? 'text-sky-400 font-bold bg-sky-950/40 border border-sky-800/40 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <IconComponent className={`w-5 h-5 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
              {item.badge !== undefined && (
                <span className="absolute -top-1.5 -right-3 text-[9px] font-mono px-1 rounded-full bg-sky-600 text-white font-bold tabular-nums">
                  {item.badge}
                </span>
              )}
              {item.alert && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              )}
            </div>
            <span className="text-[10px] tracking-tight">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
