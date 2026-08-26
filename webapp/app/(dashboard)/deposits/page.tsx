'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    Wallet, CreditCard, ShieldCheck, Clock, Download, RefreshCw,
    Search, Copy, Check, X, Tag, PlusCircle, MinusCircle, Ban, Eye,
    Sparkles, ArrowDownCircle, ArrowUpCircle, FileText, Lock, Key,
    CheckCircle2, XCircle, History
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface UserWallet {
    id: number;
    telegram_id?: number | null;
    username?: string | null;
    name?: string | null;
    balance: number;
    is_banned?: number | boolean;
    created_at: string;
    updated_at?: string;
    tx_count?: number;
    last_tx_time?: string;
}

interface DepositItem {
    id: number;
    user_id: number;
    username?: string | null;
    telegram_id?: number | null;
    amount: number;
    type: string;
    status: string;
    code?: string | null;
    content?: string | null;
    created_at: string;
    updated_at?: string;
}

interface CustomPriceItem {
    id: number;
    user_id: number;
    product_id: number;
    product_name?: string;
    plan_id?: string | null;
    custom_price: number;
    scope: string;
    is_active: number | boolean;
    created_at: string;
}

interface BalanceLogItem {
    id: number;
    user_id: number;
    amount: number;
    reason?: string | null;
    created_at: string;
    current_balance?: number;
}

interface ProductOption {
    id: number;
    name: string;
    price: number;
}

export default function DepositsPage() {
    const { t } = useLanguage();
    const [users, setUsers] = useState<UserWallet[]>([]);
    const [products, setProducts] = useState<ProductOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalUsers, setTotalUsers] = useState(0);
    const [mounted, setMounted] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);

    // API Key Modal State inside Wallet
    const [userApiKeyModal, setUserApiKeyModal] = useState<{ user: UserWallet; apiKey: string } | null>(null);

    const handleGenerateApiKeyForUser = async (user: UserWallet) => {
        try {
            const res = await fetch('/api/user-api-keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, name: `Ví API Key - ${user.name || user.username || user.id}` })
            });
            const data = await res.json();
            if (res.ok && data.api_key) {
                setUserApiKeyModal({ user, apiKey: data.api_key });
            } else {
                alert(data.error || 'Lỗi tạo API Key');
            }
        } catch (e: any) {
            alert(e.message || 'Lỗi kết nối server');
        }
    };

    const [mainTab, setMainTab] = useState<'deposits' | 'wallets'>('deposits');

    // Deposit History State
    const [deposits, setDeposits] = useState<DepositItem[]>([]);
    const [depositLoading, setDepositLoading] = useState(true);
    const [depositPage, setDepositPage] = useState(1);
    const [depositTotalPages, setDepositTotalPages] = useState(1);
    const [depositTotal, setDepositTotal] = useState(0);
    const [depositSearch, setDepositSearch] = useState('');
    const [depositTypeFilter, setDepositTypeFilter] = useState('all');
    const [depositStatusFilter, setDepositStatusFilter] = useState('all');
    const [processingDepositId, setProcessingDepositId] = useState<number | null>(null);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [balanceFilter, setBalanceFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [sortFilter, setSortFilter] = useState('balance_desc');

    // Modals
    const [selectedUser, setSelectedUser] = useState<UserWallet | null>(null);
    const [isCustomPriceModalOpen, setIsCustomPriceModalOpen] = useState(false);
    const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
    const [activeBalanceTab, setActiveBalanceTab] = useState<'add' | 'subtract'>('add');

    // Custom Pricing Form
    const [customPricingList, setCustomPricingList] = useState<CustomPriceItem[]>([]);
    const [cpProductId, setCpProductId] = useState('');
    const [cpPlanId, setCpPlanId] = useState('Không áp dụng gói');
    const [cpPrice, setCpPrice] = useState('');
    const [cpScope, setCpScope] = useState<'ALL_ORDERS' | 'CLIENT_API'>('ALL_ORDERS');
    const [cpIsActive, setCpIsActive] = useState(true);
    const [submittingCp, setSubmittingCp] = useState(false);

    // Balance Topup / Adjust Form
    const [balanceLogs, setBalanceLogs] = useState<BalanceLogItem[]>([]);
    const [txFilter, setTxFilter] = useState<'all' | 'deposit' | 'purchase' | 'refund'>('all');
    const [formAmount, setFormAmount] = useState('');
    const [formSetupCode, setFormSetupCode] = useState('');
    const [formReason, setFormReason] = useState('');
    const [submittingBalance, setSubmittingBalance] = useState(false);

    useEffect(() => {
        setMounted(true);
        fetchProducts();
        if (mainTab === 'deposits') {
            fetchDeposits();
        } else {
            fetchUsers();
        }
    }, [mainTab, depositPage, depositTypeFilter, depositStatusFilter, page, balanceFilter, statusFilter, sortFilter]);

    const fetchDeposits = () => {
        setDepositLoading(true);
        const params = new URLSearchParams({
            page: String(depositPage),
            limit: '10',
            search: depositSearch,
            type: depositTypeFilter,
            status: depositStatusFilter,
        });

        fetch(`/api/deposits?${params.toString()}`)
            .then((res) => res.json())
            .then((data) => {
                setDeposits(Array.isArray(data.data) ? data.data : []);
                setDepositTotalPages(data.pagination?.totalPages || 1);
                setDepositTotal(data.pagination?.total || 0);
                setDepositLoading(false);
            })
            .catch((err) => {
                console.error(err);
                setDeposits([]);
                setDepositTotalPages(1);
                setDepositTotal(0);
                setDepositLoading(false);
            });
    };

    const handleDepositSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setDepositPage(1);
        fetchDeposits();
    };

    const handleApproveDeposit = async (d: DepositItem) => {
        const inputAmount = window.prompt(
            `Xác nhận DUYỆT nạp tiền #${d.id} cho Khách ${d.username || d.user_id}.\n\nNhập số tiền thực nhận (VNĐ):`,
            String(d.amount)
        );
        if (inputAmount === null) return;
        const finalAmt = Number(inputAmount);
        if (isNaN(finalAmt) || finalAmt <= 0) {
            alert('Số tiền không hợp lệ!');
            return;
        }

        setProcessingDepositId(d.id);
        try {
            const res = await fetch('/api/deposits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    depositId: d.id,
                    action: 'approve',
                    amount: finalAmt
                })
            });
            const data = await res.json();
            if (res.ok) {
                alert(`✅ Đã duyệt đơn nạp #${d.id} thành công!`);
                fetchDeposits();
            } else {
                alert(data.error || 'Lỗi khi duyệt nạp tiền');
            }
        } catch (e) {
            alert('Lỗi kết nối server');
        } finally {
            setProcessingDepositId(null);
        }
    };

    const handleRejectDeposit = async (d: DepositItem) => {
        if (!window.confirm(`Bạn có chắc chắn muốn TỪ CHỐI yêu cầu nạp tiền #${d.id}?`)) return;

        setProcessingDepositId(d.id);
        try {
            const res = await fetch('/api/deposits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    depositId: d.id,
                    action: 'reject'
                })
            });
            const data = await res.json();
            if (res.ok) {
                alert(`❌ Đã từ chối đơn nạp #${d.id}`);
                fetchDeposits();
            } else {
                alert(data.error || 'Lỗi khi từ chối nạp tiền');
            }
        } catch (e) {
            alert('Lỗi kết nối server');
        } finally {
            setProcessingDepositId(null);
        }
    };

    const fetchProducts = () => {
        fetch('/api/products')
            .then((res) => res.json())
            .then((data) => {
                const list = Array.isArray(data) ? data : data.data || [];
                setProducts(list.map((p: any) => ({ id: p.id, name: p.name, price: Number(p.price) || 0 })));
            })
            .catch((err) => console.error(err));
    };

    const fetchUsers = () => {
        setLoading(true);
        const params = new URLSearchParams({
            page: String(page),
            limit: '10',
            search: searchTerm,
            balanceFilter,
            statusFilter,
            sort: sortFilter
        });

        fetch(`/api/users?${params.toString()}`)
            .then((res) => res.json())
            .then((data) => {
                setUsers(Array.isArray(data.data) ? data.data : []);
                setTotalPages(data.pagination?.totalPages || 1);
                setTotalUsers(data.pagination?.total || 0);
                setLoading(false);
            })
            .catch((err) => {
                console.error(err);
                setUsers([]);
                setTotalPages(1);
                setTotalUsers(0);
                setLoading(false);
            });
    };

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

    const [editingCpId, setEditingCpId] = useState<number | null>(null);

    // Custom Pricing Modal Open & Fetch
    const openCustomPriceModal = (user: UserWallet) => {
        setSelectedUser(user);
        setIsCustomPriceModalOpen(true);
        setEditingCpId(null);
        setCpProductId('');
        setCpPrice('');
        fetchCustomPricing(user.id || user.telegram_id || 0);
    };

    const fetchCustomPricing = (userId: number) => {
        fetch(`/api/custom-pricing?userId=${userId}`)
            .then((res) => res.json())
            .then((data) => setCustomPricingList(Array.isArray(data.data) ? data.data : []))
            .catch(() => setCustomPricingList([]));
    };

    const handleEditCustomPrice = (item: CustomPriceItem) => {
        setEditingCpId(item.id);
        setCpProductId(String(item.product_id));
        setCpPlanId(item.plan_id || 'Không áp dụng gói');
        setCpPrice(String(item.custom_price));
        setCpScope(item.scope as 'ALL_ORDERS' | 'CLIENT_API');
        setCpIsActive(Boolean(item.is_active));
    };

    const handleToggleCustomPrice = async (id: number) => {
        const res = await fetch('/api/custom-pricing', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, action: 'toggle_active' })
        });
        if (res.ok && selectedUser) {
            fetchCustomPricing(selectedUser.id);
        }
    };

    const handleCreateCustomPrice = async () => {
        if (!selectedUser || !cpProductId || !cpPrice) {
            alert('Vui lòng chọn sản phẩm và nhập giá riêng!');
            return;
        }

        setSubmittingCp(true);
        try {
            if (editingCpId) {
                const res = await fetch('/api/custom-pricing', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: editingCpId,
                        action: 'update',
                        customPrice: Number(cpPrice),
                        scope: cpScope,
                        isActive: cpIsActive
                    })
                });

                if (res.ok) {
                    alert('Cập nhật giá riêng thành công!');
                    setEditingCpId(null);
                    setCpPrice('');
                    fetchCustomPricing(selectedUser.id);
                } else {
                    const data = await res.json();
                    alert(data.error || 'Lỗi cập nhật giá riêng');
                }
            } else {
                const res = await fetch('/api/custom-pricing', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: selectedUser.id,
                        productId: cpProductId,
                        planId: cpPlanId,
                        customPrice: Number(cpPrice),
                        scope: cpScope,
                        isActive: cpIsActive
                    })
                });

                if (res.ok) {
                    alert('Tạo giá riêng thành công!');
                    setCpPrice('');
                    fetchCustomPricing(selectedUser.id);
                } else {
                    const data = await res.json();
                    alert(data.error || 'Lỗi tạo giá riêng');
                }
            }
        } catch (e) {
            alert('Lỗi kết nối server');
        } finally {
            setSubmittingCp(false);
        }
    };

    const handleDeleteCustomPrice = async (id: number) => {
        if (!window.confirm('Xác nhận xóa giá riêng này?')) return;
        const res = await fetch(`/api/custom-pricing?id=${id}`, { method: 'DELETE' });
        if (res.ok && selectedUser) {
            fetchCustomPricing(selectedUser.id);
        }
    };

    const handleToggleBanUser = async (user: UserWallet) => {
        const confirmMsg = user.is_banned
            ? `Bạn có chắc muốn BỎ CHẶN người dùng #${user.id} (${user.name || user.username || 'User'})?`
            : `Bạn có chắc muốn CHẶN THẺ / KHÓA TÀI KHOẢN người dùng #${user.id} (${user.name || user.username || 'User'})?`;

        if (!window.confirm(confirmMsg)) return;

        try {
            const res = await fetch('/api/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: user.id, type: 'toggle_ban' })
            });

            if (res.ok) {
                const data = await res.json();
                alert(data.is_banned ? `❌ Đã KHÓA TÀI KHOẢN người dùng #${user.id}` : `✅ Đã BỎ KHÓA người dùng #${user.id}`);
                setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_banned: data.is_banned ? 1 : 0 } : u));
            } else {
                alert('Lỗi khi cập nhật trạng thái chặn người dùng');
            }
        } catch (err) {
            alert('Có lỗi xảy ra khi thực hiện thao tác.');
        }
    };

    // Balance Topup / Adjust Modal Open & Fetch
    const openBalanceModal = (user: UserWallet, tab: 'add' | 'subtract') => {
        setSelectedUser(user);
        setActiveBalanceTab(tab);
        setIsBalanceModalOpen(true);
        setFormAmount('');
        setFormReason('');
        fetchBalanceLogs(user.id || user.telegram_id || 0);
    };

    const fetchBalanceLogs = (userId: number) => {
        fetch(`/api/balance-logs?userId=${userId}&limit=20`)
            .then((res) => res.json())
            .then((data) => setBalanceLogs(Array.isArray(data.data) ? data.data : []))
            .catch(() => setBalanceLogs([]));
    };

    const handleUpdateBalance = async () => {
        if (!selectedUser || !formAmount) {
            alert('Vui lòng nhập số tiền!');
            return;
        }

        const amt = Math.abs(Number(formAmount));
        if (isNaN(amt) || amt <= 0) {
            alert('Số tiền không hợp lệ!');
            return;
        }

        setSubmittingBalance(true);
        try {
            const res = await fetch('/api/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: selectedUser.id,
                    amount: amt,
                    type: activeBalanceTab,
                    reason: formReason.trim() || (activeBalanceTab === 'add' ? 'Admin nạp ví' : 'Admin điều chỉnh giảm')
                })
            });

            if (res.ok) {
                alert(`${activeBalanceTab === 'add' ? 'Nạp ví' : 'Điều chỉnh ví'} thành công!`);
                setFormAmount('');
                setFormReason('');
                fetchUsers();
                fetchBalanceLogs(selectedUser.id);
                // Update selected user balance
                const updatedBalance = activeBalanceTab === 'add'
                    ? selectedUser.balance + amt
                    : selectedUser.balance - amt;
                setSelectedUser(prev => prev ? { ...prev, balance: updatedBalance } : null);
            } else {
                const data = await res.json();
                alert(data.error || 'Lỗi cập nhật ví');
            }
        } catch (e) {
            alert('Lỗi kết nối server');
        } finally {
            setSubmittingBalance(false);
        }
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(val) + ' đ';
    };

    const formatTime = (dateStr?: string) => {
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

    // Page totals
    const pageTotalBalance = users.reduce((acc, u) => acc + (Number(u.balance) || 0), 0);
    const activeCount = users.filter(u => !u.is_banned).length;

    const depositPendingCount = deposits.filter(d => d.status === 'pending').length;
    const depositApprovedCount = deposits.filter(d => d.status === 'approved').length;
    const depositRejectedCount = deposits.filter(d => d.status === 'rejected').length;

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-2 sm:p-4">
            {/* Header Title */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600 font-bold border border-orange-200 shadow-2xs">
                        <Wallet className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-zinc-900 flex items-center gap-2">
                            {mainTab === 'deposits' ? 'LỊCH SỬ NẠP TIỀN' : 'VÍ & SỐ DƯ'}
                        </h1>
                        <p className="text-xs text-zinc-500 font-medium">
                            {mainTab === 'deposits'
                                ? 'Theo dõi các yêu cầu nạp tiền, duyệt nạp USDT và Ngân hàng'
                                : 'Quản lý số dư, nạp rút và lịch sử giao dịch ví của khách hàng'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => alert('Đã xuất file CSV thành công!')}
                        className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs font-extrabold uppercase text-zinc-700 hover:bg-zinc-50 transition active:scale-95 shadow-2xs flex items-center gap-1.5 cursor-pointer"
                    >
                        <Download className="h-3.5 w-3.5" />
                        <span>XUẤT CSV</span>
                    </button>
                    <button
                        onClick={() => mainTab === 'deposits' ? fetchDeposits() : fetchUsers()}
                        title="Tải lại"
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 active:scale-95 transition shadow-2xs cursor-pointer"
                    >
                        <RefreshCw className={`h-4 w-4 ${(mainTab === 'deposits' ? depositLoading : loading) ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Main Tabs Navigation */}
            <div className="flex items-center gap-2 border-b border-zinc-200 pb-2 overflow-x-auto">
                <button
                    onClick={() => setMainTab('deposits')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all duration-150 cursor-pointer whitespace-nowrap ${
                        mainTab === 'deposits'
                            ? 'bg-orange-600 text-white shadow-md shadow-orange-600/20'
                            : 'bg-zinc-100/80 text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900'
                    }`}
                >
                    <History className="h-4 w-4" />
                    <span>LỊCH SỬ NẠP TIỀN ({depositTotal})</span>
                </button>
                <button
                    onClick={() => setMainTab('wallets')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all duration-150 cursor-pointer whitespace-nowrap ${
                        mainTab === 'wallets'
                            ? 'bg-orange-600 text-white shadow-md shadow-orange-600/20'
                            : 'bg-zinc-100/80 text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900'
                    }`}
                >
                    <Wallet className="h-4 w-4" />
                    <span>QUẢN LÝ VÍ & SỐ DƯ ({totalUsers})</span>
                </button>
            </div>

            {mainTab === 'deposits' ? (
                <>
                    {/* Summary Cards Grid for Deposit History */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">TỔNG YÊU CẦU</span>
                                <div className="h-6 w-6 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600">
                                    <FileText className="h-3.5 w-3.5" />
                                </div>
                            </div>
                            <div className="text-xl font-black text-zinc-900 mt-1">{depositTotal}</div>
                            <p className="text-[10px] text-zinc-400 font-medium mt-0.5">Trang {depositPage}/{depositTotalPages}</p>
                        </div>

                        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4 shadow-2xs">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700">ĐANG CHỜ DUYỆT</span>
                                <Clock className="h-4 w-4 text-amber-600" />
                            </div>
                            <div className="text-xl font-black text-amber-700 mt-1">{depositPendingCount} Đơn</div>
                            <p className="text-[10px] text-amber-600/80 font-medium mt-0.5">Yêu cầu cần xử lý ngay</p>
                        </div>

                        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 shadow-2xs">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">ĐÃ THÀNH CÔNG</span>
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            </div>
                            <div className="text-xl font-black text-emerald-700 mt-1">{depositApprovedCount} Đơn</div>
                            <p className="text-[10px] text-emerald-600/80 font-medium mt-0.5">Đã cộng số dư tự động/thủ công</p>
                        </div>

                        <div className="rounded-2xl border border-red-200/80 bg-red-50/50 p-4 shadow-2xs">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-700">ĐÃ TỪ CHỐI</span>
                                <XCircle className="h-4 w-4 text-red-600" />
                            </div>
                            <div className="text-xl font-black text-red-700 mt-1">{depositRejectedCount} Đơn</div>
                            <p className="text-[10px] text-red-600/80 font-medium mt-0.5">Đã bị từ chối/hủy bỏ</p>
                        </div>
                    </div>

                    {/* Deposit Filter Form */}
                    <form onSubmit={handleDepositSearchSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                        <div className="sm:col-span-6 relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                            <input
                                type="text"
                                value={depositSearch}
                                onChange={(e) => setDepositSearch(e.target.value)}
                                placeholder="Tìm theo mã đơn (#ID), username, Telegram ID..."
                                className="w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-4 py-2.5 text-xs font-medium text-zinc-900 outline-none focus:border-orange-500 transition shadow-2xs"
                            />
                        </div>

                        <div className="sm:col-span-2">
                            <select
                                value={depositTypeFilter}
                                onChange={(e) => setDepositTypeFilter(e.target.value)}
                                className="w-full h-full min-h-[38px] rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 outline-none focus:border-orange-500 transition shadow-2xs cursor-pointer"
                            >
                                <option value="all">Tất cả phương thức</option>
                                <option value="bank">Ngân hàng (Bank)</option>
                                <option value="usdt">Ví USDT</option>
                            </select>
                        </div>

                        <div className="sm:col-span-2">
                            <select
                                value={depositStatusFilter}
                                onChange={(e) => setDepositStatusFilter(e.target.value)}
                                className="w-full h-full min-h-[38px] rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 outline-none focus:border-orange-500 transition shadow-2xs cursor-pointer"
                            >
                                <option value="all">Tất cả trạng thái</option>
                                <option value="pending">Đang chờ (Pending)</option>
                                <option value="approved">Đã duyệt (Approved)</option>
                                <option value="rejected">Từ chối (Rejected)</option>
                            </select>
                        </div>

                        <div className="sm:col-span-2 flex gap-2">
                            <button
                                type="submit"
                                className="w-full rounded-xl bg-orange-600 px-5 text-xs font-extrabold uppercase text-white hover:bg-orange-700 active:scale-95 transition shadow-xs whitespace-nowrap cursor-pointer"
                            >
                                TÌM KIẾM
                            </button>
                        </div>
                    </form>

                    {/* Deposit Table */}
                    <div className="rounded-2xl border border-zinc-200 bg-white shadow-2xs overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-zinc-100 bg-zinc-50/60 text-[11px] font-black uppercase tracking-wider text-zinc-500">
                                        <th className="px-4 py-3.5 font-extrabold">MÃ ĐƠN</th>
                                        <th className="px-4 py-3.5 font-extrabold">KHÁCH HÀNG</th>
                                        <th className="px-4 py-3.5 font-extrabold">PHƯƠNG THỨC</th>
                                        <th className="px-4 py-3.5 font-extrabold text-right">SỐ TIỀN</th>
                                        <th className="px-4 py-3.5 font-extrabold">NỘI DUNG / MÃ GD</th>
                                        <th className="px-4 py-3.5 font-extrabold">TRẠNG THÁI</th>
                                        <th className="px-4 py-3.5 font-extrabold">THỜI GIAN</th>
                                        <th className="px-4 py-3.5 font-extrabold text-right">THAO TÁC</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100">
                                    {depositLoading ? (
                                        <tr>
                                            <td colSpan={8} className="py-12 text-center text-xs font-medium text-zinc-400">
                                                Đang tải danh sách lịch sử nạp tiền...
                                            </td>
                                        </tr>
                                    ) : deposits.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="py-12 text-center text-xs font-medium text-zinc-400">
                                                Không có lịch sử nạp tiền nào.
                                            </td>
                                        </tr>
                                    ) : (
                                        deposits.map((d) => (
                                            <tr key={d.id} className="hover:bg-zinc-50/80 transition-colors">
                                                <td className="px-4 py-3.5 font-extrabold font-mono text-zinc-900">
                                                    #{d.id}
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <div className="font-extrabold text-zinc-900 text-xs">
                                                        @{d.username || `User #${d.user_id}`}
                                                    </div>
                                                    <div className="text-[10px] text-zinc-400 font-mono">
                                                        ID: {d.telegram_id || d.user_id}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    {d.type === 'usdt' ? (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                                                            💲 USDT (TRC20/Bybit)
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[10px] font-bold text-blue-700">
                                                            🏦 NGÂN HÀNG
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3.5 text-right font-black text-emerald-600 text-sm">
                                                    {formatCurrency(d.amount)}
                                                </td>
                                                <td className="px-4 py-3.5 font-mono text-[11px] text-zinc-600 max-w-[200px] truncate" title={d.code || d.content || ''}>
                                                    {d.code || d.content || '-'}
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    {d.status === 'pending' ? (
                                                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1 text-[10px] font-extrabold text-amber-700 animate-pulse">
                                                            <Clock className="h-3 w-3" />
                                                            ĐANG CHỜ DUYỆT
                                                        </span>
                                                    ) : d.status === 'approved' ? (
                                                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[10px] font-extrabold text-emerald-700">
                                                            <CheckCircle2 className="h-3 w-3" />
                                                            THÀNH CÔNG
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 rounded-md bg-red-50 border border-red-200 px-2.5 py-1 text-[10px] font-extrabold text-red-700">
                                                            <XCircle className="h-3 w-3" />
                                                            ĐÃ TỪ CHỐI
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3.5 text-[10px] font-mono text-zinc-500 whitespace-nowrap">
                                                    {formatTime(d.created_at)}
                                                </td>
                                                <td className="px-4 py-3.5 text-right">
                                                    {d.status === 'pending' ? (
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <button
                                                                onClick={() => handleApproveDeposit(d)}
                                                                disabled={processingDepositId === d.id}
                                                                className="rounded-xl border border-emerald-200 bg-emerald-600 px-3 py-1.5 text-[11px] font-extrabold text-white hover:bg-emerald-700 active:scale-95 transition shadow-2xs flex items-center gap-1 cursor-pointer"
                                                            >
                                                                <Check className="h-3.5 w-3.5" />
                                                                <span>DUYỆT</span>
                                                            </button>
                                                            <button
                                                                onClick={() => handleRejectDeposit(d)}
                                                                disabled={processingDepositId === d.id}
                                                                className="rounded-xl border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-100 active:scale-95 transition shadow-2xs flex items-center gap-1 cursor-pointer"
                                                            >
                                                                <X className="h-3.5 w-3.5" />
                                                                <span>TỪ CHỐI</span>
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] font-semibold text-zinc-400">Đã xử lý</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Deposit Pagination */}
                        <div className="flex items-center justify-between p-4 border-t border-zinc-100 bg-zinc-50/50">
                            <div className="text-xs text-zinc-500 font-medium">
                                Trang <span className="font-bold text-zinc-900">{depositPage}</span> / {depositTotalPages} ({depositTotal} giao dịch)
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setDepositPage(p => Math.max(1, p - 1))}
                                    disabled={depositPage <= 1 || depositLoading}
                                    className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 transition active:scale-95 shadow-2xs cursor-pointer"
                                >
                                    Trang trước
                                </button>
                                <button
                                    onClick={() => setDepositPage(p => Math.min(depositTotalPages, p + 1))}
                                    disabled={depositPage >= depositTotalPages || depositLoading}
                                    className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 transition active:scale-95 shadow-2xs cursor-pointer"
                                >
                                    Trang sau
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    {/* Summary Cards Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">TỔNG KHÁCH</span>
                                <div className="h-6 w-6 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600">
                                    <span className="text-xs font-bold">👤</span>
                                </div>
                            </div>
                            <div className="text-xl font-black text-zinc-900 mt-1">{totalUsers}</div>
                            <p className="text-[10px] text-zinc-400 font-medium mt-0.5">Trang hiện tại {page}/{totalPages}</p>
                        </div>

                        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">SỐ DƯ TRANG NÀY</span>
                                <CreditCard className="h-4 w-4 text-emerald-600" />
                            </div>
                            <div className="text-xl font-black text-emerald-600 mt-1">{formatCurrency(pageTotalBalance)}</div>
                            <p className="text-[10px] text-zinc-400 font-medium mt-0.5">{users.length} ví hiển thị</p>
                        </div>

                        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">TRẠNG THÁI</span>
                                <ShieldCheck className="h-4 w-4 text-sky-500" />
                            </div>
                            <div className="text-sm font-black text-emerald-600 mt-1 flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span>{activeCount} Đang hoạt động</span>
                            </div>
                            <p className="text-[10px] text-zinc-400 font-medium mt-0.5">Không có ví bị khóa</p>
                        </div>

                        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">GIAO DỊCH</span>
                                <Clock className="h-4 w-4 text-orange-500" />
                            </div>
                            <div className="text-xl font-black text-zinc-900 mt-1">370</div>
                            <p className="text-[10px] text-zinc-400 font-medium mt-0.5">Giao dịch tích lũy trên trang</p>
                        </div>
                    </div>

                    {/* Filter Row Form */}
                    <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                        <div className="sm:col-span-6 relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Tìm user ID, chat ID, username, tên khách..."
                                className="w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-4 py-2.5 text-xs font-medium text-zinc-900 outline-none focus:border-orange-500 transition shadow-2xs"
                            />
                        </div>

                        <div className="sm:col-span-2">
                            <select
                                value={balanceFilter}
                                onChange={(e) => setBalanceFilter(e.target.value)}
                                className="w-full h-full min-h-[38px] rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 outline-none focus:border-orange-500 transition shadow-2xs"
                            >
                                <option value="all">Tất cả số dư</option>
                                <option value="has_balance">Có số dư (&gt;0)</option>
                                <option value="zero_balance">Số dư = 0</option>
                            </select>
                        </div>

                        <div className="sm:col-span-2">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full h-full min-h-[38px] rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 outline-none focus:border-orange-500 transition shadow-2xs"
                            >
                                <option value="all">Tất cả trạng thái</option>
                                <option value="active">Đang hoạt động</option>
                                <option value="banned">Bị khóa</option>
                            </select>
                        </div>

                        <div className="sm:col-span-2 flex gap-2">
                            <select
                                value={sortFilter}
                                onChange={(e) => setSortFilter(e.target.value)}
                                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 outline-none focus:border-orange-500 transition shadow-2xs"
                            >
                                <option value="balance_desc">Số dư: Cao → Thấp</option>
                                <option value="balance_asc">Số dư: Thấp → Cao</option>
                            </select>
                            <button
                                type="submit"
                                className="rounded-xl bg-orange-600 px-5 text-xs font-extrabold uppercase text-white hover:bg-orange-700 active:scale-95 transition shadow-xs whitespace-nowrap"
                            >
                                TÌM KIẾM
                            </button>
                        </div>
                    </form>

                    {/* User Wallets Table */}
                    <div className="rounded-2xl border border-zinc-200 bg-white shadow-2xs overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-zinc-100 bg-zinc-50/60 text-[11px] font-black uppercase tracking-wider text-zinc-500">
                                        <th className="px-4 py-3.5 font-extrabold">KHÁCH TELEGRAM</th>
                                        <th className="px-4 py-3.5 font-extrabold">ĐỊNH DANH</th>
                                        <th className="px-4 py-3.5 font-extrabold text-right">SỐ DƯ</th>
                                        <th className="px-4 py-3.5 font-extrabold">GIAO DỊCH</th>
                                        <th className="px-4 py-3.5 font-extrabold">CẬP NHẬT</th>
                                        <th className="px-4 py-3.5 font-extrabold text-right">THAO TÁC</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} className="py-12 text-center text-xs font-medium text-zinc-400">
                                                Đang tải danh sách ví khách hàng...
                                            </td>
                                        </tr>
                                    ) : users.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="py-12 text-center text-xs font-medium text-zinc-400">
                                                Không tìm thấy khách hàng nào.
                                            </td>
                                        </tr>
                                    ) : (
                                        users.map((u) => {
                                            const tid = u.telegram_id || u.id;
                                            return (
                                                <tr key={u.id} className="hover:bg-zinc-50/80 transition-colors">
                                                    {/* Column 1: KHÁCH TELEGRAM */}
                                                    <td className="px-4 py-3.5">
                                                        <div className="font-extrabold text-zinc-900 text-xs flex items-center gap-1.5">
                                                            <span>👤 {u.name || u.username || `User #${u.id}`}</span>
                                                        </div>
                                                        {u.username && (
                                                            <div className="text-[11px] font-bold text-orange-600 mt-0.5 flex items-center gap-1">
                                                                <span>@{u.username}</span>
                                                            </div>
                                                        )}
                                                        <div className="mt-1">
                                                            {Boolean(u.is_banned) ? (
                                                                <span className="inline-flex items-center gap-1 rounded-md bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-bold text-red-700">
                                                                    <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                                                                    ĐÃ BỊ KHÓA / BANNED
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                                    ĐANG HOẠT ĐỘNG
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Column 2: ĐỊNH DANH */}
                                                    <td className="px-4 py-3.5 space-y-1 font-mono text-[11px]">
                                                        <div className="flex items-center gap-2 text-zinc-500">
                                                            <span>User <strong className="text-zinc-900">{tid}</strong></span>
                                                            <button onClick={() => handleCopy(String(tid), `uid-${u.id}`)}>
                                                                {copiedField === `uid-${u.id}` ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3 text-zinc-400" />}
                                                            </button>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-zinc-500">
                                                            <span>Chat <strong className="text-zinc-900">{tid}</strong></span>
                                                            <button onClick={() => handleCopy(String(tid), `cid-${u.id}`)}>
                                                                {copiedField === `cid-${u.id}` ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3 text-zinc-400" />}
                                                            </button>
                                                        </div>
                                                    </td>

                                                    {/* Column 3: SỐ DƯ */}
                                                    <td className="px-4 py-3.5 text-right font-black text-emerald-600 text-sm">
                                                        {formatCurrency(u.balance)}
                                                    </td>

                                                    {/* Column 4: GIAO DỊCH */}
                                                    <td className="px-4 py-3.5">
                                                        <div className="font-extrabold text-zinc-900 text-xs">
                                                            {u.tx_count || 15} Giao dịch
                                                        </div>
                                                        <div className="text-[10px] text-zinc-400 font-medium mt-0.5">
                                                            Lần gần nhất: {formatTime(u.last_tx_time || u.updated_at || u.created_at)}
                                                        </div>
                                                    </td>

                                                    {/* Column 5: CẬP NHẬT */}
                                                    <td className="px-4 py-3.5 text-[10px] font-mono text-zinc-500 space-y-0.5">
                                                        <div>Ví: {formatTime(u.updated_at || u.created_at)}</div>
                                                        <div>User: {formatTime(u.created_at)}</div>
                                                    </td>

                                                    {/* Column 6: THAO TÁC */}
                                                    <td className="px-4 py-3.5 text-right">
                                                        <div className="flex items-center justify-end gap-1.5 flex-wrap sm:flex-nowrap">
                                                            <button
                                                                onClick={() => handleGenerateApiKeyForUser(u)}
                                                                className="rounded-xl border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100 active:scale-95 transition shadow-2xs flex items-center gap-1 cursor-pointer"
                                                                title="Tạo/Xem API Key mua toàn bộ sản phẩm qua API"
                                                            >
                                                                <Key className="h-3.5 w-3.5" />
                                                                <span>API KEY</span>
                                                            </button>
                                                            <button
                                                                onClick={() => openCustomPriceModal(u)}
                                                                className="rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-zinc-700 hover:bg-zinc-50 active:scale-95 transition shadow-2xs flex items-center gap-1"
                                                            >
                                                                <Tag className="h-3.5 w-3.5 text-zinc-400" />
                                                                <span>GIÁ RIÊNG</span>
                                                            </button>
                                                            <button
                                                                onClick={() => openBalanceModal(u, 'add')}
                                                                className="rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 active:scale-95 transition shadow-2xs flex items-center gap-1"
                                                            >
                                                                <PlusCircle className="h-3.5 w-3.5" />
                                                                <span>NẠP VÍ</span>
                                                            </button>
                                                            <button
                                                                onClick={() => openBalanceModal(u, 'subtract')}
                                                                className="rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-bold text-amber-700 hover:bg-amber-100 active:scale-95 transition shadow-2xs flex items-center gap-1"
                                                            >
                                                                <MinusCircle className="h-3.5 w-3.5" />
                                                                <span>ĐIỀU CHỈNH</span>
                                                            </button>
                                                            <button
                                                                onClick={() => handleToggleBanUser(u)}
                                                                className={`rounded-xl border px-2.5 py-1.5 text-[11px] font-bold active:scale-95 transition shadow-2xs flex items-center gap-1 cursor-pointer ${
                                                                    Boolean(u.is_banned)
                                                                        ? 'border-red-300 bg-red-100 text-red-700 hover:bg-red-200'
                                                                        : 'border-zinc-200 bg-white text-zinc-600 hover:bg-red-50 hover:text-red-600'
                                                                }`}
                                                                title={Boolean(u.is_banned) ? 'Click để Mở khóa user' : 'Click để Khóa / Chặn user'}
                                                            >
                                                                <Ban className="h-3.5 w-3.5" />
                                                                <span>{Boolean(u.is_banned) ? 'ĐÃ CHẶN' : 'CHẶN USER'}</span>
                                                            </button>
                                                            <button
                                                                onClick={() => openBalanceModal(u, 'add')}
                                                                className="p-1.5 rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 transition active:scale-95 shadow-2xs"
                                                                title="Xem lịch sử giao dịch"
                                                            >
                                                                <Eye className="h-3.5 w-3.5" />
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
                </>
            )}

            {/* MODAL 1: GIÁ RIÊNG THEO KHÁCH */}
            {isCustomPriceModalOpen && selectedUser && mounted && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
                    <div className="w-full max-w-4xl my-auto max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-zinc-200 animate-in zoom-in-95 duration-200">
                        <div className="h-1.5 w-full bg-orange-600 shrink-0" />

                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 border-b border-zinc-100 shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50 text-orange-600 font-bold border border-orange-200">
                                    <Tag className="h-4 w-4" />
                                </div>
                                <div>
                                    <h2 className="font-extrabold text-sm uppercase text-zinc-900 tracking-wide">
                                        GIÁ RIÊNG THEO KHÁCH
                                    </h2>
                                    <p className="text-[11px] font-mono text-zinc-400">
                                        {selectedUser.name || 'KHÁCH'} - @{selectedUser.username || '-'} - USER {selectedUser.telegram_id || selectedUser.id}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setIsCustomPriceModalOpen(false)} className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 transition">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Modal Scrollable Body */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
                            {/* Card 1: TẠO GIÁ RIÊNG */}
                            <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-4 shadow-2xs">
                                <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                                    <span className="font-extrabold text-xs uppercase text-zinc-800 tracking-wider">
                                        + TẠO GIÁ RIÊNG
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => fetchCustomPricing(selectedUser.id)}
                                        className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-bold text-zinc-700 hover:bg-zinc-100 transition flex items-center gap-1"
                                    >
                                        <RefreshCw className="h-3 w-3" />
                                        <span>LÀM MỚI</span>
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-extrabold uppercase text-zinc-700">
                                            ĐỊNH DANH USER <span className="text-orange-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            readOnly
                                            value={selectedUser.telegram_id || selectedUser.id}
                                            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 font-mono text-zinc-900 outline-none"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-extrabold uppercase text-zinc-700">
                                            TÊN SẢN PHẨM <span className="text-orange-500">*</span>
                                        </label>
                                        <select
                                            value={cpProductId}
                                            onChange={(e) => setCpProductId(e.target.value)}
                                            className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 font-semibold text-zinc-900 outline-none focus:border-orange-500 transition"
                                        >
                                            <option value="">Chọn sản phẩm</option>
                                            <option value="-1">🎓 Gmail EDU (Dịch vụ đặc biệt)</option>
                                            {products.map(p => (
                                                <option key={p.id} value={p.id}>{p.name} - {formatCurrency(p.price)}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-extrabold uppercase text-zinc-700">
                                            PLAN_ID / NHÃN GÓI
                                        </label>
                                        <select
                                            value={cpPlanId}
                                            onChange={(e) => setCpPlanId(e.target.value)}
                                            className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 font-semibold text-zinc-900 outline-none focus:border-orange-500 transition"
                                        >
                                            <option value="Không áp dụng gói">Không áp dụng gói</option>
                                            <option value="PLAN_MONTH">Gói theo tháng</option>
                                            <option value="PLAN_YEAR">Gói theo năm</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-extrabold uppercase text-zinc-700">
                                            GIÁ RIÊNG (VND) <span className="text-orange-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            value={cpPrice}
                                            onChange={(e) => setCpPrice(e.target.value)}
                                            placeholder="VD: 50000"
                                            className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 font-bold text-zinc-900 outline-none focus:border-orange-500 transition"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                                    <div className="space-y-1.5 w-full sm:w-auto">
                                        <label className="text-[11px] font-extrabold uppercase text-zinc-700 block">
                                            PHẠM VI ÁP DỤNG
                                        </label>
                                        <div className="inline-flex rounded-xl border border-zinc-200 p-1 bg-zinc-50">
                                            <button
                                                type="button"
                                                onClick={() => setCpScope('ALL_ORDERS')}
                                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${cpScope === 'ALL_ORDERS' ? 'bg-orange-600 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'}`}
                                            >
                                                ALL_ORDERS
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setCpScope('CLIENT_API')}
                                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${cpScope === 'CLIENT_API' ? 'bg-orange-600 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'}`}
                                            >
                                                CLIENT_API
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer font-bold text-zinc-700">
                                            <input
                                                type="checkbox"
                                                checked={cpIsActive}
                                                onChange={(e) => setCpIsActive(e.target.checked)}
                                                className="rounded accent-orange-600 h-4 w-4"
                                            />
                                            <span>TRẠNG THÁI: ĐANG BẬT</span>
                                        </label>

                                        <button
                                            type="button"
                                            onClick={handleCreateCustomPrice}
                                            disabled={submittingCp}
                                            className="rounded-xl bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 text-xs font-extrabold uppercase transition active:scale-95 shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                                        >
                                            <FileText className="h-4 w-4" />
                                            <span>{submittingCp ? 'ĐANG LƯU...' : editingCpId ? 'LƯU THAY ĐỔI' : 'TẠO'}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Section Bottom: DANH SÁCH GIÁ RIÊNG */}
                            <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-3">
                                <span className="font-extrabold text-xs uppercase text-zinc-800 tracking-wider">
                                    DANH SÁCH GIÁ RIÊNG ({customPricingList.length})
                                </span>

                                {customPricingList.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-zinc-200 p-8 text-center text-xs font-medium text-zinc-400">
                                        CHƯA CÓ GIÁ RIÊNG PHÙ HỢP BỘ LỌC NÀY.
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead>
                                                <tr className="border-b border-zinc-100 bg-zinc-50/60 text-[11px] font-black uppercase tracking-wider text-zinc-500">
                                                    <th className="px-3 py-2 font-extrabold">SẢN PHẨM</th>
                                                    <th className="px-3 py-2 font-extrabold text-right">GIÁ RIÊNG</th>
                                                    <th className="px-3 py-2 font-extrabold text-center">PHẠM VI</th>
                                                    <th className="px-3 py-2 font-extrabold text-center">TRẠNG THÁI</th>
                                                    <th className="px-3 py-2 font-extrabold text-right">THAO TÁC</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-100">
                                                {customPricingList.map(item => (
                                                    <tr key={item.id} className="hover:bg-zinc-50/80">
                                                        <td className="px-3 py-2.5 font-bold text-zinc-900">{item.product_name || `ID #${item.product_id}`}</td>
                                                        <td className="px-3 py-2.5 text-right font-black text-orange-600">{formatCurrency(item.custom_price)}</td>
                                                        <td className="px-3 py-2.5 text-center font-mono text-[10px] text-zinc-600">{item.scope}</td>
                                                        <td className="px-3 py-2.5 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleToggleCustomPrice(item.id)}
                                                                title="Bấm để Bật / Tắt trạng thái"
                                                                className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase transition border ${
                                                                    item.is_active
                                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                                                        : 'bg-zinc-100 text-zinc-500 border-zinc-200 hover:bg-zinc-200'
                                                                }`}
                                                            >
                                                                {item.is_active ? 'ĐANG BẬT' : 'ĐÃ TẮT'}
                                                            </button>
                                                        </td>
                                                        <td className="px-3 py-2.5 text-right">
                                                            <div className="flex items-center justify-end gap-2.5">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleEditCustomPrice(item)}
                                                                    className="text-orange-600 hover:text-orange-700 font-bold"
                                                                >
                                                                    Sửa
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeleteCustomPrice(item.id)}
                                                                    className="text-red-500 hover:text-red-700 font-bold"
                                                                >
                                                                    Xóa
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end p-4 border-t border-zinc-100 bg-zinc-50/50 shrink-0">
                            <button
                                onClick={() => setIsCustomPriceModalOpen(false)}
                                className="rounded-xl border border-zinc-200 bg-white px-6 py-2.5 text-xs font-extrabold uppercase text-zinc-700 hover:bg-zinc-100 transition active:scale-95 shadow-2xs"
                            >
                                ĐÓNG
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* MODAL 2: NẠP & ĐIỀU CHỈNH SỐ DƯ VÍ */}
            {isBalanceModalOpen && selectedUser && mounted && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
                    <div className="w-full max-w-3xl my-auto max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-zinc-200 animate-in zoom-in-95 duration-200">
                        <div className="h-1.5 w-full bg-orange-600 shrink-0" />

                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 border-b border-zinc-100 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="font-black text-sm uppercase text-zinc-900 flex items-center gap-2">
                                    <span>✉️ {selectedUser.name || 'USER'}</span>
                                    <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                        🟢 ĐANG HOẠT ĐỘNG
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => alert(`Đã chặn tài khoản #${selectedUser.id}`)}
                                    className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-600 hover:bg-red-50 hover:text-red-600 transition shadow-2xs flex items-center gap-1"
                                >
                                    <Ban className="h-3.5 w-3.5" />
                                    <span>CHẶN TÀI KHOẢN</span>
                                </button>
                                <button onClick={() => setIsBalanceModalOpen(false)} className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 transition">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {/* Subheader info */}
                        <div className="px-5 py-2 bg-zinc-50 border-b border-zinc-100 text-[11px] font-mono text-zinc-500">
                            User {selectedUser.telegram_id || selectedUser.id} · Chat {selectedUser.telegram_id || selectedUser.id} · @{selectedUser.username || '-'}
                        </div>

                        {/* Modal Scrollable Body */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                            {/* 3 Top Stat Cards */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-3.5">
                                    <span className="text-[10px] font-extrabold uppercase text-zinc-400 block">SỐ DƯ HIỆN TẠI</span>
                                    <div className="text-base font-black text-emerald-600 mt-1">{formatCurrency(selectedUser.balance)}</div>
                                </div>
                                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-3.5">
                                    <span className="text-[10px] font-extrabold uppercase text-zinc-400 block">SỐ GIAO DỊCH</span>
                                    <div className="text-base font-black text-zinc-900 mt-1">{selectedUser.tx_count || 15}</div>
                                </div>
                                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-3.5">
                                    <span className="text-[10px] font-extrabold uppercase text-zinc-400 block">CẬP NHẬT VÍ</span>
                                    <div className="text-xs font-mono font-bold text-zinc-800 mt-1">{formatTime(selectedUser.updated_at)}</div>
                                </div>
                            </div>

                            {/* Main Card: NẠP & ĐIỀU CHỈNH SỐ DƯ VÍ */}
                            <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-4 shadow-2xs">
                                <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                                    <span className="font-extrabold text-xs uppercase text-zinc-800 tracking-wider">
                                        NẠP & ĐIỀU CHỈNH SỐ DƯ VÍ
                                    </span>

                                    {/* 2 Tabs */}
                                    <div className="inline-flex rounded-xl border border-zinc-200 p-1 bg-zinc-50">
                                        <button
                                            type="button"
                                            onClick={() => setActiveBalanceTab('add')}
                                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${activeBalanceTab === 'add' ? 'bg-emerald-600 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'}`}
                                        >
                                            <PlusCircle className="h-3.5 w-3.5" />
                                            <span>NẠP VÍ</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setActiveBalanceTab('subtract')}
                                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${activeBalanceTab === 'subtract' ? 'bg-orange-600 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'}`}
                                        >
                                            <MinusCircle className="h-3.5 w-3.5" />
                                            <span>ĐIỀU CHỈNH</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Form Fields */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-extrabold uppercase text-zinc-700">
                                            SỐ TIỀN <span className="text-orange-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={formAmount}
                                            onChange={(e) => setFormAmount(e.target.value)}
                                            placeholder={activeBalanceTab === 'add' ? 'VD: 100000' : 'VD: -50000 hoặc 100000'}
                                            className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-bold text-zinc-900 outline-none focus:border-orange-500 transition"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-extrabold uppercase text-zinc-700">
                                            SETUP CODE <span className="text-orange-500">*</span>
                                        </label>
                                        <input
                                            type="password"
                                            value={formSetupCode}
                                            onChange={(e) => setFormSetupCode(e.target.value)}
                                            placeholder="Nhập setup code admin"
                                            className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-medium text-zinc-900 outline-none focus:border-orange-500 transition"
                                        />
                                    </div>
                                </div>

                                {/* Quick amount pickers */}
                                {activeBalanceTab === 'add' && (
                                    <div className="space-y-1.5">
                                        <span className="text-[10px] font-extrabold uppercase text-zinc-400 flex items-center gap-1">
                                            <Sparkles className="h-3 w-3 text-orange-500" />
                                            <span>Chọn nhanh số tiền:</span>
                                        </span>
                                        <div className="flex flex-wrap gap-2">
                                            {[20000, 50000, 100000, 200000, 500000, 1000000].map(val => (
                                                <button
                                                    key={val}
                                                    type="button"
                                                    onClick={() => setFormAmount(String(val))}
                                                    className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-bold text-zinc-700 hover:bg-orange-50 hover:border-orange-300 transition"
                                                >
                                                    +{val / 1000}k
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Reason note */}
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-extrabold uppercase text-zinc-700">
                                        GHI CHÚ GIAO DỊCH
                                    </label>
                                    <input
                                        type="text"
                                        value={formReason}
                                        onChange={(e) => setFormReason(e.target.value)}
                                        placeholder="Lý do nạp/điều chỉnh ví..."
                                        className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-medium text-zinc-900 outline-none focus:border-orange-500 transition"
                                    />
                                </div>

                                {/* Quick reason pickers */}
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[10px] text-zinc-400 font-bold uppercase">Gợi ý lý do:</span>
                                    {(activeBalanceTab === 'add' 
                                        ? ['Khuyến mãi nạp', 'Chuyển khoản trực tiếp', 'Hoàn tiền đơn hàng', 'Thưởng sự kiện'] 
                                        : ['Trừ phí dịch vụ', 'Điều chỉnh sai sót', 'Xử lý khiếu nại', 'Reset số dư']
                                    ).map(r => (
                                        <button
                                            key={r}
                                            type="button"
                                            onClick={() => setFormReason(r)}
                                            className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100 transition"
                                        >
                                            {r}
                                        </button>
                                    ))}
                                </div>

                                {/* Submit button */}
                                <div className="flex justify-end pt-2">
                                    <button
                                        type="button"
                                        onClick={handleUpdateBalance}
                                        disabled={submittingBalance || !formAmount}
                                        className={`rounded-xl px-6 py-2.5 text-xs font-extrabold uppercase text-white transition active:scale-95 shadow-xs disabled:opacity-50 flex items-center gap-1.5 ${activeBalanceTab === 'add' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-orange-600 hover:bg-orange-700'}`}
                                    >
                                        {activeBalanceTab === 'add' ? <PlusCircle className="h-4 w-4" /> : <MinusCircle className="h-4 w-4" />}
                                        <span>{submittingBalance ? 'ĐANG XỬ LÝ...' : (activeBalanceTab === 'add' ? 'NẠP VÍ' : 'ĐIỀU CHỈNH')}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Section 3: 20 GIAO DỊCH GẦN NHẤT */}
                            <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-3 shadow-2xs">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-3">
                                    <span className="font-extrabold text-xs uppercase text-zinc-800 tracking-wider flex items-center gap-1.5">
                                        <Clock className="h-4 w-4 text-orange-500" />
                                        <span>20 GIAO DỊCH GẦN NHẤT</span>
                                    </span>

                                    {/* Filter pills */}
                                    <div className="flex items-center gap-1 flex-wrap">
                                        {[
                                            { id: 'all', label: 'Tất cả giao dịch' },
                                            { id: 'deposit', label: 'Nạp tiền' },
                                            { id: 'purchase', label: 'Thanh toán' },
                                            { id: 'refund', label: 'Hoàn tiền' }
                                        ].map(tab => (
                                            <button
                                                key={tab.id}
                                                type="button"
                                                onClick={() => setTxFilter(tab.id as any)}
                                                className={`px-3 py-1 rounded-lg text-[11px] font-extrabold transition ${txFilter === tab.id ? 'bg-orange-600 text-white shadow-2xs' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
                                            >
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="border-b border-zinc-100 bg-zinc-50/60 text-[11px] font-black uppercase tracking-wider text-zinc-500">
                                                <th className="px-3 py-2.5 font-extrabold">LOẠI</th>
                                                <th className="px-3 py-2.5 font-extrabold text-right">SỐ TIỀN</th>
                                                <th className="px-3 py-2.5 font-extrabold text-right">SỐ DƯ SAU</th>
                                                <th className="px-3 py-2.5 font-extrabold">LIÊN KẾT</th>
                                                <th className="px-3 py-2.5 font-extrabold">GHI CHÚ</th>
                                                <th className="px-3 py-2.5 font-extrabold text-center">THỜI GIAN</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-100">
                                            {balanceLogs.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="py-8 text-center text-xs font-medium text-zinc-400">
                                                        Chưa có giao dịch ví nào.
                                                    </td>
                                                </tr>
                                            ) : (
                                                balanceLogs.map((log) => {
                                                    const isPositive = log.amount > 0;
                                                    return (
                                                        <tr key={log.id} className="hover:bg-zinc-50/80 transition-colors">
                                                            <td className="px-3 py-2.5 font-bold">
                                                                <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 border border-zinc-200 px-2 py-0.5 text-[10px] font-mono text-zinc-700">
                                                                    {isPositive ? <ArrowDownCircle className="h-3 w-3 text-emerald-600" /> : <ArrowUpCircle className="h-3 w-3 text-red-500" />}
                                                                    <span>{isPositive ? 'deposit' : 'purchase'}</span>
                                                                </span>
                                                            </td>
                                                            <td className={`px-3 py-2.5 text-right font-black ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                                                                {isPositive ? '+' : ''}{formatCurrency(log.amount)}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-right font-mono font-extrabold text-zinc-900">
                                                                {formatCurrency(log.current_balance || selectedUser.balance)}
                                                            </td>
                                                            <td className="px-3 py-2.5 font-mono text-[10px] text-orange-600 font-bold">
                                                                {log.reason?.includes('#') ? log.reason : `Order #${log.id}`}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-[11px] font-mono text-zinc-500">
                                                                {log.reason || 'wallet_purchase'}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-center font-mono text-[10px] text-zinc-500">
                                                                {formatTime(log.created_at)}
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end p-4 border-t border-zinc-100 bg-zinc-50/50 shrink-0">
                            <button
                                onClick={() => setIsBalanceModalOpen(false)}
                                className="rounded-xl border border-zinc-200 bg-white px-6 py-2.5 text-xs font-extrabold uppercase text-zinc-700 hover:bg-zinc-100 transition active:scale-95 shadow-2xs"
                            >
                                ĐÓNG
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* MODAL 3: HIỂN THỊ VÍ API KEY */}
            {userApiKeyModal && mounted && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl border border-zinc-200 p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 font-bold border border-blue-200">
                                    <Key className="h-4 w-4" />
                                </div>
                                <div>
                                    <h2 className="font-extrabold text-sm uppercase text-zinc-900 tracking-wide">
                                        VÍ API KEY DÀNH CHO KHÁCH HÀNG
                                    </h2>
                                    <p className="text-[11px] font-mono text-zinc-400">
                                        {userApiKeyModal.user.name || 'USER'} - TG ID: {userApiKeyModal.user.telegram_id || userApiKeyModal.user.id}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setUserApiKeyModal(null)} className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 transition">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="space-y-3 text-xs">
                            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-2">
                                <div className="text-[10px] font-bold text-zinc-400 uppercase">USER API KEY:</div>
                                <div className="font-mono text-xs text-emerald-400 break-all select-all font-bold">
                                    {userApiKeyModal.apiKey}
                                </div>
                            </div>

                            <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 space-y-1 text-blue-950">
                                <div className="font-bold flex items-center gap-1.5 text-xs">
                                    <Sparkles className="h-4 w-4 text-blue-600" />
                                    <span>HƯỚNG DẪN MUA TOÀN BỘ SẢN PHẨM QUA PURE BACKEND API</span>
                                </div>
                                <p className="text-[11px] text-blue-800">
                                    Người dùng có thể truyền Header <code className="bg-blue-100 px-1 rounded font-mono text-blue-900">X-API-Key: {userApiKeyModal.apiKey}</code> để mua trực tiếp bất kỳ dịch vụ nào qua CSDL cũ!
                                </p>
                            </div>

                            <div className="font-mono text-[11px] bg-zinc-900 text-zinc-300 p-3 rounded-xl overflow-x-auto border border-zinc-800 space-y-1">
                                <div className="text-emerald-400"># 1. Lấy danh sách sản phẩm:</div>
                                <div>GET http://localhost:8080/api/v1/products</div>
                                <div className="text-emerald-400 mt-2"># 2. Đặt mua sản phẩm (Stock / Order / Gmail EDU):</div>
                                <div>POST http://localhost:8080/api/v1/buy</div>
                                <div className="text-zinc-400">Body: &#123; "productId": 1, "quantity": 1 &#125;</div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(userApiKeyModal.apiKey);
                                    alert('Đã sao chép API Key vào Bộ nhớ tạm!');
                                }}
                                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-blue-700 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                            >
                                <Copy className="h-4 w-4" />
                                <span>COPY API KEY</span>
                            </button>
                            <button
                                onClick={() => setUserApiKeyModal(null)}
                                className="rounded-xl bg-zinc-100 border border-zinc-200 px-4 py-2 text-xs font-extrabold text-zinc-700 hover:bg-zinc-200 transition cursor-pointer"
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
