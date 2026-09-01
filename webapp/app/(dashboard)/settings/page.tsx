'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    Save, Settings as SettingsIcon, Banknote, CreditCard, Trash2, Power, Download,
    DatabaseBackup, ShieldCheck, RefreshCw, Key, User, Globe, Bot, Bell,
    Sparkles, CheckCircle2, AlertCircle, Plus, Eye, EyeOff, Terminal, Zap, Layers, Lock, Languages,
    CloudUpload, FileText, ExternalLink
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface SystemSettings {
    mb_auto_deposit: boolean;
    viettel_token: string;
    viettel_account: string;
    vcb_token: string;
    vcb_account: string;
    tpb_token: string;
    tpb_account: string;
    mb_token: string;
    mb_account: string;
    acb_token: string;
    acb_account: string;
    tcb_token: string;
    tcb_account: string;
    vp_token: string;
    vp_account: string;
    timo_token: string;
    timo_account: string;
    vietqr_bank_code: string;
    vietqr_account_no: string;
    vietqr_account_name: string;
    active_bank: string;
    min_deposit: number;
    exchange_rate: number;
    telegram_bot_token: string;
    shop_name: string;
    usdt_trc20_wallet: string;
    telegram_group_link: string;
    // Gmail EDU
    gmail_edu_enabled: boolean;
    gmail_edu_price: number;
    gmail_edu_domain: string;
    gmail_edu_delete_hours: number;
    // Canva & Netflix Auto Services
    canva_enabled?: boolean;
    netflix_enabled?: boolean;
    // Admin IDs
    admin_ids: number[];
    // Admin Accounts
    admin_fullname?: string;
    admin_username?: string;
    admin_password?: string;
    admin_fullname2?: string;
    admin_username2?: string;
    admin_password2?: string;
    gmail_checker_api_keys: string[];
    deposit_rank_promotions: { name: string; min_total: number; bonus_percentage: number }[];
    // Auto workflows
    auto_approve_orders?: boolean;
    auto_warranty_replace?: boolean;
    auto_notify_deposit?: boolean;
    auto_block_spam_ip?: boolean;
}

export default function SettingsPage() {
    const { t } = useLanguage();
    const [settings, setSettings] = useState<SystemSettings>({
        mb_auto_deposit: true,
        viettel_token: '',
        viettel_account: '',
        vcb_token: '',
        vcb_account: '',
        tpb_token: '',
        tpb_account: '',
        mb_token: '',
        mb_account: '',
        acb_token: '',
        acb_account: '',
        tcb_token: '',
        tcb_account: '',
        vp_token: '',
        vp_account: '',
        timo_token: '',
        timo_account: '',
        vietqr_bank_code: 'VCB',
        vietqr_account_no: '',
        vietqr_account_name: '',
        active_bank: 'vcb',
        min_deposit: 50000,
        exchange_rate: 26000,
        telegram_bot_token: '',
        shop_name: 'DUCVIETSTORE',
        usdt_trc20_wallet: '',
        telegram_group_link: '',
        gmail_edu_enabled: true,
        gmail_edu_price: 10000,
        gmail_edu_domain: 'suafpoly.app',
        gmail_edu_delete_hours: 1,
        canva_enabled: true,
        netflix_enabled: true,
        admin_ids: [],
        admin_username: 'admin',
        admin_password: '',
        admin_username2: 'admin2',
        admin_password2: '',
        gmail_checker_api_keys: [],
        deposit_rank_promotions: [],
        auto_approve_orders: true,
        auto_warranty_replace: true,
        auto_notify_deposit: true,
        auto_block_spam_ip: true
    });

    const [activeTab, setActiveTab] = useState<'general' | 'workflows' | 'deposit' | 'gmail' | 'admin' | 'backup'>('general');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [exportingSql, setExportingSql] = useState(false);
    const [showToken, setShowToken] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [newAdminId, setNewAdminId] = useState('');
    const [newApiKey, setNewApiKey] = useState('');
    const [configuringBank, setConfiguringBank] = useState<string>('vcb');
    const [adminRole, setAdminRole] = useState<string>('admin');

    // Google Drive Backup State
    const [driveFolderId, setDriveFolderId] = useState('');
    const [autoBackupEnabled, setAutoBackupEnabled] = useState(true);
    const [autoBackupInterval, setAutoBackupInterval] = useState('24h');
    const [driveClientId, setDriveClientId] = useState('');
    const [driveClientSecret, setDriveClientSecret] = useState('');
    const [driveRefreshToken, setDriveRefreshToken] = useState('');
    const [isDriveConnected, setIsDriveConnected] = useState(false);
    const [backupHistory, setBackupHistory] = useState<any[]>([]);
    const [loadingDriveBackup, setLoadingDriveBackup] = useState(false);
    const [creatingBackup, setCreatingBackup] = useState(false);
    const [savingDriveConfig, setSavingDriveConfig] = useState(false);
    const [uploadingJson, setUploadingJson] = useState(false);

    const handleUploadJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingJson(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            const jsonText = event.target?.result as string;
            try {
                const res = await fetch('/api/backup/drive', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'upload_json',
                        jsonContent: jsonText
                    })
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    alert(data.message || 'Đã nhập file JSON thành công!');
                    fetchBackupData();
                } else {
                    alert(data.error || 'Lỗi đọc file JSON');
                }
            } catch (err) {
                alert('Lỗi xử lý file JSON');
            } finally {
                setUploadingJson(false);
            }
        };
        reader.readAsText(file);
    };

    const fetchBackupData = async () => {
        setLoadingDriveBackup(true);
        try {
            const res = await fetch('/api/backup/drive');
            if (res.ok) {
                const data = await res.json();
                setIsDriveConnected(Boolean(data.isDriveConnected));
                if (data.config) {
                    setDriveFolderId(data.config.google_drive_folder_id || '');
                    setAutoBackupEnabled(Boolean(data.config.auto_backup_enabled));
                    setAutoBackupInterval(data.config.auto_backup_interval || '24h');
                    setDriveClientId(data.config.google_drive_client_id || '');
                    setDriveClientSecret(data.config.google_drive_client_secret || '');
                    setDriveRefreshToken(data.config.google_drive_refresh_token || '');
                }
                if (Array.isArray(data.history)) {
                    setBackupHistory(data.history);
                }
            }
        } catch (e) {
            console.error('Fetch backup error:', e);
        } finally {
            setLoadingDriveBackup(false);
        }
    };

    const handleSaveDriveConfig = async () => {
        setSavingDriveConfig(true);
        try {
            const res = await fetch('/api/backup/drive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'save_config',
                    folderId: driveFolderId.trim(),
                    autoEnabled: autoBackupEnabled,
                    autoInterval: autoBackupInterval,
                    clientId: driveClientId.trim(),
                    clientSecret: driveClientSecret.trim(),
                    refreshToken: driveRefreshToken.trim()
                })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                alert('Đã lưu cấu hình tự động sao lưu Google Drive thành công!');
                fetchBackupData();
            } else {
                alert(data.error || 'Lỗi lưu cấu hình Google Drive');
            }
        } catch (e) {
            alert('Lỗi kết nối máy chủ');
        } finally {
            setSavingDriveConfig(false);
        }
    };

    const handleCreateBackupNow = async () => {
        setCreatingBackup(true);
        try {
            const res = await fetch('/api/backup/drive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create_backup',
                    folderId: driveFolderId.trim(),
                    clientId: driveClientId.trim(),
                    clientSecret: driveClientSecret.trim(),
                    refreshToken: driveRefreshToken.trim()
                })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                alert(data.message || 'Đã sao lưu thành công!');
                fetchBackupData();
            } else {
                alert(data.error || 'Lỗi khi tạo bản sao lưu');
            }
        } catch (e) {
            alert('Lỗi kết nối máy chủ khi sao lưu');
        } finally {
            setCreatingBackup(false);
        }
    };

    const handleDeleteBackup = async (fileName: string) => {
        if (!confirm(`Xác nhận xóa bản sao lưu ${fileName}?`)) return;
        try {
            const res = await fetch('/api/backup/drive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'delete_backup',
                    fileName
                })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                fetchBackupData();
            } else {
                alert(data.error || 'Lỗi xóa bản sao lưu');
            }
        } catch (e) {
            alert('Lỗi kết nối máy chủ');
        }
    };

    useEffect(() => {
        fetchSettings();
        fetchBackupData();
        // Check admin role from cookie
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'admin_role') {
                setAdminRole(value);
                break;
            }
        }
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/settings');
            if (res.ok) {
                const data = await res.json();
                setSettings(prev => ({ ...prev, ...data }));
            }
        } catch (e) {
            console.error('Fetch settings error:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = (key: keyof SystemSettings) => {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleChange = (key: keyof SystemSettings, val: any) => {
        setSettings(prev => ({ ...prev, [key]: val }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });

            if (res.ok) {
                alert('Đã lưu cấu hình hệ thống thành công!');
            } else {
                alert('Lỗi lưu cấu hình hệ thống!');
            }
        } catch (e) {
            alert('Lỗi kết nối máy chủ!');
        } finally {
            setSaving(false);
        }
    };

    const handleRestartBot = async () => {
        if (!confirm('Xác nhận khởi động lại tiến trình Bot Telegram?')) return;
        setSaving(true);
        try {
            const res = await fetch('/api/restart', { method: 'POST' });
            if (res.ok) {
                alert('Đã gửi lệnh khởi động lại tiến trình Bot!');
            } else {
                alert('Khởi động lại thất bại!');
            }
        } catch (e) {
            alert('Lỗi kết nối máy chủ!');
        } finally {
            setSaving(false);
        }
    };

    const handleExportSql = async () => {
        setExportingSql(true);
        try {
            const res = await fetch('/api/database/export');
            if (res.ok) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `database_backup_${Date.now()}.sql`;
                a.click();
                URL.revokeObjectURL(url);
            } else {
                alert('Không thể tải file sao lưu CSDL SQL!');
            }
        } catch (e) {
            alert('Lỗi kết nối máy chủ!');
        } finally {
            setExportingSql(false);
        }
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(val) + ' đ';
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-2 sm:p-4">
            {/* Top Title & Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600 font-bold border border-orange-200 shadow-2xs">
                        <SettingsIcon className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-zinc-900 flex items-center gap-2">
                            CÀI ĐẶT HỆ THỐNG
                        </h1>
                        <p className="text-xs text-zinc-500 font-medium">
                            Cấu hình các quy trình tự động, tích hợp nạp tiền và hành vi hệ thống
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleRestartBot}
                        className="rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 px-4 py-2.5 text-xs font-extrabold uppercase transition active:scale-95 shadow-2xs flex items-center gap-1.5"
                    >
                        <Power className="h-4 w-4 text-orange-600" />
                        <span>RESTART BOT</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="rounded-xl bg-orange-600 hover:bg-orange-700 text-white px-6 py-2.5 text-xs font-extrabold uppercase transition active:scale-95 shadow-xs flex items-center gap-2 disabled:opacity-50"
                    >
                        <Save className="h-4 w-4" />
                        <span>{saving ? 'ĐANG LƯU...' : '💾 LƯU CẤU HÌNH'}</span>
                    </button>
                </div>
            </div>

            {/* 4 Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">TRẠNG THÁI BOT</span>
                    <div className="text-sm font-black text-emerald-600 mt-1 flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>ĐANG HOẠT ĐỘNG</span>
                    </div>
                </div>

                <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">TỔNG CÀI ĐẶT</span>
                    <div className="text-xl font-black text-zinc-900 mt-1">32 Tham số</div>
                </div>

                <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">NẠP TỰ ĐỘNG</span>
                    <div className="text-sm font-black text-emerald-600 mt-1">
                        {settings.mb_auto_deposit ? '🟢 ĐÃ BẬT' : '🔴 ĐÃ TẮT'}
                    </div>
                </div>

                <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">TỶ GIÁ QUY ĐỔI</span>
                    <div className="text-sm font-black text-orange-600 mt-1 font-mono">
                        {formatCurrency(settings.exchange_rate)} / USDT
                    </div>
                </div>
            </div>

            {/* Navigation Sub-Tabs */}
            <div className="flex items-center gap-2 border-b border-zinc-200 pb-3 flex-wrap">
                <button
                    onClick={() => setActiveTab('general')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition flex items-center gap-2 ${activeTab === 'general' ? 'bg-orange-600 text-white shadow-xs' : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'}`}
                >
                    <SettingsIcon className="h-4 w-4" />
                    <span>CẤU HÌNH CHUNG & BOT</span>
                </button>

                <button
                    onClick={() => setActiveTab('workflows')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition flex items-center gap-2 ${activeTab === 'workflows' ? 'bg-orange-600 text-white shadow-xs' : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'}`}
                >
                    <Zap className="h-4 w-4" />
                    <span>🤖 QUY TRÌNH TỰ ĐỘNG</span>
                </button>

                <button
                    onClick={() => setActiveTab('deposit')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition flex items-center gap-2 ${activeTab === 'deposit' ? 'bg-orange-600 text-white shadow-xs' : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'}`}
                >
                    <Banknote className="h-4 w-4" />
                    <span>💳 NẠP TỰ ĐỘNG & NGÂN HÀNG</span>
                </button>

                <button
                    onClick={() => setActiveTab('gmail')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition flex items-center gap-2 ${activeTab === 'gmail' ? 'bg-orange-600 text-white shadow-xs' : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'}`}
                >
                    <Globe className="h-4 w-4" />
                    <span>📧 GMAIL EDU & CHECKER</span>
                </button>

                <button
                    onClick={() => setActiveTab('admin')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition flex items-center gap-2 ${activeTab === 'admin' ? 'bg-orange-600 text-white shadow-xs' : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'}`}
                >
                    <User className="h-4 w-4" />
                    <span>👑 QUẢN TRỊ VIÊN</span>
                </button>

                {adminRole === 'super_admin' && (
                    <button
                        onClick={() => setActiveTab('backup')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition flex items-center gap-2 ${activeTab === 'backup' ? 'bg-orange-600 text-white shadow-xs' : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'}`}
                    >
                        <DatabaseBackup className="h-4 w-4" />
                        <span>💾 SAO LƯU SQL</span>
                    </button>
                )}
            </div>

            {/* TAB 1: CẤU HÌNH CHUNG & BOT */}
            {activeTab === 'general' && (
                <div className="space-y-5">
                    <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4 shadow-2xs">
                        <div className="border-b border-zinc-100 pb-3">
                            <h2 className="font-extrabold text-xs uppercase text-zinc-800 tracking-wider flex items-center gap-2">
                                <Bot className="h-4 w-4 text-orange-600" />
                                <span>THÔNG TIN SHOP & BOT TELEGRAM</span>
                            </h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div className="space-y-1.5">
                                <label className="font-extrabold uppercase text-zinc-700 text-[11px]">TÊN SHOP (BRAND NAME) *</label>
                                <input
                                    type="text"
                                    value={settings.shop_name}
                                    onChange={(e) => handleChange('shop_name', e.target.value)}
                                    placeholder="DUCVIETSTORE"
                                    className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-extrabold text-zinc-900 outline-none focus:border-orange-500 transition"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="font-extrabold uppercase text-zinc-700 text-[11px]">TELEGRAM BOT TOKEN *</label>
                                <div className="relative">
                                    <input
                                        type={showToken ? 'text' : 'password'}
                                        value={settings.telegram_bot_token}
                                        onChange={(e) => handleChange('telegram_bot_token', e.target.value)}
                                        placeholder="123456789:ABCdefGHIjklMNO..."
                                        className="w-full rounded-xl border border-zinc-200 bg-white pl-3 pr-10 py-3 font-mono text-zinc-900 outline-none focus:border-orange-500 transition text-xs"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowToken(!showToken)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                                    >
                                        {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1.5 md:col-span-2">
                                <label className="font-extrabold uppercase text-zinc-700 text-[11px]">LINK GROUP / CHANNEL HỖ TRỢ TELEGRAM</label>
                                <input
                                    type="text"
                                    value={settings.telegram_group_link}
                                    onChange={(e) => handleChange('telegram_group_link', e.target.value)}
                                    placeholder="https://t.me/ducvietstore_support"
                                    className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-medium text-zinc-900 outline-none focus:border-orange-500 transition"
                                />
                            </div>
                        </div>

                        {/* Dynamic Translations Banner */}
                        <div className="pt-3 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-orange-50/80 to-amber-50/80 p-4 rounded-xl border border-orange-200/80">
                            <div>
                                <div className="font-black text-xs text-orange-950 uppercase tracking-wide flex items-center gap-1.5">
                                    <Globe className="h-4 w-4 text-orange-600" />
                                    <span>QUẢN LÝ NGÔN NGỮ & LỜI NHẮN BOT (CSDL DYNAMIC TRANSLATIONS)</span>
                                </div>
                                <p className="text-[11px] text-orange-800 font-medium mt-0.5">
                                    Tự do chỉnh sửa mọi câu từ, menu, thông báo Tiếng Việt, Tiếng Anh, Tiếng Trung của Telegram Bot trực tiếp từ CSDL.
                                </p>
                            </div>
                            <Link
                                href="/settings/translations"
                                className="rounded-xl bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 text-xs font-black uppercase transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                            >
                                <Languages className="h-4 w-4" />
                                <span>CHỈNH SỬA NGÔN NGỮ CSDL</span>
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: QUY TRÌNH TỰ ĐỘNG (AUTOMATED WORKFLOWS) */}
            {activeTab === 'workflows' && (
                <div className="space-y-5">
                    <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4 shadow-2xs">
                        <div className="border-b border-zinc-100 pb-3">
                            <h2 className="font-extrabold text-xs uppercase text-zinc-800 tracking-wider flex items-center gap-2">
                                <Zap className="h-4 w-4 text-orange-600" />
                                <span>CẤU HÌNH CÁC QUY TRÌNH TỰ ĐỘNG & HÀNH VI HỆ THỐNG</span>
                            </h2>
                            <p className="text-[11px] text-zinc-400">Điều chỉnh cách thức hệ thống tự động xử lý đơn hàng, nạp tiền và tương tác với khách</p>
                        </div>

                        <div className="space-y-3 divide-y divide-zinc-100 text-xs">
                            {/* Workflow 1 */}
                            <div className="pt-3 flex items-center justify-between">
                                <div>
                                    <div className="font-extrabold text-zinc-900 text-xs">Tự động duyệt đơn hàng sau khi nạp tiền</div>
                                    <div className="text-[11px] text-zinc-500">Hệ thống tự động trừ ví và giao item tài khoản ngay khi khách bấm mua hàng</div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={settings.auto_approve_orders ?? true}
                                    onChange={() => setSettings(prev => ({ ...prev, auto_approve_orders: !prev.auto_approve_orders }))}
                                    className="h-5 w-5 rounded accent-orange-600 cursor-pointer"
                                />
                            </div>

                            {/* Workflow 2 */}
                            <div className="pt-3 flex items-center justify-between">
                                <div>
                                    <div className="font-extrabold text-zinc-900 text-xs">Tự động cấp bù tài khoản bảo hành đổi mới</div>
                                    <div className="text-[11px] text-zinc-500">Khi admin xác nhận bảo hành, bot sẽ tự động gửi tài khoản thay thế tới Telegram khách hàng</div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={settings.auto_warranty_replace ?? true}
                                    onChange={() => setSettings(prev => ({ ...prev, auto_warranty_replace: !prev.auto_warranty_replace }))}
                                    className="h-5 w-5 rounded accent-orange-600 cursor-pointer"
                                />
                            </div>

                            {/* Workflow 3 */}
                            <div className="pt-3 flex items-center justify-between">
                                <div>
                                    <div className="font-extrabold text-zinc-900 text-xs">Tự động thông báo nạp tiền thành công qua Telegram</div>
                                    <div className="text-[11px] text-zinc-500">Gửi thông báo cộng số dư tức thì cho khách hàng khi giao dịch ngân hàng khớp mã nạp</div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={settings.auto_notify_deposit ?? true}
                                    onChange={() => setSettings(prev => ({ ...prev, auto_notify_deposit: !prev.auto_notify_deposit }))}
                                    className="h-5 w-5 rounded accent-orange-600 cursor-pointer"
                                />
                            </div>

                            {/* Workflow 4 */}
                            <div className="pt-3 flex items-center justify-between">
                                <div>
                                    <div className="font-extrabold text-zinc-900 text-xs">Tự động chặn IP nghi vấn tấn công hoặc spam</div>
                                    <div className="text-[11px] text-zinc-500">Hệ thống chủ động chặn tạm thời các IP spam request quá 100 lần/phút</div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={settings.auto_block_spam_ip ?? true}
                                    onChange={() => setSettings(prev => ({ ...prev, auto_block_spam_ip: !prev.auto_block_spam_ip }))}
                                    className="h-5 w-5 rounded accent-orange-600 cursor-pointer"
                                />
                            </div>

                            {/* Service Toggle: Canva Pro */}
                            <div className="pt-3 flex items-center justify-between border-t border-teal-100 bg-teal-50/40 p-3 rounded-xl mt-2">
                                <div>
                                    <div className="font-extrabold text-teal-900 text-xs flex items-center gap-1.5">
                                        <span>🎨 Bật / Tắt Dịch vụ Tự Động Mời Canva Pro</span>
                                    </div>
                                    <div className="text-[11px] text-teal-700">Khi tắt, nút bấm và tính năng mời Canva Pro trên Bot Telegram sẽ được ẩn / tạm đóng</div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={settings.canva_enabled ?? true}
                                    onChange={() => setSettings(prev => ({ ...prev, canva_enabled: !prev.canva_enabled }))}
                                    className="h-5 w-5 rounded accent-teal-600 cursor-pointer"
                                />
                            </div>

                            {/* Service Toggle: Netflix 30 Days */}
                            <div className="pt-3 flex items-center justify-between border-t border-rose-100 bg-rose-50/40 p-3 rounded-xl mt-2">
                                <div>
                                    <div className="font-extrabold text-rose-900 text-xs flex items-center gap-1.5">
                                        <span>🎬 Bật / Tắt Dịch vụ Tự Động Nhận Netflix 30 Ngày</span>
                                    </div>
                                    <div className="text-[11px] text-rose-700">Khi tắt, nút bấm và tính năng nhận Netflix trên Bot Telegram sẽ được ẩn / tạm đóng</div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={settings.netflix_enabled ?? true}
                                    onChange={() => setSettings(prev => ({ ...prev, netflix_enabled: !prev.netflix_enabled }))}
                                    className="h-5 w-5 rounded accent-rose-600 cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: NẠP TỰ ĐỘNG & NGÂN HÀNG */}
            {activeTab === 'deposit' && (
                <div className="space-y-5">
                    <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4 shadow-2xs">
                        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                            <div>
                                <h2 className="font-extrabold text-xs uppercase text-zinc-800 tracking-wider flex items-center gap-2">
                                    <Banknote className="h-4 w-4 text-orange-600" />
                                    <span>CẤU HÌNH CỔNG NẠP TIỀN TỰ ĐỘNG & BANK GATEWAY</span>
                                </h2>
                                <p className="text-[11px] text-zinc-400">Thiết lập kết nối Sieuthicode và ngân hàng nhận tiền</p>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer font-extrabold text-xs text-zinc-800">
                                <input
                                    type="checkbox"
                                    checked={settings.mb_auto_deposit}
                                    onChange={() => handleToggle('mb_auto_deposit')}
                                    className="h-4 w-4 rounded accent-orange-600"
                                />
                                <span>BẬT NẠP TỰ ĐỘNG</span>
                            </label>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div className="space-y-1.5">
                                <label className="font-extrabold uppercase text-zinc-700 text-[11px]">NGÂN HÀNG HOẠT ĐỘNG CHÍNH (ACTIVE BANK)</label>
                                <select
                                    value={settings.active_bank}
                                    onChange={(e) => handleChange('active_bank', e.target.value)}
                                    className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-semibold text-zinc-900 outline-none focus:border-orange-500 transition"
                                >
                                    <option value="vcb">Vietcombank & VietQR (Sieuthicode)</option>
                                    <option value="mb">MBBank & VietQR (Sieuthicode)</option>
                                    <option value="viettel">ViettelPay (Sieuthicode)</option>
                                    <option value="tpb">TPBank & VietQR (Sieuthicode)</option>
                                    <option value="acb">ACB & VietQR (Sieuthicode)</option>
                                    <option value="tcb">Techcombank & VietQR (Sieuthicode)</option>
                                    <option value="vp">VPBank & VietQR (Sieuthicode)</option>
                                    <option value="timo">Timo & VietQR (Sieuthicode)</option>
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="font-extrabold uppercase text-zinc-700 text-[11px]">CHỌN NGÂN HÀNG ĐỂ CẤU HÌNH THÔNG TIN</label>
                                <select
                                    value={configuringBank}
                                    onChange={(e) => setConfiguringBank(e.target.value)}
                                    className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-semibold text-zinc-900 outline-none focus:border-orange-500 transition"
                                >
                                    <option value="vcb">Vietcombank & VietQR</option>
                                    <option value="mb">MBBank & VietQR</option>
                                    <option value="viettel">ViettelPay</option>
                                    <option value="tpb">TPBank & VietQR</option>
                                    <option value="acb">ACB & VietQR</option>
                                    <option value="tcb">Techcombank & VietQR</option>
                                    <option value="vp">VPBank & VietQR</option>
                                    <option value="timo">Timo & VietQR</option>
                                </select>
                            </div>
                        </div>

                        {/* Bank specific token and STK fields */}
                        <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 space-y-3 text-xs">
                            <span className="font-extrabold uppercase text-orange-600 text-xs block">
                                🏦 THÔNG TIN CẤU HÌNH {configuringBank.toUpperCase()} (SIEUTHICODE)
                            </span>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="font-extrabold uppercase text-zinc-700 text-[11px]">TOKEN SIEUTHICODE</label>
                                    <input
                                        type="text"
                                        value={(settings as any)[`${configuringBank}_token`] || ''}
                                        onChange={(e) => handleChange(`${configuringBank}_token` as any, e.target.value)}
                                        placeholder="Dán API Token từ Sieuthicode..."
                                        className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 font-mono text-zinc-900 text-xs outline-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="font-extrabold uppercase text-zinc-700 text-[11px]">SỐ TÀI KHOẢN NHẬN TIỀN (STK)</label>
                                    <input
                                        type="text"
                                        value={(settings as any)[`${configuringBank}_account`] || ''}
                                        onChange={(e) => handleChange(`${configuringBank}_account` as any, e.target.value)}
                                        placeholder="Nhập số tài khoản ngân hàng..."
                                        className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 font-mono text-zinc-900 text-xs outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Deposit Limits & Rate */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-2">
                            <div className="space-y-1.5">
                                <label className="font-extrabold uppercase text-zinc-700 text-[11px]">SỐ TIỀN NẠP TỐI THIỂU (VND)</label>
                                <input
                                    type="number"
                                    value={settings.min_deposit}
                                    onChange={(e) => handleChange('min_deposit', Number(e.target.value))}
                                    placeholder="50000"
                                    className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-bold text-zinc-900 outline-none focus:border-orange-500 transition"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="font-extrabold uppercase text-zinc-700 text-[11px]">TỶ GIÁ QUY ĐỔI USDT (VND)</label>
                                <input
                                    type="number"
                                    value={settings.exchange_rate}
                                    onChange={(e) => handleChange('exchange_rate', Number(e.target.value))}
                                    placeholder="26000"
                                    className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-bold text-zinc-900 outline-none focus:border-orange-500 transition"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="font-extrabold uppercase text-zinc-700 text-[11px]">ĐỊA CHỈ VÍ USDT TRC20</label>
                                <input
                                    type="text"
                                    value={settings.usdt_trc20_wallet}
                                    onChange={(e) => handleChange('usdt_trc20_wallet', e.target.value)}
                                    placeholder="TJErNxge2EkC2PAkXy9hBag4x5kWPJNKRJ"
                                    className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-mono text-zinc-900 text-xs outline-none focus:border-orange-500 transition"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: GMAIL EDU & CHECKER */}
            {activeTab === 'gmail' && (
                <div className="space-y-5">
                    <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4 shadow-2xs text-xs">
                        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                            <h2 className="font-extrabold text-xs uppercase text-zinc-800 tracking-wider flex items-center gap-2">
                                <Globe className="h-4 w-4 text-orange-600" />
                                <span>DỊCH VỤ GMAIL EDU & CHECKER API KEYS</span>
                            </h2>
                            <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-zinc-800">
                                <input
                                    type="checkbox"
                                    checked={settings.gmail_edu_enabled}
                                    onChange={() => handleToggle('gmail_edu_enabled')}
                                    className="h-4 w-4 rounded accent-orange-600"
                                />
                                <span>BẬT GMAIL EDU</span>
                            </label>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <label className="font-extrabold uppercase text-zinc-700 text-[11px]">ĐƠN GIÁ TẠO GMAIL EDU (VND)</label>
                                <input
                                    type="number"
                                    value={settings.gmail_edu_price}
                                    onChange={(e) => handleChange('gmail_edu_price', Number(e.target.value))}
                                    placeholder="10000"
                                    className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-bold text-zinc-900 outline-none focus:border-orange-500 transition"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="font-extrabold uppercase text-zinc-700 text-[11px]">TÊN MIỀN GMAIL EDU</label>
                                <input
                                    type="text"
                                    value={settings.gmail_edu_domain}
                                    onChange={(e) => handleChange('gmail_edu_domain', e.target.value)}
                                    placeholder="suafpoly.app"
                                    className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-semibold text-zinc-900 outline-none focus:border-orange-500 transition"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="font-extrabold uppercase text-zinc-700 text-[11px]">THỜI GIAN XÓA (GIỜ)</label>
                                <input
                                    type="number"
                                    value={settings.gmail_edu_delete_hours}
                                    onChange={(e) => handleChange('gmail_edu_delete_hours', Number(e.target.value))}
                                    placeholder="1"
                                    className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-semibold text-zinc-900 outline-none focus:border-orange-500 transition"
                                />
                            </div>
                        </div>

                        {/* API Keys Manager */}
                        <div className="space-y-3 pt-3 border-t border-zinc-100">
                            <label className="font-extrabold uppercase text-zinc-700 text-[11px] block">GMAIL CHECKER API KEYS</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newApiKey}
                                    onChange={(e) => setNewApiKey(e.target.value.trim())}
                                    placeholder="Nhập API key check live Gmail..."
                                    className="flex-1 rounded-xl border border-zinc-200 bg-white p-2.5 font-mono text-zinc-900 text-xs outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (newApiKey && !settings.gmail_checker_api_keys.includes(newApiKey)) {
                                            setSettings(prev => ({ ...prev, gmail_checker_api_keys: [...prev.gmail_checker_api_keys, newApiKey] }));
                                            setNewApiKey('');
                                        }
                                    }}
                                    className="rounded-xl bg-orange-600 text-white font-extrabold text-xs uppercase px-4 py-2 hover:bg-orange-700"
                                >
                                    THÊM KEY
                                </button>
                            </div>

                            <div className="flex flex-wrap gap-2 pt-1">
                                {settings.gmail_checker_api_keys.map((k, idx) => (
                                    <span key={idx} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1 font-mono text-[11px] text-zinc-800">
                                        <span>{k}</span>
                                        <button
                                            type="button"
                                            onClick={() => setSettings(prev => ({ ...prev, gmail_checker_api_keys: prev.gmail_checker_api_keys.filter(item => item !== k) }))}
                                            className="text-red-500 font-bold hover:text-red-700 ml-1"
                                        >
                                            ✕
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 5: QUẢN TRỊ VIÊN */}
            {activeTab === 'admin' && (
                <div className="space-y-5 text-xs">
                    <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4 shadow-2xs">
                        <div className="border-b border-zinc-100 pb-3">
                            <h2 className="font-extrabold text-xs uppercase text-zinc-800 tracking-wider flex items-center gap-2">
                                <User className="h-4 w-4 text-orange-600" />
                                <span>DANH SÁCH TELEGRAM ID QUẢN TRỊ VIÊN (ADMIN BOT)</span>
                            </h2>
                        </div>

                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newAdminId}
                                onChange={(e) => setNewAdminId(e.target.value.replace(/\D/g, ''))}
                                placeholder="Nhập Telegram ID admin (VD: 123456789)..."
                                className="flex-1 rounded-xl border border-zinc-200 bg-white p-3 font-mono text-zinc-900 text-xs outline-none"
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    const num = Number(newAdminId);
                                    if (num && !settings.admin_ids.includes(num)) {
                                        setSettings(prev => ({ ...prev, admin_ids: [...prev.admin_ids, num] }));
                                        setNewAdminId('');
                                    }
                                }}
                                className="rounded-xl bg-orange-600 text-white font-extrabold text-xs uppercase px-5 py-2 hover:bg-orange-700"
                            >
                                THÊM ID
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-1">
                            {settings.admin_ids.map(id => (
                                <span key={id} className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1 font-mono text-xs font-bold text-orange-700">
                                    <span>ID: {id}</span>
                                    <button
                                        type="button"
                                        onClick={() => setSettings(prev => ({ ...prev, admin_ids: prev.admin_ids.filter(i => i !== id) }))}
                                        className="text-orange-700 font-bold hover:text-red-700 ml-1"
                                    >
                                        ✕
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Admin Accounts (Super Admin Only) */}
                    {adminRole === 'super_admin' && (
                        <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4 shadow-2xs">
                            <div className="border-b border-zinc-100 pb-3">
                                <h2 className="font-extrabold text-xs uppercase text-zinc-800 tracking-wider flex items-center gap-2">
                                    <Lock className="h-4 w-4 text-orange-600" />
                                    <span>TÀI KHOẢN ĐĂNG NHẬP DASHBOARD ADMIN</span>
                                </h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="font-extrabold uppercase text-zinc-700 text-[11px]">ADMIN 1 USERNAME (SUPER ADMIN)</label>
                                    <input
                                        type="text"
                                        value={settings.admin_username || 'admin'}
                                        onChange={(e) => handleChange('admin_username', e.target.value)}
                                        className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-bold text-zinc-900 outline-none"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="font-extrabold uppercase text-zinc-700 text-[11px]">ADMIN 1 PASSWORD</label>
                                    <input
                                        type="password"
                                        value={settings.admin_password || ''}
                                        onChange={(e) => handleChange('admin_password', e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-mono text-zinc-900 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 6: HỆ THỐNG TỰ ĐỘNG SAO LƯU DỮ LIỆU LÊN GOOGLE DRIVE */}
            {activeTab === 'backup' && adminRole === 'super_admin' && (
                <div className="space-y-6 text-xs max-w-5xl mx-auto">
                    {/* Header Banner Status */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-5 rounded-2xl border border-emerald-500/20">
                        <div className="flex items-center gap-3.5">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-500/20 shrink-0">
                                <DatabaseBackup className="h-6 w-6" />
                            </div>
                            <div>
                                <h2 className="text-lg font-black uppercase tracking-tight text-zinc-900 flex items-center gap-2">
                                    TỰ ĐỘNG SAO LƯU DỮ LIỆU LÊN GOOGLE DRIVE
                                </h2>
                                <p className="text-xs text-zinc-600 font-medium mt-0.5">
                                    Hệ thống tự động xuất bản sao lưu SQL CSDL MySQL và tải lên tài khoản Google Drive cá nhân/doanh nghiệp.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <a
                                href="/api/backup/drive/auth"
                                className="rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs uppercase px-4 py-2.5 shadow-md transition active:scale-95 flex items-center gap-2 cursor-pointer"
                                title="Đăng nhập Google bằng 1-Click để cấp quyền lưu file tự động"
                            >
                                <Globe className="h-4 w-4" />
                                <span>🔗 ĐĂNG NHẬP CẤP QUYỀN GOOGLE (1-CLICK)</span>
                            </a>

                            {isDriveConnected ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-800 font-extrabold text-xs">
                                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                                    🟢 ĐÃ KẾT NỐI GOOGLE DRIVE
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-100 border border-amber-300 text-amber-900 font-extrabold text-xs">
                                    🟡 ĐANG LƯU BẢN SAO LƯU LOCAL
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Instant Action Buttons */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 space-y-3 shadow-xs">
                            <div className="flex items-center gap-2 font-extrabold text-emerald-950 text-xs uppercase">
                                <CloudUpload className="h-4 w-4 text-emerald-600" />
                                <span>TẠO BẢN SAO LƯU & TẢI LÊN DRIVER NGAY</span>
                            </div>
                            <p className="text-[11px] text-emerald-900/80 leading-relaxed font-medium">
                                Xuất tức thì file `.sql` chứa toàn bộ bảng CSDL MySQL và tự động đồng bộ đẩy file lên thư mục Google Drive của bạn.
                            </p>
                            <button
                                type="button"
                                onClick={handleCreateBackupNow}
                                disabled={creatingBackup}
                                className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase py-3 shadow-md transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                            >
                                <RefreshCw className={`h-4 w-4 ${creatingBackup ? 'animate-spin' : ''}`} />
                                <span>{creatingBackup ? 'ĐANG SAO LƯU & TẢI LÊN DRIVER...' : '🚀 TẠO BẢN SAO LƯU NGAY'}</span>
                            </button>
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3 shadow-xs">
                            <div className="flex items-center gap-2 font-extrabold text-zinc-900 text-xs uppercase">
                                <Download className="h-4 w-4 text-orange-600" />
                                <span>TẢI THỦ CÔNG FILE SQL MÁY CHỦ</span>
                            </div>
                            <p className="text-[11px] text-zinc-500 leading-relaxed font-medium">
                                Tải file sao lưu CSDL dạng `.sql` trực tiếp về máy tính cá nhân để lưu giữ hoặc khôi phục thủ công khi cần.
                            </p>
                            <button
                                type="button"
                                onClick={handleExportSql}
                                disabled={exportingSql}
                                className="w-full rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-800 font-extrabold text-xs uppercase py-3 shadow-2xs transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                            >
                                <Download className="h-4 w-4 text-orange-600" />
                                <span>{exportingSql ? 'ĐANG XUẤT SQL...' : '📥 TẢI FILE SQL DATABASE'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Google Drive Config Card */}
                    <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4 shadow-2xs">
                        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                            <h3 className="font-extrabold text-xs uppercase text-zinc-900 tracking-wider flex items-center gap-2">
                                <SettingsIcon className="h-4 w-4 text-orange-600" />
                                <span>CẤU HÌNH THÔNG SỐ TỰ ĐỘNG SAO LƯU GOOGLE DRIVE</span>
                            </h3>

                            <label className="flex items-center gap-2 cursor-pointer font-extrabold text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                                <input
                                    type="checkbox"
                                    checked={autoBackupEnabled}
                                    onChange={(e) => setAutoBackupEnabled(e.target.checked)}
                                    className="h-4 w-4 rounded accent-emerald-600 cursor-pointer"
                                />
                                <span>BẬT TỰ ĐỘNG SAO LƯU THEO LỊCH</span>
                            </label>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                            <div className="space-y-1.5">
                                <label className="font-extrabold uppercase text-zinc-700 text-[11px]">
                                    THỜI GIAN ĐỊNH KỲ SAO LƯU (AUTO INTERVAL)
                                </label>
                                <select
                                    value={autoBackupInterval}
                                    onChange={(e) => setAutoBackupInterval(e.target.value)}
                                    className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-semibold text-zinc-900 outline-none focus:border-emerald-500 transition"
                                >
                                    <option value="6h">⚡ Mỗi 6 Giờ (4 lần / ngày)</option>
                                    <option value="12h">⚡ Mỗi 12 Giờ (2 lần / ngày)</option>
                                    <option value="24h">📅 Mỗi Ngày (Tự động 00:00 hàng ngày)</option>
                                    <option value="weekly">📆 Mỗi Tuần (1 lần / tuần)</option>
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="font-extrabold uppercase text-zinc-700 text-[11px]">
                                    GOOGLE DRIVE FOLDER ID (MÃ THƯ MỤC TRÊN DRIVER)
                                </label>
                                <input
                                    type="text"
                                    value={driveFolderId}
                                    onChange={(e) => setDriveFolderId(e.target.value)}
                                    placeholder="Ví dụ: 1A2b3C4d5E6F7g8H9i0J (Lấy từ URL thư mục Drive)"
                                    className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-mono text-zinc-900 outline-none focus:border-emerald-500 transition text-xs"
                                />
                            </div>
                        </div>

                        {/* File JSON Credentials Upload Banner */}
                        <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 font-black text-xs text-blue-950 uppercase">
                                    <FileText className="h-4 w-4 text-blue-600" />
                                    <span>TẢI LÊN FILE CREDENTIALS / SERVICE ACCOUNT (.JSON)</span>
                                </div>
                                <label className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-black uppercase transition flex items-center gap-1.5 cursor-pointer shadow-xs">
                                    <Plus className="h-4 w-4" />
                                    <span>{uploadingJson ? 'ĐANG TẢI VÀ NẠP JSON...' : '📂 CHỌN FILE JSON CREDENTIALS'}</span>
                                    <input
                                        type="file"
                                        accept=".json"
                                        onChange={handleUploadJsonFile}
                                        className="hidden"
                                    />
                                </label>
                            </div>
                            <p className="text-[11px] text-blue-900/80 font-medium">
                                Nhanh chóng kết nối bằng cách chọn file <code className="font-bold bg-blue-100 px-1 py-0.5 rounded text-blue-950">client_secret.json</code> hoặc <code className="font-bold bg-blue-100 px-1 py-0.5 rounded text-blue-950">service_account.json</code> đã tải về từ Google Cloud Console.
                            </p>
                        </div>

                        {/* Optional Custom OAuth API Credentials */}
                        <div className="pt-3 border-t border-zinc-100 space-y-3">
                            <span className="text-[11px] font-extrabold uppercase text-zinc-500 block">
                                CẤU HÌNH TÙY CHỌN GOOGLE OAUTH2 CREDENTIALS (NHẬP TAY NẾU CẦN):
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-zinc-500">CLIENT ID</label>
                                    <input
                                        type="text"
                                        value={driveClientId}
                                        onChange={(e) => setDriveClientId(e.target.value)}
                                        placeholder="xxx.apps.googleusercontent.com"
                                        className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 font-mono text-zinc-800 text-[11px] outline-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-zinc-500">CLIENT SECRET</label>
                                    <input
                                        type="password"
                                        value={driveClientSecret}
                                        onChange={(e) => setDriveClientSecret(e.target.value)}
                                        placeholder="GOCS-..."
                                        className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 font-mono text-zinc-800 text-[11px] outline-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-zinc-500">REFRESH TOKEN</label>
                                    <input
                                        type="password"
                                        value={driveRefreshToken}
                                        onChange={(e) => setDriveRefreshToken(e.target.value)}
                                        placeholder="1//0..."
                                        className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 font-mono text-zinc-800 text-[11px] outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-2 flex justify-end">
                            <button
                                type="button"
                                onClick={handleSaveDriveConfig}
                                disabled={savingDriveConfig}
                                className="rounded-xl bg-zinc-900 hover:bg-black text-white px-6 py-2.5 text-xs font-black uppercase tracking-wider transition shadow-xs flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                            >
                                <Save className="h-4 w-4 text-emerald-400" />
                                <span>{savingDriveConfig ? 'ĐANG LƯU...' : '💾 LƯU CẤU HÌNH GOOGLE DRIVE'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Backup History Table */}
                    <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4 shadow-2xs">
                        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                            <div className="font-extrabold text-xs uppercase text-zinc-900 tracking-wider flex items-center gap-2">
                                <FileText className="h-4 w-4 text-orange-600" />
                                <span>LỊCH SỬ BẢN SAO LƯU GOOGLE DRIVE & LOCAL ({backupHistory.length})</span>
                            </div>
                            <button
                                type="button"
                                onClick={fetchBackupData}
                                className="px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-100 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                            >
                                <RefreshCw className={`h-3.5 w-3.5 ${loadingDriveBackup ? 'animate-spin' : ''}`} />
                                <span>LÀM MỚI</span>
                            </button>
                        </div>

                        {loadingDriveBackup && backupHistory.length === 0 ? (
                            <div className="p-8 text-center text-xs text-zinc-400">
                                <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-orange-600" />
                                Đang cập nhật lịch sử sao lưu...
                            </div>
                        ) : backupHistory.length === 0 ? (
                            <div className="p-8 text-center text-xs text-zinc-400 space-y-1">
                                <DatabaseBackup className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
                                <p className="font-bold text-zinc-600">Chưa có bản sao lưu nào được tạo.</p>
                                <p className="text-[10px]">Bấm nút "Tạo bản sao lưu ngay" phía trên để tạo bản sao lưu đầu tiên.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="border-b border-zinc-200 bg-zinc-50/80 text-[10px] uppercase tracking-wider text-zinc-500 font-extrabold">
                                            <th className="p-3">TÊN FILE SQL</th>
                                            <th className="p-3">DUNG LƯỢNG</th>
                                            <th className="p-3">THỜI GIAN TẠO</th>
                                            <th className="p-3 text-center">GOOGLE DRIVE</th>
                                            <th className="p-3 text-right">THAO TÁC</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100">
                                        {backupHistory.map((item) => (
                                            <tr key={item.id || item.fileName} className="hover:bg-zinc-50/80 transition">
                                                <td className="p-3 font-mono font-bold text-zinc-900 text-[11px]">
                                                    {item.fileName}
                                                </td>
                                                <td className="p-3 font-mono text-zinc-600 text-xs">
                                                    {item.sizeKb} KB
                                                </td>
                                                <td className="p-3 text-zinc-600 text-xs">
                                                    {new Date(item.createdAt).toLocaleString('vi-VN')}
                                                </td>
                                                <td className="p-3 text-center">
                                                    {item.driveUploaded ? (
                                                        <a
                                                            href={item.driveLink || '#'}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black hover:underline border border-emerald-300"
                                                        >
                                                            <ExternalLink className="h-3 w-3" />
                                                            Đã lưu Drive
                                                        </a>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-300">
                                                            💾 Bản lưu Local
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <a
                                                            href={item.filePath}
                                                            download={item.fileName}
                                                            className="p-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition"
                                                            title="Tải về file SQL"
                                                        >
                                                            <Download className="h-3.5 w-3.5" />
                                                        </a>
                                                        <button
                                                            onClick={() => handleDeleteBackup(item.fileName)}
                                                            className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition cursor-pointer"
                                                            title="Xóa bản sao lưu"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
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
            )}
        </div>
    );
}
