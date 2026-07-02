'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser, clearToken } from '../lib/api';
import {
  LayoutDashboard,
  Database,
  MessageSquare,
  Activity,
  Settings,
  LogOut,
  Menu,
  X,
  User,
  ChevronDown,
  Headphones,
  Sparkles,
  Bot,
} from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.push('/login');
    } else {
      setCurrentUser(user);
    }
  }, [router]);

  const handleSignOut = () => {
    clearToken();
    router.push('/login');
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#f4f2ff] flex items-center justify-center text-slate-400">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 border border-purple-200 animate-spin" />
          <p className="text-sm text-slate-500">Loading workspace...</p>
        </div>
      </div>
    );
  }

  const navItems = [
    { name: 'Overview', href: '/', icon: LayoutDashboard },
    { name: 'Agents', href: '/agents', icon: Bot },
    { name: 'Knowledge Base', href: '/sources', icon: Database },
    { name: 'Knowledge Gaps', href: '/observability/gaps', icon: Sparkles },
    { name: 'Conversations', href: '/conversations', icon: MessageSquare },
    { name: 'Agent Inbox', href: '/agent', icon: Headphones },
    { name: 'Observability', href: '/observability', icon: Activity },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#f4f2ff] text-slate-800 flex font-sans antialiased">
      {/* Mobile Sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200/80 p-5 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:flex lg:flex-col ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between mb-8 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#8B5CF6] to-[#7C3AED] flex items-center justify-center shadow-lg shadow-purple-500/10">
              <span className="font-bold text-white text-base">G</span>
            </div>
            <span className="font-bold text-slate-800 text-base">GroundedDesk</span>
          </div>
          <button className="lg:hidden p-1 text-slate-400 hover:text-slate-600" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tenant Switcher Card */}
        <div className="mb-6 p-3 bg-[#FAF9FF] border border-purple-100/50 rounded-xl flex items-center justify-between">
          <div className="truncate">
            <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">Active Workspace</span>
            <span className="font-bold text-xs text-slate-700 truncate block">{currentUser.tenant?.name || 'Workspace'}</span>
          </div>
          <span className="px-1.5 py-0.5 rounded bg-purple-100 border border-purple-200 text-[#7C3AED] text-[9px] font-bold uppercase tracking-wider shrink-0 ml-2">
            Owner
          </span>
        </div>

        {/* Sidebar Nav items */}
        <nav className="space-y-1.5 flex-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/' &&
                pathname.startsWith(item.href + '/') &&
                !navItems.some(
                  (other) =>
                    other.href !== item.href &&
                    other.href !== '/' &&
                    pathname.startsWith(other.href)
                ));
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-[#7C3AED] text-white shadow-sm shadow-[#7C3AED]/15'
                    : 'text-slate-500 hover:bg-[#FAF9FF] hover:text-[#7C3AED] border border-transparent'
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-[#7C3AED]'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Metered Subscription Progress Box */}
        <div className="mt-4 mb-4">
          <div className="bg-[#FAF9FF] border border-purple-100 rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[10px] font-bold">
              <span className="text-[#7C3AED]">Ignite</span>
              <span className="text-slate-400">1,000 Credit Left</span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-purple-500 to-[#7C3AED] h-full w-[45%] rounded-full"></div>
            </div>
            <button className="w-full text-center text-[#7C3AED] hover:text-[#6D28D9] font-bold text-[10px] mt-1 cursor-pointer">
              Upgrade Plan
            </button>
          </div>
        </div>

        {/* User Footer Profile */}
        <div className="border-t border-slate-100 pt-4">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors text-xs font-bold text-left"
          >
            <LogOut className="w-4 h-4 text-slate-400 group-hover:text-red-600" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Dashboard body wrapper */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Header bar */}
        <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md px-6 flex items-center justify-between lg:justify-end gap-4 relative z-30">
          <button
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-700 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Header Action Items */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all"
              >
                <div className="w-6 h-6 rounded-full bg-purple-100 border border-purple-200 flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-[#7C3AED]" />
                </div>
                <span className="max-w-[120px] truncate">{currentUser.name || currentUser.email}</span>
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
              </button>

              {userDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setUserDropdownOpen(false)} />
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 z-20">
                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        handleSignOut();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors text-xs font-semibold text-left cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5 text-slate-400" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Dashboard content */}
        <main className="flex-1 overflow-y-auto p-6 relative">
          {children}
        </main>
      </div>
    </div>
  );
}
