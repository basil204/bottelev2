'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    Zap, Ticket, RefreshCw, Search, Copy, Check, Clock, Package,
    Tag, Bell, TrendingDown, Layers, Trash2, Percent, FileText,
    Send, Play, Pause, AlertCircle, Sparkles, Image as ImageIcon,
    CheckCircle2, X
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface FlashSaleItem {
    id: number;
    product_id: number;
    product_name?: string;
    original_price?: number;
    product_image?: string;
    sale_type: 'PRICE_SALE' | 'PERCENTAGE' | 'BULK';
    sale_price: number;
    discount_percent?: number;
    bulk_min_qty: number;
    bulk_price: number;
    start_time: string;
    end_time: string;
    custom_emoji_id?: string;
    banner_image?: string;
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
    image_url?: string;
    custom_emoji_id?: string;
}

const PRESET_EMOJIS = [
    { label: '⚡ Flash Sale', id: '5375135722514685501' },
    { label: '🔥 Hot Deal', id: '5368324170671202286' },
    { label: '🎁 Gift / Quà', id: '5382935592864607775' },
    { label: '💎 Diamond VIP', id: '5449764500994145452' },
    { label: '⭐ Star', id: '5370908866991102925' },
    { label: '🚀 Siêu Tốc', id: '5373003056092823616' },
    { label: '👑 King VIP', id: '5436310700547055734' },
    { label: '🎉 Khuyến Mãi', id: '5427009714745710639' },
];

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
    const [fsSaleType, setFsSaleType] = useState<'PRICE_SALE' | 'PERCENTAGE' | 'BULK'>('PRICE_SALE');
    const [fsSalePrice, setFsSalePrice] = useState('');
    const [fsDiscountPercent, setFsDiscountPercent] = useState('20');
    const [fsBulkMinQty, setFsBulkMinQty] = useState('5');
    const [fsBulkPrice, setFsBulkPrice] = useState('');
    const [fsCustomEmojiId, setFsCustomEmojiId] = useState('');
    const [fsBannerImage, setFsBannerImage] = useState('');

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

    // Broadcast Flash Sale Modal
    const [broadcastSale, setBroadcastSale] = useState<FlashSaleItem | null>(null);
    const [broadcastMessage, setBroadcastMessage] = useState('');
    const [broadcastBanner, setBroadcastBanner] = useState('');
    const [broadcastEmojiId, setBroadcastEmojiId] = useState('');
    const [broadcastButtonText, setBroadcastButtonText] = useState('⚡ Mua ngay giá Flash Sale');
    const [sendingBroadcast, setSendingBroadcast] = useState(false);
    const [broadcastResult, setBroadcastResult] = useState<{ sent: number; total: number; removed: number } | null>(null);

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
                setProducts(list.map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    price: Number(p.price) || 0,
                    image_url: p.image_url || '',
                    custom_emoji_id: p.custom_emoji_id || ''
                })));
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
        setFsDiscountPercent('20');
        setFsBulkMinQty('5');
        setFsBulkPrice('');
        setFsCustomEmojiId('');
        setFsBannerImage('');
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

        const prod = products.find(p => String(p.id) === fsProductId);
        const origPrice = prod ? prod.price : 0;

        let computedSalePrice = Number(fsSalePrice);
        if (fsSaleType === 'PERCENTAGE') {
            computedSalePrice = Math.round(origPrice * (1 - Number(fsDiscountPercent) / 100));
        }

        setSubmittingFs(true);
        try {
            const res = await fetch('/api/promotions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productId: fsProductId,
                    saleType: fsSaleType,
                    salePrice: computedSalePrice,
                    discountPercent: Number(fsDiscountPercent),
                    bulkMinQty: Number(fsBulkMinQty),
                    bulkPrice: Number(fsBulkPrice),
                    customEmojiId: fsCustomEmojiId.trim() || null,
                    bannerImage: fsBannerImage.trim() || null,
                    startTime: fsStartTime.replace('T', ' '),
                    endTime: fsEndTime.replace('T', ' '),
                    notifyTelegram: fsNotifyTelegram
                })
            });

            const data = await res.json();
            if (res.ok) {
                let msg = 'Tạo chương trình Flash Sale thành công!';
                if (data.broadcastStats) {
                    msg += `\nĐã phát sóng thông báo đến ${data.broadcastStats.sent}/${data.broadcastStats.total} người dùng Telegram.`;
                }
                alert(msg);
                handleResetFsForm();
                fetchSales();
            } else {
                alert(data.error || 'Lỗi tạo Flash Sale');
            }
        } catch (e) {
            alert('Lỗi kết nối server');
        } finally {
            setSubmittingFs(false);
        }
    };

    const handleActionFs = async (id: number, actionType: 'stop' | 'resume' | 'delete') => {
        let confirmMsg = 'Xác nhận thực hiện thao tác này?';
        if (actionType === 'stop') confirmMsg = 'Xác nhận DỪNG chương trình Flash Sale này?';
        if (actionType === 'resume') confirmMsg = 'Xác nhận KÍCH HOẠT LẠI chương trình Flash Sale này?';
        if (actionType === 'delete') confirmMsg = 'Xác nhận XÓA VĨNH VIỄN chương trình Flash Sale này?';

        if (!window.confirm(confirmMsg)) return;

        const res = await fetch('/api/promotions', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, action: actionType })
        });
        if (res.ok) fetchSales();
    };

    const handleOpenBroadcastModal = (sale: FlashSaleItem) => {
        setBroadcastSale(sale);
        const origPrice = Number(sale.original_price) || 0;
        const salePrice = Number(sale.sale_price) || 0;
        const discountPct = sale.discount_percent || (origPrice > 0 ? Math.round(((origPrice - salePrice) / origPrice) * 100) : 0);

        const fmtMoney = (amount: number) => Number(amount).toLocaleString('vi-VN') + 'đ';

        let priceLine = `💰 <b>Giá gốc:</b> <s>${fmtMoney(origPrice)}</s> ➡️ <b>Giá Flash Sale:</b> <b>${fmtMoney(salePrice)}</b> (-${discountPct}%)`;
        if (sale.sale_type === 'BULK') {
            priceLine = `💰 <b>Giá gốc:</b> ${fmtMoney(origPrice)}\n🔥 <b>Flash Sale mua sỉ:</b> Mua từ <b>${sale.bulk_min_qty} cái</b> giá chỉ <b>${fmtMoney(sale.bulk_price)}/cái</b>`;
        }

        const startStr = new Date(sale.start_time).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
        const endStr = new Date(sale.end_time).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

        const defaultMsg = `⚡ <b>CHƯƠNG TRÌNH FLASH SALE ĐẶC BIỆT!</b>\n\n` +
            `🛍️ <b>Sản phẩm:</b> <b>${sale.product_name || `Sản phẩm #${sale.product_id}`}</b>\n` +
            `${priceLine}\n` +
            `⏳ <b>Thời gian áp dụng:</b> ${startStr} - ${endStr}\n\n` +
            `⚡ <i>Số lượng ưu đãi có hạn. Hãy nhanh tay bấm nút bên dưới để sở hữu ngay!</i>`;

        setBroadcastMessage(defaultMsg);
        setBroadcastBanner(sale.banner_image || sale.product_image || '');
        setBroadcastEmojiId(sale.custom_emoji_id || '');
        setBroadcastButtonText('⚡ Mua ngay giá Flash Sale');
        setBroadcastResult(null);
    };

    const handleSendBroadcast = async () => {
        if (!broadcastSale) return;
        setSendingBroadcast(true);
        setBroadcastResult(null);

        try {
            const res = await fetch('/api/promotions/broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    flashSaleId: broadcastSale.id,
                    customMessage: broadcastMessage,
                    bannerImage: broadcastBanner.trim() || null,
                    customEmojiId: broadcastEmojiId.trim() || null,
                    buttonText: broadcastButtonText.trim()
                })
            });

            const data = await res.json();
            if (res.ok) {
                setBroadcastResult(data.stats);
            } else {
                alert(data.error || 'Lỗi phát sóng thông báo');
            }
        } catch (e) {
            alert('Lỗi kết nối server khi phát sóng');
        } finally {
            setSendingBroadcast(false);
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
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${hours}:${minutes} ${day}/${month}/${year}`;
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
                        <span>CHIẾN DỊCH FLASH SALE</span>
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
                    className="p-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 transition flex items-center gap-1.5 text-xs font-bold"
                >
                    <RefreshCw className="h-4 w-4" />
                    <span className="hidden sm:inline">LÀM MỚI</span>
                </button>
            </div>

            {/* TAB 1: FLASH SALE */}
            {activeTab === 'flash_sale' && (
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600 font-bold border border-orange-200 shadow-2xs">
                                <Zap className="h-5 w-5" />
                            </div>
                            <div>
                                <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-zinc-900 flex items-center gap-2">
                                    CHIẾN DỊCH FLASH SALE
                                </h1>
                                <p className="text-xs text-zinc-500 font-medium">
                                    Thiết lập các chương trình Flash Sale giảm giá có giới hạn thời gian và phát sóng thông báo đến người dùng
                                </p>
                            </div>
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
                                        TẠO FLASH SALE MỚI
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
                                            if (prod) {
                                                if (!fsSalePrice) setFsSalePrice(String(Math.round(prod.price * 0.8)));
                                                if (prod.image_url && !fsBannerImage) setFsBannerImage(prod.image_url);
                                                if (prod.custom_emoji_id && !fsCustomEmojiId) setFsCustomEmojiId(prod.custom_emoji_id);
                                            }
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
                                    <div className="grid grid-cols-3 gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => setFsSaleType('PRICE_SALE')}
                                            className={`py-2 rounded-xl text-[11px] font-black uppercase transition ${fsSaleType === 'PRICE_SALE' ? 'bg-orange-600 text-white shadow-xs' : 'border border-zinc-200 bg-white text-zinc-700'}`}
                                        >
                                            GIÁ SALE
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFsSaleType('PERCENTAGE')}
                                            className={`py-2 rounded-xl text-[11px] font-black uppercase transition ${fsSaleType === 'PERCENTAGE' ? 'bg-orange-600 text-white shadow-xs' : 'border border-zinc-200 bg-white text-zinc-700'}`}
                                        >
                                            GIẢM %
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFsSaleType('BULK')}
                                            className={`py-2 rounded-xl text-[11px] font-black uppercase transition ${fsSaleType === 'BULK' ? 'bg-orange-600 text-white shadow-xs' : 'border border-zinc-200 bg-white text-zinc-700'}`}
                                        >
                                            MUA NHIỀU
                                        </button>
                                    </div>
                                </div>

                                {fsSaleType === 'PRICE_SALE' && (
                                    <div className="space-y-1.5">
                                        <label className="font-extrabold uppercase text-zinc-700 text-[11px]">GIÁ FLASH SALE (VND) *</label>
                                        <input
                                            type="number"
                                            value={fsSalePrice}
                                            onChange={(e) => setFsSalePrice(e.target.value)}
                                            placeholder="VD: 50000"
                                            className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-bold text-zinc-900 outline-none focus:border-orange-500 transition"
                                        />
                                    </div>
                                )}

                                {fsSaleType === 'PERCENTAGE' && (
                                    <div className="space-y-1.5">
                                        <label className="font-extrabold uppercase text-zinc-700 text-[11px]">GIẢM GIÁ (%) *</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={99}
                                            value={fsDiscountPercent}
                                            onChange={(e) => setFsDiscountPercent(e.target.value)}
                                            placeholder="VD: 30 (Giảm 30%)"
                                            className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-bold text-zinc-900 outline-none focus:border-orange-500 transition"
                                        />
                                    </div>
                                )}

                                {fsSaleType === 'BULK' && (
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
                                                placeholder="VD: 45000"
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

                                <div className="space-y-1.5">
                                    <label className="font-extrabold uppercase text-zinc-700 text-[11px]">BANNER ẢNH (TÙY CHỌN)</label>
                                    <input
                                        type="text"
                                        value={fsBannerImage}
                                        onChange={(e) => setFsBannerImage(e.target.value)}
                                        placeholder="https://... hoặc đường dẫn ảnh"
                                        className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 font-medium text-zinc-900 text-xs outline-none focus:border-orange-500 transition"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <label className="font-extrabold uppercase text-zinc-700 text-[11px]">
                                            CUSTOM EMOJI ID (TELEGRAM PREMIUM)
                                        </label>
                                        {fsCustomEmojiId && (
                                            <button
                                                type="button"
                                                onClick={() => setFsCustomEmojiId('')}
                                                className="text-[10px] font-bold text-red-500 hover:text-red-700 uppercase"
                                            >
                                                Xóa
                                            </button>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        value={fsCustomEmojiId}
                                        onChange={(e) => setFsCustomEmojiId(e.target.value)}
                                        placeholder="VD: 5375135722514685501"
                                        className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 font-mono text-zinc-900 text-xs outline-none focus:border-orange-500 transition"
                                    />
                                    {/* Preset Quick Chips */}
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                        {PRESET_EMOJIS.map((em) => {
                                            const isSelected = fsCustomEmojiId === em.id;
                                            return (
                                                <button
                                                    key={em.id}
                                                    type="button"
                                                    onClick={() => setFsCustomEmojiId(isSelected ? '' : em.id)}
                                                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 border cursor-pointer ${
                                                        isSelected
                                                            ? 'bg-orange-600 text-white border-orange-600 shadow-2xs'
                                                            : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200'
                                                    }`}
                                                    title={`ID: ${em.id}`}
                                                >
                                                    <span>{em.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="text-[10px] text-zinc-400 leading-relaxed">
                                        💡 Nhập ID emoji động từ Telegram Premium để hiển thị icon động trên nút bấm và tiêu đề tin nhắn.
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 pt-1">
                                    <input
                                        type="checkbox"
                                        id="notifyTg"
                                        checked={fsNotifyTelegram}
                                        onChange={(e) => setFsNotifyTelegram(e.target.checked)}
                                        className="rounded accent-orange-600 h-4 w-4"
                                    />
                                    <label htmlFor="notifyTg" className="font-bold text-zinc-800 cursor-pointer text-xs">
                                        📢 Tự động phát sóng thông báo đến toàn bộ User Telegram
                                    </label>
                                </div>

                                <button
                                    type="submit"
                                    disabled={submittingFs}
                                    className="w-full rounded-xl bg-orange-600 hover:bg-orange-700 text-white py-3 font-extrabold uppercase transition active:scale-95 shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                                >
                                    <Zap className="h-4 w-4 fill-white" />
                                    <span>{submittingFs ? 'ĐANG TẠO & PHÁT SÓNG...' : 'TẠO FLASH SALE'}</span>
                                </button>
                            </form>
                        </div>

                        {/* List Flash Sale */}
                        <div className="lg:col-span-8 rounded-2xl border border-zinc-200 bg-white p-5 space-y-4 shadow-2xs">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-3">
                                <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-orange-600" />
                                    <h2 className="font-extrabold text-xs uppercase text-zinc-800 tracking-wider">
                                        DANH SÁCH CHIẾN DỊCH FLASH SALE
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
                                            <th className="px-3 py-3 font-extrabold">SẢN PHẨM</th>
                                            <th className="px-3 py-3 font-extrabold text-center">LOẠI</th>
                                            <th className="px-3 py-3 font-extrabold text-right">GIÁ SALE</th>
                                            <th className="px-3 py-3 font-extrabold">THỜI GIAN</th>
                                            <th className="px-3 py-3 font-extrabold text-center">TRẠNG THÁI</th>
                                            <th className="px-3 py-3 font-extrabold text-center">HÀNH ĐỘNG</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={6} className="py-12 text-center text-xs font-medium text-zinc-400">
                                                    Đang tải danh sách...
                                                </td>
                                            </tr>
                                        ) : sales.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="py-12 text-center text-xs font-medium text-zinc-400">
                                                    Chưa có chương trình Flash Sale nào.
                                                </td>
                                            </tr>
                                        ) : (
                                            sales.map((sale) => (
                                                <tr key={sale.id} className="hover:bg-zinc-50/80 transition-colors">
                                                    <td className="px-3 py-3.5">
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-8 w-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center shrink-0 overflow-hidden">
                                                                {sale.product_image ? (
                                                                    <img src={sale.product_image} alt="" className="h-full w-full object-cover" />
                                                                ) : (
                                                                    <Package className="h-4 w-4 text-orange-600" />
                                                                )}
                                                            </div>
                                                            <div>
                                                                <div className="font-extrabold text-zinc-900 text-xs">
                                                                    {sale.product_name || `Sản phẩm #${sale.product_id}`}
                                                                </div>
                                                                <div className="text-[10px] font-mono text-zinc-400 flex items-center gap-1.5 mt-0.5">
                                                                    <span>Gốc: {formatCurrency(sale.original_price || 0)}</span>
                                                                    <span>• Sale #{sale.id}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3.5 text-center">
                                                        <span className="inline-flex rounded-full border border-orange-300 bg-orange-50/60 px-2.5 py-0.5 text-[10px] font-black text-orange-600 uppercase">
                                                            {sale.sale_type === 'PRICE_SALE' ? 'GIÁ SALE' : sale.sale_type === 'PERCENTAGE' ? `GIẢM ${sale.discount_percent}%` : `SỈ >=${sale.bulk_min_qty}`}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-3.5 text-right font-mono">
                                                        <div className="font-black text-orange-600 text-xs">
                                                            {sale.sale_type === 'BULK' ? formatCurrency(sale.bulk_price) : formatCurrency(sale.sale_price)}
                                                        </div>
                                                        {sale.original_price && sale.original_price > sale.sale_price && (
                                                            <div className="text-[10px] text-zinc-400 line-through">
                                                                {formatCurrency(sale.original_price)}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-3.5 font-mono text-[10px] text-zinc-500 space-y-0.5">
                                                        <div className="flex items-center gap-1 text-zinc-600">
                                                            <Clock className="h-3 w-3 text-zinc-400" />
                                                            <span>{formatTimeStr(sale.start_time)}</span>
                                                        </div>
                                                        <div className="pl-4 text-zinc-400">
                                                            {formatTimeStr(sale.end_time)}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3.5 text-center">
                                                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase border ${
                                                            sale.computed_status === 'ĐANG CHẠY' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                            sale.computed_status === 'SẮP CHẠY' ? 'bg-sky-50 text-sky-700 border-sky-200' :
                                                            sale.computed_status === 'HẾT HẠN' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                                            'bg-zinc-100 text-zinc-600 border-zinc-200'
                                                        }`}>
                                                            {sale.computed_status}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-3.5 text-center">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <button
                                                                onClick={() => handleOpenBroadcastModal(sale)}
                                                                title="Phát sóng thông báo Flash Sale"
                                                                className="p-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-600 transition"
                                                            >
                                                                <Send className="h-3.5 w-3.5" />
                                                            </button>
                                                            {sale.status === 'stopped' ? (
                                                                <button
                                                                    onClick={() => handleActionFs(sale.id, 'resume')}
                                                                    title="Kích hoạt lại"
                                                                    className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition"
                                                                >
                                                                    <Play className="h-3.5 w-3.5" />
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleActionFs(sale.id, 'stop')}
                                                                    title="Tạm dừng"
                                                                    className="p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition"
                                                                >
                                                                    <Pause className="h-3.5 w-3.5" />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => handleActionFs(sale.id, 'delete')}
                                                                title="Xóa"
                                                                className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
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

            {/* BROADCAST MODAL */}
            {broadcastSale && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
                    <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-zinc-100 space-y-4 my-8">
                        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                            <div className="flex items-center gap-2">
                                <Send className="h-5 w-5 text-orange-600" />
                                <h3 className="text-base font-black uppercase text-zinc-900">
                                    PHÁT SÓNG THÔNG BÁO FLASH SALE ĐẾN USER
                                </h3>
                            </div>
                            <button
                                onClick={() => setBroadcastSale(null)}
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {broadcastResult && (
                            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                                <div>
                                    Phát sóng thành công: {broadcastResult.sent}/{broadcastResult.total} users nhận tin nhắn!
                                    {broadcastResult.removed > 0 && ` (${broadcastResult.removed} user đã xóa do chặn bot)`}
                                </div>
                            </div>
                        )}

                        <div className="space-y-3 text-xs">
                            <div className="space-y-1.5">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                    <label className="font-extrabold uppercase text-zinc-700 text-[11px]">
                                        NỘI DUNG THÔNG BÁO TELEGRAM (HTML / MARKDOWN)
                                    </label>
                                    <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                                        <span className="text-[10px] text-zinc-400 font-bold shrink-0">Chèn Emoji động:</span>
                                        {PRESET_EMOJIS.slice(0, 4).map((em) => (
                                            <button
                                                key={em.id}
                                                type="button"
                                                onClick={() => setBroadcastMessage(prev => prev + ` {${em.id}} `)}
                                                className="px-1.5 py-0.5 rounded bg-zinc-100 hover:bg-orange-50 hover:text-orange-600 text-[10px] font-mono font-bold text-zinc-700 transition border border-zinc-200"
                                                title={`Chèn {${em.id}}`}
                                            >
                                                {em.label.split(' ')[0]}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <textarea
                                    rows={6}
                                    value={broadcastMessage}
                                    onChange={(e) => setBroadcastMessage(e.target.value)}
                                    className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-mono text-zinc-900 text-xs outline-none focus:border-orange-500 transition"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="font-extrabold uppercase text-zinc-700 text-[11px]">ẢNH BANNER PHÁT SÓNG (URL HOẶC ĐƯỜNG DẪN)</label>
                                    <input
                                        type="text"
                                        value={broadcastBanner}
                                        onChange={(e) => setBroadcastBanner(e.target.value)}
                                        placeholder="https://... hoặc /uploads/..."
                                        className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 font-medium text-zinc-900 outline-none focus:border-orange-500 transition"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <label className="font-extrabold uppercase text-zinc-700 text-[11px]">
                                            CUSTOM EMOJI ID (TELEGRAM PREMIUM)
                                        </label>
                                        {broadcastEmojiId && (
                                            <button
                                                type="button"
                                                onClick={() => setBroadcastEmojiId('')}
                                                className="text-[10px] font-bold text-red-500 hover:text-red-700 uppercase"
                                            >
                                                Xóa
                                            </button>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        value={broadcastEmojiId}
                                        onChange={(e) => setBroadcastEmojiId(e.target.value)}
                                        placeholder="5375135722514685501"
                                        className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 font-mono text-zinc-900 outline-none focus:border-orange-500 transition"
                                    />
                                    {/* Preset Quick Chips */}
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                        {PRESET_EMOJIS.map((em) => {
                                            const isSelected = broadcastEmojiId === em.id;
                                            return (
                                                <button
                                                    key={em.id}
                                                    type="button"
                                                    onClick={() => setBroadcastEmojiId(isSelected ? '' : em.id)}
                                                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 border cursor-pointer ${
                                                        isSelected
                                                            ? 'bg-orange-600 text-white border-orange-600 shadow-2xs'
                                                            : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200'
                                                    }`}
                                                    title={`ID: ${em.id}`}
                                                >
                                                    <span>{em.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="text-[10px] text-zinc-400">
                                        💡 Tự động gắn icon động vào nút bấm Mua Ngay và phần mở đầu tin nhắn.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="font-extrabold uppercase text-zinc-700 text-[11px]">CHỮ TRÊN NÚT BẤM MUA NGAY</label>
                                <input
                                    type="text"
                                    value={broadcastButtonText}
                                    onChange={(e) => setBroadcastButtonText(e.target.value)}
                                    className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 font-bold text-zinc-900 outline-none focus:border-orange-500 transition"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
                            <button
                                onClick={() => setBroadcastSale(null)}
                                className="px-4 py-2.5 rounded-xl border border-zinc-200 text-zinc-700 text-xs font-bold hover:bg-zinc-50 transition"
                            >
                                ĐÓNG
                            </button>
                            <button
                                onClick={handleSendBroadcast}
                                disabled={sendingBroadcast}
                                className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-black uppercase transition flex items-center gap-2 shadow-xs disabled:opacity-50"
                            >
                                <Send className="h-4 w-4" />
                                <span>{sendingBroadcast ? 'ĐANG GỬI HÀNG LOẠT...' : 'PHÁT SÓNG NGAY ĐẾN TOÀN BỘ USER'}</span>
                            </button>
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

                                <div className="flex items-center gap-2 pt-1">
                                    <input
                                        type="checkbox"
                                        checked={cpIsActive}
                                        onChange={(e) => setCpIsActive(e.target.checked)}
                                        className="rounded accent-orange-600 h-4 w-4"
                                    />
                                    <span className="font-bold text-zinc-800">Active (mã mới mặc định bật)</span>
                                </div>

                                <button
                                    type="submit"
                                    disabled={submittingCp}
                                    className="w-full rounded-xl bg-orange-600 hover:bg-orange-700 text-white py-3 font-extrabold uppercase transition active:scale-95 shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    <FileText className="h-4 w-4" />
                                    <span>{submittingCp ? 'ĐANG TẠO...' : 'TẠO MÃ GIẢM GIÁ'}</span>
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
                                                <td colSpan={7} className="py-12 text-center text-xs font-medium text-zinc-400">
                                                    Đang tải danh sách mã giảm giá...
                                                </td>
                                            </tr>
                                        ) : coupons.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="py-16 text-center text-xs font-medium text-zinc-400">
                                                    Chưa có mã giảm giá
                                                </td>
                                            </tr>
                                        ) : (
                                            coupons.map((item) => (
                                                <tr key={item.id} className="hover:bg-zinc-50/80 transition-colors">
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
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
