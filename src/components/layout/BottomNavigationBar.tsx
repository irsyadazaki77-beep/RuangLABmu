import React from 'react';
import { Activity, Telescope, Sliders, BarChart2, Bot } from 'lucide-react';
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
    badge?: number;
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
      id: 'telemetry',
      label: 'Telemetri',
      icon: Activity,
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
      className="lg:hidden shrink-0 h-14 studio-hud-surface border-t px-1.5 flex items-center justify-around gap-1 z-30 select-none"
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
              if ((item.id === 'variables' || item.id === 'telemetry') && mobileTab === item.id) {
                setMobileTab('canvas');
                return;
              }
              setMobileTab(item.id);
              if (item.id === 'ai') {
                setDrawerTab('ai');
                setDrawerOpen(true);
              }
            }}
            aria-current={isActive ? 'page' : undefined}
            aria-label={`Tampilkan ${item.label}`}
            className={`h-11 min-w-0 flex-1 flex flex-col items-center justify-center gap-0.5 rounded-lg transition-colors cursor-pointer relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--comfort-accent)] ${
              isActive
                ? 'comfort-accent-soft border font-bold'
                : 'text-[var(--comfort-hud-muted)] hover:text-[var(--comfort-hud-text)]'
            }`}
          >
            <div className="relative flex items-center">
              <IconComponent
                className={`w-4 h-4 ${isActive ? 'text-[var(--comfort-accent)]' : 'text-[var(--comfort-hud-muted)]'}`}
                aria-hidden="true"
              />
              {item.badge !== undefined && (
                <span className="ml-0.5 text-2xs font-mono text-[var(--comfort-accent)] font-bold tabular-nums">
                  {item.badge}
                </span>
              )}
              {item.alert && (
                <span
                  className="ml-1 text-2xs font-mono font-bold text-[var(--comfort-warning)] leading-none"
                  title="Perlu perhatian: nilai R² rendah"
                >
                  <span aria-hidden="true">▲</span>
                  <span className="sr-only">Perhatian R² rendah</span>
                </span>
              )}
            </div>
            <span className="text-2xs tracking-tight whitespace-nowrap truncate max-w-full px-0.5">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
