'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    Hourglass, RefreshCw, Plus, Radio, Search, Copy, Check, X,
    Package, CheckCircle2, DollarSign, User, Sparkles, Image as ImageIcon,
    RotateCcw, Send, HelpCircle, CheckSquare, Layers
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface PreorderItem {
    id: number;
    invoice_code?: string | null;
    user_id?: number | null;
    telegram_id?: number | null;
    username?: string | null;
    user_fullname?: string | null;
    product_id: number;
    product_name?: string;
    product_price?: number;
    quantity: number;
    deposit_fee: number;
    total_price: number;
    payment_method: string;
    status: 'pending' | 'completed' | 'cancelled' | 'refunded';
    fifo_position: number;
    created_at: string;
}

interface ProductOption {
    id: number;
    name: string;
    price: number;
}

export default function PreordersPage() {
    const { t } = useLanguage();
    const [preorders, setPreorders] = useState<PreorderItem[]>([]);
    const [products, setProducts] = useState<ProductOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [mounted, setMounted] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);

    // Summary Stats
    const [stats, setStats] = useState({
        pendingCount: 0,
        pendingProductsCount: 0,
        completedCount: 0,
        depositTotal: 0
    });

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [productFilter, setProductFilter] = useState('all');

    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);

    // Create Preorder Form
    const [createProductId, setCreateProductId] = useState<string>('');
    const [createTelegramId, setCreateTelegramId] = useState('');
    const [createQuantity, setCreateQuantity] = useState(1);
    const [createPaymentMethod, setCreatePaymentMethod] = useState('Admin Tạo Thủ Công');
    const [submittingCreate, setSubmittingCreate] = useState(false);

    // Broadcast Form
    const [broadcastProductId, setBroadcastProductId] = useState<string>('');
    const [broadcastMessage, setBroadcastMessage] = useState('');
    const [broadcastImage, setBroadcastImage] = useState('');
    const [enableButton1, setEnableButton1] = useState(true);
    const [button1Text, setButton1Text] = useState('📦 Đặt trước ngay');
    const [enableButton2, setEnableButton2] = useState(true);
    const [submittingBroadcast, setSubmittingBroadcast] = useState(false);

    useEffect(() => {
        setMounted(true);
        fetchProducts();
        fetchPreorders();
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

    const fetchPreorders = () => {
        setLoading(true);
        const params = new URLSearchParams({
            search: searchTerm,
            status: statusFilter,
            productId: productFilter
        });

        fetch(`/api/preorders?${params.toString()}`)
            .then((res) => res.json())
            .then((data) => {
                setPreorders(Array.isArray(data.data) ? data.data : []);
                if (data.stats) {
                    setStats({
                        pendingCount: Number(data.stats.pendingCount) || 0,
                        pendingProductsCount: Number(data.stats.pendingProductsCount) || 0,
                        completedCount: Number(data.stats.completedCount) || 0,
                        depositTotal: Number(data.stats.depositTotal) || 0
                    });
                }
                setLoading(false);
            })
            .catch((err) => {
                console.error(err);
                setPreorders([]);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchPreorders();
    }, [statusFilter, productFilter]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        fetchPreorders();
    };

    const handleCopy = (text: string, fieldId: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedField(fieldId);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const fillBroadcastTemplate = () => {
        const prod = products.find(p => String(p.id) === broadcastProductId) || products[0];
        const prodName = prod ? prod.name : 'Sản phẩm VIP #4';
        const priceStr = prod ? formatCurrency(prod.price) : '150.000 đ';

        setBroadcastMessage(
            `🚨 THÔNG BÁO MỞ ĐẶT TRƯỚC (PRE-ORDER) 🚨\n\n` +
            `✨ Sản phẩm: ${prodName}\n` +
            `💰 Giá niêm yết: ${priceStr}\n` +
            `📦 Hạn mức mở đợt này: 100 sản phẩm\n` +
            `🎯 Tối đa mỗi khách: 5 sản phẩm\n\n` +
            `🔥 Đặt trước ngay để nhận hàng sớm nhất theo thứ tự ưu tiên FIFO khi kho có hàng mới!`
        );
    };

    const handleCreatePreorder = async () => {
        if (!createProductId) {
            alert('Vui lòng chọn sản phẩm cần đặt trước!');
            return;
        }
        if (!createTelegramId.trim()) {
            alert('Vui lòng nhập Telegram User ID khách hàng!');
            return;
        }

        setSubmittingCreate(true);
        try {
            const res = await fetch('/api/preorders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create',
                    productId: createProductId,
                    telegramId: createTelegramId.trim(),
                    quantity: createQuantity,
                    paymentMethod: createPaymentMethod
                })
            });

            if (res.ok) {
                alert('Tạo đơn đặt trước thủ công thành công!');
                setIsCreateModalOpen(false);
                setCreateTelegramId('');
                setCreateQuantity(1);
                fetchPreorders();
            } else {
                const data = await res.json();
                alert(data.error || 'Lỗi khi tạo đơn');
            }
        } catch (e) {
            alert('Lỗi kết nối server');
        } finally {
            setSubmittingCreate(false);
        }
    };

    const handleSendBroadcast = async () => {
        if (!broadcastMessage.trim()) {
            alert('Vui lòng nhập nội dung thông báo!');
            return;
        }

        setSubmittingBroadcast(true);
        try {
            const res = await fetch('/api/preorders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'broadcast',
                    productId: broadcastProductId,
                    broadcastMessage: broadcastMessage.trim(),
                    bannerImage: broadcastImage,
                    button1Text
                })
            });

            if (res.ok) {
                alert('Đã phát sóng thông báo mở đặt trước tới toàn bộ người dùng!');
                setIsBroadcastModalOpen(false);
            } else {
                const data = await res.json();
                alert(data.error || 'Lỗi gửi thông báo');
            }
        } catch (e) {
            alert('Lỗi kết nối server');
        } finally {
            setSubmittingBroadcast(false);
        }
    };

    const handleAction = async (id: number, actionType: 'complete' | 'refund') => {
        const confirmMsg = actionType === 'complete'
            ? `Xác nhận HOÀN TẤT đơn đặt trước #${id}?`
            : `Xác nhận HỦY & HOÀN TIỀN CỌC vào ví khách hàng cho đơn #${id}?`;

        if (!window.confirm(confirmMsg)) return;

        try {
            const res = await fetch('/api/preorders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, action: actionType })
            });

            if (res.ok) {
                const data = await res.json();
                alert(data.message || 'Thao tác thành công');
                fetchPreorders();
            } else {
                const data = await res.json();
                alert(data.error || 'Lỗi thao tác');
            }
        } catch (e) {
            alert('Lỗi kết nối server');
        }
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(val) + ' đ';
    };

    const formatTime = (dateStr: string) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${hours}:${minutes} ${day}/${month}/${year}`;
    };

    const renderStatusBadge = (st: string) => {
        switch (st) {
            case 'pending':
                return (
                    <span className="rounded-md bg-amber-50 border border-amber-200/80 px-2.5 py-1 text-[10px] font-extrabold text-amber-700 uppercase">
                        Đang chờ
                    </span>
                );
            case 'completed':
                return (
                    <span className="rounded-md bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 text-[10px] font-extrabold text-emerald-700 uppercase">
                        Đã hoàn tất
                    </span>
                );
            case 'refunded':
            case 'cancelled':
                return (
                    <span className="rounded-md bg-red-50 border border-red-200/80 px-2.5 py-1 text-[10px] font-extrabold text-red-600 uppercase">
                        {st === 'refunded' ? 'Đã hoàn cọc' : 'Đã hủy'}
                    </span>
                );
            default:
                return (
                    <span className="rounded-md bg-zinc-100 border border-zinc-200 px-2.5 py-1 text-[10px] font-extrabold text-zinc-600 uppercase">
                        {st}
                    </span>
                );
        }
    };

    const selectedBroadcastProduct = products.find(p => String(p.id) === broadcastProductId);

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-2 sm:p-4">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600 font-bold border border-orange-200 shadow-2xs">
                        <Hourglass className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-zinc-900 flex items-center gap-2">
                            ĐẶT TRƯỚC
                        </h1>
                        <p className="text-xs text-zinc-500 font-medium">
                            Quản lý hàng chờ FIFO, tự động xuất kho khi nhập hàng, và chính sách hoàn tiền
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchPreorders}
                        className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs font-extrabold uppercase text-zinc-700 hover:bg-zinc-50 transition active:scale-95 shadow-2xs flex items-center gap-1.5"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                        <span>LÀM MỚI</span>
                    </button>

                    <button
                        onClick={() => {
                            setIsBroadcastModalOpen(true);
                            if (products.length > 0 && !broadcastProductId) {
                                setBroadcastProductId(String(products[0].id));
                            }
                            fillBroadcastTemplate();
                        }}
                        className="rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 text-xs font-extrabold uppercase transition active:scale-95 shadow-xs flex items-center gap-1.5"
                    >
                        <Radio className="h-3.5 w-3.5" />
                        <span>BROADCAST ĐẶT TRƯỚC</span>
                    </button>

                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="rounded-xl bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 text-xs font-extrabold uppercase transition active:scale-95 shadow-xs flex items-center gap-1.5"
                    >
                        <Plus className="h-4 w-4" />
                        <span>TẠO ĐẶT TRƯỚC</span>
                    </button>
                </div>
            </div>

            {/* 4 Summary Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="relative rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">ĐƠN ĐANG CHỜ</span>
                        <Hourglass className="h-4 w-4 text-orange-500" />
                    </div>
                    <div className="text-xl font-black text-zinc-900 mt-1">{stats.pendingCount}</div>
                    <p className="text-[10px] text-zinc-400 font-medium mt-0.5">Đơn hàng trong hàng chờ FIFO</p>
                </div>

                <div className="relative rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">CẦN GIAO TRẢ</span>
                        <Package className="h-4 w-4 text-sky-500" />
                    </div>
                    <div className="text-xl font-black text-zinc-900 mt-1">
                        {stats.pendingProductsCount} <span className="text-xs font-bold text-sky-600">sản phẩm</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 font-medium mt-0.5">Tổng số lượng cần nhập kho</p>
                </div>

                <div className="relative rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">ĐÃ HOÀN TẤT</span>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div className="text-xl font-black text-zinc-900 mt-1">{stats.completedCount}</div>
                    <p className="text-[10px] text-zinc-400 font-medium mt-0.5">Đơn đã nhận hàng thành công</p>
                </div>

                <div className="relative rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">TIỀN CỌC GIỮ CHỖ</span>
                        <DollarSign className="h-4 w-4 text-orange-500" />
                    </div>
                    <div className="text-xl font-black text-orange-600 mt-1">
                        {formatCurrency(stats.depositTotal)}
                    </div>
                    <p className="text-[10px] text-zinc-400 font-medium mt-0.5">Tổng giá trị đơn đang chờ</p>
                </div>
            </div>

            {/* Filter Bar */}
            <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <div className="sm:col-span-6 relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Tìm theo Mã đơn, User ID, Sản phẩm..."
                        className="w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-4 py-2.5 text-xs font-medium text-zinc-900 outline-none focus:border-orange-500 transition shadow-2xs"
                    />
                </div>

                <div className="sm:col-span-3">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full h-full min-h-[38px] rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 outline-none focus:border-orange-500 transition shadow-2xs"
                    >
                        <option value="all">Tất cả trạng thái</option>
                        <option value="pending">Đang chờ (FIFO)</option>
                        <option value="completed">Đã hoàn tất</option>
                        <option value="refunded">Đã hoàn tiền cọc</option>
                    </select>
                </div>

                <div className="sm:col-span-3">
                    <select
                        value={productFilter}
                        onChange={(e) => setProductFilter(e.target.value)}
                        className="w-full h-full min-h-[38px] rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 outline-none focus:border-orange-500 transition shadow-2xs"
                    >
                        <option value="all">Tất cả sản phẩm</option>
                        {products.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>
            </form>

            {/* Preorders Main Table */}
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="border-b border-zinc-100 bg-zinc-50/60 text-[11px] font-black uppercase tracking-wider text-zinc-500">
                                <th className="px-4 py-3.5 font-extrabold text-center">HÀNG CHỜ (FIFO)</th>
                                <th className="px-4 py-3.5 font-extrabold">MÃ ĐƠN HÀNG</th>
                                <th className="px-4 py-3.5 font-extrabold">KHÁCH HÀNG</th>
                                <th className="px-4 py-3.5 font-extrabold">SẢN PHẨM</th>
                                <th className="px-4 py-3.5 font-extrabold text-center">SỐ LƯỢNG</th>
                                <th className="px-4 py-3.5 font-extrabold text-right">PHÍ CỌC</th>
                                <th className="px-4 py-3.5 font-extrabold text-right">TỔNG TIỀN</th>
                                <th className="px-4 py-3.5 font-extrabold text-center">CỔNG TT</th>
                                <th className="px-4 py-3.5 font-extrabold text-center">TRẠNG THÁI</th>
                                <th className="px-4 py-3.5 font-extrabold text-center">NGÀY ĐẶT</th>
                                <th className="px-4 py-3.5 font-extrabold text-right">THAO TÁC</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={11} className="py-12 text-center text-xs font-medium text-zinc-400">
                                        Đang tải dữ liệu đặt trước...
                                    </td>
                                </tr>
                            ) : preorders.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="py-16 text-center">
                                        <div className="flex flex-col items-center justify-center space-y-2">
                                            <Hourglass className="h-8 w-8 text-zinc-300 stroke-1" />
                                            <p className="text-xs font-medium text-zinc-400">
                                                Không tìm thấy đơn đặt trước nào phù hợp
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                preorders.map((item, idx) => (
                                    <tr key={item.id} className="hover:bg-zinc-50/80 transition-colors">
                                        {/* FIFO Index */}
                                        <td className="px-4 py-3.5 text-center font-mono font-black text-orange-600 text-xs">
                                            #{item.fifo_position || idx + 1}
                                        </td>

                                        {/* Invoice Code */}
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-1 font-mono font-bold text-zinc-900 text-xs">
                                                <span>{item.invoice_code || `PRE-${item.id}`}</span>
                                                <button
                                                    onClick={() => handleCopy(item.invoice_code || String(item.id), `inv-${item.id}`)}
                                                    className="text-zinc-400 hover:text-zinc-700 transition"
                                                >
                                                    {copiedField === `inv-${item.id}` ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                                                </button>
                                            </div>
                                        </td>

                                        {/* Customer */}
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-1 font-bold text-zinc-900 text-xs">
                                                <User className="h-3.5 w-3.5 text-zinc-400" />
                                                <span>{item.user_fullname || item.username || `User ${item.telegram_id || item.user_id}`}</span>
                                            </div>
                                            {item.username && (
                                                <div className="text-[11px] font-bold text-orange-600 mt-0.5">
                                                    @{item.username}
                                                </div>
                                            )}
                                        </td>

                                        {/* Product */}
                                        <td className="px-4 py-3.5 font-extrabold text-zinc-900 text-xs">
                                            {item.product_name || `Sản phẩm #${item.product_id}`}
                                        </td>

                                        {/* Quantity */}
                                        <td className="px-4 py-3.5 text-center font-bold text-zinc-800 text-xs">
                                            {item.quantity}
                                        </td>

                                        {/* Deposit Fee */}
                                        <td className="px-4 py-3.5 text-right font-extrabold text-orange-600 text-xs">
                                            {formatCurrency(item.deposit_fee)}
                                        </td>

                                        {/* Total Price */}
                                        <td className="px-4 py-3.5 text-right font-black text-zinc-900 text-xs">
                                            {formatCurrency(item.total_price)}
                                        </td>

                                        {/* Payment Method */}
                                        <td className="px-4 py-3.5 text-center text-[10px] font-semibold text-zinc-600">
                                            {item.payment_method}
                                        </td>

                                        {/* Status */}
                                        <td className="px-4 py-3.5 text-center">
                                            {renderStatusBadge(item.status)}
                                        </td>

                                        {/* Created Date */}
                                        <td className="px-4 py-3.5 text-center text-[10px] font-medium text-zinc-500">
                                            {formatTime(item.created_at)}
                                        </td>

                                        {/* Actions */}
                                        <td className="px-4 py-3.5 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {item.status === 'pending' && (
                                                    <>
                                                        <button
                                                            onClick={() => handleAction(item.id, 'complete')}
                                                            className="p-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition active:scale-95 shadow-2xs"
                                                            title="Hoàn tất giao hàng"
                                                        >
                                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleAction(item.id, 'refund')}
                                                            className="p-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition active:scale-95 shadow-2xs"
                                                            title="Hủy & Hoàn tiền cọc vào ví"
                                                        >
                                                            <RotateCcw className="h-3.5 w-3.5" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL 1: BROADCAST ĐẶT TRƯỚC */}
            {isBroadcastModalOpen && mounted && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
                    <div className="w-full max-w-2xl my-auto max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-zinc-200 animate-in zoom-in-95 duration-200">
                        <div className="h-1.5 w-full bg-orange-600 shrink-0" />

                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 border-b border-zinc-100 shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50 text-orange-600 font-bold border border-orange-200">
                                    <Radio className="h-4 w-4" />
                                </div>
                                <div>
                                    <h2 className="font-extrabold text-sm uppercase text-zinc-900 tracking-wide flex items-center gap-2">
                                        GỬI THÔNG BÁO MỞ ĐẶT TRƯỚC TOÀN BỘ USER
                                    </h2>
                                    <p className="text-[11px] text-zinc-400 font-medium">
                                        Phát sóng tin nhắn mở đặt trước kèm nút tương tác trực tiếp đến tất cả khách hàng
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setIsBroadcastModalOpen(false)} className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 transition">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Modal Form Body */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                            {/* Product selection */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="font-extrabold uppercase text-zinc-700 text-[11px]">
                                        CHỌN SẢN PHẨM MỞ ĐẶT TRƯỚC
                                    </label>
                                    <button
                                        type="button"
                                        onClick={fillBroadcastTemplate}
                                        className="text-[11px] font-bold text-orange-600 hover:underline flex items-center gap-1"
                                    >
                                        <Sparkles className="h-3 w-3" />
                                        <span>Điền lại mẫu nội dung</span>
                                    </button>
                                </div>
                                <select
                                    value={broadcastProductId}
                                    onChange={(e) => {
                                        setBroadcastProductId(e.target.value);
                                        fillBroadcastTemplate();
                                    }}
                                    className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-semibold text-zinc-900 outline-none focus:border-orange-500 transition"
                                >
                                    {products.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} - Giá: {formatCurrency(p.price)}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Message text */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="font-extrabold uppercase text-zinc-700 text-[11px]">
                                        NỘI DUNG THÔNG BÁO (TELEGRAM HTML / TEXT) <span className="text-orange-500">*</span>
                                    </label>
                                    <span className="text-[10px] text-zinc-400 font-mono">{broadcastMessage.length} ký tự</span>
                                </div>
                                <textarea
                                    rows={7}
                                    value={broadcastMessage}
                                    onChange={(e) => setBroadcastMessage(e.target.value)}
                                    className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-mono text-zinc-900 outline-none focus:border-orange-500 transition leading-relaxed"
                                />
                            </div>

                            {/* Optional Banner Image */}
                            <div className="space-y-1.5">
                                <label className="font-extrabold uppercase text-zinc-700 text-[11px] flex items-center gap-1.5">
                                    <ImageIcon className="h-3.5 w-3.5 text-zinc-500" />
                                    <span>ẢNH ĐÍNH KÈM (TÙY CHỌN)</span>
                                </label>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 font-bold text-zinc-700 hover:bg-zinc-100 transition flex items-center gap-1.5"
                                    >
                                        <ImageIcon className="h-3.5 w-3.5" />
                                        <span>Chọn ảnh banner</span>
                                    </button>
                                    {broadcastImage && <span className="text-zinc-500 font-mono text-[11px] truncate">{broadcastImage}</span>}
                                </div>
                            </div>

                            {/* Inline Keyboard Options */}
                            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-3">
                                <span className="font-extrabold uppercase text-zinc-700 text-[11px] block">
                                    NÚT TƯƠNG TÁC TELEGRAM (INLINE KEYBOARD)
                                </span>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={enableButton1}
                                            onChange={(e) => setEnableButton1(e.target.checked)}
                                            className="rounded accent-orange-600 h-4 w-4"
                                        />
                                        <span className="font-bold text-zinc-700">Nút mở Đặt trước:</span>
                                        <input
                                            type="text"
                                            value={button1Text}
                                            onChange={(e) => setButton1Text(e.target.value)}
                                            className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 font-semibold text-zinc-900 outline-none focus:border-orange-500"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={enableButton2}
                                            onChange={(e) => setEnableButton2(e.target.checked)}
                                            className="rounded accent-orange-600 h-4 w-4"
                                        />
                                        <span className="font-bold text-zinc-700">
                                            Nút "🛒 Xem tất cả sản phẩm" <span className="font-mono text-zinc-400">(callback: `start:shop`)</span>
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Telegram Preview Box */}
                            <div className="space-y-2">
                                <span className="font-extrabold uppercase text-zinc-700 text-[11px] block flex items-center gap-1.5">
                                    <HelpCircle className="h-3.5 w-3.5 text-zinc-500" />
                                    <span>XEM TRƯỚC TIN NHẮN TRÊN TELEGRAM (PREVIEW)</span>
                                </span>
                                <div className="rounded-2xl bg-slate-900 p-4 text-slate-100 font-sans space-y-3 shadow-inner">
                                    <div className="whitespace-pre-wrap leading-relaxed text-[11px]">
                                        {broadcastMessage}
                                    </div>
                                    <div className="space-y-1.5 pt-2 border-t border-slate-800">
                                        {enableButton1 && (
                                            <button className="w-full rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 py-2 font-bold text-center text-sky-400 text-[11px] shadow-2xs">
                                                {button1Text}
                                            </button>
                                        )}
                                        {enableButton2 && (
                                            <button className="w-full rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 py-2 font-bold text-center text-sky-400 text-[11px] shadow-2xs">
                                                🛒 Xem tất cả sản phẩm
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end gap-2.5 p-4 border-t border-zinc-100 bg-zinc-50/50 shrink-0">
                            <button
                                type="button"
                                onClick={() => setIsBroadcastModalOpen(false)}
                                className="rounded-xl border border-zinc-200 bg-white px-5 py-2.5 font-extrabold uppercase text-zinc-700 hover:bg-zinc-100 transition active:scale-95"
                            >
                                ĐÓNG
                            </button>
                            <button
                                type="button"
                                onClick={handleSendBroadcast}
                                disabled={submittingBroadcast}
                                className="rounded-xl bg-orange-600 hover:bg-orange-700 text-white px-6 py-2.5 font-extrabold uppercase transition active:scale-95 shadow-xs flex items-center gap-2 disabled:opacity-50"
                            >
                                <Send className="h-4 w-4" />
                                <span>{submittingBroadcast ? 'ĐANG GỬI...' : '🚀 GỬI THÔNG BÁO NGAY'}</span>
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* MODAL 2: TẠO ĐƠN ĐẶT TRƯỚC THỦ CÔNG */}
            {isCreateModalOpen && mounted && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
                    <div className="w-full max-w-md my-auto overflow-hidden rounded-2xl bg-white shadow-2xl border border-zinc-200 animate-in zoom-in-95 duration-200">
                        <div className="h-1.5 w-full bg-orange-600 shrink-0" />

                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 border-b border-zinc-100">
                            <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50 text-orange-600 font-bold border border-orange-200">
                                    <Plus className="h-4 w-4" />
                                </div>
                                <h2 className="font-extrabold text-sm uppercase text-zinc-900 tracking-wide">
                                    TẠO ĐƠN ĐẶT TRƯỚC THỦ CÔNG
                                </h2>
                            </div>
                            <button onClick={() => setIsCreateModalOpen(false)} className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 transition">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Modal Form Body */}
                        <div className="p-5 space-y-4 text-xs">
                            {/* Field 1: CHỌN SẢN PHẨM */}
                            <div className="space-y-1.5">
                                <label className="font-extrabold uppercase text-zinc-700 text-[11px]">
                                    CHỌN SẢN PHẨM <span className="text-orange-500">*</span>
                                </label>
                                <select
                                    value={createProductId}
                                    onChange={(e) => setCreateProductId(e.target.value)}
                                    className="w-full rounded-xl border border-orange-500 bg-white p-3 font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-orange-500/20 transition"
                                >
                                    <option value="">-- Chọn sản phẩm cần đặt trước --</option>
                                    {products.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} - Giá: {formatCurrency(p.price)}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Field 2: TELEGRAM USER ID */}
                            <div className="space-y-1.5">
                                <label className="font-extrabold uppercase text-zinc-700 text-[11px]">
                                    TELEGRAM USER ID KHÁCH HÀNG <span className="text-orange-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={createTelegramId}
                                    onChange={(e) => setCreateTelegramId(e.target.value)}
                                    placeholder="Ví dụ: 123456789"
                                    className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-medium text-zinc-900 outline-none focus:border-orange-500 transition"
                                />
                            </div>

                            {/* Field 3 & 4 Side-by-Side: SỐ LƯỢNG & PHƯƠNG THỨC THANH TOÁN */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="font-extrabold uppercase text-zinc-700 text-[11px]">
                                        SỐ LƯỢNG <span className="text-orange-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={createQuantity}
                                        onChange={(e) => setCreateQuantity(Math.max(1, Number(e.target.value)))}
                                        className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-semibold text-zinc-900 outline-none focus:border-orange-500 transition"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="font-extrabold uppercase text-zinc-700 text-[11px]">
                                        PHƯƠNG THỨC THANH TOÁN
                                    </label>
                                    <select
                                        value={createPaymentMethod}
                                        onChange={(e) => setCreatePaymentMethod(e.target.value)}
                                        className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-semibold text-zinc-900 outline-none focus:border-orange-500 transition"
                                    >
                                        <option value="Admin Tạo Thủ Công">Admin Tạo Thủ Công</option>
                                        <option value="Số dư Ví">Số dư Ví</option>
                                        <option value="VietQR / Chuyển khoản">VietQR / Chuyển khoản</option>
                                        <option value="USDT / Crypto">USDT / Crypto</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end gap-2.5 p-4 border-t border-zinc-100 bg-zinc-50/50">
                            <button
                                type="button"
                                onClick={() => setIsCreateModalOpen(false)}
                                className="rounded-xl border border-zinc-200 bg-white px-5 py-2.5 font-extrabold text-zinc-700 hover:bg-zinc-100 transition active:scale-95"
                            >
                                ĐÓNG
                            </button>
                            <button
                                type="button"
                                onClick={handleCreatePreorder}
                                disabled={submittingCreate}
                                className="rounded-xl bg-orange-600 hover:bg-orange-700 text-white px-5 py-2.5 font-extrabold uppercase transition active:scale-95 shadow-xs disabled:opacity-50"
                            >
                                {submittingCreate ? 'ĐANG TẠO...' : '+ XÁC NHẬN TẠO ĐƠN'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
