'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { CustomerCard, User, Setting } from '@/types';
import { formatDate } from '@/lib/utils';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  AlertCircle, 
  Calendar, 
  CreditCard,
  X,
  Save,
  Loader2,
  Filter,
  CheckCircle2,
  Clock,
  ArrowRight
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function CustomerCardsPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [cards, setCards] = useState<CustomerCard[]>([]);
    const [filteredCards, setFilteredCards] = useState<CustomerCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingCard, setEditingCard] = useState<CustomerCard | null>(null);
    const [modalLoading, setModalLoading] = useState(false);
    
    // Form state
    const [form, setForm] = useState({
        customer_name: '',
        bank: '',
        card_type: '',
        last4: '',
        expiry_date: '',
        payment_date: 1,
        statement_date: 1,
        credit_limit: 0,
        notes: ''
    });

    const [cardStats, setCardStats] = useState<{[key: string]: number}>({});

    const [settings, setSettings] = useState<{
        banks: string[];
        cardTypes: string[];
    }>({
        banks: [],
        cardTypes: [],
    });

    useEffect(() => {
        const userData = localStorage.getItem('ozifin_user');
        if (userData) {
            const parsedUser = JSON.parse(userData);
            setUser(parsedUser);
            loadCards();
            loadSettings();
        } else {
            router.push('/login');
        }
    }, []);

    useEffect(() => {
        if (searchTerm.trim() === '') {
            setFilteredCards(cards);
        } else {
            const lowTerm = searchTerm.toLowerCase();
            setFilteredCards(
                cards.filter(c => 
                    c.customer_name.toLowerCase().includes(lowTerm) ||
                    c.bank.toLowerCase().includes(lowTerm) ||
                    c.last4.includes(lowTerm)
                )
            );
        }
    }, [searchTerm, cards]);

    const loadSettings = async () => {
        try {
            const { data } = await supabase.from('settings').select('*');
            if (data) {
                const banks = data.filter(s => s.category === 'bank').map(s => s.value);
                const cardTypes = data.filter(s => s.category === 'cardType').map(s => s.value);
                setSettings({ banks, cardTypes });
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    };

    const loadCards = async () => {
        setLoading(true);
        try {
            const { data: cardsData, error } = await supabase
                .from('customer_cards')
                .select('*')
                .order('customer_name', { ascending: true });
            
            if (error) throw error;
            let fetchedCards = cardsData || [];
            
            // Sort cards by nearest payment date
            const now = new Date();
            const today = now.getDate();
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

            fetchedCards.sort((a, b) => {
                const pA = a.payment_date || 1;
                const pB = b.payment_date || 1;
                
                let diffA = pA - today;
                if (diffA < 0) diffA += daysInMonth;
                
                let diffB = pB - today;
                if (diffB < 0) diffB += daysInMonth;
                
                return diffA - diffB;
            });

            setCards(fetchedCards);

            // Calculate range to fetch transactions (from start of previous month to cover all cycles)
            const startRange = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
            
            const { data: transData } = await supabase
                .from('transactions')
                .select('customer, bank, last4, amount, timestamp')
                .gte('timestamp', startRange);

            if (transData) {
                const stats: {[key: string]: number} = {};
                
                fetchedCards.forEach(card => {
                    const key = `${card.customer_name}-${card.bank}-${card.last4}`;
                    if (!card.statement_date || !card.payment_date) {
                        stats[key] = 0;
                        return;
                    }

                    // Calculate this card's current cycle range
                    let startDate, endDate;
                    if (now.getDate() >= card.statement_date) {
                        startDate = new Date(now.getFullYear(), now.getMonth(), card.statement_date);
                        if (card.statement_date <= card.payment_date) {
                            endDate = new Date(now.getFullYear(), now.getMonth(), card.payment_date, 23, 59, 59);
                        } else {
                            endDate = new Date(now.getFullYear(), now.getMonth() + 1, card.payment_date, 23, 59, 59);
                        }
                    } else {
                        startDate = new Date(now.getFullYear(), now.getMonth() - 1, card.statement_date);
                        if (card.statement_date <= card.payment_date) {
                            endDate = new Date(now.getFullYear(), now.getMonth() - 1, card.payment_date, 23, 59, 59);
                        } else {
                            endDate = new Date(now.getFullYear(), now.getMonth(), card.payment_date, 23, 59, 59);
                        }
                    }

                    // Filter and sum transactions for this card within its cycle
                    const total = transData
                        .filter(t => {
                            const tDate = new Date(t.timestamp);
                            return t.customer === card.customer_name && 
                                   t.bank === card.bank && 
                                   t.last4 === card.last4 &&
                                   tDate >= startDate && tDate <= endDate;
                        })
                        .reduce((sum, t) => sum + Number(t.amount), 0);
                    
                    stats[key] = total;
                });
                setCardStats(stats);
            }
        } catch (error) {
            console.error('Error loading cards:', error);
            toast.error('Lỗi khi tải danh sách thẻ');
        } finally {
            setLoading(false);
        }
    };

    const handleAddClick = () => {
        setEditingCard(null);
        setForm({
            customer_name: '',
            bank: '',
            card_type: '',
            last4: '',
            expiry_date: '',
            payment_date: 1,
            statement_date: 1,
            credit_limit: 0,
            notes: ''
        });
        setShowModal(true);
    };

    const handleEditClick = (card: CustomerCard) => {
        setEditingCard(card);
        setForm({
            customer_name: card.customer_name,
            bank: card.bank,
            card_type: card.card_type,
            last4: card.last4,
            expiry_date: card.expiry_date || '',
            payment_date: card.payment_date || 1,
            statement_date: card.statement_date || 1,
            credit_limit: card.credit_limit || 0,
            notes: card.notes || ''
        });
        setShowModal(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Bạn có chắc chắn muốn xóa thẻ này?')) return;
        
        try {
            const { error } = await supabase.from('customer_cards').delete().eq('id', id);
            if (error) throw error;
            toast.success('Đã xóa thẻ');
            loadCards();
        } catch (error) {
            console.error('Error deleting card:', error);
            toast.error('Lỗi khi xóa thẻ');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setModalLoading(true);
        
        try {
            const cardData = {
                ...form,
                expiry_date: form.expiry_date || null, // Convert empty string to null
                created_by: user?.username,
                updated_at: new Date().toISOString()
            };

            if (editingCard) {
                const { error } = await supabase
                    .from('customer_cards')
                    .update(cardData)
                    .eq('id', editingCard.id);
                if (error) throw error;
                toast.success('Đã cập nhật thẻ');
            } else {
                const { error } = await supabase
                    .from('customer_cards')
                    .insert([{ ...cardData, created_at: new Date().toISOString() }]);
                if (error) throw error;
                toast.success('Đã thêm thẻ mới');
            }
            
            setShowModal(false);
            loadCards();
        } catch (error: any) {
            console.error('Error saving card:', error);
            toast.error(error.message || 'Lỗi khi lưu thẻ');
        } finally {
            setModalLoading(false);
        }
    };

    const isExpiringSoon = (expiryDate: string | undefined) => {
        if (!expiryDate) return false;
        const now = new Date();
        const exp = new Date(expiryDate);
        const diffTime = exp.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 10;
    };

    return (
        <div className="space-y-6 animate-in pb-24 h-full flex flex-col">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-800">Quản Lý Thẻ Khách Hàng</h1>
                    <p className="text-gray-500">Lưu trữ và theo dõi thời hạn thẻ</p>
                </div>
                <button
                    onClick={handleAddClick}
                    className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 transition-all active:scale-95"
                >
                    <Plus className="w-5 h-5" />
                    Thêm Thẻ Mới
                </button>
            </div>

            {/* Actions & Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Tìm kiếm theo tên khách hàng, ngân hàng hoặc 4 số cuối..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-gray-100 focus:border-indigo-500 outline-none transition-all shadow-sm"
                    />
                </div>
            </div>

            {/* Content Area */}
            <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden flex-1 flex flex-col relative">
                {loading && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                            <p className="text-indigo-600 font-bold animate-pulse">Đang tải dữ liệu...</p>
                        </div>
                    </div>
                )}

                <div className="overflow-x-auto h-full overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50/50 sticky top-0 z-10 backdrop-blur-md">
                            <tr>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Khách Hàng & Thẻ</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Kỳ Hạn (Sao kê/Thanh toán)</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Dư Nợ / Hạn Mức</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Trạng Thái Tháng Này</th>
                                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 text-center">Thao Tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredCards.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-4 grayscale opacity-40">
                                            <CreditCard className="w-16 h-16 text-gray-300" />
                                            <p className="font-bold text-gray-400 text-lg">Chưa có thông tin thẻ nào</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredCards.map((card) => {
                                    const nearExpiry = isExpiringSoon(card.expiry_date);
                                    const key = `${card.customer_name}-${card.bank}-${card.last4}`;
                                    const processedAmount = cardStats[key] || 0;
                                    const isCompleted = card.credit_limit ? processedAmount >= card.credit_limit : processedAmount > 0;
                                    const progress = card.credit_limit ? Math.min((processedAmount / card.credit_limit) * 100, 100) : (processedAmount > 0 ? 100 : 0);

                                    return (
                                        <tr key={card.id} className="group hover:bg-slate-50/50 transition-all duration-300">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm transition-all group-hover:scale-110 ${
                                                        isCompleted ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-50 text-indigo-500'
                                                    }`}>
                                                        <CreditCard className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <div className="font-black text-gray-800 text-lg uppercase group-hover:text-indigo-600 transition-colors">
                                                            {card.customer_name}
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-xs font-black text-gray-400 uppercase">{card.bank}</span>
                                                            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                                            <span className="text-xs font-mono font-bold text-indigo-500">•••• {card.last4}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <span className="w-20 text-xs font-black text-gray-400 uppercase">Sao kê:</span>
                                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-lg font-bold">Ngày {card.statement_date || '--'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <span className="w-20 text-xs font-black text-gray-400 uppercase">Thanh toán:</span>
                                                        <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-lg font-bold border border-amber-100">Ngày {card.payment_date || '--'}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="font-black text-gray-800 text-lg">
                                                    {formatCurrency(card.credit_limit || 0)}
                                                </div>
                                                {nearExpiry && (
                                                    <div className="text-[10px] font-black text-rose-500 flex items-center justify-end gap-1 mt-1 animate-pulse uppercase">
                                                        <AlertCircle className="w-3 h-3" />
                                                        Sắp hết hạn ({formatDate(card.expiry_date || '')})
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-2 min-w-[150px]">
                                                    <div className="flex justify-between items-end mb-1">
                                                        <span className={`text-[10px] font-black uppercase tracking-wider ${isCompleted ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                            {isCompleted ? 'Đã hoàn thành' : 'Đang thực hiện'}
                                                        </span>
                                                        <span className="text-xs font-mono font-bold text-gray-500">
                                                            {formatCurrency(processedAmount)}
                                                        </span>
                                                    </div>
                                                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden border border-gray-50 shadow-inner">
                                                        <div 
                                                            className={`h-full transition-all duration-1000 ease-out ${
                                                                isCompleted ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                                                            }`}
                                                            style={{ width: `${progress}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-center gap-2">
                                                    <button
                                                        onClick={() => handleEditClick(card)}
                                                        className="p-3 text-indigo-600 hover:bg-white hover:shadow-lg rounded-2xl transition-all border border-transparent hover:border-indigo-100"
                                                        title="Sửa thông tin"
                                                    >
                                                        <Edit className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(card.id)}
                                                        className="p-3 text-rose-500 hover:bg-rose-50 rounded-2xl transition-all"
                                                        title="Xóa thẻ"
                                                    >
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in transition-all" onClick={() => setShowModal(false)} />
                    
                    <div className="relative bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl shadow-indigo-500/10 border border-white p-8 animate-in zoom-in-95 overflow-hidden">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                                    <CreditCard className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-gray-800">
                                        {editingCard ? 'Cập Nhật Thẻ' : 'Thêm Thẻ Mới'}
                                    </h2>
                                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Thông tin bảo mật cho khách hàng</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="w-10 h-10 rounded-2xl bg-gray-50 hover:bg-rose-50 hover:text-rose-500 text-gray-400 flex items-center justify-center transition-all group"
                            >
                                <X className="w-6 h-6 group-hover:scale-110 transition-transform" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 gap-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Tên khách hàng</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="NHẬP TÊN KHÁCH HÀNG"
                                            value={form.customer_name}
                                            onChange={(e) => setForm({ ...form, customer_name: e.target.value.toUpperCase() })}
                                            className="w-full px-5 py-4 rounded-2xl border-2 border-gray-100 focus:border-indigo-500 bg-gray-50/50 outline-none font-bold text-gray-700 transition-all focus:bg-white focus:shadow-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">4 số cuối</label>
                                        <input
                                            type="text"
                                            required
                                            maxLength={4}
                                            placeholder="XXXX"
                                            value={form.last4}
                                            onChange={(e) => setForm({ ...form, last4: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                                            className="w-full px-5 py-4 rounded-2xl border-2 border-gray-100 focus:border-indigo-500 bg-gray-50/50 outline-none font-mono text-center text-xl font-black text-indigo-600 tracking-widest transition-all focus:bg-white"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Ngân hàng</label>
                                        <input
                                            list="modal-banks"
                                            required
                                            value={form.bank}
                                            onChange={(e) => setForm({ ...form, bank: e.target.value })}
                                            className="w-full px-5 py-4 rounded-2xl border-2 border-gray-100 focus:border-indigo-500 bg-gray-50/50 outline-none font-bold text-gray-700 transition-all focus:bg-white"
                                        />
                                        <datalist id="modal-banks">
                                            {settings.banks.map(b => <option key={b} value={b} />)}
                                        </datalist>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Loại thẻ</label>
                                        <input
                                            list="modal-cardTypes"
                                            required
                                            value={form.card_type}
                                            onChange={(e) => setForm({ ...form, card_type: e.target.value })}
                                            className="w-full px-5 py-4 rounded-2xl border-2 border-gray-100 focus:border-indigo-500 bg-gray-50/50 outline-none font-bold text-gray-700 transition-all focus:bg-white"
                                        />
                                        <datalist id="modal-cardTypes">
                                            {settings.cardTypes.map(c => <option key={c} value={c} />)}
                                        </datalist>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Số dư nợ (Hạn mức)</label>
                                        <input
                                            type="number"
                                            required
                                            placeholder="Chưa nhập"
                                            value={form.credit_limit}
                                            onChange={(e) => setForm({ ...form, credit_limit: parseFloat(e.target.value) || 0 })}
                                            className="w-full px-5 py-4 rounded-2xl border-2 border-gray-100 focus:border-indigo-500 bg-gray-50/50 outline-none font-bold text-gray-700 transition-all focus:bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Ngày sao kê</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={31}
                                            value={form.statement_date}
                                            onChange={(e) => setForm({ ...form, statement_date: parseInt(e.target.value) || 1 })}
                                            className="w-full px-5 py-4 rounded-2xl border-2 border-gray-100 focus:border-indigo-500 bg-gray-50/50 outline-none font-bold text-gray-700 transition-all focus:bg-white text-center"
                                        />
                                        <p className="text-[10px] text-gray-400 mt-1 text-center font-bold">Ngày hàng tháng (1-31)</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Ngày hết hạn (Tuỳ chọn)</label>
                                        <input
                                            type="date"
                                            value={form.expiry_date}
                                            onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                                            className="w-full px-5 py-4 rounded-2xl border-2 border-gray-100 focus:border-indigo-500 bg-gray-50/50 outline-none font-bold text-gray-700 transition-all focus:bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Ngày thanh toán</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={31}
                                            value={form.payment_date}
                                            onChange={(e) => setForm({ ...form, payment_date: parseInt(e.target.value) || 1 })}
                                            className="w-full px-5 py-4 rounded-2xl border-2 border-gray-100 focus:border-indigo-500 bg-gray-50/50 outline-none font-bold text-gray-700 transition-all focus:bg-white text-center"
                                        />
                                        <p className="text-[10px] text-gray-400 mt-1 text-center font-bold">Ngày hàng tháng (1-31)</p>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Ghi chú</label>
                                    <textarea
                                        rows={2}
                                        value={form.notes}
                                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                        className="w-full px-5 py-4 rounded-2xl border-2 border-gray-100 focus:border-indigo-500 bg-gray-50/50 outline-none font-medium text-gray-700 transition-all focus:bg-white resize-none"
                                        placeholder="Ví dụ: Thẻ chính, hạn mức 50tr..."
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-6 py-4 rounded-2xl font-bold text-gray-500 bg-gray-50 hover:bg-gray-100 hover:text-gray-700 transition-all active:scale-95"
                                >
                                    Hủy bỏ
                                </button>
                                <button
                                    type="submit"
                                    disabled={modalLoading}
                                    className="flex-[1.5] px-6 py-4 rounded-2xl font-black text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-xl shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {modalLoading ? (
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                    ) : (
                                        <>
                                            <Save className="w-6 h-6" />
                                            {editingCard ? 'Cập Nhật Ngay' : 'Lưu Thông Tin'}
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                    height: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }
            `}</style>
        </div>
    );
}
