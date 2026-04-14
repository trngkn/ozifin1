'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Transaction, DashboardStats, User, CustomerCard } from '@/types';
import { formatCurrency, formatDate, getGreeting } from '@/lib/utils';
import { TrendingUp, DollarSign, CreditCard, Activity, Plus, AlertCircle, Calendar, Clock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

export default function DashboardPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [stats, setStats] = useState<DashboardStats>({
        totalVolume: 0,
        totalProfit: 0,
        transactionCount: 0,
        avgProfit: 0,
    });
    const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
    const [chartDataVolume, setChartDataVolume] = useState<any>(null);
    const [chartDataProfit, setChartDataProfit] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [pendingPayments, setPendingPayments] = useState<any[]>([]);

    useEffect(() => {
        const userData = localStorage.getItem('ozifin_user');
        if (userData) {
            setUser(JSON.parse(userData));
            loadDashboardData(JSON.parse(userData));
            loadPendingPayments();
        }
    }, [selectedMonth, selectedYear]);

    const loadPendingPayments = async () => {
        try {
            const now = new Date();
            const today = now.getDate();

            // 1. Fetch all customer cards
            const { data: cards } = await supabase.from('customer_cards').select('*');
            if (!cards || cards.length === 0) return;

            // 2. Fetch transactions from last 45 days to cover cycles
            const fortyFiveDaysAgo = new Date();
            fortyFiveDaysAgo.setDate(now.getDate() - 45);

            const { data: trans } = await supabase
                .from('transactions')
                .select('*')
                .gte('timestamp', fortyFiveDaysAgo.toISOString());

            const transactions = trans || [];

            // 3. Process each card to find pending balances
            const pending = cards.map(card => {
                const statementDay = card.statement_date || 1;
                const paymentDay = card.payment_date || 1;

                // Calculate current cycle start/end
                let startDate, endDate;
                if (today >= statementDay) {
                    startDate = new Date(now.getFullYear(), now.getMonth(), statementDay);
                    if (statementDay <= paymentDay) {
                        endDate = new Date(now.getFullYear(), now.getMonth(), paymentDay, 23, 59, 59);
                    } else {
                        endDate = new Date(now.getFullYear(), now.getMonth() + 1, paymentDay, 23, 59, 59);
                    }
                } else {
                    startDate = new Date(now.getFullYear(), now.getMonth() - 1, statementDay);
                    if (statementDay <= paymentDay) {
                        endDate = new Date(now.getFullYear(), now.getMonth() - 1, paymentDay, 23, 59, 59);
                    } else {
                        endDate = new Date(now.getFullYear(), now.getMonth(), paymentDay, 23, 59, 59);
                    }
                }

                // Sum transactions for this card in this cycle
                const paidAmount = transactions
                    .filter(t => 
                        t.customer === card.customer_name && 
                        t.bank === card.bank && 
                        t.last4 === card.last4 &&
                        new Date(t.timestamp) >= startDate &&
                        new Date(t.timestamp) <= endDate
                    )
                    .reduce((sum, t) => sum + Number(t.amount), 0);

                const limit = Number(card.credit_limit || 0);
                const remaining = Math.max(0, limit - paidAmount);
                
                // Days remaining
                const diffTime = endDate.getTime() - now.getTime();
                const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                return {
                    ...card,
                    paidAmount,
                    remaining,
                    daysLeft,
                    isFullyPaid: limit > 0 ? paidAmount >= limit : paidAmount > 0
                };
            })
            .filter(p => !p.isFullyPaid && p.daysLeft >= -2 && p.daysLeft <= 15) // Show only unpaid cards due within 15 days
            .sort((a, b) => a.daysLeft - b.daysLeft);

            setPendingPayments(pending);
        } catch (error) {
            console.error('Error loading pending payments:', error);
        }
    };

    const loadDashboardData = async (currentUser: User) => {
        setLoading(true);
        try {
            // Build query
            let query = supabase
                .from('transactions')
                .select('*')
                .order('timestamp', { ascending: false });

            // Filter by user role
            // Filter by user role
            if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
                query = query.eq('created_by', currentUser.username);
            }

            // Filter by date
            const startDate = new Date(selectedYear, selectedMonth - 1, 1);
            const endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59);
            query = query.gte('timestamp', startDate.toISOString()).lte('timestamp', endDate.toISOString());

            const { data, error } = await query;

            if (error) throw error;

            const transactions = data || [];

            // Calculate stats
            const totalVolume = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
            const totalProfit = transactions.reduce((sum, t) => sum + Number(t.profit || 0), 0);
            const avgProfit = transactions.length > 0 ? totalProfit / transactions.length : 0;

            setStats({
                totalVolume,
                totalProfit,
                transactionCount: transactions.length,
                avgProfit,
            });

            setRecentTransactions(transactions.slice(0, 5));

            // Prepare chart data
            const dailyData: { [key: number]: { volume: number; profit: number } } = {};
            transactions.forEach((t) => {
                const day = new Date(t.timestamp).getDate();
                if (!dailyData[day]) {
                    dailyData[day] = { volume: 0, profit: 0 };
                }
                dailyData[day].volume += Number(t.amount);
                dailyData[day].profit += Number(t.profit || 0);
            });

            const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
            const labels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`);
            const volumeData = labels.map((day) => dailyData[parseInt(day)]?.volume || 0);
            const profitData = labels.map((day) => dailyData[parseInt(day)]?.profit || 0);

            setChartDataVolume({
                labels,
                datasets: [
                    {
                        label: 'Doanh thu',
                        data: volumeData,
                        borderColor: 'rgb(99, 102, 241)',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        fill: true,
                        tension: 0.4,
                    },
                ],
            });

            setChartDataProfit({
                labels,
                datasets: [
                    {
                        label: 'Lợi nhuận',
                        data: profitData,
                        borderColor: 'rgb(16, 185, 129)',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        fill: true,
                        tension: 0.4,
                    },
                ],
            });
        } catch (error) {
            console.error('Error loading dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600"></div>
            </div>
        );
    }

    const chartOptions: any = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top',
            },
            tooltip: {
                callbacks: {
                    label: function (context: any) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += new Intl.NumberFormat('vi-VN').format(context.parsed.y) + ' VNĐ';
                        }
                        return label;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: function (value: any) {
                        return new Intl.NumberFormat('vi-VN', { notation: 'compact' }).format(value);
                    }
                }
            },
        },
    };

    return (
        <div className="space-y-6 animate-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-800 mb-1">
                        {getGreeting()}, {user?.display_name}! 👋
                    </h1>
                    <p className="text-gray-500">Tổng quan hoạt động kinh doanh</p>
                </div>
                <div className="flex gap-2">
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        className="px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none font-medium"
                    >
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>
                                Tháng {i + 1}
                            </option>
                        ))}
                    </select>
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none font-medium"
                    >
                        {[2024, 2025, 2026].map((year) => (
                            <option key={year} value={year}>
                                {year}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Tổng doanh thu"
                    value={formatCurrency(stats.totalVolume)}
                    icon={<DollarSign className="w-6 h-6" />}
                    color="from-blue-500 to-cyan-500"
                />
                <StatCard
                    title="Lợi nhuận"
                    value={formatCurrency(stats.totalProfit)}
                    icon={<TrendingUp className="w-6 h-6" />}
                    color="from-emerald-500 to-green-500"
                />
                <StatCard
                    title="Số giao dịch"
                    value={stats.transactionCount.toString()}
                    icon={<CreditCard className="w-6 h-6" />}
                    color="from-purple-500 to-pink-500"
                    onClick={() => router.push('/dashboard/transactions')}
                />
                <StatCard
                    title="Thẻ khách hàng"
                    value="Quản lý thẻ"
                    icon={<Plus className="w-6 h-6" />}
                    color="from-orange-500 to-red-500"
                    onClick={() => router.push('/dashboard/customer-cards')}
                />
            </div>

            {/* Pending Payments Section */}
            {pendingPayments.length > 0 && (
                <div className="bg-white rounded-3xl shadow-xl shadow-indigo-100/20 border border-indigo-50 p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
                                <AlertCircle className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight">Thẻ Cần Thanh Toán</h2>
                                <p className="text-sm text-gray-500 font-medium">Danh sách thẻ đang đến hạn ({pendingPayments.length} thẻ)</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => router.push('/dashboard/customer-cards')}
                            className="text-indigo-600 hover:text-indigo-700 font-bold text-sm flex items-center gap-1 group"
                        >
                            Xem tất cả thẻ <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {pendingPayments.map((card) => {
                            const isUrgent = card.daysLeft <= 0;
                            const isWarning = card.daysLeft > 0 && card.daysLeft <= 3;
                            
                            const cardColor = isUrgent 
                                ? 'bg-rose-50 border-rose-100 hover:border-rose-300' 
                                : isWarning 
                                    ? 'bg-amber-50 border-amber-100 hover:border-amber-300' 
                                    : 'bg-slate-50 border-slate-100 hover:border-indigo-200';

                            const iconColor = isUrgent ? 'text-rose-500' : isWarning ? 'text-amber-500' : 'text-indigo-500';
                            const badgeColor = isUrgent 
                                ? 'bg-rose-500 text-white' 
                                : isWarning 
                                    ? 'bg-amber-100 text-amber-700' 
                                    : 'bg-indigo-100 text-indigo-700';

                            return (
                                <div 
                                    key={card.id} 
                                    onClick={() => router.push(`/dashboard/transactions/new?customer=${encodeURIComponent(card.customer_name)}&bank=${encodeURIComponent(card.bank)}&card_type=${encodeURIComponent(card.card_type)}&last4=${card.last4}&amount=${card.remaining}&type=Đáo`)}
                                    className={`p-3.5 rounded-[1.5rem] border-2 transition-all hover:shadow-md cursor-pointer active:scale-95 flex flex-col justify-between group ${cardColor}`}
                                >
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm shrink-0">
                                                    <CreditCard className={`w-4 h-4 ${iconColor}`} />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-black text-gray-800 uppercase text-[11px] leading-tight truncate">{card.customer_name}</div>
                                                    <div className="text-[9px] font-bold text-gray-400 uppercase tracking-tight truncate">{card.bank} • {card.last4}</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-white/60 rounded-xl p-2.5 space-y-2">
                                            <div className="flex justify-between items-center text-[10px]">
                                                <span className="text-gray-400 font-bold uppercase">Cần đáo</span>
                                                <span className="font-black text-gray-800">{formatCurrency(card.credit_limit || 0)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-[10px]">
                                                <span className="text-gray-400 font-bold uppercase">Đã làm</span>
                                                <span className="font-black text-emerald-600">{formatCurrency(card.paidAmount)}</span>
                                            </div>
                                            <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full transition-all duration-1000 ${isUrgent ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-indigo-500'}`}
                                                    style={{ width: `${Math.min((card.paidAmount / (card.credit_limit || 1)) * 100, 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                                        <div className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1 ${badgeColor}`}>
                                            <Clock className="w-2.5 h-2.5" />
                                            {card.daysLeft < 0 ? 'Quá hạn' : card.daysLeft === 0 ? 'Hôm nay' : `${card.daysLeft} ngày`}
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[12px] font-black text-rose-600 leading-none">{formatCurrency(card.remaining)}</div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {chartDataVolume && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                        <h2 className="text-xl font-bold text-gray-800 mb-4">Biểu đồ Doanh Thu</h2>
                        <Line
                            data={chartDataVolume}
                            options={chartOptions}
                        />
                    </div>
                )}
                {chartDataProfit && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                        <h2 className="text-xl font-bold text-gray-800 mb-4">Biểu đồ Lợi Nhuận</h2>
                        <Line
                            data={chartDataProfit}
                            options={chartOptions}
                        />
                    </div>
                )}
            </div>

            {/* Recent Transactions */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-800">Giao dịch gần đây</h2>
                    <button
                        onClick={() => router.push('/dashboard/transactions')}
                        className="text-indigo-600 hover:text-indigo-700 font-medium text-sm flex items-center gap-1"
                    >
                        Xem tất cả →
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr className="text-xs text-gray-500 uppercase tracking-wider">
                                <th className="px-6 py-3 text-left font-semibold">Mã GD</th>
                                <th className="px-6 py-3 text-left font-semibold">Khách hàng</th>
                                <th className="px-6 py-3 text-left font-semibold">Loại</th>
                                <th className="px-6 py-3 text-right font-semibold">Số tiền</th>
                                <th className="px-6 py-3 text-right font-semibold">Lợi nhuận</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {recentTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                                        Chưa có giao dịch nào
                                    </td>
                                </tr>
                            ) : (
                                recentTransactions.map((t) => (
                                    <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-800">{t.id}</div>
                                            <div className="text-xs text-gray-500">{formatDate(t.timestamp)}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-800">{t.customer}</div>
                                            <div className="text-xs text-gray-500">{t.bank}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span
                                                className={`px-3 py-1 rounded-full text-xs font-bold ${t.type.includes('Rút')
                                                    ? 'bg-orange-100 text-orange-600'
                                                    : 'bg-blue-100 text-blue-600'
                                                    }`}
                                            >
                                                {t.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono font-bold text-gray-700">
                                            {formatCurrency(t.amount)}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono font-bold text-emerald-600">
                                            +{formatCurrency(t.profit || 0)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
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

function StatCard({
    title,
    value,
    icon,
    color,
    onClick
}: {
    title: string;
    value: string;
    icon: React.ReactNode;
    color: string;
    onClick?: () => void;
}) {
    return (
        <div 
            onClick={onClick}
            className={`bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-all ${onClick ? 'cursor-pointer hover:border-indigo-300 active:scale-95' : ''}`}
        >
            <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white shadow-lg`}>
                    {icon}
                </div>
            </div>
            <div className="text-sm font-medium text-gray-500 mb-1">{title}</div>
            <div className="text-2xl font-black text-gray-800">{value}</div>
        </div>
    );
}
