'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Film, RefreshCw, Plus, Settings, ShieldCheck, Play, CheckCircle2,
  XCircle, Clock, AlertTriangle, Trash2, RotateCcw, Power, Cpu,
  DollarSign, ListOrdered, Activity, ExternalLink, Globe, Wifi, Check, X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface NetflixStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  totalRevenue: number;
}

interface NetflixTask {
  id: number;
  user_id?: number;
  telegram_id?: string;
  user_name?: string;
  first_name?: string;
  email: string;
  price: number;
  proxy_used?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  step_status?: string;
  error_message?: string;
  screenshot_path?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

interface NetflixSettings {
  enabled: boolean;
  price: number;
  headless: boolean;
  concurrency: number;
  proxies: string;
  cookies: string;
  custom_emoji_id?: string;
  msg_menu?: string;
  msg_prompt?: string;
  msg_processing?: string;
  msg_success?: string;
  msg_failed?: string;
}

export default function NetflixDashboardPage() {
  const [activeTab, setActiveTab] = useState('queue');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const [stats, setStats] = useState<NetflixStats>({
    total: 0, pending: 0, running: 0, completed: 0, failed: 0, totalRevenue: 0
  });

  const [queue, setQueue] = useState<NetflixTask[]>([]);
  const [running, setRunning] = useState<NetflixTask[]>([]);
  const [history, setHistory] = useState<NetflixTask[]>([]);

  const [settings, setSettings] = useState<NetflixSettings>({
    enabled: true,
    price: 25000,
    headless: true,
    concurrency: 1,
    proxies: '',
    cookies: '',
    custom_emoji_id: '',
    msg_menu: '',
    msg_prompt: '',
    msg_processing: '',
    msg_success: '',
    msg_failed: ''
  });

  // Modal thêm đơn thủ công
  const [showAddModal, setShowAddModal] = useState(false);
  const [manualEmail, setManualEmail] = useState('');
  const [manualPrice, setManualPrice] = useState(0);
  const [addingTask, setAddingTask] = useState(false);

  // Proxy tester state
  const [testProxyInput, setTestProxyInput] = useState('');
  const [testingProxy, setTestingProxy] = useState(false);
  const [proxyTestResult, setProxyTestResult] = useState<{ success: boolean; live?: boolean; message: string; ip?: string; latency?: string } | null>(null);

  // Filter history
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchData = useCallback(async (showIndicator = false) => {
    if (showIndicator) setRefreshing(true);
    try {
      const [queueRes, settingsRes] = await Promise.all([
        fetch('/api/netflix/queue'),
        fetch('/api/netflix/settings')
      ]);

      const queueJson = await queueRes.json();
      if (queueJson.success) {
        setStats(queueJson.stats || {});
        setQueue(queueJson.queue || []);
        setRunning(queueJson.running || []);
        setHistory(queueJson.history || []);
      }

      const settingsJson = await settingsRes.json();
      if (settingsJson.success) {
        setSettings(settingsJson.data);
      }
    } catch (e) {
      console.error('Failed to fetch Netflix data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Auto refresh every 4 seconds
    const interval = setInterval(() => {
      fetchData(false);
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch('/api/netflix/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ Cập nhật cài đặt Netflix thành công!');
        fetchData();
      } else {
        alert('❌ Lỗi: ' + (data.error || 'Không thể lưu cài đặt'));
      }
    } catch (e: any) {
      alert('❌ Lỗi mạng: ' + e.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTaskAction = async (action: string, id?: number) => {
    try {
      const res = await fetch('/api/netflix/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, id })
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      } else {
        alert('❌ ' + (data.error || 'Thao tác thất bại'));
      }
    } catch (e: any) {
      alert('❌ Lỗi: ' + e.message);
    }
  };

  const handleAddManualTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualEmail.includes('@')) {
      alert('Vui lòng nhập địa chỉ email hợp lệ!');
      return;
    }

    setAddingTask(true);
    try {
      const res = await fetch('/api/netflix/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', email: manualEmail, price: manualPrice })
      });
      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        setManualEmail('');
        fetchData();
      } else {
        alert('❌ Lỗi: ' + (data.error || 'Không thể thêm task'));
      }
    } catch (e: any) {
      alert('❌ Lỗi: ' + e.message);
    } finally {
      setAddingTask(false);
    }
  };

  const handleTestProxy = async () => {
    if (!testProxyInput.trim()) {
      alert('Vui lòng nhập chuỗi proxy để kiểm tra!');
      return;
    }

    setTestingProxy(true);
    setProxyTestResult(null);
    try {
      const res = await fetch('/api/netflix/proxy-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proxy: testProxyInput.trim() })
      });
      const data = await res.json();
      setProxyTestResult(data);
    } catch (e: any) {
      setProxyTestResult({ success: false, message: 'Lỗi kết nối API: ' + e.message });
    } finally {
      setTestingProxy(false);
    }
  };

  const formatVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num || 0);
  };

  const filteredHistory = history.filter(item => {
    const matchSearch = (item.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.user_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(item.id).includes(searchTerm);
    const matchStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-600 text-white shadow-lg shadow-red-500/25">
              <Film className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-zinc-900 flex items-center gap-2">
                AUTO NETFLIX 30 DAYS
                <Badge variant={settings.enabled ? 'default' : 'destructive'} className={settings.enabled ? 'bg-emerald-600 hover:bg-emerald-700' : ''}>
                  {settings.enabled ? 'ĐANG HOẠT ĐỘNG' : 'TẠM BẢO TRÌ'}
                </Badge>
              </h1>
              <p className="text-xs font-semibold text-zinc-500">
                Quản lý đơn giá, hàng chờ (Queue), danh sách đang chạy và hệ thống xoay vòng Proxy an toàn.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="border-zinc-200 bg-white shadow-xs hover:bg-zinc-50"
          >
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${refreshing ? 'animate-spin text-red-600' : 'text-zinc-600'}`} />
            Làm mới
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setManualPrice(settings.price || 25000);
              setShowAddModal(true);
            }}
            className="bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/20 font-bold"
          >
            <Plus className="mr-2 h-4 w-4" />
            Thêm Đơn Thủ Công
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Card className="border-zinc-200/80 bg-white shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Hàng chờ</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-600">{stats.pending}</span>
              <span className="text-[11px] font-semibold text-zinc-400">yêu cầu</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200/80 bg-white shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Đang chạy</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Activity className="h-4 w-4 animate-pulse" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-blue-600">{stats.running}</span>
              <span className="text-[11px] font-semibold text-zinc-400">luồng active</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200/80 bg-white shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Thành công</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-600">{stats.completed}</span>
              <span className="text-[11px] font-semibold text-zinc-400">đã xong</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200/80 bg-white shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Thất bại</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                <XCircle className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-rose-600">{stats.failed}</span>
              <span className="text-[11px] font-semibold text-zinc-400">lỗi</span>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-2 border-zinc-200/80 bg-gradient-to-br from-zinc-900 to-zinc-800 text-white shadow-sm lg:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Doanh thu</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-emerald-400">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-lg font-black text-emerald-400 tracking-tight">{formatVND(stats.totalRevenue)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 bg-zinc-100 p-1 rounded-xl">
          <TabsTrigger value="queue" className="rounded-lg font-bold text-xs py-2 data-[state=active]:bg-white data-[state=active]:shadow-xs">
            <ListOrdered className="mr-2 h-4 w-4 text-amber-600" />
            Hàng Chờ ({queue.length}) & Đang Chạy ({running.length})
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-lg font-bold text-xs py-2 data-[state=active]:bg-white data-[state=active]:shadow-xs">
            <Settings className="mr-2 h-4 w-4 text-blue-600" />
            Cấu Hình & Đơn Giá
          </TabsTrigger>
          <TabsTrigger value="proxy" className="rounded-lg font-bold text-xs py-2 data-[state=active]:bg-white data-[state=active]:shadow-xs">
            <ShieldCheck className="mr-2 h-4 w-4 text-emerald-600" />
            Quản Lý Proxy Pool
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-lg font-bold text-xs py-2 data-[state=active]:bg-white data-[state=active]:shadow-xs">
            <Clock className="mr-2 h-4 w-4 text-purple-600" />
            Lịch Sử & Báo Cáo ({history.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: QUEUE & RUNNING */}
        <TabsContent value="queue" className="space-y-5">
          {/* Running Tasks Section */}
          <Card className="border-zinc-200 bg-white shadow-xs">
            <CardHeader className="border-b border-zinc-100 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-black text-zinc-900 flex items-center gap-2">
                    <Activity className="h-5 w-5 text-blue-600 animate-spin" />
                    DANH SÁCH ĐANG CHẠY ({running.length})
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Các luồng tự động hóa đang trực tiếp thao tác trên trình duyệt Netflix.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 font-bold">
                  {running.length} Active Slots
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {running.length === 0 ? (
                <div className="p-8 text-center text-xs font-semibold text-zinc-400">
                  Hiện không có tác vụ nào đang chạy. Hệ thống đang sẵn sàng tiếp nhận!
                </div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {running.map((task) => (
                    <div key={task.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between bg-blue-50/20 hover:bg-blue-50/40 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-zinc-400">#{task.id}</span>
                          <span className="font-extrabold text-sm text-zinc-900">{task.email}</span>
                          <Badge className="bg-blue-600 text-white text-[10px] animate-pulse">RUNNING</Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 font-medium">
                          <span className="text-blue-700 font-semibold">📍 {task.step_status || 'Đang thực thi...'}</span>
                          <span>🛡️ Proxy: <code className="bg-zinc-100 px-1 py-0.5 rounded text-[11px]">{task.proxy_used || 'Direct'}</code></span>
                          <span>👤 Khách: {task.user_name ? `@${task.user_name}` : (task.telegram_id || 'Admin')}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-zinc-700">{formatVND(task.price)}</div>
                        <span className="text-[10px] text-zinc-400">{task.started_at ? new Date(task.started_at).toLocaleTimeString('vi-VN') : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Queue Section */}
          <Card className="border-zinc-200 bg-white shadow-xs">
            <CardHeader className="border-b border-zinc-100 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-black text-zinc-900 flex items-center gap-2">
                    <ListOrdered className="h-5 w-5 text-amber-600" />
                    HÀNG CHỜ XỬ LÝ (PENDING QUEUE: {queue.length})
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Thứ tự yêu cầu sẽ được worker tự động gắp vào xử lý theo cơ chế FIFO.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {queue.length === 0 ? (
                <div className="p-8 text-center text-xs font-semibold text-zinc-400">
                  Hàng chờ trống. Không có yêu cầu nào đang đợi.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-50 border-b border-zinc-100 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                      <tr>
                        <th className="p-3">#STT</th>
                        <th className="p-3">Email Đăng Ký</th>
                        <th className="p-3">Khách Hàng</th>
                        <th className="p-3">Đơn Giá</th>
                        <th className="p-3">Thời Gian Tạo</th>
                        <th className="p-3">Trạng Thái</th>
                        <th className="p-3 text-right">Hành Động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {queue.map((task, index) => (
                        <tr key={task.id} className="hover:bg-zinc-50/80 transition-colors">
                          <td className="p-3 font-mono font-bold text-amber-700">#{index + 1}</td>
                          <td className="p-3 font-bold text-zinc-900">{task.email}</td>
                          <td className="p-3 text-zinc-600 font-medium">
                            {task.user_name ? `@${task.user_name}` : (task.telegram_id ? `ID: ${task.telegram_id}` : 'Thủ công')}
                          </td>
                          <td className="p-3 font-semibold text-zinc-700">{formatVND(task.price)}</td>
                          <td className="p-3 text-zinc-400">{new Date(task.created_at).toLocaleTimeString('vi-VN')}</td>
                          <td className="p-3">
                            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 text-[10px] font-bold">
                              CHỜ XỬ LÝ
                            </Badge>
                          </td>
                          <td className="p-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTaskAction('cancel', task.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs h-7 px-2"
                            >
                              <X className="h-3.5 w-3.5 mr-1" /> Hủy
                            </Button>
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

        {/* TAB 2: SETTINGS & PRICING */}
        <TabsContent value="settings" className="space-y-4">
          <Card className="border-zinc-200 bg-white shadow-xs">
            <CardHeader>
              <CardTitle className="text-base font-black text-zinc-900">CẤU HÌNH DỊCH VỤ & QUẢN LÝ ĐƠN GIÁ</CardTitle>
              <CardDescription className="text-xs">
                Tùy chỉnh giá tiền thu khách trên Telegram Bot, số luồng chạy cùng lúc và hành vi trình duyệt.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Bật tắt dịch vụ */}
              <div className="flex items-center justify-between rounded-xl border border-zinc-200 p-4 bg-zinc-50/50">
                <div className="space-y-0.5">
                  <Label className="text-sm font-bold text-zinc-900">Trạng Thái Dịch Vụ Netflix 30 Ngày</Label>
                  <p className="text-xs text-zinc-500">
                    Bật hoặc tắt chức năng nhận Netflix trên Telegram Bot và WebApp.
                  </p>
                </div>
                <Switch
                  checked={settings.enabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
                />
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Đơn giá VNĐ */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                    Đơn Giá Thu Khách (VNĐ)
                  </Label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={settings.price}
                      onChange={(e) => setSettings({ ...settings, price: Math.max(0, Number(e.target.value)) })}
                      placeholder="25000"
                      className="font-bold text-base pr-16"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">
                      VNĐ / Email
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Xem trước: <span className="font-bold text-emerald-600">{formatVND(settings.price)}</span> (Set = 0 nếu muốn miễn phí).
                  </p>
                </div>

                {/* Số luồng song song */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                    Số Luồng Chạy Đồng Thời (Concurrency)
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={settings.concurrency}
                    onChange={(e) => setSettings({ ...settings, concurrency: Math.max(1, Number(e.target.value)) })}
                    placeholder="1"
                    className="font-bold"
                  />
                  <p className="text-[11px] text-zinc-400">
                    Số trình duyệt Chrome mở cùng lúc để xử lý hàng chờ. Đề xuất: 1 - 3 luồng.
                  </p>
                </div>
              </div>

              {/* Chế độ Headless */}
              <div className="flex items-center justify-between rounded-xl border border-zinc-200 p-4 bg-zinc-50/50">
                <div className="space-y-0.5">
                  <Label className="text-sm font-bold text-zinc-900">Ẩn Giao Diện Trình Duyệt (Headless Mode)</Label>
                  <p className="text-xs text-zinc-500">
                    Khuyên dùng để tối ưu tốc độ và tiết kiệm RAM máy chủ khi chạy tự động ngầm.
                  </p>
                </div>
                <Switch
                  checked={settings.headless}
                  onCheckedChange={(checked) => setSettings({ ...settings, headless: checked })}
                />
              </div>

              {/* Cấu hình Cookies Thiết Bị */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                  Cấu Hình Cookie Thiết Bị (JSON Cookies)
                </Label>
                <Textarea
                  value={settings.cookies}
                  onChange={(e) => setSettings({ ...settings, cookies: e.target.value })}
                  placeholder='[{"domain": ".netflix.com", "name": "SecureNetflixId", "value": "..."}]'
                  rows={3}
                  className="font-mono text-xs"
                />
                <p className="text-[11px] text-zinc-400">
                  Nạp cookie thiết bị hợp lệ giúp bypass và tránh lỗi xác minh thiết bị khi đăng ký trial.
                </p>
              </div>

              {/* ID Emoji Động Telegram (Custom Emoji ID) */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span>✨ ID Emoji Động Telegram (Custom Emoji ID)</span>
                  <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                    Premium Animated Emoji
                  </Badge>
                </Label>
                <Input
                  type="text"
                  value={settings.custom_emoji_id || ''}
                  onChange={(e) => setSettings({ ...settings, custom_emoji_id: e.target.value.trim() })}
                  placeholder="Ví dụ: 5368324170671202286 hoặc 5854776233950187351"
                  className="font-mono text-xs font-bold"
                />
                <p className="text-[11px] text-zinc-400">
                  Nhập mã ID emoji Telegram Premium để hiển thị Icon emoji động trên nút bấm và tin nhắn của Bot. Trong tin nhắn, bạn cũng có thể gõ trực tiếp <code className="font-mono text-rose-600 font-bold">{'{id:5368324170671202286}'}</code> hoặc <code className="font-mono text-rose-600 font-bold">{'{emoji}'}</code>.
                </p>
              </div>

              {/* Tùy chỉnh Lời Nhắn & Thông Báo Bot */}
              <div className="border-t border-zinc-200 pt-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-zinc-900 flex items-center gap-2">
                      💬 TÙY CHỈNH NỘI DUNG & LỜI NHẮN TELEGRAM BOT
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Chỉnh sửa toàn bộ tin nhắn Bot gửi cho khách hàng. Hỗ trợ định dạng HTML/Markdown, Emoji động <code className="text-rose-600">{'{id:5368324170671202286}'}</code>, <code className="text-rose-600">{'{emoji}'}</code> và các biến tự động.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {/* 1. Lời nhắn Menu */}
                  <div className="space-y-1.5 rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-3.5">
                    <Label className="text-xs font-bold text-zinc-800">
                      1. Lời Nhắn Khi Mở Menu Netflix (`/netflix`)
                    </Label>
                    <p className="text-[11px] text-zinc-500">
                      Biến hỗ trợ: <code className="font-mono text-rose-600 font-bold">{'{price}'}</code> (Đơn giá), <code className="font-mono text-rose-600 font-bold">{'{pending_count}'}</code> (Đang chờ), <code className="font-mono text-rose-600 font-bold">{'{success_count}'}</code> (Đã hoàn tất)
                    </p>
                    <Textarea
                      value={settings.msg_menu || ''}
                      onChange={(e) => setSettings({ ...settings, msg_menu: e.target.value })}
                      placeholder="🎬 **TỰ ĐỘNG NHẬN NETFLIX 30 NGÀY...**"
                      rows={4}
                      className="text-xs bg-white"
                    />
                  </div>

                  {/* 2. Lời nhắn Yêu cầu nhập Email */}
                  <div className="space-y-1.5 rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-3.5">
                    <Label className="text-xs font-bold text-zinc-800">
                      2. Lời Nhắn Yêu Cầu Khách Nhập Email
                    </Label>
                    <p className="text-[11px] text-zinc-500">
                      Biến hỗ trợ: <code className="font-mono text-rose-600 font-bold">{'{price}'}</code>
                    </p>
                    <Textarea
                      value={settings.msg_prompt || ''}
                      onChange={(e) => setSettings({ ...settings, msg_prompt: e.target.value })}
                      placeholder="📝 **VUI LÒNG NHẬP EMAIL CỦA BẠN...**"
                      rows={3}
                      className="text-xs bg-white"
                    />
                  </div>

                  {/* 3. Lời nhắn Khi Tiếp Nhận & Vào Hàng Chờ */}
                  <div className="space-y-1.5 rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-3.5">
                    <Label className="text-xs font-bold text-zinc-800">
                      3. Lời Nhắn Khi Tiếp Nhận & Đang Xử Lý
                    </Label>
                    <p className="text-[11px] text-zinc-500">
                      Biến hỗ trợ: <code className="font-mono text-rose-600 font-bold">{'{task_id}'}</code>, <code className="font-mono text-rose-600 font-bold">{'{email}'}</code>, <code className="font-mono text-rose-600 font-bold">{'{queue_pos}'}</code>, <code className="font-mono text-rose-600 font-bold">{'{price}'}</code>
                    </p>
                    <Textarea
                      value={settings.msg_processing || ''}
                      onChange={(e) => setSettings({ ...settings, msg_processing: e.target.value })}
                      placeholder="⏳ **ĐANG XỬ LÝ NHẬN NETFLIX 30 NGÀY...**"
                      rows={3}
                      className="text-xs bg-white"
                    />
                  </div>

                  {/* 4. Lời nhắn Thành Công */}
                  <div className="space-y-1.5 rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-3.5">
                    <Label className="text-xs font-bold text-zinc-800">
                      4. Lời Nhắn Khi Kích Hoạt Thành Công 🎉
                    </Label>
                    <p className="text-[11px] text-zinc-500">
                      Biến hỗ trợ: <code className="font-mono text-rose-600 font-bold">{'{email}'}</code>, <code className="font-mono text-rose-600 font-bold">{'{price}'}</code>, <code className="font-mono text-rose-600 font-bold">{'{time}'}</code>
                    </p>
                    <Textarea
                      value={settings.msg_success || ''}
                      onChange={(e) => setSettings({ ...settings, msg_success: e.target.value })}
                      placeholder="🎉 **NHẬN NETFLIX 30 NGÀY THÀNH CÔNG!...**"
                      rows={3}
                      className="text-xs bg-white"
                    />
                  </div>

                  {/* 5. Lời nhắn Thất Bại */}
                  <div className="space-y-1.5 rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-3.5">
                    <Label className="text-xs font-bold text-zinc-800">
                      5. Lời Nhắn Khi Thất Bại / Lỗi ❌
                    </Label>
                    <p className="text-[11px] text-zinc-500">
                      Biến hỗ trợ: <code className="font-mono text-rose-600 font-bold">{'{email}'}</code>, <code className="font-mono text-rose-600 font-bold">{'{reason}'}</code>, <code className="font-mono text-rose-600 font-bold">{'{refund_note}'}</code>
                    </p>
                    <Textarea
                      value={settings.msg_failed || ''}
                      onChange={(e) => setSettings({ ...settings, msg_failed: e.target.value })}
                      placeholder="❌ **NHẬN NETFLIX 30 NGÀY THẤT BẠI!...**"
                      rows={3}
                      className="text-xs bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-3">
                <Button
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 shadow-md shadow-emerald-600/20"
                >
                  {savingSettings ? 'Đang lưu...' : '💾 Lưu Cấu Hình, Đơn Giá & Lời Nhắn'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: PROXY POOL */}
        <TabsContent value="proxy" className="space-y-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Proxy List Editor */}
            <Card className="border-zinc-200 bg-white shadow-xs lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base font-black text-zinc-900 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  DANH SÁCH PROXY POOL (XOAY VÒNG TỰ ĐỘNG)
                </CardTitle>
                <CardDescription className="text-xs">
                  Mỗi dòng là 1 Proxy. Hệ thống sẽ tự động chọn ngẫu nhiên Proxy khi thực thi mỗi tác vụ Netflix để chống chặn IP.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={settings.proxies}
                  onChange={(e) => setSettings({ ...settings, proxies: e.target.value })}
                  placeholder={`103.153.220.12:8080\n103.153.220.13:8080:user:pass\nhttp://user:pass@103.153.220.14:8080\nsocks5://user:pass@103.153.220.15:1080`}
                  rows={9}
                  className="font-mono text-xs"
                />

                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>
                    Tổng cộng: <strong className="text-zinc-900 font-bold">{settings.proxies.split('\n').filter(p => p.trim() && !p.startsWith('#')).length}</strong> proxy khả dụng
                  </span>
                  <Button
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                  >
                    💾 Lưu Danh Sách Proxy
                  </Button>
                </div>

                <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-3 text-[11px] text-zinc-500 space-y-1">
                  <div className="font-bold text-zinc-700">📌 Định dạng Proxy được hỗ trợ:</div>
                  <div>• <code>ip:port</code> (Ví dụ: <code>103.153.220.12:8080</code>)</div>
                  <div>• <code>ip:port:user:pass</code> (Ví dụ: <code>103.153.220.12:8080:admin:pass123</code>)</div>
                  <div>• <code>http://user:pass@ip:port</code> hoặc <code>socks5://user:pass@ip:port</code></div>
                </div>
              </CardContent>
            </Card>

            {/* Proxy Tester Tool */}
            <Card className="border-zinc-200 bg-white shadow-xs">
              <CardHeader>
                <CardTitle className="text-base font-black text-zinc-900 flex items-center gap-2">
                  <Wifi className="h-5 w-5 text-blue-600" />
                  KIỂM TRA PROXY (LIVE/DIE)
                </CardTitle>
                <CardDescription className="text-xs">
                  Test kết nối thực tế và kiểm tra địa chỉ IP đầu ra của Proxy.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-zinc-700 uppercase">Nhập Proxy cần Test</Label>
                  <Input
                    value={testProxyInput}
                    onChange={(e) => setTestProxyInput(e.target.value)}
                    placeholder="ip:port:user:pass"
                    className="font-mono text-xs"
                  />
                </div>

                <Button
                  onClick={handleTestProxy}
                  disabled={testingProxy}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
                >
                  {testingProxy ? (
                    <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5 mr-2" />
                  )}
                  Kiểm Tra Proxy Ngay
                </Button>

                {proxyTestResult && (
                  <div className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                    proxyTestResult.success && proxyTestResult.live
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}>
                    <div className="font-bold flex items-center gap-1.5">
                      {proxyTestResult.success && proxyTestResult.live ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-rose-600" />
                      )}
                      {proxyTestResult.message}
                    </div>
                    {proxyTestResult.ip && (
                      <div className="text-[11px] font-mono">
                        🌐 Public IP: <strong>{proxyTestResult.ip}</strong>
                      </div>
                    )}
                    {proxyTestResult.latency && (
                      <div className="text-[11px]">
                        ⚡ Độ trễ: <strong>{proxyTestResult.latency}</strong>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 4: HISTORY & REPORTS */}
        <TabsContent value="history" className="space-y-4">
          <Card className="border-zinc-200 bg-white shadow-xs">
            <CardHeader className="border-b border-zinc-100 pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base font-black text-zinc-900">LỊCH SỬ THỰC THI & BÁO CÁO KẾT QUẢ</CardTitle>
                  <CardDescription className="text-xs">
                    Theo dõi chi tiết các tác vụ đã hoàn thành hoặc thất bại, nguyên nhân lỗi và doanh thu.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Tìm theo email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-8 text-xs w-44"
                  />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-8 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-semibold text-zinc-700 shadow-2xs focus:outline-hidden"
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="completed">Thành công</option>
                    <option value="failed">Thất bại</option>
                    <option value="cancelled">Đã hủy</option>
                  </select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm('Bạn có chắc muốn dọn sạch toàn bộ lịch sử cũ?')) {
                        handleTaskAction('clear_history');
                      }
                    }}
                    className="text-zinc-400 hover:text-red-600 text-xs h-8"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredHistory.length === 0 ? (
                <div className="p-8 text-center text-xs font-semibold text-zinc-400">
                  Không tìm thấy bản ghi lịch sử nào phù hợp.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-50 border-b border-zinc-100 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                      <tr>
                        <th className="p-3">Mã #</th>
                        <th className="p-3">Email</th>
                        <th className="p-3">Khách Hàng</th>
                        <th className="p-3">Đơn Giá</th>
                        <th className="p-3">Proxy Sử Dụng</th>
                        <th className="p-3">Trạng Thái</th>
                        <th className="p-3">Chi Tiết / Lỗi</th>
                        <th className="p-3">Thời Gian</th>
                        <th className="p-3 text-right">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {filteredHistory.map((task) => (
                        <tr key={task.id} className="hover:bg-zinc-50/80 transition-colors">
                          <td className="p-3 font-mono font-bold text-zinc-500">#{task.id}</td>
                          <td className="p-3 font-bold text-zinc-900">{task.email}</td>
                          <td className="p-3 text-zinc-600 font-medium">
                            {task.user_name ? `@${task.user_name}` : (task.telegram_id || 'Admin')}
                          </td>
                          <td className="p-3 font-semibold text-zinc-700">{formatVND(task.price)}</td>
                          <td className="p-3 font-mono text-[11px] text-zinc-500">{task.proxy_used || 'Direct'}</td>
                          <td className="p-3">
                            {task.status === 'completed' && (
                              <Badge className="bg-emerald-600 text-white text-[10px] font-bold">THÀNH CÔNG</Badge>
                            )}
                            {task.status === 'failed' && (
                              <Badge variant="destructive" className="text-[10px] font-bold">THẤT BẠI</Badge>
                            )}
                            {task.status === 'cancelled' && (
                              <Badge variant="outline" className="border-zinc-300 text-zinc-500 text-[10px]">ĐÃ HỦY</Badge>
                            )}
                          </td>
                          <td className="p-3 max-w-[200px] truncate text-[11px] text-zinc-500" title={task.error_message || task.step_status || ''}>
                            {task.error_message ? (
                              <span className="text-rose-600 font-medium">⚠️ {task.error_message}</span>
                            ) : (
                              <span>{task.step_status || 'Hoàn tất'}</span>
                            )}
                          </td>
                          <td className="p-3 text-zinc-400 text-[11px]">
                            {task.completed_at ? new Date(task.completed_at).toLocaleString('vi-VN') : new Date(task.created_at).toLocaleString('vi-VN')}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {task.status === 'failed' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleTaskAction('retry', task.id)}
                                  title="Chạy lại đơn này"
                                  className="h-7 w-7 p-0 text-blue-600 hover:bg-blue-50"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleTaskAction('delete', task.id)}
                                title="Xóa bản ghi"
                                className="h-7 w-7 p-0 text-zinc-400 hover:text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
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

      {/* Modal Thêm Đơn Thủ Công */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-zinc-900 flex items-center gap-2">
                <Plus className="h-5 w-5 text-red-600" />
                THÊM ĐƠN NETFLIX THỦ CÔNG
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-zinc-400 hover:text-zinc-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddManualTask} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-zinc-700">Email Cần Nhận Netflix 30 Ngày</Label>
                <Input
                  type="email"
                  required
                  placeholder="name@hotmail.com hoặc name@gmail.com"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  className="font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-zinc-700">Đơn Giá Ghi Nhận (VNĐ)</Label>
                <Input
                  type="number"
                  value={manualPrice}
                  onChange={(e) => setManualPrice(Number(e.target.value))}
                  placeholder="25000"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddModal(false)}
                  className="text-xs font-bold"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={addingTask}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-600/20"
                >
                  {addingTask ? 'Đang thêm...' : '⚡ Đưa Vào Hàng Chờ Ngay'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
