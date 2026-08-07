'use client';

import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Folder, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog } from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';

interface Category {
    id: number;
    name: string;
    priority: number;
    product_count: number;
    total_accounts: number;
    sold_accounts: number;
    all_accounts: number;
    created_at: string;
}

interface CategoryProduct {
    id: number; name: string; code?: string; price: number;
    total_accounts: number; available_accounts: number; sold_accounts: number;
}

interface InventoryAccount {
    id: number; username: string; password?: string; status: string;
}

export default function CategoriesPage() {
    const { t } = useLanguage();
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [categoryDetail, setCategoryDetail] = useState<{ category: Category; products: CategoryProduct[] } | null>(null);
    const [selectedProduct, setSelectedProduct] = useState<CategoryProduct | null>(null);
    const [productAccounts, setProductAccounts] = useState<InventoryAccount[]>([]);
    const [accountsLoading, setAccountsLoading] = useState(false);
    const [accountFilter, setAccountFilter] = useState<'all' | 'available' | 'sold'>('all');

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
        fetchCategories();
    }, []);

    const openCategoryDetail = async (category: Category) => {
        setDetailOpen(true);
        setDetailLoading(true);
        setCategoryDetail(null);
        setSelectedProduct(null);
        setProductAccounts([]);
        try {
            const response = await fetch(`/api/categories?detailId=${category.id}`);
            if (!response.ok) throw new Error('Không thể tải chi tiết thư mục');
            setCategoryDetail(await response.json());
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Không thể tải chi tiết thư mục');
            setDetailOpen(false);
        } finally {
            setDetailLoading(false);
        }
    };

    const openProductAccounts = async (product: CategoryProduct) => {
        setSelectedProduct(product);
        setAccountsLoading(true);
        setAccountFilter('all');
        try {
            const response = await fetch(`/api/inventory?productId=${product.id}&page=1&limit=200`);
            const firstPage = await response.json();
            const totalPages = Number(firstPage.pagination?.totalPages || 1);
            const remainingPages = totalPages > 1
                ? await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) =>
                    fetch(`/api/inventory?productId=${product.id}&page=${index + 2}&limit=200`).then(res => res.json())
                ))
                : [];
            setProductAccounts([
                ...(Array.isArray(firstPage.accounts) ? firstPage.accounts : []),
                ...remainingPages.flatMap(pageData => Array.isArray(pageData.accounts) ? pageData.accounts : [])
            ]);
        } finally {
            setAccountsLoading(false);
        }
    };

    const handleDelete = async (id: number, name: string) => {
        if (name === 'Khác') {
            alert('Không thể xóa thư mục mặc định "Khác".');
            return;
        }

        const reason = window.prompt(`Nhập lý do xóa thư mục "${name}" (bắt buộc):`);
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
            alert(data.error || 'Lỗi khi xóa thư mục');
        }
    };

    const handleSave = async () => {
        if (!editingCategory?.name) return;

        const isNew = !editingCategory.id;
        const method = isNew ? 'POST' : 'PUT';

        const res = await fetch('/api/categories', {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editingCategory),
        });

        if (res.ok) {
            alert(isNew ? 'Thêm thư mục thành công!' : 'Cập nhật thư mục thành công!');
            setIsModalOpen(false);
            setEditingCategory(null);
            fetchCategories();
        } else {
            const data = await res.json();
            alert(data.error || 'Lỗi xảy ra');
        }
    };

    const openModal = (category?: Category) => {
        setEditingCategory(category || { priority: 0 });
        setIsModalOpen(true);
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const visibleAccounts = accountFilter === 'all'
        ? productAccounts
        : productAccounts.filter(account => account.status === accountFilter);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Thư mục</h2>
                    <p className="text-muted-foreground">Quản lý các danh mục phân loại dịch vụ/sản phẩm</p>
                </div>
                <Button onClick={() => openModal()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Thêm thư mục mới
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Folder className="w-5 h-5" />
                        Danh sách thư mục ({categories.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[100px]">ID</TableHead>
                                    <TableHead>Tên thư mục</TableHead>
                                    <TableHead className="w-[170px]">Tổng tài khoản</TableHead>
                                    <TableHead className="w-[150px]">Độ ưu tiên</TableHead>
                                    <TableHead className="w-[200px]">Ngày tạo</TableHead>
                                    <TableHead className="w-[150px] text-right">Hành động</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">
                                            Đang tải...
                                        </TableCell>
                                    </TableRow>
                                ) : categories.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                            Chưa có thư mục nào
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    categories.map((cat) => (
                                        <TableRow key={cat.id} onClick={() => openCategoryDetail(cat)} className="cursor-pointer transition-colors hover:bg-emerald-50/60">
                                            <TableCell>#{cat.id}</TableCell>
                                            <TableCell>
                                                <div className="font-semibold">{cat.name}</div>
                                                <div className="mt-1 text-xs text-zinc-500">{Number(cat.product_count || 0)} sản phẩm · bấm để xem chi tiết</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-800">
                                                    <span className="font-mono text-sm font-bold">{Number(cat.total_accounts || 0).toLocaleString('vi-VN')}</span>
                                                    <span className="text-xs font-medium">còn lại</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100 border">
                                                    {cat.priority || 0}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {formatDate(cat.created_at)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="text-emerald-600"
                                                        onClick={(event) => { event.stopPropagation(); openModal(cat); }}
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="text-red-600"
                                                        onClick={(event) => { event.stopPropagation(); handleDelete(cat.id, cat.name); }}
                                                        disabled={cat.name === 'Khác'}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog
                open={detailOpen}
                onOpenChange={setDetailOpen}
                title={categoryDetail ? `Kho hàng · ${categoryDetail.category.name}` : 'Chi tiết thư mục'}
                description="Chọn sản phẩm để theo dõi tài khoản còn trong kho và đã bán."
                className="max-w-6xl"
            >
                {detailLoading ? (
                    <div className="space-y-3 py-5">
                        {[1, 2, 3].map(item => <div key={item} className="h-16 animate-pulse rounded-xl bg-zinc-100" />)}
                    </div>
                ) : categoryDetail && (
                    <div className="space-y-5 pt-4">
                        <div className="grid grid-cols-3 divide-x divide-zinc-200 rounded-xl border border-zinc-200 bg-zinc-50 py-4 text-center">
                            <div><div className="font-mono text-2xl font-bold text-zinc-900">{categoryDetail.products.length}</div><div className="text-xs text-zinc-500">Sản phẩm</div></div>
                            <div><div className="font-mono text-2xl font-bold text-emerald-700">{categoryDetail.products.reduce((sum, p) => sum + Number(p.available_accounts), 0)}</div><div className="text-xs text-zinc-500">Còn trong kho</div></div>
                            <div><div className="font-mono text-2xl font-bold text-sky-700">{categoryDetail.products.reduce((sum, p) => sum + Number(p.sold_accounts), 0)}</div><div className="text-xs text-zinc-500">Đã bán</div></div>
                        </div>

                        <div className="grid min-h-[420px] gap-4 lg:grid-cols-[.85fr_1.4fr]">
                            <div className="space-y-2 border-r-0 border-zinc-200 lg:border-r lg:pr-4">
                                <p className="pb-1 text-xs font-bold uppercase tracking-[.14em] text-zinc-500">Danh sách sản phẩm</p>
                                {categoryDetail.products.length === 0 ? <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">Thư mục chưa có sản phẩm.</div> : categoryDetail.products.map(product => (
                                    <button key={product.id} type="button" onClick={() => openProductAccounts(product)} className={`w-full rounded-xl border p-3 text-left transition active:scale-[.99] ${selectedProduct?.id === product.id ? 'border-emerald-500 bg-emerald-50' : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'}`}>
                                        <div className="flex items-start justify-between gap-3"><div><div className="font-semibold text-zinc-900">{product.name}</div><div className="mt-1 text-xs text-zinc-500">{product.code || `#${product.id}`}</div></div><span className="rounded-md bg-zinc-900 px-2 py-1 font-mono text-xs text-white">{Number(product.total_accounts)}</span></div>
                                        <div className="mt-3 flex gap-3 text-xs"><span className="font-medium text-emerald-700">Còn {Number(product.available_accounts)}</span><span className="font-medium text-sky-700">Đã bán {Number(product.sold_accounts)}</span></div>
                                    </button>
                                ))}
                            </div>

                            <div className="min-w-0">
                                {!selectedProduct ? (
                                    <div className="grid h-full min-h-72 place-items-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 p-8 text-center"><div><Folder className="mx-auto mb-3 h-9 w-9 text-zinc-400" /><p className="font-semibold text-zinc-700">Chọn một sản phẩm</p><p className="mt-1 text-sm text-zinc-500">Danh sách tài khoản sẽ hiển thị tại đây.</p></div></div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-bold text-zinc-900">{selectedProduct.name}</h3><p className="text-xs text-zinc-500">Tổng {productAccounts.length} tài khoản đã tải</p></div><div className="flex rounded-lg border border-zinc-200 bg-zinc-50 p-1">{(['all', 'available', 'sold'] as const).map(filter => <button key={filter} type="button" onClick={() => setAccountFilter(filter)} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${accountFilter === filter ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`}>{filter === 'all' ? 'Tất cả' : filter === 'available' ? 'Còn lại' : 'Đã bán'}</button>)}</div></div>
                                        <div className="max-h-[390px] overflow-auto rounded-xl border border-zinc-200">
                                            {accountsLoading ? <div className="p-8 text-center text-sm text-zinc-500">Đang tải tài khoản...</div> : visibleAccounts.length === 0 ? <div className="p-8 text-center text-sm text-zinc-500">Không có tài khoản ở trạng thái này.</div> : <div className="divide-y divide-zinc-100">{visibleAccounts.map(account => <div key={account.id} className="flex items-center justify-between gap-3 p-3"><div className="min-w-0"><div className="truncate font-mono text-sm font-medium text-zinc-900">{account.username}</div><div className="mt-1 text-xs text-zinc-400">ID #{account.id}</div></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${account.status === 'available' ? 'bg-emerald-100 text-emerald-800' : account.status === 'sold' ? 'bg-sky-100 text-sky-800' : 'bg-zinc-100 text-zinc-600'}`}>{account.status === 'available' ? 'Còn lại' : account.status === 'sold' ? 'Đã bán' : account.status}</span></div>)}</div>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </Dialog>

            <Dialog
                open={isModalOpen}
                onOpenChange={setIsModalOpen}
                title={editingCategory?.id ? 'Chỉnh sửa thư mục' : 'Thêm thư mục mới'}
            >
                <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Tên thư mục</label>
                        <Input
                            value={editingCategory?.name || ''}
                            onChange={(e) => setEditingCategory(prev => ({ ...prev!, name: e.target.value }))}
                            placeholder="Ví dụ: GMAIL, CHATGPT, PROXY..."
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Độ ưu tiên (Số lớn hiện trước)</label>
                        <Input
                            type="number"
                            value={editingCategory?.priority ?? 0}
                            onChange={(e) => setEditingCategory(prev => ({ ...prev!, priority: Number(e.target.value) }))}
                            placeholder="0"
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>Hủy</Button>
                        <Button onClick={handleSave} disabled={!editingCategory?.name?.trim()}>Lưu lại</Button>
                    </div>
                </div>
            </Dialog>
        </div>
    );
}
