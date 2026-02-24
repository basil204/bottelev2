'use client';

import { useState } from 'react';
import { Mail, CheckCircle, XCircle, AlertCircle, Copy, Download, RefreshCw, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface CheckResult {
    email: string;
    status: 'live' | 'die' | 'verify_phone' | 'not_exist' | 'error';
    index: number;
}

export default function CheckGmailPage() {
    const [emailsInput, setEmailsInput] = useState('');
    const [results, setResults] = useState<CheckResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleCheck = async () => {
        const emails = emailsInput
            .split('\n')
            .map(e => e.trim())
            .filter(e => e.length > 0);

        if (emails.length === 0) {
            setError('Vui lòng nhập ít nhất một email');
            return;
        }

        if (emails.length > 1000) {
            setError('Tối đa 1000 email mỗi lần check');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/check-gmail', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emails })
            });

            const data = await res.json();
            if (data.status) {
                setResults(data.data);
            } else {
                setError(data.message || 'Có lỗi xảy ra khi check email');
            }
        } catch (err) {
            console.error('Check live error:', err);
            setError('Không thể kết nối tới server');
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'live':
                return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle className="w-3 h-3 mr-1" /> Live</Badge>;
            case 'die':
                return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Die</Badge>;
            case 'verify_phone':
                return <Badge variant="outline" className="text-yellow-600 border-yellow-600"><AlertCircle className="w-3 h-3 mr-1" /> Verify Phone</Badge>;
            case 'not_exist':
                return <Badge variant="secondary">Not Exist</Badge>;
            default:
                return <Badge variant="outline">Unknown</Badge>;
        }
    };

    const copyLiveEmails = () => {
        const liveEmails = results
            .filter(r => r.status === 'live')
            .map(r => r.email)
            .join('\n');

        if (liveEmails) {
            navigator.clipboard.writeText(liveEmails);
            alert('Đã copy danh sách email Live');
        } else {
            alert('Không có email nào Live để copy');
        }
    };

    const downloadResults = () => {
        const content = results.map(r => `${r.email}|${r.status}`).join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `check_results_${new Date().getTime()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const clearAll = () => {
        setEmailsInput('');
        setResults([]);
        setError(null);
    };

    const stats = {
        total: results.length,
        live: results.filter(r => r.status === 'live').length,
        die: results.filter(r => r.status === 'die').length,
        others: results.filter(r => r.status !== 'live' && r.status !== 'die').length
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Check Live Gmail</h1>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={clearAll}>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Xóa tất cả
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle>Nhập Email</CardTitle>
                        <CardDescription>Mỗi email một dòng (Tối đa 1000)</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Textarea
                            placeholder="example1@gmail.com&#10;example2@gmail.com"
                            className="min-h-[300px] font-mono"
                            value={emailsInput}
                            onChange={(e) => setEmailsInput(e.target.value)}
                        />
                        {error && (
                            <div className="text-sm text-red-500 flex items-center gap-1">
                                <AlertCircle className="w-4 h-4" />
                                {error}
                            </div>
                        )}
                        <Button
                            className="w-full"
                            onClick={handleCheck}
                            disabled={loading || !emailsInput.trim()}
                        >
                            {loading ? (
                                <>
                                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                    Đang check...
                                </>
                            ) : (
                                'Bắt đầu Check'
                            )}
                        </Button>
                    </CardContent>
                </Card>

                <div className="md:col-span-2 space-y-6">
                    <div className="grid gap-4 md:grid-cols-4">
                        <Card>
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Tổng cộng</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="text-2xl font-bold">{stats.total}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Live</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="text-2xl font-bold text-green-600">{stats.live}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Die</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="text-2xl font-bold text-red-600">{stats.die}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Khác</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="text-2xl font-bold text-yellow-600">{stats.others}</div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Kết quả</CardTitle>
                                <CardDescription>Trạng thái của các email đã check</CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={copyLiveEmails} disabled={stats.live === 0}>
                                    <Copy className="w-4 h-4 mr-2" />
                                    Copy Live
                                </Button>
                                <Button size="sm" variant="outline" onClick={downloadResults} disabled={results.length === 0}>
                                    <Download className="w-4 h-4 mr-2" />
                                    Tải về
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="max-h-[400px] overflow-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[50px]">#</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead className="text-right">Trạng thái</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {results.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                                    Chưa có kết quả check
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            results.map((result, idx) => (
                                                <TableRow key={idx}>
                                                    <TableCell>{result.index || idx + 1}</TableCell>
                                                    <TableCell className="font-mono text-sm">{result.email}</TableCell>
                                                    <TableCell className="text-right">
                                                        {getStatusBadge(result.status)}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
