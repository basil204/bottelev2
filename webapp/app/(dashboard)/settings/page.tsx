'use client';

import { useEffect, useState } from 'react';
import { Save, Banknote, CreditCard, Trash2, Power } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs'; // Added Tabs components

interface Settings {
    mb_auto_deposit: boolean;
    bank_provider: 'mbbank' | 'viettel'; // New field to select bank
    viettel_token: string;
    viettel_account: string;
    mbbank_token: string; // New field for MBBank token
    mbbank_account: string; // New field for MBBank account
    min_deposit: number;
    exchange_rate: number;
    telegram_bot_token: string;
    shop_name: string;
    usdt_trc20_wallet: string;
    telegram_group_link: string;
    // Gmail EDU settings
    gmail_edu_enabled: boolean;
    gmail_edu_price: number;
    gmail_edu_domain: string;
    gmail_edu_delete_hours: number;
    // Admin IDs
    admin_ids: number[];
}

import { useLanguage } from '@/contexts/LanguageContext';

export default function SettingsPage() {
    const { t } = useLanguage();
    const [settings, setSettings] = useState<Settings>({
        mb_auto_deposit: true,
        bank_provider: 'viettel', // Default to viettel
        viettel_token: '',
        viettel_account: '',
        mbbank_token: '', // New default
        mbbank_account: '', // New default
        min_deposit: 50000,
        exchange_rate: 26000,
        telegram_bot_token: '',
        shop_name: 'SHOP',
        usdt_trc20_wallet: '',
        telegram_group_link: '',
        // Gmail EDU defaults
        gmail_edu_enabled: true,
        gmail_edu_price: 10000,
        gmail_edu_domain: 'suafpoly.app',
        gmail_edu_delete_hours: 1,
        // Admin IDs
        admin_ids: [],
    });

    const [newAdminId, setNewAdminId] = useState('');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Promotion states
    const [promotions, setPromotions] = useState<any[]>([]);
    const [promoLoading, setPromoLoading] = useState(false);
    const [newPromo, setNewPromo] = useState({
        start_time: '',
        end_time: '',
        bonus_percentage: 10,
        min_amount: 0
    });

    useEffect(() => {
        let mounted = true;
        setLoading(true);

        const fetchData = async () => {
            try {
                const res = await fetch('/api/settings');
                if (!res.ok) throw new Error('Failed to fetch settings');
                const data = await res.json();
                if (mounted) {
                    setSettings(data);
                }
            } catch (err) {
                console.error("Error loading settings:", err);
                // Optional: show error to user
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchData();
        loadPromotions();

        return () => { mounted = false; };
    }, []);

    const loadPromotions = async () => {
        setPromoLoading(true);
        try {
            const res = await fetch('/api/promotions');
            if (!res.ok) throw new Error('Failed to fetch promotions');
            const data = await res.json();
            if (Array.isArray(data)) {
                setPromotions(data);
            } else {
                setPromotions([]);
            }
        } catch (error) {
            console.error("Error loading promotions:", error);
            setPromotions([]);
        } finally {
            setPromoLoading(false);
        }
    };

    const handleCreatePromotion = async () => {
        if (!newPromo.start_time || !newPromo.end_time) {
            console.error("Please select start and end time");
            return;
        }

        try {
            const res = await fetch('/api/promotions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newPromo)
            });

            if (res.ok) {
                console.log("Promotion created successfully");
                loadPromotions();
                // Reset form slightly but keep useful defaults
                setNewPromo(prev => ({ ...prev, start_time: '', end_time: '' }));
            } else {
                const err = await res.json();
                console.error("Failed to create promotion:", err.error || "Unknown error");
            }
        } catch (e) {
            console.error("Network error:", e);
        }
    };

    const handleDeletePromotion = async (id: number) => {
        if (!confirm('Are you sure?')) return;

        try {
            const res = await fetch(`/api/promotions?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                console.log("Promotion deleted successfully");
                loadPromotions();
            } else {
                console.error("Failed to delete promotion");
            }
        } catch (e) {
            console.error("Failed to delete promotion:", e);
        }
    };

    const handleRestart = async () => {
        if (!confirm('Bạn có chắc chắn muốn khởi động lại Bot không?')) return;
        setSaving(true);
        try {
            const res = await fetch('/api/restart', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setMessage({ type: 'success', text: 'Đã gửi lệnh khởi động lại Bot.' });
            } else {
                setMessage({ type: 'error', text: data.error || 'Lỗi khi khởi động lại Bot.' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Lỗi kết nối server.' });
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = (key: keyof Settings) => {
        setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const handleChange = (key: keyof Settings, value: string) => {
        setSettings((prev) => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });

            if (res.ok) {
                setMessage({ type: 'success', text: t('settings.success') });
            } else {
                setMessage({ type: 'error', text: t('settings.error') });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Server connection error.' });
        } finally {
            setSaving(false);
        }
    };


    if (loading) return (
        <div className="flex h-[50vh] items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
    );

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">{t('settings.title')}</h2>
                <p className="text-muted-foreground">{t('settings.subtitle')}</p>
            </div>

            <Card>
                <Tabs defaultValue="general" className="w-full">
                    <CardHeader className="pb-3">
                        <TabsList className="flex flex-wrap gap-1 h-auto p-1 sm:grid sm:grid-cols-5">
                            <TabsTrigger value="general" className="text-xs sm:text-sm px-2 sm:px-3">{t('settings.general')}</TabsTrigger>
                            <TabsTrigger value="gmail" className="text-xs sm:text-sm px-2 sm:px-3">{t('settings.gmail')}</TabsTrigger>
                            <TabsTrigger value="admin" className="text-xs sm:text-sm px-2 sm:px-3">{t('settings.admin')}</TabsTrigger>
                            <TabsTrigger value="usdt" className="text-xs sm:text-sm px-2 sm:px-3">{t('settings.usdt')}</TabsTrigger>
                            <TabsTrigger value="promotions" className="text-xs sm:text-sm px-2 sm:px-3">{t('settings.promotions')}</TabsTrigger>
                        </TabsList>
                    </CardHeader>

                    <CardContent>
                        <TabsContent value="general" className="space-y-4">
                            <div className="mb-6">
                                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <Banknote className="w-5 h-5 text-green-400" />
                                    {t('settings.deposit_config')}
                                </h3>
                                <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-800 mb-4">
                                    <div>
                                        <div className="font-medium text-white">{t('settings.auto_deposit')}</div>
                                        <div className="text-sm text-slate-400">{t('settings.auto_deposit_desc')}</div>
                                    </div>
                                    <Switch
                                        checked={settings.mb_auto_deposit}
                                        onCheckedChange={() => handleToggle('mb_auto_deposit')}
                                    />
                                </div>

                                {/* Bank Provider Selection */}
                                {settings.mb_auto_deposit && (
                                    <div className="space-y-4">
                                        <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-800">
                                            <div className="font-medium text-white mb-3">{t('settings.select_bank')}</div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setSettings(prev => ({ ...prev, bank_provider: 'mbbank' }))}
                                                    className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${settings.bank_provider === 'mbbank'
                                                        ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                                                        : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                                                        }`}
                                                >
                                                    <span className="text-2xl">🏦</span>
                                                    <span className="font-medium">MBBank</span>
                                                    {settings.bank_provider === 'mbbank' && (
                                                        <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded">{t('settings.using')}</span>
                                                    )}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setSettings(prev => ({ ...prev, bank_provider: 'viettel' }))}
                                                    className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${settings.bank_provider === 'viettel'
                                                        ? 'border-red-500 bg-red-500/20 text-red-400'
                                                        : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                                                        }`}
                                                >
                                                    <span className="text-2xl">📱</span>
                                                    <span className="font-medium">Viettel Money</span>
                                                    {settings.bank_provider === 'viettel' && (
                                                        <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded">{t('settings.using')}</span>
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* MBBank Config */}
                                        {settings.bank_provider === 'mbbank' && (
                                            <div className="p-4 bg-blue-900/20 rounded-lg border border-blue-800">
                                                <div className="font-medium text-blue-400 mb-2 flex items-center gap-2">
                                                    🏦 {t('settings.mbbank_config')}
                                                </div>
                                                <div className="text-sm text-slate-400 mb-4">
                                                    {t('settings.mbbank_desc')}
                                                </div>
                                                <div className="space-y-3">
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-300 mb-1">Token MBBank (Sieuthicode)</label>
                                                        <input
                                                            type="text"
                                                            value={settings.mbbank_token}
                                                            onChange={(e) => handleChange('mbbank_token', e.target.value)}
                                                            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                            placeholder="Token MBBank từ Sieuthicode..."
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-300 mb-1">Số tài khoản MBBank (STK)</label>
                                                        <input
                                                            type="text"
                                                            value={settings.mbbank_account}
                                                            onChange={(e) => handleChange('mbbank_account', e.target.value)}
                                                            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                            placeholder="Số tài khoản MBBank..."
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Viettel Config */}
                                        {settings.bank_provider === 'viettel' && (
                                            <div className="p-4 bg-red-900/20 rounded-lg border border-red-800">
                                                <div className="font-medium text-red-400 mb-2 flex items-center gap-2">
                                                    📱 {t('settings.viettel_config')}
                                                </div>
                                                <div className="text-sm text-slate-400 mb-4">
                                                    {t('settings.viettel_desc')}
                                                </div>
                                                <div className="space-y-3">
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-300 mb-1">Token Viettel (Sieuthicode)</label>
                                                        <input
                                                            type="text"
                                                            value={settings.viettel_token}
                                                            onChange={(e) => handleChange('viettel_token', e.target.value)}
                                                            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                            placeholder="Token Viettel từ Sieuthicode..."
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-300 mb-1">Số tài khoản Viettel Money (STK)</label>
                                                        <input
                                                            type="text"
                                                            value={settings.viettel_account}
                                                            onChange={(e) => handleChange('viettel_account', e.target.value)}
                                                            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                            placeholder="Số điện thoại Viettel Money..."
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Deposit Configuration */}
                                <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-800 mt-4">
                                    <div className="font-medium text-white mb-2">💰 {t('settings.deposit_settings')}</div>
                                    <div className="text-sm text-slate-400 mb-4">{t('settings.deposit_settings_desc')}</div>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-1">{t('settings.min_deposit')}</label>
                                            <input
                                                type="number"
                                                value={settings.min_deposit}
                                                onChange={(e) => handleChange('min_deposit', e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="50000"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-1">💵 {t('settings.exchange_rate')}</label>
                                            <input
                                                type="number"
                                                value={settings.exchange_rate}
                                                onChange={(e) => handleChange('exchange_rate', e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="26000"
                                            />
                                            <div className="text-xs text-slate-500 mt-1">{t('settings.exchange_rate_hint')}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="gmail" className="space-y-6">
                            <div className="mb-6">
                                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    📧 {t('settings.gmail_edu_config')}
                                </h3>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-800">
                                        <div>
                                            <div className="font-medium text-white">{t('settings.gmail_edu_enable')}</div>
                                            <div className="text-sm text-slate-400">{t('settings.gmail_edu_enable_desc')}</div>
                                        </div>
                                        <Switch
                                            checked={settings.gmail_edu_enabled}
                                            onCheckedChange={() => handleToggle('gmail_edu_enabled')}
                                        />
                                    </div>

                                    <div className="grid gap-4 p-4 bg-slate-800/30 rounded-lg border border-slate-800">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-1">{t('settings.gmail_edu_price')}</label>
                                            <input
                                                type="number"
                                                value={settings.gmail_edu_price}
                                                onChange={(e) => handleChange('gmail_edu_price', e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="10000"
                                            />
                                            <div className="text-xs text-slate-500 mt-1">{t('settings.gmail_edu_price_hint')}</div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-1">{t('settings.gmail_edu_domain')}</label>
                                            <input
                                                type="text"
                                                value={settings.gmail_edu_domain}
                                                onChange={(e) => handleChange('gmail_edu_domain', e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="suafpoly.app"
                                            />
                                            <div className="text-xs text-slate-500 mt-1">{t('settings.gmail_edu_domain_hint')}</div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-1">{t('settings.gmail_edu_delete_hours')}</label>
                                            <input
                                                type="number"
                                                value={settings.gmail_edu_delete_hours}
                                                onChange={(e) => handleChange('gmail_edu_delete_hours', e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="1"
                                            />
                                            <div className="text-xs text-slate-500 mt-1">{t('settings.gmail_edu_delete_hours_hint')}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="admin" className="space-y-6">
                            <div className="grid gap-4 p-4 bg-slate-800/30 rounded-lg border border-slate-800">
                                <div>
                                    <div className="font-medium text-white mb-2">🔐 {t('settings.change_password')}</div>
                                    <div className="text-sm text-slate-400 mb-4">{t('settings.change_password_desc')}</div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">{t('settings.current_password')}</label>
                                        <input
                                            type="password"
                                            id="currentPassword"
                                            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder={t('settings.current_password_placeholder')}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">{t('settings.new_password')}</label>
                                        <input
                                            type="password"
                                            id="newPassword"
                                            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder={t('settings.new_password_placeholder')}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">{t('settings.confirm_password')}</label>
                                        <input
                                            type="password"
                                            id="confirmPassword"
                                            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder={t('settings.confirm_password_placeholder')}
                                        />
                                    </div>
                                    <Button
                                        onClick={async () => {
                                            const currentPassword = (document.getElementById('currentPassword') as HTMLInputElement)?.value;
                                            const newPassword = (document.getElementById('newPassword') as HTMLInputElement)?.value;
                                            const confirmPassword = (document.getElementById('confirmPassword') as HTMLInputElement)?.value;

                                            if (!currentPassword || !newPassword || !confirmPassword) {
                                                setMessage({ type: 'error', text: t('settings.fill_all_fields') });
                                                return;
                                            }
                                            if (newPassword !== confirmPassword) {
                                                setMessage({ type: 'error', text: t('settings.password_not_match') });
                                                return;
                                            }
                                            if (newPassword.length < 6) {
                                                setMessage({ type: 'error', text: t('settings.password_min_length') });
                                                return;
                                            }

                                            try {
                                                const res = await fetch('/api/admin/change-password', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ currentPassword, newPassword })
                                                });
                                                const data = await res.json();
                                                if (res.ok) {
                                                    setMessage({ type: 'success', text: t('settings.password_success') });
                                                    (document.getElementById('currentPassword') as HTMLInputElement).value = '';
                                                    (document.getElementById('newPassword') as HTMLInputElement).value = '';
                                                    (document.getElementById('confirmPassword') as HTMLInputElement).value = '';
                                                } else {
                                                    setMessage({ type: 'error', text: data.error || t('settings.password_error') });
                                                }
                                            } catch (e) {
                                                setMessage({ type: 'error', text: t('settings.server_error') });
                                            }
                                        }}
                                        className="w-full"
                                    >
                                        {t('settings.change_password_btn')}
                                    </Button>
                                </div>
                            </div>

                            <div className="grid gap-4 p-4 bg-slate-800/30 rounded-lg border border-slate-800">
                                <div>
                                    <div className="font-medium text-white mb-2">🤖 {t('settings.telegram_bot_token')}</div>
                                    <div className="text-sm text-slate-400 mb-4">{t('settings.telegram_bot_token_desc')}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Bot Token</label>
                                    <input
                                        type="password"
                                        value={settings.telegram_bot_token}
                                        onChange={(e) => handleChange('telegram_bot_token', e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                                        placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz..."
                                    />
                                </div>
                            </div>

                            <div className="grid gap-4 p-4 bg-slate-800/30 rounded-lg border border-slate-800">
                                <div>
                                    <div className="font-medium text-white mb-2">🏠 {t('settings.shop_name')}</div>
                                    <div className="text-sm text-slate-400 mb-4">{t('settings.shop_name_desc')}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Shop Name</label>
                                    <input
                                        type="text"
                                        value={settings.shop_name}
                                        onChange={(e) => handleChange('shop_name', e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="DUCVIETSTORE"
                                    />
                                </div>
                            </div>

                            <div className="grid gap-4 p-4 bg-slate-800/30 rounded-lg border border-slate-800">
                                <div>
                                    <div className="font-medium text-white mb-2">👥 {t('settings.support_group')}</div>
                                    <div className="text-sm text-slate-400 mb-4">{t('settings.support_group_desc')}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Telegram Group Link</label>
                                    <input
                                        type="text"
                                        value={settings.telegram_group_link}
                                        onChange={(e) => handleChange('telegram_group_link', e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="https://t.me/+xxxxxx"
                                    />
                                </div>
                            </div>

                            {/* Admin Telegram IDs */}
                            <div className="grid gap-4 p-4 bg-slate-800/30 rounded-lg border border-slate-800">
                                <div>
                                    <div className="font-medium text-white mb-2">👤 Admin Telegram IDs</div>
                                    <div className="text-sm text-slate-400 mb-4">Telegram ID của các admin có quyền quản trị bot (hỗ trợ nhiều ID)</div>
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newAdminId}
                                        onChange={(e) => setNewAdminId(e.target.value.replace(/\D/g, ''))}
                                        className="flex-1 bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="Nhập Telegram ID (VD: 123456789)"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && newAdminId) {
                                                e.preventDefault();
                                                const id = Number(newAdminId);
                                                if (id && !settings.admin_ids.includes(id)) {
                                                    setSettings(prev => ({ ...prev, admin_ids: [...prev.admin_ids, id] }));
                                                    setNewAdminId('');
                                                }
                                            }
                                        }}
                                    />
                                    <Button
                                        type="button"
                                        onClick={() => {
                                            const id = Number(newAdminId);
                                            if (id && !settings.admin_ids.includes(id)) {
                                                setSettings(prev => ({ ...prev, admin_ids: [...prev.admin_ids, id] }));
                                                setNewAdminId('');
                                            }
                                        }}
                                        disabled={!newAdminId}
                                    >
                                        Thêm
                                    </Button>
                                </div>
                                {settings.admin_ids.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {settings.admin_ids.map((id) => (
                                            <span
                                                key={id}
                                                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-500/20 border border-blue-500 rounded-full text-sm text-blue-400"
                                            >
                                                {id}
                                                <button
                                                    type="button"
                                                    onClick={() => setSettings(prev => ({ ...prev, admin_ids: prev.admin_ids.filter(i => i !== id) }))}
                                                    className="ml-1 hover:text-red-400"
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <div className="text-xs text-slate-500">Nhấn Enter hoặc bấm Thêm để thêm ID. Bấm × để xóa.</div>
                            </div>
                        </TabsContent>

                        <TabsContent value="usdt" className="space-y-6">
                            <div className="grid gap-4 p-4 bg-slate-800/30 rounded-lg border border-slate-800">
                                <div>
                                    <div className="font-medium text-white mb-2">💎 {t('settings.usdt_wallet')}</div>
                                    <div className="text-sm text-slate-400 mb-4">{t('settings.usdt_wallet_desc')}</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">{t('settings.usdt_wallet_address')}</label>
                                    <input
                                        type="text"
                                        value={settings.usdt_trc20_wallet}
                                        onChange={(e) => handleChange('usdt_trc20_wallet', e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                                        placeholder="TJErNxge2EkC2PAkXy9hBag4x5kWPJNKRJ"
                                    />
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="promotions">
                            <Card>
                                <CardHeader>
                                    <CardTitle>{t('settings.promotions')}</CardTitle>
                                    <CardDescription>{t('settings.promotions_desc')}</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid gap-4 p-4 border rounded-lg bg-secondary/20">
                                        <h3 className="font-semibold">{t('settings.create_promotion')}</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>{t('settings.start_time')}</Label>
                                                <Input
                                                    type="datetime-local"
                                                    value={newPromo.start_time}
                                                    onChange={(e) => setNewPromo({ ...newPromo, start_time: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>{t('settings.end_time')}</Label>
                                                <Input
                                                    type="datetime-local"
                                                    value={newPromo.end_time}
                                                    onChange={(e) => setNewPromo({ ...newPromo, end_time: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>{t('settings.bonus_percentage')}</Label>
                                                <Input
                                                    type="number"
                                                    value={newPromo.bonus_percentage}
                                                    onChange={(e) => setNewPromo({ ...newPromo, bonus_percentage: Number(e.target.value) })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>{t('settings.min_deposit_promo')}</Label>
                                                <Input
                                                    type="number"
                                                    value={newPromo.min_amount}
                                                    onChange={(e) => setNewPromo({ ...newPromo, min_amount: Number(e.target.value) })}
                                                />
                                            </div>
                                        </div>
                                        <Button onClick={handleCreatePromotion} disabled={promoLoading}>
                                            {t('settings.create_promotion_btn')}
                                        </Button>
                                    </div>

                                    <div className="border rounded-md">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>{t('settings.promo_start')}</TableHead>
                                                    <TableHead>{t('settings.promo_end')}</TableHead>
                                                    <TableHead>{t('settings.promo_bonus')}</TableHead>
                                                    <TableHead>{t('settings.min_deposit_promo')}</TableHead>
                                                    <TableHead>{t('settings.promo_status')}</TableHead>
                                                    <TableHead>{t('settings.promo_actions')}</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {promotions.map((p) => (
                                                    <TableRow key={p.id}>
                                                        <TableCell>{new Date(p.start_time).toLocaleString()}</TableCell>
                                                        <TableCell>{new Date(p.end_time).toLocaleString()}</TableCell>
                                                        <TableCell className="font-bold text-green-500">+{p.bonus_percentage}%</TableCell>
                                                        <TableCell>{formatCurrency(p.min_amount)}</TableCell>
                                                        <TableCell>{p.status}</TableCell>
                                                        <TableCell>
                                                            <Button variant="ghost" size="sm" onClick={() => handleDeletePromotion(p.id)}>
                                                                <Trash2 className="w-4 h-4 text-destructive" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                {promotions.length === 0 && (
                                                    <TableRow>
                                                        <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                                            {t('settings.no_promotions')}
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {
                            message && (
                                <div className={`p-4 rounded-lg text-sm border ${message.type === 'success'
                                    ? 'bg-green-100 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400'
                                    : 'bg-red-100 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400'
                                    }`}>
                                    {message.text}
                                </div>
                            )
                        }

                        <div className="flex justify-end pt-4">
                            <Button onClick={handleSave} disabled={saving}>
                                <Save className="w-4 h-4 mr-2" />
                                {saving ? t('settings.saving') : t('settings.save_settings')}
                            </Button>
                        </div>
                    </CardContent>
                </Tabs>
            </Card>
        </div >
    );
}
