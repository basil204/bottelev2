'use client';

import { useEffect, useState } from 'react';
import {
    CheckSquare, RefreshCw, Send, Plus, Trash2, Calendar, Award,
    Clock, Gift, User, CheckCircle2, Sparkles
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface RewardItem {
    id: number;
    name: string;
    streak_days: number;
    sort_order: number;
    reward_type: string;
    reward_amount: number;
    reward_message?: string | null;
    is_active: number | boolean;
    created_at: string;
}

interface ClaimItem {
    id: number;
    user_id?: number;
    telegram_id?: number;
    user_name?: string;
    username?: string;
    reward_name?: string;
    reward_amount: number;
    streak: number;
    status: string;
    created_at: string;
}

interface LogItem {
    id: number;
    user_id?: number;
    telegram_id?: number;
    user_name?: string;
    username?: string;
    checkin_date?: string;
    streak: number;
    total_checkins: number;
    created_at: string;
}

export default function CheckinPage() {
    const { t } = useLanguage();
    const [rewards, setRewards] = useState<RewardItem[]>([]);
    const [claims, setClaims] = useState<ClaimItem[]>([]);
    const [logs, setLogs] = useState<LogItem[]>([]);
    const [loading, setLoading] = useState(true);

    const [stats, setStats] = useState({
        status: 'Bật',
        timezone: 'UTC+7',
        rewardCount: 0,
        activeCount: 0,
        pendingClaimsCount: 0
    });

    // Form state
    const [name, setName] = useState('');
    const [streakDays, setStreakDays] = useState(1);
    const [sortOrder, setSortOrder] = useState(0);
    const [rewardType, setRewardType] = useState('Ví');
    const [rewardAmount, setRewardAmount] = useState(0);
    const [rewardMessage, setRewardMessage] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [sendingClaims, setSendingClaims] = useState(false);

    useEffect(() => {
        fetchCheckinData();
    }, []);

    const fetchCheckinData = () => {
        setLoading(true);
        fetch('/api/checkin')
            .then((res) => res.json())
            .then((data) => {
                setRewards(Array.isArray(data.rewards) ? data.rewards : []);
                setClaims(Array.isArray(data.claims) ? data.claims : []);
                setLogs(Array.isArray(data.logs) ? data.logs : []);
                if (data.stats) setStats(data.stats);
                setLoading(false);
            })
            .catch((err) => {
                console.error(err);
                setLoading(false);
            });
    };

    const handleCreateReward = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            alert('Vui lòng nhập tên mốc thưởng!');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch('/api/checkin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create_reward',
                    name: name.trim(),
                    streakDays,
                    sortOrder,
                    rewardType,
                    rewardAmount,
                    rewardMessage: rewardMessage.trim(),
                    isActive
                })
            });

            if (res.ok) {
                alert('Tạo mốc thưởng thành công!');
                setName('');
                setRewardMessage('');
                fetchCheckinData();
            } else {
                const data = await res.json();
                alert(data.error || 'Lỗi tạo mốc thưởng');
            }
        } catch (e) {
            alert('Lỗi kết nối server');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteReward = async (rewardId: number) => {
        if (!window.confirm('Xác nhận xóa mốc thưởng này?')) return;
        const res = await fetch('/api/checkin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete_reward', rewardId })
        });
        if (res.ok) fetchCheckinData();
    };

    const handleSendAllClaims = async () => {
        if (claims.length === 0) {
            alert('Không có phần thưởng claim nào đang chờ gửi!');
            return;
        }

        if (!window.confirm(`Xác nhận gửi tất cả ${claims.length} phần thưởng claim chờ?`)) return;

        setSendingClaims(true);
        try {
            const res = await fetch('/api/checkin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'send_claims' })
            });

            if (res.ok) {
                const data = await res.json();
                alert(data.message || 'Đã phát thưởng thành công!');
                fetchCheckinData();
            } else {
                const data = await res.json();
                alert(data.error || 'Lỗi gửi claim');
            }
        } catch (e) {
            alert('Lỗi kết nối server');
        } finally {
            setSendingClaims(false);
        }
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(val) + ' đ';
    };

    const formatDateStr = (dateStr?: string) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${year}-${month}-${day}`;
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-2 sm:p-4">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600 font-bold border border-orange-200 shadow-2xs">
                        <CheckSquare className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-zinc-900 flex items-center gap-2">
                            📋 ĐIỂM DANH
                        </h1>
                        <p className="text-xs text-zinc-500 font-medium">Cấu hình điểm danh nhận quà hàng ngày</p>
                    </div>
                </div>

                <button
                    onClick={fetchCheckinData}
                    title="Tải lại"
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 active:scale-95 transition shadow-2xs"
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* 5 Summary Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">TRẠNG THÁI</span>
                    <div className="text-base font-black text-emerald-600 mt-1">{stats.status}</div>
                </div>

                <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">TIMEZONE</span>
                    <div className="text-base font-black text-zinc-900 mt-1">{stats.timezone}</div>
                </div>

                <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">MỐC THƯỞNG</span>
                    <div className="text-xl font-black text-zinc-900 mt-1">{rewards.length}</div>
                </div>

                <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">ACTIVE</span>
                    <div className="text-xl font-black text-zinc-900 mt-1">{rewards.filter(r => r.is_active).length}</div>
                </div>

                <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">CLAIM CHỜ</span>
                    <div className="text-xl font-black text-zinc-900 mt-1">{claims.length}</div>
                </div>
            </div>

            {/* Top 2 Columns: TẠO MỐC THƯỞNG & CẤU HÌNH MỐC THƯỞNG */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left Card: 🎁 TẠO MỐC THƯỞNG */}
                <div className="lg:col-span-4 rounded-2xl border border-zinc-200 bg-white p-5 space-y-4 shadow-2xs">
                    <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
                        <Gift className="h-4 w-4 text-orange-600" />
                        <h2 className="font-extrabold text-xs uppercase text-zinc-800 tracking-wider">
                            TẠO MỐC THƯỞNG
                        </h2>
                    </div>

                    <form onSubmit={handleCreateReward} className="space-y-3.5 text-xs">
                        <div className="space-y-1">
                            <label className="font-extrabold uppercase text-zinc-700 text-[11px]">
                                TÊN MỐC <span className="text-orange-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="VD: Mốc 7 ngày"
                                className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-semibold text-zinc-900 outline-none focus:border-orange-500 transition"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="font-extrabold uppercase text-zinc-700 text-[11px]">STREAK NGÀY</label>
                                <input
                                    type="number"
                                    min={1}
                                    value={streakDays}
                                    onChange={(e) => setStreakDays(Number(e.target.value))}
                                    className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-semibold text-zinc-900 outline-none focus:border-orange-500 transition"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="font-extrabold uppercase text-zinc-700 text-[11px]">SORT</label>
                                <input
                                    type="number"
                                    value={sortOrder}
                                    onChange={(e) => setSortOrder(Number(e.target.value))}
                                    className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-semibold text-zinc-900 outline-none focus:border-orange-500 transition"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="font-extrabold uppercase text-zinc-700 text-[11px]">LOẠI</label>
                                <select
                                    value={rewardType}
                                    onChange={(e) => setRewardType(e.target.value)}
                                    className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-semibold text-zinc-900 outline-none focus:border-orange-500 transition"
                                >
                                    <option value="Ví">Ví</option>
                                    <option value="Giftcode">Giftcode</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="font-extrabold uppercase text-zinc-700 text-[11px]">TIỀN VÍ</label>
                                <input
                                    type="number"
                                    value={rewardAmount}
                                    onChange={(e) => setRewardAmount(Number(e.target.value))}
                                    className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-semibold text-zinc-900 outline-none focus:border-orange-500 transition"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="font-extrabold uppercase text-zinc-700 text-[11px]">TIN NHẮN THƯỞNG</label>
                            <input
                                type="text"
                                value={rewardMessage}
                                onChange={(e) => setRewardMessage(e.target.value)}
                                placeholder="VD: CODE-7 hoặc lời nhắn gửi khách"
                                className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-medium text-zinc-900 outline-none focus:border-orange-500 transition"
                            />
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                            <input
                                type="checkbox"
                                checked={isActive}
                                onChange={(e) => setIsActive(e.target.checked)}
                                className="rounded accent-orange-600 h-4 w-4"
                            />
                            <span className="font-bold text-zinc-800">Active</span>
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full rounded-xl bg-orange-600 hover:bg-orange-700 text-white py-3 font-extrabold uppercase transition active:scale-95 shadow-xs disabled:opacity-50"
                        >
                            {submitting ? 'ĐANG LƯU...' : 'LƯU MỐC THƯỞNG'}
                        </button>
                    </form>
                </div>

                {/* Right Card: 🏆 CẤU HÌNH MỐC THƯỞNG */}
                <div className="lg:col-span-8 rounded-2xl border border-zinc-200 bg-white p-5 space-y-4 shadow-2xs">
                    <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
                        <Award className="h-4 w-4 text-orange-600" />
                        <h2 className="font-extrabold text-xs uppercase text-zinc-800 tracking-wider">
                            CẤU HÌNH MỐC THƯỞNG
                        </h2>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-zinc-100 bg-zinc-50/60 text-[11px] font-black uppercase tracking-wider text-zinc-500">
                                    <th className="px-3 py-2.5 font-extrabold">MỐC</th>
                                    <th className="px-3 py-2.5 font-extrabold">LOẠI</th>
                                    <th className="px-3 py-2.5 font-extrabold text-right">VÍ</th>
                                    <th className="px-3 py-2.5 font-extrabold">TIN NHẮN</th>
                                    <th className="px-3 py-2.5 font-extrabold text-center">TRẠNG THÁI</th>
                                    <th className="px-3 py-2.5 font-extrabold text-right">THAO TÁC</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {rewards.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center text-xs font-medium text-zinc-400">
                                            CHƯA CÓ MỐC THƯỞNG
                                        </td>
                                    </tr>
                                ) : (
                                    rewards.map(item => (
                                        <tr key={item.id} className="hover:bg-zinc-50/80">
                                            <td className="px-3 py-3 font-extrabold text-zinc-900">{item.name}</td>
                                            <td className="px-3 py-3 font-semibold text-zinc-700">{item.reward_type}</td>
                                            <td className="px-3 py-3 text-right font-black text-orange-600">{formatCurrency(item.reward_amount)}</td>
                                            <td className="px-3 py-3 font-mono text-[11px] text-zinc-500">{item.reward_message || '-'}</td>
                                            <td className="px-3 py-3 text-center">
                                                <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                                    ĐANG BẬT
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 text-right">
                                                <button
                                                    onClick={() => handleDeleteReward(item.id)}
                                                    className="p-1 rounded-lg text-zinc-400 hover:text-red-600 transition"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Middle Section: 🎁 CLAIM CHỜ */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                    <div className="flex items-center gap-2">
                        <Gift className="h-4 w-4 text-orange-600" />
                        <h2 className="font-extrabold text-xs uppercase text-zinc-800 tracking-wider">
                            CLAIM CHỜ
                        </h2>
                    </div>

                    <button
                        onClick={handleSendAllClaims}
                        disabled={sendingClaims || claims.length === 0}
                        className="rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-xs font-extrabold uppercase transition active:scale-95 shadow-xs disabled:opacity-40 flex items-center gap-1.5"
                    >
                        <Send className="h-3.5 w-3.5" />
                        <span>{sendingClaims ? 'ĐANG GỬI...' : 'GỬI TẤT CẢ'}</span>
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="border-b border-zinc-100 bg-zinc-50/60 text-[11px] font-black uppercase tracking-wider text-zinc-500">
                                <th className="px-4 py-3 font-extrabold">KHÁCH HÀNG</th>
                                <th className="px-4 py-3 font-extrabold">ĐỊNH DANH</th>
                                <th className="px-4 py-3 font-extrabold">REWARD</th>
                                <th className="px-4 py-3 font-extrabold text-center">STREAK</th>
                                <th className="px-4 py-3 font-extrabold text-center">ĐỦ ĐIỀU KIỆN</th>
                                <th className="px-4 py-3 font-extrabold text-right">GỬI</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {claims.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-xs font-medium text-zinc-400">
                                        KHÔNG CÓ CLAIM CHỜ GỬI
                                    </td>
                                </tr>
                            ) : (
                                claims.map(claim => (
                                    <tr key={claim.id} className="hover:bg-zinc-50/80">
                                        <td className="px-4 py-3 font-extrabold text-zinc-900">{claim.user_name || claim.username || `User #${claim.user_id}`}</td>
                                        <td className="px-4 py-3 font-mono text-[11px] text-zinc-500">User {claim.telegram_id || claim.user_id}</td>
                                        <td className="px-4 py-3 font-extrabold text-orange-600">{claim.reward_name} ({formatCurrency(claim.reward_amount)})</td>
                                        <td className="px-4 py-3 text-center font-bold text-zinc-800">{claim.streak} Ngày</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="rounded-md bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-bold">✓ Đủ điều kiện</span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={handleSendAllClaims}
                                                className="rounded-lg bg-orange-600 text-white px-3 py-1 text-[11px] font-bold"
                                            >
                                                Gửi
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Bottom Section: 🕒 LỊCH SỬ ĐIỂM DANH GẦN ĐÂY */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4 shadow-2xs">
                <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
                    <Clock className="h-4 w-4 text-orange-600" />
                    <h2 className="font-extrabold text-xs uppercase text-zinc-800 tracking-wider">
                        LỊCH SỬ ĐIỂM DANH GẦN ĐÂY
                    </h2>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="border-b border-zinc-100 bg-zinc-50/60 text-[11px] font-black uppercase tracking-wider text-zinc-500">
                                <th className="px-4 py-3 font-extrabold">KHÁCH HÀNG</th>
                                <th className="px-4 py-3 font-extrabold">ĐỊNH DANH</th>
                                <th className="px-4 py-3 font-extrabold">NGÀY</th>
                                <th className="px-4 py-3 font-extrabold text-center">STREAK</th>
                                <th className="px-4 py-3 font-extrabold text-center">TỔNG</th>
                                <th className="px-4 py-3 font-extrabold text-right">LỊCH SỬ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-xs font-medium text-zinc-400">
                                        CHƯA CÓ LỊCH SỬ ĐIỂM DANH
                                    </td>
                                </tr>
                            ) : (
                                logs.map(log => (
                                    <tr key={log.id} className="hover:bg-zinc-50/80">
                                        <td className="px-4 py-3 font-extrabold text-zinc-900">{log.user_name || log.username || `User #${log.user_id}`}</td>
                                        <td className="px-4 py-3 font-mono text-[11px] text-zinc-500">User {log.telegram_id || log.user_id}</td>
                                        <td className="px-4 py-3 font-mono text-[11px] text-zinc-500">{formatDateStr(log.checkin_date || log.created_at)}</td>
                                        <td className="px-4 py-3 text-center font-extrabold text-zinc-900">Current: {log.streak}</td>
                                        <td className="px-4 py-3 text-center font-semibold text-zinc-700">{log.total_checkins} Ngày</td>
                                        <td className="px-4 py-3 text-right text-zinc-400">
                                            <RefreshCw className="h-3.5 w-3.5 inline-block" />
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
