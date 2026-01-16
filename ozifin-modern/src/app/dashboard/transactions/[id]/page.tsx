'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { uploadToImgBB } from '@/lib/imgbb';
import { Transaction, User, Setting } from '@/types';
import { formatCurrency, parseCurrency, fileToBase64 } from '@/lib/utils';
import { ArrowLeft, Save, Upload, X, Image as ImageIcon, Edit } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TransactionFormPage() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const isEdit = params?.id && params.id !== 'new';
    const isViewMode = searchParams.get('view') === 'true';

    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(false);
    const [settings, setSettings] = useState<{
        agencies: string[];
        banks: string[];
        cardTypes: string[];
        posMachines: string[];
    }>({
        agencies: [],
        banks: [],
        cardTypes: [],
        posMachines: [],
    });

    const [form, setForm] = useState({
        id: '',
        timestamp: new Date().toISOString().split('T')[0],
        sale: '',
        agency: '',
        customer: '',
        bank: '',
        card_type: '',
        last4: '',
        type: 'Rút' as 'Rút' | 'Đáo' | 'Rút+Đáo',
        amount: 0,
        withdraw_amt: 0,
        pos: '',
        pos_fee: 0,
        pos_amt: 0,
        cust_fee: 0,
        cust_amt: 0,
        profit: 0,
        status: 'Đã thanh toán' as 'Chưa thanh toán' | 'Đã thanh toán',
        img_deposit: [] as string[],
        img_withdraw: [] as string[],
        img_invoice: [] as string[],
        created_by: '',
        edit_count: 0,
    });

    const [uploadingImages, setUploadingImages] = useState({
        deposit: false,
        withdraw: false,
        invoice: false,
    });

    useEffect(() => {
        const userData = localStorage.getItem('ozifin_user');
        if (userData) {
            const parsedUser = JSON.parse(userData);
            setUser(parsedUser);
            if (!isEdit) {
                setForm((prev) => ({ ...prev, sale: parsedUser.display_name, created_by: parsedUser.username }));
            }
            loadSettings();
            if (isEdit) {
                loadTransaction(params.id as string);
            }
        }
    }, [isEdit, params]);

    // Auto-calculate amounts
    useEffect(() => {
        const posAmt = Math.round(form.amount * (form.pos_fee / 100));
        const custAmt = Math.round(form.amount * (form.cust_fee / 100));
        const profit = custAmt - posAmt;
        setForm((prev) => ({ ...prev, pos_amt: posAmt, cust_amt: custAmt, profit }));
    }, [form.amount, form.pos_fee, form.cust_fee]);

    const loadSettings = async () => {
        try {
            const { data, error } = await supabase.from('settings').select('*');
            if (error) throw error;

            const grouped = (data || []).reduce((acc: any, item: Setting) => {
                if (!acc[item.category]) acc[item.category] = [];
                acc[item.category].push(item.value);
                return acc;
            }, {});

            setSettings({
                agencies: grouped.agency || [],
                banks: grouped.bank || [],
                cardTypes: grouped.cardType || [],
                posMachines: grouped.pos || [],
            });
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    };

    const loadTransaction = async (id: string) => {
        try {
            const { data, error } = await supabase.from('transactions').select('*').eq('id', id).single();
            if (error) throw error;

            setForm({
                ...data,
                timestamp: new Date(data.timestamp).toISOString().split('T')[0],
                img_deposit: data.img_deposit || [],
                img_withdraw: data.img_withdraw || [],
                img_invoice: data.img_invoice || [],
            });
        } catch (error) {
            console.error('Error loading transaction:', error);
            toast.error('Lỗi khi tải giao dịch');
        }
    };

    const handleImageUpload = async (files: FileList, category: 'deposit' | 'withdraw' | 'invoice') => {
        if (files.length === 0) return;

        setUploadingImages((prev) => ({ ...prev, [category]: true }));
        const fieldName = `img_${category}` as 'img_deposit' | 'img_withdraw' | 'img_invoice';

        try {
            const uploadPromises = Array.from(files).map(async (file) => {
                const base64 = await fileToBase64(file);
                return uploadToImgBB(base64);
            });

            const urls = await Promise.all(uploadPromises);
            setForm((prev) => ({
                ...prev,
                [fieldName]: [...prev[fieldName], ...urls],
            }));
            toast.success(`Đã upload ${urls.length} ảnh`);
        } catch (error: any) {
            console.error('Upload error:', error);
            toast.error(error.message || 'Lỗi khi upload ảnh');
        } finally {
            setUploadingImages((prev) => ({ ...prev, [category]: false }));
        }
    };

    const removeImage = (category: 'img_deposit' | 'img_withdraw' | 'img_invoice', index: number) => {
        setForm((prev) => ({
            ...prev,
            [category]: prev[category].filter((_, i) => i !== index),
        }));
    };

    const generateTransactionId = async (date: string): Promise<string> => {
        const d = new Date(date);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const prefix = `Ozi-${yyyy}-${mm}-`;

        // Get existing transactions with same prefix
        const { data, error } = await supabase
            .from('transactions')
            .select('id')
            .like('id', `${prefix}%`);

        if (error) throw error;

        let maxNum = 0;
        (data || []).forEach((t) => {
            const num = parseInt(t.id.substring(prefix.length));
            if (!isNaN(num) && num > maxNum) maxNum = num;
        });

        const nextNum = maxNum + 1;
        return `${prefix}${String(nextNum).padStart(3, '0')}`;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            let transactionId = form.id;

            if (!isEdit) {
                // Generate new ID
                transactionId = await generateTransactionId(form.timestamp);
            }

            const transactionData = {
                ...form,
                id: transactionId,
                timestamp: new Date(form.timestamp).toISOString(),
                amount: Number(form.amount),
                withdraw_amt: Number(form.withdraw_amt),
                pos_fee: Number(form.pos_fee),
                pos_amt: Number(form.pos_amt),
                cust_fee: Number(form.cust_fee),
                cust_amt: Number(form.cust_amt),
                profit: Number(form.profit),
            };

            if (isEdit) {
                // Check edit permissions
                const canEdit =
                    user?.role === 'admin' ||
                    user?.role === 'manager' ||
                    (user?.username === form.created_by && form.edit_count < 2);

                if (!canEdit) {
                    toast.error('Bạn đã hết lượt sửa (Tối đa 2 lần)');
                    setLoading(false);
                    return;
                }

                const { error } = await supabase
                    .from('transactions')
                    .update({
                        ...transactionData,
                        edit_count: form.edit_count + 1,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', form.id);

                if (error) throw error;
                toast.success('Đã cập nhật giao dịch');
            } else {
                const { error } = await supabase.from('transactions').insert({
                    ...transactionData,
                    edit_count: 0,
                    created_at: new Date().toISOString(),
                });

                if (error) throw error;
                toast.success(`Đã tạo giao dịch ${transactionId}`);
            }

            router.push('/dashboard/transactions');
        } catch (error: any) {
            console.error('Error saving transaction:', error);
            toast.error(error.message || 'Lỗi khi lưu giao dịch');
        } finally {
            setLoading(false);
        }
    };

    const canEditPermission =
        user?.role === 'admin' ||
        user?.role === 'manager' ||
        (user?.username === form.created_by && form.edit_count < 2);

    return (
        <div className="max-w-5xl mx-auto pb-24 animate-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="w-10 h-10 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center shadow-sm transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-3xl font-black text-gray-800">
                        {isViewMode ? 'Chi Tiết Giao Dịch' : (isEdit ? 'Sửa Giao Dịch' : 'Tạo Giao Dịch')}
                    </h1>
                </div>
                <div className="flex items-center gap-3">
                    {isViewMode && canEditPermission && (
                        <button
                            onClick={() => router.push(`/dashboard/transactions/${params.id}`)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
                        >
                            <Edit className="w-4 h-4" />
                            Sửa
                        </button>
                    )}
                    <div className="text-sm text-gray-500 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-200">
                        NV: <b>{user?.display_name}</b>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* General Info */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-bold text-indigo-600 mb-4 flex items-center gap-2">
                        📋 Thông tin chung
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Mã GD</label>
                            <input
                                type="text"
                                value={form.id || 'Tự động tạo'}
                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 bg-gray-50 text-gray-500 font-mono"
                                readOnly
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Đại lý *</label>
                            <input
                                list="agencies"
                                value={form.agency}
                                onChange={(e) => setForm({ ...form, agency: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none disabled:bg-gray-50 disabled:text-gray-500"
                                required
                                disabled={isViewMode}
                            />
                            <datalist id="agencies">
                                {settings.agencies.map((a) => (
                                    <option key={a} value={a} />
                                ))}
                            </datalist>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Ngày GD *</label>
                            <input
                                type="date"
                                value={form.timestamp}
                                onChange={(e) => setForm({ ...form, timestamp: e.target.value })}
                                max={new Date().toISOString().split('T')[0]}
                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none disabled:bg-gray-50 disabled:text-gray-500"
                                required
                                disabled={isViewMode}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Nhân viên Sale</label>
                            <input
                                type="text"
                                value={form.sale}
                                onChange={(e) => setForm({ ...form, sale: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none disabled:bg-gray-50 disabled:text-gray-500"
                                disabled={user?.role === 'sale' || isViewMode}
                            />
                        </div>
                    </div>
                </div>


                {/* Customer & Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-bold text-indigo-600 mb-4 flex items-center gap-2">
                        💳 Thông tin Khách & Thẻ
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="lg:col-span-2">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Tên Khách Hàng *</label>
                            <input
                                type="text"
                                value={form.customer}
                                onChange={(e) => setForm({ ...form, customer: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none disabled:bg-gray-50 disabled:text-gray-500"
                                required
                                disabled={isViewMode}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Ngân Hàng *</label>
                            <input
                                list="banks"
                                value={form.bank}
                                onChange={(e) => setForm({ ...form, bank: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none disabled:bg-gray-50 disabled:text-gray-500"
                                required
                                disabled={isViewMode}
                            />
                            <datalist id="banks">
                                {settings.banks.map((b) => (
                                    <option key={b} value={b} />
                                ))}
                            </datalist>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Loại Thẻ *</label>
                            <input
                                list="cardTypes"
                                value={form.card_type}
                                onChange={(e) => setForm({ ...form, card_type: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none disabled:bg-gray-50 disabled:text-gray-500"
                                required
                                disabled={isViewMode}
                            />
                            <datalist id="cardTypes">
                                {settings.cardTypes.map((c) => (
                                    <option key={c} value={c} />
                                ))}
                            </datalist>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">4 Số Cuối *</label>
                            <input
                                type="text"
                                value={form.last4}
                                onChange={(e) => setForm({ ...form, last4: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none font-mono text-center text-lg disabled:bg-gray-50 disabled:text-gray-500"
                                maxLength={4}
                                pattern="[0-9]{4}"
                                placeholder="XXXX"
                                required
                                disabled={isViewMode}
                            />
                        </div>
                    </div>
                    <div className="mt-4">
                        <label className="block text-sm font-bold text-gray-700 mb-2">Loại Giao Dịch *</label>
                        <div className="flex gap-4">
                            {(['Rút', 'Đáo', 'Rút+Đáo'] as const).map((type) => (
                                <label
                                    key={type}
                                    className={`flex-1 flex items-center justify-center gap-2 cursor-pointer px-4 py-3 rounded-xl border-2 transition-all ${form.type === type
                                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                        : 'border-gray-200 hover:border-indigo-300'
                                        } ${isViewMode ? 'opacity-75 pointer-events-none' : ''}`}
                                >
                                    <input
                                        type="radio"
                                        name="type"
                                        value={type}
                                        checked={form.type === type}
                                        onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                                        className="sr-only"
                                        disabled={isViewMode}
                                    />
                                    <span className="font-bold">{type}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Financial Details */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-bold text-indigo-600 mb-4 flex items-center gap-2">
                        💰 Chi tiết Tài Chính
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Column 1 */}
                        <div className="space-y-4 bg-gray-50 p-4 rounded-xl">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Số tiền *</label>
                                <input
                                    type="text"
                                    value={formatCurrency(form.amount)}
                                    onChange={(e) => setForm({ ...form, amount: parseCurrency(e.target.value) })}
                                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-indigo-500 outline-none font-bold text-lg text-indigo-700 disabled:bg-gray-100 disabled:text-gray-500"
                                    placeholder="0"
                                    disabled={isViewMode}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Số tiền rút</label>
                                <input
                                    type="text"
                                    value={formatCurrency(form.withdraw_amt)}
                                    onChange={(e) => setForm({ ...form, withdraw_amt: parseCurrency(e.target.value) })}
                                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-indigo-500 outline-none disabled:bg-gray-100 disabled:text-gray-500"
                                    placeholder="0"
                                    disabled={isViewMode}
                                />
                            </div>
                        </div>

                        {/* Column 2 */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Máy POS</label>
                                <input
                                    list="posMachines"
                                    value={form.pos}
                                    onChange={(e) => setForm({ ...form, pos: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none disabled:bg-gray-50 disabled:text-gray-500"
                                    disabled={isViewMode}
                                />
                                <datalist id="posMachines">
                                    {settings.posMachines.map((p) => (
                                        <option key={p} value={p} />
                                    ))}
                                </datalist>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Phí POS %</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={form.pos_fee}
                                        onChange={(e) => setForm({ ...form, pos_fee: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none text-right disabled:bg-gray-50 disabled:text-gray-500"
                                        disabled={isViewMode}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Thành Tiền</label>
                                    <div className="w-full px-3 py-2 bg-gray-100 rounded-xl text-right text-gray-600 border-2 border-gray-200 font-medium">
                                        {formatCurrency(form.pos_amt)}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Column 3 */}
                        <div className="space-y-4 bg-indigo-50 p-4 rounded-xl border-2 border-indigo-100">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-bold text-indigo-800 mb-2">Phí Khách %</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={form.cust_fee}
                                        onChange={(e) => setForm({ ...form, cust_fee: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 rounded-xl border-2 border-indigo-200 focus:border-indigo-500 outline-none text-right font-bold text-indigo-900 disabled:bg-indigo-50"
                                        disabled={isViewMode}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-indigo-800 mb-2">Thu Khách</label>
                                    <div className="w-full px-3 py-2 bg-white rounded-xl text-right text-indigo-900 border-2 border-indigo-200 font-bold">
                                        {formatCurrency(form.cust_amt)}
                                    </div>
                                </div>
                            </div>
                            <div className="pt-3 border-t-2 border-indigo-200">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-bold text-indigo-600">LỢI NHUẬN</span>
                                    <span className="text-2xl font-black text-indigo-700">{formatCurrency(form.profit)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Images */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-bold text-indigo-600 mb-4 flex items-center gap-2">
                        🖼️ Chứng Từ
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <ImageUploadField
                            label="Bill nạp"
                            images={form.img_deposit}
                            uploading={uploadingImages.deposit}
                            onUpload={(files) => handleImageUpload(files, 'deposit')}
                            onRemove={(index) => removeImage('img_deposit', index)}
                            disabled={isViewMode}
                        />
                        <ImageUploadField
                            label="Bill Rút Tiền / POS"
                            images={form.img_withdraw}
                            uploading={uploadingImages.withdraw}
                            onUpload={(files) => handleImageUpload(files, 'withdraw')}
                            onRemove={(index) => removeImage('img_withdraw', index)}
                            disabled={isViewMode}
                        />
                        <ImageUploadField
                            label="Hoá Đơn"
                            images={form.img_invoice}
                            uploading={uploadingImages.invoice}
                            onUpload={(files) => handleImageUpload(files, 'invoice')}
                            onRemove={(index) => removeImage('img_invoice', index)}
                            disabled={isViewMode}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-6 border-t-2 border-gray-200">
                    <div className="flex items-center gap-4">
                        <label className="text-sm font-bold text-gray-700">Trạng thái:</label>
                        <select
                            value={form.status}
                            onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                            className="px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-indigo-500 outline-none font-bold disabled:bg-gray-50 disabled:text-gray-500"
                            disabled={isViewMode}
                        >
                            <option value="Chưa thanh toán">Chưa thanh toán</option>
                            <option value="Đã thanh toán">Đã thanh toán</option>
                        </select>
                    </div>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="px-6 py-3 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors border-2 border-gray-200"
                        >
                            {isViewMode ? 'Quay lại' : 'Huỷ bỏ'}
                        </button>
                        {!isViewMode && (
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-8 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Đang lưu...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-5 h-5" />
                                        {isEdit ? 'Cập Nhật' : 'Lưu'}
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>

            </form>
        </div>
    );
}

import { Lightbox } from '@/components/ui/Lightbox';

function ImageUploadField({
    label,
    images,
    uploading,
    onUpload,
    onRemove,
    disabled = false,
}: {
    label: string;
    images: string[];
    uploading: boolean;
    onUpload: (files: FileList) => void;
    onRemove: (index: number) => void;
    disabled?: boolean;
}) {
    const [lightboxIndex, setLightboxIndex] = useState(-1);

    return (
        <div>
            <Lightbox
                isOpen={lightboxIndex >= 0}
                images={images}
                initialIndex={Math.max(0, lightboxIndex)}
                onClose={() => setLightboxIndex(-1)}
            />

            <label className="block text-sm font-bold text-gray-700 mb-2">{label}</label>
            <div className={`border-2 border-dashed border-gray-300 rounded-xl p-4 transition-all ${disabled ? 'bg-gray-50' : 'hover:border-indigo-400 hover:bg-indigo-50'}`}>
                <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => e.target.files && onUpload(e.target.files)}
                    className="hidden"
                    id={`upload-${label}`}
                    disabled={disabled}
                />

                {(!disabled || images.length === 0) && (
                    <label
                        htmlFor={`upload-${label}`}
                        className={`cursor-pointer flex flex-col items-center justify-center text-center w-full ${disabled ? 'pointer-events-none' : ''}`}
                    >
                        {uploading ? (
                            <div className="py-4">
                                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-2"></div>
                                <p className="text-xs text-indigo-600 font-medium">Đang upload...</p>
                            </div>
                        ) : images.length === 0 ? (
                            <div className="py-4">
                                <Upload className={`w-8 h-8 mx-auto mb-2 ${disabled ? 'text-gray-300' : 'text-gray-400'}`} />
                                <p className={`text-xs font-medium ${disabled ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {disabled ? 'Không có ảnh' : 'Click để chọn ảnh'}
                                </p>
                            </div>
                        ) : null}
                    </label>
                )}

                {images.length > 0 && (
                    <div className="w-full space-y-2">
                        {images.map((url, index) => (
                            <div
                                key={index}
                                className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-200 group hover:shadow-md transition-all relative"
                            >
                                <img
                                    src={url}
                                    alt=""
                                    className="w-12 h-12 rounded object-cover cursor-zoom-in hover:brightness-110 active:scale-95 transition-all border border-gray-100"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setLightboxIndex(index);
                                    }}
                                />
                                <span className="flex-1 text-xs text-gray-600 truncate text-left px-2">
                                    Ảnh {index + 1}
                                </span>
                                {!disabled && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onRemove(index);
                                        }}
                                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors z-10"
                                        title="Xóa ảnh"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                        {!disabled && (
                            <label
                                htmlFor={`upload-${label}`}
                                className="text-xs text-indigo-600 font-medium pt-2 flex items-center justify-center gap-1 hover:underline cursor-pointer"
                            >
                                <Upload className="w-3 h-3" />
                                Thêm ảnh mới
                            </label>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
