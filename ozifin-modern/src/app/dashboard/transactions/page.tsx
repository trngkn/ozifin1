'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Transaction, User } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Search, Filter, Download, Plus, Edit, Trash2, Eye } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TransactionsPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [showFilters, setShowFilters] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    // Filters
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        customer: '',
        type: '',
    });

    useEffect(() => {
        const userData = localStorage.getItem('ozifin_user');
        if (userData) {
            const parsedUser = JSON.parse(userData);
            setUser(parsedUser);
            loadTransactions(parsedUser);
        }
    }, []);

    useEffect(() => {
        applyFilters();
    }, [transactions, filters]);

    const loadTransactions = async (currentUser: User) => {
        setLoading(true);
        try {
            let query = supabase
                .from('transactions')
                .select('*')
                .order('timestamp', { ascending: false });

            if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
                query = query.eq('created_by', currentUser.username);
            }

            const { data, error } = await query;
            if (error) throw error;

            setTransactions(data || []);
        } catch (error) {
            console.error('Error loading transactions:', error);
            toast.error('Lỗi khi tải dữ liệu');
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = [...transactions];

        if (filters.startDate) {
            filtered = filtered.filter((t) => new Date(t.timestamp) >= new Date(filters.startDate));
        }
        if (filters.endDate) {
            const endDate = new Date(filters.endDate);
            endDate.setHours(23, 59, 59);
            filtered = filtered.filter((t) => new Date(t.timestamp) <= endDate);
        }
        if (filters.customer) {
            filtered = filtered.filter((t) =>
                t.customer.toLowerCase().includes(filters.customer.toLowerCase()) ||
                t.sale.toLowerCase().includes(filters.customer.toLowerCase())
            );
        }
        if (filters.type) {
            filtered = filtered.filter((t) => t.type === filters.type);
        }

        setFilteredTransactions(filtered);
        setCurrentPage(1);
    };

    const handleDelete = async (transaction: Transaction) => {
        if (!confirm(`Xóa giao dịch ${transaction.id}?`)) return;

        try {
            const { error } = await supabase.from('transactions').delete().eq('id', transaction.id);

            if (error) throw error;

            toast.success('Đã xóa giao dịch');
            if (user) loadTransactions(user);
        } catch (error: any) {
            console.error('Error deleting:', error);
            toast.error(error.message || 'Lỗi khi xóa');
        }
    };

    const exportCSV = () => {
        if (filteredTransactions.length === 0) {
            toast.error('Không có dữ liệu để xuất');
            return;
        }

        const headers = ['Mã GD', 'Ngày', 'Sale', 'Đại lý', 'Khách hàng', 'Ngân hàng', 'Loại', 'Số tiền', 'Lợi nhuận', 'Trạng thái'];
        const rows = filteredTransactions.map((t) => [
            t.id,
            formatDate(t.timestamp),
            t.sale,
            t.agency,
            t.customer,
            t.bank,
            t.type,
            t.amount,
            t.profit || 0,
            t.status,
        ]);

        const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        toast.success('Đã xuất file CSV');
    };

    const totalPages = Math.ceil(filteredTransactions.length / pageSize);
    const paginatedTransactions = filteredTransactions.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    );

    const totalVolume = filteredTransactions.reduce((sum, t) => sum + Number(t.amount), 0);

    return (
        <div className="space-y-6 animate-in pb-24">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-800">Danh Sách Giao Dịch</h1>
                    <p className="text-gray-500">Quản lý & Tìm kiếm nâng cao</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="px-4 py-2 bg-white border-2 border-gray-200 hover:border-indigo-500 text-gray-700 rounded-xl font-bold flex items-center gap-2 transition-all"
                    >
                        <Filter className="w-4 h-4" />
                        Lọc
                    </button>
                    <button
                        onClick={exportCSV}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-2 transition-all"
                    >
                        <Download className="w-4 h-4" />
                        Xuất CSV
                    </button>
                </div>
            </div>

            {/* Filters */}
            {showFilters && (
                <div className="bg-indigo-50 rounded-2xl border-2 border-indigo-100 p-6 animate-in">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Từ ngày</label>
                            <input
                                type="date"
                                value={filters.startDate}
                                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                                className="w-full px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Đến ngày</label>
                            <input
                                type="date"
                                value={filters.endDate}
                                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                                className="w-full px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Khách hàng</label>
                            <input
                                type="text"
                                value={filters.customer}
                                onChange={(e) => setFilters({ ...filters, customer: e.target.value })}
                                placeholder="Tìm tên..."
                                className="w-full px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Loại GD</label>
                            <select
                                value={filters.type}
                                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                                className="w-full px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none"
                            >
                                <option value="">Tất cả</option>
                                <option value="Rút">Rút</option>
                                <option value="Đáo">Đáo</option>
                                <option value="Rút+Đáo">Rút+Đáo</option>
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats */}
            {filteredTransactions.length > 0 && (
                <div className="flex gap-4 flex-wrap">
                    <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-bold">
                        Tổng: {filteredTransactions.length} GD
                    </div>
                    <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full text-sm font-bold">
                        Volume: {formatCurrency(totalVolume)}
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                {loading && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600"></div>
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr className="text-xs text-gray-500 uppercase tracking-wider">
                                <th className="px-4 py-3 text-left font-semibold">Mã GD / Thời gian</th>
                                <th className="px-4 py-3 text-left font-semibold">Khách hàng / Sale</th>
                                <th className="px-4 py-3 text-left font-semibold">Thẻ</th>
                                <th className="px-4 py-3 text-left font-semibold">Loại</th>
                                <th className="px-4 py-3 text-right font-semibold">Số tiền</th>
                                <th className="px-4 py-3 text-right font-semibold">Lợi nhuận</th>
                                <th className="px-4 py-3 text-center font-semibold">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {paginatedTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                                        Không tìm thấy giao dịch nào
                                    </td>
                                </tr>
                            ) : (
                                paginatedTransactions.map((t) => (
                                    <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-4">
                                            <div className="font-bold text-gray-800">{t.id}</div>
                                            <div className="text-xs text-gray-500">{formatDate(t.timestamp)}</div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="font-bold text-gray-800">{t.customer}</div>
                                            <div className="text-xs text-indigo-600">{t.sale}</div>
                                            <div className="text-xs text-gray-500">{t.agency}</div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="font-medium text-gray-700">{t.bank}</div>
                                            <div className="text-xs text-gray-500">
                                                {t.card_type} •••{t.last4}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span
                                                className={`px-3 py-1 rounded-full text-xs font-bold ${t.type.includes('Rút')
                                                    ? 'bg-orange-100 text-orange-600'
                                                    : 'bg-blue-100 text-blue-600'
                                                    }`}
                                            >
                                                {t.type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-right font-mono font-bold text-gray-700">
                                            {formatCurrency(t.amount)}
                                        </td>
                                        <td className="px-4 py-4 text-right font-mono font-bold text-emerald-600">
                                            +{formatCurrency(t.profit || 0)}
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex justify-center gap-2">
                                                <button
                                                    onClick={() => router.push(`/dashboard/transactions/${t.id}?view=true`)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Xem chi tiết"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => router.push(`/dashboard/transactions/${t.id}`)}
                                                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                    title="Sửa"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                {(user?.role === 'admin' || user?.role === 'manager') && (
                                                    <button
                                                        onClick={() => handleDelete(t)}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Xóa"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex justify-between items-center px-6 py-4 border-t border-gray-100 bg-gray-50">
                        <span className="text-sm text-gray-500">
                            Trang {currentPage} / {totalPages}
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                ← Trước
                            </button>
                            <button
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Sau →
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* FAB */}
            <button
                onClick={() => router.push('/dashboard/transactions/new')}
                className="fixed bottom-8 right-8 w-16 h-16 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 z-40"
            >
                <Plus className="w-8 h-8" />
            </button>
        </div>
    );
}
