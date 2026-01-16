'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Save, Loader2, Layout, Type } from 'lucide-react';
import toast from 'react-hot-toast';

interface ConfigItem {
    key: string;
    value: string;
    description: string;
}

export default function SettingsPage() {
    const [configs, setConfigs] = useState<ConfigItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [userRole, setUserRole] = useState<string>('');

    useEffect(() => {
        const userData = localStorage.getItem('ozifin_user');
        if (userData) {
            const user = JSON.parse(userData);
            setUserRole(user.role);
        }
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            const { data, error } = await supabase
                .from('app_config')
                .select('*')
                .order('key');

            if (error) throw error;
            setConfigs(data || []);
        } catch (error) {
            console.error('Error loading config:', error);
            // Don't show error toast on initial load if table doesn't exist yet (graceful degradation)
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (key: string, value: string) => {
        setConfigs(prev => prev.map(c => c.key === key ? { ...c, value } : c));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            for (const config of configs) {
                const { error } = await supabase
                    .from('app_config')
                    .update({ value: config.value, updated_at: new Date().toISOString() })
                    .eq('key', config.key);

                if (error) throw error;
            }
            toast.success('Đã lưu cấu hình hệ thống');

            // Dispatch event to update other components if needed
            window.dispatchEvent(new Event('config-updated'));

        } catch (error) {
            console.error('Error saving config:', error);
            toast.error('Lỗi khi lưu cấu hình');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (userRole !== 'admin') {
        return (
            <div className="text-center py-20 text-gray-500">
                Bạn không có quyền truy cập trang này.
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto pb-24 animate-in">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-black text-gray-800">Cấu Hình Hệ Thống</h1>
                    <p className="text-gray-500">Tuỳ chỉnh giao diện và nội dung hiển thị</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg hover:shadow-indigo-200 disabled:opacity-70 active:scale-95"
                >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Lưu Thay Đổi
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Login Page Config */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                            <Layout className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800">Trang Đăng Nhập</h2>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Tiêu đề (Login Title)</label>
                            <input
                                type="text"
                                value={configs.find(c => c.key === 'login_title')?.value || ''}
                                onChange={(e) => handleUpdate('login_title', e.target.value)}
                                className="w-full px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none"
                                placeholder="OZIFIN"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Khẩu hiệu (Slogan)</label>
                            <input
                                type="text"
                                value={configs.find(c => c.key === 'login_slogan')?.value || ''}
                                onChange={(e) => handleUpdate('login_slogan', e.target.value)}
                                className="w-full px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none"
                                placeholder="Hệ thống quản lý dòng tiền..."
                            />
                        </div>
                    </div>
                </div>

                {/* Sidebar Config */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                            <Type className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800">Sidebar (Menu trái)</h2>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Tên hệ thống</label>
                            <input
                                type="text"
                                value={configs.find(c => c.key === 'sidebar_title')?.value || ''}
                                onChange={(e) => handleUpdate('sidebar_title', e.target.value)}
                                className="w-full px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none"
                                placeholder="OZIFIN"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Mô tả dưới tên</label>
                            <input
                                type="text"
                                value={configs.find(c => c.key === 'sidebar_slogan')?.value || ''}
                                onChange={(e) => handleUpdate('sidebar_slogan', e.target.value)}
                                className="w-full px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none"
                                placeholder="Transaction System"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
