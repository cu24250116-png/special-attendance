import React from 'react';
import {
  LayoutDashboard,
  Users,
  Calendar,
  FileCheck2,
  FileSpreadsheet,
  Cloud,
  History,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';

export type AdminTab =
  | 'overview'
  | 'students'
  | 'attendance'
  | 'assignments'
  | 'excel_import'
  | 'cloud_sync'
  | 'import_history'
  | 'settings';

interface AdminNavDrawerProps {
  currentTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const AdminNavDrawer: React.FC<AdminNavDrawerProps> = ({
  currentTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
}) => {
  const menuItems: { id: AdminTab; label: string; icon: any; badge?: string }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'attendance', label: 'Attendance', icon: Calendar },
    { id: 'assignments', label: 'Assignments', icon: FileCheck2 },
    { id: 'excel_import', label: 'Excel Import', icon: FileSpreadsheet, badge: 'Core' },
    { id: 'cloud_sync', label: 'Cloud Sync', icon: Cloud, badge: 'Auto' },
    { id: 'import_history', label: 'Import History', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside
      className={`bg-slate-900/90 border-r border-slate-800 flex flex-col justify-between transition-all duration-300 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div>
        {/* Header / Collapse Toggle */}
        <div className="p-4 flex items-center justify-between border-b border-slate-800/80">
          {!isCollapsed && (
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              <span className="font-bold text-sm text-white font-['Outfit'] tracking-wide">
                Admin Console
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition mx-auto"
            title={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition group ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600/90 to-blue-600/90 text-white shadow-md shadow-indigo-900/30'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <div className="flex items-center space-x-3">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  {!isCollapsed && <span>{item.label}</span>}
                </div>

                {!isCollapsed && item.badge && (
                  <span
                    className={`px-1.5 py-0.5 text-[9px] font-bold rounded-md uppercase tracking-wider ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-indigo-950/80 text-indigo-300 border border-indigo-800/50'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      {!isCollapsed && (
        <div className="p-4 border-t border-slate-800/80">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
            <p className="font-semibold text-slate-300">Live Excel Integration</p>
            <p className="text-[10px] text-slate-500">
              Changes reflect immediately on student mobile screens via SSE.
            </p>
          </div>
        </div>
      )}
    </aside>
  );
};
