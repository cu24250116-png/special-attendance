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
  ShieldCheck,
  Megaphone
} from 'lucide-react';

export type AdminTab =
  | 'overview'
  | 'students'
  | 'attendance'
  | 'assignments'
  | 'excel_import'
  | 'messages'
  | 'user_management'
  | 'cloud_sync'
  | 'import_history'
  | 'settings';

interface AdminNavDrawerProps {
  currentTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  currentUser?: any;
}

export const AdminNavDrawer: React.FC<AdminNavDrawerProps> = ({
  currentTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile = () => {},
  currentUser,
}) => {
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const menuItems: { id: AdminTab; label: string; icon: any; badge?: string }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'attendance', label: 'Attendance', icon: Calendar },
    { id: 'assignments', label: 'Assignments', icon: FileCheck2 },
    { id: 'excel_import', label: 'Excel Import', icon: FileSpreadsheet, badge: 'Core' },
    { id: 'messages', label: 'Student Notices', icon: Megaphone, badge: 'New' },
    ...(isSuperAdmin
      ? [{ id: 'user_management' as AdminTab, label: 'HOD & Admins', icon: ShieldCheck, badge: 'Super' }]
      : []),
    { id: 'cloud_sync', label: 'Cloud Sync', icon: Cloud, badge: 'Auto' },
    { id: 'import_history', label: 'Import History', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleItemClick = (id: AdminTab) => {
    onSelectTab(id);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40 md:hidden transition-opacity"
        />
      )}

      {/* Mobile Off-Canvas Slide Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900/98 border-r border-slate-800 flex flex-col justify-between transform transition-transform duration-300 md:hidden shadow-2xl ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Mobile Drawer Header */}
          <div className="p-4 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
              </div>
              <span className="font-bold text-sm text-white font-['Outfit'] tracking-wide">
                Admin Console
              </span>
            </div>
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              title="Close drawer"
            >
              ✕
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
                  onClick={() => handleItemClick(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-semibold transition ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-900/40 font-bold'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`px-1.5 py-0.5 text-[9px] font-bold rounded-md uppercase tracking-wider ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-indigo-950 text-indigo-300 border border-indigo-800/60'
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

        <div className="p-4 border-t border-slate-800">
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300">
            <p className="font-semibold text-sky-400">⚡ College Admin Sync</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Updates to Excel sheets reflect live on all student phones.
            </p>
          </div>
        </div>
      </div>

      {/* Desktop Sidebar (Collapsible) */}
      <aside
        className={`hidden md:flex bg-slate-900/90 border-r border-slate-800 flex-col justify-between transition-all duration-300 ${
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
    </>
  );
};
