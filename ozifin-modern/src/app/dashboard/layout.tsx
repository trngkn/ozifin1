'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { User } from '@/types';
import { LogOut, Menu, Wallet, Settings as SettingsIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [config, setConfig] = useState({
        title: 'OZIFIN',
        slogan: 'Transaction System'
    });

    useEffect(() => {
        setMounted(true);
        loadConfig();

        const handleConfigUpdate = () => loadConfig();
        window.addEventListener('config-updated', handleConfigUpdate);
        return () => window.removeEventListener('config-updated', handleConfigUpdate);
    }, []);

    const loadConfig = async () => {
        try {
            const { data } = await supabase.from('app_config').select('*').in('key', ['sidebar_title', 'sidebar_slogan']);
            if (data && data.length > 0) {
                const newConfig = { ...config };
                data.forEach(item => {
                    if (item.key === 'sidebar_title') newConfig.title = item.value;
                    if (item.key === 'sidebar_slogan') newConfig.slogan = item.value;
                });
                setConfig(newConfig);
            }
        } catch (error) {
            console.error('Error loading sidebar config:', error);
        }
    };

    useEffect(() => {
        if (!mounted) return;

        const userData = localStorage.getItem('ozifin_user');
        if (!userData) {
            router.push('/login');
        } else {
            setUser(JSON.parse(userData));
        }
    }, [mounted, router]);

    const handleLogout = () => {
        localStorage.removeItem('ozifin_user');
        toast.success('Đã đăng xuất');
        router.push('/login');
    };

    if (!mounted || !user) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="flex h-screen overflow-hidden bg-gray-50 text-gray-800 font-sans">
            {/* Sidebar Overlay (Mobile) */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-300 flex flex-col h-full flex-shrink-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
                    }`}
            >
                {/* Logo */}
                <div className="p-6 border-b border-white/10 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                            <Wallet className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black tracking-tight whitespace-nowrap">{config.title}</h1>
                            <p className="text-xs text-slate-400 font-medium truncate max-w-[150px]">{config.slogan}</p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-2 overflow-y-auto no-scrollbar">
                    <NavLink href="/dashboard" icon="📊" label="Tổng quan" />
                    <NavLink href="/dashboard/transactions" icon="💳" label="Giao dịch" />
                    {(user.role === 'admin' || user.role === 'manager') && (
                        <NavLink href="/dashboard/users" icon="👥" label="Người dùng" />
                    )}
                    {user.role === 'admin' && (
                        <NavLink href="/dashboard/settings" icon="⚙️" label="Cấu hình hệ thống" />
                    )}
                    <NavLink href="/dashboard/profile" icon="👤" label="Hồ sơ cá nhân" />
                </nav>

                {/* User Profile */}
                <div className="p-4 border-t border-white/10 flex-shrink-0 bg-slate-800/50">
                    <div
                        onClick={() => router.push('/dashboard/profile')}
                        className="flex items-center gap-3 mb-3 p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer group"
                    >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-sm font-bold overflow-hidden shadow-md flex-shrink-0">
                            {user.avatar_url ? (
                                <img src={user.avatar_url} alt={user.display_name} className="w-full h-full object-cover" />
                            ) : (
                                user.display_name.charAt(0)
                            )}
                        </div>
                        <div className="flex-1 overflow-hidden text-left">
                            <div className="text-sm font-bold truncate text-white group-hover:text-indigo-300 transition-colors">{user.display_name}</div>
                            <div className="text-xs text-slate-300 capitalize">{user.role}</div>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full py-2 text-xs font-bold text-red-300 hover:text-red-200 hover:bg-red-500/20 rounded-lg transition-colors flex items-center justify-start px-2 gap-2"
                    >
                        <LogOut className="w-4 h-4 ml-1" />
                        Đăng xuất
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                {/* Mobile Header */}
                <header className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between sticky top-0 z-30 flex-shrink-0">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                    <h1 className="font-bold text-lg">{config.title}</h1>
                    <div className="w-10"></div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth hover:scroll-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}

function NavLink({ href, icon, label }: { href: string; icon: string; label: string }) {
    const router = useRouter();
    const pathname = usePathname();
    const isActive = pathname === href;

    return (
        <button
            onClick={() => router.push(href)}
            className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 flex items-center gap-3 font-medium border border-transparent flex-shrink-0 ${isActive
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
        >
            <span className="text-xl flex-shrink-0">{icon}</span>
            <span className="truncate">{label}</span>
        </button>
    );
}
