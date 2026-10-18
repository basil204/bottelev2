'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    Users, UserPlus, Wallet, ShieldCheck, Search, RefreshCw, Copy, Check,
    PlusCircle, MinusCircle, Ban, CheckCircle2, XCircle, Tag, ShoppingBag,
    Key, Eye, FileText, ArrowUpRight, Clock, MessageSquare, ExternalLink, ShieldAlert, X, Trash2, GraduationCap
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface UserItem {
    id: number;
    telegram_id?: number | null;
    username?: string | null;
    name?: string | null;
    balance: number;
    total_deposited?: number;
    rank_name?: string;
    rank_bonus_percentage?: number;
    rank_progress?: number;
    next_rank_name?: string | null;
    next_rank_min?: number | null;
    customer_tag?: string | null;
    admin_note?: string | null;
    is_banned?: number | boolean;
    language?: string;
    created_at: string;
    updated_at?: string;
}

interface UserOrder {
    id: number;
    invoice_code?: string | null;
    product_id: number;
    product_name: string;
    price: number;
    status: string;
    is_api_order?: number | boolean;
    source?: string;
    created_at: string;
}

export default function UsersManagementPage() {
    const { t } = useLanguage();
    const [mounted, setMounted] = useState(false);
    const [users, setUsers] = useState<UserItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalUsers, setTotalUsers] = useState(0);
    const [totalWalletBalance, setTotalWalletBalance] = useState(0);
    const [todayRegisteredUsers, setTodayRegisteredUsers] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'banned'>('all');
    const [copiedField, setCopiedField] = useState<string | null>(null);

    // Selected user for modals
    const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);

    // User Details Modal
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [detailUser, setDetailUser] = useState<UserItem | null>(null);
    const [deletingUserId, setDeletingUserId] = useState<number | null>(null);

    // Balance Top-up / Deduct Modal
    const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
    const [balanceType, setBalanceType] = useState<'add' | 'subtract'>('add');
    const [balanceAmount, setBalanceAmount] = useState('');
    const [balanceReason, setBalanceReason] = useState('');
    const [submittingBalance, setSubmittingBalance] = useState(false);

    // Tag & Admin Note Modal
    const [isMetaModalOpen, setIsMetaModalOpen] = useState(false);
    const [metaTag, setMetaTag] = useState('');
    const [metaNote, setMetaNote] = useState('');
    const [submittingMeta, setSubmittingMeta] = useState(false);

    // User Orders History Modal
    const [isOrdersModalOpen, setIsOrdersModalOpen] = useState(false);
    const [userOrders, setUserOrders] = useState<UserOrder[]>([]);
    const [loadingOrders, setLoadingOrders] = useState(false);
    const [ordersFilter, setOrdersFilter] = useState<'all' | 'api'>('all');

    // API Key Modal
    const [apiKeyModal, setApiKeyModal] = useState<{ user: UserItem; apiKey: string } | null>(null);

    // Gmail EDU Custom Price Modal
    const [isEduPriceModalOpen, setIsEduPriceModalOpen] = useState(false);
    const [eduPriceUser, setEduPriceUser] = useState<UserItem | null>(null);
    const [eduDefaultPrice, setEduDefaultPrice] = useState<number>(10000);
    const [currentEduCustomPrice, setCurrentEduCustomPrice] = useState<any | null>(null);
    const [newEduPrice, setNewEduPrice] = useState('');
    const [eduPriceScope, setEduPriceScope] = useState<'ALL_ORDERS' | 'CLIENT_API'>('ALL_ORDERS');
    const [eduPriceIsActive, setEduPriceIsActive] = useState(true);
    const [loadingEduPrice, setLoadingEduPrice] = useState(false);
    const [submittingEduPrice, setSubmittingEduPrice] = useState(false);

    const fetchUsers = () => {
        setLoading(true);
        const params = new URLSearchParams({
            page: String(page),
            limit: '15',
            search: searchTerm
        });

        fetch(`/api/users?${params.toString()}`)
            .then((res) => res.json())
            .then((data) => {
                let list: UserItem[] = Array.isArray(data.data) ? data.data : [];
                if (statusFilter === 'active') list = list.filter(u => !u.is_banned);
                if (statusFilter === 'banned') list = list.filter(u => Boolean(u.is_banned));
                setUsers(list);
                setTotalPages(data.pagination?.totalPages || 1);
                setTotalUsers(data.pagination?.total || 0);
                if (data.stats) {
                    if (typeof data.stats.totalWalletBalance === 'number') setTotalWalletBalance(data.stats.totalWalletBalance);
                    if (typeof data.stats.todayRegisteredUsers === 'number') setTodayRegisteredUsers(data.stats.todayRegisteredUsers);
                }
                setLoading(false);
            })
            .catch((err) => {
                console.error('Error fetching users:', err);
                setUsers([]);
                setLoading(false);
            });
    };

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [page, statusFilter]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        fetchUsers();
    };

    const handleCopy = (text: string, fieldId: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedField(fieldId);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(val || 0) + ' đ';
    };

    const formatDateStr = (dateStr?: string) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleDateString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    // Toggle Ban
    const handleToggleBan = async (user: UserItem) => {
        const actionText = user.is_banned ? 'MỞ KHÓA' : 'KHÓA TÀI KHOẢN';
        if (!window.confirm(`Bạn có chắc muốn ${actionText} người dùng ${user.username || user.telegram_id || user.id}?`)) return;

        try {
            const res = await fetch('/api/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: user.id, type: 'toggle_ban' })
            });
            if (res.ok) {
                if (detailUser && detailUser.id === user.id) {
                    setDetailUser({ ...detailUser, is_banned: !detailUser.is_banned });
                }
                fetchUsers();
            } else {
                alert('Lỗi cập nhật trạng thái');
            }
        } catch (e) {
            alert('Lỗi kết nối server');
        }
    };

    // Open Detail Modal
    const openDetailModal = (user: UserItem) => {
        setDetailUser(user);
        setIsDetailModalOpen(true);
    };

    // Delete User
    const handleDeleteUser = async (user: UserItem) => {
        const displayName = user.username ? `@${user.username}` : (user.name || `ID ${user.telegram_id || user.id}`);
        const confirmMsg = `⚠️ CẢNH BÁO XÓA VĨNH VIỄN:\n\nBạn có chắc chắn muốn xóa người dùng "${displayName}" (Mã hệ thống: #${user.id})?\n\n• Tất cả thông tin tài khoản, số dư, lịch sử biến động và API key liên quan sẽ bị xóa.\n• Hành động này KHÔNG THỂ khôi phục!`;
        if (!window.confirm(confirmMsg)) return;

        setDeletingUserId(user.id);
        try {
            const res = await fetch(`/api/users?id=${user.id}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (res.ok) {
                alert(`✅ Đã xóa người dùng ${displayName} thành công!`);
                if (isDetailModalOpen && detailUser?.id === user.id) {
                    setIsDetailModalOpen(false);
                    setDetailUser(null);
                }
                fetchUsers();
            } else {
                alert(data.error || 'Lỗi khi xóa người dùng');
            }
        } catch (e: any) {
            alert(e.message || 'Lỗi kết nối server khi xóa người dùng');
        } finally {
            setDeletingUserId(null);
        }
    };

    // Open Balance Modal
    const openBalanceModal = (user: UserItem, type: 'add' | 'subtract') => {
        setSelectedUser(user);
        setBalanceType(type);
        setBalanceAmount('');
        setBalanceReason(type === 'add' ? 'Admin cộng tiền khuyến mãi' : 'Admin trừ tiền điều chỉnh');
        setIsBalanceModalOpen(true);
    };

    // Submit Balance Update
    const handleBalanceSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser || !balanceAmount || Number(balanceAmount) <= 0) {
            alert('Vui lòng nhập số tiền hợp lệ (> 0)!');
            return;
        }

        setSubmittingBalance(true);
        try {
            const res = await fetch('/api/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: selectedUser.id,
                    type: balanceType,
                    amount: Number(balanceAmount),
                    reason: balanceReason.trim()
                })
            });

            if (res.ok) {
                alert(`✅ Đã ${balanceType === 'add' ? 'cộng' : 'trừ'} ${formatCurrency(Number(balanceAmount))} thành công!`);
                setIsBalanceModalOpen(false);
                fetchUsers();
            } else {
                const data = await res.json();
                alert(data.error || 'Lỗi cập nhật số dư');
            }
        } catch (e) {
            alert('Lỗi kết nối server');
        } finally {
            setSubmittingBalance(false);
        }
    };

    // Open Meta Tag Modal
    const openMetaModal = (user: UserItem) => {
        setSelectedUser(user);
        setMetaTag(user.customer_tag || '');
        setMetaNote(user.admin_note || '');
        setIsMetaModalOpen(true);
    };

    // Submit Meta Tag & Note
    const handleMetaSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser) return;

        setSubmittingMeta(true);
        try {
            const res = await fetch('/api/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: selectedUser.id,
                    type: 'admin_metadata',
                    customer_tag: metaTag.trim(),
                    admin_note: metaNote.trim()
                })
            });

            if (res.ok) {
                alert('✅ Đã lưu nhãn & ghi chú thành công!');
                setIsMetaModalOpen(false);
                fetchUsers();
            } else {
                alert('Lỗi lưu thông tin');
            }
        } catch (e) {
            alert('Lỗi kết nối server');
        } finally {
            setSubmittingMeta(false);
        }
    };

    // Open Orders Modal
    const fetchUserOrders = (userId: number, filter: 'all' | 'api') => {
        setLoadingOrders(true);
        fetch(`/api/users/${userId}/orders${filter === 'api' ? '?api_only=true' : ''}`)
            .then((res) => res.json())
            .then((data) => {
                setUserOrders(Array.isArray(data.orders) ? data.orders : []);
                setLoadingOrders(false);
            })
            .catch(() => {
                setUserOrders([]);
                setLoadingOrders(false);
            });
    };

    const openOrdersModal = (user: UserItem, filter: 'all' | 'api' = 'all') => {
        setSelectedUser(user);
        setOrdersFilter(filter);
        setIsOrdersModalOpen(true);
        fetchUserOrders(user.id, filter);
    };

    // Generate API Key
    const handleGenerateApiKey = async (user: UserItem) => {
        try {
            const res = await fetch('/api/user-api-keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    name: `API Key - ${user.username || user.telegram_id || user.id}`
                })
            });
            const data = await res.json();
            if (res.ok && data.api_key) {
                setApiKeyModal({ user, apiKey: data.api_key });
            } else {
                alert(data.error || 'Lỗi tạo API Key');
            }
        } catch (e: any) {
            alert(e.message || 'Lỗi kết nối server');
        }
    };

    // Open EDU Price Modal
    const openEduPriceModal = async (user: UserItem) => {
        setEduPriceUser(user);
        setIsEduPriceModalOpen(true);
        setLoadingEduPrice(true);
        setCurrentEduCustomPrice(null);
        setNewEduPrice('');
        setEduPriceScope('ALL_ORDERS');
        setEduPriceIsActive(true);

        try {
            // Lấy giá mặc định hệ thống từ settings
            fetch('/api/settings')
                .then(r => r.json())
                .then(data => {
                    const settingsList = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
                    const eduItem = settingsList.find((s: any) => s.key === 'gmail_edu_price');
                    if (eduItem && eduItem.value) {
                        setEduDefaultPrice(Number(eduItem.value) || 10000);
                    }
                })
                .catch(() => {});

            // Lấy giá custom hiện tại của user
            const res = await fetch(`/api/custom-pricing?userId=${user.id}`);
            const data = await res.json();
            const list = Array.isArray(data.data) ? data.data : [];
            const eduRule = list.find((item: any) => 
                String(item.product_id) === '-1' || item.plan_id === 'gmail_edu' || item.plan_id === 'gmail' || item.scope === 'GMAIL_EDU'
            );

            if (eduRule) {
                setCurrentEduCustomPrice(eduRule);
                setNewEduPrice(String(eduRule.custom_price));
                setEduPriceScope(eduRule.scope === 'CLIENT_API' ? 'CLIENT_API' : 'ALL_ORDERS');
                setEduPriceIsActive(Boolean(eduRule.is_active));
            }
        } catch (e) {
            console.error('Error fetching EDU custom price:', e);
        } finally {
            setLoadingEduPrice(false);
        }
    };

    // Save EDU Price
    const handleSaveEduPrice = async () => {
        if (!eduPriceUser) return;
        const priceNum = Number(newEduPrice);
        if (isNaN(priceNum) || priceNum < 0) {
            alert('Vui lòng nhập giá hợp lệ (>= 0 VNĐ)!');
            return;
        }

        setSubmittingEduPrice(true);
        try {
            const res = await fetch('/api/custom-pricing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: eduPriceUser.id,
                    productId: -1,
                    planId: 'gmail_edu',
                    customPrice: priceNum,
                    scope: eduPriceScope,
                    isActive: eduPriceIsActive
                })
            });

            const data = await res.json();
            if (res.ok) {
                alert(`✅ Đã lưu giá riêng Email EDU ${formatCurrency(priceNum)} cho người dùng thành công!`);
                setIsEduPriceModalOpen(false);
            } else {
                alert(data.error || 'Lỗi lưu giá Email EDU');
            }
        } catch (e: any) {
            alert(e.message || 'Lỗi kết nối máy chủ');
        } finally {
            setSubmittingEduPrice(false);
        }
    };

    // Delete EDU Price (revert to default)
    const handleDeleteEduPrice = async () => {
        if (!currentEduCustomPrice || !eduPriceUser) return;
        if (!window.confirm(`Xác nhận XÓA giá riêng Email EDU của khách hàng này? Giá mua sẽ quay về giá mặc định hệ thống (${formatCurrency(eduDefaultPrice)}).`)) {
            return;
        }

        setSubmittingEduPrice(true);
        try {
            const res = await fetch(`/api/custom-pricing?id=${currentEduCustomPrice.id}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (res.ok) {
                alert('✅ Đã xóa giá riêng thành công. Tài khoản sẽ áp dụng giá mặc định hệ thống!');
                setIsEduPriceModalOpen(false);
            } else {
                alert(data.error || 'Lỗi xóa giá riêng');
            }
        } catch (e: any) {
            alert(e.message || 'Lỗi kết nối máy chủ');
        } finally {
            setSubmittingEduPrice(false);
        }
    };

    const activeCount = users.filter(u => !u.is_banned).length;

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12 text-zinc-900">
            {/* 1. Page Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 font-bold border border-indigo-200/80 shadow-2xs">
                        <Users className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-zinc-950 flex items-center gap-2">
                            QUẢN LÝ NGƯỜI DÙNG & THÀNH VIÊN
                        </h1>
                        <p className="text-xs text-zinc-500 font-medium">
                            Xem thông tin tài khoản, cấp số dư, gắn nhãn, xem đơn hàng và phân quyền
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5">
                    <button
                        onClick={fetchUsers}
                        className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs font-bold text-zinc-700 shadow-2xs hover:bg-zinc-50 active:scale-95 transition"
                    >
                        <RefreshCw className={`h-4 w-4 text-zinc-500 ${loading ? 'animate-spin' : ''}`} />
                        <span>LÀM MỚI</span>
                    </button>
                </div>
            </div>

            {/* 2. 4 Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Users */}
                <div className="rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-white p-5 shadow-2xs">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-indigo-800">TỔNG NGƯỜI DÙNG</span>
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-500/30">
                            <Users className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="mt-3 text-2xl font-black text-zinc-950">
                        {totalUsers.toLocaleString('vi-VN')}
                    </div>
                    <p className="mt-1 text-[11px] font-medium text-zinc-500">Tài khoản trên toàn hệ thống</p>
                </div>

                {/* Today Registrations */}
                <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-white p-5 shadow-2xs">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800">ĐĂNG KÝ HÔM NAY</span>
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-500/30">
                            <UserPlus className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="mt-3 text-2xl font-black text-emerald-600">
                        +{todayRegisteredUsers.toLocaleString('vi-VN')}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[11px] font-bold text-emerald-700">Mới gia nhập trong 24h</span>
                    </div>
                </div>

                {/* Total Wallet Balance */}
                <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-white p-5 shadow-2xs">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-amber-800">TỔNG SỐ DƯ VÍ KHÁCH</span>
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm shadow-amber-500/30">
                            <Wallet className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="mt-3 text-2xl font-black text-zinc-950">
                        {formatCurrency(totalWalletBalance)}
                    </div>
                    <p className="mt-1 text-[11px] font-medium text-zinc-500">Số dư khả dụng của tất cả ví</p>
                </div>

                {/* Account Status */}
                <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-2xs">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">TRẠNG THÁI HOẠT ĐỘNG</span>
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                            <ShieldCheck className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="mt-3 text-2xl font-black text-emerald-600 flex items-center gap-2">
                        {activeCount} <span className="text-xs font-bold text-zinc-400">hoạt động</span>
                    </div>
                    <p className="mt-1 text-[11px] font-medium text-zinc-500">Hiển thị trên trang hiện tại</p>
                </div>
            </div>

            {/* 3. Search & Filter Bar */}
            <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-2xs">
                <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-8 relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Tìm kiếm theo Username, Telegram ID, Nhãn khách, Ghi chú..."
                            className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 pl-10 pr-4 py-2.5 text-xs font-semibold text-zinc-800 outline-none focus:border-indigo-500 focus:bg-white transition"
                        />
                    </div>

                    <div className="sm:col-span-2">
                        <select
                            value={statusFilter}
                            onChange={(e: any) => setStatusFilter(e.target.value)}
                            className="w-full h-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-xs font-bold text-zinc-700 outline-none focus:border-indigo-500 transition cursor-pointer"
                        >
                            <option value="all">Tất cả trạng thái</option>
                            <option value="active">Đang hoạt động</option>
                            <option value="banned">Đang bị khóa</option>
                        </select>
                    </div>

                    <div className="sm:col-span-2">
                        <button
                            type="submit"
                            className="w-full h-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase transition active:scale-95 py-2.5 shadow-2xs cursor-pointer"
                        >
                            TÌM KIẾM
                        </button>
                    </div>
                </form>
            </div>

            {/* 4. Users Table */}
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="border-b border-zinc-100 bg-zinc-50/80 text-[11px] font-black uppercase tracking-wider text-zinc-500">
                                <th className="px-4 py-3.5">NGƯỜI DÙNG / TELEGRAM</th>
                                <th className="px-4 py-3.5">CẤP ĐỘ / RANK</th>
                                <th className="px-4 py-3.5 text-right">SỐ DƯ VÍ</th>
                                <th className="px-4 py-3.5 text-right">TỔNG NẠP</th>
                                <th className="px-4 py-3.5">NHÃN & GHI CHÚ</th>
                                <th className="px-4 py-3.5">NGÀY THAM GIA</th>
                                <th className="px-4 py-3.5 text-center">TRẠNG THÁI</th>
                                <th className="px-4 py-3.5 text-right">THAO TÁC</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-xs font-medium text-zinc-400">
                                        Đang tải danh sách người dùng...
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-xs font-medium text-zinc-400">
                                        Không tìm thấy người dùng nào phù hợp.
                                    </td>
                                </tr>
                            ) : (
                                users.map((u) => (
                                    <tr key={u.id} className="hover:bg-zinc-50/80 transition-colors">
                                        {/* User Name & TG */}
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-2">
                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 font-bold text-indigo-700 text-xs border border-indigo-200/60">
                                                    {(u.username || u.name || 'U').slice(0, 1).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-extrabold text-zinc-900 text-xs flex items-center gap-1.5">
                                                        {u.username ? `@${u.username}` : (u.name || `User #${u.id}`)}
                                                        {u.username && (
                                                            <a
                                                                href={`https://t.me/${u.username}`}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="text-zinc-400 hover:text-indigo-600 transition"
                                                                title="Mở Telegram"
                                                            >
                                                                <ExternalLink className="h-3 w-3" />
                                                            </a>
                                                        )}
                                                    </div>
                                                    <div className="text-[10px] font-mono text-zinc-400 flex items-center gap-1">
                                                        <span>ID: {u.telegram_id || u.id}</span>
                                                        <button
                                                            onClick={() => handleCopy(String(u.telegram_id || u.id), `tg_${u.id}`)}
                                                            className="hover:text-zinc-600 transition"
                                                            title="Copy ID"
                                                        >
                                                            {copiedField === `tg_${u.id}` ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Rank */}
                                        <td className="px-4 py-3.5">
                                            <span className="inline-block rounded-md bg-amber-50 border border-amber-200/70 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                                                {u.rank_name || 'Thường'}
                                            </span>
                                            {u.next_rank_name && (
                                                <div className="text-[10px] text-zinc-400 mt-0.5">
                                                    Tiến độ: {u.rank_progress || 0}%
                                                </div>
                                            )}
                                        </td>

                                        {/* Balance */}
                                        <td className="px-4 py-3.5 text-right font-black text-sm text-emerald-600">
                                            {formatCurrency(u.balance)}
                                        </td>

                                        {/* Total Deposited */}
                                        <td className="px-4 py-3.5 text-right font-bold text-xs text-zinc-700">
                                            {formatCurrency(u.total_deposited || 0)}
                                        </td>

                                        {/* Tag & Note */}
                                        <td className="px-4 py-3.5">
                                            <div className="flex flex-col gap-1 max-w-[180px]">
                                                {u.customer_tag ? (
                                                    <span className="inline-block rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-extrabold text-indigo-700 w-fit">
                                                        🏷️ {u.customer_tag}
                                                    </span>
                                                ) : null}
                                                {u.admin_note ? (
                                                    <span className="text-[10px] text-zinc-500 truncate" title={u.admin_note}>
                                                        📝 {u.admin_note}
                                                    </span>
                                                ) : !u.customer_tag ? (
                                                    <span className="text-[10px] text-zinc-300">Chưa gắn tag</span>
                                                ) : null}
                                            </div>
                                        </td>

                                        {/* Created at */}
                                        <td className="px-4 py-3.5 text-[10px] font-mono text-zinc-500 whitespace-nowrap">
                                            {formatDateStr(u.created_at)}
                                        </td>

                                        {/* Status */}
                                        <td className="px-4 py-3.5 text-center">
                                            {u.is_banned ? (
                                                <span className="inline-flex items-center gap-1 rounded-md bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-extrabold text-red-700">
                                                    <XCircle className="h-3 w-3" /> ĐÃ KHÓA
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">
                                                    <CheckCircle2 className="h-3 w-3" /> HOẠT ĐỘNG
                                                </span>
                                            )}
                                        </td>

                                        {/* Actions */}
                                        <td className="px-4 py-3.5 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {/* View Details */}
                                                <button
                                                    onClick={() => openDetailModal(u)}
                                                    className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition cursor-pointer"
                                                    title="Xem chi tiết người dùng"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </button>

                                                {/* Top-up Balance */}
                                                <button
                                                    onClick={() => openBalanceModal(u, 'add')}
                                                    className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition cursor-pointer"
                                                    title="Cộng tiền ví"
                                                >
                                                    <PlusCircle className="h-4 w-4" />
                                                </button>

                                                {/* Deduct Balance */}
                                                <button
                                                    onClick={() => openBalanceModal(u, 'subtract')}
                                                    className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                                                    title="Trừ tiền ví"
                                                >
                                                    <MinusCircle className="h-4 w-4" />
                                                </button>

                                                {/* Edit Tag & Note */}
                                                <button
                                                    onClick={() => openMetaModal(u)}
                                                    className="p-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition cursor-pointer"
                                                    title="Gắn tag & ghi chú"
                                                >
                                                    <Tag className="h-4 w-4" />
                                                </button>

                                                {/* View Orders */}
                                                <button
                                                    onClick={() => openOrdersModal(u)}
                                                    className="p-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition cursor-pointer"
                                                    title="Lịch sử đơn hàng"
                                                >
                                                    <ShoppingBag className="h-4 w-4" />
                                                </button>

                                                {/* Set Gmail EDU Price */}
                                                <button
                                                    onClick={() => openEduPriceModal(u)}
                                                    className="p-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 transition cursor-pointer"
                                                    title="Cài đặt giá Email EDU"
                                                >
                                                    <GraduationCap className="h-4 w-4" />
                                                </button>

                                                {/* Generate API Key */}
                                                <button
                                                    onClick={() => handleGenerateApiKey(u)}
                                                    className="p-1.5 rounded-lg bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition cursor-pointer"
                                                    title="Tạo API Key"
                                                >
                                                    <Key className="h-4 w-4" />
                                                </button>

                                                {/* Ban / Unban */}
                                                <button
                                                    onClick={() => handleToggleBan(u)}
                                                    className={`p-1.5 rounded-lg transition cursor-pointer ${u.is_banned ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-orange-50 text-orange-700 hover:bg-orange-100'}`}
                                                    title={u.is_banned ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
                                                >
                                                    <Ban className="h-4 w-4" />
                                                </button>

                                                {/* Delete User */}
                                                <button
                                                    onClick={() => handleDeleteUser(u)}
                                                    disabled={deletingUserId === u.id}
                                                    className="p-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition cursor-pointer disabled:opacity-50"
                                                    title="Xóa vĩnh viễn người dùng"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between p-4 border-t border-zinc-100 bg-zinc-50/50">
                    <div className="text-xs text-zinc-500 font-medium">
                        Trang <span className="font-bold text-zinc-900">{page}</span> / {totalPages} ({totalUsers} thành viên)
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page <= 1 || loading}
                            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 transition active:scale-95 shadow-2xs cursor-pointer"
                        >
                            Trang trước
                        </button>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages || loading}
                            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 transition active:scale-95 shadow-2xs cursor-pointer"
                        >
                            Trang sau
                        </button>
                    </div>
                </div>
            </div>

            {/* MODAL 0: CHI TIẾT NGƯỜI DÙNG */}
            {isDetailModalOpen && detailUser && mounted && createPortal(
                <div
                    className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
                    onClick={() => setIsDetailModalOpen(false)}
                >
                    <div
                        className="relative w-full max-w-2xl my-auto rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-zinc-200 space-y-6 max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between border-b border-zinc-100 pb-4">
                            <div className="flex items-center gap-3.5">
                                <div className="relative">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-black text-xl shadow-md shadow-indigo-500/20">
                                        {(detailUser.username || detailUser.name || 'U').slice(0, 1).toUpperCase()}
                                    </div>
                                    <span
                                        className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white ${
                                            detailUser.is_banned ? 'bg-rose-500' : 'bg-emerald-500'
                                        }`}
                                    />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg font-black uppercase tracking-tight text-zinc-900">
                                            {detailUser.name || detailUser.username || `User #${detailUser.id}`}
                                        </h3>
                                        {detailUser.is_banned ? (
                                            <span className="rounded-md bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-black text-rose-700">
                                                ĐÃ KHÓA
                                            </span>
                                        ) : (
                                            <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                                                HOẠT ĐỘNG
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                        {detailUser.username && (
                                            <a
                                                href={`https://t.me/${detailUser.username}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-md"
                                            >
                                                @{detailUser.username}
                                                <ExternalLink className="h-3 w-3" />
                                            </a>
                                        )}
                                        <div className="text-[11px] font-mono text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                                            <span>TG ID: {detailUser.telegram_id || detailUser.id}</span>
                                            <button
                                                onClick={() => handleCopy(String(detailUser.telegram_id || detailUser.id), 'detail_tg_id')}
                                                className="hover:text-zinc-800 cursor-pointer"
                                                title="Sao chép ID"
                                            >
                                                {copiedField === 'detail_tg_id' ? (
                                                    <Check className="h-3 w-3 text-emerald-600" />
                                                ) : (
                                                    <Copy className="h-3 w-3" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsDetailModalOpen(false)}
                                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition cursor-pointer"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto space-y-5 pr-1 text-xs">
                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200">
                                    <span className="text-[10px] font-black uppercase text-emerald-800">Số Dư Khả Dụng</span>
                                    <div className="text-base font-black text-emerald-700 mt-1">
                                        {formatCurrency(detailUser.balance)}
                                    </div>
                                </div>
                                <div className="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-200">
                                    <span className="text-[10px] font-black uppercase text-indigo-800">Tổng Đã Nạp</span>
                                    <div className="text-base font-black text-indigo-700 mt-1">
                                        {formatCurrency(detailUser.total_deposited || 0)}
                                    </div>
                                </div>
                                <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200">
                                    <span className="text-[10px] font-black uppercase text-amber-800">Cấp Bậc Rank</span>
                                    <div className="text-base font-black text-amber-800 mt-1">
                                        {detailUser.rank_name || 'Thường'}
                                    </div>
                                    {detailUser.rank_bonus_percentage ? (
                                        <div className="text-[10px] font-bold text-amber-700">+{detailUser.rank_bonus_percentage}% nạp</div>
                                    ) : null}
                                </div>
                                <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200">
                                    <span className="text-[10px] font-black uppercase text-zinc-500">Mã User Hệ Thống</span>
                                    <div className="text-base font-black text-zinc-800 mt-1">
                                        #{detailUser.id}
                                    </div>
                                </div>
                            </div>

                            {/* Rank Progress Bar if next tier exists */}
                            {detailUser.next_rank_name && (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-3.5 space-y-1.5">
                                    <div className="flex justify-between text-[11px] font-bold">
                                        <span className="text-amber-900">Tiến độ lên hạng {detailUser.next_rank_name}:</span>
                                        <span className="text-amber-800">{detailUser.rank_progress || 0}% ({formatCurrency(detailUser.total_deposited || 0)} / {formatCurrency(detailUser.next_rank_min || 0)})</span>
                                    </div>
                                    <div className="h-2 w-full bg-amber-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-amber-500 rounded-full transition-all duration-300"
                                            style={{ width: `${Math.min(100, Math.max(0, detailUser.rank_progress || 0))}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Tags & Admin Note */}
                            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-extrabold uppercase text-zinc-700">Nhãn Khách & Ghi Chú Admin</span>
                                    <button
                                        onClick={() => {
                                            setIsDetailModalOpen(false);
                                            openMetaModal(detailUser);
                                        }}
                                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                                    >
                                        <Tag className="h-3.5 w-3.5" /> Chỉnh sửa
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <div className="text-[10px] font-bold uppercase text-zinc-400">Nhãn khách hàng:</div>
                                        <div className="mt-1 font-bold text-zinc-800">
                                            {detailUser.customer_tag ? (
                                                <span className="inline-block rounded-lg bg-indigo-100 text-indigo-800 px-2.5 py-1 text-xs">
                                                    🏷️ {detailUser.customer_tag}
                                                </span>
                                            ) : (
                                                <span className="text-zinc-400 italic">Chưa gắn nhãn</span>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold uppercase text-zinc-400">Ghi chú quản trị:</div>
                                        <div className="mt-1 font-medium text-zinc-700">
                                            {detailUser.admin_note || <span className="text-zinc-400 italic">Không có ghi chú</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Additional info */}
                            <div className="rounded-2xl border border-zinc-200 p-4 space-y-2 text-[11px]">
                                <div className="flex justify-between py-1 border-b border-zinc-100">
                                    <span className="text-zinc-500 font-medium">Thời gian đăng ký:</span>
                                    <span className="font-mono font-bold text-zinc-800">{formatDateStr(detailUser.created_at)}</span>
                                </div>
                                <div className="flex justify-between py-1">
                                    <span className="text-zinc-500 font-medium">Ngôn ngữ giao diện:</span>
                                    <span className="font-bold text-zinc-800 uppercase">{detailUser.language || 'vi'}</span>
                                </div>
                            </div>

                            {/* Fast Action Shortcuts */}
                            <div className="space-y-2">
                                <div className="text-[11px] font-black uppercase text-zinc-500 tracking-wider">Thao Tác Nhanh</div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    <button
                                        onClick={() => {
                                            setIsDetailModalOpen(false);
                                            openBalanceModal(detailUser, 'add');
                                        }}
                                        className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                                    >
                                        <PlusCircle className="h-4 w-4" /> Cộng Tiền
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsDetailModalOpen(false);
                                            openBalanceModal(detailUser, 'subtract');
                                        }}
                                        className="p-2.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                                    >
                                        <MinusCircle className="h-4 w-4" /> Trừ Tiền
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsDetailModalOpen(false);
                                            openOrdersModal(detailUser);
                                        }}
                                        className="p-2.5 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                                    >
                                        <ShoppingBag className="h-4 w-4" /> Đơn Hàng
                                    </button>
                                    <button
                                        onClick={() => {
                                            handleGenerateApiKey(detailUser);
                                        }}
                                        className="p-2.5 rounded-xl bg-zinc-100 text-zinc-800 hover:bg-zinc-200 border border-zinc-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                                    >
                                        <Key className="h-4 w-4" /> API Key
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsDetailModalOpen(false);
                                            openEduPriceModal(detailUser);
                                        }}
                                        className="p-2.5 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                                    >
                                        <GraduationCap className="h-4 w-4" /> Giá EDU
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-between border-t border-zinc-100 pt-4">
                            <button
                                onClick={() => handleDeleteUser(detailUser)}
                                disabled={deletingUserId === detailUser.id}
                                className="rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 px-4 py-2.5 text-xs font-black uppercase text-rose-700 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                                <Trash2 className="h-4 w-4" />
                                <span>XÓA TÀI KHOẢN VĨNH VIỄN</span>
                            </button>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleToggleBan(detailUser)}
                                    className={`rounded-xl px-4 py-2.5 text-xs font-black uppercase transition cursor-pointer ${
                                        detailUser.is_banned
                                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                            : 'bg-orange-500 hover:bg-orange-600 text-white'
                                    }`}
                                >
                                    {detailUser.is_banned ? 'MỞ KHÓA TÀI KHOẢN' : 'KHÓA TÀI KHOẢN'}
                                </button>
                                <button
                                    onClick={() => setIsDetailModalOpen(false)}
                                    className="rounded-xl border border-zinc-200 bg-zinc-100 hover:bg-zinc-200 px-5 py-2.5 text-xs font-black uppercase text-zinc-700 transition cursor-pointer"
                                >
                                    ĐÓNG
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Modal 1: Nạp / Trừ Số Dư Ví */}
            {isBalanceModalOpen && selectedUser && mounted && createPortal(
                <div
                    className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
                    onClick={() => setIsBalanceModalOpen(false)}
                >
                    <div
                        className="relative w-full max-w-md my-auto rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200 space-y-4 animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                            <div className="flex items-center gap-2">
                                <Wallet className={`h-5 w-5 ${balanceType === 'add' ? 'text-emerald-600' : 'text-rose-600'}`} />
                                <h3 className="text-sm font-black uppercase text-zinc-900">
                                    {balanceType === 'add' ? 'CỘNG TIỀN VÍ' : 'TRỪ TIỀN VÍ'}
                                </h3>
                            </div>
                            <button
                                onClick={() => setIsBalanceModalOpen(false)}
                                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 font-bold transition cursor-pointer"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="rounded-xl bg-zinc-50 p-3 text-xs border border-zinc-100">
                            <div className="text-zinc-500 font-medium">Khách hàng: <span className="font-extrabold text-zinc-900">@{selectedUser.username || selectedUser.id}</span></div>
                            <div className="text-zinc-500 font-medium mt-1">Số dư hiện tại: <span className="font-extrabold text-emerald-600">{formatCurrency(selectedUser.balance)}</span></div>
                        </div>

                        <form onSubmit={handleBalanceSubmit} className="space-y-3.5 text-xs">
                            <div className="space-y-1">
                                <label className="font-extrabold uppercase text-zinc-700 text-[11px]">
                                    SỐ TIỀN THAY ĐỔI (VNĐ) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    min={1000}
                                    step={1000}
                                    value={balanceAmount}
                                    onChange={(e) => setBalanceAmount(e.target.value)}
                                    placeholder="VD: 50000"
                                    className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-black text-sm text-zinc-900 outline-none focus:border-indigo-500 transition"
                                    required
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="font-extrabold uppercase text-zinc-700 text-[11px]">
                                    LÝ DO BIẾN ĐỘNG
                                </label>
                                <input
                                    type="text"
                                    value={balanceReason}
                                    onChange={(e) => setBalanceReason(e.target.value)}
                                    placeholder="VD: Khuyến mãi, hoàn tiền, điều chỉnh sai sót..."
                                    className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-semibold text-zinc-900 outline-none focus:border-indigo-500 transition"
                                />
                            </div>

                            <div className="pt-2 flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsBalanceModalOpen(false)}
                                    className="w-1/2 rounded-xl border border-zinc-200 bg-zinc-100 py-3 font-bold text-zinc-700 hover:bg-zinc-200 transition active:scale-95 cursor-pointer"
                                >
                                    HỦY
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingBalance}
                                    className={`w-1/2 rounded-xl py-3 font-black uppercase text-white transition active:scale-95 disabled:opacity-50 cursor-pointer ${balanceType === 'add' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}
                                >
                                    {submittingBalance ? 'ĐANG XỬ LÝ...' : (balanceType === 'add' ? 'XÁC NHẬN CỘNG' : 'XÁC NHẬN TRỪ')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* Modal 2: Gắn Tag & Ghi Chú Admin */}
            {isMetaModalOpen && selectedUser && mounted && createPortal(
                <div
                    className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
                    onClick={() => setIsMetaModalOpen(false)}
                >
                    <div
                        className="relative w-full max-w-md my-auto rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200 space-y-4 animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                            <div className="flex items-center gap-2">
                                <Tag className="h-5 w-5 text-indigo-600" />
                                <h3 className="text-sm font-black uppercase text-zinc-900">
                                    NHÃN & GHI CHÚ KHÁCH HÀNG
                                </h3>
                            </div>
                            <button
                                onClick={() => setIsMetaModalOpen(false)}
                                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 font-bold transition cursor-pointer"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleMetaSubmit} className="space-y-3.5 text-xs">
                            <div className="space-y-1">
                                <label className="font-extrabold uppercase text-zinc-700 text-[11px]">
                                    NHÃN KHÁCH HÀNG (TAG)
                                </label>
                                <input
                                    type="text"
                                    value={metaTag}
                                    onChange={(e) => setMetaTag(e.target.value)}
                                    placeholder="VD: Khách sỉ, VIP, CTV, Đại lý..."
                                    className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-semibold text-zinc-900 outline-none focus:border-indigo-500 transition"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="font-extrabold uppercase text-zinc-700 text-[11px]">
                                    GHI CHÚ ADMIN (NOTE NỘI BỘ)
                                </label>
                                <textarea
                                    rows={3}
                                    value={metaNote}
                                    onChange={(e) => setMetaNote(e.target.value)}
                                    placeholder="Nhập ghi chú đặc biệt cho khách hàng này..."
                                    className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-medium text-zinc-900 outline-none focus:border-indigo-500 transition"
                                />
                            </div>

                            <div className="pt-2 flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsMetaModalOpen(false)}
                                    className="w-1/2 rounded-xl border border-zinc-200 bg-zinc-100 py-3 font-bold text-zinc-700 hover:bg-zinc-200 transition active:scale-95 cursor-pointer"
                                >
                                    HỦY
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingMeta}
                                    className="w-1/2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white py-3 font-black uppercase transition active:scale-95 disabled:opacity-50 cursor-pointer"
                                >
                                    {submittingMeta ? 'ĐANG LƯU...' : 'LƯU THAY ĐỔI'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* Modal 3: Lịch Sử Mua Hàng */}
            {isOrdersModalOpen && selectedUser && mounted && createPortal(
                <div
                    className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
                    onClick={() => setIsOrdersModalOpen(false)}
                >
                    <div
                        className="relative w-full max-w-2xl my-auto rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200 space-y-4 max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                            <div className="flex items-center gap-2">
                                <ShoppingBag className="h-5 w-5 text-amber-600" />
                                <h3 className="text-sm font-black uppercase text-zinc-900">
                                    LỊCH SỬ ĐƠN HÀNG - @{selectedUser.username || selectedUser.id}
                                </h3>
                            </div>
                            <button
                                onClick={() => setIsOrdersModalOpen(false)}
                                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 font-bold transition cursor-pointer"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Filter Tabs: Tất cả vs Chỉ đơn API Key */}
                        <div className="flex items-center gap-2 border-b border-zinc-100 pb-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setOrdersFilter('all');
                                    fetchUserOrders(selectedUser.id, 'all');
                                }}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${ordersFilter === 'all' ? 'bg-amber-600 text-white shadow-sm' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
                            >
                                Tất Cả Đơn Hàng
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setOrdersFilter('api');
                                    fetchUserOrders(selectedUser.id, 'api');
                                }}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${ordersFilter === 'api' ? 'bg-purple-600 text-white shadow-sm' : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'}`}
                            >
                                <Key className="h-3 w-3" />
                                Đơn Mua Qua API Key
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {loadingOrders ? (
                                <div className="py-12 text-center text-xs text-zinc-400 font-medium">
                                    Đang tải lịch sử đơn hàng...
                                </div>
                            ) : userOrders.length === 0 ? (
                                <div className="py-12 text-center text-xs text-zinc-400 font-medium">
                                    {ordersFilter === 'api' ? 'Người dùng này chưa có đơn hàng nào mua qua API Key.' : 'Người dùng này chưa có đơn hàng nào.'}
                                </div>
                            ) : (
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="border-b border-zinc-100 bg-zinc-50 text-[11px] font-black uppercase text-zinc-500">
                                            <th className="p-3">MÃ ĐƠN</th>
                                            <th className="p-3">SẢN PHẨM</th>
                                            <th className="p-3 text-right">GIÁ TIỀN</th>
                                            <th className="p-3">TRẠNG THÁI</th>
                                            <th className="p-3">THỜI GIAN</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100">
                                        {userOrders.map(order => (
                                            <tr key={order.id} className="hover:bg-zinc-50">
                                                <td className="p-3 font-mono font-bold text-zinc-900">
                                                    #{order.id}
                                                    {order.invoice_code && <div className="text-[10px] text-zinc-400 font-normal">{order.invoice_code}</div>}
                                                </td>
                                                <td className="p-3">
                                                    <div className="font-bold text-zinc-800 flex items-center flex-wrap gap-1">
                                                        <span>{order.product_name}</span>
                                                        {Boolean(order.is_api_order) && (
                                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                                                <Key className="h-2.5 w-2.5" /> API Key
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-3 text-right font-black text-emerald-600">{formatCurrency(order.price)}</td>
                                                <td className="p-3">
                                                    <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${order.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                                        {order.status}
                                                    </span>
                                                </td>
                                                <td className="p-3 font-mono text-[10px] text-zinc-400">{formatDateStr(order.created_at)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Modal 4: API Key Created Popup */}
            {apiKeyModal && mounted && createPortal(
                <div
                    className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
                    onClick={() => setApiKeyModal(null)}
                >
                    <div
                        className="relative w-full max-w-md my-auto rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200 space-y-4 animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-2 text-emerald-600">
                            <CheckCircle2 className="h-6 w-6" />
                            <h3 className="text-sm font-black uppercase text-zinc-900">TẠO API KEY THÀNH CÔNG</h3>
                        </div>
                        <p className="text-xs text-zinc-500 font-medium">
                            API Key cho <span className="font-bold text-zinc-900">@{apiKeyModal.user.username || apiKeyModal.user.id}</span>:
                        </p>
                        <div className="flex items-center gap-2 rounded-xl bg-zinc-100 p-3 font-mono text-xs text-zinc-900 break-all select-all border border-zinc-200">
                            <span>{apiKeyModal.apiKey}</span>
                            <button
                                onClick={() => handleCopy(apiKeyModal.apiKey, 'modal_api_key')}
                                className="shrink-0 p-1 rounded-lg bg-white shadow-2xs hover:bg-zinc-50 cursor-pointer"
                            >
                                {copiedField === 'modal_api_key' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-zinc-600" />}
                            </button>
                        </div>
                        <button
                            onClick={() => setApiKeyModal(null)}
                            className="w-full rounded-xl bg-zinc-900 py-2.5 text-xs font-bold text-white uppercase hover:bg-zinc-800 transition cursor-pointer"
                        >
                            ĐÓNG
                        </button>
                    </div>
                </div>,
                document.body
            )}

            {/* Modal 5: CÀI ĐẶT GIÁ EMAIL EDU CHO USER */}
            {isEduPriceModalOpen && eduPriceUser && mounted && createPortal(
                <div
                    className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
                    onClick={() => !submittingEduPrice && setIsEduPriceModalOpen(false)}
                >
                    <div
                        className="relative w-full max-w-lg my-auto rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-zinc-200 space-y-6 animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between border-b border-zinc-100 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-black shadow-md shadow-purple-500/20">
                                    <GraduationCap className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black uppercase tracking-tight text-zinc-900">
                                        CÀI ĐẶT GIÁ EMAIL EDU
                                    </h3>
                                    <p className="text-xs text-zinc-500 font-medium">
                                        Khách hàng: <span className="font-bold text-zinc-900">@{eduPriceUser.username || eduPriceUser.name || eduPriceUser.id}</span>
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsEduPriceModalOpen(false)}
                                disabled={submittingEduPrice}
                                className="p-1.5 rounded-xl hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition cursor-pointer"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {loadingEduPrice ? (
                            <div className="py-12 text-center text-xs text-zinc-400 font-medium space-y-2">
                                <div className="animate-spin h-6 w-6 border-2 border-purple-600 border-t-transparent rounded-full mx-auto" />
                                <div>Đang tải thông tin giá của người dùng...</div>
                            </div>
                        ) : (
                            <div className="space-y-5">
                                {/* Price Status Overview */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200">
                                        <span className="text-[10px] font-black uppercase text-zinc-400">Giá Gốc Hệ Thống</span>
                                        <div className="text-sm font-black text-zinc-800 mt-1 font-mono">
                                            {formatCurrency(eduDefaultPrice)}
                                        </div>
                                    </div>
                                    <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200/80">
                                        <span className="text-[10px] font-black uppercase text-purple-700">Giá Riêng Hiện Tại</span>
                                        <div className="text-sm font-black text-purple-900 mt-1 font-mono">
                                            {currentEduCustomPrice ? (
                                                <span className="flex items-center gap-1.5">
                                                    {formatCurrency(currentEduCustomPrice.custom_price)}
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${currentEduCustomPrice.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-200 text-zinc-600'}`}>
                                                        {currentEduCustomPrice.is_active ? 'BẬT' : 'TẮT'}
                                                    </span>
                                                </span>
                                            ) : (
                                                <span className="text-xs text-zinc-400 font-medium">Theo giá gốc hệ thống</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Custom Price Input */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-zinc-700">
                                        Đơn Giá Riêng Cho Khách Hàng Này (VNĐ):
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={newEduPrice}
                                            onChange={(e) => setNewEduPrice(e.target.value)}
                                            placeholder={`Ví dụ: 8000 (Mặc định: ${eduDefaultPrice})`}
                                            min="0"
                                            step="500"
                                            className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-bold font-mono focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition"
                                        />
                                        <span className="absolute right-3.5 top-2.5 text-xs font-bold text-zinc-400">VNĐ/Email</span>
                                    </div>
                                    {/* Quick Preset Buttons */}
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                        {[5000, 7000, 8000, 9000, 10000, 12000].map(amt => (
                                            <button
                                                key={amt}
                                                type="button"
                                                onClick={() => setNewEduPrice(String(amt))}
                                                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition cursor-pointer ${
                                                    newEduPrice === String(amt)
                                                        ? 'bg-purple-600 text-white'
                                                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                                                }`}
                                            >
                                                {amt.toLocaleString('vi-VN')} đ
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Scope selector */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-zinc-700">Phạm Vi Áp Dụng:</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setEduPriceScope('ALL_ORDERS')}
                                            className={`p-2.5 rounded-xl text-xs font-bold border transition text-left cursor-pointer ${
                                                eduPriceScope === 'ALL_ORDERS'
                                                    ? 'border-purple-600 bg-purple-50 text-purple-900 ring-1 ring-purple-600'
                                                    : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
                                            }`}
                                        >
                                            <div className="font-extrabold">Tất Cả Đơn Hàng</div>
                                            <div className="text-[10px] text-zinc-500 font-normal mt-0.5">Áp dụng cả trên Bot Telegram, Web & API</div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEduPriceScope('CLIENT_API')}
                                            className={`p-2.5 rounded-xl text-xs font-bold border transition text-left cursor-pointer ${
                                                eduPriceScope === 'CLIENT_API'
                                                    ? 'border-purple-600 bg-purple-50 text-purple-900 ring-1 ring-purple-600'
                                                    : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
                                            }`}
                                        >
                                            <div className="font-extrabold">Chỉ Qua API Key</div>
                                            <div className="text-[10px] text-zinc-500 font-normal mt-0.5">Chỉ áp dụng khi gọi qua API Key / Client API</div>
                                        </button>
                                    </div>
                                </div>

                                {/* Active Toggle */}
                                <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 border border-zinc-200">
                                    <div>
                                        <div className="text-xs font-bold text-zinc-900">Kích hoạt giá riêng</div>
                                        <div className="text-[10px] text-zinc-500">Nếu tắt, khách hàng sẽ dùng giá mặc định hệ thống</div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setEduPriceIsActive(!eduPriceIsActive)}
                                        className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition ${eduPriceIsActive ? 'bg-purple-600 justify-end' : 'bg-zinc-300 justify-start'}`}
                                    >
                                        <div className="bg-white w-4 h-4 rounded-full shadow-md transform transition" />
                                    </button>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
                                    {currentEduCustomPrice && (
                                        <button
                                            type="button"
                                            onClick={handleDeleteEduPrice}
                                            disabled={submittingEduPrice}
                                            className="px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                                        >
                                            <Trash2 className="h-4 w-4" /> Xóa Giá Riêng
                                        </button>
                                    )}
                                    <div className="flex-1 flex items-center justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsEduPriceModalOpen(false)}
                                            disabled={submittingEduPrice}
                                            className="px-4 py-2.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-bold transition cursor-pointer"
                                        >
                                            Hủy
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSaveEduPrice}
                                            disabled={submittingEduPrice || !newEduPrice}
                                            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black uppercase transition cursor-pointer shadow-md shadow-purple-600/20 disabled:opacity-50 flex items-center gap-1.5"
                                        >
                                            {submittingEduPrice ? 'Đang lưu...' : 'Lưu Giá Riêng'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
