'use client';

import { useEffect, useState } from 'react';
import {
    Save, Settings as SettingsIcon, Banknote, CreditCard, Trash2, Power, Download,
    DatabaseBackup, ShieldCheck, RefreshCw, Key, User, Globe, Bot, Bell,
    Sparkles, CheckCircle2, AlertCircle, Plus, Eye, EyeOff, Terminal, Zap, Layers, Lock
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

    useEffect(() => {
        fetchSettings();
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

            {/* TAB 6: SAO LƯU SQL */}
            {activeTab === 'backup' && adminRole === 'super_admin' && (
                <div className="space-y-5 text-xs max-w-2xl mx-auto">
                    <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center space-y-4 shadow-2xs">
                        <DatabaseBackup className="h-10 w-10 text-orange-600 mx-auto" />
                        <h3 className="font-extrabold text-sm text-zinc-900">XUẤT BẢN SAO LƯU DATABASE MYSQL (.SQL)</h3>
                        <p className="text-xs text-zinc-500 max-w-md mx-auto">
                            Tạo file SQL chứa toàn bộ cấu trúc bảng và toàn bộ dữ liệu đơn hàng, người dùng, giao dịch của hệ thống.
                        </p>
                        <button
                            type="button"
                            onClick={handleExportSql}
                            disabled={exportingSql}
                            className="rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs uppercase px-6 py-3 shadow-xs disabled:opacity-50 flex items-center justify-center gap-2 mx-auto"
                        >
                            <Download className="h-4 w-4" />
                            <span>{exportingSql ? 'ĐANG TẠO FILE SQL...' : 'TẢI FILE SQL DATABASE'}</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
