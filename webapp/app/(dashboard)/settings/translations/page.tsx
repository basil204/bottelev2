'use client';

import { useEffect, useState } from 'react';
import {
    Languages, Save, Search, RefreshCw, ArrowLeft, CheckCircle2,
    MessageSquare, Globe, Sparkles, HelpCircle, Code
} from 'lucide-react';
import Link from 'next/link';

interface TranslationItem {
    msg_key: string;
    vi: string;
    en: string;
    zh: string;
    updated_at?: string;
}

export default function TranslationsPage() {
    const [translations, setTranslations] = useState<TranslationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeLangTab, setActiveLangTab] = useState<'all' | 'vi' | 'en' | 'zh'>('all');
    const [saveMessage, setSaveMessage] = useState<string | null>(null);

    const fetchTranslations = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/translations');
            const json = await res.json();
            if (json.success && Array.isArray(json.data)) {
                setTranslations(json.data);
            }
        } catch (e) {
            console.error('Failed to load translations:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTranslations();
    }, []);

    const handleFieldChange = (key: string, field: 'vi' | 'en' | 'zh', value: string) => {
        setTranslations(prev =>
            prev.map(item => item.msg_key === key ? { ...item, [field]: value } : item)
        );
    };

    const handleSaveAll = async () => {
        setSaving(true);
        setSaveMessage(null);
        try {
            const res = await fetch('/api/translations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'batch_update',
                    translations
                })
            });
            const json = await res.json();
            if (json.success) {
                setSaveMessage('✅ Đã lưu toàn bộ bản dịch ngôn ngữ thành công! Bot sẽ sử dụng ngôn ngữ mới ngay lập tức.');
                setTimeout(() => setSaveMessage(null), 5000);
            } else {
                alert(json.error || 'Lỗi khi lưu ngôn ngữ');
            }
        } catch (e) {
            alert('Lỗi kết nối server khi lưu ngôn ngữ');
        } finally {
            setSaving(false);
        }
    };

    const filteredTranslations = translations.filter(item => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;
        return (
            item.msg_key.toLowerCase().includes(query) ||
            (item.vi && item.vi.toLowerCase().includes(query)) ||
            (item.en && item.en.toLowerCase().includes(query)) ||
            (item.zh && item.zh.toLowerCase().includes(query))
        );
    });

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-3 sm:p-6">
            {/* Top Navigation */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
                <div className="flex items-center gap-3">
                    <Link
                        href="/settings"
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition"
                        title="Quay lại Cài đặt"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-zinc-900 flex items-center gap-2">
                            <Languages className="h-6 w-6 text-orange-600" />
                            <span>QUẢN LÝ NGÔN NGỮ & LỜI NHẮN BOT</span>
                        </h1>
                        <p className="text-xs text-zinc-500 font-medium">Chỉnh sửa toàn bộ thông báo, menu và nội dung phản hồi đa ngôn ngữ của Telegram Bot từ CSDL</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchTranslations}
                        disabled={loading}
                        className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs font-extrabold text-zinc-700 hover:bg-zinc-50 transition active:scale-95 shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        <span>TẢI LẠI</span>
                    </button>

                    <button
                        onClick={handleSaveAll}
                        disabled={saving || loading}
                        className="rounded-xl bg-orange-600 hover:bg-orange-700 px-6 py-2.5 text-xs font-black uppercase text-white transition active:scale-95 shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                        <Save className="h-4 w-4" />
                        <span>{saving ? 'ĐANG LƯU...' : 'LƯU TẤT CẢ THAY ĐỔI'}</span>
                    </button>
                </div>
            </div>

            {/* Notification Banner */}
            {saveMessage && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-extrabold text-emerald-800 flex items-center gap-2 animate-in fade-in duration-200 shadow-2xs">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                    <span>{saveMessage}</span>
                </div>
            )}

            {/* Help Guide Box */}
            <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 space-y-2 text-xs text-blue-950">
                <div className="font-extrabold flex items-center gap-1.5 text-blue-900">
                    <Sparkles className="h-4 w-4 text-blue-600" />
                    <span>HƯỚNG DẪN BIẾN SỐ TRONG LỜI NHẮN:</span>
                </div>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                    Bạn có thể dùng các tham số biến như <code className="bg-blue-100 px-1 py-0.5 rounded font-mono text-blue-950 font-bold">&#123;amount&#125;</code>, <code className="bg-blue-100 px-1 py-0.5 rounded font-mono text-blue-950 font-bold">&#123;balance&#125;</code>, <code className="bg-blue-100 px-1 py-0.5 rounded font-mono text-blue-950 font-bold">&#123;price&#125;</code>, <code className="bg-blue-100 px-1 py-0.5 rounded font-mono text-blue-950 font-bold">&#123;id&#125;</code> để Bot tự thế giá trị động khi gửi tin nhắn cho khách.
                </p>
            </div>

            {/* Search Bar & Filters */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-zinc-200 shadow-2xs">
                <div className="relative w-full sm:w-96">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <input
                        type="text"
                        placeholder="Tìm kiếm theo từ khóa hoặc nội dung lời nhắn..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-xl border border-zinc-200 bg-zinc-50 text-xs font-semibold outline-none focus:border-orange-500 focus:bg-white transition"
                    />
                </div>

                <div className="flex items-center gap-1 w-full sm:w-auto">
                    {[
                        { id: 'all', label: 'TẤT CẢ NGÔN NGỮ' },
                        { id: 'vi', label: '🇻🇳 Tiếng Việt' },
                        { id: 'en', label: '🇺🇸 English' },
                        { id: 'zh', label: '🇨🇳 中文' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveLangTab(tab.id as any)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${activeLangTab === tab.id ? 'bg-orange-600 text-white shadow-2xs' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Translations List */}
            {loading ? (
                <div className="py-20 text-center text-xs font-bold text-zinc-400 space-y-2">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-orange-500" />
                    <div>Đang tải dữ liệu ngôn ngữ từ CSDL...</div>
                </div>
            ) : filteredTranslations.length === 0 ? (
                <div className="py-16 text-center text-xs font-bold text-zinc-400 bg-white rounded-2xl border border-zinc-200">
                    Không tìm thấy bản dịch phù hợp với từ khóa "{searchQuery}".
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredTranslations.map((item) => (
                        <div key={item.msg_key} className="bg-white rounded-2xl border border-zinc-200 p-4 space-y-3 shadow-2xs hover:border-zinc-300 transition">
                            {/* Key Header */}
                            <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs font-black text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-lg">
                                        {item.msg_key}
                                    </span>
                                </div>
                                <span className="text-[10px] font-mono text-zinc-400">
                                    MÃ KHÓA CSDL
                                </span>
                            </div>

                            {/* Inputs Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {/* VI */}
                                {(activeLangTab === 'all' || activeLangTab === 'vi') && (
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-extrabold text-zinc-700 flex items-center gap-1">
                                            <span>🇻🇳 TIẾNG VIỆT</span>
                                        </label>
                                        <textarea
                                            rows={3}
                                            value={item.vi || ''}
                                            onChange={(e) => handleFieldChange(item.msg_key, 'vi', e.target.value)}
                                            className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 p-2.5 text-xs font-medium text-zinc-900 outline-none focus:border-orange-500 focus:bg-white transition"
                                            placeholder="Nội dung Tiếng Việt..."
                                        />
                                    </div>
                                )}

                                {/* EN */}
                                {(activeLangTab === 'all' || activeLangTab === 'en') && (
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-extrabold text-zinc-700 flex items-center gap-1">
                                            <span>🇺🇸 ENGLISH</span>
                                        </label>
                                        <textarea
                                            rows={3}
                                            value={item.en || ''}
                                            onChange={(e) => handleFieldChange(item.msg_key, 'en', e.target.value)}
                                            className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 p-2.5 text-xs font-medium text-zinc-900 outline-none focus:border-orange-500 focus:bg-white transition"
                                            placeholder="English translation..."
                                        />
                                    </div>
                                )}

                                {/* ZH */}
                                {(activeLangTab === 'all' || activeLangTab === 'zh') && (
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-extrabold text-zinc-700 flex items-center gap-1">
                                            <span>🇨🇳 中文 (CHINESE)</span>
                                        </label>
                                        <textarea
                                            rows={3}
                                            value={item.zh || ''}
                                            onChange={(e) => handleFieldChange(item.msg_key, 'zh', e.target.value)}
                                            className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 p-2.5 text-xs font-medium text-zinc-900 outline-none focus:border-orange-500 focus:bg-white transition"
                                            placeholder="中文翻译..."
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
