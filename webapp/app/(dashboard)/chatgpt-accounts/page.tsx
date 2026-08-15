'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Dialog } from '@/components/ui/dialog';
import {
    Sparkles,
    RefreshCw,
    Plus,
    Trash2,
    Copy,
    Check,
    Edit2,
    Eye,
    EyeOff,
    Search,
    ShieldCheck,
    Clock,
    Download,
    CheckCircle2,
    XCircle,
    HelpCircle,
    AlertTriangle,
    Layers,
    Bot,
    KeyRound,
    Package,
    FolderSync,
    X,
    Filter,
    ChevronLeft,
    ChevronRight,
    ArrowUpDown,
    FileSpreadsheet,
    Zap,
    Flame
} from 'lucide-react';
import clsx from 'clsx';

// Interface definitions
interface ChatGPTAccount {
    id: number;
    email: string;
    password: string;
    twofa_secret: string | null;
    is_plus: number; // 1 = Plus, 0 = Free
    plan_type: string;
    status: 'live' | 'die' | 'wrong_pass' | 'twofa_error' | 'uncheck';
    sale_status: 'in_stock' | 'sold' | 'used' | 'reserved';
    note: string | null;
    last_checked_at: string | null;
    plus_updated_at: string | null;
    created_at: string;
    updated_at: string;
}

interface StatsData {
    total: number;
    plus_count: number;
    free_count: number;
    live_count: number;
    die_count: number;
    uncheck_count: number;
    error_count: number;
    in_stock_count: number;
    sold_count: number;
}

// Client-side Base32 TOTP generator helper
function generateClientTOTP(secret: string): { code: string; remaining: number } | null {
    if (!secret || secret.trim().length === 0) return null;
    const cleanSecret = secret.replace(/[\s=-]+/g, '').toUpperCase();
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    try {
        let bits = '';
        for (const char of cleanSecret) {
            const val = alphabet.indexOf(char);
            if (val === -1) return null;
            bits += val.toString(2).padStart(5, '0');
        }

        const bytes: number[] = [];
        for (let i = 0; i + 8 <= bits.length; i += 8) {
            bytes.push(parseInt(bits.substring(i, i + 8), 2));
        }

        const epoch = Math.floor(Date.now() / 1000);
        const time = Math.floor(epoch / 30);
        const remaining = 30 - (epoch % 30);

        // Simple hash fallback for display if crypto is unavailable or use fallback token format
        return {
            code: '******',
            remaining
        };
    } catch {
        return null;
    }
}

export default function ChatGPTAccountsPage() {
    // Main state
    const [accounts, setAccounts] = useState<ChatGPTAccount[]>([]);
    const [stats, setStats] = useState<StatsData>({
        total: 0,
        plus_count: 0,
        free_count: 0,
        live_count: 0,
        die_count: 0,
        uncheck_count: 0,
        error_count: 0,
        in_stock_count: 0,
        sold_count: 0,
    });
    const [loading, setLoading] = useState(true);

    // Filters & Pagination
    const [search, setSearch] = useState('');
    const [filterPlus, setFilterPlus] = useState<'all' | '1' | '0'>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterSale, setFilterSale] = useState<string>('all');
    const [sortBy, setSortBy] = useState<string>('created_at');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [totalPages, setTotalPages] = useState(1);

    // Selection state
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    // Password visibility toggle per account ID
    const [showPasswordIds, setShowPasswordIds] = useState<Set<number>>(new Set());

    // Real-time 2FA Tokens cache & countdown
    const [totpTokens, setTotpTokens] = useState<Record<string, { token: string; remaining: number }>>({});
    const [loadingTwoFa, setLoadingTwoFa] = useState<Record<number, boolean>>({});

    // Clipboard copy indicators
    const [copiedField, setCopiedField] = useState<string | null>(null);

    // Modal: Bulk Import
    const [showImportModal, setShowImportModal] = useState(false);
    const [importRawText, setImportRawText] = useState('');
    const [importIsPlus, setImportIsPlus] = useState(false);
    const [importSkipDuplicates, setImportSkipDuplicates] = useState(true);
    const [importSaleStatus, setImportSaleStatus] = useState<'in_stock' | 'sold'>('in_stock');
    const [importing, setImporting] = useState(false);

    // Modal: Bulk Checker
    const [showCheckModal, setShowCheckModal] = useState(false);
    const [checking, setChecking] = useState(false);
    const [checkProgress, setCheckProgress] = useState({ current: 0, total: 0, live: 0, die: 0, error: 0 });
    const [checkingLogs, setCheckingLogs] = useState<Array<{ email: string; status: string; message: string }>>([]);

    // Modal: Edit Single Account
    const [editingAccount, setEditingAccount] = useState<ChatGPTAccount | null>(null);
    const [editForm, setEditForm] = useState({
        email: '',
        password: '',
        twofa_secret: '',
        is_plus: false,
        status: 'uncheck',
        sale_status: 'in_stock',
        note: ''
    });
    const [savingEdit, setSavingEdit] = useState(false);

    // Modal: Export
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportFormat, setExportFormat] = useState<'pipe' | 'colon' | 'tab' | 'csv' | 'json'>('pipe');
    const [exportScope, setExportScope] = useState<'all' | 'filtered' | 'selected' | 'plus_only' | 'free_only' | 'live_only'>('filtered');
    const [exportCopied, setExportCopied] = useState(false);

    // Toast message
    const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

    const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToastMessage({ text, type });
        setTimeout(() => setToastMessage(null), 3500);
    };

    // Copy to clipboard helper
    const copyToClipboard = (text: string, fieldId: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedField(fieldId);
        showToast('Đã sao chép vào bộ nhớ tạm!', 'success');
        setTimeout(() => setCopiedField(null), 2000);
    };

    // Fetch Accounts list and statistics
    const fetchAccounts = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (search) params.set('search', search);
            if (filterPlus !== 'all') params.set('is_plus', filterPlus);
            if (filterStatus !== 'all') params.set('status', filterStatus);
            if (filterSale !== 'all') params.set('sale_status', filterSale);
            params.set('sort_by', sortBy);
            params.set('sort_order', sortOrder);
            params.set('page', currentPage.toString());
            params.set('limit', pageSize.toString());

            const res = await fetch(`/api/chatgpt-accounts?${params.toString()}`);
            const data = await res.json();

            if (data.success) {
                setAccounts(data.data || []);
                setStats(data.stats || {
                    total: 0,
                    plus_count: 0,
                    free_count: 0,
                    live_count: 0,
                    die_count: 0,
                    uncheck_count: 0,
                    error_count: 0,
                    in_stock_count: 0,
                    sold_count: 0
                });
                setTotalPages(data.pagination?.totalPages || 1);
            } else {
                showToast(data.error || 'Lỗi khi tải danh sách tài khoản', 'error');
            }
        } catch (error: any) {
            console.error('Fetch error:', error);
            showToast('Không thể kết nối đến máy chủ', 'error');
        } finally {
            setLoading(false);
        }
    }, [search, filterPlus, filterStatus, filterSale, sortBy, sortOrder, currentPage, pageSize]);

    useEffect(() => {
        fetchAccounts();
    }, [fetchAccounts]);

    // Fetch 2FA TOTP token for an account
    const fetch2FAToken = async (secret: string, accountId: number) => {
        if (!secret) return;
        setLoadingTwoFa(prev => ({ ...prev, [accountId]: true }));
        try {
            const res = await fetch(`/api/2fa-token?secret=${encodeURIComponent(secret)}`);
            const data = await res.json();
            if (data.token) {
                setTotpTokens(prev => ({
                    ...prev,
                    [secret]: { token: data.token, remaining: data.remaining || 30 }
                }));
            }
        } catch (err) {
            console.error('2FA fetch error:', err);
        } finally {
            setLoadingTwoFa(prev => ({ ...prev, [accountId]: false }));
        }
    };

    // Countdown ticker for 2FA tokens
    useEffect(() => {
        const interval = setInterval(() => {
            setTotpTokens(prev => {
                const next = { ...prev };
                let hasChanges = false;
                for (const secret in next) {
                    if (next[secret].remaining > 1) {
                        next[secret] = { ...next[secret], remaining: next[secret].remaining - 1 };
                        hasChanges = true;
                    } else {
                        // Refresh token if time expired
                        fetch(`/api/2fa-token?secret=${encodeURIComponent(secret)}`)
                            .then(r => r.json())
                            .then(data => {
                                if (data.token) {
                                    setTotpTokens(p => ({
                                        ...p,
                                        [secret]: { token: data.token, remaining: data.remaining || 30 }
                                    }));
                                }
                            })
                            .catch(() => {});
                    }
                }
                return hasChanges ? next : prev;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    // Toggle Plus/Free status immediately (Nút Tích Lên Plus / Không Tích Free)
    const handleTogglePlus = async (account: ChatGPTAccount) => {
        const newIsPlus = account.is_plus === 1 ? 0 : 1;
        const newPlan = newIsPlus === 1 ? 'plus' : 'free';

        // Optimistic update
        setAccounts(prev => prev.map(acc => acc.id === account.id ? { ...acc, is_plus: newIsPlus, plan_type: newPlan } : acc));
        setStats(prev => ({
            ...prev,
            plus_count: prev.plus_count + (newIsPlus === 1 ? 1 : -1),
            free_count: prev.free_count + (newIsPlus === 0 ? 1 : -1),
        }));

        try {
            const res = await fetch('/api/chatgpt-accounts', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: account.id,
                    is_plus: newIsPlus
                })
            });
            const data = await res.json();
            if (data.success) {
                showToast(newIsPlus === 1 ? `⭐ Đã đánh dấu lên Plus: ${account.email}` : `🆓 Đã chuyển về Free: ${account.email}`, 'success');
            } else {
                // Rollback on error
                setAccounts(prev => prev.map(acc => acc.id === account.id ? account : acc));
                showToast(data.error || 'Cập nhật thất bại', 'error');
            }
        } catch (error) {
            setAccounts(prev => prev.map(acc => acc.id === account.id ? account : acc));
            showToast('Lỗi kết nối khi cập nhật', 'error');
        }
    };

    // Bulk Toggle Plus / Free for selected accounts
    const handleBulkSetPlus = async (targetPlus: boolean) => {
        const targetIds = Array.from(selectedIds);
        if (targetIds.length === 0) {
            showToast('Vui lòng chọn ít nhất 1 tài khoản', 'info');
            return;
        }

        const plusVal = targetPlus ? 1 : 0;
        try {
            const res = await fetch('/api/chatgpt-accounts', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ids: targetIds,
                    is_plus: plusVal
                })
            });
            const data = await res.json();
            if (data.success) {
                showToast(targetPlus ? `⭐ Đã đánh dấu Lên Plus cho ${targetIds.length} tài khoản` : `🆓 Đã chuyển ${targetIds.length} tài khoản về Free`, 'success');
                setSelectedIds(new Set());
                fetchAccounts();
            } else {
                showToast(data.error || 'Cập nhật thất bại', 'error');
            }
        } catch {
            showToast('Lỗi khi cập nhật hàng loạt', 'error');
        }
    };

    // Single Check Account Live / 2FA
    const handleSingleCheck = async (accountId: number) => {
        try {
            showToast('Đang kiểm tra tài khoản...', 'info');
            const res = await fetch('/api/chatgpt-accounts/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: accountId })
            });
            const data = await res.json();
            if (data.success && data.results && data.results.length > 0) {
                const resItem = data.results[0];
                setAccounts(prev => prev.map(acc => acc.id === accountId ? { ...acc, status: resItem.status, last_checked_at: new Date().toISOString() } : acc));
                if (resItem.status === 'live') {
                    showToast(`🟢 Tài khoản LIVE: ${resItem.message}`, 'success');
                } else if (resItem.status === 'die') {
                    showToast(`🔴 Tài khoản DIE: ${resItem.message}`, 'error');
                } else {
                    showToast(`⚠️ Lỗi: ${resItem.message}`, 'info');
                }
            } else {
                showToast(data.error || 'Kiểm tra thất bại', 'error');
            }
        } catch {
            showToast('Lỗi khi kiểm tra tài khoản', 'error');
        }
    };

    // Bulk Check selected or uncheck accounts
    const handleRunBulkCheck = async (scope: 'selected' | 'uncheck' | 'all') => {
        let idsToCheck: number[] = [];
        if (scope === 'selected') {
            idsToCheck = Array.from(selectedIds);
        } else if (scope === 'uncheck') {
            idsToCheck = accounts.filter(a => a.status === 'uncheck').map(a => a.id);
        } else {
            idsToCheck = accounts.map(a => a.id);
        }

        if (idsToCheck.length === 0) {
            showToast('Không có tài khoản nào phù hợp để kiểm tra', 'info');
            return;
        }

        setShowCheckModal(true);
        setChecking(true);
        setCheckProgress({ current: 0, total: idsToCheck.length, live: 0, die: 0, error: 0 });
        setCheckingLogs([]);

        try {
            // Process in batches of 5 to show real-time progress
            const batchSize = 5;
            let currentLive = 0;
            let currentDie = 0;
            let currentErr = 0;

            for (let i = 0; i < idsToCheck.length; i += batchSize) {
                const chunk = idsToCheck.slice(i, i + batchSize);
                const res = await fetch('/api/chatgpt-accounts/check', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids: chunk })
                });
                const data = await res.json();

                if (data.success && Array.isArray(data.results)) {
                    for (const r of data.results) {
                        if (r.status === 'live') currentLive++;
                        else if (r.status === 'die') currentDie++;
                        else currentErr++;

                        setCheckingLogs(prev => [
                            { email: r.email, status: r.status, message: r.message },
                            ...prev.slice(0, 49) // Keep last 50 logs
                        ]);
                    }
                }

                const currentDone = Math.min(i + batchSize, idsToCheck.length);
                setCheckProgress({
                    current: currentDone,
                    total: idsToCheck.length,
                    live: currentLive,
                    die: currentDie,
                    error: currentErr
                });
            }

            showToast(`Hoàn tất kiểm tra: ${currentLive} Live, ${currentDie} Die, ${currentErr} Lỗi`, 'success');
            fetchAccounts();
        } catch (err: any) {
            showToast('Lỗi trong quá trình kiểm tra SLL', 'error');
        } finally {
            setChecking(false);
        }
    };

    // Bulk Delete
    const handleBulkDelete = async () => {
        const targetIds = Array.from(selectedIds);
        if (targetIds.length === 0) return;

        if (!confirm(`Bạn có chắc chắn muốn xóa ${targetIds.length} tài khoản đã chọn không?`)) return;

        try {
            const res = await fetch('/api/chatgpt-accounts', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: targetIds, reason: 'Admin bulk delete' })
            });
            const data = await res.json();
            if (data.success) {
                showToast(`Đã xóa ${targetIds.length} tài khoản`, 'success');
                setSelectedIds(new Set());
                fetchAccounts();
            } else {
                showToast(data.error || 'Xóa thất bại', 'error');
            }
        } catch {
            showToast('Lỗi khi xóa tài khoản', 'error');
        }
    };

    // Delete All Die Accounts
    const handleDeleteAllDie = async () => {
        if (!confirm('Bạn có chắc chắn muốn xóa TẤT CẢ tài khoản trạng thái DIE không?')) return;
        try {
            const res = await fetch('/api/chatgpt-accounts', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ delete_all_die: true, reason: 'Clear all die accounts' })
            });
            const data = await res.json();
            if (data.success) {
                showToast(`Đã xóa ${data.deleted_count} tài khoản DIE`, 'success');
                fetchAccounts();
            } else {
                showToast(data.error || 'Xóa thất bại', 'error');
            }
        } catch {
            showToast('Lỗi khi dọn dẹp tài khoản DIE', 'error');
        }
    };

    // Handle Bulk Import Submit
    const handleImportSubmit = async () => {
        if (!importRawText.trim()) {
            showToast('Vui lòng dán danh sách tài khoản', 'info');
            return;
        }

        setImporting(true);
        try {
            const res = await fetch('/api/chatgpt-accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    raw_text: importRawText,
                    default_is_plus: importIsPlus,
                    skip_duplicates: importSkipDuplicates,
                    sale_status: importSaleStatus
                })
            });
            const data = await res.json();
            if (data.success) {
                showToast(data.message || 'Thêm tài khoản thành công', 'success');
                setShowImportModal(false);
                setImportRawText('');
                fetchAccounts();
            } else {
                showToast(data.error || 'Thêm tài khoản thất bại', 'error');
            }
        } catch {
            showToast('Lỗi khi gửi dữ liệu nhập', 'error');
        } finally {
            setImporting(false);
        }
    };

    // Open Edit Modal
    const handleOpenEdit = (acc: ChatGPTAccount) => {
        setEditingAccount(acc);
        setEditForm({
            email: acc.email,
            password: acc.password,
            twofa_secret: acc.twofa_secret || '',
            is_plus: acc.is_plus === 1,
            status: acc.status,
            sale_status: acc.sale_status,
            note: acc.note || ''
        });
    };

    // Save Edit Form
    const handleSaveEdit = async () => {
        if (!editingAccount) return;
        setSavingEdit(true);
        try {
            const res = await fetch('/api/chatgpt-accounts', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingAccount.id,
                    email: editForm.email,
                    password: editForm.password,
                    twofa_secret: editForm.twofa_secret,
                    is_plus: editForm.is_plus ? 1 : 0,
                    status: editForm.status,
                    sale_status: editForm.sale_status,
                    note: editForm.note
                })
            });
            const data = await res.json();
            if (data.success) {
                showToast('Đã lưu thông tin tài khoản!', 'success');
                setEditingAccount(null);
                fetchAccounts();
            } else {
                showToast(data.error || 'Lỗi khi lưu', 'error');
            }
        } catch {
            showToast('Lỗi kết nối khi lưu', 'error');
        } finally {
            setSavingEdit(false);
        }
    };

    // Import Preview Parser
    const parsedImportPreview = useMemo(() => {
        if (!importRawText.trim()) return [];
        const lines = importRawText.split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('#'));
        return lines.slice(0, 6).map((line, idx) => {
            let parts: string[] = [];
            if (line.includes('\t')) parts = line.split('\t').map(p => p.trim());
            else if (line.includes('|')) parts = line.split('|').map(p => p.trim());
            else if (line.includes(':')) parts = line.split(':').map(p => p.trim());
            else parts = [line.trim()];

            const email = parts[0] || '';
            const pass = parts[1] || '';
            const twofa = parts.length >= 3 && !['plus', 'free', '1', '0'].includes(parts[2].toLowerCase()) ? parts[2] : (parts.length >= 4 ? parts[3] : '');
            let plus = importIsPlus;
            const lastPart = parts[parts.length - 1]?.toLowerCase();
            if (lastPart === 'plus' || lastPart === '1' || lastPart === 'true') plus = true;
            if (lastPart === 'free' || lastPart === '0' || lastPart === 'false') plus = false;

            return { id: idx, email, pass, twofa, is_plus: plus };
        });
    }, [importRawText, importIsPlus]);

    const importTotalLines = useMemo(() => {
        if (!importRawText.trim()) return 0;
        return importRawText.split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('#')).length;
    }, [importRawText]);

    // Export generator
    const generatedExportText = useMemo(() => {
        let list = [...accounts];
        if (exportScope === 'selected') {
            list = accounts.filter(a => selectedIds.has(a.id));
        } else if (exportScope === 'plus_only') {
            list = accounts.filter(a => a.is_plus === 1);
        } else if (exportScope === 'free_only') {
            list = accounts.filter(a => a.is_plus === 0);
        } else if (exportScope === 'live_only') {
            list = accounts.filter(a => a.status === 'live');
        }

        if (exportFormat === 'json') {
            return JSON.stringify(list, null, 2);
        }

        if (exportFormat === 'csv') {
            const header = 'Email,Password,2FA_Secret,Plan,Status,Sale_Status,Note,Created_At\n';
            const rows = list.map(a => `"${a.email}","${a.password}","${a.twofa_secret || ''}","${a.is_plus === 1 ? 'Plus' : 'Free'}","${a.status}","${a.sale_status}","${a.note || ''}","${a.created_at}"`).join('\n');
            return header + rows;
        }

        const sep = exportFormat === 'colon' ? ':' : (exportFormat === 'tab' ? '\t' : '|');
        return list.map(a => {
            const parts = [a.email, a.password];
            if (a.twofa_secret) parts.push(a.twofa_secret);
            return parts.join(sep);
        }).join('\n');
    }, [accounts, selectedIds, exportScope, exportFormat]);

    // Download export file
    const handleDownloadExport = () => {
        const ext = exportFormat === 'csv' ? 'csv' : (exportFormat === 'json' ? 'json' : 'txt');
        const mime = exportFormat === 'json' ? 'application/json' : 'text/plain;charset=utf-8';
        const blob = new Blob([generatedExportText], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chatgpt_accounts_${exportScope}_${Date.now()}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Đã tải file thành công!', 'success');
    };

    // Selection toggle handlers
    const isAllSelected = accounts.length > 0 && accounts.every(a => selectedIds.has(a.id));
    const handleSelectAll = () => {
        if (isAllSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(accounts.map(a => a.id)));
        }
    };

    const handleSelectRow = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Calculate percentage of Plus accounts
    const plusPercent = stats.total > 0 ? Math.round((stats.plus_count / stats.total) * 100) : 0;

    return (
        <div className="space-y-6">
            {/* Toast Notification */}
            {toastMessage && (
                <div className={clsx(
                    "fixed top-5 right-5 z-50 flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-2xl backdrop-blur-xl border transition-all animate-in fade-in slide-in-from-top-4",
                    toastMessage.type === 'success' ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/30' :
                    toastMessage.type === 'error' ? 'bg-red-950/90 text-red-200 border-red-500/30' :
                    'bg-zinc-900/90 text-zinc-200 border-zinc-700/50'
                )}>
                    {toastMessage.type === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                    {toastMessage.type === 'error' && <XCircle className="h-4 w-4 text-red-400" />}
                    {toastMessage.type === 'info' && <HelpCircle className="h-4 w-4 text-sky-400" />}
                    <span>{toastMessage.text}</span>
                </div>
            )}

            {/* Header / Action Bar */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                            Kho Quản Trị ChatGPT
                        </p>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2.5 mt-1">
                        <Sparkles className="h-6 w-6 text-amber-500" />
                        Kho Tài Khoản ChatGPT
                        <Badge variant="secondary" className="font-mono text-xs font-semibold px-2.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                            {stats.total} TK
                        </Badge>
                    </h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Lưu trữ TK, MK, 2FA, nhập SLL, kiểm tra Live/Die và đánh dấu gói ChatGPT Plus / Free
                    </p>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex flex-wrap items-center gap-2.5">
                    <Button
                        onClick={() => setShowImportModal(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-medium gap-1.5 active:scale-95 transition-transform"
                    >
                        <Plus className="h-4 w-4" />
                        Thêm TK SLL
                    </Button>
                    <Button
                        onClick={() => handleRunBulkCheck('all')}
                        variant="outline"
                        className="border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 gap-1.5"
                    >
                        <Zap className="h-4 w-4 text-amber-500" />
                        Check Live SLL
                    </Button>
                    <Button
                        onClick={() => setShowExportModal(true)}
                        variant="outline"
                        className="border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 gap-1.5"
                    >
                        <Download className="h-4 w-4 text-sky-500" />
                        Xuất Dữ Liệu
                    </Button>
                    <Button
                        onClick={fetchAccounts}
                        variant="ghost"
                        size="icon"
                        className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                        title="Làm mới"
                    >
                        <RefreshCw className={clsx("h-4 w-4", loading && "animate-spin text-emerald-600")} />
                    </Button>
                </div>
            </div>

            {/* Metric Stat Cards (Interactive Click-to-filter) */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {/* Total */}
                <Card
                    onClick={() => { setFilterPlus('all'); setFilterStatus('all'); }}
                    className={clsx(
                        "cursor-pointer border transition-all hover:border-zinc-400 dark:hover:border-zinc-600 hover:shadow-md",
                        filterPlus === 'all' && filterStatus === 'all' ? "ring-2 ring-emerald-500/30 border-emerald-500" : "border-zinc-200 dark:border-zinc-800"
                    )}
                >
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs font-medium">
                            <span>Tổng tài khoản</span>
                            <Layers className="h-4 w-4 text-zinc-400" />
                        </div>
                        <div className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mt-1">
                            {stats.total}
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5">Tất cả trong hệ thống</p>
                    </CardContent>
                </Card>

                {/* ChatGPT Plus */}
                <Card
                    onClick={() => { setFilterPlus('1'); }}
                    className={clsx(
                        "cursor-pointer border transition-all hover:border-amber-400 hover:shadow-md bg-gradient-to-br from-amber-500/5 to-transparent",
                        filterPlus === '1' ? "ring-2 ring-amber-500/40 border-amber-500" : "border-zinc-200 dark:border-zinc-800"
                    )}
                >
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 text-xs font-semibold">
                            <span className="flex items-center gap-1">
                                <Sparkles className="h-3.5 w-3.5" /> Plus (Đã lên)
                            </span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/30 text-amber-600">
                                {plusPercent}%
                            </Badge>
                        </div>
                        <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400 mt-1">
                            {stats.plus_count}
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5">Tài khoản gói Plus ⭐</p>
                    </CardContent>
                </Card>

                {/* ChatGPT Free */}
                <Card
                    onClick={() => { setFilterPlus('0'); }}
                    className={clsx(
                        "cursor-pointer border transition-all hover:border-sky-400 hover:shadow-md",
                        filterPlus === '0' ? "ring-2 ring-sky-500/40 border-sky-500" : "border-zinc-200 dark:border-zinc-800"
                    )}
                >
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between text-sky-600 dark:text-sky-400 text-xs font-semibold">
                            <span>Free (Gốc)</span>
                            <Bot className="h-4 w-4 text-sky-400" />
                        </div>
                        <div className="text-2xl font-bold tracking-tight text-sky-600 dark:text-sky-400 mt-1">
                            {stats.free_count}
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5">Tài khoản miễn phí 🆓</p>
                    </CardContent>
                </Card>

                {/* Live */}
                <Card
                    onClick={() => { setFilterStatus('live'); }}
                    className={clsx(
                        "cursor-pointer border transition-all hover:border-emerald-400 hover:shadow-md",
                        filterStatus === 'live' ? "ring-2 ring-emerald-500/40 border-emerald-500" : "border-zinc-200 dark:border-zinc-800"
                    )}
                >
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                            <span>Live / Sẵn sàng</span>
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        </div>
                        <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 mt-1">
                            {stats.live_count}
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5">Hoạt động chuẩn 🟢</p>
                    </CardContent>
                </Card>

                {/* Die & Errors */}
                <Card
                    onClick={() => { setFilterStatus('die'); }}
                    className={clsx(
                        "cursor-pointer border transition-all hover:border-rose-400 hover:shadow-md",
                        filterStatus === 'die' ? "ring-2 ring-rose-500/40 border-rose-500" : "border-zinc-200 dark:border-zinc-800"
                    )}
                >
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 text-xs font-semibold">
                            <span>Die / Lỗi</span>
                            <XCircle className="h-4 w-4 text-rose-500" />
                        </div>
                        <div className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400 mt-1 flex items-center justify-between">
                            <span>{stats.die_count + stats.error_count}</span>
                            {stats.die_count > 0 && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteAllDie(); }}
                                    className="text-[10px] text-rose-500 hover:text-rose-700 underline font-normal"
                                    title="Xóa tất cả tài khoản DIE"
                                >
                                    Dọn dẹp
                                </button>
                            )}
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5">Cần thay thế / kiểm tra</p>
                    </CardContent>
                </Card>

                {/* In stock / Sold */}
                <Card
                    onClick={() => { setFilterSale(filterSale === 'in_stock' ? 'sold' : 'in_stock'); }}
                    className="cursor-pointer border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 transition-all hover:shadow-md"
                >
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 text-xs font-semibold">
                            <span>Còn kho / Đã bán</span>
                            <Package className="h-4 w-4 text-indigo-400" />
                        </div>
                        <div className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mt-1 flex items-center gap-1.5">
                            <span className="text-emerald-600 dark:text-emerald-400">{stats.in_stock_count}</span>
                            <span className="text-zinc-400 text-sm font-normal">/</span>
                            <span className="text-zinc-500 text-base font-normal">{stats.sold_count}</span>
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5">Kho sẵn hàng</p>
                    </CardContent>
                </Card>
            </div>

            {/* Filter Toolbar & Search */}
            <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Search Input */}
                    <div className="relative flex-1 min-w-[240px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <Input
                            placeholder="Tìm kiếm theo email, username, ghi chú..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Filter Plus/Free */}
                    <div className="w-[170px]">
                        <Select value={filterPlus} onValueChange={(val: any) => setFilterPlus(val)}>
                            <SelectTrigger className="bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                                <SelectValue placeholder="Loại gói" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tất cả gói</SelectItem>
                                <SelectItem value="1">⭐ Chỉ Plus</SelectItem>
                                <SelectItem value="0">🆓 Chỉ Free</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Filter Status */}
                    <div className="w-[170px]">
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger className="bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                                <SelectValue placeholder="Trạng thái" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                                <SelectItem value="live">🟢 Live (Sống)</SelectItem>
                                <SelectItem value="die">🔴 Die (Chết)</SelectItem>
                                <SelectItem value="uncheck">⚪ Chưa check</SelectItem>
                                <SelectItem value="twofa_error">⚠️ Lỗi 2FA</SelectItem>
                                <SelectItem value="wrong_pass">⚠️ Sai pass</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Filter Sale Status */}
                    <div className="w-[160px]">
                        <Select value={filterSale} onValueChange={setFilterSale}>
                            <SelectTrigger className="bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                                <SelectValue placeholder="Tình trạng kho" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tất cả kho</SelectItem>
                                <SelectItem value="in_stock">📦 Còn trong kho</SelectItem>
                                <SelectItem value="sold">🤝 Đã bán</SelectItem>
                                <SelectItem value="used">🔒 Đang sử dụng</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Reset Filters */}
                    {(search || filterPlus !== 'all' || filterStatus !== 'all' || filterSale !== 'all') && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setSearch(''); setFilterPlus('all'); setFilterStatus('all'); setFilterSale('all'); }}
                            className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                        >
                            Đặt lại lọc
                        </Button>
                    )}
                </div>

                {/* Bulk Action Bar (Visible when ≥ 1 account is selected) */}
                {selectedIds.size > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 dark:border-zinc-800/80 pt-3 bg-emerald-500/5 -mx-4 -mb-4 p-3 rounded-b-xl animate-in fade-in">
                        <div className="flex items-center gap-2">
                            <Badge className="bg-emerald-600 text-white font-mono px-2 py-0.5">
                                Đã chọn {selectedIds.size} tài khoản
                            </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Bulk Toggle Plus */}
                            <Button
                                size="sm"
                                onClick={() => handleBulkSetPlus(true)}
                                className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8 gap-1 shadow-sm font-medium"
                            >
                                <Sparkles className="h-3.5 w-3.5" />
                                Đánh dấu Lên Plus ({selectedIds.size})
                            </Button>
                            {/* Bulk Toggle Free */}
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleBulkSetPlus(false)}
                                className="text-xs h-8 gap-1 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            >
                                <Bot className="h-3.5 w-3.5 text-sky-500" />
                                Chuyển về Free ({selectedIds.size})
                            </Button>
                            {/* Bulk Check Selected */}
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRunBulkCheck('selected')}
                                className="text-xs h-8 gap-1 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            >
                                <Zap className="h-3.5 w-3.5 text-amber-500" />
                                Check đã chọn
                            </Button>
                            {/* Bulk Copy Format */}
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setShowExportModal(true); setExportScope('selected'); }}
                                className="text-xs h-8 gap-1 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            >
                                <Copy className="h-3.5 w-3.5 text-emerald-600" />
                                Sao chép / Xuất
                            </Button>
                            {/* Bulk Delete */}
                            <Button
                                size="sm"
                                variant="destructive"
                                onClick={handleBulkDelete}
                                className="text-xs h-8 gap-1"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                Xóa
                            </Button>
                            {/* Clear selection */}
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedIds(new Set())}
                                className="text-xs h-8"
                            >
                                Bỏ chọn
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Main Accounts Data Table */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-zinc-50/80 dark:bg-zinc-950/60 hover:bg-zinc-50/80 text-xs font-semibold uppercase text-zinc-500">
                                <TableHead className="w-[45px] text-center">
                                    <input
                                        type="checkbox"
                                        checked={isAllSelected}
                                        onChange={handleSelectAll}
                                        className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                        title="Chọn tất cả"
                                    />
                                </TableHead>
                                <TableHead className="min-w-[220px]">Tài khoản (Email)</TableHead>
                                <TableHead className="min-w-[160px]">Mật khẩu</TableHead>
                                <TableHead className="min-w-[220px]">2FA & Mã Xác Thực (TOTP)</TableHead>
                                <TableHead className="min-w-[150px] text-center">
                                    <div className="flex items-center justify-center gap-1">
                                        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                                        Gói / Lên Plus
                                    </div>
                                </TableHead>
                                <TableHead className="min-w-[130px] text-center">Trạng Thái</TableHead>
                                <TableHead className="min-w-[120px]">Kho</TableHead>
                                <TableHead className="min-w-[160px]">Ghi chú</TableHead>
                                <TableHead className="w-[100px] text-right">Thao tác</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-48 text-center">
                                        <div className="flex flex-col items-center justify-center gap-2 text-zinc-500">
                                            <RefreshCw className="h-6 w-6 animate-spin text-emerald-600" />
                                            <p className="text-sm font-medium">Đang tải danh sách tài khoản...</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : accounts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-48 text-center">
                                        <div className="flex flex-col items-center justify-center gap-3 text-zinc-500">
                                            <Bot className="h-10 w-10 text-zinc-300 dark:text-zinc-700" />
                                            <div>
                                                <p className="text-base font-semibold text-zinc-800 dark:text-zinc-200">Chưa có tài khoản nào</p>
                                                <p className="text-xs text-zinc-500 mt-0.5">Bấm nút "Thêm TK SLL" để nhập danh sách tài khoản ChatGPT vào kho</p>
                                            </div>
                                            <Button
                                                size="sm"
                                                onClick={() => setShowImportModal(true)}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                                            >
                                                <Plus className="h-4 w-4" />
                                                Thêm ngay
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                accounts.map((account) => {
                                    const isSelected = selectedIds.has(account.id);
                                    const showPassword = showPasswordIds.has(account.id);
                                    const tokenData = account.twofa_secret ? totpTokens[account.twofa_secret] : null;

                                    return (
                                        <TableRow
                                            key={account.id}
                                            className={clsx(
                                                "transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40",
                                                isSelected && "bg-emerald-50/40 dark:bg-emerald-950/20"
                                            )}
                                        >
                                            {/* Selection Checkbox */}
                                            <TableCell className="text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleSelectRow(account.id)}
                                                    className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                />
                                            </TableCell>

                                            {/* Email / Username */}
                                            <TableCell>
                                                <div className="flex items-center gap-2 group">
                                                    <span className="font-mono text-sm font-medium text-zinc-900 dark:text-zinc-100 select-all">
                                                        {account.email}
                                                    </span>
                                                    <button
                                                        onClick={() => copyToClipboard(account.email, `email_${account.id}`)}
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                                                        title="Sao chép email"
                                                    >
                                                        {copiedField === `email_${account.id}` ? (
                                                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                                                        ) : (
                                                            <Copy className="h-3.5 w-3.5" />
                                                        )}
                                                    </button>
                                                </div>
                                                <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                                                    ID: #{account.id} • {new Date(account.created_at).toLocaleDateString('vi-VN')}
                                                </div>
                                            </TableCell>

                                            {/* Password */}
                                            <TableCell>
                                                <div className="flex items-center gap-2 group">
                                                    <span className="font-mono text-sm text-zinc-800 dark:text-zinc-200">
                                                        {showPassword ? account.password : '••••••••••••'}
                                                    </span>
                                                    <button
                                                        onClick={() => setShowPasswordIds(prev => {
                                                            const next = new Set(prev);
                                                            if (next.has(account.id)) next.delete(account.id);
                                                            else next.add(account.id);
                                                            return next;
                                                        })}
                                                        className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                                                        title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                                    >
                                                        {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                                    </button>
                                                    <button
                                                        onClick={() => copyToClipboard(account.password, `pass_${account.id}`)}
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                                                        title="Sao chép mật khẩu"
                                                    >
                                                        {copiedField === `pass_${account.id}` ? (
                                                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                                                        ) : (
                                                            <Copy className="h-3.5 w-3.5" />
                                                        )}
                                                    </button>
                                                </div>
                                            </TableCell>

                                            {/* 2FA & Live Token Generator */}
                                            <TableCell>
                                                {account.twofa_secret ? (
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            {/* Live 6-digit Code Badge */}
                                                            {tokenData ? (
                                                                <div className="flex items-center gap-1.5 bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 rounded-lg px-2.5 py-1">
                                                                    <span className="font-mono text-sm font-bold tracking-wider text-emerald-700 dark:text-emerald-300 select-all">
                                                                        {tokenData.token}
                                                                    </span>
                                                                    <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                                                                        ({tokenData.remaining}s)
                                                                    </span>
                                                                    <button
                                                                        onClick={() => copyToClipboard(tokenData.token, `token_${account.id}`)}
                                                                        className="text-emerald-600 hover:text-emerald-800 dark:hover:text-emerald-200"
                                                                        title="Sao chép mã 2FA 6 số"
                                                                    >
                                                                        {copiedField === `token_${account.id}` ? (
                                                                            <Check className="h-3.5 w-3.5" />
                                                                        ) : (
                                                                            <Copy className="h-3.5 w-3.5" />
                                                                        )}
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => fetch2FAToken(account.twofa_secret!, account.id)}
                                                                    disabled={loadingTwoFa[account.id]}
                                                                    className="h-7 text-xs font-mono gap-1 border-zinc-300 dark:border-zinc-700"
                                                                >
                                                                    <KeyRound className="h-3 w-3 text-amber-500" />
                                                                    {loadingTwoFa[account.id] ? 'Đang lấy...' : 'Lấy mã 2FA'}
                                                                </Button>
                                                            )}
                                                        </div>
                                                        {/* 2FA Secret Key string */}
                                                        <div className="flex items-center gap-1 text-[11px] text-zinc-400 font-mono group">
                                                            <span className="truncate max-w-[150px]" title={account.twofa_secret}>
                                                                {account.twofa_secret}
                                                            </span>
                                                            <button
                                                                onClick={() => copyToClipboard(account.twofa_secret!, `secret_${account.id}`)}
                                                                className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-zinc-600"
                                                                title="Sao chép 2FA Secret"
                                                            >
                                                                {copiedField === `secret_${account.id}` ? (
                                                                    <Check className="h-3 w-3 text-emerald-600" />
                                                                ) : (
                                                                    <Copy className="h-3 w-3" />
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-zinc-400 italic">Không có 2FA</span>
                                                )}
                                            </TableCell>

                                            {/* Nút Tích / Switch: Lên Plus (checked) vs Free (unchecked) */}
                                            <TableCell className="text-center">
                                                <div className="flex flex-col items-center justify-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleTogglePlus(account)}
                                                        className={clsx(
                                                            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border shadow-sm active:scale-95 cursor-pointer",
                                                            account.is_plus === 1
                                                                ? "bg-gradient-to-r from-amber-500/15 to-emerald-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:border-amber-500"
                                                                : "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400"
                                                        )}
                                                        title={account.is_plus === 1 ? "Bấm để chuyển về Free" : "Bấm để tích Lên Plus"}
                                                    >
                                                        {account.is_plus === 1 ? (
                                                            <>
                                                                <Sparkles className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                                                                <span>Plus ✅</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Bot className="h-3.5 w-3.5 text-zinc-400" />
                                                                <span>Free 🆓</span>
                                                            </>
                                                        )}
                                                    </button>
                                                    {account.plus_updated_at && account.is_plus === 1 && (
                                                        <span className="text-[10px] text-zinc-400">
                                                            {new Date(account.plus_updated_at).toLocaleDateString('vi-VN')}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>

                                            {/* Trạng thái Live / Die / Uncheck */}
                                            <TableCell className="text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    {account.status === 'live' && (
                                                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-xs font-medium gap-1">
                                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                            Live
                                                        </Badge>
                                                    )}
                                                    {account.status === 'die' && (
                                                        <Badge variant="destructive" className="text-xs font-medium gap-1">
                                                            <span className="h-1.5 w-1.5 rounded-full bg-white" />
                                                            Die
                                                        </Badge>
                                                    )}
                                                    {account.status === 'uncheck' && (
                                                        <Badge variant="outline" className="text-xs font-medium text-zinc-500 gap-1">
                                                            Chưa check
                                                        </Badge>
                                                    )}
                                                    {account.status === 'twofa_error' && (
                                                        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-xs font-medium gap-1">
                                                            Lỗi 2FA
                                                        </Badge>
                                                    )}
                                                    {account.status === 'wrong_pass' && (
                                                        <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 text-xs font-medium gap-1">
                                                            Sai pass
                                                        </Badge>
                                                    )}

                                                    {/* Quick single check button */}
                                                    <button
                                                        onClick={() => handleSingleCheck(account.id)}
                                                        className="text-zinc-400 hover:text-emerald-600 transition-colors p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                                        title="Check tài khoản ngay"
                                                    >
                                                        <Zap className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </TableCell>

                                            {/* Kho / Sale status */}
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className={clsx(
                                                        "text-xs font-medium",
                                                        account.sale_status === 'in_stock' ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400" :
                                                        account.sale_status === 'sold' ? "border-indigo-500/30 text-indigo-600 dark:text-indigo-400" :
                                                        "border-zinc-300 text-zinc-500"
                                                    )}
                                                >
                                                    {account.sale_status === 'in_stock' ? '📦 Trong kho' :
                                                     account.sale_status === 'sold' ? '🤝 Đã bán' :
                                                     account.sale_status === 'used' ? '🔒 Đang dùng' : 'Tạm giữ'}
                                                </Badge>
                                            </TableCell>

                                            {/* Ghi chú */}
                                            <TableCell>
                                                <span className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2" title={account.note || ''}>
                                                    {account.note || <span className="text-zinc-400 italic">-</span>}
                                                </span>
                                            </TableCell>

                                            {/* Actions */}
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {/* Copy full line */}
                                                    <button
                                                        onClick={() => {
                                                            const fullLine = `${account.email}|${account.password}${account.twofa_secret ? `|${account.twofa_secret}` : ''}`;
                                                            copyToClipboard(fullLine, `full_${account.id}`);
                                                        }}
                                                        className="p-1.5 text-zinc-400 hover:text-emerald-600 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                                        title="Sao chép toàn bộ dòng (email|pass|2fa)"
                                                    >
                                                        {copiedField === `full_${account.id}` ? (
                                                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                                                        ) : (
                                                            <Copy className="h-3.5 w-3.5" />
                                                        )}
                                                    </button>

                                                    {/* Edit */}
                                                    <button
                                                        onClick={() => handleOpenEdit(account)}
                                                        className="p-1.5 text-zinc-400 hover:text-sky-600 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                                        title="Sửa thông tin"
                                                    >
                                                        <Edit2 className="h-3.5 w-3.5" />
                                                    </button>

                                                    {/* Delete */}
                                                    <button
                                                        onClick={async () => {
                                                            if (!confirm(`Bạn có chắc chắn muốn xóa tài khoản ${account.email}?`)) return;
                                                            const res = await fetch('/api/chatgpt-accounts', {
                                                                method: 'DELETE',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ id: account.id, reason: 'Admin single delete' })
                                                            });
                                                            const data = await res.json();
                                                            if (data.success) {
                                                                showToast('Đã xóa tài khoản', 'success');
                                                                fetchAccounts();
                                                            }
                                                        }}
                                                        className="p-1.5 text-zinc-400 hover:text-red-600 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                                        title="Xóa tài khoản"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination Toolbar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-zinc-200 dark:border-zinc-800 px-4 py-3 bg-zinc-50/50 dark:bg-zinc-950/40 text-xs text-zinc-500">
                    <div className="flex items-center gap-2">
                        <span>Hiển thị</span>
                        <select
                            value={pageSize}
                            onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                            className="rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-xs"
                        >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                        <span>tài khoản / trang (Tổng số {stats.total} tài khoản)</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage <= 1}
                            className="h-8 w-8 p-0"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="px-2 font-medium">
                            Trang {currentPage} / {totalPages || 1}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage >= totalPages}
                            className="h-8 w-8 p-0"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* MODAL: THÊM TÀI KHOẢN SLL (BULK IMPORT)                                  */}
            {/* ========================================================================= */}
            <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="w-full max-w-3xl rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                                    <Plus className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                                        Thêm Tài Khoản ChatGPT SLL
                                    </h3>
                                    <p className="text-xs text-zinc-500">
                                        Nhập hàng loạt tài khoản để lưu trữ hoặc chuẩn bị kiểm tra
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowImportModal(false)}
                                className="text-zinc-400 hover:text-zinc-600 p-1"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Format instructions & shortcuts */}
                        <div className="bg-zinc-50 dark:bg-zinc-950 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-1.5">
                            <p className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                                <KeyRound className="h-3.5 w-3.5 text-emerald-600" />
                                Các định dạng được hỗ trợ (Mỗi tài khoản 1 dòng):
                            </p>
                            <div className="font-mono text-zinc-600 dark:text-zinc-400 space-y-1 pl-5 list-disc">
                                <div>• <code>email@domain.com|matkhau|2FA_SECRET</code> (Khuyên dùng)</div>
                                <div>• <code>email@domain.com|matkhau|2FA_SECRET|plus</code> (Tự đánh dấu Plus)</div>
                                <div>• <code>email@domain.com:matkhau:2FA_SECRET</code> (Phân tách bằng dấu 2 chấm)</div>
                                <div>• <code>email@domain.com|matkhau</code> (Tài khoản không có 2FA)</div>
                            </div>
                        </div>

                        {/* Textarea */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                                <label className="font-semibold text-zinc-700 dark:text-zinc-300">
                                    Danh sách tài khoản ({importTotalLines} dòng đã nhập):
                                </label>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            try {
                                                const text = await navigator.clipboard.readText();
                                                setImportRawText(text);
                                                showToast('Đã dán từ clipboard!', 'info');
                                            } catch {
                                                showToast('Không thể đọc clipboard', 'error');
                                            }
                                        }}
                                        className="text-emerald-600 hover:underline text-xs"
                                    >
                                        Dán từ Clipboard
                                    </button>
                                    <span>•</span>
                                    <button
                                        type="button"
                                        onClick={() => setImportRawText(
                                            "demo_plus1@gmail.com|Password123|JBSWY3DPEHPK3PXP|plus\n" +
                                            "demo_plus2@gmail.com|Password123|HXDMVJECJJWSRB3H\n" +
                                            "demo_free1@gmail.com|Password123"
                                        )}
                                        className="text-sky-600 hover:underline text-xs"
                                    >
                                        Mẫu ví dụ
                                    </button>
                                </div>
                            </div>
                            <Textarea
                                placeholder="Dán danh sách tài khoản vào đây...&#10;email1@gmail.com|matkhau1|2FA_SECRET&#10;email2@gmail.com|matkhau2|2FA_SECRET"
                                rows={8}
                                value={importRawText}
                                onChange={(e) => setImportRawText(e.target.value)}
                                className="font-mono text-xs bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                            />
                        </div>

                        {/* Options */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40">
                            {/* Option: Đánh dấu là Lên Plus */}
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                                        <Sparkles className="h-4 w-4 text-amber-500" />
                                        Mặc định là ChatGPT Plus
                                    </p>
                                    <p className="text-xs text-zinc-500">Tự động tích chọn lên Plus cho toàn bộ tài khoản vừa nhập</p>
                                </div>
                                <Switch
                                    checked={importIsPlus}
                                    onCheckedChange={setImportIsPlus}
                                />
                            </div>

                            {/* Option: Bỏ qua trùng lặp */}
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                        Bỏ qua tài khoản trùng
                                    </p>
                                    <p className="text-xs text-zinc-500">Không ghi đè nếu email đã tồn tại trong kho</p>
                                </div>
                                <Switch
                                    checked={importSkipDuplicates}
                                    onCheckedChange={setImportSkipDuplicates}
                                />
                            </div>
                        </div>

                        {/* Live Parser Preview */}
                        {parsedImportPreview.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                    Xem trước phân tích ({parsedImportPreview.length} dòng đầu):
                                </p>
                                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden text-xs">
                                    <table className="w-full text-left font-mono">
                                        <thead className="bg-zinc-100 dark:bg-zinc-950 text-zinc-500">
                                            <tr>
                                                <th className="p-2">Email</th>
                                                <th className="p-2">Pass</th>
                                                <th className="p-2">2FA</th>
                                                <th className="p-2 text-center">Gói</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                            {parsedImportPreview.map((item) => (
                                                <tr key={item.id} className="bg-white dark:bg-zinc-900">
                                                    <td className="p-2 font-medium text-emerald-600">{item.email}</td>
                                                    <td className="p-2 text-zinc-500">{item.pass}</td>
                                                    <td className="p-2 text-zinc-400">{item.twofa || '-'}</td>
                                                    <td className="p-2 text-center">
                                                        {item.is_plus ? (
                                                            <Badge className="bg-amber-500/20 text-amber-600 text-[10px] py-0">Plus ⭐</Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-[10px] py-0 text-zinc-400">Free 🆓</Badge>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                            <Button
                                variant="outline"
                                onClick={() => setShowImportModal(false)}
                                disabled={importing}
                            >
                                Hủy bỏ
                            </Button>
                            <Button
                                onClick={handleImportSubmit}
                                disabled={importing || importTotalLines === 0}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-semibold"
                            >
                                {importing ? (
                                    <>
                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                        Đang thêm ({importTotalLines} TK)...
                                    </>
                                ) : (
                                    <>
                                        <Plus className="h-4 w-4" />
                                        Xác nhận thêm {importTotalLines} tài khoản
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </Dialog>

            {/* ========================================================================= */}
            {/* MODAL: CHECK TÀI KHOẢN SLL (BULK CHECKER)                                 */}
            {/* ========================================================================= */}
            <Dialog open={showCheckModal} onOpenChange={setShowCheckModal}>
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 space-y-5">
                        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                                    <Zap className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                                        Tiến Trình Kiểm Tra Tài Khoản ChatGPT
                                    </h3>
                                    <p className="text-xs text-zinc-500">
                                        Quét kiểm tra tính hợp lệ của định dạng, khóa 2FA và trạng thái Live
                                    </p>
                                </div>
                            </div>
                            {!checking && (
                                <button
                                    onClick={() => setShowCheckModal(false)}
                                    className="text-zinc-400 hover:text-zinc-600 p-1"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            )}
                        </div>

                        {/* Progress Bar & Counters */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm font-semibold">
                                <span className="text-zinc-700 dark:text-zinc-300">
                                    Tiến độ: {checkProgress.current} / {checkProgress.total} tài khoản
                                </span>
                                <span className="text-emerald-600 font-mono">
                                    {checkProgress.total > 0 ? Math.round((checkProgress.current / checkProgress.total) * 100) : 0}%
                                </span>
                            </div>

                            {/* Progress bar visual */}
                            <div className="h-2.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300 rounded-full"
                                    style={{
                                        width: `${checkProgress.total > 0 ? (checkProgress.current / checkProgress.total) * 100 : 0}%`
                                    }}
                                />
                            </div>

                            {/* Stats during checking */}
                            <div className="grid grid-cols-3 gap-3 text-center pt-2">
                                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                    <p className="text-xs text-emerald-600 font-medium">LIVE 🟢</p>
                                    <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-0.5 font-mono">
                                        {checkProgress.live}
                                    </p>
                                </div>
                                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                                    <p className="text-xs text-rose-600 font-medium">DIE 🔴</p>
                                    <p className="text-xl font-bold text-rose-700 dark:text-rose-300 mt-0.5 font-mono">
                                        {checkProgress.die}
                                    </p>
                                </div>
                                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                    <p className="text-xs text-amber-600 font-medium">LỖI ⚠️</p>
                                    <p className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-0.5 font-mono">
                                        {checkProgress.error}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Real-time Log Stream */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                Nhật ký kiểm tra trực tiếp:
                            </label>
                            <div className="h-44 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 p-3 overflow-y-auto font-mono text-xs space-y-1.5 text-zinc-300">
                                {checkingLogs.length === 0 ? (
                                    <p className="text-zinc-600 italic">Đang khởi tạo danh sách kiểm tra...</p>
                                ) : (
                                    checkingLogs.map((log, idx) => (
                                        <div key={idx} className="flex items-center justify-between text-[11px] gap-2">
                                            <span className="truncate">{log.email}</span>
                                            <span className={clsx(
                                                "font-semibold shrink-0",
                                                log.status === 'live' ? "text-emerald-400" :
                                                log.status === 'die' ? "text-red-400" : "text-amber-400"
                                            )}>
                                                {log.status === 'live' ? 'LIVE 🟢' : log.status === 'die' ? 'DIE 🔴' : 'LỖI ⚠️'} ({log.message})
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Close button */}
                        <div className="flex items-center justify-end pt-2">
                            <Button
                                onClick={() => setShowCheckModal(false)}
                                disabled={checking}
                                className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                            >
                                {checking ? 'Đang kiểm tra...' : 'Hoàn tất & Đóng'}
                            </Button>
                        </div>
                    </div>
                </div>
            </Dialog>

            {/* ========================================================================= */}
            {/* MODAL: CHỈNH SỬA TÀI KHOẢN                                               */}
            {/* ========================================================================= */}
            <Dialog open={Boolean(editingAccount)} onOpenChange={(open) => !open && setEditingAccount(null)}>
                {editingAccount && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                        <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 space-y-4">
                            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                    <Edit2 className="h-4 w-4 text-emerald-600" />
                                    Chỉnh Sửa Tài Khoản #{editingAccount.id}
                                </h3>
                                <button
                                    onClick={() => setEditingAccount(null)}
                                    className="text-zinc-400 hover:text-zinc-600 p-1"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="space-y-3 text-xs">
                                <div>
                                    <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                                        Email / Tài khoản
                                    </label>
                                    <Input
                                        value={editForm.email}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                                        className="font-mono text-xs"
                                    />
                                </div>

                                <div>
                                    <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                                        Mật khẩu
                                    </label>
                                    <Input
                                        value={editForm.password}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                                        className="font-mono text-xs"
                                    />
                                </div>

                                <div>
                                    <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                                        2FA Secret Key
                                    </label>
                                    <Input
                                        value={editForm.twofa_secret}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, twofa_secret: e.target.value }))}
                                        placeholder="Để trống nếu không có 2FA"
                                        className="font-mono text-xs"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3 pt-1">
                                    <div>
                                        <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                                            Trạng thái Live
                                        </label>
                                        <select
                                            value={editForm.status}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                                            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2 text-xs"
                                        >
                                            <option value="live">🟢 Live</option>
                                            <option value="die">🔴 Die</option>
                                            <option value="uncheck">⚪ Chưa check</option>
                                            <option value="twofa_error">⚠️ Lỗi 2FA</option>
                                            <option value="wrong_pass">⚠️ Sai pass</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                                            Kho hàng
                                        </label>
                                        <select
                                            value={editForm.sale_status}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, sale_status: e.target.value }))}
                                            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2 text-xs"
                                        >
                                            <option value="in_stock">📦 Còn trong kho</option>
                                            <option value="sold">🤝 Đã bán</option>
                                            <option value="used">🔒 Đang dùng</option>
                                            <option value="reserved">Tạm giữ</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Toggle Plus */}
                                <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-amber-500/5">
                                    <div>
                                        <p className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                                            <Sparkles className="h-4 w-4 text-amber-500" />
                                            Đã lên ChatGPT Plus ⭐
                                        </p>
                                        <p className="text-[11px] text-zinc-500">Tích chọn để chuyển thành tài khoản Plus</p>
                                    </div>
                                    <Switch
                                        checked={editForm.is_plus}
                                        onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, is_plus: checked }))}
                                    />
                                </div>

                                <div>
                                    <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                                        Ghi chú
                                    </label>
                                    <Textarea
                                        value={editForm.note}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, note: e.target.value }))}
                                        placeholder="Nhập ghi chú cho tài khoản này..."
                                        rows={2}
                                        className="text-xs"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                                <Button
                                    variant="outline"
                                    onClick={() => setEditingAccount(null)}
                                    disabled={savingEdit}
                                >
                                    Hủy
                                </Button>
                                <Button
                                    onClick={handleSaveEdit}
                                    disabled={savingEdit}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                                >
                                    {savingEdit ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </Dialog>

            {/* ========================================================================= */}
            {/* MODAL: XUẤT / SAO CHÉP DỮ LIỆU                                           */}
            {/* ========================================================================= */}
            <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="h-9 w-9 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-600">
                                    <Download className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                                        Xuất & Sao Chép Dữ Liệu
                                    </h3>
                                    <p className="text-xs text-zinc-500">
                                        Tùy chỉnh định dạng và phạm vi tài khoản cần xuất
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowExportModal(false)}
                                className="text-zinc-400 hover:text-zinc-600 p-1"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                                    Phạm vi xuất:
                                </label>
                                <select
                                    value={exportScope}
                                    onChange={(e) => setExportScope(e.target.value as any)}
                                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2 text-xs"
                                >
                                    <option value="filtered">Theo bộ lọc hiện tại ({accounts.length} TK)</option>
                                    <option value="selected">Chỉ tài khoản đã chọn ({selectedIds.size} TK)</option>
                                    <option value="plus_only">Chỉ tài khoản Plus ⭐</option>
                                    <option value="free_only">Chỉ tài khoản Free 🆓</option>
                                    <option value="live_only">Chỉ tài khoản Live 🟢</option>
                                </select>
                            </div>

                            <div>
                                <label className="font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                                    Định dạng xuất:
                                </label>
                                <select
                                    value={exportFormat}
                                    onChange={(e) => setExportFormat(e.target.value as any)}
                                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 p-2 text-xs"
                                >
                                    <option value="pipe">email|pass|2fa (Pipe)</option>
                                    <option value="colon">email:pass:2fa (Dấu 2 chấm)</option>
                                    <option value="tab">email [Tab] pass [Tab] 2fa</option>
                                    <option value="csv">CSV (Excel)</option>
                                    <option value="json">JSON</option>
                                </select>
                            </div>
                        </div>

                        {/* Export preview */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                Nội dung xuất dữ liệu:
                            </label>
                            <Textarea
                                readOnly
                                rows={8}
                                value={generatedExportText}
                                className="font-mono text-xs bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    navigator.clipboard.writeText(generatedExportText);
                                    setExportCopied(true);
                                    showToast('Đã sao chép vào bộ nhớ tạm!', 'success');
                                    setTimeout(() => setExportCopied(false), 2000);
                                }}
                                className="gap-1.5"
                            >
                                {exportCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                                {exportCopied ? 'Đã sao chép' : 'Sao chép toàn bộ'}
                            </Button>
                            <Button
                                onClick={handleDownloadExport}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-semibold"
                            >
                                <Download className="h-4 w-4" />
                                Tải File Về Máy
                            </Button>
                        </div>
                    </div>
                </div>
            </Dialog>
        </div>
    );
}
