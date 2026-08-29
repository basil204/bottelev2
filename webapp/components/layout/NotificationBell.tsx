"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
    Bell, MessageSquare, HelpCircle, CreditCard, Check,
    Clock, ChevronRight, RefreshCw, X, Sparkles, User
} from "lucide-react";

interface NotificationItem {
    id: string | number;
    type: 'chat' | 'support' | 'deposit';
    title: string;
    description: string;
    time: string;
    unread: boolean;
    telegram_id?: number;
    targetUrl: string;
}

export function NotificationBell() {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const fetchNotifications = async () => {
        try {
            setLoading(true);
            const items: NotificationItem[] = [];
            let totalUnread = 0;

            // 1. Fetch unreplied support/chat conversations
            const resSupport = await fetch('/api/support?action=chat_conversations&tab=unreplied');
            if (resSupport.ok) {
                const data = await resSupport.json();
                const conversations = Array.isArray(data.data) ? data.data : [];
                if (data.stats?.unreplied !== undefined) {
                    totalUnread += Number(data.stats.unreplied);
                }

                conversations.slice(0, 8).forEach((c: any) => {
                    const isUnreplied = !c.last_admin_reply && c.last_customer_message;
                    const nameStr = c.name || (c.username ? `@${c.username}` : `User #${c.telegram_id || c.id}`);
                    
                    let timeStr = '';
                    if (c.last_message_time) {
                        const d = new Date(c.last_message_time);
                        timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                    }

                    items.push({
                        id: `chat_${c.telegram_id || c.id}`,
                        type: c.last_request_type === 'WARRANTY' ? 'support' : 'chat',
                        title: c.last_request_type === 'WARRANTY' ? `Bảo hành từ ${nameStr}` : `Tin nhắn từ ${nameStr}`,
                        description: c.last_customer_message || 'Khách hàng vừa gửi tin nhắn mới',
                        time: timeStr || 'Mới xong',
                        unread: Boolean(isUnreplied),
                        telegram_id: c.telegram_id,
                        targetUrl: c.last_request_type === 'WARRANTY' ? '/notifications?tab=support' : '/notifications?tab=chat'
                    });
                });
            }

            // 2. Fetch pending deposits
            try {
                const resDep = await fetch('/api/deposits?status=pending');
                if (resDep.ok) {
                    const depData = await resDep.json();
                    const pendingDeposits = Array.isArray(depData.data) ? depData.data : (Array.isArray(depData.deposits) ? depData.deposits : []);
                    if (pendingDeposits.length > 0) {
                        totalUnread += pendingDeposits.length;
                        pendingDeposits.slice(0, 3).forEach((d: any) => {
                            items.push({
                                id: `dep_${d.id}`,
                                type: 'deposit',
                                title: `Yêu cầu nạp tiền #${d.id}`,
                                description: `Số tiền: ${new Intl.NumberFormat('vi-VN').format(d.amount || 0)} đ từ ${d.username || 'Khách hàng'}`,
                                time: 'Đang chờ',
                                unread: true,
                                targetUrl: '/deposits'
                            });
                        });
                    }
                }
            } catch (e) {}

            setNotifications(items);
            setUnreadCount(totalUnread);
        } catch (error) {
            console.error('Lỗi tải thông báo:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 15000); // Polling every 15s
        return () => clearInterval(interval);
    }, []);

    // Dismiss popover on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleItemClick = (item: NotificationItem) => {
        setIsOpen(false);
        router.push(item.targetUrl);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Notification Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-100/80 text-zinc-700 transition-all hover:border-zinc-300 hover:bg-zinc-200/70 active:scale-[0.98] cursor-pointer"
                title="Thông báo hệ thống"
            >
                <Bell className={`h-4 w-4 ${unreadCount > 0 ? 'text-amber-600 animate-pulse' : 'text-zinc-600'}`} />
                
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-black text-white shadow-xs ring-2 ring-white animate-bounce">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Notification Dropdown Popover */}
            {isOpen && (
                <div className="absolute right-0 z-50 mt-2 w-80 sm:w-96 overflow-hidden rounded-2xl border border-zinc-200 bg-white/95 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/70 px-4 py-3">
                        <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-100 text-orange-600 font-bold">
                                <Bell className="h-3.5 w-3.5" />
                            </div>
                            <div>
                                <h3 className="text-xs font-black uppercase text-zinc-900 tracking-tight">THÔNG BÁO HỆ THỐNG</h3>
                                <p className="text-[10px] font-medium text-zinc-500">
                                    {unreadCount > 0 ? `Có ${unreadCount} thông báo mới cần xử lý` : 'Không có thông báo mới'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-1">
                            <button
                                onClick={fetchNotifications}
                                title="Làm mới"
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-100 transition cursor-pointer"
                            >
                                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition cursor-pointer"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Notification Items List */}
                    <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100">
                        {loading && notifications.length === 0 ? (
                            <div className="p-8 text-center text-xs text-zinc-400">
                                <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2 text-orange-600" />
                                Đang cập nhật thông báo...
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="p-8 text-center text-xs text-zinc-400 space-y-1">
                                <Sparkles className="h-6 w-6 text-zinc-300 mx-auto" />
                                <p className="font-bold text-zinc-600">Tuyệt vời! Không có việc gì chờ.</p>
                                <p className="text-[10px]">Tất cả tin nhắn và hỗ trợ đã được xử lý xong.</p>
                            </div>
                        ) : (
                            notifications.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => handleItemClick(item)}
                                    className={`w-full p-3.5 text-left transition flex items-start gap-3 hover:bg-orange-50/50 cursor-pointer ${
                                        item.unread ? 'bg-amber-50/30' : ''
                                    }`}
                                >
                                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-bold text-xs shadow-2xs ${
                                        item.type === 'support' ? 'bg-orange-100 text-orange-600 border border-orange-200' :
                                        item.type === 'deposit' ? 'bg-emerald-100 text-emerald-600 border border-emerald-200' :
                                        'bg-sky-100 text-sky-600 border border-sky-200'
                                    }`}>
                                        {item.type === 'support' ? <HelpCircle className="h-4 w-4" /> :
                                         item.type === 'deposit' ? <CreditCard className="h-4 w-4" /> :
                                         <MessageSquare className="h-4 w-4" />}
                                    </div>

                                    <div className="min-w-0 flex-1 space-y-0.5">
                                        <div className="flex items-center justify-between gap-1">
                                            <span className="text-xs font-black text-zinc-900 truncate">
                                                {item.title}
                                            </span>
                                            {item.time && (
                                                <span className="text-[9px] font-mono text-zinc-400 shrink-0">
                                                    {item.time}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] font-medium text-zinc-600 line-clamp-2 leading-relaxed">
                                            {item.description}
                                        </p>
                                    </div>

                                    <ChevronRight className="h-4 w-4 text-zinc-300 self-center shrink-0" />
                                </button>
                            ))
                        )}
                    </div>

                    {/* Footer Action */}
                    <div className="border-t border-zinc-100 bg-zinc-50 p-2.5 text-center">
                        <button
                            onClick={() => { setIsOpen(false); router.push('/notifications'); }}
                            className="w-full rounded-xl bg-orange-600 hover:bg-orange-700 text-white py-2 text-xs font-black uppercase tracking-wider transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                            <span>TRUNG TÂM THÔNG BÁO</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
