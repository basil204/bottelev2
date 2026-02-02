'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { RefreshCw, Copy, Check, Trash2, Clock, Key, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate, getTimeRemaining } from '@/lib/utils';

interface Email {
    id: number;
    email: string;
    password: string;
    '2fa_secret'?: string;
    domain_name: string;
    status: string;
    delete_at: string | null;
    deleted_at: string | null;
    created_at: string;
}

export default function MyEmailsPage() {
    const [emails, setEmails] = useState<Email[]>([]);
    const [loading, setLoading] = useState(true);
    const [copiedId, setCopiedId] = useState<number | null>(null);
    const [twoFaLoading, setTwoFaLoading] = useState<number | null>(null);
    const [twoFaCodes, setTwoFaCodes] = useState<{ [key: number]: string }>({});

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Selection state
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [deleteLoading, setDeleteLoading] = useState(false);

    useEffect(() => {
        fetchEmails();
    }, []);

    const fetchEmails = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/emails');
            const data = await res.json();
            if (data.success) {
                setEmails(data.data);
            }
        } catch (error) {
            console.error('Error fetching emails:', error);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (email: Email) => {
        navigator.clipboard.writeText(`${email.email}|${email.password}`);
        setCopiedId(email.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const deleteEmail = async (id: number) => {
        if (!confirm('Bạn có chắc muốn xóa email này?')) return;

        try {
            const res = await fetch('/api/emails', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const data = await res.json();
            if (data.success) {
                fetchEmails();
            }
        } catch (error) {
            console.error('Error deleting email:', error);
        }
    };

    const deleteSelected = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Bạn có chắc muốn xóa ${selectedIds.size} email đã chọn?`)) return;

        try {
            setDeleteLoading(true);
            const res = await fetch('/api/emails', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: Array.from(selectedIds) })
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                setSelectedIds(new Set());
                fetchEmails();
            }
        } catch (error) {
            console.error('Error deleting emails:', error);
        } finally {
            setDeleteLoading(false);
        }
    };

    const deleteAllActive = async () => {
        if (activeEmails.length === 0) return;
        if (!confirm(`Bạn có chắc muốn xóa TẤT CẢ ${activeEmails.length} email active?`)) return;

        try {
            setDeleteLoading(true);
            const ids = activeEmails.map(e => e.id);
            const res = await fetch('/api/emails', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids })
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                setSelectedIds(new Set());
                fetchEmails();
            }
        } catch (error) {
            console.error('Error deleting all emails:', error);
        } finally {
            setDeleteLoading(false);
        }
    };

    const fetch2FA = async (email: Email) => {
        if (!email['2fa_secret']) return;

        setTwoFaLoading(email.id);
        try {
            const res = await fetch(`/api/2fa?secret=${email['2fa_secret']}`);
            const data = await res.json();
            if (data.success && data.token) {
                setTwoFaCodes(prev => ({ ...prev, [email.id]: data.token }));
                // Auto copy to clipboard
                navigator.clipboard.writeText(data.token);
            }
        } catch (error) {
            console.error('Error fetching 2FA:', error);
        } finally {
            setTwoFaLoading(null);
        }
    };

    const activeEmails = emails.filter(e => e.status === 'active');
    const deletedEmails = emails.filter(e => e.status === 'deleted');

    // Pagination logic
    const totalPages = Math.ceil(activeEmails.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedEmails = activeEmails.slice(startIndex, endIndex);

    // Selection logic
    const currentPageIds = paginatedEmails.map(e => e.id);
    const allCurrentPageSelected = currentPageIds.length > 0 && currentPageIds.every(id => selectedIds.has(id));
    const someCurrentPageSelected = currentPageIds.some(id => selectedIds.has(id));

    const toggleSelectAll = () => {
        if (allCurrentPageSelected) {
            // Deselect all on current page
            const newSelected = new Set(selectedIds);
            currentPageIds.forEach(id => newSelected.delete(id));
            setSelectedIds(newSelected);
        } else {
            // Select all on current page
            const newSelected = new Set(selectedIds);
            currentPageIds.forEach(id => newSelected.add(id));
            setSelectedIds(newSelected);
        }
    };

    const toggleSelect = (id: number) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    const handleItemsPerPageChange = (value: string) => {
        setItemsPerPage(Number(value));
        setCurrentPage(1);
        setSelectedIds(new Set());
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold">Email của tôi</h2>
                    <p className="text-muted-foreground">Danh sách email bạn đã tạo</p>
                </div>
                <div className="flex gap-2">
                    {selectedIds.size > 0 && (
                        <Button
                            onClick={deleteSelected}
                            variant="destructive"
                            disabled={deleteLoading}
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {deleteLoading ? 'Đang xóa...' : `Xóa đã chọn (${selectedIds.size})`}
                        </Button>
                    )}
                    <Button
                        onClick={deleteAllActive}
                        variant="destructive"
                        disabled={deleteLoading || activeEmails.length === 0}
                    >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Xóa tất cả ({activeEmails.length})
                    </Button>
                    <Button onClick={fetchEmails} variant="outline">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Làm mới
                    </Button>
                </div>
            </div>

            {/* Active Emails */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Emails Active ({activeEmails.length})</CardTitle>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Hiển thị:</span>
                        <select
                            value={itemsPerPage}
                            onChange={(e) => handleItemsPerPageChange(e.target.value)}
                            className="border rounded px-2 py-1 text-sm bg-background"
                        >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8">Đang tải...</div>
                    ) : activeEmails.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Chưa có email nào
                        </div>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[50px]">
                                            <input
                                                type="checkbox"
                                                checked={allCurrentPageSelected}
                                                ref={input => {
                                                    if (input) {
                                                        input.indeterminate = someCurrentPageSelected && !allCurrentPageSelected;
                                                    }
                                                }}
                                                onChange={toggleSelectAll}
                                                className="w-4 h-4 cursor-pointer"
                                            />
                                        </TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Mật khẩu</TableHead>
                                        <TableHead>2FA</TableHead>
                                        <TableHead>Thời gian còn</TableHead>
                                        <TableHead>Ngày tạo</TableHead>
                                        <TableHead>Hành động</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedEmails.map((email) => (
                                        <TableRow key={email.id} className={selectedIds.has(email.id) ? 'bg-muted/50' : ''}>
                                            <TableCell>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(email.id)}
                                                    onChange={() => toggleSelect(email.id)}
                                                    className="w-4 h-4 cursor-pointer"
                                                />
                                            </TableCell>
                                            <TableCell className="font-mono text-sm">{email.email}</TableCell>
                                            <TableCell className="font-mono text-sm">{email.password}</TableCell>
                                            <TableCell>
                                                {email['2fa_secret'] ? (
                                                    <div className="flex items-center gap-2">
                                                        {twoFaCodes[email.id] ? (
                                                            <code className="px-2 py-1 bg-green-500/10 text-green-600 rounded font-mono text-sm">
                                                                {twoFaCodes[email.id]}
                                                            </code>
                                                        ) : (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => fetch2FA(email)}
                                                                disabled={twoFaLoading === email.id}
                                                            >
                                                                <Key className="w-3 h-3 mr-1" />
                                                                {twoFaLoading === email.id ? '...' : 'Lấy mã'}
                                                            </Button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {email.delete_at ? (
                                                    <span className="inline-flex items-center text-sm text-orange-500">
                                                        <Clock className="w-3 h-3 mr-1" />
                                                        {getTimeRemaining(new Date(email.delete_at))}
                                                    </span>
                                                ) : (
                                                    <span className="text-sm text-green-500">Vĩnh viễn</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {formatDate(email.created_at)}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => copyToClipboard(email)}
                                                    >
                                                        {copiedId === email.id ? (
                                                            <Check className="w-4 h-4 text-green-500" />
                                                        ) : (
                                                            <Copy className="w-4 h-4" />
                                                        )}
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => deleteEmail(email.id)}
                                                    >
                                                        <Trash2 className="w-4 h-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                                    <div className="text-sm text-muted-foreground">
                                        Trang {currentPage} / {totalPages} ({startIndex + 1}-{Math.min(endIndex, activeEmails.length)} của {activeEmails.length})
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handlePageChange(currentPage - 1)}
                                            disabled={currentPage === 1}
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                            Trước
                                        </Button>
                                        <div className="flex gap-1">
                                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                                let page;
                                                if (totalPages <= 5) {
                                                    page = i + 1;
                                                } else if (currentPage <= 3) {
                                                    page = i + 1;
                                                } else if (currentPage >= totalPages - 2) {
                                                    page = totalPages - 4 + i;
                                                } else {
                                                    page = currentPage - 2 + i;
                                                }
                                                return (
                                                    <Button
                                                        key={page}
                                                        variant={currentPage === page ? "default" : "outline"}
                                                        size="sm"
                                                        onClick={() => handlePageChange(page)}
                                                        className="w-8 h-8 p-0"
                                                    >
                                                        {page}
                                                    </Button>
                                                );
                                            })}
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handlePageChange(currentPage + 1)}
                                            disabled={currentPage === totalPages}
                                        >
                                            Sau
                                            <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Deleted Emails */}
            {
                deletedEmails.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-muted-foreground">Emails đã xóa ({deletedEmails.length})</CardTitle>
                            <p className="text-sm text-muted-foreground">Emails sẽ bị xóa vĩnh viễn sau 3 ngày kể từ khi xóa</p>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Ngày xóa</TableHead>
                                        <TableHead>Xóa vĩnh viễn sau</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {deletedEmails.map((email) => {
                                        // Tính thời gian xóa vĩnh viễn (3 ngày sau deleted_at)
                                        const permanentDeleteAt = email.deleted_at
                                            ? new Date(new Date(email.deleted_at).getTime() + 3 * 24 * 60 * 60 * 1000)
                                            : null;

                                        return (
                                            <TableRow key={email.id} className="opacity-50">
                                                <TableCell className="font-mono text-sm">{email.email}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {email.deleted_at ? formatDate(email.deleted_at) : 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    {permanentDeleteAt ? (
                                                        <span className="inline-flex items-center text-sm text-red-500">
                                                            <Clock className="w-3 h-3 mr-1" />
                                                            {getTimeRemaining(permanentDeleteAt)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-sm text-muted-foreground">N/A</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )
            }
        </div >
    );
}
