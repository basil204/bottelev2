'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { RefreshCw, Plus, Trash2, Tag } from 'lucide-react';

interface AccountType {
    id: number;
    name: string;
    created_at: string;
}

export default function AccountTypesPage() {
    const [types, setTypes] = useState<AccountType[]>([]);
    const [loading, setLoading] = useState(true);
    const [newTypeName, setNewTypeName] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchTypes();
    }, []);

    const fetchTypes = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/account-types');
            const data = await res.json();
            if (data.success) {
                setTypes(data.data || []);
            }
        } catch (error) {
            console.error('Error fetching account types:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async () => {
        if (!newTypeName.trim()) {
            alert('Vui lòng nhập tên loại tài khoản');
            return;
        }

        try {
            setSaving(true);
            const res = await fetch('/api/account-types', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newTypeName.trim() })
            });
            const data = await res.json();
            if (data.success) {
                setNewTypeName('');
                fetchTypes();
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error('Error adding account type:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Bạn có chắc muốn xóa loại tài khoản này?\n\n⚠️ Tất cả tài khoản thuộc loại này cũng sẽ bị xóa!')) return;

        try {
            const res = await fetch('/api/account-types', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const data = await res.json();
            if (data.success) {
                fetchTypes();
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error('Error deleting account type:', error);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleAdd();
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold">Loại Tài Khoản</h2>
                    <p className="text-muted-foreground">Quản lý các loại tài khoản trong kho</p>
                </div>
                <Button onClick={fetchTypes} variant="outline">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Làm mới
                </Button>
            </div>

            {/* Add new type */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Thêm loại mới</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <Input
                                placeholder="Nhập tên loại tài khoản (VD: Netflix, Spotify, Disney+...)"
                                value={newTypeName}
                                onChange={(e) => setNewTypeName(e.target.value)}
                                onKeyPress={handleKeyPress}
                            />
                        </div>
                        <Button onClick={handleAdd} disabled={saving}>
                            <Plus className="w-4 h-4 mr-2" />
                            {saving ? 'Đang thêm...' : 'Thêm'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Types list */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg">
                        Danh sách ({types.length} loại)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                            <p className="mt-2 text-muted-foreground">Đang tải...</p>
                        </div>
                    ) : types.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Tag className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>Chưa có loại tài khoản nào</p>
                            <p className="text-sm">Thêm loại tài khoản để bắt đầu</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[80px]">ID</TableHead>
                                    <TableHead>Tên loại</TableHead>
                                    <TableHead className="w-[150px]">Ngày tạo</TableHead>
                                    <TableHead className="w-[100px]">Hành động</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {types.map((type) => (
                                    <TableRow key={type.id}>
                                        <TableCell className="font-mono">{type.id}</TableCell>
                                        <TableCell className="font-medium">{type.name}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {new Date(type.created_at).toLocaleDateString('vi-VN')}
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => handleDelete(type.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
