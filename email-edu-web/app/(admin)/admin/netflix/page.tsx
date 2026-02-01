'use client';

import { useEffect, useState, useCallback } from 'react';
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
import { Search, RefreshCw, Copy, Check, Film } from 'lucide-react';

interface NetflixItem {
    code: string;
    info: string;
}

export default function NetflixPage() {
    const [items, setItems] = useState<NetflixItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

    const fetchData = useCallback(async (searchQuery: string = '') => {
        try {
            setLoading(true);
            const url = searchQuery
                ? `/api/netflix?search=${encodeURIComponent(searchQuery)}`
                : '/api/netflix';
            const res = await fetch(url);
            const data = await res.json();
            if (data.success) {
                setItems(data.data || []);
            }
        } catch (error) {
            console.error('Error fetching Netflix data:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSearch = () => {
        fetchData(search);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const copyInfo = (info: string, idx: number) => {
        navigator.clipboard.writeText(info);
        setCopiedIdx(idx);
        setTimeout(() => setCopiedIdx(null), 2000);
    };

    // Parse info to extract email and password
    const parseInfo = (info: string) => {
        const parts = info.split(' ');
        let email = '';
        let password = '';

        for (const part of parts) {
            if (part.includes('@')) {
                email = part;
            } else if (part.match(/^[a-zA-Z0-9]+$/)) {
                password = part;
            }
        }

        return { email, password, raw: info };
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold">Netflix Manager</h2>
                    <p className="text-muted-foreground">Quản lý tài khoản Netflix từ Google Sheets</p>
                </div>
                <Button onClick={() => fetchData(search)} variant="outline">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Làm mới
                </Button>
            </div>

            {/* Search */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Tìm kiếm</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <Input
                                placeholder="Tìm theo mã hàng hoặc email..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyPress={handleKeyPress}
                            />
                        </div>
                        <Button onClick={handleSearch}>
                            <Search className="w-4 h-4 mr-2" />
                            Tìm kiếm
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Data Table */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg">
                        Danh sách ({items.length} kết quả)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                            <p className="mt-2 text-muted-foreground">Đang tải dữ liệu...</p>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Film className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>Không tìm thấy kết quả</p>
                        </div>
                    ) : (
                        <div className="max-h-[600px] overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[150px]">Mã hàng</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Mật khẩu</TableHead>
                                        <TableHead className="w-[100px]">Hành động</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.map((item, idx) => {
                                        const parsed = parseInfo(item.info);
                                        return (
                                            <TableRow key={idx}>
                                                <TableCell className="font-mono font-medium">
                                                    {item.code}
                                                </TableCell>
                                                <TableCell>
                                                    {parsed.email ? (
                                                        <code className="text-sm bg-muted px-2 py-1 rounded">
                                                            {parsed.email}
                                                        </code>
                                                    ) : (
                                                        <span className="text-muted-foreground text-sm">
                                                            {item.info.substring(0, 30)}...
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {parsed.password ? (
                                                        <code className="text-sm bg-green-500/10 text-green-600 px-2 py-1 rounded font-mono">
                                                            {parsed.password}
                                                        </code>
                                                    ) : '-'}
                                                </TableCell>
                                                <TableCell>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => copyInfo(item.info, idx)}
                                                    >
                                                        {copiedIdx === idx ? (
                                                            <Check className="w-4 h-4 text-green-500" />
                                                        ) : (
                                                            <Copy className="w-4 h-4" />
                                                        )}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
