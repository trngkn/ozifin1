'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@/types';
import { formatDate } from '@/lib/utils';
import { Plus, Search, Trash2, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newUser, setNewUser] = useState({
        username: '',
        password: '',
        display_name: '',
        role: 'sale' as 'admin' | 'manager' | 'sale',
    });
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const userData = localStorage.getItem('ozifin_user');
        if (userData) {
            const user = JSON.parse(userData);
            setCurrentUser(user);
            if (user.role !== 'admin' && user.role !== 'manager') {
                toast.error('Bạn không có quyền truy cập');
            } else {
                loadUsers();
            }
        }
    }, []);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setUsers(data || []);
        } catch (error) {
            console.error('Error loading users:', error);
            toast.error('Lỗi khi tải danh sách người dùng');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Check if username exists
            const { data: existing } = await supabase
                .from('users')
                .select('id')
                .eq('username', newUser.username)
                .single();

            if (existing) {
                toast.error('Tên đăng nhập đã tồn tại');
                return;
            }

            const { error } = await supabase.from('users').insert({
                username: newUser.username,
                password_hash: newUser.password,
                display_name: newUser.display_name,
                role: newUser.role,
            });

            if (error) throw error;

            toast.success('Đã tạo người dùng mới');
            setShowAddModal(false);
            setNewUser({ username: '', password: '', display_name: '', role: 'sale' });
            loadUsers();
        } catch (error: any) {
            console.error('Error creating user:', error);
            toast.error(error.message || 'Lỗi khi tạo người dùng');
        }
    };

    const handleDeleteUser = async (user: User) => {
        if (!confirm(`Bạn có chắc muốn xóa người dùng ${user.display_name}?`)) return;

        if (user.username === 'admin') {
            toast.error('Không thể xóa tài khoản admin gốc');
            return;
        }

        try {
            const { error } = await supabase.from('users').delete().eq('id', user.id);
            if (error) throw error;
            toast.success('Đã xóa người dùng');
            loadUsers();
        } catch (error: any) {
            console.error('Error deleting user:', error);
            toast.error('Lỗi khi xóa người dùng');
        }
    };

    const filteredUsers = users.filter(u =>
        u.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in pb-24">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-800">Quản Lý Người Dùng</h1>
                    <p className="text-gray-500">Danh sách nhân viên & phân quyền</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold flex items-center gap-2 hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-200"
                >
                    <UserPlus className="w-5 h-5" />
                    Thêm User
                </button>
            </div>

            {/* Search */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-2">
                <Search className="w-5 h-5 text-gray-400" />
                <input
                    type="text"
                    placeholder="Tìm kiếm người dùng..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 outline-none font-medium text-gray-700"
                />
            </div>

            {/* List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr className="text-xs text-gray-500 uppercase tracking-wider">
                                <th className="px-6 py-3 text-left font-semibold">Người dùng</th>
                                <th className="px-6 py-3 text-left font-semibold">Username</th>
                                <th className="px-6 py-3 text-left font-semibold">Vai trò</th>
                                <th className="px-6 py-3 text-left font-semibold">Ngày tạo</th>
                                <th className="px-6 py-3 text-right font-semibold">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                                                {user.avatar_url ? (
                                                    <img src={user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                                ) : (
                                                    user.display_name.charAt(0).toUpperCase()
                                                )}
                                            </div>
                                            <div className="font-bold text-gray-800">{user.display_name}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">{user.username}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize
                                            ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                                                user.role === 'manager' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-xs text-gray-500">{formatDate(user.created_at)}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleDeleteUser(user)}
                                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Xóa"
                                            disabled={user.username === 'admin'}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold">Thêm Người Dùng Mới</h2>
                            <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                                <Plus className="w-6 h-6 rotate-45" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Tên hiển thị</label>
                                <input
                                    type="text"
                                    required
                                    value={newUser.display_name}
                                    onChange={e => setNewUser({ ...newUser, display_name: e.target.value })}
                                    className="w-full px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none"
                                    placeholder="Ví dụ: Nguyễn Văn A"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Tên đăng nhập</label>
                                <input
                                    type="text"
                                    required
                                    value={newUser.username}
                                    onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                                    className="w-full px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none"
                                    placeholder="user123"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Mật khẩu</label>
                                <input
                                    type="password"
                                    required
                                    value={newUser.password}
                                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                    className="w-full px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none"
                                    placeholder="••••••"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Vai trò</label>
                                <select
                                    value={newUser.role}
                                    onChange={e => setNewUser({ ...newUser, role: e.target.value as any })}
                                    className="w-full px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none"
                                >
                                    <option value="sale">Sale (Nhân viên)</option>
                                    <option value="manager">Manager (Quản lý)</option>
                                    <option value="admin">Admin (Quản trị)</option>
                                </select>
                            </div>
                            <button
                                type="submit"
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors mt-4"
                            >
                                Tạo người dùng
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
