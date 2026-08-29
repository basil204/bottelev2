'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, Plus, Pencil, Trash2, Search, X, Smile, Hash, Layers, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useLanguage } from '@/contexts/LanguageContext';

interface Category {
    id: number;
    name: string;
    priority: number;
    emoji?: string | null;
    custom_emoji_id?: string | null;
    is_active?: boolean | number;
    product_count?: number;
    total_accounts?: number;
    sold_accounts?: number;
    all_accounts?: number;
    created_at?: string;
}

export default function CategoriesPage() {
    const { t } = useLanguage();
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
    const [mounted, setMounted] = useState(false);

    // Drag and drop / Reordering State
    const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

    const handleReorderSave = async (newList: Category[]) => {
        const maxPriority = newList.length * 10;
        const reorderPayload = newList.map((item, idx) => ({
            id: item.id,
            priority: maxPriority - idx * 10
        }));

        setCategories(prev => {
            const map = new Map(newList.map((item, idx) => [item.id, maxPriority - idx * 10]));
            const updated = prev.map(c => ({
                ...c,
                priority: map.has(c.id) ? map.get(c.id)! : c.priority
            }));
            return [...updated].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
        });

        try {
            await fetch('/api/categories', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reorder: reorderPayload })
            });
        } catch (err) {
            console.error('Failed to save category reorder:', err);
        }
    };

    const handleMoveCategory = (index: number, direction: 'up' | 'down') => {
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= filteredCategories.length) return;

        const newList = [...filteredCategories];
        const temp = newList[index];
        newList[index] = newList[targetIndex];
        newList[targetIndex] = temp;

        handleReorderSave(newList);
    };

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIdx(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragOverIdx !== index) {
            setDragOverIdx(index);
        }
    };

    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        if (draggedIdx === null || draggedIdx === dropIndex) {
            setDraggedIdx(null);
            setDragOverIdx(null);
            return;
        }

        const newList = [...filteredCategories];
        const [draggedItem] = newList.splice(draggedIdx, 1);
        newList.splice(dropIndex, 0, draggedItem);

        setDraggedIdx(null);
        setDragOverIdx(null);
        handleReorderSave(newList);
    };

    const fetchCategories = () => {
        setLoading(true);
        fetch('/api/categories')
            .then((res) => res.json())
            .then((data) => {
                setCategories(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(() => {
                setCategories([]);
                setLoading(false);
            });
    };

    useEffect(() => {
        setMounted(true);
        fetchCategories();
    }, []);

    const handleDelete = async (id: number, name: string) => {
        if (name === 'Khác') {
            alert('Không thể xóa thư mục mặc định "Khác".');
            return;
        }

        const reason = window.prompt(`Nhập lý do xóa danh mục "${name}" (bắt buộc):`);
        if (reason === null) return;
        if (!reason.trim()) {
            alert('Bạn phải nhập lý do xóa!');
            return;
        }

        const res = await fetch(`/api/categories?id=${id}&reason=${encodeURIComponent(reason)}`, { method: 'DELETE' });
        if (res.ok) {
            fetchCategories();
        } else {
            const data = await res.json();
            alert(data.error || 'Lỗi khi xóa danh mục');
        }
    };

    const handleSave = async () => {
        if (!editingCategory?.name?.trim()) return;

        const isNew = !editingCategory.id;
        const method = isNew ? 'POST' : 'PUT';

        const res = await fetch('/api/categories', {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: editingCategory.id,
                name: editingCategory.name.trim(),
                priority: editingCategory.priority ?? 0,
                emoji: editingCategory.emoji?.trim() || null,
                custom_emoji_id: editingCategory.custom_emoji_id?.trim() || null,
                is_active: editingCategory.is_active ?? 1,
            }),
        });

        if (res.ok) {
            setIsModalOpen(false);
            setEditingCategory(null);
            fetchCategories();
        } else {
            const data = await res.json();
            alert(data.error || 'Lỗi xảy ra');
        }
    };

    const handleToggleStatus = async (category: Category) => {
        const nextStatus = category.is_active ? 0 : 1;
        setCategories(current => current.map(c => c.id === category.id ? { ...c, is_active: nextStatus } : c));
        try {
            await fetch('/api/categories', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: category.id, is_active: nextStatus }),
            });
        } catch {
            fetchCategories();
        }
    };

    const openModal = (category?: Category) => {
        setEditingCategory(
            category
                ? { ...category, emoji: category.emoji || '', custom_emoji_id: category.custom_emoji_id || '', is_active: category.is_active ?? 1 }
                : { name: '', priority: 1, emoji: '', custom_emoji_id: '', is_active: 1 }
        );
        setIsModalOpen(true);
    };

    const filteredCategories = categories.filter((cat) => {
        const term = searchTerm.toLowerCase().trim();
        if (!term) return true;
        return (
            cat.name.toLowerCase().includes(term) ||
            (cat.emoji && cat.emoji.toLowerCase().includes(term)) ||
            (cat.custom_emoji_id && cat.custom_emoji_id.toLowerCase().includes(term)) ||
            String(cat.id).includes(term)
        );
    });

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-2 sm:p-4">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600 font-bold border border-orange-200 shadow-2xs">
                        <Layers className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-zinc-900 flex items-center gap-2">
                            DANH MỤC SẢN PHẨM
                        </h1>
                        <p className="text-xs text-zinc-500 font-medium">Quản lý danh mục và emoji.</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchCategories}
                        title="Tải lại"
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 active:scale-95 transition shadow-2xs"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={() => openModal()}
                        className="flex h-10 items-center gap-2 rounded-xl bg-orange-600 px-5 text-xs font-black uppercase text-white hover:bg-orange-700 active:scale-95 transition shadow-sm tracking-wide"
                    >
                        <Plus className="h-4 w-4 stroke-[3]" />
                        <span>+ DANH MỤC</span>
                    </button>
                </div>
            </div>

            {/* Table Container */}
            <div className="rounded-2xl border border-zinc-200 bg-white shadow-2xs overflow-hidden">
                {/* Search Bar */}
                <div className="p-3 sm:p-4 border-b border-zinc-100">
                    <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Tìm kiếm danh mục (tên, emoji, ID...)"
                            className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 pl-10 pr-4 py-2.5 text-xs font-medium text-zinc-900 outline-none focus:border-orange-500 focus:bg-white transition"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="border-b border-zinc-100 bg-zinc-50/60 text-[11px] font-black uppercase tracking-wider text-zinc-500">
                                <th className="px-3 py-3.5 font-extrabold text-center w-16">THỨ TỰ</th>
                                <th className="px-4 py-3.5 font-extrabold">DANH MỤC</th>
                                <th className="px-4 py-3.5 font-extrabold">EMOJI THƯỜNG</th>
                                <th className="px-4 py-3.5 font-extrabold">EMOJI ĐỘNG (ID)</th>
                                <th className="px-4 py-3.5 font-extrabold text-center">SẮP XẾP</th>
                                <th className="px-4 py-3.5 font-extrabold text-center">TRẠNG THÁI</th>
                                <th className="px-4 py-3.5 font-extrabold text-right">HÀNH ĐỘNG</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-xs font-medium text-zinc-400">
                                        Đang tải dữ liệu...
                                    </td>
                                </tr>
                            ) : filteredCategories.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-xs font-medium text-zinc-400">
                                        Không tìm thấy danh mục nào.
                                    </td>
                                </tr>
                            ) : (
                                filteredCategories.map((cat, index) => (
                                    <tr
                                        key={cat.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, index)}
                                        onDragOver={(e) => handleDragOver(e, index)}
                                        onDrop={(e) => handleDrop(e, index)}
                                        onDragEnd={() => { setDraggedIdx(null); setDragOverIdx(null); }}
                                        className={`hover:bg-zinc-50/80 transition-colors ${
                                            draggedIdx === index ? 'opacity-40 bg-orange-50' : ''
                                        } ${
                                            dragOverIdx === index ? 'border-b-2 border-orange-500 bg-orange-50/50' : ''
                                        }`}
                                    >
                                        <td className="px-3 py-3.5 text-center select-none">
                                            <div className="flex items-center justify-center gap-1 text-zinc-400">
                                                <GripVertical className="h-4 w-4 cursor-grab active:cursor-grabbing hover:text-orange-600 transition" />
                                                <div className="flex flex-col text-[10px]">
                                                    <button
                                                        type="button"
                                                        disabled={index === 0}
                                                        onClick={() => handleMoveCategory(index, 'up')}
                                                        className="hover:text-orange-600 disabled:opacity-20 disabled:hover:text-zinc-400 p-0.5 transition"
                                                        title="Di chuyển lên"
                                                    >
                                                        <ArrowUp className="h-3.5 w-3.5 stroke-[2.5]" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={index === filteredCategories.length - 1}
                                                        onClick={() => handleMoveCategory(index, 'down')}
                                                        className="hover:text-orange-600 disabled:opacity-20 disabled:hover:text-zinc-400 p-0.5 transition"
                                                        title="Di chuyển xuống"
                                                    >
                                                        <ArrowDown className="h-3.5 w-3.5 stroke-[2.5]" />
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="font-extrabold text-zinc-900 uppercase text-xs">
                                                {cat.name}
                                            </div>
                                            <div className="text-[10px] font-semibold text-zinc-400 flex items-center gap-1 mt-0.5">
                                                <span>🗂️ Menu: {cat.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5 font-medium text-zinc-600">
                                            {cat.emoji || '-'}
                                        </td>
                                        <td className="px-4 py-3.5 font-mono text-zinc-600 text-[11px]">
                                            {cat.custom_emoji_id || '-'}
                                        </td>
                                        <td className="px-4 py-3.5 text-center font-mono font-extrabold text-zinc-800">
                                            {cat.priority ?? 0}
                                        </td>
                                        <td className="px-4 py-3.5 text-center">
                                            <Switch
                                                checked={Boolean(cat.is_active ?? 1)}
                                                onCheckedChange={() => handleToggleStatus(cat)}
                                            />
                                        </td>
                                        <td className="px-4 py-3.5 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => openModal(cat)}
                                                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition active:scale-95"
                                                    title="Chỉnh sửa"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(cat.id, cat.name)}
                                                    disabled={cat.name === 'Khác'}
                                                    className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                                                    title="Xóa"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal DANH MỤC MỚI / CHỈNH SỬA DANH MỤC */}
            {isModalOpen && mounted && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
                    <div className="w-full max-w-md my-auto max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-zinc-200 animate-in zoom-in-95 duration-200">
                        {/* Top Accent Orange Border */}
                        <div className="h-1.5 w-full bg-orange-600" />

                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 border-b border-zinc-100">
                            <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50 text-orange-600 font-bold border border-orange-200">
                                    <Layers className="h-4 w-4" />
                                </div>
                                <h2 className="font-extrabold text-sm uppercase text-zinc-900 tracking-wide">
                                    {editingCategory?.id ? 'CHỈNH SỬA DANH MỤC' : 'DANH MỤC MỚI'}
                                </h2>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Modal Form Body */}
                        <div className="p-5 space-y-4">
                            {/* Field 1: TÊN DANH MỤC */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-700">
                                    TÊN DANH MỤC <span className="text-orange-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={editingCategory?.name || ''}
                                    onChange={(e) => setEditingCategory(prev => ({ ...prev!, name: e.target.value }))}
                                    placeholder="VD: CAP CUT"
                                    className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-xs font-semibold text-zinc-900 outline-none focus:border-orange-500 transition"
                                />
                            </div>

                            {/* Telegram Customization Box (Chỉ chọn 1 trong 2) */}
                            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-800">
                                        <Smile className="h-4 w-4 text-orange-500" />
                                        <span>TÙY CHỈNH NÚT BẤM DANH MỤC (CHỈ CHỌN 1 TRONG 2)</span>
                                    </div>
                                    {(editingCategory?.emoji || editingCategory?.custom_emoji_id) && (
                                        <button
                                            type="button"
                                            onClick={() => setEditingCategory(prev => ({ ...prev!, emoji: '', custom_emoji_id: '' }))}
                                            className="text-[10px] text-zinc-400 hover:text-red-600 font-bold transition"
                                        >
                                            Đặt lại mặc định
                                        </button>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className={`space-y-1 rounded-xl p-2.5 transition border ${editingCategory?.emoji ? 'border-orange-500 bg-white shadow-xs' : 'border-zinc-200/80 bg-white/60'}`}>
                                        <label className="text-[10px] font-bold uppercase text-zinc-600 flex items-center justify-between">
                                            <span>1. EMOJI THƯỜNG</span>
                                            {editingCategory?.emoji && <span className="text-[9px] text-orange-600 font-extrabold">ĐANG CHỌN</span>}
                                        </label>
                                        <input
                                            type="text"
                                            value={editingCategory?.emoji || ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setEditingCategory(prev => ({
                                                    ...prev!,
                                                    emoji: val,
                                                    custom_emoji_id: val ? '' : prev?.custom_emoji_id
                                                }));
                                            }}
                                            placeholder="VD: ✨, 📂..."
                                            className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-xs outline-none focus:border-orange-500"
                                        />
                                    </div>

                                    <div className={`space-y-1 rounded-xl p-2.5 transition border ${editingCategory?.custom_emoji_id ? 'border-orange-500 bg-white shadow-xs' : 'border-zinc-200/80 bg-white/60'}`}>
                                        <label className="text-[10px] font-bold uppercase text-zinc-600 flex items-center justify-between">
                                            <span>2. CUSTOM EMOJI ID ĐỘNG</span>
                                            {editingCategory?.custom_emoji_id && <span className="text-[9px] text-orange-600 font-extrabold">ĐANG CHỌN</span>}
                                        </label>
                                        <input
                                            type="text"
                                            value={editingCategory?.custom_emoji_id || ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setEditingCategory(prev => ({
                                                    ...prev!,
                                                    custom_emoji_id: val,
                                                    emoji: val ? '' : prev?.emoji
                                                }));
                                            }}
                                            placeholder="VD: 5375135722514685501"
                                            className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-mono outline-none focus:border-orange-500"
                                        />
                                    </div>
                                </div>
                                <p className="text-[10px] text-zinc-400 font-medium">
                                    💡 Nhập một trong 2 loại trên. Khi bạn gõ vào ô nào, ô còn lại sẽ tự động được xóa để tránh trùng lặp.
                                </p>
                            </div>

                            {/* Field 4: SẮP XẾP */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
                                    <Hash className="h-3.5 w-3.5 text-zinc-500" />
                                    <span>SẮP XẾP</span>
                                </label>
                                <input
                                    type="number"
                                    value={editingCategory?.priority ?? ''}
                                    onChange={(e) => setEditingCategory(prev => ({ ...prev!, priority: Number(e.target.value) }))}
                                    placeholder="Nhỏ hiện trước"
                                    className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-xs font-semibold text-zinc-900 outline-none focus:border-orange-500 transition"
                                />
                            </div>

                            {/* Field 5: TRẠNG THÁI (IS_ACTIVE) */}
                            <div className="pt-2">
                                <label className="flex items-center gap-2 text-xs font-extrabold text-zinc-800 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={Boolean(editingCategory?.is_active ?? 1)}
                                        onChange={(e) => setEditingCategory(prev => ({ ...prev!, is_active: e.target.checked ? 1 : 0 }))}
                                        className="h-4 w-4 rounded accent-orange-600"
                                    />
                                    <span>BẬT / HIỂN THỊ DANH MỤC (ACTIVE)</span>
                                </label>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end gap-2.5 p-4 bg-zinc-50/50 border-t border-zinc-100">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="rounded-xl border border-zinc-200 bg-zinc-100 px-5 py-2.5 text-xs font-extrabold text-zinc-700 hover:bg-zinc-200 active:scale-95 transition"
                            >
                                HỦY
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={!editingCategory?.name?.trim()}
                                className="rounded-xl bg-orange-600 px-5 py-2.5 text-xs font-extrabold uppercase text-white hover:bg-orange-700 active:scale-95 transition shadow-xs disabled:opacity-50 disabled:pointer-events-none"
                            >
                                {editingCategory?.id ? 'LƯU LẠI' : 'THÊM DANH MỤC'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
