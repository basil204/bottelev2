'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Palette, RefreshCw, Plus, Settings, Play, CheckCircle2,
  XCircle, Clock, AlertTriangle, Trash2, RotateCcw, Power, Cpu,
  DollarSign, ListOrdered, Activity, ExternalLink, Globe, Wifi, Check, X,
  Users, Layers, UserCheck, ShieldAlert, Sparkles, Copy, Edit2, Info
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface CanvaStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  totalRevenue: number;
  totalTeams: number;
  slotsAvailable: number;
}

interface CanvaTeam {
  id: number;
  name: string;
  member_limit: number;
  current_members: number;
  role: string;
  status: 'active' | 'full' | 'expired' | 'disabled';
  proxy?: string;
  last_checked_at?: string;
  created_at: string;
  updated_at: string;
}

interface CanvaTask {
  id: number;
  user_id?: number;
  telegram_id?: string;
  user_name?: string;
  team_id?: number;
  team_name?: string;
  team_assigned_name?: string;
  email: string;
  role: string;
  price: number;
  proxy_used?: string;
  invite_link?: string;
  invite_token?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  step_status?: string;
  error_message?: string;
  screenshot_path?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

interface CanvaSettings {
  apiUrl?: string;
  enabled: boolean;
  price: number;
  price_designer?: number;
  price_member?: number;
  headless: boolean;
  concurrency: number;
  defaultRole: string;
  proxies: string;
  custom_emoji_id?: string;
  msg_menu?: string;
  msg_prompt?: string;
  msg_processing?: string;
  msg_success?: string;
  msg_failed?: string;
}

export default function CanvaDashboardPage() {
  const [activeTab, setActiveTab] = useState('teams');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const [stats, setStats] = useState<CanvaStats>({
    total: 0, pending: 0, running: 0, completed: 0, failed: 0,
    totalRevenue: 0, totalTeams: 0, slotsAvailable: 0
  });

  const [teams, setTeams] = useState<CanvaTeam[]>([]);
  const [queue, setQueue] = useState<CanvaTask[]>([]);
  const [running, setRunning] = useState<CanvaTask[]>([]);
  const [history, setHistory] = useState<CanvaTask[]>([]);

  const [settings, setSettings] = useState<CanvaSettings>({
    apiUrl: 'http://localhost:1568',
    enabled: true,
    price: 15000,
    price_designer: 20000,
    price_member: 15000,
    headless: true,
    concurrency: 1,
    defaultRole: 'designer',
    proxies: '',
    custom_emoji_id: '',
    msg_menu: '',
    msg_prompt: '',
    msg_processing: '',
    msg_success: '',
    msg_failed: ''
  });

  // Modal Thêm / Sửa Team
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null);
  const [teamForm, setTeamForm] = useState({
    name: '',
    cookies: '',
    localStorage: '',
    member_limit: 500,
    current_members: 0,
    role: 'member',
    status: 'active' as 'active' | 'full' | 'expired' | 'disabled',
    proxy: ''
  });
  const [submittingTeam, setSubmittingTeam] = useState(false);

  // Modal thêm đơn thủ công
  const [showAddModal, setShowAddModal] = useState(false);
  const [manualEmail, setManualEmail] = useState('');
  const [manualPrice, setManualPrice] = useState(0);
  const [manualRole, setManualRole] = useState('member');
  const [addingTask, setAddingTask] = useState(false);

  // Filter history
  const [searchHistory, setSearchHistory] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Copy indicator
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Tải dữ liệu tổng hợp
  const fetchData = useCallback(async (includeSettings = true) => {
    try {
      setRefreshing(true);
      const fetchPromises: Promise<Response>[] = [
        fetch('/api/canva/queue'),
        fetch('/api/canva/teams')
      ];

      if (includeSettings) {
        fetchPromises.push(fetch('/api/canva/settings'));
      }

      const results = await Promise.all(fetchPromises);
      const queueRes = results[0];
      const teamsRes = results[1];
      const settingsRes = includeSettings ? results[2] : null;

      if (queueRes.ok) {
        const qData = await queueRes.json();
        if (qData.success) {
          setStats(qData.stats);
          setQueue(qData.queue || []);
          setRunning(qData.running || []);
          setHistory(qData.history || []);
        }
      }

      if (teamsRes.ok) {
        const tData = await teamsRes.json();
        if (tData.success) {
          setTeams(tData.teams || []);
        }
      }

      if (settingsRes && settingsRes.ok) {
        const sData = await settingsRes.json();
        if (sData.success && sData.data) {
          setSettings(sData.data);
        }
      }
    } catch (e) {
      console.error('Error fetching canva data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Lần đầu load toàn bộ bao gồm cả settings
    fetchData(true);

    // Auto-refresh mỗi 5 giây CHỈ làm mới Hàng chờ & Đội, không ghi đè form Cài đặt
    const interval = setInterval(() => {
      fetchData(false);
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchData]);

  // Lưu cài đặt
  const handleSaveSettings = async () => {
    try {
      setSavingSettings(true);
      const res = await fetch('/api/canva/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ Đã lưu cấu hình & URL API Canva thành công!');
        fetchData(true);
      } else {
        alert('❌ Lỗi: ' + (data.error || 'Không thể lưu cài đặt'));
      }
    } catch (e: any) {
      alert('❌ Lỗi kết nối: ' + e.message);
    } finally {
      setSavingSettings(false);
    }
  };

  // Mở modal thêm team mới
  const handleOpenAddTeam = () => {
    setEditingTeamId(null);
    setTeamForm({
      name: `Đội Canva #${teams.length + 1}`,
      cookies: '',
      localStorage: '',
      member_limit: 500,
      current_members: 0,
      role: 'member',
      status: 'active',
      proxy: ''
    });
    setShowTeamModal(true);
  };

  // Mở modal sửa team
  const handleOpenEditTeam = (team: CanvaTeam) => {
    setEditingTeamId(team.id);
    setTeamForm({
      name: team.name,
      cookies: '', // Giữ trống trừ khi muốn thay mới
      localStorage: '',
      member_limit: team.member_limit,
      current_members: team.current_members,
      role: team.role || 'member',
      status: team.status,
      proxy: team.proxy || ''
    });
    setShowTeamModal(true);
  };

  // Submit Lưu Team
  const handleSubmitTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamForm.name.trim()) return alert('Vui lòng nhập tên Đội Canva');
    if (!editingTeamId && !teamForm.cookies.trim()) return alert('Vui lòng dán Cookies của tài khoản Canva Team');

    try {
      setSubmittingTeam(true);
      const res = await fetch('/api/canva/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: editingTeamId ? 'update' : 'create',
          id: editingTeamId,
          ...teamForm
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowTeamModal(false);
        fetchData();
      } else {
        alert('❌ Lỗi: ' + (data.error || 'Không thể lưu Đội Canva'));
      }
    } catch (err: any) {
      alert('❌ Lỗi kết nối: ' + err.message);
    } finally {
      setSubmittingTeam(false);
    }
  };

  // Bật/Tắt Team
  const handleToggleTeamStatus = async (team: CanvaTeam) => {
    try {
      await fetch('/api/canva/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_status', id: team.id, status: team.status })
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  // Xóa Team
  const handleDeleteTeam = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa Đội Canva này khỏi hệ thống?')) return;
    try {
      await fetch('/api/canva/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id })
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  // Thêm đơn thủ công
  const handleAddManualTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualEmail || !manualEmail.includes('@')) {
      return alert('Vui lòng nhập địa chỉ email hợp lệ');
    }
    try {
      setAddingTask(true);
      const res = await fetch('/api/canva/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_manual',
          email: manualEmail,
          price: manualPrice,
          role: manualRole
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        setManualEmail('');
        fetchData();
      } else {
        alert('❌ Lỗi: ' + (data.error || 'Không thể tạo đơn'));
      }
    } catch (err: any) {
      alert('❌ Lỗi: ' + err.message);
    } finally {
      setAddingTask(false);
    }
  };

  // Hủy đơn
  const handleCancelTask = async (taskId: number) => {
    if (!confirm('Bạn có chắc muốn hủy yêu cầu mời Canva này?')) return;
    await fetch('/api/canva/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel', taskId })
    });
    fetchData();
  };

  // Chạy lại đơn lỗi
  const handleRetryTask = async (taskId: number) => {
    await fetch('/api/canva/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'retry', taskId })
    });
    fetchData();
  };

  // Xóa đơn
  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('Bạn có chắc muốn xóa tác vụ này?')) return;
    await fetch('/api/canva/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', taskId })
    });
    fetchData();
  };

  // Sao chép link mời
  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopiedLink(link);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  // Lọc lịch sử
  const filteredHistory = history.filter(item => {
    const matchSearch =
      item.email.toLowerCase().includes(searchHistory.toLowerCase()) ||
      (item.user_name && item.user_name.toLowerCase().includes(searchHistory.toLowerCase())) ||
      (item.team_name && item.team_name.toLowerCase().includes(searchHistory.toLowerCase())) ||
      String(item.id).includes(searchHistory);

    if (filterStatus === 'all') return matchSearch;
    return matchSearch && item.status === filterStatus;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-teal-900 via-cyan-900 to-blue-900 p-6 md:p-8 text-white shadow-xl border border-teal-500/20">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-200 text-xs font-semibold backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5" />
              CANVA PRO AUTO INVITE & MULTI-COOKIE POOL
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-3">
              <Palette className="w-8 h-8 text-teal-400" />
              Tự Động Mời Canva Pro
            </h1>
            <p className="text-teal-100/80 text-sm max-w-2xl">
              Hệ thống tự động mời thành viên vào Đội Canva (Multi-Team Pool), bắt link tham gia trực tiếp từ API Canva, quản lý đơn giá và điều phối hàng chờ song song qua Telegram Bot.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={() => handleOpenAddTeam()}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-900/40 gap-2"
            >
              <Plus className="w-4 h-4" />
              Thêm Đội Canva
            </Button>

            <Button
              onClick={() => setShowAddModal(true)}
              className="bg-teal-600 hover:bg-teal-500 text-white font-semibold shadow-lg shadow-teal-900/40 gap-2"
            >
              <UserCheck className="w-4 h-4" />
              Mời Thủ Công
            </Button>

            <Button
              variant="outline"
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-md gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Làm mới
            </Button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="bg-gradient-to-br from-teal-500/10 to-teal-500/5 border-teal-500/20">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between text-teal-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Tổng Đội (Teams)</span>
              <Layers className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-teal-400">{stats.totalTeams}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Kho Cookie Đội</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between text-emerald-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Slot Còn Trống</span>
              <Users className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-emerald-400">{stats.slotsAvailable}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Chỗ trống sẵn sàng</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between text-amber-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Hàng chờ</span>
              <Clock className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-amber-400">{stats.pending}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Đang đợi chạy</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between text-blue-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Đang Mời</span>
              <Activity className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-blue-400">{stats.running}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Luồng đang chạy</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between text-green-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Thành công</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-green-400">{stats.completed}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Đã mời vào nhóm</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between text-purple-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Doanh thu</span>
              <DollarSign className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-purple-400">
              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(stats.totalRevenue)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Từ dịch vụ Canva</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-4 max-w-2xl bg-muted/60 p-1 rounded-xl">
          <TabsTrigger value="teams" className="gap-2 rounded-lg">
            <Layers className="w-4 h-4" />
            Đội & Cookie ({teams.length})
          </TabsTrigger>
          <TabsTrigger value="queue" className="gap-2 rounded-lg">
            <ListOrdered className="w-4 h-4" />
            Hàng chờ ({queue.length + running.length})
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2 rounded-lg">
            <Settings className="w-4 h-4" />
            Đơn giá & Lời nhắn
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 rounded-lg">
            <Clock className="w-4 h-4" />
            Danh Sách Mua ({history.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: QUẢN LÝ ĐỘI CANVA & COOKIE POOL */}
        <TabsContent value="teams" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Layers className="w-5 h-5 text-teal-500" />
                  Danh Sách Đội Canva & Cookie Pool
                </CardTitle>
                <CardDescription>
                  Quản lý nhiều tài khoản Đội Canva để tự động xoay vòng và mời thành viên mà không lo bị đầy nhóm.
                </CardDescription>
              </div>
              <Button onClick={handleOpenAddTeam} className="bg-teal-600 hover:bg-teal-500 text-white gap-2">
                <Plus className="w-4 h-4" />
                Thêm Đội Mới
              </Button>
            </CardHeader>
            <CardContent>
              {teams.length === 0 ? (
                <div className="text-center py-12 border border-dashed rounded-xl space-y-4">
                  <div className="w-12 h-12 rounded-full bg-teal-500/10 text-teal-400 flex items-center justify-center mx-auto">
                    <Palette className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-semibold text-base">Chưa có Đội Canva nào được cấu hình</h4>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                      Vui lòng thêm ít nhất 1 tài khoản Cookie Canva Team để bot có thể bắt đầu tự động mời thành viên.
                    </p>
                  </div>
                  <Button onClick={handleOpenAddTeam} className="bg-teal-600 hover:bg-teal-500">
                    <Plus className="w-4 h-4 mr-2" /> Thêm Đội Đầu Tiên
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {teams.map(team => {
                    const percent = Math.min(100, Math.round((team.current_members / (team.member_limit || 500)) * 100));
                    const isFull = team.current_members >= team.member_limit;

                    return (
                      <Card key={team.id} className="overflow-hidden border border-muted hover:border-teal-500/40 transition-all">
                        <div className={`h-1.5 w-full ${
                          team.status === 'disabled' ? 'bg-zinc-500' :
                          team.status === 'expired' ? 'bg-red-500' :
                          isFull ? 'bg-amber-500' : 'bg-teal-500'
                        }`} />
                        <CardContent className="p-5 space-y-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-bold text-base line-clamp-1">{team.name}</h4>
                              <p className="text-xs text-muted-foreground">ID: #{team.id} · Vai trò: {team.role || 'member'}</p>
                            </div>
                            <Badge variant="outline" className={
                              team.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                              team.status === 'full' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                              team.status === 'expired' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
                              'bg-zinc-500/10 text-zinc-400 border-zinc-500/30'
                            }>
                              {team.status === 'active' ? 'Hoạt động' :
                               team.status === 'full' ? 'Đã Đầy' :
                               team.status === 'expired' ? 'Hết hạn' : 'Tạm dừng'}
                            </Badge>
                          </div>

                          {/* Dung lượng thành viên */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs font-medium">
                              <span className="text-muted-foreground">Thành viên:</span>
                              <span className="font-bold">{team.current_members} / {team.member_limit} ({percent}%)</span>
                            </div>
                            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all ${
                                  percent >= 90 ? 'bg-red-500' :
                                  percent >= 70 ? 'bg-amber-500' : 'bg-teal-500'
                                }`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[11px] text-muted-foreground pt-1">
                              <span>Còn trống: <strong className="text-emerald-400">{Math.max(0, team.member_limit - team.current_members)}</strong> slots</span>
                              <span>{team.proxy ? `Proxy: ${team.proxy.split('@').pop()}` : 'Direct IP'}</span>
                            </div>
                          </div>

                          <div className="pt-2 border-t flex items-center justify-between gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleToggleTeamStatus(team)}
                              className="text-xs h-8"
                            >
                              <Power className="w-3.5 h-3.5 mr-1" />
                              {team.status === 'active' ? 'Tắt' : 'Bật'}
                            </Button>

                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenEditTeam(team)}
                                className="text-xs h-8 px-2"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteTeam(team.id)}
                                className="text-xs h-8 px-2"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: HÀNG CHỜ & ĐANG CHẠY */}
        <TabsContent value="queue" className="space-y-6">
          {/* Đang Chạy */}
          <Card className="border-blue-500/30">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2 text-blue-400">
                  <Activity className="w-4 h-4 animate-pulse" />
                  Luồng Đang Thực Thi ({running.length})
                </CardTitle>
                <CardDescription>Các tác vụ đang mở trình duyệt và tự động mời trên Canva</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {running.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Hiện không có luồng nào đang chạy.</p>
              ) : (
                <div className="divide-y divide-border">
                  {running.map(task => (
                    <div key={task.id} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">#{task.id}</span>
                          <span className="text-sm font-medium">{task.email}</span>
                          {task.user_name && <Badge variant="secondary" className="text-xs">@{task.user_name}</Badge>}
                          {task.team_name && <Badge variant="outline" className="text-xs border-teal-500/30 text-teal-400">{task.team_name}</Badge>}
                        </div>
                        <p className="text-xs text-blue-400 flex items-center gap-1">
                          <Activity className="w-3 h-3 animate-spin" />
                          {task.step_status || 'Đang xử lý...'}
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Bắt đầu: {task.started_at ? new Date(task.started_at).toLocaleTimeString('vi-VN') : 'Vừa xong'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Hàng Chờ Pending */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2 text-amber-400">
                  <Clock className="w-4 h-4" />
                  Hàng Chờ Đợi Xử Lý ({queue.length})
                </CardTitle>
                <CardDescription>Yêu cầu từ người dùng đang chờ đến lượt luồng trống</CardDescription>
              </div>
              <Button size="sm" onClick={() => setShowAddModal(true)} className="bg-teal-600 hover:bg-teal-500 text-xs">
                <Plus className="w-3.5 h-3.5 mr-1" /> Thêm Yêu Cầu
              </Button>
            </CardHeader>
            <CardContent>
              {queue.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Hàng chờ hiện đang trống.</p>
              ) : (
                <div className="divide-y divide-border">
                  {queue.map((task, idx) => (
                    <div key={task.id} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">#{task.id}</span>
                            <span className="text-sm font-medium">{task.email}</span>
                            {task.user_name && <Badge variant="secondary" className="text-xs">@{task.user_name}</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Tạo lúc: {new Date(task.created_at).toLocaleTimeString('vi-VN')} · Giá: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(task.price)}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCancelTask(task.id)}
                        className="text-xs text-red-400 hover:text-red-300 border-red-500/30"
                      >
                        <X className="w-3.5 h-3.5 mr-1" /> Hủy
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: CÀI ĐẶT, ĐƠN GIÁ & LỜI NHẮN */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Settings className="w-5 h-5 text-teal-500" />
                Cấu Hình Đơn Giá & Hệ Thống Auto Canva
              </CardTitle>
              <CardDescription>Thiết lập đơn giá VNĐ, số luồng chạy cùng lúc và các thông số vận hành</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Bật/Tắt Dịch Vụ */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50 border border-border">
                <div className="space-y-0.5">
                  <Label className="text-base font-semibold">Bật Dịch Vụ Auto Canva Pro trên Bot</Label>
                  <p className="text-xs text-muted-foreground">Khi tắt, Bot sẽ thông báo tạm bảo trì khi khách chọn mời Canva</p>
                </div>
                <Switch
                  checked={settings.enabled}
                  onCheckedChange={(val) => setSettings({ ...settings, enabled: val })}
                />
              </div>

              {/* Cấu hình Canva API Endpoint */}
              <div className="p-4 rounded-xl bg-secondary/40 border border-teal-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Globe className="w-4 h-4 text-teal-400" />
                    Địa chỉ Canva API Server Endpoint
                  </Label>
                  <Badge variant="outline" className="border-teal-500/40 text-teal-400 text-[11px]">
                    Port 1568
                  </Badge>
                </div>
                <Input
                  value={settings.apiUrl || ''}
                  onChange={(e) => setSettings({ ...settings, apiUrl: e.target.value })}
                  placeholder="http://localhost:1568"
                  className="font-mono text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  URL máy chủ API Canva độc lập (chạy script <code>npm start</code> trong thư mục <code>api-server</code>). Mặc định: <code>http://localhost:1568</code>
                </p>
              </div>

              {/* Grid Đơn giá 2 vai trò & Thông số */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2 p-3 rounded-xl bg-teal-500/5 border border-teal-500/20">
                  <Label className="text-teal-400 font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    1. Giá Thiết kế (Designer)
                  </Label>
                  <Input
                    type="number"
                    value={settings.price_designer ?? 20000}
                    onChange={(e) => setSettings({ ...settings, price_designer: Number(e.target.value) })}
                    placeholder="20000"
                    className="font-semibold"
                  />
                  <p className="text-[11px] text-muted-foreground">Giá gói Nhà thiết kế thương hiệu (Mã C)</p>
                </div>

                <div className="space-y-2 p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
                  <Label className="text-blue-400 font-semibold flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    2. Giá Thành viên (Member)
                  </Label>
                  <Input
                    type="number"
                    value={settings.price_member ?? 15000}
                    onChange={(e) => setSettings({ ...settings, price_member: Number(e.target.value), price: Number(e.target.value) })}
                    placeholder="15000"
                    className="font-semibold"
                  />
                  <p className="text-[11px] text-muted-foreground">Giá gói Thành viên đội (Mã B)</p>
                </div>

                <div className="space-y-2 p-3 rounded-xl bg-secondary/30 border border-border">
                  <Label className="font-semibold">Số luồng (Concurrency)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={settings.concurrency}
                    onChange={(e) => setSettings({ ...settings, concurrency: Number(e.target.value) })}
                    placeholder="1"
                  />
                  <p className="text-[11px] text-muted-foreground">Số Playwright chạy song song</p>
                </div>

                <div className="space-y-2 p-3 rounded-xl bg-secondary/30 border border-border">
                  <Label className="font-semibold">Emoji ID Telegram</Label>
                  <Input
                    value={settings.custom_emoji_id || ''}
                    onChange={(e) => setSettings({ ...settings, custom_emoji_id: e.target.value })}
                    placeholder="5312361253610475399"
                  />
                  <p className="text-[11px] text-muted-foreground">Biểu tượng động nút bấm & menu</p>
                </div>
              </div>

              {/* Chế độ Headless */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 border border-border">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">Chế độ Headless (Ẩn trình duyệt)</Label>
                  <p className="text-xs text-muted-foreground">Khuyên dùng BẬT để tiết kiệm tài nguyên RAM & CPU khi chạy trên server VPS</p>
                </div>
                <Switch
                  checked={settings.headless}
                  onCheckedChange={(val) => setSettings({ ...settings, headless: val })}
                />
              </div>

              {/* Danh sách Proxy */}
              <div className="space-y-2">
                <Label className="flex items-center justify-between">
                  <span>Danh sách Proxy xoay vòng (Mỗi dòng 1 Proxy)</span>
                  <span className="text-xs text-muted-foreground font-normal">Định dạng: ip:port hoặc ip:port:user:pass</span>
                </Label>
                <Textarea
                  rows={3}
                  value={settings.proxies || ''}
                  onChange={(e) => setSettings({ ...settings, proxies: e.target.value })}
                  placeholder="103.145.2.1:8080&#10;103.145.2.2:8080:user:pass"
                  className="font-mono text-xs"
                />
              </div>

              {/* 5 Mẫu Lời Nhắn Bot */}
              <div className="space-y-4 pt-4 border-t">
                <div className="space-y-1">
                  <h4 className="font-bold text-base flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-teal-400" />
                    Tùy Chỉnh Toàn Bộ Lời Nhắn Bot Telegram
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Hỗ trợ các thẻ: <code>{'{price}'}</code>, <code>{'{slots_available}'}</code>, <code>{'{teams_available}'}</code>, <code>{'{email}'}</code>, <code>{'{team_name}'}</code>, <code>{'{invite_link}'}</code>, <code>{'{emoji}'}</code>, <code>{'{time}'}</code>
                  </p>
                </div>

                <div className="space-y-3">
                  <Label className="text-xs font-semibold">1. Lời nhắn Menu Giới Thiệu (Msg Menu)</Label>
                  <Textarea
                    rows={4}
                    value={settings.msg_menu || ''}
                    onChange={(e) => setSettings({ ...settings, msg_menu: e.target.value })}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-xs font-semibold">2. Lời nhắn Yêu Cầu Nhập Email (Msg Prompt)</Label>
                  <Textarea
                    rows={3}
                    value={settings.msg_prompt || ''}
                    onChange={(e) => setSettings({ ...settings, msg_prompt: e.target.value })}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-xs font-semibold">3. Lời nhắn Đang Xử Lý Mời (Msg Processing)</Label>
                  <Textarea
                    rows={3}
                    value={settings.msg_processing || ''}
                    onChange={(e) => setSettings({ ...settings, msg_processing: e.target.value })}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-xs font-semibold">4. Lời nhắn Mời Thành Công & Trả Link (Msg Success)</Label>
                  <Textarea
                    rows={4}
                    value={settings.msg_success || ''}
                    onChange={(e) => setSettings({ ...settings, msg_success: e.target.value })}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-xs font-semibold">5. Lời nhắn Báo Lỗi & Hoàn Tiền (Msg Failed)</Label>
                  <Textarea
                    rows={3}
                    value={settings.msg_failed || ''}
                    onChange={(e) => setSettings({ ...settings, msg_failed: e.target.value })}
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className="bg-teal-600 hover:bg-teal-500 text-white font-semibold gap-2"
                >
                  <Check className="w-4 h-4" />
                  {savingSettings ? 'Đang lưu...' : 'Lưu Toàn Bộ Cấu Hình'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: DANH SÁCH MUA & LỊCH SỬ MỜI */}
        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-teal-500" />
                  Danh Sách Đơn Mua & Lịch Sử Mời Canva
                </CardTitle>
                <CardDescription>Toàn bộ các đơn hàng đã xử lý, link mời đã tạo và nhật ký lỗi</CardDescription>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  placeholder="Tìm email, username, mã đơn..."
                  value={searchHistory}
                  onChange={(e) => setSearchHistory(e.target.value)}
                  className="w-48 sm:w-64 h-9 text-xs"
                />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="h-9 px-3 text-xs rounded-md bg-background border border-input focus:outline-none"
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="completed">Thành công</option>
                  <option value="failed">Thất bại</option>
                  <option value="cancelled">Đã hủy</option>
                </select>
              </div>
            </CardHeader>
            <CardContent>
              {filteredHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground py-10 text-center">Không tìm thấy đơn hàng nào phù hợp.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b text-muted-foreground font-semibold">
                        <th className="py-2.5 px-3">Mã đơn</th>
                        <th className="py-2.5 px-3">Khách hàng</th>
                        <th className="py-2.5 px-3">Email nhận</th>
                        <th className="py-2.5 px-3">Đội Canva</th>
                        <th className="py-2.5 px-3">Đơn giá</th>
                        <th className="py-2.5 px-3">Trạng thái</th>
                        <th className="py-2.5 px-3">Link Mời</th>
                        <th className="py-2.5 px-3">Thời gian</th>
                        <th className="py-2.5 px-3 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredHistory.map(task => (
                        <tr key={task.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-3 font-semibold">#{task.id}</td>
                          <td className="py-3 px-3">
                            {task.user_name ? (
                              <span className="text-teal-400">@{task.user_name}</span>
                            ) : (
                              <span className="text-muted-foreground">Admin/Direct</span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-medium">{task.email}</td>
                          <td className="py-3 px-3">
                            {task.team_name || task.team_assigned_name ? (
                              <Badge variant="outline" className="text-[10px] border-teal-500/30 text-teal-400">
                                {task.team_name || task.team_assigned_name}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-semibold">
                            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(task.price)}
                          </td>
                          <td className="py-3 px-3">
                            <Badge className={
                              task.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                              task.status === 'failed' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                              'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
                            }>
                              {task.status === 'completed' ? 'Thành công' :
                               task.status === 'failed' ? 'Thất bại' : 'Đã hủy'}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 max-w-[200px]">
                            {task.invite_link ? (
                              <div className="flex items-center gap-1.5">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleCopyLink(task.invite_link!)}
                                  className="h-6 px-1.5 text-[11px] gap-1 text-teal-400 hover:text-teal-300"
                                >
                                  {copiedLink === task.invite_link ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                  Copy
                                </Button>
                                <a
                                  href={task.invite_link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            ) : task.error_message ? (
                              <span className="text-red-400 text-[11px] line-clamp-1" title={task.error_message}>
                                {task.error_message}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-muted-foreground">
                            {new Date(task.created_at).toLocaleString('vi-VN')}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {task.status === 'failed' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRetryTask(task.id)}
                                  className="h-7 px-2 text-xs text-amber-400 hover:text-amber-300"
                                >
                                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> Thử lại
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteTask(task.id)}
                                className="h-7 px-2 text-xs text-red-400 hover:text-red-300"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal Thêm / Sửa Đội Canva */}
      {showTeamModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg shadow-2xl border-teal-500/30">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Palette className="w-5 h-5 text-teal-400" />
                {editingTeamId ? 'Chỉnh Sửa Đội Canva' : 'Thêm Đội Canva Mới'}
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setShowTeamModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <form onSubmit={handleSubmitTeam}>
              <CardContent className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <Label>Tên Đội Canva</Label>
                  <Input
                    value={teamForm.name}
                    onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                    placeholder="Ví dụ: Đội Thiết Kế Canva #1"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Hạn mức thành viên (Max)</Label>
                    <Input
                      type="number"
                      value={teamForm.member_limit}
                      onChange={(e) => setTeamForm({ ...teamForm, member_limit: Number(e.target.value) })}
                      placeholder="500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Số thành viên hiện tại</Label>
                    <Input
                      type="number"
                      value={teamForm.current_members}
                      onChange={(e) => setTeamForm({ ...teamForm, current_members: Number(e.target.value) })}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center justify-between">
                    <span>Cookies Canva (JSON Array hoặc Netscape)</span>
                    {editingTeamId && <span className="text-amber-400 font-normal">Để trống nếu không đổi</span>}
                  </Label>
                  <Textarea
                    rows={4}
                    value={teamForm.cookies}
                    onChange={(e) => setTeamForm({ ...teamForm, cookies: e.target.value })}
                    placeholder='[{"name":"__cf_bm","value":"...","domain":".canva.com"},...]'
                    className="font-mono text-[11px]"
                    required={!editingTeamId}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Proxy riêng cho Đội này (Tùy chọn)</Label>
                  <Input
                    value={teamForm.proxy}
                    onChange={(e) => setTeamForm({ ...teamForm, proxy: e.target.value })}
                    placeholder="ip:port hoặc ip:port:user:pass"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button type="button" variant="outline" onClick={() => setShowTeamModal(false)}>
                    Hủy
                  </Button>
                  <Button type="submit" disabled={submittingTeam} className="bg-teal-600 hover:bg-teal-500">
                    {submittingTeam ? 'Đang lưu...' : (editingTeamId ? 'Cập Nhật Đội' : 'Thêm Đội Canva')}
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>
        </div>
      )}

      {/* Modal Thêm Đơn Thủ Công */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-2xl border-teal-500/30">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-teal-400" />
                Mời Thành Viên Canva Thủ Công
              </CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setShowAddModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <form onSubmit={handleAddManualTask}>
              <CardContent className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <Label>Địa chỉ Email nhận lời mời</Label>
                  <Input
                    type="email"
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    placeholder="example@gmail.com"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Đơn giá ghi nhận (VNĐ)</Label>
                  <Input
                    type="number"
                    value={manualPrice}
                    onChange={(e) => setManualPrice(Number(e.target.value))}
                    placeholder="0"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
                    Hủy
                  </Button>
                  <Button type="submit" disabled={addingTask} className="bg-teal-600 hover:bg-teal-500">
                    {addingTask ? 'Đang thêm...' : 'Thêm Vào Hàng Chờ'}
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
