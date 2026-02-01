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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { RefreshCw, Copy, Check, Trash2, Mail, Plus, Inbox, ArrowLeft } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface TMail {
    id: number;
    email: string;
    password: string;
    account_id: string;
    domain: string;
    created_at: string;
}

interface TMailDomain {
    id: number;
    domain: string;
    is_active: boolean;
}

interface Message {
    id: string;
    from: { address: string; name?: string };
    subject: string;
    date: string;
    isRead: boolean;
}

interface MessageDetail {
    id: string;
    from: { address: string; name?: string };
    to: { address: string; name?: string }[];
    subject: string;
    date: string;
    html?: string;
    text?: string;
}

export default function TMailPage() {
    const [tmails, setTmails] = useState<TMail[]>([]);
    const [domains, setDomains] = useState<TMailDomain[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [copiedId, setCopiedId] = useState<number | null>(null);
    const [username, setUsername] = useState('');
    const [selectedDomainId, setSelectedDomainId] = useState<string>('');

    // Inbox state
    const [selectedTmail, setSelectedTmail] = useState<TMail | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loadingMessages, setLoadingMessages] = useState(false);

    // Message detail
    const [selectedMessage, setSelectedMessage] = useState<MessageDetail | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    useEffect(() => {
        fetchTmails();
        fetchDomains();
    }, []);

    const fetchDomains = async () => {
        try {
            const res = await fetch('/api/tmail/domains');
            const data = await res.json();
            if (data.success) {
                const activeDomains = data.data.filter((d: TMailDomain) => d.is_active);
                setDomains(activeDomains);
                if (activeDomains.length > 0 && !selectedDomainId) {
                    setSelectedDomainId(activeDomains[0].id.toString());
                }
            }
        } catch (error) {
            console.error('Error fetching domains:', error);
        }
    };

    const fetchTmails = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/tmail');
            const data = await res.json();
            if (data.success) {
                setTmails(data.data);
            }
        } catch (error) {
            console.error('Error fetching tmails:', error);
        } finally {
            setLoading(false);
        }
    };

    const createTmail = async () => {
        try {
            setCreating(true);

            // Check if user pasted a full email address
            const isFullEmail = username.includes('@');

            const res = await fetch('/api/tmail', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(
                    isFullEmail
                        ? { full_email: username.trim() }
                        : {
                            username: username || undefined,
                            domain_id: selectedDomainId ? parseInt(selectedDomainId) : undefined
                        }
                )
            });
            const data = await res.json();
            if (data.success) {
                setUsername('');
                fetchTmails();
            } else {
                alert(data.error || 'Không thể tạo tMail');
            }
        } catch (error) {
            console.error('Error creating tmail:', error);
        } finally {
            setCreating(false);
        }
    };

    const deleteTmail = async (id: number) => {
        if (!confirm('Bạn có chắc muốn xóa tMail này?')) return;

        try {
            const res = await fetch('/api/tmail', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const data = await res.json();
            if (data.success) {
                fetchTmails();
            }
        } catch (error) {
            console.error('Error deleting tmail:', error);
        }
    };

    const copyToClipboard = (tmail: TMail) => {
        navigator.clipboard.writeText(tmail.email);
        setCopiedId(tmail.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const openInbox = async (tmail: TMail) => {
        setSelectedTmail(tmail);
        setMessages([]);
        setLoadingMessages(true);

        try {
            const res = await fetch(`/api/tmail/${tmail.id}/inbox`);
            const data = await res.json();
            if (data.success) {
                setMessages(data.messages || []);
            }
        } catch (error) {
            console.error('Error fetching inbox:', error);
        } finally {
            setLoadingMessages(false);
        }
    };

    const viewMessage = async (messageId: string) => {
        if (!selectedTmail) return;
        setLoadingDetail(true);

        try {
            const res = await fetch(`/api/tmail/${selectedTmail.id}/inbox?messageId=${messageId}`);
            const data = await res.json();
            if (data.success && data.message) {
                setSelectedMessage(data.message);
            }
        } catch (error) {
            console.error('Error fetching message:', error);
        } finally {
            setLoadingDetail(false);
        }
    };

    const refreshInbox = () => {
        if (selectedTmail) {
            openInbox(selectedTmail);
        }
    };

    // Auto-refresh inbox every 5 seconds when open
    useEffect(() => {
        if (!selectedTmail) return;

        const interval = setInterval(() => {
            // Only refresh if not loading and no message is being viewed
            if (!loadingMessages && !loadingDetail) {
                refreshInbox();
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [selectedTmail, loadingMessages, loadingDetail]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold">tMail - Temporary Email</h2>
                    <p className="text-muted-foreground text-sm">Tạo và quản lý email tạm thời</p>
                </div>
                <Button onClick={fetchTmails} variant="outline" size="sm">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Làm mới
                </Button>
            </div>

            {/* Create Form */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Tạo tMail mới</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                        <div className="flex-1">
                            <Input
                                placeholder="Dán email hoặc để trống = random"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </div>
                        {/* Only show domain selector if not full email */}
                        {!username.includes('@') ? (
                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">@</span>
                                <Select value={selectedDomainId} onValueChange={setSelectedDomainId}>
                                    <SelectTrigger className="w-full sm:w-[180px]">
                                        <SelectValue placeholder="Chọn domain" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {domains.map((domain) => (
                                            <SelectItem key={domain.id} value={domain.id.toString()}>
                                                {domain.domain}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-md">
                                <Check className="w-4 h-4 text-green-500" />
                                <span className="text-sm text-green-600 dark:text-green-400">
                                    Domain: {username.split('@')[1]}
                                </span>
                            </div>
                        )}
                        <Button onClick={createTmail} disabled={creating || (!username.includes('@') && domains.length === 0)} className="w-full sm:w-auto">
                            <Plus className="w-4 h-4 mr-2" />
                            {creating ? 'Đang tạo...' : 'Tạo tMail'}
                        </Button>
                    </div>
                    {domains.length === 0 && !username.includes('@') && (
                        <p className="text-sm text-muted-foreground mt-2">
                            Chưa có domain nào. Liên hệ admin để thêm domain.
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* TMails List */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Danh sách tMail ({tmails.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8">Đang tải...</div>
                    ) : tmails.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Chưa có tMail nào. Tạo mới ở form trên.
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table */}
                            <div className="hidden md:block">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Ngày tạo</TableHead>
                                            <TableHead>Hành động</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {tmails.map((tmail) => (
                                            <TableRow key={tmail.id}>
                                                <TableCell className="font-mono text-sm">{tmail.email}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {formatDate(tmail.created_at)}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => openInbox(tmail)}
                                                        >
                                                            <Inbox className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => copyToClipboard(tmail)}
                                                        >
                                                            {copiedId === tmail.id ? (
                                                                <Check className="w-4 h-4 text-green-500" />
                                                            ) : (
                                                                <Copy className="w-4 h-4" />
                                                            )}
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => deleteTmail(tmail.id)}
                                                        >
                                                            <Trash2 className="w-4 h-4 text-destructive" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Mobile Cards */}
                            <div className="md:hidden space-y-3">
                                {tmails.map((tmail) => (
                                    <div key={tmail.id} className="border rounded-lg p-4 space-y-2">
                                        <div className="font-mono text-sm break-all">{tmail.email}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {formatDate(tmail.created_at)}
                                        </div>
                                        <div className="flex gap-2 pt-2 border-t">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="flex-1"
                                                onClick={() => openInbox(tmail)}
                                            >
                                                <Inbox className="w-4 h-4 mr-2" />
                                                Inbox
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => copyToClipboard(tmail)}
                                            >
                                                {copiedId === tmail.id ? (
                                                    <Check className="w-4 h-4 text-green-500" />
                                                ) : (
                                                    <Copy className="w-4 h-4" />
                                                )}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => deleteTmail(tmail.id)}
                                            >
                                                <Trash2 className="w-4 h-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Inbox Dialog - Responsive Split View */}
            <Dialog open={!!selectedTmail} onOpenChange={(open) => { if (!open) { setSelectedTmail(null); setSelectedMessage(null); } }}>
                <DialogContent className="max-w-6xl w-full max-h-[90vh] h-[90vh] md:h-auto p-0 overflow-hidden">
                    {/* Header with gradient */}
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-3 md:p-4 text-white">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 md:gap-3">
                                {/* Mobile: Back button when viewing message */}
                                {selectedMessage && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSelectedMessage(null)}
                                        className="md:hidden text-white hover:bg-white/20 p-2"
                                    >
                                        <ArrowLeft className="w-5 h-5" />
                                    </Button>
                                )}
                                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/20 flex items-center justify-center">
                                    <Inbox className="w-4 h-4 md:w-5 md:h-5" />
                                </div>
                                <div>
                                    <h2 className="text-base md:text-lg font-bold">
                                        {selectedMessage ? 'Nội dung email' : 'Hộp thư đến'}
                                    </h2>
                                    <p className="text-blue-100 text-xs font-mono truncate max-w-[180px] md:max-w-none">
                                        {selectedTmail?.email}
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={refreshInbox}
                                className="bg-white/20 hover:bg-white/30 text-white border-0"
                            >
                                <RefreshCw className={`w-4 h-4 ${loadingMessages ? 'animate-spin' : ''}`} />
                                <span className="hidden sm:inline ml-2">Làm mới</span>
                            </Button>
                        </div>
                    </div>

                    {/* Content Container */}
                    <div className="flex h-[calc(90vh-80px)] md:h-[70vh]">
                        {/* Left Panel - Email List (hidden on mobile when message selected) */}
                        <div className={`w-full md:w-[350px] border-r flex flex-col bg-muted/20 ${selectedMessage ? 'hidden md:flex' : 'flex'}`}>
                            <div className="p-3 border-b bg-muted/30">
                                <h3 className="font-semibold text-sm text-muted-foreground">
                                    {messages.length} email
                                </h3>
                            </div>
                            <div className="flex-1 overflow-auto">
                                {loadingMessages ? (
                                    <div className="flex flex-col items-center justify-center py-16">
                                        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mb-3" />
                                        <p className="text-muted-foreground text-sm">Đang tải...</p>
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 px-4">
                                        <Mail className="w-12 h-12 text-gray-300 mb-3" />
                                        <p className="text-muted-foreground text-sm text-center">Chưa có email</p>
                                    </div>
                                ) : (
                                    <div className="divide-y">
                                        {messages.map((msg, index) => (
                                            <div
                                                key={msg.id}
                                                className={`p-3 cursor-pointer transition-colors ${selectedMessage?.id === msg.id
                                                    ? 'bg-blue-100 dark:bg-blue-900/50 border-l-4 border-blue-500'
                                                    : !msg.isRead
                                                        ? 'bg-blue-50/50 dark:bg-blue-950/30 hover:bg-blue-100/50'
                                                        : 'hover:bg-muted/50'
                                                    }`}
                                                onClick={() => viewMessage(msg.id)}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${['bg-gradient-to-br from-pink-500 to-rose-500',
                                                        'bg-gradient-to-br from-blue-500 to-cyan-500',
                                                        'bg-gradient-to-br from-green-500 to-emerald-500',
                                                        'bg-gradient-to-br from-purple-500 to-violet-500',
                                                        'bg-gradient-to-br from-orange-500 to-amber-500'][index % 5]
                                                        }`}>
                                                        {(msg.from?.name || msg.from?.address || 'U')[0].toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between gap-1 mb-0.5">
                                                            <span className={`text-sm truncate ${!msg.isRead || selectedMessage?.id === msg.id ? 'font-semibold' : ''}`}>
                                                                {msg.from?.name || msg.from?.address?.split('@')[0] || 'Unknown'}
                                                            </span>
                                                            {!msg.isRead && (
                                                                <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                                                            )}
                                                        </div>
                                                        <div className={`text-sm truncate ${!msg.isRead ? 'font-medium' : 'text-muted-foreground'}`}>
                                                            {msg.subject || '(Không có tiêu đề)'}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground mt-0.5">
                                                            {formatDate(msg.date)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Panel - Email Content (full width on mobile when message selected) */}
                        <div className={`flex-1 flex flex-col overflow-hidden bg-background ${selectedMessage ? 'flex' : 'hidden md:flex'}`}>
                            {loadingDetail ? (
                                <div className="flex-1 flex flex-col items-center justify-center">
                                    <RefreshCw className="w-10 h-10 text-blue-500 animate-spin mb-4" />
                                    <p className="text-muted-foreground">Đang tải nội dung...</p>
                                </div>
                            ) : selectedMessage ? (
                                <>
                                    {/* Email Header */}
                                    <div className="p-3 md:p-4 border-b">
                                        <h2 className="text-lg md:text-xl font-bold mb-2 md:mb-3">
                                            {selectedMessage.subject || '(Không có tiêu đề)'}
                                        </h2>
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm md:text-base">
                                                {(selectedMessage.from?.name || selectedMessage.from?.address || 'U')[0].toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold text-sm md:text-base truncate">
                                                    {selectedMessage.from?.name || 'Không rõ'}
                                                </div>
                                                <div className="text-xs text-muted-foreground truncate">
                                                    {selectedMessage.from?.address}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {formatDate(selectedMessage.date)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Email Body */}
                                    <div className="flex-1 overflow-auto p-4 md:p-6">
                                        {selectedMessage.html ? (
                                            <div
                                                className="prose dark:prose-invert max-w-none prose-sm md:prose-base prose-img:max-w-full prose-a:text-blue-600"
                                                dangerouslySetInnerHTML={{ __html: selectedMessage.html }}
                                            />
                                        ) : (
                                            <div className="bg-muted/30 rounded-lg p-4">
                                                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                                                    {selectedMessage.text || 'Không có nội dung'}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-4">
                                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center mb-4">
                                        <Mail className="w-10 h-10 md:w-12 md:h-12 text-gray-400" />
                                    </div>
                                    <h3 className="font-semibold text-base md:text-lg mb-1 text-foreground">Chọn email để xem</h3>
                                    <p className="text-sm text-center">Nhấp vào email bên trái để đọc nội dung</p>
                                </div>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
