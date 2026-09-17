'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    Wallet, CreditCard, ShieldCheck, RefreshCw, Search, Copy, Check,
    PlusCircle, MinusCircle, Ban, History, Tag, Key, CheckCircle2,
    Clock, DollarSign, ArrowDownCircle, ArrowUpCircle, ExternalLink, Sparkles,
    Trash2, Edit, Edit2, Power, X, Plus, AlertCircle
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface UserWallet {
    id: number;
    telegram_id?: number | null;
    username?: string | null;
    name?: string | null;
    balance: number;
    total_deposited?: number;
    rank_name?: string;
    customer_tag?: string | null;
    is_banned?: number | boolean;
    created_at: string;
}

interface BalanceLog {
    id: number;
    user_id: number;
    username?: string | null;
    telegram_id?: number | null;
    amount: number;
    reason?: string | null;
    current_balance?: number;
    created_at: string;
}

interface CustomPriceItem {
    id: number;
    user_id: number;
    product_id: number;
    product_name?: string;
    original_price?: number;
    plan_id?: string | null;
    custom_price: number;
    scope: string;
    is_active: number | boolean;
    created_at: string;
}

interface ProductOption {
    id: number;
    name: string;
    price: number;
}

export default function WalletsManagementPage() {
    const { t } = useLanguage();
    const [mounted, setMounted] = useState(false);
    const [activeTab, setActiveTab] = useState<'wallets' | 'logs'>('wallets');
    const [wallets, setWallets] = useState<UserWallet[]>([]);
    const [balanceLogs, setBalanceLogs] = useState<BalanceLog[]>([]);
    const [products, setProducts] = useState<ProductOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalUsers, setTotalUsers] = useState(0);
    const [totalWalletBalance, setTotalWalletBalance] = useState(0);
    const [todayRegisteredUsers, setTodayRegisteredUsers] = useState(0);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [balanceFilter, setBalanceFilter] = useState<'all' | 'has_balance' | 'zero_balance'>('all');
    const [copiedField, setCopiedField] = useState<string | null>(null);

    // Modals
    const [selectedUser, setSelectedUser] = useState<UserWallet | null>(null);
    const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
    const [balanceType, setBalanceType] = useState<'add' | 'subtract'>('add');
    const [balanceAmount, setBalanceAmount] = useState('');
    const [balanceReason, setBalanceReason] = useState('');
    const [submittingBalance, setSubmittingBalance] = useState(false);

    // Custom Pricing Modal (Full CRUD)
    const [isCustomPriceModalOpen, setIsCustomPriceModalOpen] = useState(false);
    const [customPricingList, setCustomPricingList] = useState<CustomPriceItem[]>([]);
    const [cpProductId, setCpProductId] = useState('');
    const [cpPrice, setCpPrice] = useState('');
    const [cpScope, setCpScope] = useState<'ALL_ORDERS' | 'FIRST_ORDER' | 'CLIENT_API'>('ALL_ORDERS');
    const [editingCpId, setEditingCpId] = useState<number | null>(null);
    const [submittingCp, setSubmittingCp] = useState(false);

    // Single User Log Modal
    const [isUserLogsModalOpen, setIsUserLogsModalOpen] = useState(false);
    const [userSpecificLogs, setUserSpecificLogs] = useState<BalanceLog[]>([]);
    const [loadingUserLogs, setLoadingUserLogs] = useState(false);

    // API Key Modal
    const [apiKeyModal, setApiKeyModal] = useState<{ user: UserWallet; apiKey: string } | null>(null);

    const fetchWallets = () => {
        setLoading(true);
        const params = new URLSearchParams({
            page: String(page),
            limit: '15',
            search: searchTerm
        });

        fetch(`/api/users?${params.toString()}`)
            .then((res) => res.json())
            .then((data) => {
                let list: UserWallet[] = Array.isArray(data.data) ? data.data : [];
                if (balanceFilter === 'has_balance') list = list.filter(u => Number(u.balance) > 0);
                if (balanceFilter === 'zero_balance') list = list.filter(u => Number(u.balance) <= 0);

                setWallets(list);
                setTotalPages(data.pagination?.totalPages || 1);
                setTotalUsers(data.pagination?.total || 0);
                if (data.stats) {
                    if (typeof data.stats.totalWalletBalance === 'number') setTotalWalletBalance(data.stats.totalWalletBalance);
                    if (typeof data.stats.todayRegisteredUsers === 'number') setTodayRegisteredUsers(data.stats.todayRegisteredUsers);
                }
                setLoading(false);
            })
            .catch(() => {
                setWallets([]);
                setLoading(false);
            });
    };

    const fetchLogs = () => {
        setLoading(true);
        fetch('/api/balance-logs?limit=50')
            .then((res) => res.json())
            .then((data) => {
                setBalanceLogs(Array.isArray(data.data) ? data.data : []);
                setLoading(false);
            })
            .catch(() => {
                setBalanceLogs([]);
                setLoading(false);
            });
    };

    const fetchProducts = () => {
        fetch('/api/products')
            .then((res) => res.json())
            .then((data) => {
                const list = Array.isArray(data) ? data : data.data || [];
                setProducts(list.map((p: any) => ({ id: p.id, name: p.name, price: Number(p.price) || 0 })));
            })
            .catch(() => {});
    };

    useEffect(() => {
        setMounted(true);
        fetchProducts();
    }, []);

    useEffect(() => {
        if (activeTab === 'wallets') {
            fetchWallets();
        } else {
            fetchLogs();
        }
    }, [activeTab, page, balanceFilter]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        fetchWallets();
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

    // Open Balance Modal
    const openBalanceModal = (user: UserWallet, type: 'add' | 'subtract') => {
        setSelectedUser(user);
        setBalanceType(type);
        setBalanceAmount('');
        setBalanceReason(type === 'add' ? 'Admin nạp tiền ví thủ công' : 'Admin trừ tiền điều chỉnh');
        setIsBalanceModalOpen(true);
    };

    // Submit Balance
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
                alert(`✅ Đã ${balanceType === 'add' ? 'nạp' : 'trừ'} ${formatCurrency(Number(balanceAmount))} thành công!`);
                setIsBalanceModalOpen(false);
                if (activeTab === 'wallets') fetchWallets(); else fetchLogs();
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

    // Fetch Custom Prices for a user
    const fetchUserCustomPrices = (userId: number) => {
        fetch(`/api/custom-pricing?userId=${userId}`)
            .then(res => res.json())
            .then(data => setCustomPricingList(Array.isArray(data.data) ? data.data : []))
            .catch(() => setCustomPricingList([]));
    };

    // Open Custom Price Modal
    const openCustomPriceModal = (user: UserWallet) => {
        setSelectedUser(user);
        setIsCustomPriceModalOpen(true);
        setEditingCpId(null);
        setCpProductId('');
        setCpPrice('');
        setCpScope('ALL_ORDERS');
        fetchUserCustomPrices(user.id);
    };

    // Start Editing a Custom Price
    const handleStartEditCustomPrice = (cp: CustomPriceItem) => {
        setEditingCpId(cp.id);
        setCpProductId(String(cp.product_id));
        setCpPrice(String(cp.custom_price));
        setCpScope((cp.scope as any) || 'ALL_ORDERS');
    };

    // Cancel Editing
    const handleCancelEditCustomPrice = () => {
        setEditingCpId(null);
        setCpProductId('');
        setCpPrice('');
        setCpScope('ALL_ORDERS');
    };

    // Create or Update Custom Price
    const handleSaveCustomPrice = async () => {
        if (!selectedUser || !cpProductId || !cpPrice) {
            alert('Vui lòng chọn sản phẩm và nhập giá riêng!');
            return;
        }

        setSubmittingCp(true);
        try {
            if (editingCpId) {
                // Update
                const res = await fetch('/api/custom-pricing', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: editingCpId,
                        action: 'update',
                        customPrice: Number(cpPrice),
                        scope: cpScope
                    })
                });

                if (res.ok) {
                    alert('✅ Đã cập nhật giá riêng thành công!');
                    handleCancelEditCustomPrice();
                    fetchUserCustomPrices(selectedUser.id);
                } else {
                    const data = await res.json();
                    alert(data.error || 'Lỗi cập nhật giá riêng');
                }
            } else {
                // Create
                const res = await fetch('/api/custom-pricing', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: selectedUser.id,
                        productId: Number(cpProductId),
                        customPrice: Number(cpPrice),
                        scope: cpScope,
                        isActive: true
                    })
                });

                if (res.ok) {
                    alert('✅ Đã lưu giá riêng thành công!');
                    setCpProductId('');
                    setCpPrice('');
                    setCpScope('ALL_ORDERS');
                    fetchUserCustomPrices(selectedUser.id);
                } else {
                    const data = await res.json();
                    alert(data.error || 'Lỗi thiết lập giá riêng');
                }
            }
        } catch (e) {
            alert('Lỗi kết nối server');
        } finally {
            setSubmittingCp(false);
        }
    };

    // Toggle Active Status of a Custom Price
    const handleToggleActiveCustomPrice = async (id: number) => {
        try {
            // Optimistic update
            setCustomPricingList(prev => prev.map(item => item.id === id ? { ...item, is_active: !item.is_active } : item));

            const res = await fetch('/api/custom-pricing', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, action: 'toggle_active' })
            });

            if (!res.ok && selectedUser) {
                fetchUserCustomPrices(selectedUser.id);
            }
        } catch (e) {
            if (selectedUser) fetchUserCustomPrices(selectedUser.id);
        }
    };

    // Delete Custom Price
    const handleDeleteCustomPrice = async (id: number, productName?: string) => {
        if (!window.confirm(`Xác nhận XÓA giá riêng cho sản phẩm "${productName || 'này'}"?`)) {
            return;
        }

        try {
            const res = await fetch(`/api/custom-pricing?id=${id}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                if (editingCpId === id) {
                    handleCancelEditCustomPrice();
                }
                if (selectedUser) {
                    fetchUserCustomPrices(selectedUser.id);
                }
            } else {
                alert('Lỗi khi xóa giá riêng');
            }
        } catch (e) {
            alert('Lỗi kết nối server');
        }
    };

    // Open User Specific Logs
    const openUserLogs = (user: UserWallet) => {
        setSelectedUser(user);
        setIsUserLogsModalOpen(true);
        setLoadingUserLogs(true);
        fetch(`/api/balance-logs?userId=${user.id}&limit=30`)
            .then(res => res.json())
            .then(data => {
                setUserSpecificLogs(Array.isArray(data.data) ? data.data : []);
                setLoadingUserLogs(false);
            })
            .catch(() => {
                setUserSpecificLogs([]);
                setLoadingUserLogs(false);
            });
    };

    // Generate API Key
    const handleGenerateApiKey = async (user: UserWallet) => {
        try {
            const res = await fetch('/api/user-api-keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    name: `Ví Key - ${user.username || user.telegram_id || user.id}`
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

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12 text-zinc-900">
            {/* 1. Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 font-bold border border-amber-200/80 shadow-2xs">
                        <Wallet className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-zinc-950 flex items-center gap-2">
                            QUẢN LÝ VÍ & SỐ DƯ THÀNH VIÊN
                        </h1>
                        <p className="text-xs text-zinc-500 font-medium">
                            Kiểm soát tổng số dư, nạp / trừ tiền, cấu hình giá riêng và theo dõi biến động số dư
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5">
                    <button
                        onClick={() => activeTab === 'wallets' ? fetchWallets() : fetchLogs()}
                        className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs font-bold text-zinc-700 shadow-2xs hover:bg-zinc-50 active:scale-95 transition"
                    >
                        <RefreshCw className={`h-4 w-4 text-zinc-500 ${loading ? 'animate-spin' : ''}`} />
                        <span>LÀM MỚI</span>
                    </button>
                </div>
            </div>

            {/* 2. 4 Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-white p-5 shadow-2xs">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-amber-800">TỔNG SỐ DƯ VÍ TOÀN HỆ THỐNG</span>
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm shadow-amber-500/30">
                            <Wallet className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="mt-3 text-2xl font-black text-zinc-950">
                        {formatCurrency(totalWalletBalance)}
                    </div>
                    <p className="mt-1 text-[11px] font-medium text-zinc-500">Số dư khả dụng hiện có</p>
                </div>

                <div className="rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-white p-5 shadow-2xs">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-indigo-800">TỔNG SỐ VÍ THÀNH VIÊN</span>
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-500/30">
                            <CreditCard className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="mt-3 text-2xl font-black text-zinc-950">
                        {totalUsers.toLocaleString('vi-VN')}
                    </div>
                    <p className="mt-1 text-[11px] font-medium text-zinc-500">Tài khoản ví hệ thống</p>
                </div>

                <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-white p-5 shadow-2xs">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800">ĐĂNG KÝ HÔM NAY</span>
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-500/30">
                            <Sparkles className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="mt-3 text-2xl font-black text-emerald-600">
                        +{todayRegisteredUsers.toLocaleString('vi-VN')}
                    </div>
                    <p className="mt-1 text-[11px] font-medium text-zinc-500">Thành viên mới trong ngày</p>
                </div>

                <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-2xs">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">TRẠNG THÁI VÍ</span>
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                            <ShieldCheck className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="mt-3 text-2xl font-black text-emerald-600 flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>HOẠT ĐỘNG</span>
                    </div>
                    <p className="mt-1 text-[11px] font-medium text-zinc-500">Hệ thống ví realtime</p>
                </div>
            </div>

            {/* 3. Main Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-zinc-200">
                <button
                    onClick={() => { setActiveTab('wallets'); setPage(1); }}
                    className={`flex items-center gap-2 pb-3 px-4 text-xs font-black uppercase border-b-2 transition ${activeTab === 'wallets' ? 'border-amber-600 text-amber-600' : 'border-transparent text-zinc-400 hover:text-zinc-700'}`}
                >
                    <Wallet className="h-4 w-4" />
                    <span>DANH SÁCH VÍ THÀNH VIÊN ({totalUsers})</span>
                </button>
                <button
                    onClick={() => { setActiveTab('logs'); }}
                    className={`flex items-center gap-2 pb-3 px-4 text-xs font-black uppercase border-b-2 transition ${activeTab === 'logs' ? 'border-amber-600 text-amber-600' : 'border-transparent text-zinc-400 hover:text-zinc-700'}`}
                >
                    <History className="h-4 w-4" />
                    <span>BIẾN ĐỘNG SỐ DƯ (BALANCE LOGS)</span>
                </button>
            </div>

            {/* Tab 1: Wallets List */}
            {activeTab === 'wallets' && (
                <div className="space-y-4">
                    {/* Search & Filter Bar */}
                    <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-2xs">
                        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                            <div className="sm:col-span-8 relative">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Tìm kiếm ví theo Username, Telegram ID, Tên khách..."
                                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 pl-10 pr-4 py-2.5 text-xs font-semibold text-zinc-800 outline-none focus:border-amber-500 focus:bg-white transition"
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <select
                                    value={balanceFilter}
                                    onChange={(e: any) => setBalanceFilter(e.target.value)}
                                    className="w-full h-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-xs font-bold text-zinc-700 outline-none focus:border-amber-500 transition cursor-pointer"
                                >
                                    <option value="all">Tất cả số dư</option>
                                    <option value="has_balance">Có số dư (&gt; 0đ)</option>
                                    <option value="zero_balance">Ví 0đ</option>
                                </select>
                            </div>

                            <div className="sm:col-span-2">
                                <button
                                    type="submit"
                                    className="w-full h-full rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black uppercase transition active:scale-95 py-2.5 shadow-2xs cursor-pointer"
                                >
                                    TÌM KIẾM
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Wallets Table */}
                    <div className="rounded-2xl border border-zinc-200 bg-white shadow-2xs overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-zinc-100 bg-zinc-50/80 text-[11px] font-black uppercase tracking-wider text-zinc-500">
                                        <th className="px-4 py-3.5">CHỦ VÍ / TELEGRAM</th>
                                        <th className="px-4 py-3.5 text-right">SỐ DƯ VÍ</th>
                                        <th className="px-4 py-3.5 text-right">TỔNG NẠP</th>
                                        <th className="px-4 py-3.5">CẤP BẬC</th>
                                        <th className="px-4 py-3.5">NGÀY TẠO VÍ</th>
                                        <th className="px-4 py-3.5 text-right">THAO TÁC VÍ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} className="py-12 text-center text-xs font-medium text-zinc-400">
                                                Đang tải danh sách ví...
                                            </td>
                                        </tr>
                                    ) : wallets.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="py-12 text-center text-xs font-medium text-zinc-400">
                                                Không tìm thấy ví nào.
                                            </td>
                                        </tr>
                                    ) : (
                                        wallets.map((w) => (
                                            <tr key={w.id} className="hover:bg-zinc-50/80 transition-colors">
                                                <td className="px-4 py-3.5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 font-bold text-amber-700 text-xs border border-amber-200/60">
                                                            {(w.username || w.name || 'W').slice(0, 1).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="font-extrabold text-zinc-900 text-xs flex items-center gap-1.5">
                                                                {w.username ? `@${w.username}` : (w.name || `User #${w.id}`)}
                                                                {w.username && (
                                                                    <a
                                                                        href={`https://t.me/${w.username}`}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        className="text-zinc-400 hover:text-amber-600 transition"
                                                                    >
                                                                        <ExternalLink className="h-3 w-3" />
                                                                    </a>
                                                                )}
                                                            </div>
                                                            <div className="text-[10px] font-mono text-zinc-400 flex items-center gap-1">
                                                                <span>ID: {w.telegram_id || w.id}</span>
                                                                <button
                                                                    onClick={() => handleCopy(String(w.telegram_id || w.id), `w_tg_${w.id}`)}
                                                                    className="hover:text-zinc-600"
                                                                >
                                                                    {copiedField === `w_tg_${w.id}` ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="px-4 py-3.5 text-right font-black text-sm text-emerald-600">
                                                    {formatCurrency(w.balance)}
                                                </td>

                                                <td className="px-4 py-3.5 text-right font-bold text-xs text-zinc-700">
                                                    {formatCurrency(w.total_deposited || 0)}
                                                </td>

                                                <td className="px-4 py-3.5">
                                                    <span className="inline-block rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                                        {w.rank_name || 'Thường'}
                                                    </span>
                                                </td>

                                                <td className="px-4 py-3.5 text-[10px] font-mono text-zinc-500">
                                                    {formatDateStr(w.created_at)}
                                                </td>

                                                <td className="px-4 py-3.5 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            onClick={() => openBalanceModal(w, 'add')}
                                                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black transition active:scale-95 shadow-2xs"
                                                            title="Nạp tiền vào ví"
                                                        >
                                                            <PlusCircle className="h-3.5 w-3.5" />
                                                            <span>NẠP</span>
                                                        </button>

                                                        <button
                                                            onClick={() => openBalanceModal(w, 'subtract')}
                                                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-[11px] font-bold transition active:scale-95"
                                                            title="Trừ tiền ví"
                                                        >
                                                            <MinusCircle className="h-3.5 w-3.5" />
                                                            <span>TRỪ</span>
                                                        </button>

                                                        <button
                                                            onClick={() => openCustomPriceModal(w)}
                                                            className="p-1.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition"
                                                            title="Cấu hình giá riêng"
                                                        >
                                                            <Tag className="h-4 w-4" />
                                                        </button>

                                                        <button
                                                            onClick={() => openUserLogs(w)}
                                                            className="p-1.5 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 transition"
                                                            title="Lịch sử số dư ví"
                                                        >
                                                            <History className="h-4 w-4" />
                                                        </button>

                                                        <button
                                                            onClick={() => handleGenerateApiKey(w)}
                                                            className="p-1.5 rounded-xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition"
                                                            title="Cấp API Key"
                                                        >
                                                            <Key className="h-4 w-4" />
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
                                Trang <span className="font-bold text-zinc-900">{page}</span> / {totalPages} ({totalUsers} ví)
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
                </div>
            )}

            {/* Tab 2: Balance Logs */}
            {activeTab === 'logs' && (
                <div className="rounded-2xl border border-zinc-200 bg-white shadow-2xs overflow-hidden">
                    <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <History className="h-4 w-4 text-amber-600" />
                            <h3 className="text-xs font-black uppercase text-zinc-900">
                                50 BIẾN ĐỘNG SỐ DƯ GẦN NHẤT TOÀN HỆ THỐNG
                            </h3>
                        </div>
                        <span className="text-[11px] text-zinc-400 font-medium">Tự động ghi nhận theo thời gian thực</span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-zinc-100 bg-zinc-50/80 text-[11px] font-black uppercase tracking-wider text-zinc-500">
                                    <th className="px-4 py-3.5">MÃ GD</th>
                                    <th className="px-4 py-3.5">KHÁCH HÀNG</th>
                                    <th className="px-4 py-3.5 text-right">BIẾN ĐỘNG</th>
                                    <th className="px-4 py-3.5 text-right">SỐ DƯ HIỆN TẠI</th>
                                    <th className="px-4 py-3.5">LÝ DO & GHI CHÚ</th>
                                    <th className="px-4 py-3.5">THỜI GIAN</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center text-xs font-medium text-zinc-400">
                                            Đang tải lịch sử biến động số dư...
                                        </td>
                                    </tr>
                                ) : balanceLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center text-xs font-medium text-zinc-400">
                                            Chưa có lịch sử biến động số dư nào.
                                        </td>
                                    </tr>
                                ) : (
                                    balanceLogs.map((log) => (
                                        <tr key={log.id} className="hover:bg-zinc-50/80 transition-colors">
                                            <td className="px-4 py-3.5 font-mono font-bold text-zinc-900">
                                                #{log.id}
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <div className="font-extrabold text-zinc-900 text-xs">
                                                    @{log.username || `User #${log.user_id}`}
                                                </div>
                                                <div className="text-[10px] font-mono text-zinc-400">
                                                    ID: {log.telegram_id || log.user_id}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5 text-right font-black text-sm">
                                                {Number(log.amount) >= 0 ? (
                                                    <span className="text-emerald-600">+{formatCurrency(log.amount)}</span>
                                                ) : (
                                                    <span className="text-rose-600">{formatCurrency(log.amount)}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3.5 text-right font-bold text-xs text-zinc-700">
                                                {typeof log.current_balance === 'number' ? formatCurrency(log.current_balance) : '-'}
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <span className="inline-block rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-800">
                                                    {log.reason || 'Biến động số dư'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5 text-[10px] font-mono text-zinc-500 whitespace-nowrap">
                                                {formatDateStr(log.created_at)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal 1: Nạp / Trừ Số Dư */}
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
                                    {balanceType === 'add' ? 'NẠP TIỀN VÍ THÀNH VIÊN' : 'TRỪ TIỀN VÍ THÀNH VIÊN'}
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
                            <div className="text-zinc-500 font-medium">Chủ ví: <span className="font-extrabold text-zinc-900">@{selectedUser.username || selectedUser.id}</span></div>
                            <div className="text-zinc-500 font-medium mt-1">Số dư khả dụng: <span className="font-extrabold text-emerald-600">{formatCurrency(selectedUser.balance)}</span></div>
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
                                    placeholder="VD: 100000"
                                    className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-black text-sm text-zinc-900 outline-none focus:border-amber-500 transition"
                                    required
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="font-extrabold uppercase text-zinc-700 text-[11px]">
                                    LÝ DO THỰC HIỆN
                                </label>
                                <input
                                    type="text"
                                    value={balanceReason}
                                    onChange={(e) => setBalanceReason(e.target.value)}
                                    placeholder="VD: Nạp qua Momo, khuyến mãi lễ, điều chỉnh lỗi..."
                                    className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-semibold text-zinc-900 outline-none focus:border-amber-500 transition"
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
                                    {submittingBalance ? 'ĐANG XỬ LÝ...' : (balanceType === 'add' ? 'XÁC NHẬN NẠP' : 'XÁC NHẬN TRỪ')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* Modal 2: Cấu hình giá riêng (Custom Pricing - Full CRUD) */}
            {isCustomPriceModalOpen && selectedUser && mounted && createPortal(
                <div
                    className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
                    onClick={() => setIsCustomPriceModalOpen(false)}
                >
                    <div
                        className="relative w-full max-w-2xl my-auto rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-zinc-200 space-y-4 max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                                    <Tag className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-tight text-zinc-900 flex items-center gap-2">
                                        CẤU HÌNH GIÁ RIÊNG - @{selectedUser.username || selectedUser.id}
                                    </h3>
                                    <p className="text-[11px] text-zinc-500 font-medium">
                                        Thiết lập mức giá ưu đãi đặc biệt cho từng sản phẩm của khách hàng
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsCustomPriceModalOpen(false)}
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition cursor-pointer"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Add / Edit form */}
                        <div className={`rounded-2xl p-4 space-y-3 text-xs border transition-colors ${editingCpId ? 'bg-amber-50/70 border-amber-200' : 'bg-zinc-50 border-zinc-200/80'}`}>
                            <div className="flex items-center justify-between">
                                <span className="font-extrabold uppercase text-zinc-700 text-[11px] flex items-center gap-1.5">
                                    {editingCpId ? (
                                        <>
                                            <Edit2 className="h-3.5 w-3.5 text-amber-600" />
                                            <span className="text-amber-700">CHỈNH SỬA GIÁ RIÊNG (#ID: {editingCpId})</span>
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="h-3.5 w-3.5 text-indigo-600" />
                                            <span>THÊM GIÁ RIÊNG THEO SẢN PHẨM:</span>
                                        </>
                                    )}
                                </span>
                                {editingCpId && (
                                    <button
                                        type="button"
                                        onClick={handleCancelEditCustomPrice}
                                        className="text-[11px] font-bold text-zinc-500 hover:text-zinc-800 uppercase flex items-center gap-1 cursor-pointer"
                                    >
                                        <X className="h-3.5 w-3.5" /> Hủy sửa
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                                <div className="sm:col-span-5">
                                    <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Sản phẩm</label>
                                    <select
                                        value={cpProductId}
                                        onChange={(e) => {
                                            setCpProductId(e.target.value);
                                            const p = products.find(prod => String(prod.id) === e.target.value);
                                            if (p && !cpPrice) {
                                                setCpPrice(String(Math.round(p.price * 0.9)));
                                            }
                                        }}
                                        disabled={!!editingCpId}
                                        className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 font-bold text-zinc-800 outline-none text-xs disabled:bg-zinc-100 disabled:text-zinc-500"
                                    >
                                        <option value="">-- Chọn sản phẩm --</option>
                                        {products.map(p => (
                                            <option key={p.id} value={p.id}>{p.name} (Gốc: {formatCurrency(p.price)})</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="sm:col-span-4">
                                    <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Giá bán riêng (VNĐ)</label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={cpPrice}
                                        onChange={(e) => setCpPrice(e.target.value)}
                                        placeholder="VD: 50000"
                                        className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 font-bold text-zinc-900 outline-none text-xs focus:border-indigo-500"
                                    />
                                </div>

                                <div className="sm:col-span-3">
                                    <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1">Phạm vi áp dụng</label>
                                    <select
                                        value={cpScope}
                                        onChange={(e) => setCpScope(e.target.value as any)}
                                        className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 font-semibold text-zinc-800 outline-none text-xs"
                                    >
                                        <option value="ALL_ORDERS">Mọi đơn hàng</option>
                                        <option value="FIRST_ORDER">Chỉ đơn đầu</option>
                                        <option value="CLIENT_API">Mua qua API Key</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <button
                                    onClick={handleSaveCustomPrice}
                                    disabled={submittingCp}
                                    className={`flex-1 rounded-xl py-2.5 font-black uppercase text-xs transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-xs ${
                                        editingCpId
                                            ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                    }`}
                                >
                                    {submittingCp ? (
                                        <span>ĐANG LƯU...</span>
                                    ) : editingCpId ? (
                                        <>
                                            <Check className="h-4 w-4" />
                                            <span>CẬP NHẬT GIÁ RIÊNG</span>
                                        </>
                                    ) : (
                                        <>
                                            <Tag className="h-4 w-4" />
                                            <span>LƯU GIÁ RIÊNG MỚI</span>
                                        </>
                                    )}
                                </button>
                                {editingCpId && (
                                    <button
                                        type="button"
                                        onClick={handleCancelEditCustomPrice}
                                        className="px-4 py-2.5 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-100 font-bold text-xs text-zinc-700 transition"
                                    >
                                        HỦY
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* List Table with Full CRUD */}
                        <div className="flex-1 overflow-y-auto border border-zinc-200 rounded-2xl">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-zinc-200 bg-zinc-50/80 text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                                        <th className="p-3">SẢN PHẨM</th>
                                        <th className="p-3 text-right">GIÁ GỐC</th>
                                        <th className="p-3 text-right">GIÁ RIÊNG</th>
                                        <th className="p-3 text-center">PHẠM VI</th>
                                        <th className="p-3 text-center">TRẠNG THÁI</th>
                                        <th className="p-3 text-center">THAO TÁC</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100">
                                    {customPricingList.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="py-8 text-center text-zinc-400 font-medium">
                                                Khách hàng này chưa có cấu hình giá riêng nào.
                                            </td>
                                        </tr>
                                    ) : (
                                        customPricingList.map(cp => {
                                            const origPrice = Number(cp.original_price) || 0;
                                            const customPrice = Number(cp.custom_price) || 0;
                                            const diffPct = origPrice > 0 ? Math.round(((origPrice - customPrice) / origPrice) * 100) : 0;
                                            const isActive = Boolean(cp.is_active);
                                            const isCurrentlyEditing = editingCpId === cp.id;

                                            return (
                                                <tr key={cp.id} className={`transition-colors ${isCurrentlyEditing ? 'bg-amber-50/60' : 'hover:bg-zinc-50/70'}`}>
                                                    <td className="p-3">
                                                        <div className="font-extrabold text-zinc-900 text-xs">
                                                            {cp.product_name || `Sản phẩm #${cp.product_id}`}
                                                        </div>
                                                        <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                                                            ID: #{cp.id} • SP #{cp.product_id}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-right font-medium text-zinc-500">
                                                        {origPrice > 0 ? formatCurrency(origPrice) : '-'}
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <div className="font-black text-emerald-600 text-xs">
                                                            {formatCurrency(customPrice)}
                                                        </div>
                                                        {diffPct !== 0 && (
                                                            <span className={`text-[10px] font-bold ${diffPct > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                                {diffPct > 0 ? `-${diffPct}%` : `+${Math.abs(diffPct)}%`}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <span className="inline-flex rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-700">
                                                            {cp.scope === 'FIRST_ORDER' ? 'Đơn đầu' : cp.scope === 'CLIENT_API' ? 'API Key' : 'Mọi đơn'}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleActiveCustomPrice(cp.id)}
                                                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase transition border cursor-pointer ${
                                                                isActive
                                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                                                    : 'bg-zinc-100 text-zinc-400 border-zinc-200 hover:bg-zinc-200'
                                                            }`}
                                                            title={isActive ? 'Bấm để tắt giá riêng' : 'Bấm để bật lại giá riêng'}
                                                        >
                                                            <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`} />
                                                            <span>{isActive ? 'BẬT' : 'TẮT'}</span>
                                                        </button>
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleStartEditCustomPrice(cp)}
                                                                className={`p-1.5 rounded-lg border transition ${
                                                                    isCurrentlyEditing
                                                                        ? 'bg-amber-600 text-white border-amber-600'
                                                                        : 'bg-white text-zinc-600 border-zinc-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300'
                                                                }`}
                                                                title="Sửa giá riêng này"
                                                            >
                                                                <Edit2 className="h-3.5 w-3.5" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteCustomPrice(cp.id, cp.product_name)}
                                                                className="p-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition"
                                                                title="Xóa vĩnh viễn giá riêng"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
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
                </div>,
                document.body
            )}

            {/* Modal 3: Lịch sử biến động của 1 ví */}
            {isUserLogsModalOpen && selectedUser && mounted && createPortal(
                <div
                    className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
                    onClick={() => setIsUserLogsModalOpen(false)}
                >
                    <div
                        className="relative w-full max-w-xl my-auto rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200 space-y-4 max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                            <div className="flex items-center gap-2">
                                <History className="h-5 w-5 text-amber-600" />
                                <h3 className="text-sm font-black uppercase text-zinc-900">
                                    BIẾN ĐỘNG SỐ DƯ - @{selectedUser.username || selectedUser.id}
                                </h3>
                            </div>
                            <button
                                onClick={() => setIsUserLogsModalOpen(false)}
                                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 font-bold transition cursor-pointer"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {loadingUserLogs ? (
                                <div className="py-8 text-center text-zinc-400 text-xs">Đang tải lịch sử...</div>
                            ) : userSpecificLogs.length === 0 ? (
                                <div className="py-8 text-center text-zinc-400 text-xs">Chưa có biến động số dư nào.</div>
                            ) : (
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="border-b border-zinc-100 bg-zinc-50 text-[11px] font-black uppercase text-zinc-500">
                                            <th className="p-2.5">SỐ TIỀN</th>
                                            <th className="p-2.5">LÝ DO</th>
                                            <th className="p-2.5">THỜI GIAN</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100">
                                        {userSpecificLogs.map(log => (
                                            <tr key={log.id}>
                                                <td className="p-2.5 font-black">
                                                    {Number(log.amount) >= 0 ? (
                                                        <span className="text-emerald-600">+{formatCurrency(log.amount)}</span>
                                                    ) : (
                                                        <span className="text-rose-600">{formatCurrency(log.amount)}</span>
                                                    )}
                                                </td>
                                                <td className="p-2.5 font-medium text-zinc-700">{log.reason || 'Biến động'}</td>
                                                <td className="p-2.5 text-[10px] font-mono text-zinc-400">{formatDateStr(log.created_at)}</td>
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

            {/* Modal 4: API Key */}
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
                            <h3 className="text-sm font-black uppercase text-zinc-900">CẤP API KEY VÍ THÀNH CÔNG</h3>
                        </div>
                        <p className="text-xs text-zinc-500 font-medium">
                            API Key cho <span className="font-bold text-zinc-900">@{apiKeyModal.user.username || apiKeyModal.user.id}</span>:
                        </p>
                        <div className="flex items-center gap-2 rounded-xl bg-zinc-100 p-3 font-mono text-xs text-zinc-900 break-all select-all border border-zinc-200">
                            <span>{apiKeyModal.apiKey}</span>
                            <button
                                onClick={() => handleCopy(apiKeyModal.apiKey, 'modal_wallet_key')}
                                className="shrink-0 p-1 rounded-lg bg-white shadow-2xs hover:bg-zinc-50 cursor-pointer"
                            >
                                {copiedField === 'modal_wallet_key' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-zinc-600" />}
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
        </div>
    );
}
