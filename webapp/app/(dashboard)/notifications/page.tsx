'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import {
    MessageSquare, HelpCircle, Bell, Target, RefreshCw, Search, Copy, Check, X,
    Send, CheckCircle2, Eye, ExternalLink, ShieldCheck, User, Package, FileText,
    ArrowRight, Sparkles, AlertCircle, Clock, Radio, Globe, Flame, Heart,
    ThumbsUp, ThumbsDown, Trash2, Plus, Move, Layers, Settings, ShieldAlert, Zap
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCurrency } from '@/hooks/useCurrency';

interface SupportTicket {
    id: number;
    user_id?: number | null;
    telegram_id?: number | null;
    order_id?: number | null;
    order_code?: string | null;
    product_name?: string | null;
    product_name_joined?: string | null;
    request_type: 'WARRANTY' | 'SUPPORT';
    status: 'processing' | 'completed' | 'pending';
    customer_message?: string | null;
    admin_reply?: string | null;
    customer_name?: string | null;
    customer_username?: string | null;
    customer_telegram_id?: number | null;
    order_price?: number | null;
    order_note?: string | null;
    created_at: string;
}

interface UserChat {
    id: number;
    telegram_id: number;
    username?: string | null;
    name?: string | null;
    balance: number;
    created_at?: string;
    last_ticket_id?: number;
    last_customer_message?: string | null;
    last_admin_reply?: string | null;
    last_status?: string | null;
    last_message_time?: string | null;
    unreplied_count?: number;
    total_messages?: number;
}

interface ChatMessage {
    id: number | string;
    ticket_id?: number;
    sender: 'user' | 'admin';
    text: string;
    status?: string;
    created_at: string;
}

interface RetargetingCampaign {
    id: number;
    name: string;
    product_id?: number | null;
    product_name?: string | null;
    plan_id?: string | null;
    original_price: number;
    discount_price: number;
    valid_hours: number;
    effect_tag: string;
    msg_template?: string | null;
    btn_label: string;
    banner_file_id?: string | null;
    status: 'draft' | 'running' | 'completed';
    reached_count: number;
    created_at: string;
}

interface ProductOption {
    id: number;
    name: string;
    price: number;
}

export default function NotificationsPage() {
    const { t } = useLanguage();
    const { formatPrice } = useCurrency();
    const router = useRouter();
    const searchParams = useSearchParams();
    const tabParam = searchParams.get('tab') || 'support';

    const [activeTab, setActiveTab] = useState<'support' | 'chat' | 'broadcast' | 'retargeting'>(
        ['support', 'chat', 'broadcast', 'retargeting'].includes(tabParam)
            ? (tabParam as any)
            : 'support'
    );

    useEffect(() => {
        if (['support', 'chat', 'broadcast', 'retargeting'].includes(tabParam)) {
            setActiveTab(tabParam as any);
        }
    }, [tabParam]);

    const [mounted, setMounted] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [products, setProducts] = useState<ProductOption[]>([]);

    // Support / Warranty State
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [loadingTickets, setLoadingTickets] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');

    // Modals for Support
    const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
    const [isReplyModalOpen, setIsReplyModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    // Reply Form State
    const [replyText, setReplyText] = useState('');
    const [markCompleted, setMarkCompleted] = useState(true);
    const [sendingReply, setSendingReply] = useState(false);

    // Warranty Process Form State
    const [newAccountData, setNewAccountData] = useState('');
    const [warrantyReason, setWarrantyReason] = useState('');
    const [submittingWarranty, setSubmittingWarranty] = useState(false);

    // Live Chat State
    const [chatUsers, setChatUsers] = useState<UserChat[]>([]);
    const [loadingChatUsers, setLoadingChatUsers] = useState(false);
    const [selectedChatUser, setSelectedChatUser] = useState<UserChat | null>(null);
    const [chatSearch, setChatSearch] = useState('');
    const [chatTabFilter, setChatTabFilter] = useState<'all' | 'unreplied' | 'unread' | 'replied'>('all');
    const [chatStats, setChatStats] = useState({ total: 0, unreplied: 0, newToday: 0 });
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInputText, setChatInputText] = useState('');
    const [sendingChatMessage, setSendingChatMessage] = useState(false);

    // Broadcast Sub-tab State
    const [broadcastSubTab, setBroadcastSubTab] = useState<'manual' | 'auto_restock'>('manual');

    // Manual Broadcast Form State
    const [templateName, setTemplateName] = useState('Hàng mới lên kho');
    const [sendType, setSendType] = useState('Kèm nút xem shop');
    const [broadcastMsg, setBroadcastMsg] = useState(
        `{5375135722514685501} HÀNG MỚI VỪA LÊN KHO\n\nSản phẩm hot vừa được nhập thêm.\nNhanh tay mua trước khi hết hàng.`
    );
    const [bulletEmoji, setBulletEmoji] = useState('📣');
    const [customEmojisJson, setCustomEmojisJson] = useState('{"💥": "5368324170671282286"}');
    const [inlineBtnText, setInlineBtnText] = useState('{5375135722514685501} Xem sản phẩm');
    const [inlineBtnCallback, setInlineBtnCallback] = useState('start:shop');
    const [sendingBroadcast, setSendingBroadcast] = useState(false);

    // Auto Restock Form State
    const [autoActive, setAutoActive] = useState(false);
    const [autoInterval, setAutoInterval] = useState('4');
    const [autoQuietStart, setAutoQuietStart] = useState('23:00');
    const [autoQuietEnd, setAutoQuietEnd] = useState('07:30');
    const [autoTarget, setAutoTarget] = useState<'channel' | 'dm' | 'users' | 'both'>('channel');
    const [autoChannelId, setAutoChannelId] = useState('-100123456789');
    const [autoLang, setAutoLang] = useState('vi');
    const [autoRule, setAutoRule] = useState<'random' | 'specific'>('random');
    const [autoMinQty, setAutoMinQty] = useState(15);
    const [autoMaxQty, setAutoMaxQty] = useState(50);
    const [previewLang, setPreviewLang] = useState<'VI' | 'EN' | 'RU' | 'ZH'>('VI');
    const [savingAutoConfig, setSavingAutoConfig] = useState(false);

    // Retargeting State
    const [campaigns, setCampaigns] = useState<RetargetingCampaign[]>([]);
    const [loadingCampaigns, setLoadingCampaigns] = useState(false);
    const [retargetingSearch, setRetargetingSearch] = useState('');
    const [retargetingStatusFilter, setRetargetingStatusFilter] = useState('all');
    const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
    const [retargetStats, setRetargetStats] = useState({
        totalCount: 0,
        completedCount: 0,
        runningCount: 0,
        draftCount: 0,
        reachedCount: 0
    });

    // Retargeting Form State
    const [rtName, setRtName] = useState('');
    const [rtProductId, setRtProductId] = useState('');
    const [rtPlanId, setRtPlanId] = useState('');
    const [rtOriginalPrice, setRtOriginalPrice] = useState(100000);
    const [rtDiscountPrice, setRtDiscountPrice] = useState('69000');
    const [rtValidHours, setRtValidHours] = useState(24);
    const [rtEffectTag, setRtEffectTag] = useState('{effect:🔥}');
    const [rtMsgLang, setRtMsgLang] = useState<'VI' | 'EN'>('VI');
    const [rtMsgTemplate, setRtMsgTemplate] = useState(
        `{effect: 🔥} Chào {first_name}! Bạn vừa quan tâm sản phẩm {product_name}.\n\n🎁 Shop gửi tặng bạn ƯU ĐÃI ĐẶC BIỆT: Giá chỉ còn {new_price} (Giá gốc: {old_price})!\n⏰ Hạn áp dụng: {expires_at}`
    );
    const [rtBtnLabel, setRtBtnLabel] = useState('⚡ Mua ngay với giá ưu đãi');
    const [rtBannerFileId, setRtBannerFileId] = useState('');
    const [submittingRt, setSubmittingRt] = useState(false);

    useEffect(() => {
        setMounted(true);
        fetchProducts();
        fetchTickets();
        fetchChatUsers();
        fetchAutoRestockConfig();
        fetchCampaigns();
    }, []);

    const fetchProducts = () => {
        fetch('/api/products')
            .then((res) => res.json())
            .then((data) => {
                const list = Array.isArray(data) ? data : data.data || [];
                setProducts(list.map((p: any) => ({ id: p.id, name: p.name, price: Number(p.price) || 0 })));
            })
            .catch((err) => console.error(err));
    };

    const fetchTickets = () => {
        setLoadingTickets(true);
        const params = new URLSearchParams({ search: searchTerm, status: statusFilter, type: typeFilter });
        fetch(`/api/support?${params.toString()}`)
            .then((res) => res.json())
            .then((data) => {
                setTickets(Array.isArray(data.data) ? data.data : []);
                setLoadingTickets(false);
            })
            .catch(() => { setTickets([]); setLoadingTickets(false); });
    };

    const fetchChatUsers = (silent = false) => {
        if (!silent) setLoadingChatUsers(true);
        fetch(`/api/support?action=chat_conversations&tab=${chatTabFilter}&search=${encodeURIComponent(chatSearch)}`)
            .then((res) => res.json())
            .then((data) => {
                const list = Array.isArray(data.data) ? data.data : [];
                setChatUsers(list);
                if (data.stats) setChatStats(data.stats);
                if (!silent) setLoadingChatUsers(false);
                if (list.length > 0 && !selectedChatUser) {
                    setSelectedChatUser(list[0]);
                    fetchUserChatHistory(list[0]);
                }
            })
            .catch(() => {
                if (!silent) {
                    setChatUsers([]);
                    setLoadingChatUsers(false);
                }
            });
    };

    const fetchUserChatHistory = (u: UserChat, silent = false) => {
        const tid = u.telegram_id || u.id;
        fetch(`/api/support?action=chat_history&telegramId=${tid}`)
            .then(res => res.json())
            .then(data => {
                const list = Array.isArray(data.data) ? data.data : [];
                setChatMessages(list);
            })
            .catch(() => {
                if (!silent) setChatMessages([]);
            });
    };

    const handleMarkAllRead = async () => {
        if (!selectedChatUser) return;
        const tid = selectedChatUser.telegram_id || selectedChatUser.id;
        await fetch('/api/support', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'mark_all_read', telegramId: tid })
        });
        fetchChatUsers(true);
        fetchUserChatHistory(selectedChatUser, true);
    };

    const fetchAutoRestockConfig = () => {
        fetch('/api/broadcast/auto-restock')
            .then((res) => res.json())
            .then((data) => {
                if (data.config) {
                    setAutoActive(data.config.isActive);
                    setAutoInterval(String(data.config.intervalHours));
                    setAutoQuietStart(data.config.quietStart);
                    setAutoQuietEnd(data.config.quietEnd);
                    setAutoTarget(data.config.targetType);
                    setAutoChannelId(data.config.channelId);
                    setAutoLang(data.config.channelLang);
                    setAutoRule(data.config.fakeRule);
                    setAutoMinQty(data.config.minQty);
                    setAutoMaxQty(data.config.maxQty);
                }
            })
            .catch((err) => console.error(err));
    };

    const fetchCampaigns = () => {
        setLoadingCampaigns(true);
        const params = new URLSearchParams({ search: retargetingSearch, status: retargetingStatusFilter });
        fetch(`/api/retargeting?${params.toString()}`)
            .then((res) => res.json())
            .then((data) => {
                setCampaigns(Array.isArray(data.data) ? data.data : []);
                if (data.stats) setRetargetStats(data.stats);
                setLoadingCampaigns(false);
            })
            .catch(() => { setCampaigns([]); setLoadingCampaigns(false); });
    };

    useEffect(() => {
        if (activeTab === 'support') fetchTickets();
        if (activeTab === 'chat') {
            fetchChatUsers();
            const interval = setInterval(() => {
                fetchChatUsers(true);
                if (selectedChatUser) {
                    fetchUserChatHistory(selectedChatUser, true);
                }
            }, 3000);
            return () => clearInterval(interval);
        }
        if (activeTab === 'retargeting') fetchCampaigns();
    }, [activeTab, statusFilter, typeFilter, chatTabFilter, selectedChatUser?.telegram_id, retargetingStatusFilter]);

    const handleCopy = (text: string, fieldId: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedField(fieldId);
        setTimeout(() => setCopiedField(null), 2000);
    };

    // Support Reply
    const openReplyModal = (ticket: SupportTicket) => {
        setSelectedTicket(ticket);
        const codeStr = ticket.order_code || (ticket.order_id ? String(ticket.order_id) : '5f4cc00c');
        setReplyText(`Xin chào, liên quan đến yêu cầu bảo hành đơn hàng #${codeStr}, shop đã kiểm tra và xử lý xong cho bạn rồi nhé.`);
        setMarkCompleted(true);
        setIsReplyModalOpen(true);
    };

    const handleSendReply = async () => {
        if (!selectedTicket || !replyText.trim()) {
            alert('Vui lòng nhập nội dung tin nhắn!');
            return;
        }

        const tid = selectedTicket.customer_telegram_id || selectedTicket.telegram_id || selectedTicket.user_id;
        if (!tid) {
            alert('Khách hàng không có Telegram ID hợp lệ!');
            return;
        }

        setSendingReply(true);
        try {
            const res = await fetch('/api/support', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'send_reply',
                    requestId: selectedTicket.id,
                    telegramId: tid,
                    replyText: replyText.trim(),
                    markCompleted
                })
            });

            if (res.ok) {
                alert('Đã gửi tin nhắn phản hồi Telegram thành công!');
                setIsReplyModalOpen(false);
                fetchTickets();
            } else {
                const data = await res.json();
                alert(data.error || 'Lỗi gửi tin nhắn');
            }
        } catch (e) {
            alert('Lỗi kết nối server');
        } finally {
            setSendingReply(false);
        }
    };

    // Warranty Process
    const openDetailModal = (ticket: SupportTicket) => {
        setSelectedTicket(ticket);
        setIsDetailModalOpen(true);
        setNewAccountData('');
        setWarrantyReason('');
    };

    const handleProcessWarranty = async () => {
        if (!selectedTicket || !newAccountData.trim()) {
            alert('Vui lòng nhập/chọn tài khoản bảo hành mới!');
            return;
        }

        setSubmittingWarranty(true);
        try {
            const res = await fetch('/api/support', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'process_warranty',
                    orderId: selectedTicket.order_id || selectedTicket.id,
                    newAccountData: newAccountData.trim(),
                    warrantyNote: warrantyReason.trim()
                })
            });

            if (res.ok) {
                alert('Đã xử lý bảo hành thành công!');
                setIsDetailModalOpen(false);
                fetchTickets();
            } else {
                const data = await res.json();
                alert(data.error || 'Lỗi xử lý bảo hành');
            }
        } catch (e) {
            alert('Lỗi kết nối server');
        } finally {
            setSubmittingWarranty(false);
        }
    };

    const handleMarkCompleted = async (ticketId: number) => {
        const res = await fetch('/api/support', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'mark_completed', requestId: ticketId })
        });
        if (res.ok) fetchTickets();
    };

    // Live Chat Send
    const handleSendChatMessage = async () => {
        if (!selectedChatUser || !chatInputText.trim()) return;
        const textToSend = chatInputText.trim();
        setSendingChatMessage(true);
        try {
            const res = await fetch('/api/support', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'send_reply',
                    telegramId: selectedChatUser.telegram_id || selectedChatUser.id,
                    replyText: textToSend
                })
            });

            if (res.ok) {
                setChatInputText('');
                fetchUserChatHistory(selectedChatUser, true);
                fetchChatUsers(true);
            }
        } catch (e) {
            alert('Lỗi gửi tin nhắn');
        } finally {
            setSendingChatMessage(false);
        }
    };

    // Manual Broadcast Send
    const handleSendManualBroadcast = async () => {
        if (!broadcastMsg.trim()) {
            alert('Vui lòng nhập nội dung thông báo!');
            return;
        }

        setSendingBroadcast(true);
        try {
            const res = await fetch('/api/broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: broadcastMsg.trim(), type: 'custom' })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                alert(`Đã phát sóng tin nhắn thành công tới ${data.sent || 0} người dùng!`);
            } else {
                alert(data.error || 'Lỗi phát sóng thông báo');
            }
        } catch (e) {
            alert('Lỗi kết nối server');
        } finally {
            setSendingBroadcast(false);
        }
    };

    // Save Auto Restock Config
    const handleSaveAutoConfig = async () => {
        setSavingAutoConfig(true);
        try {
            const res = await fetch('/api/broadcast/auto-restock', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'save_config',
                    isActive: autoActive,
                    intervalHours: Number(autoInterval),
                    quietStart: autoQuietStart,
                    quietEnd: autoQuietEnd,
                    targetType: autoTarget,
                    channelId: autoChannelId,
                    channelLang: autoLang,
                    fakeRule: autoRule,
                    minQty: autoMinQty,
                    maxQty: autoMaxQty
                })
            });

            if (res.ok) {
                alert('Lưu cấu hình hẹn giờ thông báo kho ảo thành công!');
            } else {
                const data = await res.json();
                alert(data.error || 'Lỗi lưu cấu hình');
            }
        } catch (e) {
            alert('Lỗi kết nối server');
        } finally {
            setSavingAutoConfig(false);
        }
    };

    const handleTestAutoRestock = async () => {
        const res = await fetch('/api/broadcast/auto-restock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'test_run' })
        });
        if (res.ok) alert('Đã gửi tin nhắn thông báo kho ảo thử nghiệm!');
    };

    // Create / Save Retargeting Campaign
    const handleSaveRetargetingCampaign = async (statusVal: 'draft' | 'running') => {
        if (!rtName.trim() || !rtDiscountPrice) {
            alert('Vui lòng nhập Tên chiến dịch và Mức giá ưu đãi!');
            return;
        }

        setSubmittingRt(true);
        try {
            const res = await fetch('/api/retargeting', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: rtName.trim(),
                    productId: rtProductId || null,
                    planId: rtPlanId || null,
                    originalPrice: rtOriginalPrice,
                    discountPrice: Number(rtDiscountPrice),
                    validHours: rtValidHours,
                    effectTag: rtEffectTag,
                    msgTemplate: rtMsgTemplate,
                    btnLabel: rtBtnLabel,
                    bannerFileId: rtBannerFileId,
                    status: statusVal
                })
            });

            if (res.ok) {
                alert(`Đã ${statusVal === 'running' ? 'khởi chạy' : 'lưu bản nháp'} chiến dịch re-targeting thành công!`);
                setIsCreateFormOpen(false);
                setRtName('');
                fetchCampaigns();
            } else {
                const data = await res.json();
                alert(data.error || 'Lỗi tạo chiến dịch');
            }
        } catch (e) {
            alert('Lỗi kết nối server');
        } finally {
            setSubmittingRt(false);
        }
    };

    const insertEffectChip = (effectCode: string) => {
        setBroadcastMsg(prev => prev + ` ${effectCode}`);
    };

    const insertRtVariable = (varName: string) => {
        setRtMsgTemplate(prev => prev + ` ${varName}`);
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(val) + ' đ';
    };

    const formatTimeStr = (dateStr?: string | null) => {
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

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-2 sm:p-4">
            {/* Top Navigation Tabs Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => { setActiveTab('support'); router.push('/notifications?tab=support'); }}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition flex items-center gap-2 ${activeTab === 'support' ? 'bg-orange-600 text-white shadow-xs' : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'}`}
                    >
                        <HelpCircle className="h-4 w-4" />
                        <span>HỖ TRỢ / BẢO HÀNH</span>
                    </button>
                    <button
                        onClick={() => { setActiveTab('chat'); router.push('/notifications?tab=chat'); }}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition flex items-center gap-2 ${activeTab === 'chat' ? 'bg-orange-600 text-white shadow-xs' : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'}`}
                    >
                        <MessageSquare className="h-4 w-4" />
                        <span>TRÒ CHUYỆN / CHAT</span>
                    </button>
                    <button
                        onClick={() => { setActiveTab('broadcast'); router.push('/notifications?tab=broadcast'); }}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition flex items-center gap-2 ${activeTab === 'broadcast' ? 'bg-orange-600 text-white shadow-xs' : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'}`}
                    >
                        <Bell className="h-4 w-4" />
                        <span>THÔNG BÁO</span>
                    </button>
                    <button
                        onClick={() => { setActiveTab('retargeting'); router.push('/notifications?tab=retargeting'); }}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition flex items-center gap-2 ${activeTab === 'retargeting' ? 'bg-orange-600 text-white shadow-xs' : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'}`}
                    >
                        <Target className="h-4 w-4" />
                        <span>RE-TARGETING</span>
                    </button>
                </div>

                <button
                    onClick={() => { fetchTickets(); fetchChatUsers(); fetchCampaigns(); }}
                    title="Tải lại"
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 active:scale-95 transition shadow-2xs"
                >
                    <RefreshCw className={`h-4 w-4 ${loadingTickets || loadingChatUsers || loadingCampaigns ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* TAB 1: HỖ TRỢ / BẢO HÀNH */}
            {activeTab === 'support' && (
                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600 font-bold border border-orange-200 shadow-2xs">
                                <MessageSquare className="h-5 w-5" />
                            </div>
                            <div>
                                <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-zinc-900 flex items-center gap-2">
                                    HỖ TRỢ / BẢO HÀNH
                                </h1>
                                <p className="text-xs text-zinc-500 font-medium">Tiếp nhận, nhắn tin phản hồi và xử lý bảo hành cho khách hàng</p>
                            </div>
                        </div>

                        <button
                            onClick={() => { setActiveTab('chat'); router.push('/notifications?tab=chat'); }}
                            className="rounded-xl border border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100 px-4 py-2.5 text-xs font-extrabold uppercase transition active:scale-95 shadow-2xs flex items-center gap-1.5"
                        >
                            <MessageSquare className="h-4 w-4" />
                            <span>MỞ LIVE CHAT</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                        <div className="sm:col-span-6 relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Tìm theo tin nhắn, tên khách hàng hoặc mã đơn hàng..."
                                className="w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-4 py-2.5 text-xs font-medium text-zinc-900 outline-none focus:border-orange-500 transition shadow-2xs"
                            />
                        </div>

                        <div className="sm:col-span-3">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full h-full min-h-[38px] rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 outline-none focus:border-orange-500 transition shadow-2xs"
                            >
                                <option value="all">Tất cả trạng thái</option>
                                <option value="processing">Đang xử lý</option>
                                <option value="completed">Đã xong</option>
                            </select>
                        </div>

                        <div className="sm:col-span-3 flex gap-2">
                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 outline-none focus:border-orange-500 transition shadow-2xs"
                            >
                                <option value="all">Tất cả loại yêu cầu</option>
                                <option value="WARRANTY">Bảo hành</option>
                                <option value="SUPPORT">Hỗ trợ</option>
                            </select>

                            <button onClick={fetchTickets} className="rounded-xl bg-orange-600 px-5 text-xs font-extrabold uppercase text-white hover:bg-orange-700 active:scale-95 transition shadow-xs whitespace-nowrap">
                                TÌM KIẾM
                            </button>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-white shadow-2xs overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-zinc-100 bg-zinc-50/60 text-[11px] font-black uppercase tracking-wider text-zinc-500">
                                        <th className="px-4 py-3.5 font-extrabold">THỜI GIAN</th>
                                        <th className="px-4 py-3.5 font-extrabold text-center">LOẠI</th>
                                        <th className="px-4 py-3.5 font-extrabold text-center">TRẠNG THÁI</th>
                                        <th className="px-4 py-3.5 font-extrabold">KHÁCH HÀNG</th>
                                        <th className="px-4 py-3.5 font-extrabold">SẢN PHẨM</th>
                                        <th className="px-4 py-3.5 font-extrabold">ĐƠN HÀNG</th>
                                        <th className="px-4 py-3.5 font-extrabold">GHI CHÚ YÊU CẦU</th>
                                        <th className="px-4 py-3.5 font-extrabold text-right">THAO TÁC</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100">
                                    {loadingTickets ? (
                                        <tr><td colSpan={8} className="py-12 text-center text-xs font-medium text-zinc-400">Đang tải...</td></tr>
                                    ) : tickets.length === 0 ? (
                                        <tr><td colSpan={8} className="py-12 text-center text-xs font-medium text-zinc-400">Không có yêu cầu bảo hành hoặc hỗ trợ nào.</td></tr>
                                    ) : (
                                        tickets.map((t) => {
                                            const tid = t.customer_telegram_id || t.telegram_id || t.user_id;
                                            return (
                                                <tr key={t.id} className="hover:bg-zinc-50/80 transition-colors">
                                                    <td className="px-4 py-3.5 font-mono text-[10px] text-zinc-500">{formatTimeStr(t.created_at)}</td>
                                                    <td className="px-4 py-3.5 text-center">
                                                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase border ${t.request_type === 'WARRANTY' ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-zinc-100 text-zinc-700 border-zinc-200'}`}>
                                                            {t.request_type === 'WARRANTY' ? 'BẢO HÀNH' : 'HỖ TRỢ'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3.5 text-center">
                                                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase border ${t.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                                            {t.status === 'completed' ? 'XONG' : 'ĐANG XỬ LÝ'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        <div className="font-extrabold text-zinc-900 text-xs">{t.customer_name || 'ANK Neeeeee'}</div>
                                                        <div className="text-[10px] font-mono text-zinc-500 mt-0.5 flex items-center gap-1.5">
                                                            <span>ID: <strong>{tid || '5865174169'}</strong></span>
                                                            <button onClick={() => handleCopy(String(tid || '5865174169'), `uid-${t.id}`)}><Copy className="h-3 w-3 text-zinc-400" /></button>
                                                            {t.customer_username && <span className="text-orange-600 font-bold">@{t.customer_username}</span>}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3.5 font-extrabold text-zinc-900 text-xs">{t.product_name || t.product_name_joined || 'Sản phẩm VIP #6'}</td>
                                                    <td className="px-4 py-3.5">
                                                        <div className="font-mono font-bold text-zinc-900 text-xs">{t.order_code || '5f4cc00c'}</div>
                                                        <div className="text-[10px] font-mono text-zinc-400 mt-0.5">PTN1411EDI2BJSBNY</div>
                                                    </td>
                                                    <td className="px-4 py-3.5 text-xs text-zinc-500 italic">{t.customer_message || 'Không có tin nhắn'}</td>
                                                    <td className="px-4 py-3.5 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <button onClick={() => openReplyModal(t)} className="rounded-xl border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-[11px] font-bold text-orange-600 hover:bg-orange-100 transition flex items-center gap-1">
                                                                <Send className="h-3.5 w-3.5" /><span>NHẮN TIN</span>
                                                            </button>
                                                            <button onClick={() => openDetailModal(t)} className="rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-zinc-700 hover:bg-zinc-50 transition flex items-center gap-1">
                                                                <Eye className="h-3.5 w-3.5 text-zinc-400" /><span>CHI TIẾT</span>
                                                            </button>
                                                            <button onClick={() => handleMarkCompleted(t.id)} className="rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-extrabold text-emerald-700 hover:bg-emerald-100 transition">
                                                                XONG
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
                </div>
            )}

            {/* TAB 2: TRÒ CHUYỆN / CHAT (REALTIME BOT) */}
            {activeTab === 'chat' && (
                <div className="space-y-6">
                    {/* Header with Realtime Indicator & Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 font-black border border-orange-200 shadow-2xs">
                                <MessageSquare className="h-6 w-6" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-zinc-900">
                                        TRÒ CHUYỆN / CHAT
                                    </h1>
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-black text-emerald-700">
                                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                        <span>REALTIME BOT</span>
                                    </div>
                                </div>
                                <p className="text-xs text-zinc-500 font-medium">
                                    Hội thoại trực tiếp với khách hàng Telegram · Tự động phân loại tin nhắn chưa đọc & chưa trả lời
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    fetchChatUsers();
                                    if (selectedChatUser) fetchUserChatHistory(selectedChatUser);
                                }}
                                className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-extrabold uppercase text-zinc-700 hover:bg-zinc-50 transition active:scale-95 shadow-2xs flex items-center gap-1.5 cursor-pointer"
                            >
                                <RefreshCw className={`h-3.5 w-3.5 ${loadingChatUsers ? 'animate-spin text-orange-600' : ''}`} />
                                <span>LÀM MỚI</span>
                            </button>
                        </div>
                    </div>

                    {/* Chat Main Workspace Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[calc(100vh-14rem)] min-h-[600px]">
                        {/* LEFT COLUMN: CUSTOMER CONVERSATION LIST */}
                        <div className="lg:col-span-4 rounded-2xl border border-zinc-200/80 bg-white flex flex-col overflow-hidden shadow-2xs">
                            {/* Search & Header */}
                            <div className="p-3.5 border-b border-zinc-100 space-y-3 bg-zinc-50/50">
                                <div className="flex items-center justify-between">
                                    <span className="font-extrabold text-xs uppercase text-zinc-800 tracking-wider flex items-center gap-1.5">
                                        <User className="h-3.5 w-3.5 text-orange-600" />
                                        <span>KHÁCH HÀNG</span>
                                    </span>
                                    <span className="rounded-full bg-orange-50 border border-orange-200 px-2 py-0.5 text-[10px] font-extrabold text-orange-600">
                                        {chatUsers.length} hội thoại
                                    </span>
                                </div>

                                {/* Category Filters */}
                                <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-zinc-200/60 text-[11px] font-bold">
                                    <button
                                        type="button"
                                        onClick={() => setChatTabFilter('all')}
                                        className={`py-1 rounded-lg transition text-center cursor-pointer ${
                                            chatTabFilter === 'all' ? 'bg-white text-zinc-900 shadow-2xs font-extrabold' : 'text-zinc-600 hover:text-zinc-900'
                                        }`}
                                    >
                                        Tất cả
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setChatTabFilter('unreplied')}
                                        className={`py-1 rounded-lg transition text-center flex items-center justify-center gap-1 cursor-pointer ${
                                            chatTabFilter === 'unreplied' ? 'bg-white text-red-600 shadow-2xs font-extrabold' : 'text-zinc-600 hover:text-zinc-900'
                                        }`}
                                    >
                                        <span>Chưa rep</span>
                                        {chatStats.unreplied > 0 && (
                                            <span className="rounded-full bg-red-500 text-white text-[9px] px-1 py-0.2 font-black leading-none">
                                                {chatStats.unreplied}
                                            </span>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setChatTabFilter('unread')}
                                        className={`py-1 rounded-lg transition text-center flex items-center justify-center gap-1 cursor-pointer ${
                                            chatTabFilter === 'unread' ? 'bg-white text-orange-600 shadow-2xs font-extrabold' : 'text-zinc-600 hover:text-zinc-900'
                                        }`}
                                    >
                                        <span>Mới nhất</span>
                                        {chatStats.newToday > 0 && (
                                            <span className="rounded-full bg-orange-500 text-white text-[9px] px-1 py-0.2 font-black leading-none">
                                                {chatStats.newToday}
                                            </span>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setChatTabFilter('replied')}
                                        className={`py-1 rounded-lg transition text-center cursor-pointer ${
                                            chatTabFilter === 'replied' ? 'bg-white text-emerald-700 shadow-2xs font-extrabold' : 'text-zinc-600 hover:text-zinc-900'
                                        }`}
                                    >
                                        Đã xong
                                    </button>
                                </div>

                                {/* Search Bar */}
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                                    <input
                                        type="text"
                                        value={chatSearch}
                                        onChange={(e) => setChatSearch(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && fetchChatUsers()}
                                        placeholder="Tìm theo tên, username, telegram ID..."
                                        className="w-full rounded-xl border border-zinc-200 bg-white pl-8 pr-3 py-1.5 text-xs font-medium text-zinc-900 outline-none focus:border-orange-500 transition"
                                    />
                                    {chatSearch && (
                                        <button
                                            onClick={() => { setChatSearch(''); fetchChatUsers(); }}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* User List */}
                            <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 p-1.5 space-y-1">
                                {loadingChatUsers && chatUsers.length === 0 ? (
                                    <div className="p-8 text-center text-xs text-zinc-400">
                                        <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2 text-orange-600" />
                                        <span>Đang tải danh sách hội thoại...</span>
                                    </div>
                                ) : chatUsers.length === 0 ? (
                                    <div className="p-8 text-center text-xs text-zinc-400">
                                        Không tìm thấy hội thoại nào phù hợp.
                                    </div>
                                ) : (
                                    chatUsers.map(u => {
                                        const isSelected = selectedChatUser?.id === u.id || selectedChatUser?.telegram_id === u.telegram_id;
                                        const isUnreplied = Number(u.unreplied_count) > 0 || (u.last_customer_message && (!u.last_admin_reply || u.last_admin_reply.trim() === '') && u.last_status !== 'completed');
                                        const previewText = u.last_customer_message
                                            ? `Khách: ${u.last_customer_message}`
                                            : (u.last_admin_reply ? `Bạn: ${u.last_admin_reply}` : 'Chưa có tin nhắn');

                                        let formattedTime = '';
                                        if (u.last_message_time) {
                                            const d = new Date(u.last_message_time);
                                            formattedTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
                                        }

                                        return (
                                            <button
                                                key={u.telegram_id || u.id}
                                                onClick={() => {
                                                    setSelectedChatUser(u);
                                                    fetchUserChatHistory(u);
                                                }}
                                                className={`w-full text-left p-3 rounded-2xl transition cursor-pointer relative ${
                                                    isSelected
                                                        ? 'bg-orange-50 border border-orange-200 shadow-2xs'
                                                        : 'hover:bg-zinc-50 border border-transparent'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div className={`h-8 w-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                                                            isUnreplied
                                                                ? 'bg-red-50 text-red-600 border border-red-200 ring-2 ring-red-400/30'
                                                                : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                                                        }`}>
                                                            {u.name ? u.name.slice(0, 1).toUpperCase() : 'U'}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="font-extrabold text-xs text-zinc-900 truncate">
                                                                    {u.name || u.username || `User #${u.id}`}
                                                                </span>
                                                                {u.username && (
                                                                    <span className="text-[10px] font-bold text-orange-600 shrink-0">
                                                                        @{u.username}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-[10px] font-mono text-zinc-400 truncate">
                                                                ID: {u.telegram_id || u.id}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                                                        {formattedTime && (
                                                            <span className="text-[9px] font-mono text-zinc-400">
                                                                {formattedTime}
                                                            </span>
                                                        )}
                                                        {isUnreplied ? (
                                                            <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 border border-red-200 px-1.5 py-0.2 text-[9px] font-black text-red-700 animate-pulse">
                                                                CHƯA REP
                                                            </span>
                                                        ) : (
                                                            u.last_admin_reply && (
                                                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-600">
                                                                    <Check className="h-2.5 w-2.5" /> Đã trả lời
                                                                </span>
                                                            )
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Last Message Snippet */}
                                                <div className="mt-2 text-[11px] text-zinc-500 font-medium truncate flex items-center gap-1">
                                                    <span className="truncate">{previewText}</span>
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* RIGHT COLUMN: LIVE CHAT WINDOW */}
                        <div className="lg:col-span-8 rounded-2xl border border-zinc-200/80 bg-white flex flex-col overflow-hidden shadow-2xs">
                            {selectedChatUser ? (
                                <>
                                    {/* Chat Header */}
                                    <div className="p-3.5 border-b border-zinc-100 bg-zinc-50/60 flex items-center justify-between shrink-0">
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-xl bg-orange-100 text-orange-700 font-black flex items-center justify-center border border-orange-200 text-sm">
                                                {selectedChatUser.name ? selectedChatUser.name.slice(0, 1).toUpperCase() : 'U'}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-sm text-zinc-900">
                                                        {selectedChatUser.name || 'Khách hàng'}
                                                    </span>
                                                    {selectedChatUser.username && (
                                                        <span className="text-xs font-bold text-orange-600 font-mono">
                                                            @{selectedChatUser.username}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[11px] font-mono text-zinc-500 flex items-center gap-2">
                                                    <span>Telegram ID: <strong>{selectedChatUser.telegram_id || selectedChatUser.id}</strong></span>
                                                    <span>·</span>
                                                    <span>Số dư: <strong className="text-emerald-600">{formatPrice(Number(selectedChatUser.balance) || 0)}</strong></span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={handleMarkAllRead}
                                                className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-700 hover:bg-emerald-100 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                                title="Đánh dấu các yêu cầu của khách là Đã Xong"
                                            >
                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                                <span>ĐÃ XỬ LÝ</span>
                                            </button>

                                            <button
                                                onClick={() => fetchUserChatHistory(selectedChatUser)}
                                                className="p-2 rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 transition cursor-pointer shadow-2xs"
                                                title="Tải lại tin nhắn"
                                            >
                                                <RefreshCw className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Chat Message Stream */}
                                    <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-zinc-50/40">
                                        <div className="text-center text-[11px] text-zinc-400 font-medium">
                                            Lịch sử hội thoại Telegram với {selectedChatUser.name || `@${selectedChatUser.username || selectedChatUser.telegram_id}`}
                                        </div>

                                        {chatMessages.length === 0 ? (
                                            <div className="py-16 text-center text-xs text-zinc-400 max-w-sm mx-auto space-y-2">
                                                <MessageSquare className="h-8 w-8 mx-auto text-zinc-300 stroke-1" />
                                                <p>Chưa có lịch sử tin nhắn. Nhập nội dung bên dưới và bấm <strong>GỬI</strong> để nhắn tin trực tiếp qua Telegram tới khách hàng.</p>
                                            </div>
                                        ) : (
                                            chatMessages.map((m, idx) => {
                                                const isAdmin = m.sender === 'admin';
                                                let msgTime = '';
                                                if (m.created_at) {
                                                    const d = new Date(m.created_at);
                                                    msgTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} · ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
                                                }

                                                return (
                                                    <div
                                                        key={m.id || idx}
                                                        className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'} space-y-1`}
                                                    >
                                                        <div
                                                            className={`max-w-[78%] rounded-2xl p-3.5 text-xs leading-relaxed shadow-2xs whitespace-pre-wrap break-words ${
                                                                isAdmin
                                                                    ? 'bg-orange-600 text-white rounded-br-xs'
                                                                    : 'bg-white border border-zinc-200/80 text-zinc-900 rounded-bl-xs'
                                                            }`}
                                                        >
                                                            {m.text}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400 px-1">
                                                            <span>{isAdmin ? 'Admin' : (selectedChatUser.name || 'Khách')}</span>
                                                            {msgTime && <span>· {msgTime}</span>}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>

                                    {/* Quick Reply Suggestions */}
                                    <div className="px-3 py-1.5 border-t border-zinc-100 bg-white flex items-center gap-1.5 overflow-x-auto text-[11px]">
                                        <span className="text-zinc-400 font-bold shrink-0 text-[10px] uppercase">Gợi ý nhanh:</span>
                                        {[
                                            '👋 Chào bạn, shop có thể hỗ trợ gì ạ?',
                                            '✅ Shop đã kiểm tra và xử lý xong cho bạn rồi nhé!',
                                            '📦 Bạn vui lòng cung cấp mã đơn hàng để shop kiểm tra nhé.',
                                            '🙏 Cảm ơn bạn đã tin tưởng và ủng hộ shop!'
                                        ].map((template, tIdx) => (
                                            <button
                                                key={tIdx}
                                                type="button"
                                                onClick={() => setChatInputText(template)}
                                                className="px-2 py-0.5 rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition whitespace-nowrap shrink-0 text-[11px] cursor-pointer"
                                            >
                                                {template}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Chat Input Bar */}
                                    <div className="p-3 border-t border-zinc-100 bg-white flex items-center gap-2 shrink-0">
                                        <input
                                            type="text"
                                            value={chatInputText}
                                            onChange={(e) => setChatInputText(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                                            placeholder={`Nhập nội dung tin nhắn gửi tới ${selectedChatUser.name || selectedChatUser.username || selectedChatUser.telegram_id}... (Enter để gửi)`}
                                            className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50/50 px-4 py-2.5 text-xs font-medium text-zinc-900 outline-none focus:bg-white focus:border-orange-500 transition"
                                        />
                                        <button
                                            onClick={handleSendChatMessage}
                                            disabled={sendingChatMessage || !chatInputText.trim()}
                                            className="rounded-xl bg-orange-600 hover:bg-orange-700 text-white px-5 py-2.5 text-xs font-black uppercase shadow-xs flex items-center gap-1.5 disabled:opacity-40 transition active:scale-95 cursor-pointer"
                                        >
                                            <Send className={`h-3.5 w-3.5 ${sendingChatMessage ? 'animate-pulse' : ''}`} />
                                            <span>{sendingChatMessage ? 'ĐANG GỬI...' : 'GỬI'}</span>
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
                                    <div className="h-16 w-16 rounded-3xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600">
                                        <MessageSquare className="h-8 w-8 stroke-1" />
                                    </div>
                                    <div>
                                        <h3 className="font-extrabold text-sm text-zinc-800">Chưa chọn cuộc trò chuyện</h3>
                                        <p className="text-xs font-medium text-zinc-400 max-w-sm mt-1">
                                            Vui lòng chọn một khách hàng từ danh sách bên trái để xem lịch sử và chat realtime qua Telegram.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: THÔNG BÁO */}
            {activeTab === 'broadcast' && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600 font-bold border border-orange-200 shadow-2xs">
                                <Bell className="h-5 w-5" />
                            </div>
                            <div>
                                <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-zinc-900 flex items-center gap-2">
                                    THÔNG BÁO
                                </h1>
                                <p className="text-xs text-zinc-500 font-medium">Gửi tin nhắn thông báo hàng loạt đến người dùng Telegram</p>
                            </div>
                        </div>

                        <button onClick={() => { fetchTickets(); fetchAutoRestockConfig(); }} className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-extrabold uppercase text-zinc-700 hover:bg-zinc-50 flex items-center gap-1.5">
                            <RefreshCw className="h-3.5 w-3.5" /><span>LÀM MỚI</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setBroadcastSubTab('manual')}
                            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase transition flex items-center gap-2 ${broadcastSubTab === 'manual' ? 'bg-orange-600 text-white shadow-xs' : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'}`}
                        >
                            <Send className="h-4 w-4" />
                            <span>GỬI THÔNG BÁO THỦ CÔNG</span>
                        </button>

                        <button
                            onClick={() => setBroadcastSubTab('auto_restock')}
                            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase transition flex items-center gap-2 ${broadcastSubTab === 'auto_restock' ? 'bg-orange-600 text-white shadow-xs' : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'}`}
                        >
                            <Clock className="h-4 w-4" />
                            <span>HẸN GIỜ THÔNG BÁO KHO ẢO (AUTO RESTOCK)</span>
                        </button>
                    </div>

                    {broadcastSubTab === 'manual' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">MẪU THÔNG BÁO</span>
                                    <div className="text-xl font-black text-zinc-900 mt-1">15</div>
                                </div>
                                <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">KIỂU GỬI</span>
                                    <div className="text-sm font-black text-orange-600 mt-1">{sendType}</div>
                                </div>
                                <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">SẢN PHẨM</span>
                                    <div className="text-xl font-black text-zinc-900 mt-1">21</div>
                                </div>
                                <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">MẪU ĐANG CHỌN</span>
                                    <div className="text-sm font-black text-zinc-900 mt-1 truncate">{templateName}</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                                <div className="lg:col-span-8 rounded-2xl border border-zinc-200 bg-white p-5 space-y-4 shadow-2xs">
                                    <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                                        <div>
                                            <h2 className="font-extrabold text-xs uppercase text-zinc-800 tracking-wider flex items-center gap-1.5">
                                                <Send className="h-4 w-4 text-orange-600" />
                                                <span>GỬI THÔNG BÁO NGAY</span>
                                            </h2>
                                            <p className="text-[11px] text-zinc-400">Soạn nội dung và chọn kiểu gửi phù hợp</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-bold text-zinc-700 hover:bg-zinc-100">💾 LƯU MẪU</button>
                                            <button onClick={() => setBroadcastMsg('')} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-bold text-zinc-700 hover:bg-zinc-100">ĐẶT LẠI</button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div className="space-y-1">
                                            <label className="font-extrabold uppercase text-zinc-700 text-[11px]">TÊN MẪU</label>
                                            <input type="text" value={templateName} onChange={e => setTemplateName(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 font-semibold text-zinc-900 outline-none focus:border-orange-500" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="font-extrabold uppercase text-zinc-700 text-[11px]">KIỂU GỬI</label>
                                            <select value={sendType} onChange={e => setSendType(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 font-semibold text-zinc-900 outline-none focus:border-orange-500">
                                                <option value="Kèm nút xem shop">Kèm nút xem shop</option>
                                                <option value="Chỉ tin nhắn">Chỉ tin nhắn</option>
                                                <option value="Gửi kèm ảnh">Gửi kèm ảnh</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5 text-xs">
                                        <div className="flex items-center justify-between">
                                            <label className="font-extrabold uppercase text-zinc-700 text-[11px]">NỘI DUNG</label>
                                            <div className="flex items-center gap-1 flex-wrap text-[10px]">
                                                <span className="text-zinc-400">✨ Hiệu ứng:</span>
                                                <button type="button" onClick={() => insertEffectChip('{effect:fire}')} className="px-2 py-0.5 rounded bg-orange-50 border border-orange-200 text-orange-700 font-bold">🔥 Lửa</button>
                                                <button type="button" onClick={() => insertEffectChip('{effect:party}')} className="px-2 py-0.5 rounded bg-purple-50 border border-purple-200 text-purple-700 font-bold">🎉 Pháo hoa</button>
                                                <button type="button" onClick={() => insertEffectChip('{effect:heart}')} className="px-2 py-0.5 rounded bg-pink-50 border border-pink-200 text-pink-700 font-bold">❤️ Tim</button>
                                                <button type="button" onClick={() => insertEffectChip('{effect:like}')} className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 font-bold">👍 Like</button>
                                            </div>
                                        </div>
                                        <textarea rows={6} value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-mono text-xs text-zinc-900 outline-none focus:border-orange-500 transition leading-relaxed" />
                                        <p className="text-[10px] text-zinc-400 italic">Hỗ trợ thẻ hiệu ứng toàn màn hình: &#123;effect:fire&#125;, &#123;effect:party&#125; (tự động gửi trong chat riêng).</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div className="space-y-1">
                                            <label className="font-extrabold uppercase text-zinc-700 text-[11px]">EMOJI ĐẦU DÒNG</label>
                                            <input type="text" value={bulletEmoji} onChange={e => setBulletEmoji(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 font-semibold text-zinc-900 outline-none focus:border-orange-500" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="font-extrabold uppercase text-zinc-700 text-[11px]">ẢNH ĐÍNH KÈM</label>
                                            <input type="file" className="w-full rounded-xl border border-zinc-200 bg-white p-1.5 text-xs text-zinc-500" />
                                        </div>
                                    </div>

                                    <div className="space-y-1 text-xs">
                                        <label className="font-extrabold uppercase text-zinc-700 text-[11px]">CUSTOM_EMOJIS</label>
                                        <textarea rows={2} value={customEmojisJson} onChange={e => setCustomEmojisJson(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 font-mono text-zinc-900 outline-none focus:border-orange-500 text-[11px]" />
                                    </div>

                                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-3 text-xs">
                                        <div className="flex items-center justify-between">
                                            <span className="font-extrabold uppercase text-zinc-800 text-[11px]">BÀN PHÍM NÚT BẤM INLINE</span>
                                            <div className="flex items-center gap-1.5">
                                                <button type="button" className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[10px] font-bold text-zinc-700">+ THÊM DÒNG</button>
                                                <button type="button" className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[10px] font-bold text-zinc-700">SỬA JSON</button>
                                            </div>
                                        </div>

                                        <div className="rounded-xl border border-zinc-200 bg-white p-3 space-y-2">
                                            <span className="font-bold text-[10px] uppercase text-zinc-400 block">DÒNG 1 (1/4)</span>
                                            <input type="text" value={inlineBtnText} onChange={e => setInlineBtnText(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-white p-2 font-semibold text-zinc-900 text-xs" />
                                            <input type="text" value={inlineBtnCallback} onChange={e => setInlineBtnCallback(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-white p-2 font-mono text-zinc-800 text-xs" />
                                        </div>
                                    </div>

                                    <button onClick={handleSendManualBroadcast} disabled={sendingBroadcast} className="w-full rounded-xl bg-orange-600 hover:bg-orange-700 text-white py-3.5 font-extrabold uppercase transition active:scale-95 shadow-xs flex items-center justify-center gap-2">
                                        <Send className="h-4 w-4" /><span>{sendingBroadcast ? 'ĐANG GỬI...' : '🚀 GỬI THÔNG BÁO NGAY'}</span>
                                    </button>
                                </div>

                                <div className="lg:col-span-4 space-y-4">
                                    <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-3 shadow-2xs">
                                        <div className="font-extrabold text-xs uppercase text-zinc-800 flex items-center gap-1.5 border-b border-zinc-100 pb-2">
                                            <FileText className="h-4 w-4 text-orange-600" /><span>MẪU THÔNG BÁO</span>
                                        </div>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                                            <input type="text" placeholder="Tìm mẫu..." className="w-full rounded-xl border border-zinc-200 bg-white pl-8 pr-3 py-1.5 text-xs font-medium outline-none" />
                                        </div>

                                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                            <div className="p-2.5 rounded-xl border border-orange-200 bg-orange-50/50 space-y-1 cursor-pointer">
                                                <div className="flex items-center justify-between font-extrabold text-xs text-orange-900">
                                                    <span>#1 · HÀNG MỚI LÊN KHO</span>
                                                    <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[9px] font-mono">view_shop</span>
                                                </div>
                                                <p className="text-[10px] text-zinc-500 font-mono truncate">&#123;5375135722514685501&#125; HÀNG MỚI VỪA LÊN KHO...</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-3 shadow-2xs">
                                        <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                                            <span className="font-extrabold text-xs uppercase text-zinc-800 flex items-center gap-1.5">
                                                <Eye className="h-4 w-4 text-orange-600" /><span>XEM TRƯỚC</span>
                                            </span>
                                            <Copy className="h-3.5 w-3.5 text-zinc-400 cursor-pointer" />
                                        </div>

                                        <div className="rounded-2xl bg-zinc-900 p-4 text-white text-xs font-sans space-y-3 shadow-inner">
                                            <div className="whitespace-pre-wrap leading-relaxed text-[11px]">
                                                {broadcastMsg}
                                            </div>
                                            <button className="w-full rounded-xl bg-slate-800 border border-slate-700 py-2 font-bold text-center text-sky-400 text-[11px]">
                                                {inlineBtnText}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {broadcastSubTab === 'auto_restock' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">TRẠNG THÁI TỰ ĐỘNG</span>
                                    <div className="text-sm font-black text-red-600 mt-1 flex items-center gap-1.5">
                                        <span>{autoActive ? '🟢 ĐÃ BẬT' : '🔴 ĐÃ TẮT'}</span>
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">TẦN SUẤT PHÁT SỐNG</span>
                                    <div className="text-base font-black text-orange-600 mt-1">Mỗi {autoInterval} giờ</div>
                                </div>
                                <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">ĐỐI TƯỢNG NHẬN TIN</span>
                                    <div className="text-xs font-black text-purple-700 mt-1 uppercase">📢 CHỈ KÊNH TELEGRAM</div>
                                </div>
                                <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">LẦN PHÁT GẦN NHẤT</span>
                                    <div className="text-xs font-semibold text-zinc-500 mt-1">Chưa chạy lần nào</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                                <div className="lg:col-span-8 space-y-4">
                                    <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4 shadow-2xs">
                                        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                                            <h2 className="font-extrabold text-xs uppercase text-zinc-800 tracking-wider flex items-center gap-2">
                                                <Zap className="h-4 w-4 text-orange-600" />
                                                <span>1. KÍCH HOẠT & LỊCH TRÌNH PHÁT SỐNG</span>
                                            </h2>
                                            <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-zinc-800">
                                                <input type="checkbox" checked={autoActive} onChange={e => setAutoActive(e.target.checked)} className="rounded accent-orange-600 h-4 w-4" />
                                                <span>Bật tự động</span>
                                            </label>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                            <div className="space-y-1.5">
                                                <label className="font-extrabold uppercase text-zinc-700 text-[11px]">CHU KỲ GỬI THÔNG BÁO</label>
                                                <select value={autoInterval} onChange={e => setAutoInterval(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-semibold text-zinc-900 outline-none focus:border-orange-500">
                                                    <option value="4">Mỗi 4 giờ (Khuyên dùng)</option>
                                                    <option value="2">Mỗi 2 giờ</option>
                                                    <option value="6">Mỗi 6 giờ</option>
                                                    <option value="12">Mỗi 12 giờ</option>
                                                </select>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="font-extrabold uppercase text-zinc-700 text-[11px]">KHUNG GIỜ IM LẶNG (QUIET HOURS)</label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <input type="time" value={autoQuietStart} onChange={e => setAutoQuietStart(e.target.value)} className="rounded-xl border border-zinc-200 bg-white p-2.5 font-mono text-zinc-800 text-xs outline-none" />
                                                    <input type="time" value={autoQuietEnd} onChange={e => setAutoQuietEnd(e.target.value)} className="rounded-xl border border-zinc-200 bg-white p-2.5 font-mono text-zinc-800 text-xs outline-none" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4 shadow-2xs">
                                        <div className="border-b border-zinc-100 pb-3">
                                            <h2 className="font-extrabold text-xs uppercase text-zinc-800 tracking-wider flex items-center gap-2">
                                                <Radio className="h-4 w-4 text-orange-600" />
                                                <span>2. KÊNH PHÁT SỐNG & ĐA NGÔN NGỮ (I18N)</span>
                                            </h2>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                            <div className="space-y-1.5 md:col-span-2">
                                                <label className="font-extrabold uppercase text-zinc-700 text-[11px]">ĐỐI TƯỢNG NHẬN THÔNG BÁO</label>
                                                <select value={autoTarget} onChange={e => setAutoTarget(e.target.value as any)} className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-semibold text-zinc-900 outline-none focus:border-orange-500">
                                                    <option value="channel">📢 Gửi tới Kênh Telegram (Channel / Group)</option>
                                                    <option value="users">👥 Gửi tới Toàn bộ Người dùng trong CSDL (All Users)</option>
                                                    <option value="both">🚀 Gửi cả Kênh Telegram VÀ Toàn bộ Người dùng trong CSDL</option>
                                                </select>
                                                <p className="text-[10px] text-zinc-500 font-medium italic">💡 Nếu bỏ qua / để trống ID Kênh Telegram bên dưới, hệ thống sẽ tự động phát sóng tới Toàn bộ Người dùng trong CSDL.</p>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="font-extrabold uppercase text-zinc-700 text-[11px]">ID KÊNH TELEGRAM HOẶC @CHANNEL_USERNAME (CÓ THỂ BỎ QUA)</label>
                                                <input type="text" value={autoChannelId} onChange={e => setAutoChannelId(e.target.value)} placeholder="-100123456789 hoặc @my_channel (để trống nếu gửi toàn bộ user)" className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-mono text-zinc-900 text-xs outline-none focus:border-orange-500" />
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="font-extrabold uppercase text-zinc-700 text-[11px]">NGÔN NGỮ ĐĂNG LÊN KÊNH</label>
                                                <select value={autoLang} onChange={e => setAutoLang(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-semibold text-zinc-900 outline-none focus:border-orange-500">
                                                    <option value="vi">VN Tiếng Việt (vi)</option>
                                                    <option value="en">EN English (en)</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons for Auto Restock */}
                                    <div className="flex items-center gap-3 pt-1">
                                        <button
                                            type="button"
                                            onClick={handleSaveAutoConfig}
                                            disabled={savingAutoConfig}
                                            className="rounded-xl bg-orange-600 hover:bg-orange-700 text-white px-6 py-2.5 text-xs font-extrabold uppercase transition active:scale-95 shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                                        >
                                            <span>{savingAutoConfig ? 'ĐANG LƯU...' : '💾 LƯU CẤU HÌNH AUTO RESTOCK'}</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleTestAutoRestock}
                                            className="rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 px-5 py-2.5 text-xs font-extrabold uppercase transition active:scale-95 shadow-2xs flex items-center gap-1.5"
                                        >
                                            <Send className="h-4 w-4 text-orange-600" />
                                            <span>🧪 THỬ NGHỆM GỬI THÔNG BÁO (TEST RUN)</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="lg:col-span-4">
                                    <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-3 shadow-2xs">
                                        <span className="font-extrabold text-xs uppercase text-zinc-800 flex items-center gap-1.5 border-b border-zinc-100 pb-2">
                                            <Eye className="h-4 w-4 text-orange-600" /><span>XEM TRƯỚC TIN NHẮN TELEGRAM</span>
                                        </span>
                                        <div className="rounded-2xl bg-slate-900 p-4 text-slate-100 text-xs font-sans space-y-3 shadow-inner">
                                            <div className="space-y-2 leading-relaxed text-[11px]">
                                                <div>🔥 <strong>*THÔNG BÁO NHẬP KHO HÀNG*</strong></div>
                                                <div>📦 Sản phẩm: <strong>*Sản phẩm VIP #4*</strong></div>
                                                <div>⚡ Vừa về thêm: <strong>*+{autoMinQty}*</strong> sản phẩm</div>
                                                <div className="text-amber-400">👉 Bấm nút bên dưới để vào mua ngay kẻo hết hàng!</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 4: RE-TARGETING (Screenshots 1 & 2) */}
            {activeTab === 'retargeting' && (
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600 font-bold border border-orange-200 shadow-2xs">
                                <Target className="h-5 w-5" />
                            </div>
                            <div>
                                <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-zinc-900 flex items-center gap-2">
                                    CHIẾN DỊCH RE-TARGETING
                                </h1>
                                <p className="text-xs text-zinc-500 font-medium">
                                    Tự động phân tích khách đã xem sản phẩm nhưng chưa thanh toán, áp dụng giá ưu đãi cá nhân và gửi thông báo tiếp cận lại qua Telegram
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsCreateFormOpen(prev => !prev)}
                                className="rounded-xl bg-orange-600 hover:bg-orange-700 text-white px-5 py-2.5 text-xs font-extrabold uppercase transition active:scale-95 shadow-xs flex items-center gap-1.5"
                            >
                                {isCreateFormOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                <span>{isCreateFormOpen ? 'ĐÓNG' : '+ TẠO CHIẾN DỊCH MỚI'}</span>
                            </button>

                            <button
                                onClick={fetchCampaigns}
                                title="Tải lại"
                                className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 active:scale-95 transition shadow-2xs"
                            >
                                <RefreshCw className={`h-4 w-4 ${loadingCampaigns ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* 5 Summary Stat Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">TỔNG CHIẾN DỊCH</span>
                            <div className="text-xl font-black text-zinc-900 mt-1">{retargetStats.totalCount}</div>
                        </div>

                        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">HOÀN TẤT</span>
                            <div className="text-xl font-black text-emerald-600 mt-1">{retargetStats.completedCount}</div>
                        </div>

                        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">ĐANG CHẠY</span>
                            <div className="text-xl font-black text-sky-500 mt-1">{retargetStats.runningCount}</div>
                        </div>

                        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">BẢN NHÁP</span>
                            <div className="text-xl font-black text-orange-500 mt-1">{retargetStats.draftCount}</div>
                        </div>

                        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">KHÁCH TIẾP CẬN</span>
                            <div className="text-xl font-black text-red-500 mt-1">{retargetStats.reachedCount}</div>
                        </div>
                    </div>

                    {/* Form Card (When Opened) */}
                    {isCreateFormOpen && (
                        <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4 shadow-xs animate-in zoom-in-95 duration-150">
                            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-orange-600" />
                                    <h2 className="font-extrabold text-xs uppercase text-zinc-800 tracking-wider">
                                        THIẾT LẬP CHIẾN DỊCH
                                    </h2>
                                </div>
                                <button type="button" onClick={() => setIsCreateFormOpen(false)} className="text-[11px] font-bold text-zinc-400 hover:text-zinc-700 uppercase">
                                    ✕ ĐÓNG
                                </button>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                                {/* Left Form (8 Cols) */}
                                <div className="lg:col-span-8 space-y-4 text-xs">
                                    <div className="space-y-1.5">
                                        <label className="font-extrabold uppercase text-zinc-700 text-[11px]">
                                            TÊN CHIẾN DỊCH <span className="text-orange-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={rtName}
                                            onChange={(e) => setRtName(e.target.value)}
                                            placeholder="VD: Ưu đãi đặc biệt giảm giá VPS Pro cho khách đã xem"
                                            className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-semibold text-zinc-900 outline-none focus:border-orange-500 transition"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <label className="font-extrabold uppercase text-zinc-700 text-[11px]">
                                                CHỌN SẢN PHẨM <span className="text-orange-500">*</span>
                                            </label>
                                            <select
                                                value={rtProductId}
                                                onChange={(e) => {
                                                    setRtProductId(e.target.value);
                                                    const prod = products.find(p => String(p.id) === e.target.value);
                                                    if (prod) {
                                                        setRtOriginalPrice(prod.price);
                                                        setRtDiscountPrice(String(Math.round(prod.price * 0.7)));
                                                    }
                                                }}
                                                className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 font-semibold text-zinc-900 outline-none focus:border-orange-500 transition"
                                            >
                                                <option value="">-- Chọn sản phẩm mục tiêu --</option>
                                                {products.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name} - {formatCurrency(p.price)}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="font-extrabold uppercase text-zinc-700 text-[11px]">
                                                CHỌN GÓI CƯỚC (TÙY CHỌN)
                                            </label>
                                            <select
                                                value={rtPlanId}
                                                onChange={(e) => setRtPlanId(e.target.value)}
                                                className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 font-semibold text-zinc-900 outline-none focus:border-orange-500 transition"
                                            >
                                                <option value="">-- Áp dụng cho cả sản phẩm --</option>
                                                <option value="PLAN_MONTH">Gói 1 Tháng</option>
                                                <option value="PLAN_YEAR">Gói 1 Năm</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <label className="font-extrabold uppercase text-zinc-700 text-[11px]">GIÁ GỐC</label>
                                            <div className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 font-mono font-bold text-zinc-800">
                                                {formatCurrency(rtOriginalPrice)}
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="font-extrabold uppercase text-zinc-700 text-[11px]">
                                                MỨC GIÁ ƯU ĐÃI (VND) <span className="text-orange-500">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                value={rtDiscountPrice}
                                                onChange={(e) => setRtDiscountPrice(e.target.value)}
                                                placeholder="Nhập giá giảm cho khách..."
                                                className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 font-bold text-zinc-900 outline-none focus:border-orange-500 transition"
                                            />
                                        </div>
                                    </div>

                                    {/* Valid hours buttons */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <label className="font-extrabold uppercase text-zinc-700 text-[11px] flex items-center gap-1">
                                                <Clock className="h-3.5 w-3.5 text-orange-500" />
                                                <span>THỜI HẠN ÁP DỤNG ƯU ĐÃI</span>
                                            </label>
                                            <span className="text-[10px] font-bold text-orange-600">{rtValidHours} giờ kể từ lúc gửi</span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {[
                                                { hours: 12, label: '⚡ 12 GIỜ' },
                                                { hours: 24, label: '⚡ 24 GIỜ' },
                                                { hours: 48, label: '⏳ 48 GIỜ' },
                                                { hours: 168, label: '⌛ 7 NGÀY' },
                                                { hours: 9999, label: '♾️ VÔ THỜI HẠN' }
                                            ].map(opt => (
                                                <button
                                                    key={opt.hours}
                                                    type="button"
                                                    onClick={() => setRtValidHours(opt.hours)}
                                                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${rtValidHours === opt.hours ? 'bg-orange-600 text-white shadow-xs' : 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'}`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Effects Chips */}
                                    <div className="space-y-1.5">
                                        <label className="font-extrabold uppercase text-zinc-700 text-[11px] block">
                                            HIỆU ỨNG TOÀN MÀN HÌNH (TELEGRAM MESSAGE EFFECTS):
                                        </label>
                                        <div className="flex flex-wrap gap-1.5 text-[11px]">
                                            <button type="button" onClick={() => setRtEffectTag('{effect:🔥}')} className="px-2.5 py-1 rounded-lg border border-orange-200 bg-orange-50 text-orange-700 font-bold">👌 🔥 Lửa cháy</button>
                                            <button type="button" onClick={() => setRtEffectTag('{effect:🎉}')} className="px-2.5 py-1 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 font-bold">🎉 Pháo hoa</button>
                                            <button type="button" onClick={() => setRtEffectTag('{effect:❤️}')} className="px-2.5 py-1 rounded-lg border border-pink-200 bg-pink-50 text-pink-700 font-bold">❤️ Thả tim</button>
                                            <button type="button" onClick={() => setRtEffectTag('{effect:👍}')} className="px-2.5 py-1 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 font-bold">👍 Like</button>
                                            <button type="button" onClick={() => setRtEffectTag('{effect:👎}')} className="px-2.5 py-1 rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-700 font-bold">👎 Dislike</button>
                                            <button type="button" onClick={() => setRtEffectTag('{effect:💩}')} className="px-2.5 py-1 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 font-bold">💩 Poop</button>
                                        </div>
                                    </div>

                                    {/* Variables Chips */}
                                    <div className="space-y-1.5">
                                        <label className="font-extrabold uppercase text-zinc-700 text-[11px] block">
                                            NHÃN ĐỂ CHÈN BIẾN:
                                        </label>
                                        <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                                            {['{first_name}', '{product_name}', '{old_price}', '{new_price}', '{expires_at}', '{valid_hours}'].map(v => (
                                                <button type="button" key={v} onClick={() => insertRtVariable(v)} className="px-2 py-0.5 rounded border border-orange-200 bg-orange-50 text-orange-700 font-bold">
                                                    {v}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Language Switch Tabs */}
                                    <div className="flex items-center gap-2 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => setRtMsgLang('VI')}
                                            className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase transition ${rtMsgLang === 'VI' ? 'bg-orange-600 text-white shadow-xs' : 'border border-zinc-200 bg-white text-zinc-700'}`}
                                        >
                                            🇻🇳 TIẾNG VIỆT
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setRtMsgLang('EN')}
                                            className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase transition ${rtMsgLang === 'EN' ? 'bg-orange-600 text-white shadow-xs' : 'border border-zinc-200 bg-white text-zinc-700'}`}
                                        >
                                            🇬🇧 ENGLISH
                                        </button>
                                    </div>

                                    {/* Message Template Textarea */}
                                    <div className="space-y-1.5">
                                        <label className="font-extrabold uppercase text-zinc-700 text-[11px]">
                                            MẪU TIN NHẮN (TIẾNG VIỆT) <span className="text-orange-500">*</span>
                                        </label>
                                        <textarea
                                            rows={5}
                                            value={rtMsgTemplate}
                                            onChange={(e) => setRtMsgTemplate(e.target.value)}
                                            className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-mono text-xs text-zinc-900 outline-none focus:border-orange-500 transition leading-relaxed"
                                        />
                                    </div>

                                    {/* Button Label Input */}
                                    <div className="space-y-1.5">
                                        <label className="font-extrabold uppercase text-zinc-700 text-[11px]">
                                            NHÃN NÚT BẤM (TIẾNG VIỆT)
                                        </label>
                                        <input
                                            type="text"
                                            value={rtBtnLabel}
                                            onChange={(e) => setRtBtnLabel(e.target.value)}
                                            placeholder="⚡ Mua ngay với giá ưu đãi"
                                            className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 font-bold text-zinc-900 outline-none focus:border-orange-500 transition"
                                        />
                                    </div>

                                    {/* Banner File ID Input */}
                                    <div className="space-y-1.5">
                                        <label className="font-extrabold uppercase text-zinc-700 text-[11px]">
                                            TELEGRAM FILE ID ÁNH BANNER (TÙY CHỌN)
                                        </label>
                                        <input
                                            type="text"
                                            value={rtBannerFileId}
                                            onChange={(e) => setRtBannerFileId(e.target.value)}
                                            placeholder="Dán telegram file id nếu muốn gửi ảnh kèm caption..."
                                            className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 font-mono text-zinc-800 text-xs outline-none focus:border-orange-500 transition"
                                        />
                                    </div>

                                    {/* Bottom Action Buttons */}
                                    <div className="flex items-center gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => handleSaveRetargetingCampaign('draft')}
                                            disabled={submittingRt}
                                            className="rounded-xl border border-zinc-200 bg-white px-5 py-2.5 font-extrabold uppercase text-zinc-700 hover:bg-zinc-50 transition active:scale-95 shadow-2xs disabled:opacity-50"
                                        >
                                            LƯU BẢN NHÁP
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleSaveRetargetingCampaign('running')}
                                            disabled={submittingRt}
                                            className="rounded-xl bg-orange-600 hover:bg-orange-700 text-white px-6 py-2.5 font-extrabold uppercase transition active:scale-95 shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                                        >
                                            <Zap className="h-4 w-4 fill-white" />
                                            <span>{submittingRt ? 'ĐANG CHẠY...' : '⚡ CHẠY CHIẾN DỊCH NGAY'}</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Right Panel (4 Cols): Target Audience Stats & Preview */}
                                <div className="lg:col-span-4 space-y-4">
                                    {/* Card 1: ĐỐI TƯỢNG MỤC TIÊU */}
                                    <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-3 shadow-2xs">
                                        <div className="font-extrabold text-xs uppercase text-zinc-800 flex items-center gap-1.5 border-b border-zinc-100 pb-2">
                                            <User className="h-4 w-4 text-orange-600" />
                                            <span>ĐỐI TƯỢNG MỤC TIÊU (KHÁCH XEM CHƯA MUA)</span>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2 text-center">
                                            <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-2.5">
                                                <div className="text-base font-black text-zinc-900">0</div>
                                                <span className="text-[9px] font-extrabold uppercase text-zinc-400 block mt-0.5">TỔNG KHÁCH</span>
                                            </div>

                                            <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-2.5">
                                                <div className="text-base font-black text-emerald-600">0</div>
                                                <span className="text-[9px] font-extrabold uppercase text-zinc-400 block mt-0.5">TIẾNG VIỆT VN</span>
                                            </div>

                                            <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-2.5">
                                                <div className="text-base font-black text-sky-500">0</div>
                                                <span className="text-[9px] font-extrabold uppercase text-zinc-400 block mt-0.5">TIẾNG ANH GB</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card 2: XEM TRƯỚC TIN NHẮN TELEGRAM */}
                                    <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-3 shadow-2xs">
                                        <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                                            <span className="font-extrabold text-xs uppercase text-zinc-800 flex items-center gap-1.5">
                                                <Eye className="h-4 w-4 text-orange-600" />
                                                <span>XEM TRƯỚC TIN NHẮN TELEGRAM</span>
                                            </span>
                                            <span className="text-[10px] font-extrabold text-orange-600">TIẾNG VIỆT</span>
                                        </div>

                                        {/* Telegram Dark Box */}
                                        <div className="rounded-2xl bg-zinc-900 p-4 text-zinc-100 text-xs font-sans space-y-3 shadow-inner">
                                            <div className="text-[10px] font-bold text-amber-400 bg-zinc-800/80 px-2 py-0.5 rounded w-fit">
                                                ✨ EFFECT: 🔥
                                            </div>

                                            <div className="whitespace-pre-wrap leading-relaxed text-[11px] text-zinc-200">
                                                Chào Nam! Bạn vừa quan tâm sản phẩm VPS Pro.
                                                <br /><br />
                                                🎁 Shop gửi tặng bạn ƯU ĐÃI ĐẶC BIỆT: Giá chỉ còn <strong>{formatCurrency(Number(rtDiscountPrice) || 69000)}</strong> (Giá gốc: {formatCurrency(rtOriginalPrice)})!
                                                <br />
                                                ⏰ Hạn áp dụng: 20:12 ngày 25/08/2026
                                                <br /><br />
                                                👉 Bấm nút bên dưới để nhận ngay ưu đãi:
                                            </div>

                                            <button className="w-full rounded-xl bg-orange-600 hover:bg-orange-700 py-2.5 font-extrabold text-center text-white text-xs shadow-xs flex items-center justify-center gap-1.5">
                                                <Zap className="h-3.5 w-3.5 fill-white" />
                                                <span>{rtBtnLabel}</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Search & Filter Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-zinc-200 shadow-2xs">
                        <div className="relative flex-1">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                            <input
                                type="text"
                                value={retargetingSearch}
                                onChange={(e) => setRetargetingSearch(e.target.value)}
                                placeholder="Tìm kiếm chiến dịch theo tên, sản phẩm, ID..."
                                className="w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-4 py-2 text-xs font-medium text-zinc-900 outline-none focus:border-orange-500 transition"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <select
                                value={retargetingStatusFilter}
                                onChange={(e) => setRetargetingStatusFilter(e.target.value)}
                                className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-800 outline-none focus:border-orange-500 transition"
                            >
                                <option value="all">Tất cả trạng thái</option>
                                <option value="running">Đang chạy</option>
                                <option value="draft">Bản nháp</option>
                                <option value="completed">Hoàn tất</option>
                            </select>

                            <button
                                onClick={fetchCampaigns}
                                title="Tải lại"
                                className="p-2 rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 transition shadow-2xs"
                            >
                                <RefreshCw className={`h-4 w-4 ${loadingCampaigns ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Campaigns List / Empty State */}
                    <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center shadow-2xs">
                        {loadingCampaigns ? (
                            <div className="text-xs font-medium text-zinc-400">Đang tải danh sách chiến dịch...</div>
                        ) : campaigns.length === 0 ? (
                            <div className="text-xs font-extrabold uppercase text-zinc-400 tracking-wider">
                                CHƯA CÓ CHIẾN DỊCH NÀO ĐƯỢC TẠO
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="border-b border-zinc-100 bg-zinc-50/60 text-[11px] font-black uppercase tracking-wider text-zinc-500">
                                            <th className="px-4 py-3 font-extrabold">TÊN CHIẾN DỊCH</th>
                                            <th className="px-4 py-3 font-extrabold">SẢN PHẨM</th>
                                            <th className="px-4 py-3 font-extrabold text-right">GIÁ ƯU ĐÃI</th>
                                            <th className="px-4 py-3 font-extrabold text-center">THỜI HẠN</th>
                                            <th className="px-4 py-3 font-extrabold text-center">TIẾP CẬN</th>
                                            <th className="px-4 py-3 font-extrabold text-center">TRẠNG THÁI</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100">
                                        {campaigns.map(c => (
                                            <tr key={c.id} className="hover:bg-zinc-50/80">
                                                <td className="px-4 py-3.5 font-bold text-zinc-900">{c.name}</td>
                                                <td className="px-4 py-3.5 font-semibold text-zinc-800">{c.product_name || 'Tất cả'}</td>
                                                <td className="px-4 py-3.5 text-right font-black text-orange-600">{formatCurrency(c.discount_price)}</td>
                                                <td className="px-4 py-3.5 text-center font-mono text-xs">{c.valid_hours} giờ</td>
                                                <td className="px-4 py-3.5 text-center font-mono font-bold text-zinc-800">{c.reached_count}</td>
                                                <td className="px-4 py-3.5 text-center">
                                                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase border ${c.status === 'running' ? 'bg-sky-50 text-sky-700 border-sky-200' : c.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-zinc-100 text-zinc-600 border-zinc-200'}`}>
                                                        {c.status}
                                                    </span>
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

            {/* MODAL 1: GỬI TIN NHẮN PHẢN HỒI CHO KHÁCH HÀNG */}
            {isReplyModalOpen && selectedTicket && mounted && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
                    <div className="w-full max-w-lg my-auto overflow-hidden rounded-2xl bg-white shadow-2xl border border-zinc-200 animate-in zoom-in-95 duration-200">
                        <div className="h-1.5 w-full bg-orange-600 shrink-0" />

                        <div className="flex items-center justify-between p-4 border-b border-zinc-100">
                            <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50 text-orange-600 font-bold border border-orange-200">
                                    <Send className="h-4 w-4" />
                                </div>
                                <h2 className="font-extrabold text-sm uppercase text-zinc-900 tracking-wide">
                                    GỬI TIN NHẮN PHẢN HỒI CHO KHÁCH HÀNG
                                </h2>
                            </div>
                            <button onClick={() => setIsReplyModalOpen(false)} className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 transition">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4 text-xs">
                            <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-3 flex items-center justify-between">
                                <div>
                                    <div className="font-extrabold text-zinc-900 text-xs">{selectedTicket.customer_name || 'ANK Neeeeee'}</div>
                                    <div className="text-[11px] text-zinc-400 italic mt-0.5">Khách nhắn: "{selectedTicket.customer_message || 'Không có tin nhắn'}"</div>
                                </div>
                                <span className="font-extrabold text-orange-600 text-xs">@{selectedTicket.customer_username || 'ankshop89'}</span>
                            </div>

                            <div className="space-y-1.5">
                                <label className="font-extrabold uppercase text-zinc-700 text-[11px]">Nội dung tin nhắn Telegram gửi tới khách:</label>
                                <textarea rows={5} value={replyText} onChange={(e) => setReplyText(e.target.value)} className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-mono text-zinc-900 outline-none focus:border-orange-500 transition leading-relaxed text-xs" />
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <input type="checkbox" checked={markCompleted} onChange={(e) => setMarkCompleted(e.target.checked)} className="rounded accent-orange-600 h-4 w-4" />
                                <span className="font-bold text-zinc-800">Đồng thời đánh dấu yêu cầu này là <span className="text-emerald-600">ĐÃ XỬ LÝ (COMPLETED)</span></span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-4 border-t border-zinc-100 bg-zinc-50/50">
                            <button type="button" onClick={() => { setIsReplyModalOpen(false); setActiveTab('chat'); }} className="text-[11px] font-bold text-orange-600 hover:underline flex items-center gap-1">
                                <ExternalLink className="h-3.5 w-3.5" /><span>Mở trang Live Chat đầy đủ</span>
                            </button>
                            <div className="flex items-center gap-2">
                                <button type="button" onClick={() => setIsReplyModalOpen(false)} className="rounded-xl border border-zinc-200 bg-white px-4 py-2 font-extrabold uppercase text-zinc-700 hover:bg-zinc-100">HỦY</button>
                                <button type="button" onClick={handleSendReply} disabled={sendingReply} className="rounded-xl bg-orange-600 hover:bg-orange-700 text-white px-5 py-2 font-extrabold uppercase transition active:scale-95 shadow-xs flex items-center gap-1.5 disabled:opacity-50">
                                    <Send className="h-3.5 w-3.5" /><span>{sendingReply ? 'ĐANG GỬI...' : 'GỬI TIN NHẮN'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* MODAL 2: CHI TIẾT ĐƠN HÀNG & BẢO HÀNH */}
            {isDetailModalOpen && selectedTicket && mounted && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
                    <div className="w-full max-w-3xl my-auto max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-zinc-200 animate-in zoom-in-95 duration-200">
                        <div className="h-1.5 w-full bg-orange-600 shrink-0" />

                        <div className="flex items-center justify-between p-4 border-b border-zinc-100 shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50 text-orange-600 font-bold border border-orange-200">
                                    <Package className="h-4 w-4" />
                                </div>
                                <div>
                                    <h2 className="font-extrabold text-sm uppercase text-zinc-900 tracking-wide">CHI TIẾT ĐƠN HÀNG</h2>
                                    <p className="text-[10px] font-mono text-zinc-400">ID: {selectedTicket.order_code || '5F4CC00C-7755-4661-8195-C29BF90C6D39'}</p>
                                </div>
                            </div>
                            <button onClick={() => setIsDetailModalOpen(false)} className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 transition">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-2.5 shadow-2xs">
                                    <span className="font-extrabold text-xs uppercase text-zinc-800 tracking-wider flex items-center gap-1.5 border-b border-zinc-100 pb-2">
                                        <User className="h-3.5 w-3.5 text-zinc-400" /><span>KHÁCH HÀNG TELEGRAM</span>
                                    </span>
                                    <div className="space-y-1.5 text-xs">
                                        <div className="flex justify-between items-center"><span className="text-zinc-500">Telegram ID:</span><span className="font-mono font-bold text-zinc-900 flex items-center gap-1">{selectedTicket.customer_telegram_id || selectedTicket.telegram_id || '5865174169'}<button onClick={() => handleCopy(String(selectedTicket.customer_telegram_id || '5865174169'), 'tid')}><Copy className="h-3 w-3 text-zinc-400" /></button></span></div>
                                        <div className="flex justify-between items-center"><span className="text-zinc-500">Username:</span><span className="font-bold text-orange-600 flex items-center gap-1">@{selectedTicket.customer_username || 'ankshop89'}<button onClick={() => handleCopy(selectedTicket.customer_username || 'ankshop89', 'uname')}><Copy className="h-3 w-3 text-zinc-400" /></button></span></div>
                                        <div className="flex justify-between items-center"><span className="text-zinc-500">Họ tên:</span><span className="font-extrabold text-zinc-900">{selectedTicket.customer_name || 'ANK Neeeeee'}</span></div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-2.5 shadow-2xs">
                                    <span className="font-extrabold text-xs uppercase text-zinc-800 tracking-wider flex items-center gap-1.5 border-b border-zinc-100 pb-2">
                                        <FileText className="h-3.5 w-3.5 text-zinc-400" /><span>HÓA ĐƠN MUA HÀNG</span>
                                    </span>
                                    <div className="space-y-1.5 text-xs">
                                        <div className="flex justify-between"><span className="text-zinc-500">Sản phẩm:</span><span className="font-extrabold text-zinc-900">{selectedTicket.product_name || 'Sản phẩm VIP #6'}</span></div>
                                        <div className="flex justify-between"><span className="text-zinc-500">Số lượng & Giá:</span><span className="font-bold text-zinc-800">1 x {formatCurrency(selectedTicket.order_price || 150000)}</span></div>
                                        <div className="flex justify-between"><span className="text-zinc-500">Tổng thanh toán:</span><span className="font-black text-orange-600">{formatCurrency(selectedTicket.order_price || 150000)}</span></div>
                                        <div className="flex justify-between items-center"><span className="text-zinc-500">Mã chuyển khoản:</span><span className="font-mono font-bold text-zinc-800 bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded flex items-center gap-1">PTN1411EDI2BJSBNY<button onClick={() => handleCopy('PTN1411EDI2BJSBNY', 'txcode')}><Copy className="h-3 w-3 text-zinc-400" /></button></span></div>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 text-center text-xs font-medium text-zinc-400 italic">
                                Bấm để xem toàn bộ item đã bàn giao.
                            </div>

                            <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-3 shadow-2xs">
                                <span className="font-extrabold text-xs uppercase text-zinc-800 tracking-wider">LỊCH SỬ BẢO HÀNH / ĐỔI TRẢ (1)</span>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="border-b border-zinc-100 bg-zinc-50/60 text-[11px] font-black uppercase tracking-wider text-zinc-500">
                                                <th className="px-3 py-2 font-extrabold">DỮ LIỆU GỐC (CŨ)</th>
                                                <th className="px-3 py-2 font-extrabold">DỮ LIỆU BẢO HÀNH MỚI</th>
                                                <th className="px-3 py-2 font-extrabold">GHI CHÚ ĐỔI</th>
                                                <th className="px-3 py-2 font-extrabold text-right">THỜI GIAN</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="hover:bg-zinc-50/80">
                                                <td className="px-3 py-2.5 font-mono text-zinc-500">anh ne</td>
                                                <td className="px-3 py-2.5 font-mono font-bold text-zinc-900">ankk11</td>
                                                <td className="px-3 py-2.5 text-zinc-400 italic">Không có</td>
                                                <td className="px-3 py-2.5 text-right font-mono text-[10px] text-zinc-500">15:27:49 5/7/2026</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-3.5 shadow-2xs">
                                <span className="font-extrabold text-xs uppercase text-zinc-800 tracking-wider block">⇄ THỰC HIỆN BẢO HÀNH (ĐỔI TÀI KHOẢN MỚI)</span>
                                <div className="space-y-1.5">
                                    <span className="text-[10px] font-extrabold uppercase text-zinc-400 block">CHỌN NHANH TỪ KHO HÀNG (CÒN 5 RẢNH):</span>
                                    <div className="flex flex-wrap gap-2">
                                        {['ankk11', 'akakak111', 'akaskd`1', 'akasdkj1', 'adja'].map(item => (
                                            <button key={item} type="button" onClick={() => setNewAccountData(item)} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1 font-mono text-xs font-bold text-zinc-700 hover:bg-orange-50 hover:border-orange-300 transition">+ {item}</button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="font-extrabold uppercase text-zinc-700 text-[11px]">TÀI KHOẢN BẢO HÀNH MỚI *</label>
                                    <textarea rows={3} value={newAccountData} onChange={(e) => setNewAccountData(e.target.value)} placeholder="Nhập/dán dữ liệu tài khoản mới thay thế..." className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-mono text-xs text-zinc-900 outline-none focus:border-orange-500 transition" />
                                </div>

                                <div className="space-y-1">
                                    <label className="font-extrabold uppercase text-zinc-700 text-[11px]">GHI CHÚ LÝ DO BẢO HÀNH</label>
                                    <input type="text" value={warrantyReason} onChange={(e) => setWarrantyReason(e.target.value)} placeholder="Ví dụ: Tài khoản bị khóa, sai pass..." className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-medium text-xs text-zinc-900 outline-none focus:border-orange-500 transition" />
                                </div>

                                <div className="flex justify-end pt-1">
                                    <button type="button" onClick={handleProcessWarranty} disabled={submittingWarranty || !newAccountData.trim()} className="rounded-xl bg-orange-600 hover:bg-orange-700 text-white px-6 py-2.5 font-extrabold uppercase transition shadow-xs disabled:opacity-50">
                                        {submittingWarranty ? 'ĐANG GỬI...' : 'GỬI BẢO HÀNH'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-end p-4 border-t border-zinc-100 bg-zinc-50/50 shrink-0">
                            <button onClick={() => setIsDetailModalOpen(false)} className="rounded-xl border border-zinc-200 bg-white px-6 py-2.5 text-xs font-extrabold uppercase text-zinc-700 hover:bg-zinc-100">ĐÓNG</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
