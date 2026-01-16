'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@/types';
import { uploadToImgBB } from '@/lib/imgbb';
import { fileToBase64 } from '@/lib/utils';
import { Save, User as UserIcon, Camera, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProfilePage() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [formData, setFormData] = useState({
        display_name: '',
        avatar_url: '',
    });

    useEffect(() => {
        const userData = localStorage.getItem('ozifin_user');
        if (userData) {
            const parsed = JSON.parse(userData);
            setUser(parsed);
            loadProfile(parsed.username);
        }
    }, []);

    const loadProfile = async (username: string) => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('username', username)
                .single();

            if (error) throw error;
            if (data) {
                setFormData({
                    display_name: data.display_name,
                    avatar_url: data.avatar_url || '',
                });
                // Update local storage in case it changed elsewhere
                const localUser = JSON.parse(localStorage.getItem('ozifin_user') || '{}');
                localStorage.setItem('ozifin_user', JSON.stringify({
                    ...localUser,
                    display_name: data.display_name,
                    avatar_url: data.avatar_url
                }));
            }
        } catch (error) {
            console.error('Error loading profile:', error);
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const base64 = await fileToBase64(file);
            const url = await uploadToImgBB(base64);
            setFormData(prev => ({ ...prev, avatar_url: url }));
            toast.success('Đã tải ảnh lên');
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Lỗi khi tải ảnh');
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setLoading(true);

        try {
            const { error } = await supabase
                .from('users')
                .update({
                    display_name: formData.display_name,
                    avatar_url: formData.avatar_url
                })
                .eq('username', user.username);

            if (error) throw error;

            // Also update historical transactions to reflect the new display name
            // We update 'sale' column where 'created_by' matches the user's username
            // AND the 'sale' column matched the OLD display name (to avoid overwriting if sale was explicitly set to someone else)
            // But for now, assuming sale = user, we just update all transactions created by this user
            const { error: txError } = await supabase
                .from('transactions')
                .update({ sale: formData.display_name })
                .eq('created_by', user.username);

            if (txError) console.error('Error updating transactions history:', txError);

            // Update local storage
            const updatedUser = { ...user, ...formData };
            localStorage.setItem('ozifin_user', JSON.stringify(updatedUser));
            setUser(updatedUser);

            // Trigger a page reload to update sidebar/header
            window.location.reload();

            toast.success('Đã cập nhật hồ sơ và lịch sử giao dịch');
        } catch (error) {
            console.error('Error updating profile:', error);
            toast.error('Lỗi khi cập nhật hồ sơ');
        } finally {
            setLoading(false);
        }
    };

    if (!user) return null;

    return (
        <div className="max-w-2xl mx-auto py-8 px-4 animate-in">
            <h1 className="text-3xl font-black text-gray-800 mb-8">Hồ Sơ Cá Nhân</h1>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Avatar Section */}
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative group">
                            <div className="w-32 h-32 rounded-full border-4 border-indigo-100 overflow-hidden bg-gray-100 flex items-center justify-center">
                                {formData.avatar_url ? (
                                    <img src={formData.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <UserIcon className="w-12 h-12 text-gray-400" />
                                )}
                                {uploading && (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                                    </div>
                                )}
                            </div>
                            <label className="absolute bottom-0 right-0 p-2 bg-indigo-600 rounded-full text-white cursor-pointer hover:bg-indigo-700 transition-colors shadow-lg">
                                <Camera className="w-5 h-5" />
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleAvatarUpload}
                                    disabled={uploading}
                                />
                            </label>
                        </div>
                        <p className="text-sm text-gray-500">Nhấn vào biểu tượng máy ảnh để thay đổi</p>
                    </div>

                    {/* Inputs */}
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                Tên đăng nhập
                            </label>
                            <input
                                type="text"
                                value={user.username}
                                disabled
                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 bg-gray-50 text-gray-500 font-mono"
                            />
                            <p className="text-xs text-gray-400 mt-1">Không thể thay đổi tên đăng nhập</p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                Tên hiển thị
                            </label>
                            <input
                                type="text"
                                value={formData.display_name}
                                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none"
                                placeholder="Nhập tên hiển thị của bạn"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                Vai trò
                            </label>
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-indigo-100 text-indigo-700 capitalize">
                                {user.role}
                            </span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-6 border-t border-gray-100 flex justify-end">
                        <button
                            type="submit"
                            disabled={loading || uploading}
                            className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Save className="w-5 h-5" />
                            )}
                            Lưu Thay Đổi
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
