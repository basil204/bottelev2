'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Mail, RefreshCw, Copy, Check } from 'lucide-react';
import { generateRandomUsername, generateRandomPassword } from '@/lib/utils';

interface Domain {
    id: number;
    domain: string;
}

interface CreatedEmail {
    email: string;
    password: string;
}

export default function CreateEmailPage() {
    const [domains, setDomains] = useState<Domain[]>([]);
    const [selectedDomain, setSelectedDomain] = useState('');
    const [username, setUsername] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [deleteHours, setDeleteHours] = useState('24');
    const [loading, setLoading] = useState(false);
    const [createdEmails, setCreatedEmails] = useState<CreatedEmail[]>([]);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchDomains();
    }, []);

    const fetchDomains = async () => {
        try {
            const res = await fetch('/api/domains?active=true');
            const data = await res.json();
            if (data.success && data.data.length > 0) {
                setDomains(data.data.filter((d: any) => d.is_active));
                setSelectedDomain(data.data[0].id.toString());
            }
        } catch (error) {
            console.error('Error fetching domains:', error);
        }
    };

    const generateUsername = () => {
        setUsername(generateRandomUsername(8));
    };

    const handleSubmit = async () => {
        if (!selectedDomain) {
            setError('Vui lòng chọn domain');
            return;
        }

        setLoading(true);
        setError('');
        setCreatedEmails([]);

        try {
            const res = await fetch('/api/emails', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    domain_id: parseInt(selectedDomain),
                    username: username || undefined,
                    quantity,
                    delete_hours: parseInt(deleteHours)
                })
            });

            const data = await res.json();

            if (data.success) {
                setCreatedEmails(data.emails);
                setUsername('');
            } else {
                setError(data.error || 'Lỗi tạo email');
            }
        } catch (error) {
            console.error('Error creating email:', error);
            setError('Đã xảy ra lỗi');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string, index: number) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const deleteHoursOptions = [
        { value: '1', label: '1 giờ' },
        { value: '2', label: '2 giờ' },
        { value: '6', label: '6 giờ' },
        { value: '12', label: '12 giờ' },
        { value: '24', label: '24 giờ' },
        { value: '48', label: '48 giờ' },
        { value: '168', label: '7 ngày' },
        { value: '0', label: 'Vĩnh viễn' },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold">Tạo Email EDU mới</h2>
                <p className="text-muted-foreground">Tạo email EDU với domain tùy chọn</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Create Form */}
                <Card>
                    <CardHeader>
                        <CardTitle>Thông tin Email</CardTitle>
                        <CardDescription>Điền thông tin để tạo email mới</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {error && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                                {error}
                            </div>
                        )}

                        {/* Domain Select */}
                        <div className="space-y-2">
                            <Label>Chọn Domain</Label>
                            <Select value={selectedDomain} onValueChange={setSelectedDomain}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Chọn domain..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {domains.map((domain) => (
                                        <SelectItem key={domain.id} value={domain.id.toString()}>
                                            @{domain.domain}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Username */}
                        <div className="space-y-2">
                            <Label>Username (để trống để tạo ngẫu nhiên)</Label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                />
                                <Button variant="outline" onClick={generateUsername}>
                                    <RefreshCw className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Quantity */}
                        <div className="space-y-2">
                            <Label>Số lượng</Label>
                            <Input
                                type="number"
                                min={1}
                                max={10}
                                value={quantity}
                                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                            />
                        </div>

                        {/* Delete Hours */}
                        <div className="space-y-2">
                            <Label>Thời gian tự động xóa</Label>
                            <Select value={deleteHours} onValueChange={setDeleteHours}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {deleteHoursOptions.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <Button
                            className="w-full"
                            onClick={handleSubmit}
                            disabled={loading || !selectedDomain}
                        >
                            <Mail className="w-4 h-4 mr-2" />
                            {loading ? 'Đang tạo...' : 'Tạo Email'}
                        </Button>
                    </CardContent>
                </Card>

                {/* Created Emails */}
                <Card>
                    <CardHeader>
                        <CardTitle>Email đã tạo</CardTitle>
                        <CardDescription>
                            {createdEmails.length > 0
                                ? `Đã tạo ${createdEmails.length} email`
                                : 'Chưa có email nào được tạo'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {createdEmails.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p>Email sẽ hiển thị ở đây sau khi tạo</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {createdEmails.map((email, index) => (
                                    <div
                                        key={index}
                                        className="p-4 rounded-lg bg-muted/50 border space-y-3"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-mono text-sm break-all flex-1">{email.email}</span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => copyToClipboard(email.email, index)}
                                            >
                                                {copiedIndex === index ? (
                                                    <Check className="w-4 h-4 text-green-500" />
                                                ) : (
                                                    <Copy className="w-4 h-4" />
                                                )}
                                                <span className="ml-1 hidden sm:inline">Copy</span>
                                            </Button>
                                        </div>
                                        <div className="flex items-center justify-between gap-2 pt-2 border-t">
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <span>Mật khẩu:</span>
                                                <code className="px-2 py-0.5 bg-background rounded font-mono">{email.password}</code>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => copyToClipboard(email.password, index + 1000)}
                                            >
                                                {copiedIndex === index + 1000 ? (
                                                    <Check className="w-4 h-4 text-green-500" />
                                                ) : (
                                                    <Copy className="w-4 h-4" />
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
