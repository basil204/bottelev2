'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    Save, Settings as SettingsIcon, Banknote, CreditCard, Trash2, Power, Download,
    DatabaseBackup, ShieldCheck, RefreshCw, Key, User, Globe, Bot, Bell,
    Sparkles, CheckCircle2, AlertCircle, Plus, Eye, EyeOff, Terminal, Zap, Layers, Lock, Languages,
    CloudUpload, FileText, ExternalLink, MessageSquare
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
    bot_username?: string;
    shop_name: string;
    usdt_trc20_wallet: string;
    telegram_group_link?: string;
    // Binance Pay
    binance_api_key?: string;
    binance_secret_key?: string;
    binance_pay_id?: string;
    binance_auto_deposit?: boolean;
    binance_min_deposit?: number;
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
        bot_username: '',
        shop_name: 'DUCVIETSTORE',
        usdt_trc20_wallet: '',
        telegram_group_link: '',
        binance_api_key: '',
        binance_secret_key: '',
        binance_pay_id: '',
        binance_auto_deposit: false,
        binance_min_deposit: 1,
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

    const [activeTab, setActiveTab] = useState<'general' | 'workflows' | 'deposit' | 'admin' | 'backup'>('general');
    const [testingBinance, setTestingBinance] = useState(false);
    const [binanceTestResult, setBinanceTestResult] = useState<{ success: boolean; message: string } | null>(null);

    const handleTestBinance = async () => {
        setTestingBinance(true);
        setBinanceTestResult(null);
        try {
            const res = await fetch('/api/binance/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apiKey: settings.binance_api_key,
                    secretKey: settings.binance_secret_key
                })
            });
            const data = await res.json();
            setBinanceTestResult({
                success: Boolean(data.success),
                message: data.message || (data.success ? 'Kết nối thành công!' : 'Kết nối thất bại')
            });
        } catch (err: any) {
            setBinanceTestResult({ success: false, message: `Lỗi: ${err.message}` });
        } finally {
            setTestingBinance(false);
        }
    };
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [exportingSql, setExportingSql] = useState(false);
    const [showToken, setShowToken] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [newAdminId, setNewAdminId] = useState('');
    const [newApiKey, setNewApiKey] = useState('');
    const [configuringBank, setConfiguringBank] = useState<string>('vcb');
    const [adminRole, setAdminRole] = useState<string>('admin');

    // Multi Bot Token & Username State
    const [botRows, setBotRows] = useState<{ token: string; username: string }[]>([
        { token: '', username: '' }
    ]);

    const handleAddBotTokenRow = () => {
        setBotRows((prev) => [...prev, { token: '', username: '' }]);
    };

    const handleBotTokenChange = (index: number, val: string) => {
        setBotRows((prev) => prev.map((r, i) => (i === index ? { ...r, token: val } : r)));
    };

    const handleBotUsernameChange = (index: number, val: string) => {
        let clean = val.trim();
        if (clean && !clean.startsWith('@')) clean = '@' + clean;
        setBotRows((prev) => prev.map((r, i) => (i === index ? { ...r, username: clean } : r)));
    };

    const handleRemoveBotTokenRow = (index: number) => {
        setBotRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : [{ token: '', username: '' }]));
    };

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

                // Populate multi-bot rows from loaded settings
                const tokens = (data.telegram_bot_token || '').split(/[\r\n,;|]+/).map((t: string) => t.trim()).filter(Boolean);
                const usernames = (data.bot_username || '').split(/[\r\n,;|]+/).map((u: string) => u.trim().replace(/^@/, '')).filter(Boolean);
                const initialRows: { token: string; username: string }[] = [];
                const maxCount = Math.max(tokens.length, usernames.length, 1);
                for (let i = 0; i < maxCount; i++) {
                    initialRows.push({
                        token: tokens[i] || '',
                        username: usernames[i] ? `@${usernames[i]}` : ''
                    });
                }
                setBotRows(initialRows);
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
            const validTokens = botRows.map(r => r.token.trim()).filter(Boolean);
            const validUsernames = botRows.map(r => r.username.trim().replace(/^@/, '')).filter(Boolean);

            const payload = {
                ...settings,
                telegram_bot_token: validTokens.join('\n'),
                bot_username: validUsernames.map(u => `@${u}`).join(', ')
            };

            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setSettings(payload);
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

                <Link
                    href="/start-menu"
                    className="ml-auto px-4 py-2 rounded-xl text-xs font-black uppercase transition flex items-center gap-2 bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-sm"
                >
                    <MessageSquare className="h-4 w-4" />
                    <span>🤖 TÙY BIẾN NÚT & NỘI DUNG BOT</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                </Link>
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

                            {/* Dynamic Telegram Bot Token(s) & Username Manager */}
                            <div className="space-y-3 md:col-span-2 bg-zinc-50/80 p-4 rounded-2xl border border-zinc-200/80">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <label className="font-extrabold uppercase text-zinc-800 text-[11px] flex items-center gap-1.5">
                                            <Bot className="h-4 w-4 text-orange-600" />
                                            <span>DANH SÁCH TELEGRAM BOT TOKEN & USERNAME *</span>
                                        </label>
                                        <p className="text-[11px] text-zinc-500 font-medium mt-0.5">
                                            Hệ thống hỗ trợ chạy đồng thời nhiều Token Bot cùng 1 lúc trên cùng một CSDL. Nhập Token và Username (@Bot) tương ứng cho từng bot.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleAddBotTokenRow}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-extrabold text-xs shadow-sm transition cursor-pointer"
                                    >
                                        <Plus className="h-4 w-4" />
                                        <span>+ Thêm Bot Token</span>
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {botRows.map((botRow, idx) => (
                                        <div
                                            key={idx}
                                            className="p-3 bg-white rounded-xl border border-zinc-200 shadow-xs space-y-2 focus-within:border-orange-500 transition"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="px-2.5 py-1 rounded-lg bg-orange-50 text-orange-700 font-black text-[11px] border border-orange-200 flex items-center gap-1.5">
                                                    <Bot className="h-3.5 w-3.5" />
                                                    <span>Bot #{idx + 1} {idx === 0 ? '(Chính / Primary)' : '(Phụ / Worker)'}</span>
                                                </span>
                                                {botRows.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveBotTokenRow(idx)}
                                                        title={`Xóa Bot #${idx + 1}`}
                                                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
                                                <div className="md:col-span-8 space-y-1">
                                                    <label className="text-[10px] font-extrabold uppercase text-zinc-500">
                                                        TELEGRAM BOT TOKEN (TỪ @BOTFATHER) *
                                                    </label>
                                                    <input
                                                        type={showToken ? 'text' : 'password'}
                                                        value={botRow.token}
                                                        onChange={(e) => handleBotTokenChange(idx, e.target.value)}
                                                        placeholder="Ví dụ: 123456789:ABCdefGHIjklMNO..."
                                                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 font-mono text-zinc-900 outline-none text-xs focus:bg-white focus:border-orange-500 transition"
                                                    />
                                                </div>
                                                <div className="md:col-span-4 space-y-1">
                                                    <label className="text-[10px] font-extrabold uppercase text-zinc-500">
                                                        USERNAME BOT (@USERNAME)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={botRow.username}
                                                        onChange={(e) => handleBotUsernameChange(idx, e.target.value)}
                                                        placeholder="Ví dụ: @MyShopBot"
                                                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 font-mono font-bold text-orange-700 outline-none text-xs focus:bg-white focus:border-orange-500 transition"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500 pt-1 border-t border-zinc-200/60">
                                    <span className="flex items-center gap-1 font-medium">
                                        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                                        <span>Đang thiết lập: <strong className="text-zinc-800 font-bold">{botRows.filter((r) => r.token.trim()).length} token bot hợp lệ</strong></span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setShowToken(!showToken)}
                                        className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-800 font-semibold cursor-pointer"
                                    >
                                        {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                        <span>{showToken ? 'Ẩn token' : 'Hiện token'}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Admin Telegram ID(s) Notifications Setup Card */}
                            <div className="space-y-3 md:col-span-2 bg-gradient-to-r from-orange-50/60 via-amber-50/40 to-white p-4 rounded-2xl border border-orange-200/80">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-orange-100 pb-2">
                                    <div>
                                        <label className="font-extrabold uppercase text-zinc-900 text-xs flex items-center gap-1.5">
                                            <Bell className="h-4 w-4 text-orange-600" />
                                            <span>TELEGRAM ID ADMIN NHẬN THÔNG BÁO TỰ ĐỘNG</span>
                                        </label>
                                        <p className="text-[11px] text-zinc-500 font-medium mt-0.5">
                                            Các Telegram ID dưới đây sẽ nhận được thông báo tức thời từ Bot khi có phát sinh các sự kiện quan trọng.
                                        </p>
                                    </div>
                                </div>

                                {/* Feature Badges */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                                    <div className="p-2.5 rounded-xl bg-white border border-orange-100 shadow-2xs space-y-1">
                                        <div className="font-extrabold text-zinc-800 flex items-center gap-1">
                                            <CreditCard className="h-3.5 w-3.5 text-orange-600" />
                                            <span>💰 Nạp Tiền & Duyệt Bill</span>
                                        </div>
                                        <p className="text-zinc-500 text-[10px] leading-tight">Thông báo nạp tự động (Bank/Binance/USDT) & hóa đơn khách gửi.</p>
                                    </div>

                                    <div className="p-2.5 rounded-xl bg-white border border-orange-100 shadow-2xs space-y-1">
                                        <div className="font-extrabold text-zinc-800 flex items-center gap-1">
                                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                            <span>🛒 Mua Hàng Có Sẵn</span>
                                        </div>
                                        <p className="text-zinc-500 text-[10px] leading-tight">Thông báo khi khách mua tài khoản có sẵn trong kho thành công.</p>
                                    </div>

                                    <div className="p-2.5 rounded-xl bg-white border border-orange-100 shadow-2xs space-y-1">
                                        <div className="font-extrabold text-zinc-800 flex items-center gap-1">
                                            <Layers className="h-3.5 w-3.5 text-blue-600" />
                                            <span>📦 Đơn Hàng Order Mới</span>
                                        </div>
                                        <p className="text-zinc-500 text-[10px] leading-tight">Thông báo khi khách đặt đơn hàng Order/nhập tay cần xử lý.</p>
                                    </div>

                                    <div className="p-2.5 rounded-xl bg-white border border-orange-100 shadow-2xs space-y-1">
                                        <div className="font-extrabold text-zinc-800 flex items-center gap-1">
                                            <ShieldCheck className="h-3.5 w-3.5 text-purple-600" />
                                            <span>🛡️ Bảo Hành & CSKH</span>
                                        </div>
                                        <p className="text-zinc-500 text-[10px] leading-tight">Thông báo khi khách gửi yêu cầu bảo hành hoặc nhắn tin hỗ trợ.</p>
                                    </div>
                                </div>

                                {/* Add Admin ID Input & Badges */}
                                <div className="space-y-2 pt-1">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newAdminId}
                                            onChange={(e) => setNewAdminId(e.target.value.replace(/\D/g, ''))}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    const num = Number(newAdminId);
                                                    if (num && !settings.admin_ids.includes(num)) {
                                                        setSettings(prev => ({ ...prev, admin_ids: [...prev.admin_ids, num] }));
                                                        setNewAdminId('');
                                                    }
                                                }
                                            }}
                                            placeholder="Nhập Telegram ID Admin (VD: 8202830305 - Lấy ID từ @userinfobot)..."
                                            className="flex-1 rounded-xl border border-zinc-200 bg-white p-2.5 font-mono text-zinc-900 text-xs outline-none focus:border-orange-500"
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
                                            className="rounded-xl bg-orange-600 text-white font-extrabold text-xs uppercase px-4 py-2 hover:bg-orange-700 transition cursor-pointer"
                                        >
                                            + Thêm ID
                                        </button>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 pt-1">
                                        <span className="text-[11px] font-bold text-zinc-500">ID Admin đang nhận thông báo:</span>
                                        {settings.admin_ids.length === 0 ? (
                                            <span className="text-xs text-amber-700 font-semibold bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                                                ⚠️ Chưa cấu hình ID Admin nào (Hãy thêm ID Telegram của bạn vào đây để nhận thông báo)
                                            </span>
                                        ) : (
                                            settings.admin_ids.map((id) => (
                                                <span
                                                    key={id}
                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-white px-3 py-1 font-mono text-xs font-bold text-orange-700 shadow-2xs"
                                                >
                                                    <User className="h-3 w-3 text-orange-500" />
                                                    <span>{id}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSettings(prev => ({ ...prev, admin_ids: prev.admin_ids.filter(i => i !== id) }))}
                                                        className="text-zinc-400 hover:text-red-600 font-bold ml-1 transition cursor-pointer"
                                                        title={`Xóa ID ${id}`}
                                                    >
                                                        ✕
                                                    </button>
                                                </span>
                                            ))
                                        )}
                                    </div>
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

                        {/* Bot Templates & Buttons Banner */}
                        <div className="pt-3 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-orange-50/80 to-amber-50/80 p-4 rounded-xl border border-orange-200/80">
                            <div>
                                <div className="font-black text-xs text-orange-950 uppercase tracking-wide flex items-center gap-1.5">
                                    <Globe className="h-4 w-4 text-orange-600" />
                                    <span>QUẢN LÝ NÚT BẤM & NỘI DUNG ĐA NGÔN NGỮ BOT</span>
                                </div>
                                <p className="text-[11px] text-orange-800 font-medium mt-0.5">
                                    Tùy chỉnh bàn phím chính, lời nhắn menu /start và các mẫu tin nhắn nạp tiền, đơn hàng đa ngôn ngữ (VI/EN/ZH).
                                </p>
                            </div>
                            <Link
                                href="/start-menu"
                                className="rounded-xl bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 text-xs font-black uppercase transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                            >
                                <MessageSquare className="h-4 w-4" />
                                <span>TÙY CHỈNH NÚT & LỜI NHẮN</span>
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
                                <p className="text-[11px] text-zinc-400">Thiết lập kết nối ngân hàng và số tài khoản nhận tiền</p>
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
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        handleChange('active_bank', val);
                                        setConfiguringBank(val);
                                    }}
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
                                🏦 THÔNG TIN CẤU HÌNH {configuringBank.toUpperCase()}
                            </span>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <label className="font-extrabold uppercase text-zinc-700 text-[11px]">TOKEN API NẠP TIỀN</label>
                                    <input
                                        type="text"
                                        value={(settings as any)[`${configuringBank}_token`] || ''}
                                        onChange={(e) => handleChange(`${configuringBank}_token` as any, e.target.value)}
                                        placeholder="Dán API Token ngân hàng..."
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
                                <div className="space-y-1">
                                    <label className="font-extrabold uppercase text-zinc-700 text-[11px]">TÊN CHỦ TÀI KHOẢN (ACCOUNT NAME)</label>
                                    <input
                                        type="text"
                                        value={settings.vietqr_account_name || ''}
                                        onChange={(e) => handleChange('vietqr_account_name', e.target.value)}
                                        placeholder="VD: NGUYEN VAN A"
                                        className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 font-mono text-zinc-900 text-xs outline-none uppercase"
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

                        {/* Binance Pay Auto Deposit Card */}
                        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-4">
                            <div className="flex items-center justify-between border-b border-amber-200/80 pb-3">
                                <div>
                                    <div className="font-extrabold text-amber-950 text-xs flex items-center gap-2">
                                        <span className="text-base">🟡</span>
                                        <span>CẤU HÌNH TỰ ĐỘNG NẠP TIỀN QUA BINANCE PAY</span>
                                    </div>
                                    <div className="text-[11px] text-amber-800">
                                        Tự động quét lịch sử nhận USDT Binance Pay theo Pay ID / UID & cộng tiền ngay lập tức
                                    </div>
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-amber-950">
                                    <input
                                        type="checkbox"
                                        checked={Boolean(settings.binance_auto_deposit)}
                                        onChange={() => setSettings(prev => ({ ...prev, binance_auto_deposit: !prev.binance_auto_deposit }))}
                                        className="h-5 w-5 rounded accent-amber-600 cursor-pointer"
                                    />
                                    <span>BẬT TỰ ĐỘNG QUÉT</span>
                                </label>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                <div className="space-y-1.5">
                                    <label className="font-extrabold uppercase text-zinc-700 text-[11px]">BINANCE PAY ID / UID CỦA SHOP</label>
                                    <input
                                        type="text"
                                        value={settings.binance_pay_id || ''}
                                        onChange={(e) => handleChange('binance_pay_id', e.target.value)}
                                        placeholder="Ví dụ: 123456789 hoặc Pay ID"
                                        className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-mono text-zinc-900 text-xs outline-none focus:border-amber-500 transition"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="font-extrabold uppercase text-zinc-700 text-[11px]">BINANCE API KEY</label>
                                    <input
                                        type="password"
                                        value={settings.binance_api_key || ''}
                                        onChange={(e) => handleChange('binance_api_key', e.target.value)}
                                        placeholder="Nhập Binance API Key..."
                                        className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-mono text-zinc-900 text-xs outline-none focus:border-amber-500 transition"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="font-extrabold uppercase text-zinc-700 text-[11px]">BINANCE SECRET KEY</label>
                                    <input
                                        type="password"
                                        value={settings.binance_secret_key || ''}
                                        onChange={(e) => handleChange('binance_secret_key', e.target.value)}
                                        placeholder="Nhập Binance Secret Key..."
                                        className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-mono text-zinc-900 text-xs outline-none focus:border-amber-500 transition"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-2">
                                <div className="text-[11px] text-zinc-500">
                                    💡 <i>Quyền API cần thiết trên Binance: <b>Đọc (Read-only) / Binance Pay Transaction History</b>.</i>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleTestBinance}
                                    disabled={testingBinance}
                                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-extrabold text-xs transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                                >
                                    <span>{testingBinance ? '⏳ Đang kiểm tra...' : '⚡ Test Kết Nối Binance API'}</span>
                                </button>
                            </div>

                            {binanceTestResult && (
                                <div className={`p-3 rounded-xl text-xs font-semibold ${binanceTestResult.success ? 'bg-emerald-100 border border-emerald-300 text-emerald-900' : 'bg-rose-100 border border-rose-300 text-rose-900'}`}>
                                    {binanceTestResult.message}
                                </div>
                            )}
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
