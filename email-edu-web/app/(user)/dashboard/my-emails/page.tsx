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
import { RefreshCw, Copy, Check, Trash2, Clock, Key } from 'lucide-react';
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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold">Email của tôi</h2>
                    <p className="text-muted-foreground">Danh sách email bạn đã tạo</p>
                </div>
                <Button onClick={fetchEmails} variant="outline">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Làm mới
                </Button>
            </div>

            {/* Active Emails */}
            <Card>
                <CardHeader>
                    <CardTitle>Emails Active ({activeEmails.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8">Đang tải...</div>
                    ) : activeEmails.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Chưa có email nào
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Mật khẩu</TableHead>
                                    <TableHead>2FA</TableHead>
                                    <TableHead>Thời gian còn</TableHead>
                                    <TableHead>Ngày tạo</TableHead>
                                    <TableHead>Hành động</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {activeEmails.map((email) => (
                                    <TableRow key={email.id}>
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
