'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Key, Plus, Copy, Check, Trash2, RefreshCw } from 'lucide-react';

interface TwoFAItem {
    id: number;
    name: string;
    secret: string;
    created_at: string;
}

export default function TwoFAPage() {
    const [items, setItems] = useState<TwoFAItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState('');
    const [secret, setSecret] = useState('');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');
    const [copiedId, setCopiedId] = useState<number | null>(null);
    const [otpCodes, setOtpCodes] = useState<{ [key: number]: string }>({});
    const [otpLoading, setOtpLoading] = useState<number | null>(null);

    useEffect(() => {
        fetchItems();
    }, []);

    const fetchItems = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/2fa/items');
            const data = await res.json();
            if (data.success) {
                setItems(data.data || []);
            }
        } catch (error) {
            console.error('Error fetching 2FA items:', error);
        } finally {
            setLoading(false);
        }
    };

    const createItem = async () => {
        if (!name.trim() || !secret.trim()) {
            setError('Vui lòng nhập tên và secret');
            return;
        }

        setCreating(true);
        setError('');

        try {
            const res = await fetch('/api/2fa/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim(), secret: secret.trim() })
            });
            const data = await res.json();

            if (data.success) {
                setName('');
                setSecret('');
                fetchItems();
            } else {
                setError(data.error || 'Lỗi tạo mã 2FA');
            }
        } catch (error) {
            console.error('Error creating 2FA item:', error);
            setError('Đã xảy ra lỗi');
        } finally {
            setCreating(false);
        }
    };

    const deleteItem = async (id: number) => {
        if (!confirm('Bạn có chắc muốn xóa mã 2FA này?')) return;

        try {
            const res = await fetch('/api/2fa/items', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const data = await res.json();
            if (data.success) {
                fetchItems();
            }
        } catch (error) {
            console.error('Error deleting 2FA item:', error);
        }
    };

    const getOTP = async (item: TwoFAItem) => {
        setOtpLoading(item.id);
        try {
            const res = await fetch(`/api/2fa?secret=${item.secret}`);
            const data = await res.json();
            if (data.success && data.token) {
                setOtpCodes(prev => ({ ...prev, [item.id]: data.token }));
                navigator.clipboard.writeText(data.token);
                setCopiedId(item.id);
                setTimeout(() => setCopiedId(null), 2000);
            } else {
                setError(data.error || 'Không lấy được mã OTP');
            }
        } catch (error) {
            console.error('Error fetching OTP:', error);
        } finally {
            setOtpLoading(null);
        }
    };

    const copySecret = (secret: string, id: number) => {
        navigator.clipboard.writeText(secret);
        setCopiedId(id + 10000);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold">Quản lý 2FA</h2>
                    <p className="text-muted-foreground">Lưu trữ và lấy mã OTP từ 2fa.live</p>
                </div>
                <Button onClick={fetchItems} variant="outline">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Làm mới
                </Button>
            </div>

            {/* Create Form */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Thêm mã 2FA mới</CardTitle>
                    <CardDescription>Nhập tên và secret để lưu trữ</CardDescription>
                </CardHeader>
                <CardContent>
                    {error && (
                        <div className="p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                            {error}
                        </div>
                    )}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1">
                            <Label className="sr-only">Tên</Label>
                            <Input
                                placeholder="Tên (vd: Gmail, Discord...)"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                        <div className="flex-[2]">
                            <Label className="sr-only">Secret</Label>
                            <Input
                                placeholder="Secret key (vd: soev6k4ml625ouo5l45kuaynr6nfepw2)"
                                value={secret}
                                onChange={(e) => setSecret(e.target.value)}
                            />
                        </div>
                        <Button onClick={createItem} disabled={creating}>
                            <Plus className="w-4 h-4 mr-2" />
                            {creating ? 'Đang thêm...' : 'Thêm'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* List */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Danh sách 2FA ({items.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8">Đang tải...</div>
                    ) : items.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Key className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>Chưa có mã 2FA nào</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Tên</TableHead>
                                    <TableHead>Secret</TableHead>
                                    <TableHead>Mã OTP</TableHead>
                                    <TableHead>Hành động</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium">{item.name}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <code className="text-xs bg-muted px-2 py-1 rounded">
                                                    {item.secret.substring(0, 10)}...
                                                </code>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => copySecret(item.secret, item.id)}
                                                >
                                                    {copiedId === item.id + 10000 ? (
                                                        <Check className="w-3 h-3 text-green-500" />
                                                    ) : (
                                                        <Copy className="w-3 h-3" />
                                                    )}
                                                </Button>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {otpCodes[item.id] ? (
                                                <div className="flex items-center gap-2">
                                                    <code className="px-3 py-1 bg-green-500/10 text-green-600 rounded font-mono font-bold">
                                                        {otpCodes[item.id]}
                                                    </code>
                                                    {copiedId === item.id && (
                                                        <Check className="w-4 h-4 text-green-500" />
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => getOTP(item)}
                                                        disabled={otpLoading === item.id}
                                                    >
                                                        <RefreshCw className={`w-3 h-3 ${otpLoading === item.id ? 'animate-spin' : ''}`} />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => getOTP(item)}
                                                    disabled={otpLoading === item.id}
                                                >
                                                    <Key className="w-3 h-3 mr-1" />
                                                    {otpLoading === item.id ? '...' : 'Lấy mã'}
                                                </Button>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => deleteItem(item.id)}
                                            >
                                                <Trash2 className="w-4 h-4 text-destructive" />
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
