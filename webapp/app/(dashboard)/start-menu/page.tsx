'use client';

import { useState, useEffect } from 'react';
import {
  MessageSquare, Save, RefreshCw, Plus, Trash2, Edit3, MoveUp, MoveDown,
  ExternalLink, CheckCircle2, AlertCircle, Image as ImageIcon, Sparkles,
  Eye, HelpCircle, Layers, ToggleLeft, ToggleRight, ArrowRight, Smartphone,
  Zap, ListFilter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StartMenuConfig, StartMenuButton } from '@/app/api/start-menu/route';

const VARIABLE_CHIPS = [
  { code: '{name}', label: 'Tên người dùng', example: '@nguyenvana' },
  { code: '{username}', label: 'Username Telegram', example: '@nguyenvana' },
  { code: '{id}', label: 'ID Telegram', example: '123456789' },
  { code: '{balance}', label: 'Số dư tài khoản', example: '500.000 ₫' },
  { code: '{credit}', label: 'Điểm Credit', example: '100' },
  { code: '{shop_name}', label: 'Tên cửa hàng', example: 'DUCVIETSTORE' },
];

export const CALLBACK_PRESETS = [
  { code: 'list_categories', label: '🛒 Mở Danh Mục Sản Phẩm', defaultText: '🛒 Mua Sản Phẩm' },
  { code: 'deposit_select_bank', label: '💳 Nạp Tiền Ngân Hàng / QR Code', defaultText: '💳 Nạp Tiền Ngân Hàng' },
  { code: 'deposit_select_usdt', label: '💵 Nạp Tiền USDT (TRC20 / Bybit)', defaultText: '💵 Nạp Tiền USDT' },
  { code: 'gmail_edu_info', label: '📧 Mua Tài Khoản Gmail EDU', defaultText: '📧 Mua Gmail EDU' },
  { code: 'order_history', label: '🧾 Xem Lịch Sử Đơn Hàng Mua', defaultText: '🧾 Lịch Sử Đơn Hàng' },
  { code: 'capcut_start', label: '🎬 Tiện Ích CapCut Workspace Pro', defaultText: '🎬 CapCut Pro' },
  { code: 'dla', label: '⬇️ Download All (Tải Video/Ảnh/Audio)', defaultText: '⬇️ Tải Media' },
  { code: 'check_payment', label: '🔍 Kiểm Tra Trạng Thái Nạp Tiền', defaultText: '🔍 Check Nạp Tiền' },
  { code: 'back_to_menu', label: '↩️ Trở Về Menu Chính', defaultText: '↩️ Menu Chính' },
];

export default function StartMenuManagementPage() {
  const [config, setConfig] = useState<StartMenuConfig>({
    enabled: true,
    welcome_text: '',
    image_url: '',
    buttons: []
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal / Form state for Add/Edit Button
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingButton, setEditingButton] = useState<StartMenuButton | null>(null);
  const [btnText, setBtnText] = useState('');
  const [btnType, setBtnType] = useState<'url' | 'callback'>('url');
  const [btnUrl, setBtnUrl] = useState('');
  const [isCustomCallback, setIsCustomCallback] = useState(false);
  const [btnRow, setBtnRow] = useState<number>(1);
  const [btnActive, setBtnActive] = useState(true);

  // Fetch initial config
  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/start-menu');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      } else {
        showNotification('error', 'Không thể tải cấu hình menu /start');
      }
    } catch (e) {
      showNotification('error', 'Lỗi kết nối khi tải cấu hình');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Save config
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/start-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        showNotification('success', 'Lưu cấu hình /start thành công!');
      } else {
        showNotification('error', 'Lưu thất bại. Vui lòng thử lại!');
      }
    } catch (e) {
      showNotification('error', 'Lỗi mạng khi lưu cấu hình');
    } finally {
      setSaving(false);
    }
  };

  // Insert variable tag into welcome_text textarea
  const insertVariable = (tag: string) => {
    setConfig(prev => ({
      ...prev,
      welcome_text: (prev.welcome_text || '') + tag
    }));
  };

  // Open modal for new button
  const handleOpenAddModal = (preset?: { text: string; url?: string; callback_data?: string; type?: 'url' | 'callback' }) => {
    setEditingButton(null);
    setBtnText(preset?.text || '');
    const isCallback = preset?.type === 'callback' || Boolean(preset?.callback_data);
    setBtnType(isCallback ? 'callback' : 'url');
    const val = preset?.url || preset?.callback_data || '';
    setBtnUrl(val);
    setIsCustomCallback(isCallback && val ? !CALLBACK_PRESETS.some(p => p.code === val) : false);

    const maxRow = config.buttons.reduce((max, b) => Math.max(max, b.row || 1), 1);
    setBtnRow(maxRow);
    setBtnActive(true);
    setIsModalOpen(true);
  };

  // Open modal for editing button
  const handleOpenEditModal = (btn: StartMenuButton) => {
    setEditingButton(btn);
    setBtnText(btn.text);
    setBtnType(btn.type);
    const val = btn.type === 'url' ? (btn.url || '') : (btn.callback_data || btn.url || '');
    setBtnUrl(val);
    setIsCustomCallback(btn.type === 'callback' && Boolean(val) && !CALLBACK_PRESETS.some(p => p.code === val));
    setBtnRow(btn.row || 1);
    setBtnActive(btn.is_active);
    setIsModalOpen(true);
  };

  // Save button from modal
  const handleSaveButton = (e: React.FormEvent) => {
    e.preventDefault();
    if (!btnText.trim()) {
      alert('Vui lòng nhập tên nút bấm!');
      return;
    }
    if (btnType === 'url' && !btnUrl.trim()) {
      alert('Vui lòng nhập đường dẫn URL link!');
      return;
    }
    if (btnType === 'callback' && !btnUrl.trim()) {
      alert('Vui lòng chọn hoặc nhập mã Callback Data!');
      return;
    }

    if (editingButton) {
      // Edit existing button
      setConfig(prev => ({
        ...prev,
        buttons: prev.buttons.map(b => b.id === editingButton.id ? {
          ...b,
          text: btnText.trim(),
          type: btnType,
          url: btnType === 'url' ? btnUrl.trim() : undefined,
          callback_data: btnType === 'callback' ? btnUrl.trim() : undefined,
          row: btnRow,
          is_active: btnActive
        } : b)
      }));
    } else {
      // Add new button
      const newBtn: StartMenuButton = {
        id: 'btn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        text: btnText.trim(),
        type: btnType,
        url: btnType === 'url' ? btnUrl.trim() : undefined,
        callback_data: btnType === 'callback' ? btnUrl.trim() : undefined,
        row: btnRow,
        is_active: btnActive
      };
      setConfig(prev => ({
        ...prev,
        buttons: [...prev.buttons, newBtn]
      }));
    }

    setIsModalOpen(false);
  };

  // Delete button
  const handleDeleteButton = (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa nút bấm này?')) return;
    setConfig(prev => ({
      ...prev,
      buttons: prev.buttons.filter(b => b.id !== id)
    }));
  };

  // Toggle button active
  const handleToggleActive = (id: string) => {
    setConfig(prev => ({
      ...prev,
      buttons: prev.buttons.map(b => b.id === id ? { ...b, is_active: !b.is_active } : b)
    }));
  };

  // Move button row up/down
  const handleMoveRow = (id: string, delta: number) => {
    setConfig(prev => ({
      ...prev,
      buttons: prev.buttons.map(b => {
        if (b.id === id) {
          const newRow = Math.max(1, (b.row || 1) + delta);
          return { ...b, row: newRow };
        }
        return b;
      })
    }));
  };

  // Render markdown text formatted for Live Preview
  const renderPreviewText = (text: string) => {
    let formatted = text || '';
    formatted = formatted
      .replace(/\{name\}/g, '@nguyenvana')
      .replace(/\{username\}/g, '@nguyenvana')
      .replace(/\{id\}/g, '987654321')
      .replace(/\{balance\}/g, '500.000 ₫')
      .replace(/\{credit\}/g, '150')
      .replace(/\{shop_name\}/g, 'DUCVIETSTORE');

    return formatted;
  };

  // Group buttons by row for display & preview
  const groupedButtons = config.buttons.reduce((acc, btn) => {
    const r = btn.row || 1;
    if (!acc[r]) acc[r] = [];
    acc[r].push(btn);
    return acc;
  }, {} as Record<number, StartMenuButton[]>);

  const sortedRows = Object.keys(groupedButtons).map(Number).sort((a, b) => a - b);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-500">
          <RefreshCw className="animate-spin" size={24} />
          <span className="font-semibold text-sm">Đang tải cấu hình /start...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-white p-6 shadow-sm border border-zinc-200/80">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600">
            <MessageSquare size={26} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Cấu hình Menu /start</h1>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.enabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-zinc-100 text-zinc-600'}`}>
                <span className={`h-2 w-2 rounded-full ${config.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`} />
                {config.enabled ? 'Đang hoạt động' : 'Tắt'}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Tùy chỉnh lời nhắn chào mừng, hình ảnh header và quản lý danh sách nút bấm inline (Zalo, Telegram, Links) hiển thị khi người dùng khởi động Bot.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchConfig}
            className="border-zinc-200 text-zinc-700 hover:bg-zinc-100"
          >
            <RefreshCw size={15} className="mr-1.5" /> Tải lại
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="bg-orange-600 text-white hover:bg-orange-700 font-semibold shadow-sm"
          >
            <Save size={15} className="mr-1.5" />
            {saving ? 'Đang lưu...' : 'Lưu Cấu Hình'}
          </Button>
        </div>
      </div>

      {/* Notification toast */}
      {notification && (
        <div className={`flex items-center gap-3 rounded-xl p-4 text-sm font-medium transition-all ${
          notification.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 size={18} className="text-emerald-600" /> : <AlertCircle size={18} className="text-red-600" />}
          {notification.message}
        </div>
      )}

      {/* Main Grid: Left Settings & Right Telegram Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT COLUMN: Controls & Buttons Manager (7 cols) */}
        <div className="lg:col-span-7 space-y-6">

          {/* Card 1: Toggle & Welcome Message */}
          <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-orange-600" />
                <h2 className="font-bold text-zinc-900 text-sm uppercase tracking-wide">Nội dung Lời nhắn Chào mừng</h2>
              </div>
              <button
                type="button"
                onClick={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                className="flex items-center gap-2 text-xs font-semibold text-zinc-700 hover:text-zinc-900"
              >
                {config.enabled ? <ToggleRight size={28} className="text-orange-600" /> : <ToggleLeft size={28} className="text-zinc-400" />}
                {config.enabled ? 'Kích hoạt' : 'Vô hiệu'}
              </button>
            </div>

            {/* Header Image URL */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon size={14} className="text-zinc-500" />
                Hình ảnh Header (Tùy chọn Link URL)
              </label>
              <input
                type="url"
                value={config.image_url}
                onChange={e => setConfig(prev => ({ ...prev, image_url: e.target.value }))}
                placeholder="https://example.com/banner.jpg"
                className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-xs text-zinc-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all placeholder:text-zinc-400"
              />
              <p className="text-[11px] text-zinc-500">Nhập link ảnh banner để bot tự động gửi ảnh kèm caption chào mừng.</p>
            </div>

            {/* Welcome Textarea */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
                Văn bản chào mừng (Hỗ trợ Markdown)
              </label>

              {/* Variable Chips */}
              <div className="flex flex-wrap gap-1.5">
                {VARIABLE_CHIPS.map(chip => (
                  <button
                    key={chip.code}
                    type="button"
                    onClick={() => insertVariable(chip.code)}
                    title={`Thêm ${chip.label} (${chip.example})`}
                    className="inline-flex items-center gap-1 rounded-lg border border-orange-200 bg-orange-50/60 px-2.5 py-1 text-[11px] font-medium text-orange-800 hover:bg-orange-100 transition-colors"
                  >
                    <Plus size={11} /> {chip.code}
                  </button>
                ))}
              </div>

              <textarea
                rows={7}
                value={config.welcome_text}
                onChange={e => setConfig(prev => ({ ...prev, welcome_text: e.target.value }))}
                placeholder="Nhập nội dung chào mừng người dùng..."
                className="w-full rounded-xl border border-zinc-200 p-3.5 text-xs font-mono text-zinc-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
              />
            </div>
          </div>

          {/* Card 2: Inline Keyboard Buttons Manager */}
          <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Layers size={18} className="text-orange-600" />
                  <h2 className="font-bold text-zinc-900 text-sm uppercase tracking-wide">Quản lý Nút bấm Inline Keyboard</h2>
                </div>
                <p className="text-[11px] text-zinc-500 mt-0.5">Tự động gắn bên dưới tin nhắn /start (Link Zalo, Telegram, Website...)</p>
              </div>

              <Button
                size="sm"
                onClick={() => handleOpenAddModal()}
                className="bg-orange-600 text-white hover:bg-orange-700 text-xs font-semibold shadow-xs"
              >
                <Plus size={14} className="mr-1" /> Thêm Nút Bấm
              </Button>
            </div>

            {/* Quick Presets */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">Thêm nhanh các mẫu nút sẵn có:</span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleOpenAddModal({ text: '💬 Nhóm Zalo Hỗ Trợ', url: 'https://zalo.me/g/xxxx', type: 'url' })}
                  className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  + 💬 Nút Zalo
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenAddModal({ text: '📢 Kênh Telegram', url: 'https://t.me/xxxx', type: 'url' })}
                  className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-100 transition-colors"
                >
                  + 📢 Nút Telegram
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenAddModal({ text: '🌐 Website Link', url: 'https://myshop.com', type: 'url' })}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                >
                  + 🌐 Link Web
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenAddModal({ text: '🛒 Mua Sản Phẩm', callback_data: 'list_categories', type: 'callback' })}
                  className="inline-flex items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-700 hover:bg-orange-100 transition-colors"
                >
                  + 🛒 Nút Sản Phẩm
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenAddModal({ text: '💳 Nạp Tiền Ngân Hàng', callback_data: 'deposit_select_bank', type: 'callback' })}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors"
                >
                  + 💳 Nút Nạp Tiền
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenAddModal({ text: '📧 Mua Gmail EDU', callback_data: 'gmail_edu_info', type: 'callback' })}
                  className="inline-flex items-center gap-1 rounded-lg border border-purple-200 bg-purple-50 px-2 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition-colors"
                >
                  + 📧 Gmail EDU
                </button>
              </div>
            </div>

            {/* Button List Table grouped by row */}
            {config.buttons.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center space-y-2">
                <MessageSquare className="mx-auto text-zinc-400" size={32} />
                <p className="text-xs text-zinc-600 font-medium">Chưa có nút bấm nào được tạo.</p>
                <p className="text-[11px] text-zinc-400">Nhấn "+ Thêm Nút Bấm" hoặc các mẫu thêm nhanh phía trên để tạo nút Zalo, Telegram hoặc link bất kỳ.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sortedRows.map(rowNum => (
                  <div key={rowNum} className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] font-black uppercase text-zinc-500 tracking-wider">
                        📍 Hàng {rowNum} ({groupedButtons[rowNum]?.length || 0} nút)
                      </span>
                    </div>

                    <div className="space-y-2">
                      {groupedButtons[rowNum].map(btn => (
                        <div
                          key={btn.id}
                          className={`flex items-center justify-between rounded-xl bg-white p-3 border transition-all ${
                            btn.is_active ? 'border-zinc-200 shadow-2xs' : 'border-zinc-200/50 opacity-60 bg-zinc-100/50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 pr-2">
                            {/* Type Icon */}
                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                              btn.type === 'url' ? (
                                btn.text.includes('Zalo') ? 'bg-blue-100 text-blue-700' :
                                btn.text.includes('Telegram') ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700'
                              ) : 'bg-orange-100 text-orange-700'
                            }`}>
                              {btn.type === 'url' ? <ExternalLink size={14} /> : <Zap size={14} />}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-zinc-900 truncate">{btn.text}</span>
                                <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${btn.type === 'url' ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-orange-50 text-orange-700 border border-orange-200'}`}>
                                  {btn.type === 'url' ? 'URL Link' : 'Callback'}
                                </span>
                                {!btn.is_active && (
                                  <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-600">Ẩn</span>
                                )}
                              </div>
                              <p className="text-[11px] text-zinc-500 truncate font-mono mt-0.5">
                                {btn.type === 'url' ? (btn.url || 'Chưa có URL') : `Callback: ${btn.callback_data || btn.url}`}
                              </p>
                            </div>
                          </div>

                          {/* Control actions */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Toggle active */}
                            <button
                              type="button"
                              onClick={() => handleToggleActive(btn.id)}
                              title={btn.is_active ? 'Ẩn nút này' : 'Bật nút này'}
                              className={`p-1.5 rounded-lg border transition-colors ${
                                btn.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border-zinc-200 text-zinc-400 hover:bg-zinc-200'
                              }`}
                            >
                              <CheckCircle2 size={14} />
                            </button>

                            {/* Move Row */}
                            <button
                              type="button"
                              onClick={() => handleMoveRow(btn.id, -1)}
                              disabled={btn.row <= 1}
                              title="Chuyển lên hàng trên"
                              className="p-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-100 disabled:opacity-30"
                            >
                              <MoveUp size={14} />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleMoveRow(btn.id, 1)}
                              title="Chuyển xuống hàng dưới"
                              className="p-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-100"
                            >
                              <MoveDown size={14} />
                            </button>

                            {/* Edit */}
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(btn)}
                              title="Chỉnh sửa nút"
                              className="p-1.5 rounded-lg border border-zinc-200 text-blue-600 hover:bg-blue-50"
                            >
                              <Edit3 size={14} />
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => handleDeleteButton(btn.id)}
                              title="Xóa nút"
                              className="p-1.5 rounded-lg border border-zinc-200 text-red-600 hover:bg-red-50"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Live Telegram Chat Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="sticky top-6 rounded-2xl border border-zinc-800 bg-[#17212b] p-5 text-white shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-700/60 pb-3">
              <div className="flex items-center gap-2">
                <Smartphone size={18} className="text-sky-400" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-zinc-200">Xem Trước Giao Diện Telegram</h3>
              </div>
              <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-extrabold text-sky-400">
                LIVE PREVIEW
              </span>
            </div>

            {/* Telegram Chat Container */}
            <div className="rounded-xl bg-[#0e1621] p-4 space-y-3 font-sans text-xs">

              {/* Bot Header */}
              <div className="flex items-center gap-3 pb-2 border-b border-zinc-800/80">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-600 text-white font-black text-sm">
                  B
                </div>
                <div>
                  <h4 className="font-bold text-sm text-zinc-100">Telegram Bot</h4>
                  <p className="text-[10px] text-sky-400 font-semibold">bot • trực tuyến</p>
                </div>
              </div>

              {/* User message /start */}
              <div className="flex justify-end">
                <div className="rounded-2xl rounded-tr-xs bg-[#2b5278] px-3.5 py-2 text-zinc-100 text-xs shadow-xs">
                  /start
                </div>
              </div>

              {/* Bot Welcome Response Bubble */}
              <div className="space-y-2">
                <div className="rounded-2xl rounded-tl-xs bg-[#182533] p-3 text-zinc-200 shadow-sm border border-zinc-800/80 space-y-2 max-w-[90%]">
                  {/* Optional Image */}
                  {config.image_url && (
                    <div className="relative overflow-hidden rounded-lg bg-zinc-800">
                      <img
                        src={config.image_url}
                        alt="Header Banner"
                        className="w-full h-36 object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}

                  {/* Formatted Text */}
                  <div className="whitespace-pre-wrap leading-relaxed text-zinc-200 font-sans text-xs">
                    {renderPreviewText(config.welcome_text)}
                  </div>
                </div>

                {/* Inline Buttons Grid Preview */}
                {sortedRows.length > 0 && (
                  <div className="space-y-1.5 max-w-[90%]">
                    {sortedRows.map(rowNum => {
                      const activeRowBtns = (groupedButtons[rowNum] || []).filter(b => b.is_active);
                      if (activeRowBtns.length === 0) return null;

                      return (
                        <div key={rowNum} className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${activeRowBtns.length}, minmax(0, 1fr))` }}>
                          {activeRowBtns.map(btn => (
                            <a
                              key={btn.id}
                              href={btn.type === 'url' ? (btn.url || '#') : '#'}
                              onClick={(e) => { if (btn.type === 'callback') e.preventDefault(); }}
                              target={btn.type === 'url' ? "_blank" : undefined}
                              rel="noreferrer"
                              className="flex items-center justify-center gap-1.5 rounded-xl bg-[#2b5278]/60 hover:bg-[#2b5278] border border-[#2b5278] px-3 py-2 text-center text-xs font-semibold text-sky-200 transition-colors truncate"
                            >
                              <span className="truncate">{btn.text}</span>
                              {btn.type === 'url' ? <ExternalLink size={11} className="shrink-0 opacity-70" /> : <Zap size={11} className="shrink-0 opacity-70 text-orange-400" />}
                            </a>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>

              {/* Fixed Bottom Main Keyboard Preview */}
              <div className="pt-3 border-t border-zinc-800/80 space-y-1.5">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider text-center">Bàn phím chính dưới chat</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="rounded-lg bg-[#242f3d] py-2 text-center font-semibold text-[11px] text-zinc-300">
                    💳 Nạp tiền
                  </div>
                  <div className="rounded-lg bg-[#242f3d] py-2 text-center font-semibold text-[11px] text-zinc-300">
                    🛒 Menu Mua Hàng
                  </div>
                  <div className="rounded-lg bg-[#242f3d] py-2 text-center font-semibold text-[11px] text-zinc-300">
                    🎁 Điểm danh
                  </div>
                  <div className="rounded-lg bg-[#242f3d] py-2 text-center font-semibold text-[11px] text-zinc-300">
                    💬 Hỗ trợ
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>

      {/* Modal Add/Edit Button */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl space-y-4 border border-zinc-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="font-bold text-base text-zinc-900">
                {editingButton ? 'Chỉnh Sửa Nút Bấm' : 'Thêm Nút Bấm Mới'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveButton} className="space-y-4">
              {/* Button Text */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-zinc-700">Tên Nút Bấm (Hiển thị & Emoji)</label>
                <input
                  type="text"
                  value={btnText}
                  onChange={e => setBtnText(e.target.value)}
                  placeholder="Ví dụ: 💬 Nhóm Zalo Hỗ Trợ"
                  className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-xs text-zinc-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                  required
                />
              </div>

              {/* Type */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-zinc-700">Loại Nút Bấm</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBtnType('url');
                      setIsCustomCallback(false);
                    }}
                    className={`rounded-xl border p-2.5 text-xs font-semibold transition-all ${
                      btnType === 'url' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                    }`}
                  >
                    🔗 Link URL (Mở Trang)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBtnType('callback')}
                    className={`rounded-xl border p-2.5 text-xs font-semibold transition-all ${
                      btnType === 'callback' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                    }`}
                  >
                    ⚡ Callback (Hành Động Bot)
                  </button>
                </div>
              </div>

              {/* Target Link URL vs Callback List */}
              {btnType === 'url' ? (
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-zinc-700">
                    Đường Dẫn Link URL (Zalo, Telegram, Website...)
                  </label>
                  <input
                    type="text"
                    value={btnUrl}
                    onChange={e => setBtnUrl(e.target.value)}
                    placeholder="https://zalo.me/g/xxxx hoặc https://t.me/xxxx"
                    className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-xs font-mono text-zinc-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                    required
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-zinc-700 flex items-center gap-1">
                      <ListFilter size={14} className="text-orange-600" />
                      Chọn Mã Callback Data (Hành Động)
                    </label>
                    <select
                      value={isCustomCallback ? 'custom' : (CALLBACK_PRESETS.some(p => p.code === btnUrl) ? btnUrl : (btnUrl ? 'custom' : ''))}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'custom') {
                          setIsCustomCallback(true);
                          setBtnUrl('');
                        } else {
                          setIsCustomCallback(false);
                          setBtnUrl(val);
                          const presetObj = CALLBACK_PRESETS.find(p => p.code === val);
                          if (presetObj && (!btnText || btnText.trim() === '')) {
                            setBtnText(presetObj.defaultText);
                          }
                        }
                      }}
                      className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-xs text-zinc-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none bg-white font-medium"
                    >
                      <option value="">-- Bấm để chọn danh sách Callback có sẵn --</option>
                      {CALLBACK_PRESETS.map(preset => (
                        <option key={preset.code} value={preset.code}>
                          {preset.label} [{preset.code}]
                        </option>
                      ))}
                      <option value="custom">✏️ Mã tùy chỉnh khác (Nhập thủ công)...</option>
                    </select>
                  </div>

                  {/* Manual Callback String input if custom or selected */}
                  {(isCustomCallback || (!CALLBACK_PRESETS.some(p => p.code === btnUrl) && btnUrl !== '')) && (
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-zinc-600">Nhập mã Callback Data thủ công:</label>
                      <input
                        type="text"
                        value={btnUrl}
                        onChange={e => setBtnUrl(e.target.value)}
                        placeholder="Nhập chuỗi callback_data..."
                        className="w-full rounded-xl border border-orange-300 bg-orange-50/40 px-3.5 py-2 text-xs font-mono text-zinc-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                        required
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Row & Active */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-zinc-700">Hàng Hiển Thị (Row)</label>
                  <select
                    value={btnRow}
                    onChange={e => setBtnRow(Number(e.target.value))}
                    className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-xs text-zinc-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                  >
                    <option value={1}>Hàng 1</option>
                    <option value={2}>Hàng 2</option>
                    <option value={3}>Hàng 3</option>
                    <option value={4}>Hàng 4</option>
                    <option value={5}>Hàng 5</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-zinc-700">Trạng Thái</label>
                  <button
                    type="button"
                    onClick={() => setBtnActive(!btnActive)}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-bold transition-all ${
                      btnActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-zinc-200 bg-zinc-100 text-zinc-500'
                    }`}
                  >
                    {btnActive ? '✓ Đang Bật' : '✕ Đang Ẩn'}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                >
                  Hủy Bỏ
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-orange-600 text-white hover:bg-orange-700 font-semibold"
                >
                  {editingButton ? 'Cập Nhật' : 'Thêm Nút'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
