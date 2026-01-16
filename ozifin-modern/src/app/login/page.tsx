'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { Lock, User, Wallet } from 'lucide-react';

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const [config, setConfig] = useState({
        title: 'OZIFIN',
        slogan: 'Hệ thống quản lý dòng tiền chuyên nghiệp'
    });

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            const { data } = await supabase.from('app_config').select('*').in('key', ['login_title', 'login_slogan']);
            if (data && data.length > 0) {
                const newConfig = { ...config };
                data.forEach(item => {
                    if (item.key === 'login_title') newConfig.title = item.value;
                    if (item.key === 'login_slogan') newConfig.slogan = item.value;
                });
                setConfig(newConfig);
            }
        } catch (error) {
            console.error('Error loading config:', error);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Query user from database
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('username', username)
                .single();

            if (error || !data) {
                toast.error('Sai tên đăng nhập hoặc mật khẩu');
                setLoading(false);
                return;
            }

            // Verify password (plain text)
            // Use simple comparison for now as requested
            if (data.password_hash !== password) {
                toast.error('Sai tên đăng nhập hoặc mật khẩu');
                setLoading(false);
                return;
            }

            // Store user in localStorage
            localStorage.setItem('ozifin_user', JSON.stringify({
                id: data.id,
                username: data.username,
                role: data.role,
                display_name: data.display_name,
                avatar_url: data.avatar_url
            }));

            toast.success(`Chào mừng, ${data.display_name}!`);
            router.push('/dashboard');
        } catch (error) {
            console.error('Login error:', error);
            toast.error('Đã xảy ra lỗi khi đăng nhập');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
            {/* Animated background */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse delay-700"></div>
            </div>

            <div className="w-full max-w-md relative z-10 animate-in">
                {/* Card */}
                <div className="glass-card rounded-3xl overflow-hidden shadow-2xl">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-8 text-center">
                        <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                            <Wallet className="w-10 h-10 text-white" />
                        </div>
                        <h1 className="text-3xl font-black text-white mb-2">{config.title}</h1>
                        <p className="text-indigo-100 text-sm">{config.slogan}</p>
                    </div>

                    {/* Form */}
                    <div className="p-8 bg-white">
                        <form onSubmit={handleLogin} className="space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    Tài khoản
                                </label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                                        placeholder="Nhập username..."
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    Mật khẩu
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-70 disabled:scale-100 flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Đang xử lý...
                                    </>
                                ) : (
                                    'Đăng Nhập'
                                )}
                            </button>
                        </form>

                        <div className="mt-6 text-center text-sm text-gray-500">
                            <p>Demo: admin / admin123</p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center mt-6 text-white/80 text-sm">
                    © 2026 OZIFIN. Giải pháp tài chính toàn diện.
                </p>
            </div>
        </div>
    );
}
