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
import { RefreshCw, Mail, User, Clock, Trash2, AlertTriangle, Cloud } from 'lucide-react';
import { formatDate, getTimeRemaining } from '@/lib/utils';

interface Email {
    id: number;
    email: string;
    password: string;
    domain_name: string;
    user_id: number;
    status: string;
    delete_at: string | null;
    deleted_at: string | null;
    created_at: string;
}

interface GoogleUser {
    email: string;
    name: string;
    creationTime: string;
}

export default function AdminEmailsPage() {
    const [emails, setEmails] = useState<Email[]>([]);
    const [loading, setLoading] = useState(true);
    const [cleanupLoading, setCleanupLoading] = useState(false);
    const [googleUsers, setGoogleUsers] = useState<GoogleUser[]>([]);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [deleteAllLoading, setDeleteAllLoading] = useState(false);

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

    const fetchGoogleUsers = async () => {
        try {
            setGoogleLoading(true);
            const res = await fetch('/api/admin/google-users');
            const data = await res.json();
            if (data.success) {
                setGoogleUsers(data.users || []);
            } else {
                alert('Lỗi: ' + data.error);
            }
        } catch (error) {
            console.error('Error fetching Google users:', error);
        } finally {
            setGoogleLoading(false);
        }
    };

    const deleteAllGoogleUsers = async () => {
        const confirmed = prompt(
            `⚠️ CẢNH BÁO NGHIÊM TRỌNG ⚠️\n\n` +
            `Bạn sắp xóa TẤT CẢ ${googleUsers.length} Gmail từ Google Workspace!\n` +
            `Hành động này KHÔNG THỂ HOÀN TÁC!\n\n` +
            `Nhập "XOA TAT CA" để xác nhận:`
        );

        if (confirmed !== 'XOA TAT CA') {
            alert('Đã hủy xóa.');
            return;
        }

        try {
            setDeleteAllLoading(true);
            const res = await fetch('/api/admin/google-users', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirmDelete: 'DELETE_ALL' })
            });
            const data = await res.json();

            if (data.success) {
                alert(data.message);
                fetchGoogleUsers();
                fetchEmails();
            } else {
                alert('Lỗi: ' + data.error);
            }
        } catch (error) {
            console.error('Error deleting all Google users:', error);
            alert('Lỗi khi xóa');
        } finally {
            setDeleteAllLoading(false);
        }
    };

    const deleteEmail = async (id: number) => {
        if (!confirm('Bạn có chắc muốn xóa email này?')) return;

        try {
            const res = await fetch('/api/emails', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            if (res.ok) {
                fetchEmails();
            }
        } catch (error) {
            console.error('Error deleting email:', error);
        }
    };

    const runCleanup = async () => {
        if (!confirm('Xóa vĩnh viễn tất cả emails đã xóa quá 3 ngày và đã login?')) return;

        try {
            setCleanupLoading(true);
            const res = await fetch('/api/emails/cleanup', {
                method: 'POST'
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                fetchEmails();
            } else {
                alert('Lỗi: ' + data.error);
            }
        } catch (error) {
            console.error('Error running cleanup:', error);
        } finally {
            setCleanupLoading(false);
        }
    };

    const activeEmails = emails.filter(e => e.status === 'active');
    const deletedEmails = emails.filter(e => e.status === 'deleted');

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold">Tất cả Emails</h2>
                    <p className="text-muted-foreground">Xem tất cả emails trong hệ thống</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={fetchEmails} variant="outline">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Làm mới
                    </Button>
                    <Button
                        onClick={runCleanup}
                        variant="destructive"
                        disabled={cleanupLoading || deletedEmails.length === 0}
                    >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {cleanupLoading ? 'Đang xóa...' : `Cleanup (${deletedEmails.length})`}
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tổng Emails</CardTitle>
                        <Mail className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{emails.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active</CardTitle>
                        <Clock className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{activeEmails.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Deleted</CardTitle>
                        <Trash2 className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{deletedEmails.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Google WS</CardTitle>
                        <Cloud className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{googleUsers.length}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Google Workspace Management */}
            <Card className="border-orange-500 border-2">
                <CardHeader className="bg-orange-50 dark:bg-orange-950">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-orange-500" />
                            <CardTitle className="text-orange-700 dark:text-orange-300">
                                Quản lý Google Workspace
                            </CardTitle>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                onClick={fetchGoogleUsers}
                                variant="outline"
                                disabled={googleLoading}
                            >
                                <Cloud className="w-4 h-4 mr-2" />
                                {googleLoading ? 'Đang tải...' : 'Lấy danh sách'}
                            </Button>
                            <Button
                                onClick={deleteAllGoogleUsers}
                                variant="destructive"
                                disabled={deleteAllLoading || googleUsers.length === 0}
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                {deleteAllLoading ? 'Đang xóa...' : `Xóa tất cả (${googleUsers.length})`}
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground mb-4">
                        ⚠️ Khu vực này cho phép xem và xóa tất cả Gmail trực tiếp từ Google Workspace.
                        <strong className="text-red-500"> Hành động xóa không thể hoàn tác!</strong>
                    </p>
                    {googleUsers.length > 0 && (
                        <div className="max-h-60 overflow-y-auto rounded border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Tên</TableHead>
                                        <TableHead>Ngày tạo</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {googleUsers.map((user, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell className="font-mono text-sm">{user.email}</TableCell>
                                            <TableCell>{user.name}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {user.creationTime ? formatDate(user.creationTime) : '-'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>


            {/* Emails Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Danh sách Emails</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8">Đang tải...</div>
                    ) : emails.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Chưa có email nào
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>ID</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Password</TableHead>
                                    <TableHead>User ID</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Xóa sau</TableHead>
                                    <TableHead>Ngày tạo</TableHead>
                                    <TableHead>Hành động</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {emails.map((email) => (
                                    <TableRow key={email.id}>
                                        <TableCell>{email.id}</TableCell>
                                        <TableCell className="font-mono text-sm">{email.email}</TableCell>
                                        <TableCell className="font-mono text-sm">{email.password}</TableCell>
                                        <TableCell>{email.user_id}</TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${email.status === 'active'
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                                                }`}>
                                                {email.status}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            {email.delete_at ? (
                                                <span className="text-sm text-orange-500">
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
                                            {email.status === 'active' && (
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={() => deleteEmail(email.id)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            )}
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
