'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    ShoppingCart, Search, Calendar, RefreshCw, Copy, Check, Eye, DollarSign,
    Package, Send, Ban, RotateCcw, X, ChevronDown, ChevronUp, User, FileText,
    ArrowLeftRight, HelpCircle
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface OrderItem {
    id: number;
    user_id: number;
    username?: string;
    user_fullname?: string;
    telegram_id?: number;
    product_id?: number;
    product_name: string;
    product_price?: number;
    price: number;
    email?: string | null;
    note?: string | null;
    status: 'pending' | 'completed' | 'reserved' | 'cancelled' | 'expired';
    invoice_code?: string | null;
    created_at: string;
    completed_at?: string | null;
    delivery_type?: number | string | null;
    product_type?: string | null;
}

export default function OrdersPage() {
    const { t } = useLanguage();
    const [orders, setOrders] = useState<OrderItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalOrders, setTotalOrders] = useState(0);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Modal state
    const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [showDeliveredItems, setShowDeliveredItems] = useState(true);
    const [copiedField, setCopiedField] = useState<string | null>(null);

    // Warranty Form State
    const [warrantyData, setWarrantyData] = useState('');
    const [warrantyReason, setWarrantyReason] = useState('');
    const [submittingWarranty, setSubmittingWarranty] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const fetchOrders = () => {
        setLoading(true);
        const params = new URLSearchParams({
            page: String(page),
            limit: '10',
            status: statusFilter,
            search: searchTerm,
            startDate: startDate,
            endDate: endDate
        });

        fetch(`/api/orders?${params.toString()}`)
            .then((res) => res.json())
            .then((data) => {
                setOrders(Array.isArray(data.data) ? data.data : []);
                setTotalPages(data.pagination?.totalPages || 1);
                setTotalOrders(data.pagination?.total || 0);
                setLoading(false);
            })
            .catch((err) => {
                console.error(err);
                setOrders([]);
                setTotalPages(1);
                setTotalOrders(0);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchOrders();
    }, [page]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        fetchOrders();
    };

    const handleCopy = (text: string, fieldId: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedField(fieldId);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const handleUpdateStatus = async (orderId: number, newStatus: string) => {
        if (!window.confirm(`Xác nhận cập nhật trạng thái đơn #${orderId} thành "${newStatus.toUpperCase()}"?`)) return;

        try {
            const res = await fetch('/api/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: orderId, status: newStatus })
            });

            if (res.ok) {
                const data = await res.json();
                alert(data.message || 'Cập nhật trạng thái thành công!');
                fetchOrders();
                if (selectedOrder && selectedOrder.id === orderId) {
                    setSelectedOrder(prev => prev ? { ...prev, status: newStatus as any } : null);
                }
            } else {
                const data = await res.json();
                alert(data.error || 'Lỗi cập nhật trạng thái');
            }
        } catch (e) {
            alert('Lỗi kết nối server');
        }
    };

    const handleResendTelegram = async (orderId: number) => {
        if (!window.confirm(`Xác nhận gửi lại dữ liệu đơn #${orderId} cho khách qua Telegram?`)) return;

        try {
            const res = await fetch('/api/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: orderId, resendTelegram: true })
            });

            if (res.ok) {
                alert('Đã gửi lại dữ liệu đơn hàng thành công!');
            } else {
                const data = await res.json();
                alert(data.error || 'Lỗi khi gửi lại dữ liệu');
            }
        } catch (e) {
            alert('Lỗi kết nối server');
        }
    };

    const handleRefundPreorder = async (orderId: number) => {
        if (!window.confirm(`Xác nhận HỦY đơn và HOÀN 100% tiền đặt trước vào ví khách hàng cho đơn #${orderId}?`)) return;

        try {
            const res = await fetch('/api/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: orderId, refundWallet: true })
            });

            if (res.ok) {
                const data = await res.json();
                alert(data.message || 'Đã hoàn tiền thành công!');
                fetchOrders();
            } else {
                const data = await res.json();
                alert(data.error || 'Lỗi khi hoàn tiền');
            }
        } catch (e) {
            alert('Lỗi kết nối server');
        }
    };

    const handleSendWarranty = async () => {
        if (!selectedOrder) return;
        if (!warrantyData.trim()) {
            alert('Vui lòng nhập/dán tài khoản bảo hành mới!');
            return;
        }

        setSubmittingWarranty(true);
        try {
            const res = await fetch('/api/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: selectedOrder.id,
                    warrantyData: warrantyData.trim(),
                    warrantyReason: warrantyReason.trim()
                })
            });

            if (res.ok) {
                alert('Bảo hành đổi tài khoản thành công!');
                setWarrantyData('');
                setWarrantyReason('');
                fetchOrders();
                // Refresh detail order
                const detailRes = await fetch(`/api/orders?id=${selectedOrder.id}`);
                if (detailRes.ok) {
                    const updated = await detailRes.json();
                    setSelectedOrder(updated);
                }
            } else {
                const data = await res.json();
                alert(data.error || 'Lỗi gửi bảo hành');
            }
        } catch (e) {
            alert('Lỗi kết nối server');
        } finally {
            setSubmittingWarranty(false);
        }
    };

    const openOrderDetail = (order: OrderItem) => {
        setSelectedOrder(order);
        setIsDetailOpen(true);
        setWarrantyData('');
        setWarrantyReason('');
        setShowDeliveredItems(true);
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(val) + ' đ';
    };

    const formatTime = (dateStr: string) => {
        if (!dateStr) return '-';
        const safeIso = dateStr.includes(' ') ? dateStr.replace(' ', 'T') : dateStr;
        const d = new Date(safeIso);
        if (isNaN(d.getTime())) return dateStr;
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `Tạo: ${hours}:${minutes}:${seconds} ${day}/${month}/${year}`;
    };

    const renderStatusBadge = (status: string) => {
        switch (status) {
            case 'completed':
                return (
                    <div className="inline-flex flex-col items-center">
                        <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[10px] font-extrabold text-emerald-600 uppercase">
                            HOÀN THÀNH
                        </span>
                        <span className="text-[9px] text-zinc-400 font-mono mt-0.5">completed</span>
                    </div>
                );
            case 'pending':
                return (
                    <div className="inline-flex flex-col items-center">
                        <span className="rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1 text-[10px] font-extrabold text-amber-700 uppercase">
                            ĐANG CHỜ
                        </span>
                        <span className="text-[9px] text-zinc-400 font-mono mt-0.5">pending</span>
                    </div>
                );
            case 'reserved':
            case 'expired':
                return (
                    <div className="inline-flex flex-col items-center">
                        <span className="rounded-md bg-pink-50 border border-pink-200 px-2.5 py-1 text-[10px] font-extrabold text-pink-600 uppercase">
                            HẾT HẠN
                        </span>
                        <span className="text-[9px] text-zinc-400 font-mono mt-0.5">reserved</span>
                    </div>
                );
            case 'cancelled':
                return (
                    <div className="inline-flex flex-col items-center">
                        <span className="rounded-md bg-zinc-100 border border-zinc-200 px-2.5 py-1 text-[10px] font-extrabold text-zinc-600 uppercase">
                            ĐÃ HỦY
                        </span>
                        <span className="text-[9px] text-zinc-400 font-mono mt-0.5">cancelled</span>
                    </div>
                );
            default:
                return (
                    <span className="rounded-md bg-zinc-100 border border-zinc-200 px-2.5 py-1 text-[10px] font-extrabold text-zinc-600 uppercase">
                        {status}
                    </span>
                );
        }
    };

    const renderDeliveryBadge = (type?: number | string | null) => {
        const numType = Number(type);
        if (numType === 4 || type === 'manual') {
            return (
                <span className="rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-extrabold text-amber-700 shadow-2xs">
                    Giao tay
                </span>
            );
        }
        if (numType === 2 || type === 'file') {
            return (
                <span className="rounded-md bg-purple-50 border border-purple-200 px-2 py-0.5 text-[10px] font-extrabold text-purple-700 shadow-2xs">
                    Giao File
                </span>
            );
        }
        if (numType === 3 || type === 'api') {
            return (
                <span className="rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-extrabold text-blue-700 shadow-2xs">
                    Giao API
                </span>
            );
        }
        return (
            <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 shadow-2xs">
                Tự động
            </span>
        );
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-2 sm:p-4">
            {/* Header Title */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600 font-bold border border-orange-200 shadow-2xs">
                        <ShoppingCart className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-zinc-900 flex items-center gap-2">
                            ĐƠN HÀNG
                        </h1>
                        <p className="text-xs text-zinc-500 font-medium">Quản lý danh sách đơn hàng và trạng thái</p>
                    </div>
                </div>
                <button
                    onClick={fetchOrders}
                    title="Tải lại"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 active:scale-95 transition shadow-2xs"
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Filter Controls Bar */}
            <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
                <div className="lg:col-span-6 relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Tìm mã đơn, memo, user ID, chat ID, username, nội dung item..."
                        className="w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-4 py-2.5 text-xs font-medium text-zinc-900 outline-none focus:border-orange-500 transition shadow-2xs"
                    />
                </div>

                <div className="lg:col-span-2">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full h-full min-h-[38px] rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 outline-none focus:border-orange-500 transition shadow-2xs"
                    >
                        <option value="all">Tất cả trạng thái</option>
                        <option value="completed">Hoàn thành</option>
                        <option value="pending">Đang chờ</option>
                        <option value="reserved">Hết hạn (Reserved)</option>
                        <option value="cancelled">Đã hủy</option>
                    </select>
                </div>

                <div className="lg:col-span-2 relative">
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 outline-none focus:border-orange-500 transition shadow-2xs"
                    />
                </div>

                <div className="lg:col-span-2 flex gap-2">
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 outline-none focus:border-orange-500 transition shadow-2xs"
                    />
                    <button
                        type="submit"
                        className="rounded-xl bg-orange-600 px-5 text-xs font-extrabold uppercase text-white hover:bg-orange-700 active:scale-95 transition shadow-xs whitespace-nowrap"
                    >
                        TÌM KIẾM
                    </button>
                </div>
            </form>

            {/* Summary Cards Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">TỔNG ĐƠN</span>
                    <div className="text-xl font-black text-zinc-900 mt-1">{totalOrders.toLocaleString('vi-VN')}</div>
                </div>
                <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">TRANG HIỆN TẠI</span>
                    <div className="text-xl font-black text-zinc-900 mt-1">{page}/{totalPages}</div>
                </div>
                <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">ĐANG LỌC...</span>
                    <div className="text-sm font-extrabold text-zinc-900 truncate mt-1">
                        {statusFilter === 'all' ? 'Tất cả trạng thái' : statusFilter.toUpperCase()}
                    </div>
                </div>
                <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">TÌM KIẾM</span>
                    <div className="text-sm font-extrabold text-zinc-900 truncate mt-1">{searchTerm || '-'}</div>
                </div>
            </div>

            {/* Orders Main Table */}
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="border-b border-zinc-100 bg-zinc-50/60 text-[11px] font-black uppercase tracking-wider text-zinc-500">
                                <th className="px-4 py-3.5 font-extrabold">ĐƠN HÀNG</th>
                                <th className="px-4 py-3.5 font-extrabold">KHÁCH TELEGRAM</th>
                                <th className="px-4 py-3.5 font-extrabold">SẢN PHẨM</th>
                                <th className="px-4 py-3.5 font-extrabold text-right">THANH TOÁN</th>
                                <th className="px-4 py-3.5 font-extrabold text-center">TRẠNG THÁI</th>
                                <th className="px-4 py-3.5 font-extrabold text-center">THỜI GIAN</th>
                                <th className="px-4 py-3.5 font-extrabold text-right">THAO TÁC</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-xs font-medium text-zinc-400">
                                        Đang tải danh sách đơn hàng...
                                    </td>
                                </tr>
                            ) : orders.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-xs font-medium text-zinc-400">
                                        Không tìm thấy đơn hàng nào.
                                    </td>
                                </tr>
                            ) : (
                                orders.map((order) => {
                                    const codeText = order.invoice_code || String(order.id);
                                    return (
                                        <tr key={order.id} className="hover:bg-zinc-50/80 transition-colors">
                                            {/* Column 1: ĐƠN HÀNG */}
                                            <td className="px-4 py-3.5">
                                                <div className="flex items-center gap-1.5 font-mono font-bold text-orange-600 text-xs">
                                                    <span>{codeText}</span>
                                                    <button
                                                        onClick={() => handleCopy(codeText, `code-${order.id}`)}
                                                        className="text-zinc-400 hover:text-zinc-700 transition"
                                                    >
                                                        {copiedField === `code-${order.id}` ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                                                    </button>
                                                </div>
                                                {order.invoice_code && (
                                                    <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-mono mt-0.5">
                                                        <span>💬 {order.invoice_code}</span>
                                                        <button
                                                            onClick={() => handleCopy(order.invoice_code!, `memo-${order.id}`)}
                                                            className="hover:text-zinc-700 transition"
                                                        >
                                                            {copiedField === `memo-${order.id}` ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-2.5 w-2.5" />}
                                                        </button>
                                                    </div>
                                                )}
                                            </td>

                                            {/* Column 2: KHÁCH TELEGRAM */}
                                            <td className="px-4 py-3.5">
                                                <div className="flex items-center gap-1 font-bold text-zinc-900 text-xs">
                                                    <User className="h-3.5 w-3.5 text-zinc-400" />
                                                    <span>{order.user_fullname || order.username || `User #${order.user_id}`}</span>
                                                </div>
                                                {order.username && (
                                                    <div className="text-[11px] font-bold text-orange-600 mt-0.5">
                                                        @{order.username}
                                                    </div>
                                                )}
                                                {order.telegram_id && (
                                                    <div className="flex items-center gap-3 text-[10px] text-zinc-400 font-medium mt-1">
                                                        <span className="flex items-center gap-1">
                                                            User {order.telegram_id}
                                                            <button onClick={() => handleCopy(String(order.telegram_id), `uid-${order.id}`)}>
                                                                <Copy className="h-2.5 w-2.5 hover:text-zinc-700" />
                                                            </button>
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            Chat {order.telegram_id}
                                                            <button onClick={() => handleCopy(String(order.telegram_id), `cid-${order.id}`)}>
                                                                <Copy className="h-2.5 w-2.5 hover:text-zinc-700" />
                                                            </button>
                                                        </span>
                                                    </div>
                                                )}
                                            </td>

                                            {/* Column 3: SẢN PHẨM */}
                                            <td className="px-4 py-3.5">
                                                <div className="font-extrabold text-zinc-900 text-xs">
                                                    {order.product_name}
                                                </div>
                                                <div className="text-[10px] text-zinc-400 font-medium mt-0.5">
                                                    SL 1 x {formatCurrency(order.price)}
                                                </div>
                                            </td>

                                            {/* Column 4: THANH TOÁN */}
                                            <td className="px-4 py-3.5 text-right font-black text-zinc-900 text-xs">
                                                {formatCurrency(order.price)}
                                            </td>

                                            {/* Column 5: TRẠNG THÁI */}
                                            <td className="px-4 py-3.5 text-center">
                                                {renderStatusBadge(order.status)}
                                            </td>

                                            {/* Column 6: THỜI GIAN */}
                                            <td className="px-4 py-3.5 text-center text-[10px] font-medium text-zinc-500">
                                                {formatTime(order.created_at)}
                                            </td>

                                            {/* Column 7: THAO TÁC */}
                                            <td className="px-4 py-3.5 text-right">
                                                <div className="flex flex-col items-end gap-1.5">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button
                                                            onClick={() => openOrderDetail(order)}
                                                            className="p-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 transition active:scale-95 shadow-2xs"
                                                            title="Xem chi tiết đơn hàng"
                                                        >
                                                            <Eye className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleUpdateStatus(order.id, 'completed')}
                                                            className="p-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-emerald-50 hover:text-emerald-600 transition active:scale-95 shadow-2xs"
                                                            title="Cập nhật thanh toán (Hoàn thành)"
                                                        >
                                                            <DollarSign className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => openOrderDetail(order)}
                                                            className="p-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-sky-50 hover:text-sky-600 transition active:scale-95 shadow-2xs"
                                                            title="Giao tay cho khách hàng"
                                                        >
                                                            <Package className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleResendTelegram(order.id)}
                                                            className="p-1.5 rounded-lg border border-orange-200 bg-orange-50/80 text-orange-600 hover:bg-orange-100 transition active:scale-95 shadow-2xs"
                                                            title="Gửi lại dữ liệu"
                                                        >
                                                            <Send className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleUpdateStatus(order.id, 'cancelled')}
                                                            className="p-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-red-50 hover:text-red-600 transition active:scale-95 shadow-2xs"
                                                            title="Hủy đơn hàng"
                                                        >
                                                            <Ban className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleRefundPreorder(order.id)}
                                                            className="p-1.5 rounded-lg border border-orange-200 bg-orange-50/80 text-orange-600 hover:bg-orange-100 transition active:scale-95 shadow-2xs"
                                                            title="Hoàn 100% tiền đặt trước vào ví khách hàng"
                                                        >
                                                            <RotateCcw className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                    {renderDeliveryBadge(order.delivery_type)}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Table Pagination */}
                <div className="flex items-center justify-between p-4 border-t border-zinc-100 bg-zinc-50/50">
                    <div className="text-xs text-zinc-500 font-medium">
                        Trang <span className="font-bold text-zinc-900">{page}</span> / {totalPages}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page <= 1 || loading}
                            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 transition active:scale-95 shadow-2xs"
                        >
                            Trang trước
                        </button>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages || loading}
                            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 transition active:scale-95 shadow-2xs"
                        >
                            Trang sau
                        </button>
                    </div>
                </div>
            </div>

            {/* ORDER DETAILS & WARRANTY POPUP MODAL */}
            {isDetailOpen && selectedOrder && mounted && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
                    <div className="w-full max-w-3xl my-auto max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-zinc-200 animate-in zoom-in-95 duration-200">
                        {/* Top Accent Orange Border */}
                        <div className="h-1.5 w-full bg-orange-600 shrink-0" />

                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 border-b border-zinc-100 shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50 text-orange-600 font-bold border border-orange-200">
                                    <FileText className="h-4 w-4" />
                                </div>
                                <div>
                                    <h2 className="font-extrabold text-sm uppercase text-zinc-900 tracking-wide flex items-center gap-2">
                                        <span>CHI TIẾT ĐƠN HÀNG</span>
                                    </h2>
                                    <p className="text-[11px] font-mono text-zinc-400">
                                        ID: {selectedOrder.invoice_code || selectedOrder.id}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsDetailOpen(false)}
                                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Modal Scrollable Body */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-4">
                            {/* Top 2 Side-by-Side Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Card 1: KHÁCH HÀNG TELEGRAM */}
                                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-3">
                                    <div className="flex items-center gap-2 border-b border-zinc-200/80 pb-2 text-[11px] font-black uppercase text-zinc-700 tracking-wider">
                                        <User className="h-4 w-4 text-zinc-500" />
                                        <span>KHÁCH HÀNG TELEGRAM</span>
                                    </div>
                                    <div className="space-y-2 text-xs">
                                        <div className="flex items-center justify-between">
                                            <span className="text-zinc-500 font-medium">Telegram ID:</span>
                                            <div className="flex items-center gap-1.5 font-mono font-bold text-zinc-900">
                                                <span>{selectedOrder.telegram_id || '-'}</span>
                                                {selectedOrder.telegram_id && (
                                                    <button onClick={() => handleCopy(String(selectedOrder.telegram_id), 'm-tid')}>
                                                        {copiedField === 'm-tid' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3 text-zinc-400" />}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-zinc-500 font-medium">Username:</span>
                                            <div className="flex items-center gap-1.5 font-bold text-orange-600">
                                                <span>@{selectedOrder.username || '-'}</span>
                                                {selectedOrder.username && (
                                                    <button onClick={() => handleCopy(`@${selectedOrder.username}`, 'm-uname')}>
                                                        {copiedField === 'm-uname' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3 text-zinc-400" />}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-zinc-500 font-medium">Họ tên:</span>
                                            <span className="font-bold text-zinc-900">{selectedOrder.user_fullname || selectedOrder.username || '-'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Card 2: HÓA ĐƠN MUA HÀNG */}
                                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-3">
                                    <div className="flex items-center gap-2 border-b border-zinc-200/80 pb-2 text-[11px] font-black uppercase text-zinc-700 tracking-wider">
                                        <FileText className="h-4 w-4 text-zinc-500" />
                                        <span>HÓA ĐƠN MUA HÀNG</span>
                                    </div>
                                    <div className="space-y-2 text-xs">
                                        <div className="flex items-center justify-between">
                                            <span className="text-zinc-500 font-medium">Sản phẩm:</span>
                                            <span className="font-bold text-zinc-900">{selectedOrder.product_name}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-zinc-500 font-medium">Số lượng & Giá:</span>
                                            <span className="font-bold text-zinc-900">1 x {formatCurrency(selectedOrder.price)}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-zinc-500 font-medium">Tổng thanh toán:</span>
                                            <span className="font-black text-orange-600 text-sm">{formatCurrency(selectedOrder.price)}</span>
                                        </div>
                                        {selectedOrder.invoice_code && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-zinc-500 font-medium">Mã chuyển khoản:</span>
                                                <div className="flex items-center gap-1.5 font-mono font-bold text-zinc-800 bg-white border border-zinc-200 px-2 py-0.5 rounded-lg">
                                                    <span>{selectedOrder.invoice_code}</span>
                                                    <button onClick={() => handleCopy(selectedOrder.invoice_code!, 'm-inv')}>
                                                        {copiedField === 'm-inv' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3 text-zinc-400" />}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Accordion HIỆN ITEM ĐÃ BÀN GIAO */}
                            <div className="rounded-2xl border border-zinc-200 overflow-hidden bg-white">
                                <button
                                    onClick={() => setShowDeliveredItems(!showDeliveredItems)}
                                    className="w-full flex items-center justify-between p-4 text-xs font-extrabold uppercase text-zinc-800 bg-zinc-50/50 hover:bg-zinc-100/60 transition"
                                >
                                    <span>HIỆN ITEM ĐÃ BÀN GIAO ({selectedOrder.email ? 1 : 0})</span>
                                    {showDeliveredItems ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
                                </button>

                                {showDeliveredItems && (
                                    <div className="p-4 border-t border-zinc-100 space-y-2">
                                        {selectedOrder.email ? (
                                            <div className="relative rounded-xl border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs text-zinc-900 whitespace-pre-wrap break-all">
                                                <button
                                                    onClick={() => handleCopy(selectedOrder.email!, 'm-email')}
                                                    className="absolute right-3 top-3 p-1 rounded-md bg-white border border-zinc-200 text-zinc-500 hover:text-zinc-900 transition shadow-2xs"
                                                >
                                                    {copiedField === 'm-email' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                                                </button>
                                                {selectedOrder.email}
                                            </div>
                                        ) : (
                                            <p className="text-center py-4 text-xs text-zinc-400 font-medium italic">
                                                Bấm để xem toàn bộ item đã bàn giao.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Section 3: LỊCH SỬ BẢO HÀNH / ĐỔI TRẢ */}
                            <div className="rounded-2xl border border-zinc-200 p-4 bg-white space-y-2">
                                <h3 className="text-xs font-extrabold uppercase text-zinc-800 tracking-wider">
                                    LỊCH SỬ BẢO HÀNH / ĐỔI TRẢ (0)
                                </h3>
                                <div className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 text-center text-xs text-zinc-400 italic">
                                    Chưa có lịch sử bảo hành.
                                </div>
                            </div>

                            {/* Section 4: THỰC HIỆN BẢO HÀNH (ĐỔI TÀI KHOẢN MỚI) */}
                            <div className="rounded-2xl border border-zinc-200 p-4 bg-white space-y-3">
                                <div className="flex items-center gap-2 text-xs font-black uppercase text-zinc-800 tracking-wider">
                                    <ArrowLeftRight className="h-4 w-4 text-orange-500" />
                                    <span>THỰC HIỆN BẢO HÀNH (ĐỔI TÀI KHOẢN MỚI)</span>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-extrabold uppercase text-zinc-600">
                                        CHỌN NHANH TỪ KHO HÀNG (CÒN RẢNH):
                                    </label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setWarrantyData(prev => prev ? `${prev}\n1345|145` : '1345|145')}
                                            className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-mono font-bold text-zinc-800 hover:bg-orange-50 hover:border-orange-300 transition"
                                        >
                                            + 1345|145
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-extrabold uppercase text-zinc-700">
                                        TÀI KHOẢN BẢO HÀNH MỚI <span className="text-orange-500">*</span>
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={warrantyData}
                                        onChange={(e) => setWarrantyData(e.target.value)}
                                        placeholder="Nhập/dán dữ liệu tài khoản mới thay thế..."
                                        className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-xs font-mono text-zinc-900 outline-none focus:border-orange-500 transition"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-extrabold uppercase text-zinc-700">
                                        GHI CHÚ LÝ DO BẢO HÀNH
                                    </label>
                                    <input
                                        type="text"
                                        value={warrantyReason}
                                        onChange={(e) => setWarrantyReason(e.target.value)}
                                        placeholder="Ví dụ: Tài khoản bị khóa, sai pass..."
                                        className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-xs font-medium text-zinc-900 outline-none focus:border-orange-500 transition"
                                    />
                                </div>

                                <div className="flex justify-end pt-1">
                                    <button
                                        onClick={handleSendWarranty}
                                        disabled={submittingWarranty || !warrantyData.trim()}
                                        className="rounded-xl bg-orange-600 px-6 py-2.5 text-xs font-extrabold uppercase text-white hover:bg-orange-700 active:scale-95 transition shadow-xs disabled:opacity-50 disabled:pointer-events-none"
                                    >
                                        {submittingWarranty ? 'ĐANG GỬI...' : 'GỬI BẢO HÀNH'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end p-4 border-t border-zinc-100 bg-zinc-50/50 shrink-0">
                            <button
                                onClick={() => setIsDetailOpen(false)}
                                className="rounded-xl border border-zinc-200 bg-white px-6 py-2.5 text-xs font-extrabold uppercase text-zinc-700 hover:bg-zinc-100 active:scale-95 transition shadow-2xs"
                            >
                                ĐÓNG
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
