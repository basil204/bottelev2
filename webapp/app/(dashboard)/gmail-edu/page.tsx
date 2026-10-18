'use client';

import { useState, useEffect } from 'react';
import {
    GraduationCap, Plus, RefreshCw, Trash2, Search, Filter, Download,
    Copy, CheckCircle2, AlertCircle, Eye, EyeOff, ShieldCheck, Settings2,
    DollarSign, Globe, Layers, Zap, Clock, User, FileText, Check, AlertTriangle,
    Key, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GmailAccount {
    id: number;
    email: string;
    password: string;
    type: string;
    domain: string;
    status: string;
    sold_to_user_id?: number | null;
    sold_price?: number | null;
    order_id?: string | null;
    delete_at?: string | null;
    created_at: string;
    buyer_username?: string | null;
    buyer_name?: string | null;
    buyer_telegram_id?: string | null;
}

interface Stats {
    total_accounts: number;
    total_sold: number;
    total_available: number;
    total_error: number;
    total_revenue: number;
    today_revenue: number;
    today_sold: number;
}

interface Settings {
    price: number;
    domain: string;
    enabled: boolean;
    delete_hours: number;
    password_type: 'random' | 'custom';
    custom_password?: string;
    max_user_limit: number;
    max_order_qty: number;
}

export default function GmailEduManagementPage() {
    const [loading, setLoading] = useState(true);
    const [accounts, setAccounts] = useState<GmailAccount[]>([]);
    const [stats, setStats] = useState<Stats>({
        total_accounts: 0,
        total_sold: 0,
        total_available: 0,
        total_error: 0,
        total_revenue: 0,
        today_revenue: 0,
        today_sold: 0
    });
    const [settings, setSettings] = useState<Settings>({
        price: 10000,
        domain: 'nttp.edu.pl',
        enabled: true,
        delete_hours: 1,
        password_type: 'random',
        custom_password: '',
        max_user_limit: 0,
        max_order_qty: 20
    });
    const [googleApi, setGoogleApi] = useState<{ connected: boolean; error?: string }>({ connected: false });
    const [domains, setDomains] = useState<string[]>([]);
    const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });

    // Filters
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [domainFilter, setDomainFilter] = useState('all');

    // UI States
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [showPasswordMap, setShowPasswordMap] = useState<Record<number, boolean>>({});
    const [copiedMap, setCopiedMap] = useState<Record<string, boolean>>({});
    const [saveSettingsLoading, setSaveSettingsLoading] = useState(false);
    const [testConnectionLoading, setTestConnectionLoading] = useState(false);
    const [statusNotice, setStatusNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Create Modal State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createForm, setCreateForm] = useState({
        quantity: 1,
        prefix: '',
        password: '',
        domain: '',
        status: 'available'
    });
    const [createLoading, setCreateLoading] = useState(false);
    const [createResult, setCreateResult] = useState<{ createdCount: number; accounts: any[]; failed: any[] } | null>(null);

    // Delete Modal State
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteTargetIds, setDeleteTargetIds] = useState<number[]>([]);
    const [deleteFromGoogleWorkspace, setDeleteFromGoogleWorkspace] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const showNotice = (type: 'success' | 'error', message: string) => {
        setStatusNotice({ type, message });
        setTimeout(() => setStatusNotice(null), 5000);
    };

    const fetchAccounts = async (page = 1) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: String(pagination.limit),
                search: search.trim(),
                status: statusFilter,
                domain: domainFilter
            });
            const res = await fetch(`/api/gmail-edu?${params.toString()}`);
            const data = await res.json();
            if (data.success) {
                setAccounts(data.accounts || []);
                setStats(data.stats || {});
                setSettings(data.settings || {});
                setGoogleApi(data.googleApi || { connected: false });
                setDomains(data.domains || []);
                setPagination(data.pagination || { total: 0, page: 1, limit: 20, totalPages: 1 });
                if (!createForm.domain && data.settings?.domain) {
                    setCreateForm((prev) => ({ ...prev, domain: data.settings.domain }));
                }
            } else {
                showNotice('error', data.error || 'Lỗi tải dữ liệu Gmail EDU');
            }
        } catch (e: any) {
            showNotice('error', e.message || 'Lỗi kết nối máy chủ');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAccounts(1);
    }, [statusFilter, domainFilter]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        fetchAccounts(1);
    };

    const handleSaveSettings = async () => {
        setSaveSettingsLoading(true);
        try {
            const res = await fetch('/api/gmail-edu', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'settings',
                    ...settings
                })
            });
            const data = await res.json();
            if (data.success) {
                showNotice('success', 'Đã lưu cài đặt Gmail EDU thành công!');
                fetchAccounts(pagination.page);
            } else {
                showNotice('error', data.error || 'Lỗi lưu cài đặt');
            }
        } catch (e: any) {
            showNotice('error', e.message);
        } finally {
            setSaveSettingsLoading(false);
        }
    };

    const handleTestConnection = async () => {
        setTestConnectionLoading(true);
        try {
            const res = await fetch('/api/gmail-edu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'test_connection' })
            });
            const data = await res.json();
            if (data.success) {
                showNotice('success', data.message || 'Kết nối Google Workspace Admin API thành công!');
                setGoogleApi({ connected: true });
            } else {
                showNotice('error', data.error || 'Kết nối thất bại');
                setGoogleApi({ connected: false, error: data.error });
            }
        } catch (e: any) {
            showNotice('error', e.message);
        } finally {
            setTestConnectionLoading(false);
        }
    };

    const handleCreateAccounts = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateLoading(true);
        setCreateResult(null);
        try {
            const res = await fetch('/api/gmail-edu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    quantity: createForm.quantity,
                    prefix: createForm.prefix,
                    password: createForm.password || null,
                    domain: createForm.domain || settings.domain,
                    status: createForm.status
                })
            });
            const data = await res.json();
            if (data.success) {
                setCreateResult(data);
                showNotice('success', `Tạo thành công ${data.createdCount} tài khoản Gmail EDU!`);
                fetchAccounts(1);
            } else {
                showNotice('error', data.error || 'Không thể tạo tài khoản');
            }
        } catch (e: any) {
            showNotice('error', e.message);
        } finally {
            setCreateLoading(false);
        }
    };

    const confirmDelete = (ids: number[]) => {
        setDeleteTargetIds(ids);
        setDeleteModalOpen(true);
    };

    const handleExecuteDelete = async () => {
        if (!deleteTargetIds.length) return;
        setDeleteLoading(true);
        try {
            const res = await fetch(`/api/gmail-edu?delete_from_google=${deleteFromGoogleWorkspace}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: deleteTargetIds })
            });
            const data = await res.json();
            if (data.success) {
                showNotice('success', data.message || 'Đã xóa tài khoản thành công!');
                setDeleteModalOpen(false);
                setSelectedIds([]);
                fetchAccounts(pagination.page);
            } else {
                showNotice('error', data.error || 'Lỗi khi xóa');
            }
        } catch (e: any) {
            showNotice('error', e.message);
        } finally {
            setDeleteLoading(false);
        }
    };

    const copyToClipboard = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopiedMap((prev) => ({ ...prev, [key]: true }));
        setTimeout(() => {
            setCopiedMap((prev) => ({ ...prev, [key]: false }));
        }, 2000);
    };

    const handleExportTxt = () => {
        if (!accounts.length) return;
        const lines = accounts.map((a) => `${a.email}|${a.password}`).join('\n');
        const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `gmail_edu_export_${new Date().toISOString().slice(0, 10)}.txt`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(accounts.map((a) => a.id));
        } else {
            setSelectedIds([]);
        }
    };

    const toggleSelectId = (id: number) => {
        setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
    };

    return (
        <div className="space-y-6 pb-12">
            {/* Header Title */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200/80 dark:border-zinc-800 pb-5">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-600 to-orange-500 text-white shadow-lg shadow-orange-500/20">
                        <GraduationCap size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black tracking-tight text-zinc-900 dark:text-white uppercase flex items-center gap-2">
                            Quản Lý Gmail EDU Tự Động
                            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                Google Workspace SDK
                            </span>
                        </h1>
                        <p className="text-xs font-medium text-zinc-500">
                            Khởi tạo, cấp phát tài khoản học sinh/sinh viên & theo dõi doanh thu Gmail EDU tự động
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchAccounts(pagination.page)}
                        disabled={loading}
                        className="gap-2 font-bold cursor-pointer"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        Làm mới
                    </Button>
                    <Button
                        onClick={() => {
                            setCreateResult(null);
                            setShowCreateModal(true);
                        }}
                        className="gap-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-extrabold shadow-md shadow-orange-500/20 cursor-pointer"
                    >
                        <Plus size={16} />
                        Tạo Gmail EDU
                    </Button>
                </div>
            </div>

            {/* Notification Alert */}
            {statusNotice && (
                <div className={`p-4 rounded-xl flex items-center gap-3 border shadow-xs animate-in fade-in ${
                    statusNotice.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                        : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300'
                }`}>
                    {statusNotice.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    <span className="text-sm font-semibold">{statusNotice.message}</span>
                </div>
            )}

            {/* Stats Overview */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
                    <div className="flex items-center justify-between text-zinc-500 mb-1">
                        <span className="text-xs font-bold uppercase">Tổng đã tạo</span>
                        <Layers size={16} className="text-blue-500" />
                    </div>
                    <div className="text-xl font-black text-zinc-900 dark:text-white">
                        {stats.total_accounts?.toLocaleString('vi-VN') || 0}
                    </div>
                    <span className="text-[11px] text-zinc-400 font-medium">Tài khoản trong kho</span>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
                    <div className="flex items-center justify-between text-zinc-500 mb-1">
                        <span className="text-xs font-bold uppercase">Đã bán</span>
                        <CheckCircle2 size={16} className="text-emerald-500" />
                    </div>
                    <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                        {stats.total_sold?.toLocaleString('vi-VN') || 0}
                    </div>
                    <span className="text-[11px] text-zinc-400 font-medium">Đã giao khách</span>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
                    <div className="flex items-center justify-between text-zinc-500 mb-1">
                        <span className="text-xs font-bold uppercase">Sẵn sàng bán</span>
                        <Zap size={16} className="text-amber-500" />
                    </div>
                    <div className="text-xl font-black text-amber-600 dark:text-amber-400">
                        {stats.total_available?.toLocaleString('vi-VN') || 0}
                    </div>
                    <span className="text-[11px] text-zinc-400 font-medium">Chưa sử dụng</span>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
                    <div className="flex items-center justify-between text-zinc-500 mb-1">
                        <span className="text-xs font-bold uppercase">Bán hôm nay</span>
                        <Clock size={16} className="text-purple-500" />
                    </div>
                    <div className="text-xl font-black text-purple-600 dark:text-purple-400">
                        {stats.today_sold?.toLocaleString('vi-VN') || 0}
                    </div>
                    <span className="text-[11px] text-zinc-400 font-medium">Giao dịch trong ngày</span>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
                    <div className="flex items-center justify-between text-zinc-500 mb-1">
                        <span className="text-xs font-bold uppercase">Doanh thu ngày</span>
                        <DollarSign size={16} className="text-emerald-500" />
                    </div>
                    <div className="text-lg font-black text-zinc-900 dark:text-white truncate">
                        {Number(stats.today_revenue || 0).toLocaleString('vi-VN')} ₫
                    </div>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">Hôm nay</span>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 dark:from-zinc-900 dark:to-orange-950/20 border border-orange-200 dark:border-orange-800/40 shadow-xs">
                    <div className="flex items-center justify-between text-orange-700 dark:text-orange-400 mb-1">
                        <span className="text-xs font-bold uppercase">Tổng Doanh Thu</span>
                        <DollarSign size={16} />
                    </div>
                    <div className="text-lg font-black text-orange-600 dark:text-orange-400 truncate">
                        {Number(stats.total_revenue || 0).toLocaleString('vi-VN')} ₫
                    </div>
                    <span className="text-[11px] text-zinc-500 font-medium">Tất cả thời gian</span>
                </div>
            </div>

            {/* Configuration & Google API Status */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Configuration Form */}
                <div className="lg:col-span-2 p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                        <div className="flex items-center gap-2">
                            <Settings2 size={18} className="text-orange-600" />
                            <h2 className="text-sm font-extrabold uppercase text-zinc-900 dark:text-white">
                                Cài Đặt Giá & Cấu Hình Gmail EDU
                            </h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={settings.enabled}
                                    onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-hidden rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-orange-600"></div>
                            </label>
                            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                                {settings.enabled ? 'Đang Bật Bán' : 'Tạm Khóa Bán'}
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
                                Đơn Giá Bán (VNĐ / acc)
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="1000"
                                value={settings.price}
                                onChange={(e) => setSettings({ ...settings, price: Number(e.target.value) || 0 })}
                                className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-bold text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                                placeholder="10000"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
                                Domain EDU Mặc Định
                            </label>
                            <input
                                type="text"
                                value={settings.domain}
                                onChange={(e) => setSettings({ ...settings, domain: e.target.value.trim() })}
                                className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-bold text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                                placeholder="nttp.edu.pl"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
                                Hạn Xóa Tự Động (Giờ)
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="720"
                                value={settings.delete_hours}
                                onChange={(e) => setSettings({ ...settings, delete_hours: Number(e.target.value) || 0 })}
                                className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-bold text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                                placeholder="1 (0 là không xóa)"
                            />
                            <p className="text-[11px] text-zinc-400">Chỉ tính giờ sau khi khách đăng nhập Google lần đầu</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-1 border-t border-zinc-100 dark:border-zinc-800/60">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
                                Chế Độ Mật Khẩu
                            </label>
                            <select
                                value={settings.password_type || 'random'}
                                onChange={(e) => setSettings({ ...settings, password_type: e.target.value as any })}
                                className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-bold text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                            >
                                <option value="random">🎲 Ngẫu nhiên bảo mật</option>
                                <option value="custom">🔒 Mật khẩu cố định</option>
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
                                Mật Khẩu Cố Định (Nếu chọn)
                            </label>
                            <input
                                type="text"
                                disabled={settings.password_type !== 'custom'}
                                value={settings.custom_password || ''}
                                onChange={(e) => setSettings({ ...settings, custom_password: e.target.value })}
                                className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-bold text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
                                placeholder="Tối thiểu 8 ký tự"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
                                Tối Đa / 1 Đơn Mua
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="100"
                                value={settings.max_order_qty || 20}
                                onChange={(e) => setSettings({ ...settings, max_order_qty: Number(e.target.value) || 20 })}
                                className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-bold text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                                placeholder="20"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
                                Giới Hạn / User (Toàn hệ thống)
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={settings.max_user_limit || 0}
                                onChange={(e) => setSettings({ ...settings, max_user_limit: Number(e.target.value) || 0 })}
                                className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-bold text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                                placeholder="0 = Không giới hạn"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button
                            onClick={handleSaveSettings}
                            disabled={saveSettingsLoading}
                            className="bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 font-extrabold cursor-pointer"
                        >
                            {saveSettingsLoading ? 'Đang lưu...' : 'Lưu Thay Đổi Cấu Hình'}
                        </Button>
                    </div>
                </div>

                {/* Google Workspace API Connection Status Card */}
                <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex flex-col justify-between space-y-4">
                    <div>
                        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3 mb-3">
                            <div className="flex items-center gap-2">
                                <Globe size={18} className="text-blue-500" />
                                <h3 className="text-sm font-extrabold uppercase text-zinc-900 dark:text-white">
                                    Google Workspace SDK
                                </h3>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 ${
                                googleApi.connected
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                            }`}>
                                {googleApi.connected ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                                {googleApi.connected ? 'Kết nối OK' : 'Chưa kết nối'}
                            </span>
                        </div>

                        <p className="text-xs text-zinc-500 leading-relaxed">
                            {googleApi.connected
                                ? 'Hệ thống đã nhận diện token và sẵn sàng gửi lệnh tạo/xóa tài khoản qua Google Admin SDK Directory v1.'
                                : `Chưa kết nối: ${googleApi.error || 'Vui lòng kiểm tra file client_secret.json & token.json trong database/google/'}`}
                        </p>
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleTestConnection}
                        disabled={testConnectionLoading}
                        className="w-full font-bold cursor-pointer gap-2 border-zinc-300 dark:border-zinc-700"
                    >
                        <ShieldCheck size={16} />
                        {testConnectionLoading ? 'Đang kiểm tra kết nối...' : 'Kiểm tra kết nối Google API'}
                    </Button>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs space-y-3">
                <div className="flex flex-col md:flex-row items-center gap-3 justify-between">
                    <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Tìm kiếm theo email, mã đơn hàng, ID người mua..."
                            className="w-full pl-10 pr-24 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                        />
                        <Button
                            type="submit"
                            size="sm"
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 px-3 text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-white cursor-pointer"
                        >
                            Tìm
                        </Button>
                    </form>

                    <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
                        {/* Status Filter */}
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold cursor-pointer focus:outline-hidden"
                        >
                            <option value="all">Tất cả trạng thái</option>
                            <option value="available">Sẵn sàng / Chưa bán</option>
                            <option value="sold">Đã bán</option>
                            <option value="error">Lỗi / Hỏng</option>
                        </select>

                        {/* Domain Filter */}
                        <select
                            value={domainFilter}
                            onChange={(e) => setDomainFilter(e.target.value)}
                            className="px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold cursor-pointer focus:outline-hidden"
                        >
                            <option value="all">Tất cả domain</option>
                            {domains.map((d) => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>

                        {/* Export Button */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExportTxt}
                            className="text-xs font-bold gap-1.5 cursor-pointer"
                            title="Xuất file Email|Pass"
                        >
                            <Download size={14} />
                            Xuất TXT
                        </Button>

                        {/* Bulk Delete Button */}
                        {selectedIds.length > 0 && (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => confirmDelete(selectedIds)}
                                className="text-xs font-extrabold gap-1.5 cursor-pointer animate-in fade-in"
                            >
                                <Trash2 size={14} />
                                Xóa {selectedIds.length} mục
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Accounts Table */}
            <div className="overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-zinc-600 dark:text-zinc-400">
                        <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-[11px] font-black uppercase text-zinc-500 border-b border-zinc-200/80 dark:border-zinc-800 tracking-wider">
                            <tr>
                                <th className="p-3.5 w-10 text-center">
                                    <input
                                        type="checkbox"
                                        checked={accounts.length > 0 && selectedIds.length === accounts.length}
                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                        className="rounded-sm border-zinc-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                                    />
                                </th>
                                <th className="py-3.5 px-3">Email Gmail EDU</th>
                                <th className="py-3.5 px-3">Mật Khẩu</th>
                                <th className="py-3.5 px-3">Domain</th>
                                <th className="py-3.5 px-3">Trạng Thái</th>
                                <th className="py-3.5 px-3">Người Mua</th>
                                <th className="py-3.5 px-3">Mã Đơn</th>
                                <th className="py-3.5 px-3">Giá Bán</th>
                                <th className="py-3.5 px-3">Ngày Tạo</th>
                                <th className="py-3.5 px-3 text-right">Thao Tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800 font-medium">
                            {loading ? (
                                <tr>
                                    <td colSpan={10} className="py-12 text-center text-zinc-400 font-semibold">
                                        <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-orange-500" />
                                        Đang tải danh sách Gmail EDU...
                                    </td>
                                </tr>
                            ) : accounts.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="py-12 text-center text-zinc-400 font-semibold">
                                        <GraduationCap size={32} className="mx-auto mb-2 text-zinc-300 dark:text-zinc-700" />
                                        Chưa có tài khoản Gmail EDU nào phù hợp.
                                    </td>
                                </tr>
                            ) : (
                                accounts.map((acc) => {
                                    const isSold = acc.status === 'sold';
                                    const showPass = showPasswordMap[acc.id] || false;
                                    const isSelected = selectedIds.includes(acc.id);

                                    return (
                                        <tr
                                            key={acc.id}
                                            className={`hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors ${
                                                isSelected ? 'bg-orange-50/50 dark:bg-orange-950/20' : ''
                                            }`}
                                        >
                                            <td className="p-3.5 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelectId(acc.id)}
                                                    className="rounded-sm border-zinc-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                                                />
                                            </td>

                                            {/* Email Column */}
                                            <td className="py-3.5 px-3 font-bold text-zinc-900 dark:text-white">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono">{acc.email}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => copyToClipboard(acc.email, `email_${acc.id}`)}
                                                        className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                                                        title="Copy Email"
                                                    >
                                                        {copiedMap[`email_${acc.id}`] ? (
                                                            <Check size={13} className="text-emerald-500" />
                                                        ) : (
                                                            <Copy size={13} />
                                                        )}
                                                    </button>
                                                </div>
                                            </td>

                                            {/* Password Column */}
                                            <td className="py-3.5 px-3">
                                                <div className="flex items-center gap-1.5 font-mono">
                                                    <span>{showPass ? acc.password : '••••••••••••'}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPasswordMap((prev) => ({ ...prev, [acc.id]: !showPass }))}
                                                        className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                                                        title={showPass ? 'Ẩn' : 'Hiện'}
                                                    >
                                                        {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => copyToClipboard(`${acc.email}|${acc.password}`, `combo_${acc.id}`)}
                                                        className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                                                        title="Copy Email|Password"
                                                    >
                                                        {copiedMap[`combo_${acc.id}`] ? (
                                                            <Check size={13} className="text-emerald-500" />
                                                        ) : (
                                                            <Copy size={13} />
                                                        )}
                                                    </button>
                                                </div>
                                            </td>

                                            {/* Domain */}
                                            <td className="py-3.5 px-3">
                                                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                                                    {acc.domain || 'nttp.edu.pl'}
                                                </span>
                                            </td>

                                            {/* Status */}
                                            <td className="py-3.5 px-3">
                                                {isSold ? (
                                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                                        Đã Bán
                                                    </span>
                                                ) : acc.status === 'error' ? (
                                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
                                                        Lỗi
                                                    </span>
                                                ) : (
                                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                                                        Sẵn Sàng
                                                    </span>
                                                )}
                                            </td>

                                            {/* Buyer */}
                                            <td className="py-3.5 px-3">
                                                {acc.sold_to_user_id ? (
                                                    <div className="flex flex-col text-[11px]">
                                                        <span className="font-bold text-zinc-800 dark:text-zinc-200">
                                                            {acc.buyer_username ? `@${acc.buyer_username}` : acc.buyer_name || `ID: ${acc.sold_to_user_id}`}
                                                        </span>
                                                        <span className="text-zinc-400 text-[10px]">
                                                            Telegram: {acc.buyer_telegram_id || acc.sold_to_user_id}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-zinc-400 italic text-[11px]">-</span>
                                                )}
                                            </td>

                                            {/* Order Code */}
                                            <td className="py-3.5 px-3 font-mono text-[11px]">
                                                {acc.order_id ? (
                                                    <span className="text-orange-600 dark:text-orange-400 font-bold">
                                                        {acc.order_id}
                                                    </span>
                                                ) : (
                                                    <span className="text-zinc-400">-</span>
                                                )}
                                            </td>

                                            {/* Price */}
                                            <td className="py-3.5 px-3 font-bold text-zinc-900 dark:text-white">
                                                {acc.sold_price ? `${Number(acc.sold_price).toLocaleString('vi-VN')} ₫` : '-'}
                                            </td>

                                            {/* Created At */}
                                            <td className="py-3.5 px-3 text-zinc-400 text-[11px]">
                                                {acc.created_at ? new Date(acc.created_at).toLocaleString('vi-VN') : '-'}
                                            </td>

                                            {/* Actions */}
                                            <td className="py-3.5 px-3 text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => confirmDelete([acc.id])}
                                                    className="h-7 w-7 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                                                    title="Xóa tài khoản"
                                                >
                                                    <Trash2 size={14} />
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t border-zinc-200/80 dark:border-zinc-800 text-xs font-semibold">
                        <span className="text-zinc-500">
                            Hiển thị {accounts.length} / {pagination.total} tài khoản
                        </span>
                        <div className="flex items-center gap-1.5">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={pagination.page <= 1}
                                onClick={() => fetchAccounts(pagination.page - 1)}
                                className="h-8 px-3 cursor-pointer"
                            >
                                Trước
                            </Button>
                            <span className="px-3 py-1 font-bold text-zinc-900 dark:text-white">
                                Trang {pagination.page} / {pagination.totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={pagination.page >= pagination.totalPages}
                                onClick={() => fetchAccounts(pagination.page + 1)}
                                className="h-8 px-3 cursor-pointer"
                            >
                                Sau
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Tạo Gmail EDU Mới */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in">
                    <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xl space-y-5">
                        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                            <div className="flex items-center gap-2">
                                <GraduationCap size={20} className="text-orange-600" />
                                <h3 className="text-base font-black uppercase text-zinc-900 dark:text-white">
                                    Tạo Tài Khoản Gmail EDU Trực Tiếp
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowCreateModal(false)}
                                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer font-bold text-lg"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleCreateAccounts} className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                                        Số Lượng Muốn Tạo (1 - 50)
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="50"
                                        required
                                        value={createForm.quantity}
                                        onChange={(e) => setCreateForm({ ...createForm, quantity: Number(e.target.value) || 1 })}
                                        className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-bold"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                                        Domain EDU
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={createForm.domain}
                                        onChange={(e) => setCreateForm({ ...createForm, domain: e.target.value.trim() })}
                                        className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-bold"
                                        placeholder="nttp.edu.pl"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                                    Tiền Tố Prefix (Tùy chọn)
                                </label>
                                <input
                                    type="text"
                                    value={createForm.prefix}
                                    onChange={(e) => setCreateForm({ ...createForm, prefix: e.target.value })}
                                    placeholder="VD: sinhvien (sẽ tạo sinhvien123@domain)"
                                    className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                                    Mật Khẩu Cố Định (Để trống nếu muốn tự sinh ngẫu nhiên mạnh)
                                </label>
                                <input
                                    type="text"
                                    value={createForm.password}
                                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                                    placeholder="Mật khẩu tối thiểu 8 ký tự..."
                                    className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-mono"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                                    Trạng Thái Ban Đầu
                                </label>
                                <select
                                    value={createForm.status}
                                    onChange={(e) => setCreateForm({ ...createForm, status: e.target.value })}
                                    className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-semibold cursor-pointer"
                                >
                                    <option value="available">Sẵn sàng bán (Kho chung)</option>
                                    <option value="sold">Đánh dấu đã bán</option>
                                </select>
                            </div>

                            {/* Create Result Log */}
                            {createResult && (
                                <div className="p-3.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 space-y-2 text-xs">
                                    <div className="font-extrabold text-emerald-600 dark:text-emerald-400">
                                        ✓ Đã tạo thành công: {createResult.createdCount} tài khoản
                                    </div>
                                    {createResult.accounts?.length > 0 && (
                                        <div className="font-mono max-h-32 overflow-y-auto space-y-1 p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[11px]">
                                            {createResult.accounts.map((acc, idx) => (
                                                <div key={idx}>{acc.email}|{acc.password}</div>
                                            ))}
                                        </div>
                                    )}
                                    {createResult.failed?.length > 0 && (
                                        <div className="text-red-600 dark:text-red-400 font-bold">
                                            ⚠️ Thất bại {createResult.failed.length} tài khoản: {createResult.failed[0]?.error}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setShowCreateModal(false)}
                                    className="cursor-pointer"
                                >
                                    Đóng
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={createLoading}
                                    className="bg-gradient-to-r from-orange-600 to-amber-600 text-white font-extrabold cursor-pointer shadow-md shadow-orange-500/20"
                                >
                                    {createLoading ? (
                                        <span className="flex items-center gap-2">
                                            <RefreshCw size={14} className="animate-spin" />
                                            Đang gọi Google SDK...
                                        </span>
                                    ) : (
                                        `Tạo ${createForm.quantity} Tài Khoản`
                                    )}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Xác Nhận Xóa */}
            {deleteModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in">
                    <div className="w-full max-w-md rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xl space-y-4">
                        <div className="flex items-center gap-3 text-red-600">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-950">
                                <Trash2 size={20} />
                            </div>
                            <h3 className="text-base font-black uppercase text-zinc-900 dark:text-white">
                                Xác Nhận Xóa Tài Khoản
                            </h3>
                        </div>

                        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                            Bạn có chắc chắn muốn xóa <b>{deleteTargetIds.length}</b> tài khoản Gmail EDU đã chọn khỏi hệ thống cơ sở dữ liệu?
                        </p>

                        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2">
                            <label className="flex items-start gap-2.5 cursor-pointer text-xs font-bold text-amber-900 dark:text-amber-300">
                                <input
                                    type="checkbox"
                                    checked={deleteFromGoogleWorkspace}
                                    onChange={(e) => setDeleteFromGoogleWorkspace(e.target.checked)}
                                    className="mt-0.5 rounded-sm border-amber-400 text-orange-600 focus:ring-orange-500"
                                />
                                <span>Đồng thời xóa tài khoản trên Google Workspace Admin (Không thể khôi phục)</span>
                            </label>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <Button
                                variant="outline"
                                onClick={() => setDeleteModalOpen(false)}
                                disabled={deleteLoading}
                                className="cursor-pointer font-bold"
                            >
                                Hủy
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={handleExecuteDelete}
                                disabled={deleteLoading}
                                className="font-extrabold cursor-pointer"
                            >
                                {deleteLoading ? 'Đang xóa...' : 'Xác Nhận Xóa'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
