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
    created_at: string;
}

export default function CategoriesPage() {
    const { t } = useLanguage();
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);

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
                                    <TableHead className="w-[150px]">Độ ưu tiên</TableHead>
                                    <TableHead className="w-[200px]">Ngày tạo</TableHead>
                                    <TableHead className="w-[150px] text-right">Hành động</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            Đang tải...
                                        </TableCell>
                                    </TableRow>
                                ) : categories.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                            Chưa có thư mục nào
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    categories.map((cat) => (
                                        <TableRow key={cat.id}>
                                            <TableCell>#{cat.id}</TableCell>
                                            <TableCell className="font-semibold">{cat.name}</TableCell>
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
                                                        className="text-blue-600"
                                                        onClick={() => openModal(cat)}
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="text-red-600"
                                                        onClick={() => handleDelete(cat.id, cat.name)}
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
