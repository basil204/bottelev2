'use client';

import { useEffect, useState } from 'react';
import {
    Languages, Save, Search, RefreshCw, ArrowLeft, CheckCircle2,
    MessageSquare, Globe, Sparkles, HelpCircle, Code, Layers, Keyboard
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
    const [activeCategoryTab, setActiveCategoryTab] = useState<'all' | 'messages' | 'inline' | 'keyboard'>('all');
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

    const getCategory = (key: string): 'messages' | 'inline' | 'keyboard' => {
        // 1. Nút Bàn Phím Keyboard cố định bên dưới
        const keyboardKeys = [
            'btn_deposit', 'btn_buy_menu', 'btn_checkin', 'btn_support',
            'btn_utilities', 'btn_change_language', 'btn_main_menu',
            'btn_check_live', 'btn_download_all', 'btn_locket'
        ];
        if (keyboardKeys.includes(key) || key.startsWith('btn_kb_') || key.startsWith('keyboard_')) {
            return 'keyboard';
        }

        // 2. Nút Bấm Inline Keyboard dính kèm tin nhắn
        const inlineKeys = [
            'btn_buy_accounts', 'btn_order_history',
            'btn_enter_coupon', 'btn_confirm', 'btn_cancel', 'btn_back',
            'buy_now', 'btn_inline'
        ];
        if (inlineKeys.includes(key) || key.startsWith('btn_inline_') || key.startsWith('inline_') || key.startsWith('btn_buy_') || key.startsWith('btn_order_')) {
            return 'inline';
        }

        if (key.startsWith('btn_')) {
            return 'inline';
        }

        // 3. Nội dung tin nhắn / Lời nhắn Bot
        return 'messages';
    };

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

    const handleSeedFromCode = async () => {
        if (!window.confirm('Bạn có chắc muốn nạp / đồng bộ toàn bộ bộ từ vựng mặc định từ file includes/lang/messages.js vào CSDL?')) return;
        setSaving(true);
        try {
            const res = await fetch('/api/translations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'seed_from_code' })
            });
            const json = await res.json();
            if (json.success) {
                alert(json.message);
                fetchTranslations();
            } else {
                alert(json.error || 'Lỗi khi nạp từ vựng');
            }
        } catch (e) {
            alert('Có lỗi xảy ra khi nạp từ vựng từ code.');
        } finally {
            setSaving(false);
        }
    };

    // Đếm số lượng từ vựng theo từng phân loại
    const counts = {
        all: translations.length,
        messages: translations.filter(item => getCategory(item.msg_key) === 'messages').length,
        inline: translations.filter(item => getCategory(item.msg_key) === 'inline').length,
        keyboard: translations.filter(item => getCategory(item.msg_key) === 'keyboard').length,
    };

    const filteredTranslations = translations.filter(item => {
        // Phân loại Phân mục
        const category = getCategory(item.msg_key);
        if (activeCategoryTab !== 'all' && category !== activeCategoryTab) return false;

        // Phân loại Tìm kiếm
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
                        <p className="text-xs text-zinc-500 font-medium">Chỉnh sửa phân loại riêng: Lời nhắn Bot, Nút Bấm Inline và Nút Bàn Phím Keyboard từ CSDL</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSeedFromCode}
                        disabled={saving || loading}
                        className="rounded-xl border border-orange-200 bg-orange-50 px-3.5 py-2.5 text-xs font-extrabold text-orange-700 hover:bg-orange-100 transition active:scale-95 shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title="Nạp lại toàn bộ bộ câu từ mặc định từ file includes/lang/messages.js vào CSDL"
                    >
                        <Sparkles className="h-4 w-4 text-orange-600" />
                        <span>NẠP BỘ TỪ VỰNG TỪ CODE</span>
                    </button>

                    <button
                        onClick={fetchTranslations}
                        disabled={loading}
                        className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-xs font-extrabold text-zinc-700 hover:bg-zinc-50 transition active:scale-95 shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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

            {/* Category Navigation Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { id: 'all', label: 'TẤT CẢ THÀNH PHẦN', count: counts.all, icon: Layers, color: 'text-zinc-600', activeBg: 'bg-zinc-900 text-white' },
                    { id: 'messages', label: '📝 LỜI NHẮN BOT', count: counts.messages, icon: MessageSquare, color: 'text-blue-600', activeBg: 'bg-blue-600 text-white' },
                    { id: 'inline', label: '🔘 NÚT INLINE KEYBOARD', count: counts.inline, icon: Code, color: 'text-purple-600', activeBg: 'bg-purple-600 text-white' },
                    { id: 'keyboard', label: '⌨️ NÚT BÀN PHÍM KEYBOARD', count: counts.keyboard, icon: Keyboard, color: 'text-emerald-600', activeBg: 'bg-emerald-600 text-white' }
                ].map(tab => {
                    const IconComponent = tab.icon;
                    const isActive = activeCategoryTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveCategoryTab(tab.id as any)}
                            className={`p-3.5 rounded-2xl border transition-all text-left flex items-center justify-between cursor-pointer ${isActive ? `${tab.activeBg} border-transparent shadow-md` : 'bg-white border-zinc-200 hover:border-zinc-300 text-zinc-700 shadow-2xs'}`}
                        >
                            <div className="space-y-0.5">
                                <div className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 ${isActive ? 'text-white' : tab.color}`}>
                                    <IconComponent className="h-4 w-4 shrink-0" />
                                    <span>{tab.label}</span>
                                </div>
                                <div className={`text-[10px] font-semibold ${isActive ? 'text-white/80' : 'text-zinc-400'}`}>
                                    {tab.id === 'all' && 'Toàn bộ nội dung & nút bấm'}
                                    {tab.id === 'messages' && 'Tin nhắn thông báo, hướng dẫn'}
                                    {tab.id === 'inline' && 'Nút bấm đính kèm tin nhắn'}
                                    {tab.id === 'keyboard' && 'Nút bàn phím menu bên dưới'}
                                </div>
                            </div>
                            <span className={`px-2.5 py-1 rounded-xl text-xs font-black ${isActive ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-700'}`}>
                                {tab.count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Help Guide Box */}
            <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4.5 space-y-3 text-xs text-blue-950 shadow-2xs">
                <div className="font-black flex items-center gap-2 text-blue-900 text-sm border-b border-blue-100 pb-2">
                    <Sparkles className="h-4.5 w-4.5 text-blue-600 shrink-0" />
                    <span>HƯỚNG DẪN BIẾN SỐ & EMOJI ĐỘNG (TELEGRAM CUSTOM ANIMATED EMOJI):</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] leading-relaxed text-blue-900">
                    <div className="space-y-1">
                        <div className="font-extrabold text-blue-950">1. Biến số động (Variables):</div>
                        <p>
                            Sử dụng các tham số như <code className="bg-blue-100/90 px-1.5 py-0.5 rounded font-mono text-blue-950 font-bold">&#123;amount&#125;</code>, <code className="bg-blue-100/90 px-1.5 py-0.5 rounded font-mono text-blue-950 font-bold">&#123;balance&#125;</code>, <code className="bg-blue-100/90 px-1.5 py-0.5 rounded font-mono text-blue-950 font-bold">&#123;price&#125;</code>, <code className="bg-blue-100/90 px-1.5 py-0.5 rounded font-mono text-blue-950 font-bold">&#123;id&#125;</code> để Bot tự động thế giá trị.
                        </p>
                    </div>

                    <div className="space-y-1">
                        <div className="font-extrabold text-blue-950">2. Emoji động ở Lời Nhắn:</div>
                        <p>
                            Dán thẻ <code className="bg-blue-100/90 px-1.5 py-0.5 rounded font-mono text-blue-950 font-bold">&lt;tg-emoji emoji-id="5312361253610475399"&gt;🛒&lt;/tg-emoji&gt;</code> hoặc gõ <code className="bg-blue-100/90 px-1.5 py-0.5 rounded font-mono text-blue-950 font-bold">&#123;5312361253610475399&#125;</code> trong câu văn.
                        </p>
                    </div>

                    <div className="space-y-1">
                        <div className="font-extrabold text-blue-950">3. Emoji động ở Nút Bấm Inline & Keyboard:</div>
                        <p>
                            Gõ <code className="bg-blue-100/90 px-1.5 py-0.5 rounded font-mono text-blue-950 font-bold">&#123;5312361253610475399&#125; Nạp tiền</code> để Bot tự động gắn <code className="bg-blue-100/90 px-1.5 py-0.5 rounded font-mono text-blue-950 font-bold">icon_custom_emoji_id</code> chuẩn Telegram API cho cả <b>Nút Inline</b> và <b>Nút Bàn Phím Cố Định</b>!
                        </p>
                    </div>
                </div>
            </div>

            {/* Search Bar & Language Filter */}
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
                    Không tìm thấy bản dịch phù hợp với các bộ lọc hiện tại.
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredTranslations.map((item) => {
                        const category = getCategory(item.msg_key);
                        return (
                            <div key={item.msg_key} className="bg-white rounded-2xl border border-zinc-200 p-4 space-y-3 shadow-2xs hover:border-zinc-300 transition">
                                {/* Key Header */}
                                <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs font-black text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-lg">
                                            {item.msg_key}
                                        </span>
                                        
                                        {/* Category Badge */}
                                        {category === 'messages' && (
                                            <span className="text-[10px] font-extrabold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                                                <MessageSquare className="h-3 w-3" />
                                                <span>📝 LỜI NHẮN BOT</span>
                                            </span>
                                        )}
                                        {category === 'inline' && (
                                            <span className="text-[10px] font-extrabold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                                                <Code className="h-3 w-3" />
                                                <span>🔘 NÚT INLINE KEYBOARD</span>
                                            </span>
                                        )}
                                        {category === 'keyboard' && (
                                            <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                                                <Keyboard className="h-3 w-3" />
                                                <span>⌨️ NÚT BÀN PHÍM KEYBOARD</span>
                                            </span>
                                        )}
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
                                                rows={category === 'messages' ? 3 : 1}
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
                                                rows={category === 'messages' ? 3 : 1}
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
                                                rows={category === 'messages' ? 3 : 1}
                                                value={item.zh || ''}
                                                onChange={(e) => handleFieldChange(item.msg_key, 'zh', e.target.value)}
                                                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 p-2.5 text-xs font-medium text-zinc-900 outline-none focus:border-orange-500 focus:bg-white transition"
                                                placeholder="中文翻译..."
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
