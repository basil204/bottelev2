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
import { RefreshCw, Plus, Trash2, Globe, Check, X } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface TMailDomain {
    id: number;
    domain: string;
    is_active: boolean;
    created_at: string;
}

export default function AdminTMailDomainsPage() {
    const [domains, setDomains] = useState<TMailDomain[]>([]);
    const [loading, setLoading] = useState(true);
    const [newDomain, setNewDomain] = useState('');
    const [adding, setAdding] = useState(false);

    useEffect(() => {
        fetchDomains();
    }, []);

    const fetchDomains = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/tmail/domains');
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
            const res = await fetch('/api/tmail/domains', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domain: newDomain.trim() })
            });
            const data = await res.json();
            if (data.success) {
                setNewDomain('');
                fetchDomains();
            } else {
                alert(data.error || 'Không thể thêm domain');
            }
        } catch (error) {
            console.error('Error adding domain:', error);
        } finally {
            setAdding(false);
        }
    };

    const toggleActive = async (id: number, currentStatus: boolean) => {
        try {
            const res = await fetch('/api/tmail/domains', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, is_active: !currentStatus })
            });
            const data = await res.json();
            if (data.success) {
                fetchDomains();
            }
        } catch (error) {
            console.error('Error updating domain:', error);
        }
    };

    const deleteDomain = async (id: number) => {
        if (!confirm('Bạn có chắc muốn xóa domain này?')) return;

        try {
            const res = await fetch('/api/tmail/domains', {
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
                    <h2 className="text-3xl font-bold">Quản lý tMail Domains</h2>
                    <p className="text-muted-foreground">Thêm và quản lý các domain tMail</p>
                </div>
                <Button onClick={fetchDomains} variant="outline">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Làm mới
                </Button>
            </div>

            {/* Add Domain Form */}
            <Card>
                <CardHeader>
                    <CardTitle>Thêm Domain mới</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <Input
                                placeholder="Nhập domain (vd: example.com)"
                                value={newDomain}
                                onChange={(e) => setNewDomain(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addDomain()}
                            />
                        </div>
                        <Button onClick={addDomain} disabled={adding || !newDomain.trim()}>
                            <Plus className="w-4 h-4 mr-2" />
                            {adding ? 'Đang thêm...' : 'Thêm Domain'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Domains List */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Globe className="w-5 h-5" />
                        Danh sách Domains ({domains.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8">Đang tải...</div>
                    ) : domains.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Chưa có domain nào. Thêm mới ở form trên.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>ID</TableHead>
                                    <TableHead>Domain</TableHead>
                                    <TableHead>Trạng thái</TableHead>
                                    <TableHead>Ngày tạo</TableHead>
                                    <TableHead>Hành động</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {domains.map((domain) => (
                                    <TableRow key={domain.id}>
                                        <TableCell>{domain.id}</TableCell>
                                        <TableCell className="font-mono">{domain.domain}</TableCell>
                                        <TableCell>
                                            <Button
                                                variant={domain.is_active ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => toggleActive(domain.id, domain.is_active)}
                                            >
                                                {domain.is_active ? (
                                                    <>
                                                        <Check className="w-4 h-4 mr-1" />
                                                        Active
                                                    </>
                                                ) : (
                                                    <>
                                                        <X className="w-4 h-4 mr-1" />
                                                        Inactive
                                                    </>
                                                )}
                                            </Button>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {formatDate(domain.created_at)}
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => deleteDomain(domain.id)}
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
