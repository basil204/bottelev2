'use client';

import { useEffect, useState } from 'react';
import { Save, Banknote, CreditCard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

interface Settings {
    mb_auto_deposit: boolean;
    timo_auto_deposit: boolean;
    timo_username: string;
    timo_password: string;
    sepay_enabled: boolean;
    sepay_token: string;
    sepay_account_no: string;
    sepay_bank_code: string;
}

import { useLanguage } from '@/contexts/LanguageContext';

export default function SettingsPage() {
    const { t } = useLanguage();
    const [settings, setSettings] = useState<Settings>({
        // ... (initial state remains same)
        mb_auto_deposit: true,
        timo_auto_deposit: true,
        timo_username: '',
        timo_password: '',
        sepay_enabled: false,
        sepay_token: '',
        sepay_account_no: '',
        sepay_bank_code: '',
    });
    // ... (rest of state)
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Timo OTP State
    const [timoLoading, setTimoLoading] = useState(false);
    const [needOtp, setNeedOtp] = useState(false);
    const [otpValue, setOtpValue] = useState('');
    const [otpMessage, setOtpMessage] = useState('');

    useEffect(() => {
        fetch('/api/settings')
            .then((res) => res.json())
            .then((data) => {
                setSettings(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

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

    const handleTimoLogin = async () => {
        setTimoLoading(true);
        setOtpMessage('');
        try {
            // Call Timo Server (Internal API)
            const res = await fetch('/api/timo');
            const data = await res.json();

            if (data.needOTP) {
                setNeedOtp(true);
                setOtpMessage(t('settings.enter_otp'));
            } else if (data.success) {
                setOtpMessage('✅ ' + t('settings.success'));
                setNeedOtp(false);
            } else {
                setOtpMessage(`❌ Error: ${data.error || 'Unknown error'}`);
            }
        } catch (e) {
            setOtpMessage('❌ Connection Error');
        } finally {
            setTimoLoading(false);
        }
    };

    const submitOtp = async () => {
        if (!otpValue) return;
        setTimoLoading(true);
        try {
            const res = await fetch('/api/timo', {
                method: 'POST',
                body: JSON.stringify({ otp: otpValue })
            });
            const data = await res.json();
            if (data.success) {
                setOtpMessage('✅ Success');
                setNeedOtp(false);
                setOtpValue('');
            } else {
                setOtpMessage(`❌ Error: ${data.error}`);
            }
        } catch (e) {
            setOtpMessage('❌ Connection Error');
        } finally {
            setTimoLoading(false);
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
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Banknote className="w-5 h-5 text-primary" />
                        {t('settings.deposit_config')}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">

                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <CreditCard className="w-5 h-5 text-purple-400" />
                            {t('settings.timo_config')}
                        </h3>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-800">
                                <div>
                                    <div className="font-medium text-white">{t('settings.timo_integration')}</div>
                                    <div className="text-sm text-slate-400">{t('settings.timo_desc')}</div>
                                </div>
                                <Switch
                                    checked={settings.timo_auto_deposit}
                                    onCheckedChange={() => handleToggle('timo_auto_deposit')}
                                />
                            </div>

                            {settings.timo_auto_deposit && (
                                <div className="grid gap-4 p-4 bg-slate-800/30 rounded-lg border border-slate-800">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">{t('settings.timo_username')}</label>
                                        <input
                                            type="text"
                                            value={settings.timo_username}
                                            onChange={(e) => handleChange('timo_username', e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="e.g. 0901234567"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">{t('settings.timo_password')}</label>
                                        <input
                                            type="password"
                                            value={settings.timo_password}
                                            onChange={(e) => handleChange('timo_password', e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="••••••••"
                                        />
                                    </div>

                                    <div className="pt-2 border-t border-slate-700 mt-2">
                                        {!needOtp ? (
                                            <div className="flex items-center gap-4">
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    onClick={handleTimoLogin}
                                                    disabled={timoLoading}
                                                >
                                                    {timoLoading ? t('settings.checking') : t('settings.test_login')}
                                                </Button>
                                                {otpMessage && <span className="text-sm text-slate-300">{otpMessage}</span>}
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <div className="text-sm text-yellow-500 font-medium">⚠️ {otpMessage}</div>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={otpValue}
                                                        onChange={(e) => setOtpValue(e.target.value)}
                                                        className="bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white w-40"
                                                        placeholder={t('settings.enter_otp')}
                                                    />
                                                    <Button type="button" onClick={submitOtp} disabled={timoLoading}>
                                                        {t('settings.submit_otp')}
                                                    </Button>
                                                    <Button type="button" variant="ghost" onClick={() => setNeedOtp(false)}>{t('common.cancel')}</Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <CreditCard className="w-5 h-5 text-purple-400" />
                            {t('settings.sepay_config')}
                        </h3>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-800">
                                <div>
                                    <div className="font-medium text-white">{t('settings.sepay_integration')}</div>
                                    <div className="text-sm text-slate-400">{t('settings.sepay_desc')}</div>
                                </div>
                                <Switch
                                    checked={settings.sepay_enabled}
                                    onCheckedChange={() => handleToggle('sepay_enabled')}
                                />
                            </div>

                            {settings.sepay_enabled && (
                                <div className="grid gap-4 p-4 bg-slate-800/30 rounded-lg border border-slate-800">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">{t('settings.sepay_token')}</label>
                                        <input
                                            type="text"
                                            value={settings.sepay_token}
                                            onChange={(e) => handleChange('sepay_token', e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="e.g. AUIYQTXX..."
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-1">{t('settings.account_no')}</label>
                                            <input
                                                type="text"
                                                value={settings.sepay_account_no}
                                                onChange={(e) => handleChange('sepay_account_no', e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="e.g. 334218"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-1">{t('settings.bank_code')}</label>
                                            <input
                                                type="text"
                                                value={settings.sepay_bank_code}
                                                onChange={(e) => handleChange('sepay_bank_code', e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="e.g. MB, VCB..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

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
                </CardContent >
            </Card >
        </div >
    );
}
