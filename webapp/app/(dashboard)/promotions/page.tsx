'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    Zap, Ticket, RefreshCw, Search, Copy, Check, Clock, Package,
    Tag, Bell, TrendingDown, Layers, Trash2, Percent, FileText
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface FlashSaleItem {
    id: number;
    product_id: number;
    product_name?: string;
    original_price?: number;
    sale_type: 'PRICE_SALE' | 'BULK';
    sale_price: number;
    bulk_min_qty: number;
    bulk_price: number;
    start_time: string;
    end_time: string;
    notify_telegram: number | boolean;
    status: string;
    computed_status: 'ĐANG CHẠY' | 'SẮP CHẠY' | 'HẾT HẠN' | 'ĐÃ DỪNG';
    created_at: string;
}

interface CouponItem {
    id: number;
    code: string;
    discount_type: 'FIXED' | 'PERCENTAGE';
    discount_value: number;
    min_order_value: number;
    max_discount?: number | null;
    max_uses?: number | null;
    used_count: number;
    product_id?: number | null;
    product_name?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    is_active: number | boolean;
    computed_status: 'ACTIVE' | 'SẮP CHẠY' | 'HẾT HẠN' | 'HẾT LƯỢT' | 'TẮT';
    created_at: string;
}

interface ProductOption {
    id: number;
    name: string;
    price: number;
}

export default function PromotionsPage() {
    const { t } = useLanguage();
    const searchParams = useSearchParams();
    const defaultTab = searchParams.get('tab') === 'coupons' ? 'coupons' : 'flash_sale';

    const [activeTab, setActiveTab] = useState<'flash_sale' | 'coupons'>(defaultTab);

    // Products
    const [products, setProducts] = useState<ProductOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [copiedField, setCopiedField] = useState<string | null>(null);

    // Flash Sales State
    const [sales, setSales] = useState<FlashSaleItem[]>([]);
    const [flashStats, setFlashStats] = useState({
        totalCount: 0,
        runningCount: 0,
        scheduledCount: 0,
        expiredCount: 0,
        stoppedCount: 0
    });

    // Flash Sale Form
    const [fsProductId, setFsProductId] = useState('');
    const [fsSaleType, setFsSaleType] = useState<'PRICE_SALE' | 'BULK'>('PRICE_SALE');
    const [fsSalePrice, setFsSalePrice] = useState('');
    const [fsBulkMinQty, setFsBulkMinQty] = useState('5');
    const [fsBulkPrice, setFsBulkPrice] = useState('');

    const now = new Date();
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);

    const formatForInput = (d: Date) => {
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    const [fsStartTime, setFsStartTime] = useState(formatForInput(now));
    const [fsEndTime, setFsEndTime] = useState(formatForInput(tomorrow));
    const [fsNotifyTelegram, setFsNotifyTelegram] = useState(true);
    const [submittingFs, setSubmittingFs] = useState(false);

    // Coupons State
    const [coupons, setCoupons] = useState<CouponItem[]>([]);
    const [couponStats, setCouponStats] = useState({
        totalCount: 0,
        activeCount: 0,
        scheduledCount: 0,
        expiredCount: 0,
        outOfStockCount: 0
    });

    // Coupon Form
    const [cpCode, setCpCode] = useState('SALE10');
    const [cpDiscountType, setCpDiscountType] = useState<'FIXED' | 'PERCENTAGE'>('FIXED');
    const [cpDiscountValue, setCpDiscountValue] = useState('50000');
    const [cpMinOrderValue, setCpMinOrderValue] = useState('0');
    const [cpMaxDiscount, setCpMaxDiscount] = useState('');
    const [cpMaxUses, setCpMaxUses] = useState('');
    const [cpProductId, setCpProductId] = useState(''); // empty for 'Toàn shop'
    const [cpStartTime, setCpStartTime] = useState('');
    const [cpEndTime, setCpEndTime] = useState('');
    const [cpIsActive, setCpIsActive] = useState(true);
    const [submittingCp, setSubmittingCp] = useState(false);

    useEffect(() => {
        fetchProducts();
        fetchSales();
        fetchCoupons();
    }, []);

    const fetchProducts = () => {
        fetch('/api/products')
            .then((res) => res.json())
            .then((data) => {
                const list = Array.isArray(data) ? data : data.data || [];
                setProducts(list.map((p: any) => ({ id: p.id, name: p.name, price: Number(p.price) || 0 })));
            })
            .catch((err) => console.error(err));
    };

    const fetchSales = () => {
        setLoading(true);
        const params = new URLSearchParams({ search: searchTerm });
        fetch(`/api/promotions?${params.toString()}`)
            .then((res) => res.json())
            .then((data) => {
                setSales(Array.isArray(data.data) ? data.data : []);
                if (data.stats) setFlashStats(data.stats);
                setLoading(false);
            })
            .catch((err) => {
                console.error(err);
                setSales([]);
                setLoading(false);
            });
    };

    const fetchCoupons = () => {
        setLoading(true);
        const params = new URLSearchParams({ search: searchTerm });
        fetch(`/api/coupons?${params.toString()}`)
            .then((res) => res.json())
            .then((data) => {
                setCoupons(Array.isArray(data.data) ? data.data : []);
                if (data.stats) setCouponStats(data.stats);
                setLoading(false);
            })
            .catch((err) => {
                console.error(err);
                setCoupons([]);
                setLoading(false);
            });
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (activeTab === 'flash_sale') fetchSales();
        else fetchCoupons();
    };

    const handleResetFsForm = () => {
        setFsProductId('');
        setFsSaleType('PRICE_SALE');
        setFsSalePrice('');
        setFsBulkMinQty('5');
        setFsBulkPrice('');
        setFsStartTime(formatForInput(new Date()));
        setFsEndTime(formatForInput(new Date(Date.now() + 24 * 3600 * 1000)));
        setFsNotifyTelegram(true);
    };

    const handleCreateFlashSale = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fsProductId) {
            alert('Vui lòng chọn sản phẩm!');
            return;
        }

        setSubmittingFs(true);
        try {
            const res = await fetch('/api/promotions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productId: fsProductId,
                    saleType: fsSaleType,
                    salePrice: Number(fsSalePrice),
                    bulkMinQty: Number(fsBulkMinQty),
                    bulkPrice: Number(fsBulkPrice),
                    startTime: fsStartTime.replace('T', ' '),
                    endTime: fsEndTime.replace('T', ' '),
                    notifyTelegram: fsNotifyTelegram
                })
            });

            if (res.ok) {
                alert('Tạo chương trình Flash Sale thành công!');
                handleResetFsForm();
                fetchSales();
            } else {
                const data = await res.json();
                alert(data.error || 'Lỗi tạo Flash Sale');
            }
        } catch (e) {
            alert('Lỗi kết nối server');
        } finally {
            setSubmittingFs(false);
        }
    };

    const handleCreateCoupon = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!cpCode.trim() || !cpDiscountValue) {
            alert('Vui lòng nhập Mã giảm giá và Giá trị giảm!');
            return;
        }

        setSubmittingCp(true);
        try {
            const res = await fetch('/api/coupons', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: cpCode.trim(),
                    discountType: cpDiscountType,
                    discountValue: Number(cpDiscountValue),
                    minOrderValue: Number(cpMinOrderValue),
                    maxDiscount: cpMaxDiscount ? Number(cpMaxDiscount) : null,
                    maxUses: cpMaxUses ? Number(cpMaxUses) : null,
                    productId: cpProductId || null,
                    startTime: cpStartTime ? cpStartTime.replace('T', ' ') : null,
                    endTime: cpEndTime ? cpEndTime.replace('T', ' ') : null,
                    isActive: cpIsActive
                })
            });

            if (res.ok) {
                alert('Tạo mã giảm giá thành công!');
                setCpCode(`SALE${Math.floor(Math.random() * 90 + 10)}`);
                fetchCoupons();
            } else {
                const data = await res.json();
                alert(data.error || 'Lỗi tạo mã giảm giá');
            }
        } catch (e) {
            alert('Lỗi kết nối server');
        } finally {
            setSubmittingCp(false);
        }
    };

    const handleDeleteCoupon = async (id: number) => {
        if (!window.confirm('Xác nhận xóa mã giảm giá này?')) return;
        const res = await fetch(`/api/coupons?id=${id}`, { method: 'DELETE' });
        if (res.ok) fetchCoupons();
    };

    const handleActionFs = async (id: number, actionType: 'stop' | 'delete') => {
        const confirmMsg = actionType === 'stop' ? 'Xác nhận DỪNG đợt Flash Sale này?' : 'Xác nhận XÓA đợt Flash Sale này?';
        if (!window.confirm(confirmMsg)) return;

        const res = await fetch('/api/promotions', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, action: actionType })
        });
        if (res.ok) fetchSales();
    };

    const handleCopy = (text: string, fieldId: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedField(fieldId);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(val) + ' đ';
    };

    const formatTimeStr = (dateStr?: string | null) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${hours}:${minutes}:${seconds} ${day}/${month}/${year}`;
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-2 sm:p-4">
            {/* Top Navigation Tabs Bar */}
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setActiveTab('flash_sale')}
                        className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase transition flex items-center gap-2 ${activeTab === 'flash_sale' ? 'bg-orange-600 text-white shadow-xs' : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'}`}
                    >
                        <Zap className="h-4 w-4" />
                        <span>FLASH SALE</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('coupons')}
                        className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase transition flex items-center gap-2 ${activeTab === 'coupons' ? 'bg-orange-600 text-white shadow-xs' : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'}`}
                    >
                        <Ticket className="h-4 w-4" />
                        <span>MÃ GIẢM GIÁ</span>
                    </button>
                </div>

                <button
                    onClick={() => {
                        fetchSales();
                        fetchCoupons();
                    }}
                    title="Tải lại"
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 active:scale-95 transition shadow-2xs"
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* TAB 1: FLASH SALE PAGE */}
            {activeTab === 'flash_sale' && (
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600 font-bold border border-orange-200 shadow-2xs">
                            <Zap className="h-5 w-5" />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-zinc-900 flex items-center gap-2">
                                FLASH SALE
                            </h1>
                            <p className="text-xs text-zinc-500 font-medium">
                                Thiết lập các chương trình Flash Sale giảm giá có giới hạn thời gian
                            </p>
                        </div>
                    </div>

                    {/* 5 Stat Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">TỔNG SALE</span>
                            <div className="text-xl font-black text-zinc-900 mt-1">{flashStats.totalCount}</div>
                        </div>

                        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">ĐANG CHẠY</span>
                            <div className="text-xl font-black text-emerald-600 mt-1">{flashStats.runningCount}</div>
                        </div>

                        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">SẮP CHẠY</span>
                            <div className="text-xl font-black text-sky-500 mt-1">{flashStats.scheduledCount}</div>
                        </div>

                        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">HẾT HẠN</span>
                            <div className="text-xl font-black text-orange-500 mt-1">{flashStats.expiredCount}</div>
                        </div>

                        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">ĐÃ DỪNG</span>
                            <div className="text-xl font-black text-zinc-400 mt-1">{flashStats.stoppedCount}</div>
                        </div>
                    </div>

                    {/* Main Layout 2 Columns */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                        {/* Form Flash Sale */}
                        <div className="lg:col-span-4 rounded-2xl border border-zinc-200 bg-white p-5 space-y-4 shadow-2xs">
                            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                                <div className="flex items-center gap-2">
                                    <Zap className="h-4 w-4 text-orange-600" />
                                    <h2 className="font-extrabold text-xs uppercase text-zinc-800 tracking-wider">
                                        TẠO FLASH SALE
                                    </h2>
                                </div>
                                <button type="button" onClick={handleResetFsForm} className="text-[11px] font-bold text-zinc-400 hover:text-zinc-700 uppercase">
                                    RESET
                                </button>
                            </div>

                            <form onSubmit={handleCreateFlashSale} className="space-y-4 text-xs">
                                <div className="space-y-1.5">
                                    <label className="font-extrabold uppercase text-zinc-700 text-[11px]">SẢN PHẨM *</label>
                                    <select
                                        value={fsProductId}
                                        onChange={(e) => {
                                            setFsProductId(e.target.value);
                                            const prod = products.find(p => String(p.id) === e.target.value);
                                            if (prod && !fsSalePrice) setFsSalePrice(String(Math.round(prod.price * 0.9)));
                                        }}
                                        className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-semibold text-zinc-900 outline-none focus:border-orange-500 transition"
                                    >
                                        <option value="">Chọn sản phẩm</option>
                                        {products.map(p => (
                                            <option key={p.id} value={p.id}>{p.name} - {formatCurrency(p.price)}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="font-extrabold uppercase text-zinc-700 text-[11px] block">LOẠI FLASH SALE</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setFsSaleType('PRICE_SALE')}
                                            className={`py-2.5 rounded-xl text-xs font-black uppercase transition ${fsSaleType === 'PRICE_SALE' ? 'bg-orange-600 text-white shadow-xs' : 'border border-zinc-200 bg-white text-zinc-700'}`}
                                        >
                                            GIÁ SALE
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFsSaleType('BULK')}
                                            className={`py-2.5 rounded-xl text-xs font-black uppercase transition ${fsSaleType === 'BULK' ? 'bg-orange-600 text-white shadow-xs' : 'border border-zinc-200 bg-white text-zinc-700'}`}
                                        >
                                            BULK
                                        </button>
                                    </div>
                                </div>

                                {fsSaleType === 'PRICE_SALE' ? (
                                    <div className="space-y-1.5">
                                        <label className="font-extrabold uppercase text-zinc-700 text-[11px]">GIÁ SALE *</label>
                                        <input
                                            type="number"
                                            value={fsSalePrice}
                                            onChange={(e) => setFsSalePrice(e.target.value)}
                                            placeholder="VD: 79000"
                                            className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-bold text-zinc-900 outline-none focus:border-orange-500 transition"
                                        />
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <label className="font-extrabold uppercase text-zinc-700 text-[11px]">SL TỐI THIỂU *</label>
                                            <input
                                                type="number"
                                                min={1}
                                                value={fsBulkMinQty}
                                                onChange={(e) => setFsBulkMinQty(e.target.value)}
                                                className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-semibold text-zinc-900 outline-none focus:border-orange-500 transition"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="font-extrabold uppercase text-zinc-700 text-[11px]">GIÁ MỖI CÁI *</label>
                                            <input
                                                type="number"
                                                value={fsBulkPrice}
                                                onChange={(e) => setFsBulkPrice(e.target.value)}
                                                placeholder="VD: 50000"
                                                className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-bold text-zinc-900 outline-none focus:border-orange-500 transition"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="font-extrabold uppercase text-zinc-700 text-[11px]">BẮT ĐẦU</label>
                                        <input
                                            type="datetime-local"
                                            value={fsStartTime}
                                            onChange={(e) => setFsStartTime(e.target.value)}
                                            className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 font-medium text-zinc-800 text-[11px] outline-none focus:border-orange-500 transition"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="font-extrabold uppercase text-zinc-700 text-[11px]">KẾT THÚC</label>
                                        <input
                                            type="datetime-local"
                                            value={fsEndTime}
                                            onChange={(e) => setFsEndTime(e.target.value)}
                                            className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 font-medium text-zinc-800 text-[11px] outline-none focus:border-orange-500 transition"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 pt-1">
                                    <input
                                        type="checkbox"
                                        checked={fsNotifyTelegram}
                                        onChange={(e) => setFsNotifyTelegram(e.target.checked)}
                                        className="rounded accent-orange-600 h-4 w-4"
                                    />
                                    <span className="font-bold text-zinc-800">Notify users qua Telegram</span>
                                </div>

                                <button
                                    type="submit"
                                    disabled={submittingFs}
                                    className="w-full rounded-xl bg-orange-600 hover:bg-orange-700 text-white py-3 font-extrabold uppercase transition active:scale-95 shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    <Zap className="h-4 w-4 fill-white" />
                                    <span>{submittingFs ? 'ĐANG TẠO...' : 'TẠO FLASH SALE'}</span>
                                </button>
                            </form>
                        </div>

                        {/* List Flash Sale */}
                        <div className="lg:col-span-8 rounded-2xl border border-zinc-200 bg-white p-5 space-y-4 shadow-2xs">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-3">
                                <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-orange-600" />
                                    <h2 className="font-extrabold text-xs uppercase text-zinc-800 tracking-wider">
                                        DANH SÁCH FLASH SALE
                                    </h2>
                                </div>

                                <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                                        <input
                                            type="text"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            placeholder="Tìm tên hoặc ID..."
                                            className="w-44 sm:w-56 rounded-xl border border-zinc-200 bg-white pl-8 pr-3 py-1.5 text-xs font-medium text-zinc-900 outline-none focus:border-orange-500 transition"
                                        />
                                    </div>
                                    <span className="text-xs font-bold text-zinc-400 font-mono">1/1</span>
                                </form>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="border-b border-zinc-100 bg-zinc-50/60 text-[11px] font-black uppercase tracking-wider text-zinc-500">
                                            <th className="w-8 px-3 py-3 text-center">
                                                <input type="checkbox" className="rounded accent-orange-600" />
                                            </th>
                                            <th className="px-3 py-3 font-extrabold">SẢN PHẨM</th>
                                            <th className="px-3 py-3 font-extrabold text-center">LOẠI</th>
                                            <th className="px-3 py-3 font-extrabold text-right">GIÁ</th>
                                            <th className="px-3 py-3 font-extrabold text-center">BULK</th>
                                            <th className="px-3 py-3 font-extrabold">THỜI GIAN</th>
                                            <th className="px-3 py-3 font-extrabold text-center">TRẠNG THÁI</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={7} className="py-12 text-center text-xs font-medium text-zinc-400">
                                                    Đang tải danh sách...
                                                </td>
                                            </tr>
                                        ) : sales.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="py-12 text-center text-xs font-medium text-zinc-400">
                                                    Chưa có chương trình Flash Sale nào.
                                                </td>
                                            </tr>
                                        ) : (
                                            sales.map((sale) => (
                                                <tr key={sale.id} className="hover:bg-zinc-50/80 transition-colors">
                                                    <td className="px-3 py-3.5 text-center">
                                                        <input type="checkbox" className="rounded accent-orange-600" />
                                                    </td>
                                                    <td className="px-3 py-3.5">
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-7 w-7 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center shrink-0">
                                                                <Package className="h-3.5 w-3.5 text-orange-600" />
                                                            </div>
                                                            <div>
                                                                <div className="font-extrabold text-zinc-900 text-xs">
                                                                    {sale.product_name || `Sản phẩm #${sale.product_id}`}
                                                                </div>
                                                                <div className="text-[10px] font-mono text-zinc-400 flex items-center gap-1.5 mt-0.5">
                                                                    <span>Product #{sale.product_id}</span>
                                                                    <button onClick={() => handleCopy(String(sale.product_id), `prod-${sale.id}`)}>
                                                                        <Copy className="h-3 w-3 text-zinc-400" />
                                                                    </button>
                                                                    <span>Sale #{sale.id}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3.5 text-center">
                                                        <span className="inline-flex rounded-full border border-orange-300 bg-orange-50/60 px-2.5 py-0.5 text-[10px] font-black text-orange-600 uppercase">
                                                            {sale.sale_type === 'PRICE_SALE' ? 'GIẢM GIÁ TRỰC TIẾP' : 'BULK DISCOUNT'}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-3.5 text-right font-mono">
                                                        <div className="font-black text-zinc-900 text-xs">
                                                            {formatCurrency(sale.sale_price)}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3.5 text-center font-mono text-zinc-500">
                                                        {sale.sale_type === 'BULK' ? `>=${sale.bulk_min_qty} cái` : '-'}
                                                    </td>
                                                    <td className="px-3 py-3.5 font-mono text-[10px] text-zinc-500 space-y-0.5">
                                                        <div className="flex items-center gap-1 text-zinc-600">
                                                            <Clock className="h-3 w-3 text-zinc-400" />
                                                            <span>{formatTimeStr(sale.start_time)}</span>
                                                        </div>
                                                        <div className="pl-4 text-zinc-500">
                                                            {formatTimeStr(sale.end_time)}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3.5 text-center">
                                                        <span className="rounded-md bg-amber-50 border border-amber-300 px-2 py-0.5 text-[10px] font-extrabold text-amber-700 uppercase">
                                                            {sale.computed_status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: MÃ GIẢM GIÁ PAGE */}
            {activeTab === 'coupons' && (
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600 font-bold border border-orange-200 shadow-2xs">
                            <Ticket className="h-5 w-5" />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-zinc-900 flex items-center gap-2">
                                MÃ GIẢM GIÁ
                            </h1>
                            <p className="text-xs text-zinc-500 font-medium">
                                Quản lý các mã giảm giá áp dụng cho sản phẩm
                            </p>
                        </div>
                    </div>

                    {/* 5 Stat Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">TỔNG MÃ</span>
                            <div className="text-xl font-black text-zinc-900 mt-1">{couponStats.totalCount}</div>
                        </div>

                        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">ACTIVE</span>
                            <div className="text-xl font-black text-emerald-600 mt-1">{couponStats.activeCount}</div>
                        </div>

                        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">SẮP CHẠY</span>
                            <div className="text-xl font-black text-sky-500 mt-1">{couponStats.scheduledCount}</div>
                        </div>

                        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">HẾT HẠN</span>
                            <div className="text-xl font-black text-orange-500 mt-1">{couponStats.expiredCount}</div>
                        </div>

                        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">HẾT LƯỢT</span>
                            <div className="text-xl font-black text-red-500 mt-1">{couponStats.outOfStockCount}</div>
                        </div>
                    </div>

                    {/* Main Layout 2 Columns */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                        {/* Form Coupon */}
                        <div className="lg:col-span-4 rounded-2xl border border-zinc-200 bg-white p-5 space-y-4 shadow-2xs">
                            <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
                                <Percent className="h-4 w-4 text-orange-600" />
                                <h2 className="font-extrabold text-xs uppercase text-zinc-800 tracking-wider">
                                    TẠO MÃ GIẢM GIÁ
                                </h2>
                            </div>

                            <form onSubmit={handleCreateCoupon} className="space-y-3.5 text-xs">
                                {/* Field 1: CODE */}
                                <div className="space-y-1.5">
                                    <label className="font-extrabold uppercase text-zinc-700 text-[11px]">
                                        CODE <span className="text-orange-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={cpCode}
                                        onChange={(e) => setCpCode(e.target.value)}
                                        placeholder="SALE10"
                                        className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-mono font-bold uppercase text-zinc-900 outline-none focus:border-orange-500 transition"
                                    />
                                </div>

                                {/* Field 2: LOẠI GIẢM */}
                                <div className="space-y-1.5">
                                    <label className="font-extrabold uppercase text-zinc-700 text-[11px] block">
                                        LOẠI GIẢM
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setCpDiscountType('FIXED')}
                                            className={`py-2.5 rounded-xl text-xs font-black uppercase transition ${cpDiscountType === 'FIXED' ? 'bg-orange-600 text-white shadow-xs' : 'border border-zinc-200 bg-white text-zinc-700'}`}
                                        >
                                            FIXED
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCpDiscountType('PERCENTAGE')}
                                            className={`py-2.5 rounded-xl text-xs font-black uppercase transition ${cpDiscountType === 'PERCENTAGE' ? 'bg-orange-600 text-white shadow-xs' : 'border border-zinc-200 bg-white text-zinc-700'}`}
                                        >
                                            PERCENTAGE
                                        </button>
                                    </div>
                                </div>

                                {/* Field 3 & 4: GIÁ TRỊ & ĐƠN TỐI THIỂU */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="font-extrabold uppercase text-zinc-700 text-[11px]">GIÁ TRỊ</label>
                                        <input
                                            type="number"
                                            value={cpDiscountValue}
                                            onChange={(e) => setCpDiscountValue(e.target.value)}
                                            placeholder="50000"
                                            className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-bold text-zinc-900 outline-none focus:border-orange-500 transition"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="font-extrabold uppercase text-zinc-700 text-[11px]">ĐƠN TỐI THIỂU</label>
                                        <input
                                            type="number"
                                            value={cpMinOrderValue}
                                            onChange={(e) => setCpMinOrderValue(e.target.value)}
                                            placeholder="0"
                                            className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-bold text-zinc-900 outline-none focus:border-orange-500 transition"
                                        />
                                    </div>
                                </div>

                                {/* Field 5 & 6: GIẢM TỐI ĐA & LƯỢT DÙNG */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="font-extrabold uppercase text-zinc-700 text-[11px]">GIẢM TỐI ĐA</label>
                                        <input
                                            type="number"
                                            value={cpMaxDiscount}
                                            onChange={(e) => setCpMaxDiscount(e.target.value)}
                                            placeholder="Để trống"
                                            className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-medium text-zinc-900 outline-none focus:border-orange-500 transition"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="font-extrabold uppercase text-zinc-700 text-[11px]">LƯỢT DÙNG</label>
                                        <input
                                            type="number"
                                            value={cpMaxUses}
                                            onChange={(e) => setCpMaxUses(e.target.value)}
                                            placeholder="Không giới hạn"
                                            className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-medium text-zinc-900 outline-none focus:border-orange-500 transition"
                                        />
                                    </div>
                                </div>

                                {/* Field 7: ÁP DỤNG SẢN PHẨM */}
                                <div className="space-y-1.5">
                                    <label className="font-extrabold uppercase text-zinc-700 text-[11px]">ÁP DỤNG SẢN PHẨM</label>
                                    <select
                                        value={cpProductId}
                                        onChange={(e) => setCpProductId(e.target.value)}
                                        className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-semibold text-zinc-900 outline-none focus:border-orange-500 transition"
                                    >
                                        <option value="">Toàn shop</option>
                                        {products.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Field 8 & 9: BẮT ĐẦU & HẾT HẠN */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="font-extrabold uppercase text-zinc-700 text-[11px]">BẮT ĐẦU</label>
                                        <input
                                            type="datetime-local"
                                            value={cpStartTime}
                                            onChange={(e) => setCpStartTime(e.target.value)}
                                            className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 font-medium text-zinc-800 text-[11px] outline-none focus:border-orange-500 transition"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="font-extrabold uppercase text-zinc-700 text-[11px]">HẾT HẠN</label>
                                        <input
                                            type="datetime-local"
                                            value={cpEndTime}
                                            onChange={(e) => setCpEndTime(e.target.value)}
                                            className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 font-medium text-zinc-800 text-[11px] outline-none focus:border-orange-500 transition"
                                        />
                                    </div>
                                </div>

                                {/* Checkbox */}
                                <div className="flex items-center gap-2 pt-1">
                                    <input
                                        type="checkbox"
                                        checked={cpIsActive}
                                        onChange={(e) => setCpIsActive(e.target.checked)}
                                        className="rounded accent-orange-600 h-4 w-4"
                                    />
                                    <span className="font-bold text-zinc-800">Active (mã mới mặc định bật)</span>
                                </div>

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={submittingCp}
                                    className="w-full rounded-xl bg-orange-600 hover:bg-orange-700 text-white py-3 font-extrabold uppercase transition active:scale-95 shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    <FileText className="h-4 w-4" />
                                    <span>{submittingCp ? 'ĐANG TẠO...' : '📄 TẠO MÃ GIẢM GIÁ'}</span>
                                </button>
                            </form>
                        </div>

                        {/* List Coupons */}
                        <div className="lg:col-span-8 rounded-2xl border border-zinc-200 bg-white p-5 space-y-4 shadow-2xs">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-3">
                                <div className="flex items-center gap-2">
                                    <Ticket className="h-4 w-4 text-orange-600" />
                                    <h2 className="font-extrabold text-xs uppercase text-zinc-800 tracking-wider">
                                        DANH SÁCH MÃ GIẢM GIÁ
                                    </h2>
                                </div>

                                <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                                        <input
                                            type="text"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            placeholder="Tìm code, sản phẩm, ID..."
                                            className="w-44 sm:w-56 rounded-xl border border-zinc-200 bg-white pl-8 pr-3 py-1.5 text-xs font-medium text-zinc-900 outline-none focus:border-orange-500 transition"
                                        />
                                    </div>
                                    <span className="text-xs font-bold text-zinc-400 font-mono">1/1</span>
                                </form>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="border-b border-zinc-100 bg-zinc-50/60 text-[11px] font-black uppercase tracking-wider text-zinc-500">
                                            <th className="w-8 px-3 py-3 text-center">
                                                <input type="checkbox" className="rounded accent-orange-600" />
                                            </th>
                                            <th className="px-3 py-3 font-extrabold">CODE</th>
                                            <th className="px-3 py-3 font-extrabold text-right">GIẢM</th>
                                            <th className="px-3 py-3 font-extrabold">ĐIỀU KIỆN</th>
                                            <th className="px-3 py-3 font-extrabold">SẢN PHẨM</th>
                                            <th className="px-3 py-3 font-extrabold text-center">LƯỢT DÙNG</th>
                                            <th className="px-3 py-3 font-extrabold">THỜI GIAN</th>
                                            <th className="px-3 py-3 font-extrabold text-center">TRẠNG THÁI</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={8} className="py-12 text-center text-xs font-medium text-zinc-400">
                                                    Đang tải danh sách mã giảm giá...
                                                </td>
                                            </tr>
                                        ) : coupons.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="py-16 text-center text-xs font-medium text-zinc-400">
                                                    Chưa có mã giảm giá
                                                </td>
                                            </tr>
                                        ) : (
                                            coupons.map((item) => (
                                                <tr key={item.id} className="hover:bg-zinc-50/80 transition-colors">
                                                    <td className="px-3 py-3.5 text-center">
                                                        <input type="checkbox" className="rounded accent-orange-600" />
                                                    </td>
                                                    <td className="px-3 py-3.5 font-mono font-black text-orange-600 text-xs">
                                                        {item.code}
                                                    </td>
                                                    <td className="px-3 py-3.5 text-right font-black text-zinc-900">
                                                        {item.discount_type === 'FIXED' ? formatCurrency(item.discount_value) : `${item.discount_value}%`}
                                                    </td>
                                                    <td className="px-3 py-3.5 font-mono text-[10px] text-zinc-500">
                                                        Đơn từ {formatCurrency(item.min_order_value)}
                                                    </td>
                                                    <td className="px-3 py-3.5 font-extrabold text-zinc-800">
                                                        {item.product_name || 'Toàn shop'}
                                                    </td>
                                                    <td className="px-3 py-3.5 text-center font-mono text-xs font-bold text-zinc-800">
                                                        {item.used_count} / {item.max_uses || '∞'}
                                                    </td>
                                                    <td className="px-3 py-3.5 font-mono text-[10px] text-zinc-500">
                                                        {formatTimeStr(item.start_time)}
                                                    </td>
                                                    <td className="px-3 py-3.5 text-center">
                                                        <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 uppercase">
                                                            {item.computed_status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Footer */}
                            <div className="flex items-center justify-between border-t border-zinc-100 pt-3 text-xs text-zinc-500 font-medium">
                                <div>Hiển thị {coupons.length} / {couponStats.totalCount} mã</div>
                                <div className="flex items-center gap-1">
                                    <button className="rounded-lg border border-zinc-200 bg-white px-3 py-1 font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 shadow-2xs">
                                        TRƯỚC
                                    </button>
                                    <button className="rounded-lg border border-zinc-200 bg-white px-3 py-1 font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 shadow-2xs">
                                        SAU
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
