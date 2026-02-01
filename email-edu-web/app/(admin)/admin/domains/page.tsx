'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Plus, Trash2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

interface Domain {
    id: number;
    domain: string;
    is_active: boolean;
    created_at: string;
}

export default function DomainsPage() {
    const [domains, setDomains] = useState<Domain[]>([]);
    const [loading, setLoading] = useState(true);
    const [newDomain, setNewDomain] = useState('');
    const [adding, setAdding] = useState(false);

    useEffect(() => {
        fetchDomains();
    }, []);

    const fetchDomains = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/domains');
            const data = await res.json();
            if (data.success) {
                setDomains(data.data);
            }
        } catch (error) {
            console.error('Error fetching domains:', error);
        } finally {
            setLoading(false);
        }
    };

    const addDomain = async () => {
        if (!newDomain.trim()) return;

        try {
            setAdding(true);
            const res = await fetch('/api/domains', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domain: newDomain.trim() })
            });
            const data = await res.json();
            if (data.success) {
                setNewDomain('');
                fetchDomains();
            } else {
                alert(data.error || 'Lỗi thêm domain');
            }
        } catch (error) {
            console.error('Error adding domain:', error);
        } finally {
            setAdding(false);
        }
    };

    const toggleDomain = async (id: number, isActive: boolean) => {
        try {
            const res = await fetch('/api/domains', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, is_active: !isActive })
            });
            const data = await res.json();
            if (data.success) {
                fetchDomains();
            }
        } catch (error) {
            console.error('Error toggling domain:', error);
        }
    };

    const deleteDomain = async (id: number) => {
        if (!confirm('Bạn có chắc muốn xóa domain này?')) return;

        try {
            const res = await fetch('/api/domains', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const data = await res.json();
            if (data.success) {
                fetchDomains();
            }
        } catch (error) {
            console.error('Error deleting domain:', error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold">Quản lý Domains</h2>
                    <p className="text-muted-foreground">Thêm và quản lý các domain EDU</p>
                </div>
                <Button onClick={fetchDomains} variant="outline">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Làm mới
                </Button>
            </div>

            {/* Add Domain */}
            <Card>
                <CardHeader>
                    <CardTitle>Thêm Domain mới</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <Label htmlFor="domain">Tên Domain</Label>
                            <Input
                                id="domain"
                                placeholder="example.edu.vn"
                                value={newDomain}
                                onChange={(e) => setNewDomain(e.target.value)}
                            />
                        </div>
                        <div className="flex items-end">
                            <Button onClick={addDomain} disabled={adding || !newDomain.trim()}>
                                <Plus className="w-4 h-4 mr-2" />
                                {adding ? 'Đang thêm...' : 'Thêm Domain'}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Domains Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Danh sách Domains ({domains.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8">Đang tải...</div>
                    ) : domains.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Chưa có domain nào
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>ID</TableHead>
                                    <TableHead>Domain</TableHead>
                                    <TableHead>Trạng thái</TableHead>
                                    <TableHead>Hành động</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {domains.map((domain) => (
                                    <TableRow key={domain.id}>
                                        <TableCell>{domain.id}</TableCell>
                                        <TableCell className="font-mono">{domain.domain}</TableCell>
                                        <TableCell>
                                            {domain.is_active ? (
                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                                                    <CheckCircle className="w-3 h-3 mr-1" />
                                                    Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                                                    <XCircle className="w-3 h-3 mr-1" />
                                                    Inactive
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => toggleDomain(domain.id, domain.is_active)}
                                                >
                                                    {domain.is_active ? 'Tắt' : 'Bật'}
                                                </Button>
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={() => deleteDomain(domain.id)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
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
