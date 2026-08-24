'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Key, Plus, Search, RefreshCw, Copy, Check, Trash2, ShieldCheck, ShieldAlert, Code, Sparkles, User, X } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useCurrency } from '@/hooks/useCurrency';

interface ApiKeyItem {
    id: number;
    user_id: number;
    api_key: string;
    name: string;
    is_active: number | boolean;
    username?: string;
    user_name?: string;
    telegram_id?: number;
    balance?: number;
    last_used_at?: string | null;
    created_at: string;
}

interface UserOption {
    id: number;
    username?: string;
    name?: string;
    telegram_id?: number;
    balance?: number;
}

export default function UserApiKeysPage() {
    const { formatPrice } = useCurrency();
    const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
    const [users, setUsers] = useState<UserOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [copiedKeyId, setCopiedKeyId] = useState<number | null>(null);

    // Modal state
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<number | ''>('');
    const [keyName, setKeyName] = useState('Gmail EDU API Key');
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [creating, setCreating] = useState(false);
    const [mounted, setMounted] = useState(false);

    // Newly created key result modal
    const [createdKeyResult, setCreatedKeyResult] = useState<string | null>(null);

    const fetchApiKeys = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/user-api-keys${searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : ''}`);
            if (res.ok) {
                const data = await res.json();
                setApiKeys(Array.isArray(data) ? data : []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/users?page=1&limit=100');
            if (res.ok) {
                const data = await res.json();
                setUsers(data.users || data.data || (Array.isArray(data) ? data : []));
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        setMounted(true);
        fetchApiKeys();
        fetchUsers();
    }, []);

    const handleCopy = (key: string, id: number) => {
        navigator.clipboard.writeText(key);
        setCopiedKeyId(id);
        setTimeout(() => setCopiedKeyId(null), 2000);
    };

    const handleToggleActive = async (keyItem: ApiKeyItem) => {
        const nextActive = !Boolean(keyItem.is_active);
        setApiKeys(prev => prev.map(k => k.id === keyItem.id ? { ...k, is_active: nextActive ? 1 : 0 } : k));

        try {
            await fetch('/api/user-api-keys', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: keyItem.id, is_active: nextActive })
            });
        } catch (e) {
            console.error(e);
            fetchApiKeys();
        }
    };

    const handleDeleteKey = async (id: number, keyName: string) => {
        if (!confirm(`Bạn có chắc chắn muốn xóa API Key "${keyName}" không?`)) return;

        setApiKeys(prev => prev.filter(k => k.id !== id));
        try {
            await fetch(`/api/user-api-keys?id=${id}`, { method: 'DELETE' });
        } catch (e) {
            console.error(e);
            fetchApiKeys();
        }
    };

    const handleCreateApiKey = async () => {
        if (!selectedUserId) {
            alert('Vui lòng chọn người dùng!');
            return;
        }

        setCreating(true);
        try {
            const res = await fetch('/api/user-api-keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: Number(selectedUserId),
                    name: keyName
                })
            });

            const data = await res.json();
            if (res.ok && data.api_key) {
                setCreatedKeyResult(data.api_key);
                setIsCreateModalOpen(false);
                setSelectedUserId('');
                fetchApiKeys();
            } else {
                alert(data.error || 'Tạo API Key thất bại');
            }
        } catch (e: any) {
            alert(e.message || 'Lỗi hệ thống');
        } finally {
            setCreating(false);
        }
    };

    const filteredUsers = users.filter(u => {
        if (!userSearchTerm.trim()) return true;
        const term = userSearchTerm.toLowerCase();
        return (
            (u.username && u.username.toLowerCase().includes(term)) ||
            (u.name && u.name.toLowerCase().includes(term)) ||
            String(u.telegram_id || '').includes(term) ||
            String(u.id).includes(term)
        );
    });

    const activeCount = apiKeys.filter(k => Boolean(k.is_active)).length;

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-2 sm:p-4 text-zinc-900">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 font-bold border border-orange-200 shadow-xs">
                        <Key className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-zinc-900 flex items-center gap-2">
                            QUẢN LÝ USER API KEYS
                        </h1>
                        <p className="text-xs text-zinc-500 font-medium">Tạo và cấp quyền API Key cho người dùng mua Gmail EDU tự động qua API.</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchApiKeys}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 active:scale-95 transition shadow-2xs cursor-pointer"
                        title="Tải lại"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex h-10 items-center gap-2 rounded-xl bg-orange-600 px-5 text-xs font-black uppercase text-white hover:bg-orange-700 active:scale-95 transition shadow-sm tracking-wide cursor-pointer"
                    >
                        <Plus className="h-4 w-4 stroke-[3]" />
                        <span>+ TẠO API KEY CHO USER</span>
                    </button>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <Key className="h-5 w-5" />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-zinc-400">TỔNG SỐ API KEY</div>
                        <div className="text-lg font-black text-zinc-900">{apiKeys.length}</div>
                    </div>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                        <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-zinc-400">ĐANG HOẠT ĐỘNG</div>
                        <div className="text-lg font-black text-emerald-600">{activeCount}</div>
                    </div>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                        <ShieldAlert className="h-5 w-5" />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-zinc-400">ĐÃ TẮT / VÔ HIỆU HÓA</div>
                        <div className="text-lg font-black text-rose-600">{apiKeys.length - activeCount}</div>
                    </div>
                </div>
            </div>

            {/* API Documentation Quick Reference */}
            <div className="rounded-2xl border border-orange-200 bg-orange-50/50 p-4 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-black text-orange-900 uppercase">
                    <Code className="h-4 w-4 text-orange-600" />
                    <span>HƯỚNG DẪN GỬI REQUEST ORDER GMAIL EDU BẰNG API KEY</span>
                </div>
                <div className="font-mono text-[11px] bg-zinc-950 text-zinc-100 p-3 rounded-xl overflow-x-auto border border-zinc-800">
                    <div>POST https://yourdomain.com/api/v1/order-edu</div>
                    <div className="text-zinc-400 mt-1">Header: X-API-Key: sk_edu_YOUR_USER_API_KEY</div>
                    <div className="text-zinc-400">Body: &#123; "quantity": 1, "domain": "suafpoly.app", "prefix": "student" &#125;</div>
                </div>
            </div>

            {/* Main Table Card */}
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-2xs overflow-hidden">
                {/* Search */}
                <div className="p-4 border-b border-zinc-100">
                    <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && fetchApiKeys()}
                            placeholder="Tìm kiếm API Key (Username, Name, Telegram ID, Key...)"
                            className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 pl-10 pr-4 py-2.5 text-xs font-medium text-zinc-900 outline-none focus:border-orange-500 focus:bg-white transition"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="border-b border-zinc-100 bg-zinc-50/60 text-[11px] font-black uppercase tracking-wider text-zinc-500">
                                <th className="px-4 py-3.5 font-extrabold">NGƯỜI DÙNG</th>
                                <th className="px-4 py-3.5 font-extrabold">TÊN KEY</th>
                                <th className="px-4 py-3.5 font-extrabold">API KEY</th>
                                <th className="px-4 py-3.5 font-extrabold">SỐ DƯ USER</th>
                                <th className="px-4 py-3.5 font-extrabold text-center">TRẠNG THÁI</th>
                                <th className="px-4 py-3.5 font-extrabold text-right">HÀNH ĐỘNG</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-xs font-medium text-zinc-400">
                                        Đang tải dữ liệu API Keys...
                                    </td>
                                </tr>
                            ) : apiKeys.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-xs font-medium text-zinc-400">
                                        Chưa có API Key nào cho người dùng. Bấm nút "+ TẠO API KEY CHO USER" để cấp key mới.
                                    </td>
                                </tr>
                            ) : (
                                apiKeys.map((item) => (
                                    <tr key={item.id} className="hover:bg-zinc-50/80 transition-colors">
                                        <td className="px-4 py-3.5">
                                            <div className="font-extrabold text-zinc-900">
                                                {item.user_name || item.username || `User #${item.user_id}`}
                                            </div>
                                            <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                                                ID: {item.user_id} | TG: {item.telegram_id || '-'}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5 font-semibold text-zinc-700">
                                            {item.name}
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-2">
                                                <code className="bg-zinc-100 border border-zinc-200 text-zinc-900 font-mono px-2.5 py-1 rounded-lg text-[11px] font-bold">
                                                    {item.api_key.substring(0, 14)}...{item.api_key.substring(item.api_key.length - 4)}
                                                </code>
                                                <button
                                                    onClick={() => handleCopy(item.api_key, item.id)}
                                                    className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition cursor-pointer"
                                                    title="Copy API Key"
                                                >
                                                    {copiedKeyId === item.id ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5 font-extrabold text-emerald-600">
                                            {formatPrice(item.balance || 0)}
                                        </td>
                                        <td className="px-4 py-3.5 text-center">
                                            <Switch
                                                checked={Boolean(item.is_active)}
                                                onCheckedChange={() => handleToggleActive(item)}
                                            />
                                        </td>
                                        <td className="px-4 py-3.5 text-right">
                                            <button
                                                onClick={() => handleDeleteKey(item.id, item.name)}
                                                className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                                title="Xóa Key"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal: TẠO API KEY CHO USER */}
            {isCreateModalOpen && mounted && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl border border-zinc-200 animate-in zoom-in-95 duration-200">
                        <div className="h-1.5 w-full bg-orange-600" />

                        <div className="flex items-center justify-between p-4 border-b border-zinc-100">
                            <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50 text-orange-600 font-bold border border-orange-200">
                                    <Key className="h-4 w-4" />
                                </div>
                                <h2 className="font-extrabold text-sm uppercase text-zinc-900 tracking-wide">
                                    TẠO USER API KEY MỚI
                                </h2>
                            </div>
                            <button onClick={() => setIsCreateModalOpen(false)} className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 transition">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-700">
                                    CHỌN NGƯỜI DÙNG <span className="text-orange-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={userSearchTerm}
                                    onChange={(e) => setUserSearchTerm(e.target.value)}
                                    placeholder="Lọc danh sách theo tên, telegram_id, id..."
                                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 text-xs text-zinc-900 outline-none focus:border-orange-500 mb-2"
                                />
                                <select
                                    value={selectedUserId}
                                    onChange={(e) => setSelectedUserId(e.target.value ? Number(e.target.value) : '')}
                                    className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-xs font-semibold text-zinc-900 outline-none focus:border-orange-500 transition"
                                >
                                    <option value="">-- Chọn người dùng --</option>
                                    {filteredUsers.map((u) => (
                                        <option key={u.id} value={u.id}>
                                            {u.name || u.username || `User #${u.id}`} (ID: {u.id} | TG: {u.telegram_id || '-'} | Số dư: {formatPrice(u.balance || 0)})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-700">
                                    TÊN NHÃN API KEY
                                </label>
                                <input
                                    type="text"
                                    value={keyName}
                                    onChange={(e) => setKeyName(e.target.value)}
                                    placeholder="VD: Gmail EDU Client Key"
                                    className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-xs font-semibold text-zinc-900 outline-none focus:border-orange-500 transition"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2.5 p-4 bg-zinc-50 border-t border-zinc-100">
                            <button
                                type="button"
                                onClick={() => setIsCreateModalOpen(false)}
                                className="rounded-xl border border-zinc-200 bg-zinc-100 px-5 py-2.5 text-xs font-extrabold text-zinc-700 hover:bg-zinc-200 transition"
                            >
                                HỦY
                            </button>
                            <button
                                type="button"
                                onClick={handleCreateApiKey}
                                disabled={!selectedUserId || creating}
                                className="rounded-xl bg-orange-600 px-5 py-2.5 text-xs font-extrabold uppercase text-white hover:bg-orange-700 transition disabled:opacity-50"
                            >
                                {creating ? 'ĐANG TẠO...' : 'TẠO KEY NGAY'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Modal: SHOW NEWLY CREATED KEY */}
            {createdKeyResult && mounted && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
                    <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl border border-zinc-200 p-6 space-y-4">
                        <div className="flex items-center gap-2 text-emerald-600 font-black text-base uppercase">
                            <Sparkles className="h-5 w-5" />
                            <span>TẠO API KEY THÀNH CÔNG!</span>
                        </div>
                        <p className="text-xs text-zinc-600">Vui lòng sao chép API Key bên dưới để gửi cho người dùng:</p>

                        <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-2">
                            <div className="text-[10px] font-bold text-zinc-400 uppercase">API KEY:</div>
                            <div className="font-mono text-xs text-emerald-400 break-all select-all font-bold">
                                {createdKeyResult}
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(createdKeyResult);
                                    alert('Đã copy API Key!');
                                }}
                                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-emerald-700 transition flex items-center gap-1.5"
                            >
                                <Copy className="h-4 w-4" />
                                <span>COPY KEY</span>
                            </button>
                            <button
                                onClick={() => setCreatedKeyResult(null)}
                                className="rounded-xl bg-zinc-100 border border-zinc-200 px-4 py-2 text-xs font-extrabold text-zinc-700 hover:bg-zinc-200 transition"
                            >
                                ĐÓNG
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
