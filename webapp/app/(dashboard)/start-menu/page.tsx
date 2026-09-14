'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  MessageSquare, Save, RefreshCw, Plus, Trash2, Edit3, MoveUp, MoveDown,
  ExternalLink, CheckCircle2, AlertCircle, Image as ImageIcon, Sparkles,
  Eye, HelpCircle, Layers, ToggleLeft, ToggleRight, ArrowRight, Smartphone,
  Zap, ListFilter, Keyboard, CreditCard, ShoppingBag, ShieldCheck, Key, FileText,
  Copy, Globe, ArrowLeft, ArrowUpRight, Languages, Bell
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StartMenuConfig, StartMenuButton } from '@/app/api/start-menu/route';
import { MainKeyboardButton, BotMenuInlineButton } from '@/app/api/bot-templates/route';
import Link from 'next/link';

const START_VARIABLE_CHIPS = [
  { code: '{name}', label: 'Tên người dùng', example: '@nguyenvana' },
  { code: '{username}', label: 'Username Telegram', example: '@nguyenvana' },
  { code: '{id}', label: 'ID Telegram', example: '123456789' },
  { code: '{balance}', label: 'Số dư tài khoản', example: '500.000 ₫' },
  { code: '{credit}', label: 'Điểm Credit', example: '100' },
  { code: '{shop_name}', label: 'Tên cửa hàng', example: 'DUCVIETSTORE' },
];

export const CALLBACK_PRESETS = [
  { code: 'list_categories', label: '🛍️ Mở Danh Mục / Mua Sản Phẩm', defaultText: 'Sản Phẩm', defaultTextEn: 'Products', defaultTextZh: '产品' },
  { code: 'wallet_info', label: '👛 Thông Tin Ví & Số Dư', defaultText: 'Ví & Nạp Tiền', defaultTextEn: 'Wallet & Deposit', defaultTextZh: '钱包与充值' },
  { code: 'start_deposit', label: '➕ Nạp Tiền Vào Ví (Menu Chọn Phương Thức)', defaultText: 'Nạp Tiền', defaultTextEn: 'Deposit', defaultTextZh: '充值' },
  { code: 'deposit_select_bank', label: '💳 Nạp Tiền Ngân Hàng / VietQR Tự Động', defaultText: 'Nạp Ngân Hàng', defaultTextEn: 'Bank Deposit', defaultTextZh: '银行转账' },
  { code: 'deposit_select_binance', label: '🟡 Nạp Tiền Binance Pay (Tự Động 10s)', defaultText: 'Nạp Binance Pay', defaultTextEn: 'Binance Pay', defaultTextZh: '币安支付' },
  { code: 'check_binance_payment', label: '🟡 Kiểm Tra Nạp Binance Pay', defaultText: 'Check Binance', defaultTextEn: 'Check Binance', defaultTextZh: '检查币安' },
  { code: 'check_recent_trc20', label: '💵 Kiểm Tra Nạp USDT TRC20', defaultText: 'Check USDT', defaultTextEn: 'Check USDT', defaultTextZh: '检查 USDT' },
  { code: 'back_to_menu', label: '↩️ Trở Về Menu Chính', defaultText: 'Menu Chính', defaultTextEn: 'Main Menu', defaultTextZh: '主菜单' },
];

export const WALLET_CALLBACK_PRESETS = [
  { code: 'start_deposit', label: '➕ Nạp Tiền Vào Ví', defaultText: 'Nạp tiền vào ví', defaultTextEn: 'Deposit Funds', defaultTextZh: '充值到钱包' },
  { code: 'deposit_history', label: '🧾 Lịch Sử Nạp Tiền', defaultText: 'Lịch sử nạp tiền', defaultTextEn: 'Deposit History', defaultTextZh: '充值记录' },
  { code: 'list_categories', label: '🛍️ Danh Mục Sản Phẩm', defaultText: 'Danh mục sản phẩm', defaultTextEn: 'View Products', defaultTextZh: '查看商品分类' },
  { code: 'support_info', label: '💬 Hỗ Trợ CSKH', defaultText: 'Hỗ trợ CSKH', defaultTextEn: 'Live Support', defaultTextZh: '客服支持' },
  { code: 'warranty_info', label: '🛡️ Bảo Hành', defaultText: 'Bảo hành', defaultTextEn: 'Warranty', defaultTextZh: '售后保修' },
  { code: 'api_info', label: '🔗 Kết Nối API', defaultText: 'API', defaultTextEn: 'API', defaultTextZh: 'API' },
  { code: 'back_to_menu', label: '↩️ Menu Chính', defaultText: 'Menu Chính', defaultTextEn: 'Main Menu', defaultTextZh: '主菜单' }
];

export const DEPOSIT_CALLBACK_PRESETS = [
  { code: 'deposit_select_bank', label: '🏦 Ngân Hàng (Bank / VietQR)', defaultText: 'Ngân hàng (Bank)', defaultTextEn: 'Bank Transfer', defaultTextZh: '银行转账' },
  { code: 'deposit_select_binance', label: '🟡 Binance Pay (Tự Động)', defaultText: 'Binance Pay (Tự động)', defaultTextEn: 'Binance Pay (Auto)', defaultTextZh: '币安支付 (自动)' },
  { code: 'deposit_select_usdt', label: '💲 USDT TRC20 (Binance Check)', defaultText: 'USDT TRC20', defaultTextEn: 'USDT TRC20', defaultTextZh: 'USDT TRC20' },
  { code: 'deposit_history', label: '🧾 Xem Lịch Sử Nạp Tiền', defaultText: 'Lịch sử nạp', defaultTextEn: 'Deposit History', defaultTextZh: '充值记录' },
  { code: 'wallet_info', label: '👛 Quay Lại Ví & Số Dư', defaultText: 'Ví & Số Dư', defaultTextEn: 'Wallet Balance', defaultTextZh: '钱包余额' },
  { code: 'check_payment', label: '🔍 Check Nạp Tiền Bank', defaultText: 'Check Bank', defaultTextEn: 'Check Bank', defaultTextZh: '检查银行' },
  { code: 'check_binance_payment', label: '🟡 Check Binance Pay', defaultText: 'Check Binance', defaultTextEn: 'Check Binance', defaultTextZh: '检查币安' },
  { code: 'check_recent_trc20', label: '💵 Check USDT TRC20', defaultText: 'Check USDT', defaultTextEn: 'Check USDT', defaultTextZh: '检查 USDT' },
  { code: 'back_to_menu', label: '↩️ Menu Chính', defaultText: 'Menu Chính', defaultTextEn: 'Main Menu', defaultTextZh: '主菜单' }
];

export const KEYBOARD_ACTION_PRESETS = [
  { code: 'products', label: '🛍️ Mở Danh Mục / Mua Sản Phẩm', defaultVi: 'Sản phẩm', defaultEn: 'Products', defaultZh: '产品' },
  { code: 'support', label: '💬 Chat Hỗ Trợ Kỹ Thuật (Live Support)', defaultVi: 'Hỗ trợ', defaultEn: 'Support', defaultZh: '客服支持' },
  { code: 'wallet', label: '👛 Thông Tin Ví & Số Dư', defaultVi: 'Ví', defaultEn: 'Wallet', defaultZh: '钱包' },
  { code: 'deposit', label: '➕ Menu Nạp Tiền (Bank / Binance / USDT)', defaultVi: 'Nạp tiền', defaultEn: 'Deposit', defaultZh: '充值' },
  { code: 'api', label: '🔗 Thông Tin Kết Nối API', defaultVi: 'API', defaultEn: 'API', defaultZh: 'API' },
  { code: 'warranty', label: '🛡️ Trung Tâm Bảo Hành', defaultVi: 'Bảo hành', defaultEn: 'Warranty', defaultZh: '售后保修' },
  { code: 'history', label: '📦 Lịch Sử Đơn Hàng Mua', defaultVi: 'Lịch sử mua', defaultEn: 'History', defaultZh: '购买记录' },
  { code: 'checkin', label: '🎁 Điểm Danh Nhận Thưởng', defaultVi: 'Điểm danh', defaultEn: 'Check-in', defaultZh: '每日签到' },
  { code: 'lang', label: '🌐 Đổi Ngôn Ngữ (VI/EN/ZH)', defaultVi: 'Ngôn ngữ', defaultEn: 'Language', defaultZh: '语言切换' },
  { code: 'start', label: '🏠 Menu Chính /start', defaultVi: 'Menu chính', defaultEn: 'Main Menu', defaultZh: '主菜单' },
  { code: 'custom_text', label: '📝 Gửi Tin Nhắn Mẫu (Custom Text)', defaultVi: 'Thông tin', defaultEn: 'Information', defaultZh: '信息' },
];

export const ANIMATED_EMOJIS = [
  { id: '5201732344993576400', label: '🟡 Binance Pay Logo' },
  { id: '6181477641489488618', label: '👤 ID Khách Hàng' },
  { id: '5204021180310252946', label: '💱 Tỷ Giá Quy Đổi' },
  { id: '5202112453894238347', label: '📥 Nạp Tối Thiểu' },
  { id: '6228570454651572625', label: '💳 Thông Tin Chuyển Tiền' },
  { id: '5204082134486117389', label: '⚠️ Lưu Ý Quan Trọng' },
  { id: '5375135722514685501', label: '🔥 Hot / Flash Sale' },
  { id: '5375135722514685502', label: '⭐ Premium Star' },
];

export default function BotCustomizationPage() {
  const [activeTab, setActiveTab] = useState<'keyboard' | 'start_menu' | 'inline_buttons' | 'deposit_templates' | 'order_templates' | 'service_templates' | 'notify_templates'>('keyboard');
  const [inlineGroupFilter, setInlineGroupFilter] = useState<'all' | 'start' | 'wallet' | 'deposit' | 'deposit_flow' | 'shop_flow' | 'order_download' | 'service_other'>('all');
  const [inlinePreviewTab, setInlinePreviewTab] = useState<'start' | 'wallet' | 'deposit' | 'deposit_flow' | 'shop_flow' | 'delivery_flow'>('wallet');
  const [previewLang, setPreviewLang] = useState<'vi' | 'en' | 'zh'>('vi');
  const [templateEditLang, setTemplateEditLang] = useState<'vi' | 'en' | 'zh'>('vi');
  const [startTextLang, setStartTextLang] = useState<'vi' | 'en' | 'zh'>('vi');

  // Start Menu State
  const [startConfig, setStartConfig] = useState<StartMenuConfig>({
    enabled: true,
    welcome_text: '',
    welcome_text_vi: '',
    welcome_text_en: '',
    welcome_text_zh: '',
    image_url: '',
    buttons: []
  });

  // Reply Keyboard & Templates State
  const [mainKeyboard, setMainKeyboard] = useState<MainKeyboardButton[]>([]);
  const [walletButtons, setWalletButtons] = useState<BotMenuInlineButton[]>([
    { id: 'btn_wal_deposit', text: 'Nạp tiền vào ví', text_vi: 'Nạp tiền vào ví', text_en: 'Deposit Funds', text_zh: '充值到钱包', type: 'callback', callback_data: 'start_deposit', row: 1, is_active: true },
    { id: 'btn_wal_history', text: 'Lịch sử nạp tiền', text_vi: 'Lịch sử nạp tiền', text_en: 'Deposit History', text_zh: '充值记录', type: 'callback', callback_data: 'deposit_history', row: 1, is_active: true },
    { id: 'btn_wal_products', text: 'Danh mục sản phẩm', text_vi: 'Danh mục sản phẩm', text_en: 'View Products', text_zh: '查看商品分类', type: 'callback', callback_data: 'list_categories', row: 2, is_active: true }
  ]);
  const [depositButtons, setDepositButtons] = useState<BotMenuInlineButton[]>([
    { id: 'btn_dep_bank', text: 'Ngân hàng (Bank)', text_vi: 'Ngân hàng (Bank)', text_en: 'Bank Transfer', text_zh: '银行转账', type: 'callback', callback_data: 'deposit_select_bank', row: 1, is_active: true },
    { id: 'btn_dep_binance', text: 'Binance Pay (Tự động)', text_vi: 'Binance Pay (Tự động)', text_en: 'Binance Pay (Auto)', text_zh: '币安支付 (自动)', type: 'callback', callback_data: 'deposit_select_binance', row: 2, is_active: true },
    { id: 'btn_dep_usdt', text: 'USDT TRC20', text_vi: 'USDT TRC20', text_en: 'USDT TRC20', text_zh: 'USDT TRC20', type: 'callback', callback_data: 'deposit_select_usdt', row: 3, is_active: true }
  ]);
  const [templates, setTemplates] = useState<Record<string, { label: string; group: string; description: string; vars: string[]; value: string; value_vi?: string; value_en?: string; value_zh?: string }>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal / Form state for Keyboard Button Add/Edit
  const [isKbModalOpen, setIsKbModalOpen] = useState(false);
  const [editingKbBtn, setEditingKbBtn] = useState<MainKeyboardButton | null>(null);
  const [kbBtnTextVi, setKbBtnTextVi] = useState('');
  const [kbBtnTextEn, setKbBtnTextEn] = useState('');
  const [kbBtnTextZh, setKbBtnTextZh] = useState('');
  const [kbBtnAction, setKbBtnAction] = useState<any>('products');
  const [kbBtnCustomText, setKbBtnCustomText] = useState('');
  const [kbBtnCustomTextVi, setKbBtnCustomTextVi] = useState('');
  const [kbBtnCustomTextEn, setKbBtnCustomTextEn] = useState('');
  const [kbBtnCustomTextZh, setKbBtnCustomTextZh] = useState('');
  const [kbBtnRow, setKbBtnRow] = useState<number>(1);
  const [kbBtnActive, setKbBtnActive] = useState(true);

  // Modal / Form state for Inline Buttons (Start / Wallet / Deposit)
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [inlineModalTarget, setInlineModalTarget] = useState<'start' | 'wallet' | 'deposit'>('start');
  const [editingStartBtn, setEditingStartBtn] = useState<StartMenuButton | BotMenuInlineButton | null>(null);
  const [startBtnTextVi, setStartBtnTextVi] = useState('');
  const [startBtnTextEn, setStartBtnTextEn] = useState('');
  const [startBtnTextZh, setStartBtnTextZh] = useState('');
  const [startBtnType, setStartBtnType] = useState<'url' | 'callback'>('url');
  const [startBtnUrl, setStartBtnUrl] = useState('');
  const [isCustomCallback, setIsCustomCallback] = useState(false);
  const [startBtnRow, setStartBtnRow] = useState<number>(1);
  const [startBtnActive, setStartBtnActive] = useState(true);

  // Selected Template for editing
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>('template_binance_pay');

  // Categories & Products for quick button presets
  const [categories, setCategories] = useState<{ id: number; name: string; emoji?: string }[]>([]);
  const [products, setProducts] = useState<{ id: number; name: string; category_id?: number; price?: number }[]>([]);

  // Fetch all data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [startRes, botRes, catRes, prodRes] = await Promise.all([
        fetch('/api/start-menu'),
        fetch('/api/bot-templates'),
        fetch('/api/categories'),
        fetch('/api/products')
      ]);

      if (startRes.ok) {
        const startData = await startRes.json();
        setStartConfig(startData);
      }

      if (botRes.ok) {
        const botData = await botRes.json();
        if (botData.main_keyboard) setMainKeyboard(botData.main_keyboard);
        if (botData.wallet_buttons) setWalletButtons(botData.wallet_buttons);
        if (botData.deposit_buttons) setDepositButtons(botData.deposit_buttons);
        if (botData.templates) setTemplates(botData.templates);
      }

      if (catRes.ok) {
        const catData = await catRes.json();
        if (Array.isArray(catData)) setCategories(catData);
      }

      if (prodRes.ok) {
        const prodData = await prodRes.json();
        const pList = Array.isArray(prodData) ? prodData : (prodData.products || []);
        setProducts(pList);
      }
    } catch (e) {
      showNotification('error', 'Lỗi kết nối khi tải cấu hình');
    } finally {
      setLoading(false);
    }
  };

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchData();
  }, []);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4500);
  };

  // Save all changes
  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const templatesToSave: Record<string, string> = {};
      Object.entries(templates).forEach(([k, item]) => {
        templatesToSave[k] = item.value_vi || item.value || '';
        templatesToSave[`${k}_en`] = item.value_en || '';
        templatesToSave[`${k}_zh`] = item.value_zh || '';
      });

      const [startRes, botRes] = await Promise.all([
        fetch('/api/start-menu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(startConfig)
        }),
        fetch('/api/bot-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            main_keyboard: mainKeyboard,
            wallet_buttons: walletButtons,
            deposit_buttons: depositButtons,
            templates: templatesToSave
          })
        })
      ]);

      if (startRes.ok && botRes.ok) {
        showNotification('success', 'Lưu toàn bộ nút bấm & nội dung đa ngôn ngữ Bot thành công!');
      } else {
        showNotification('error', 'Lưu thất bại. Vui lòng kiểm tra lại!');
      }
    } catch (e) {
      showNotification('error', 'Lỗi mạng khi lưu');
    } finally {
      setSaving(false);
    }
  };

  // Keyboard Button Handlers
  const handleOpenAddKbModal = () => {
    setEditingKbBtn(null);
    setKbBtnTextVi('Sản phẩm');
    setKbBtnTextEn('Products');
    setKbBtnTextZh('产品');
    setKbBtnAction('products');
    setKbBtnCustomText('');
    setKbBtnCustomTextVi('');
    setKbBtnCustomTextEn('');
    setKbBtnCustomTextZh('');
    const maxRow = mainKeyboard.reduce((max, b) => Math.max(max, b.row || 1), 1);
    setKbBtnRow(maxRow);
    setKbBtnActive(true);
    setIsKbModalOpen(true);
  };

  const handleOpenEditKbModal = (btn: MainKeyboardButton) => {
    setEditingKbBtn(btn);
    setKbBtnTextVi(btn.text_vi || btn.text || '');
    setKbBtnTextEn(btn.text_en || '');
    setKbBtnTextZh(btn.text_zh || '');
    setKbBtnAction(btn.action || 'products');
    const customVi = btn.custom_text_vi || btn.custom_text || '';
    setKbBtnCustomText(customVi);
    setKbBtnCustomTextVi(customVi);
    setKbBtnCustomTextEn(btn.custom_text_en || '');
    setKbBtnCustomTextZh(btn.custom_text_zh || '');
    setKbBtnRow(btn.row || 1);
    setKbBtnActive(btn.is_active !== false);
    setIsKbModalOpen(true);
  };

  const handleSaveKbButton = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kbBtnTextVi.trim()) {
      alert('Vui lòng nhập tên nút bấm Tiếng Việt!');
      return;
    }

    const primaryText = kbBtnTextVi.trim();
    const textEn = kbBtnTextEn.trim() || primaryText;
    const textZh = kbBtnTextZh.trim() || primaryText;
    const customVi = kbBtnCustomTextVi.trim() || kbBtnCustomText.trim();
    const customEn = kbBtnCustomTextEn.trim() || customVi;
    const customZh = kbBtnCustomTextZh.trim() || customVi;

    if (editingKbBtn) {
      setMainKeyboard(prev =>
        prev.map(b =>
          b.id === editingKbBtn.id
            ? {
                ...b,
                text: primaryText,
                text_vi: primaryText,
                text_en: textEn,
                text_zh: textZh,
                action: kbBtnAction,
                custom_text: customVi,
                custom_text_vi: customVi,
                custom_text_en: customEn,
                custom_text_zh: customZh,
                row: Number(kbBtnRow) || 1,
                is_active: kbBtnActive
              }
            : b
        )
      );
    } else {
      const newBtn: MainKeyboardButton = {
        id: `btn_${Date.now()}`,
        text: primaryText,
        text_vi: primaryText,
        text_en: textEn,
        text_zh: textZh,
        action: kbBtnAction,
        custom_text: customVi,
        custom_text_vi: customVi,
        custom_text_en: customEn,
        custom_text_zh: customZh,
        row: Number(kbBtnRow) || 1,
        is_active: kbBtnActive
      };
      setMainKeyboard(prev => [...prev, newBtn]);
    }
    setIsKbModalOpen(false);
  };

  const handleDeleteKbBtn = (id: string) => {
    if (confirm('Bạn có chắc muốn xoá nút bấm này khỏi Bàn phím chính?')) {
      setMainKeyboard(prev => prev.filter(b => b.id !== id));
    }
  };

  const handleToggleKbBtn = (id: string) => {
    setMainKeyboard(prev =>
      prev.map(b => b.id === id ? { ...b, is_active: !b.is_active } : b)
    );
  };

  const handleMoveKbRow = (id: string, delta: number) => {
    setMainKeyboard(prev =>
      prev.map(b => {
        if (b.id === id) {
          const nextRow = Math.max(1, (b.row || 1) + delta);
          return { ...b, row: nextRow };
        }
        return b;
      })
    );
  };

  const handleQuickAddKbPreset = (preset: { defaultVi: string; defaultEn: string; defaultZh: string; code: any; label: string }) => {
    const maxRow = mainKeyboard.length > 0 ? Math.max(...mainKeyboard.map(b => b.row || 1)) : 1;
    const newBtn: MainKeyboardButton = {
      id: `btn_${preset.code}_${Date.now()}`,
      text: preset.defaultVi,
      text_vi: preset.defaultVi,
      text_en: preset.defaultEn,
      text_zh: preset.defaultZh,
      action: preset.code,
      row: maxRow,
      is_active: true
    };
    setMainKeyboard(prev => [...prev, newBtn]);
    showNotification('success', `Đã thêm nút "${preset.defaultVi}" vào Bàn phím!`);
  };

  const handleResetKbToDefault = () => {
    if (confirm('Khôi phục bàn phím về cấu hình 5 nút chuẩn (Sản phẩm, Hỗ trợ, Ví, API, Bảo hành)?')) {
      setMainKeyboard([
        { id: 'btn_products', text: 'Sản phẩm', text_vi: 'Sản phẩm', text_en: 'Products', text_zh: '产品', action: 'products', row: 1, is_active: true },
        { id: 'btn_support', text: 'Hỗ trợ', text_vi: 'Hỗ trợ', text_en: 'Support', text_zh: '客服支持', action: 'support', row: 1, is_active: true },
        { id: 'btn_wallet', text: 'Ví', text_vi: 'Ví', text_en: 'Wallet', text_zh: '钱包', action: 'wallet', row: 2, is_active: true },
        { id: 'btn_api', text: 'API', text_vi: 'API', text_en: 'API', text_zh: 'API', action: 'api', row: 2, is_active: true },
        { id: 'btn_warranty', text: 'Bảo hành', text_vi: 'Bảo hành', text_en: 'Warranty', text_zh: '售后保修', action: 'warranty', row: 3, is_active: true }
      ]);
      showNotification('success', 'Đã khôi phục bàn phím về chuẩn 5 nút!');
    }
  };

  const handleQuickAddStartPreset = (preset: { defaultText: string; defaultTextEn?: string; defaultTextZh?: string; code?: string; url?: string; label: string; type?: 'url' | 'callback' }) => {
    const maxRow = startConfig.buttons.length > 0 ? Math.max(...startConfig.buttons.map(b => b.row || 1)) : 1;
    const newBtn: StartMenuButton = {
      id: `btn_${preset.code || 'link'}_${Date.now()}`,
      text: preset.defaultText,
      text_vi: preset.defaultText,
      text_en: preset.defaultTextEn || preset.defaultText,
      text_zh: preset.defaultTextZh || preset.defaultText,
      type: preset.url ? 'url' : 'callback',
      callback_data: preset.code,
      url: preset.url,
      row: maxRow,
      is_active: true
    };
    setStartConfig(prev => ({
      ...prev,
      buttons: [...prev.buttons, newBtn]
    }));
    showNotification('success', `Đã thêm nút Inline "${preset.defaultText}" vào tin nhắn /start!`);
  };

  const handleResetStartButtonsToDefault = () => {
    if (confirm('Khôi phục danh sách nút Inline /start về bộ mẫu tiêu chuẩn?')) {
      setStartConfig(prev => ({
        ...prev,
        buttons: [
          { id: 'btn_cat', text: '🛍️ Sản Phẩm', text_vi: '🛍️ Sản Phẩm', text_en: '🛍️ Products', text_zh: '🛍️ 产品', type: 'callback', callback_data: 'list_categories', row: 1, is_active: true },
          { id: 'btn_wal', text: '👛 Ví & Nạp Tiền', text_vi: '👛 Ví & Nạp Tiền', text_en: '👛 Wallet & Top Up', text_zh: '👛 钱包与充值', type: 'callback', callback_data: 'wallet_info', row: 1, is_active: true },
          { id: 'btn_sup', text: '💬 Hỗ Trợ CSKH', text_vi: '💬 Hỗ Trợ CSKH', text_en: '💬 Customer Support', text_zh: '💬 客服支持', type: 'callback', callback_data: 'support_info', row: 2, is_active: true },
          { id: 'btn_war', text: '🛡️ Bảo Hành', text_vi: '🛡️ Bảo Hành', text_en: '🛡️ Warranty', text_zh: '🛡️ 售后保修', type: 'callback', callback_data: 'warranty_info', row: 2, is_active: true },
          { id: 'btn_tele', text: '📢 Kênh Telegram Update', text_vi: '📢 Kênh Telegram Update', text_en: '📢 Telegram Channel', text_zh: '📢 官方更新频道', type: 'url', url: 'https://t.me', row: 3, is_active: true }
        ]
      }));
      showNotification('success', 'Đã khôi phục các nút Inline /start tiêu chuẩn!');
    }
  };

  const getButtonLabelForLang = (btn: MainKeyboardButton, lang: 'vi' | 'en' | 'zh') => {
    if (lang === 'en') return btn.text_en || btn.text || btn.text_vi || '';
    if (lang === 'zh') return btn.text_zh || btn.text || btn.text_vi || '';
    return btn.text_vi || btn.text || '';
  };

  const getStartButtonLabelForLang = (btn: StartMenuButton | BotMenuInlineButton, lang: 'vi' | 'en' | 'zh') => {
    if (lang === 'en') return btn.text_en || btn.text || btn.text_vi || '';
    if (lang === 'zh') return btn.text_zh || btn.text || btn.text_vi || '';
    return btn.text_vi || btn.text || '';
  };

  const getStartTextForLang = (lang: 'vi' | 'en' | 'zh') => {
    if (lang === 'en') return startConfig.welcome_text_en || '';
    if (lang === 'zh') return startConfig.welcome_text_zh || '';
    return startConfig.welcome_text_vi || startConfig.welcome_text || '';
  };

  const setStartTextForLang = (lang: 'vi' | 'en' | 'zh', val: string) => {
    setStartConfig(prev => {
      if (lang === 'en') return { ...prev, welcome_text_en: val };
      if (lang === 'zh') return { ...prev, welcome_text_zh: val };
      return { ...prev, welcome_text_vi: val, welcome_text: val };
    });
  };

  const getTemplateTextForLang = (key: string, lang: 'vi' | 'en' | 'zh') => {
    const item = templates[key];
    if (!item) return '';
    if (lang === 'en') return item.value_en !== undefined ? item.value_en : '';
    if (lang === 'zh') return item.value_zh !== undefined ? item.value_zh : '';
    return item.value_vi !== undefined ? item.value_vi : (item.value || '');
  };

  const setTemplateTextForLang = (key: string, lang: 'vi' | 'en' | 'zh', val: string) => {
    setTemplates(prev => {
      const item = prev[key] || { label: '', group: '', description: '', vars: [], value: '' };
      if (lang === 'en') {
        return { ...prev, [key]: { ...item, value_en: val } };
      }
      if (lang === 'zh') {
        return { ...prev, [key]: { ...item, value_zh: val } };
      }
      return { ...prev, [key]: { ...item, value_vi: val, value: val } };
    });
  };

  // Start / Wallet / Deposit Inline Button Handlers
  const handleOpenAddInlineModal = (target: 'start' | 'wallet' | 'deposit', preset?: { text: string; text_en?: string; text_zh?: string; url?: string; callback_data?: string; type?: 'url' | 'callback' }) => {
    setInlineModalTarget(target);
    setEditingStartBtn(null);
    setStartBtnTextVi(preset?.text || '');
    setStartBtnTextEn(preset?.text_en || '');
    setStartBtnTextZh(preset?.text_zh || '');
    const isCallback = preset?.type === 'callback' || Boolean(preset?.callback_data) || target !== 'start';
    setStartBtnType(isCallback ? 'callback' : 'url');
    const val = preset?.url || preset?.callback_data || (target === 'deposit' ? 'deposit_select_bank' : target === 'wallet' ? 'start_deposit' : '');
    setStartBtnUrl(val);
    const presetsList = target === 'wallet' ? WALLET_CALLBACK_PRESETS : target === 'deposit' ? DEPOSIT_CALLBACK_PRESETS : CALLBACK_PRESETS;
    setIsCustomCallback(isCallback && Boolean(val) ? !presetsList.some(p => p.code === val) : false);

    let maxRow = 1;
    if (target === 'start') {
      maxRow = startConfig.buttons.reduce((max, b) => Math.max(max, b.row || 1), 1);
    } else if (target === 'wallet') {
      maxRow = walletButtons.reduce((max, b) => Math.max(max, b.row || 1), 1);
    } else if (target === 'deposit') {
      maxRow = depositButtons.reduce((max, b) => Math.max(max, b.row || 1), 1);
    }
    setStartBtnRow(maxRow);
    setStartBtnActive(true);
    setIsStartModalOpen(true);
  };

  const handleOpenEditInlineModal = (target: 'start' | 'wallet' | 'deposit', btn: StartMenuButton | BotMenuInlineButton) => {
    setInlineModalTarget(target);
    setEditingStartBtn(btn);
    setStartBtnTextVi(btn.text_vi || btn.text || '');
    setStartBtnTextEn(btn.text_en || '');
    setStartBtnTextZh(btn.text_zh || '');
    setStartBtnType(btn.type || 'callback');
    const val = btn.type === 'url' ? (btn.url || '') : (btn.callback_data || btn.url || '');
    setStartBtnUrl(val);
    const presetsList = target === 'wallet' ? WALLET_CALLBACK_PRESETS : target === 'deposit' ? DEPOSIT_CALLBACK_PRESETS : CALLBACK_PRESETS;
    setIsCustomCallback(btn.type === 'callback' && Boolean(val) && !presetsList.some(p => p.code === val));
    setStartBtnRow(btn.row || 1);
    setStartBtnActive(btn.is_active);
    setIsStartModalOpen(true);
  };

  // Backward compatibility alias
  const handleOpenAddStartModal = (preset?: { text: string; text_en?: string; text_zh?: string; url?: string; callback_data?: string; type?: 'url' | 'callback' }) => handleOpenAddInlineModal('start', preset);
  const handleOpenEditStartModal = (btn: StartMenuButton) => handleOpenEditInlineModal('start', btn);

  const handleSaveStartButton = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startBtnTextVi.trim()) {
      alert('Vui lòng nhập tên nút bấm Tiếng Việt!');
      return;
    }
    if (startBtnType === 'url' && !startBtnUrl.trim()) {
      alert('Vui lòng nhập đường link URL!');
      return;
    }
    if (startBtnType === 'callback' && !startBtnUrl.trim()) {
      alert('Vui lòng chọn hoặc nhập mã Callback Data!');
      return;
    }

    const primaryText = startBtnTextVi.trim();
    const textEn = startBtnTextEn.trim() || primaryText;
    const textZh = startBtnTextZh.trim() || primaryText;

    if (inlineModalTarget === 'start') {
      if (editingStartBtn) {
        setStartConfig(prev => ({
          ...prev,
          buttons: prev.buttons.map(b =>
            b.id === editingStartBtn.id
              ? {
                  ...b,
                  text: primaryText,
                  text_vi: primaryText,
                  text_en: textEn,
                  text_zh: textZh,
                  type: startBtnType,
                  url: startBtnType === 'url' ? startBtnUrl.trim() : undefined,
                  callback_data: startBtnType === 'callback' ? startBtnUrl.trim() : undefined,
                  row: Number(startBtnRow) || 1,
                  is_active: startBtnActive
                }
              : b
          )
        }));
      } else {
        const newBtn: StartMenuButton = {
          id: `btn_${Date.now()}`,
          text: primaryText,
          text_vi: primaryText,
          text_en: textEn,
          text_zh: textZh,
          type: startBtnType,
          url: startBtnType === 'url' ? startBtnUrl.trim() : undefined,
          callback_data: startBtnType === 'callback' ? startBtnUrl.trim() : undefined,
          row: Number(startBtnRow) || 1,
          is_active: startBtnActive
        };
        setStartConfig(prev => ({
          ...prev,
          buttons: [...prev.buttons, newBtn]
        }));
      }
    } else if (inlineModalTarget === 'wallet') {
      if (editingStartBtn) {
        setWalletButtons(prev =>
          prev.map(b =>
            b.id === editingStartBtn.id
              ? {
                  ...b,
                  text: primaryText,
                  text_vi: primaryText,
                  text_en: textEn,
                  text_zh: textZh,
                  type: startBtnType,
                  url: startBtnType === 'url' ? startBtnUrl.trim() : undefined,
                  callback_data: startBtnType === 'callback' ? startBtnUrl.trim() : undefined,
                  row: Number(startBtnRow) || 1,
                  is_active: startBtnActive
                }
              : b
          )
        );
      } else {
        const newBtn: BotMenuInlineButton = {
          id: `btn_wal_${Date.now()}`,
          text: primaryText,
          text_vi: primaryText,
          text_en: textEn,
          text_zh: textZh,
          type: startBtnType,
          url: startBtnType === 'url' ? startBtnUrl.trim() : undefined,
          callback_data: startBtnType === 'callback' ? startBtnUrl.trim() : undefined,
          row: Number(startBtnRow) || 1,
          is_active: startBtnActive
        };
        setWalletButtons(prev => [...prev, newBtn]);
      }
    } else if (inlineModalTarget === 'deposit') {
      if (editingStartBtn) {
        setDepositButtons(prev =>
          prev.map(b =>
            b.id === editingStartBtn.id
              ? {
                  ...b,
                  text: primaryText,
                  text_vi: primaryText,
                  text_en: textEn,
                  text_zh: textZh,
                  type: startBtnType,
                  url: startBtnType === 'url' ? startBtnUrl.trim() : undefined,
                  callback_data: startBtnType === 'callback' ? startBtnUrl.trim() : undefined,
                  row: Number(startBtnRow) || 1,
                  is_active: startBtnActive
                }
              : b
          )
        );
      } else {
        const newBtn: BotMenuInlineButton = {
          id: `btn_dep_${Date.now()}`,
          text: primaryText,
          text_vi: primaryText,
          text_en: textEn,
          text_zh: textZh,
          type: startBtnType,
          url: startBtnType === 'url' ? startBtnUrl.trim() : undefined,
          callback_data: startBtnType === 'callback' ? startBtnUrl.trim() : undefined,
          row: Number(startBtnRow) || 1,
          is_active: startBtnActive
        };
        setDepositButtons(prev => [...prev, newBtn]);
      }
    }
    setIsStartModalOpen(false);
  };

  const handleDeleteInlineBtn = (target: 'start' | 'wallet' | 'deposit', id: string) => {
    if (confirm('Bạn có chắc muốn xoá nút bấm này?')) {
      if (target === 'start') {
        setStartConfig(prev => ({
          ...prev,
          buttons: prev.buttons.filter(b => b.id !== id)
        }));
      } else if (target === 'wallet') {
        setWalletButtons(prev => prev.filter(b => b.id !== id));
      } else if (target === 'deposit') {
        setDepositButtons(prev => prev.filter(b => b.id !== id));
      }
    }
  };

  const handleToggleInlineBtn = (target: 'start' | 'wallet' | 'deposit', id: string) => {
    if (target === 'start') {
      setStartConfig(prev => ({
        ...prev,
        buttons: prev.buttons.map(b => b.id === id ? { ...b, is_active: !b.is_active } : b)
      }));
    } else if (target === 'wallet') {
      setWalletButtons(prev => prev.map(b => b.id === id ? { ...b, is_active: !b.is_active } : b));
    } else if (target === 'deposit') {
      setDepositButtons(prev => prev.map(b => b.id === id ? { ...b, is_active: !b.is_active } : b));
    }
  };

  const handleMoveInlineRow = (target: 'start' | 'wallet' | 'deposit', id: string, delta: number) => {
    if (target === 'start') {
      setStartConfig(prev => ({
        ...prev,
        buttons: prev.buttons.map(b => {
          if (b.id === id) {
            const nextRow = Math.max(1, (b.row || 1) + delta);
            return { ...b, row: nextRow };
          }
          return b;
        })
      }));
    } else if (target === 'wallet') {
      setWalletButtons(prev => prev.map(b => {
        if (b.id === id) {
          const nextRow = Math.max(1, (b.row || 1) + delta);
          return { ...b, row: nextRow };
        }
        return b;
      }));
    } else if (target === 'deposit') {
      setDepositButtons(prev => prev.map(b => {
        if (b.id === id) {
          const nextRow = Math.max(1, (b.row || 1) + delta);
          return { ...b, row: nextRow };
        }
        return b;
      }));
    }
  };

  // Backward compatibility aliases
  const handleDeleteStartBtn = (id: string) => handleDeleteInlineBtn('start', id);
  const handleToggleStartBtn = (id: string) => handleToggleInlineBtn('start', id);
  const handleMoveStartRow = (id: string, delta: number) => handleMoveInlineRow('start', id, delta);

  const handleQuickAddWalletPreset = (preset: { defaultText: string; defaultTextEn?: string; defaultTextZh?: string; code?: string; url?: string; label: string }) => {
    const maxRow = walletButtons.length > 0 ? Math.max(...walletButtons.map(b => b.row || 1)) : 1;
    const newBtn: BotMenuInlineButton = {
      id: `btn_wal_${preset.code || 'link'}_${Date.now()}`,
      text: preset.defaultText,
      text_vi: preset.defaultText,
      text_en: preset.defaultTextEn || preset.defaultText,
      text_zh: preset.defaultTextZh || preset.defaultText,
      type: preset.url ? 'url' : 'callback',
      callback_data: preset.code,
      url: preset.url,
      row: maxRow,
      is_active: true
    };
    setWalletButtons(prev => [...prev, newBtn]);
    showNotification('success', `Đã thêm nút "${preset.defaultText}" vào tin nhắn Ví & Số Dư!`);
  };

  const handleResetWalletButtonsToDefault = () => {
    if (confirm('Khôi phục danh sách nút Inline Ví & Số Dư về mẫu mặc định (Nạp tiền, Lịch sử nạp, Danh mục sản phẩm)?')) {
      setWalletButtons([
        { id: 'btn_wal_deposit', text: '➕ Nạp tiền vào ví', text_vi: '➕ Nạp tiền vào ví', text_en: '➕ Deposit Funds', text_zh: '➕ 充值到钱包', type: 'callback', callback_data: 'start_deposit', row: 1, is_active: true },
        { id: 'btn_wal_history', text: '🧾 Lịch sử nạp tiền', text_vi: '🧾 Lịch sử nạp tiền', text_en: '🧾 Deposit History', text_zh: '🧾 充值记录', type: 'callback', callback_data: 'deposit_history', row: 1, is_active: true },
        { id: 'btn_wal_products', text: '🛍️ Danh mục sản phẩm', text_vi: '🛍️ Danh mục sản phẩm', text_en: '🛍️ View Products', text_zh: '🛍️ 查看商品分类', type: 'callback', callback_data: 'list_categories', row: 2, is_active: true }
      ]);
      showNotification('success', 'Đã khôi phục nút Ví về mặc định!');
    }
  };

  const handleQuickAddDepositPreset = (preset: { defaultText: string; defaultTextEn?: string; defaultTextZh?: string; code?: string; url?: string; label: string }) => {
    const maxRow = depositButtons.length > 0 ? Math.max(...depositButtons.map(b => b.row || 1)) : 1;
    const newBtn: BotMenuInlineButton = {
      id: `btn_dep_${preset.code || 'link'}_${Date.now()}`,
      text: preset.defaultText,
      text_vi: preset.defaultText,
      text_en: preset.defaultTextEn || preset.defaultText,
      text_zh: preset.defaultTextZh || preset.defaultText,
      type: preset.url ? 'url' : 'callback',
      callback_data: preset.code,
      url: preset.url,
      row: maxRow,
      is_active: true
    };
    setDepositButtons(prev => [...prev, newBtn]);
    showNotification('success', `Đã thêm nút "${preset.defaultText}" vào Menu Nạp Tiền!`);
  };

  const handleResetDepositButtonsToDefault = () => {
    if (confirm('Khôi phục danh sách nút Chọn phương thức nạp tiền về mặc định (Ngân hàng, Binance Pay, USDT TRC20)?')) {
      setDepositButtons([
        { id: 'btn_dep_bank', text: '🏦 Ngân hàng (Bank)', text_vi: '🏦 Ngân hàng (Bank)', text_en: '🏦 Bank Transfer', text_zh: '🏦 银行转账', type: 'callback', callback_data: 'deposit_select_bank', row: 1, is_active: true },
        { id: 'btn_dep_binance', text: '🟡 Binance Pay (Tự động)', text_vi: '🟡 Binance Pay (Tự động)', text_en: '🟡 Binance Pay (Auto)', text_zh: '🟡 币安支付 (自动)', type: 'callback', callback_data: 'deposit_select_binance', row: 2, is_active: true },
        { id: 'btn_dep_usdt', text: '💲 USDT TRC20', text_vi: '💲 USDT TRC20', text_en: '💲 USDT TRC20', text_zh: '💲 USDT TRC20', type: 'callback', callback_data: 'deposit_select_usdt', row: 3, is_active: true }
      ]);
      showNotification('success', 'Đã khôi phục nút Nạp tiền về mặc định!');
    }
  };

  // Insert variable / emoji tag into template
  const insertTagToTemplate = (tag: string) => {
    if (!selectedTemplateKey || !templates[selectedTemplateKey]) return;
    const currentVal = getTemplateTextForLang(selectedTemplateKey, templateEditLang);
    setTemplateTextForLang(selectedTemplateKey, templateEditLang, currentVal + tag);
  };

  // Group keyboard buttons by row
  const groupedKbButtons: Record<number, MainKeyboardButton[]> = {};
  mainKeyboard.forEach(btn => {
    const r = btn.row || 1;
    if (!groupedKbButtons[r]) groupedKbButtons[r] = [];
    groupedKbButtons[r].push(btn);
  });
  const sortedKbRows = Object.keys(groupedKbButtons).map(Number).sort((a, b) => a - b);

  // Group start menu inline buttons by row
  const groupedStartButtons: Record<number, StartMenuButton[]> = {};
  startConfig.buttons.forEach(btn => {
    const r = btn.row || 1;
    if (!groupedStartButtons[r]) groupedStartButtons[r] = [];
    groupedStartButtons[r].push(btn);
  });
  const sortedStartRows = Object.keys(groupedStartButtons).map(Number).sort((a, b) => a - b);

  // Group wallet buttons by row
  const groupedWalletButtons: Record<number, BotMenuInlineButton[]> = {};
  walletButtons.forEach(btn => {
    const r = btn.row || 1;
    if (!groupedWalletButtons[r]) groupedWalletButtons[r] = [];
    groupedWalletButtons[r].push(btn);
  });
  const sortedWalletRows = Object.keys(groupedWalletButtons).map(Number).sort((a, b) => a - b);

  // Group deposit buttons by row
  const groupedDepositButtons: Record<number, BotMenuInlineButton[]> = {};
  depositButtons.forEach(btn => {
    const r = btn.row || 1;
    if (!groupedDepositButtons[r]) groupedDepositButtons[r] = [];
    groupedDepositButtons[r].push(btn);
  });
  const sortedDepositRows = Object.keys(groupedDepositButtons).map(Number).sort((a, b) => a - b);

  // Render Telegram simulation text (supports tags)
  const renderSimulatedText = (raw: string) => {
    if (!raw) return '';
    return raw
      .replace(/\{name\}/g, '@ducdz')
      .replace(/\{username\}/g, '@ducdz')
      .replace(/\{first_name\}/g, 'Đức')
      .replace(/\{id\}/g, '8202830305')
      .replace(/\{telegram_id\}/g, '8202830305')
      .replace(/\{userId\}/g, '8202830305')
      .replace(/\{balance\}/g, '500.000 ₫')
      .replace(/\{credit\}/g, '120')
      .replace(/\{shop_name\}/g, 'DUCVIETSTORE')
      .replace(/\{payId\}/g, '464811318')
      .replace(/\{memoCode\}/g, 'NAP 8202830305')
      .replace(/\{exchangeRate\}/g, '26.000')
      .replace(/\{minDeposit\}/g, '1')
      .replace(/\{amount\}/g, '100.000 ₫')
      .replace(/\{bankName\}/g, 'Vietcombank')
      .replace(/\{accountNo\}/g, '9876543210')
      .replace(/\{accountName\}/g, 'NGUYEN VAN A')
      .replace(/\{content\}/g, 'NAP8202830305')
      .replace(/\{walletAddress\}/g, 'TYDzsXD5DZX5V8x9Z1...')
      .replace(/\{order_code\}/g, 'ORD-98234')
      .replace(/\{product_name\}/g, 'ChatGPT Plus 1 Tháng')
      .replace(/\{price\}/g, '250.000')
      .replace(/\{data\}/g, 'user@gmail.com|Password123')
      .replace(/\{note\}/g, 'Bảo hành 30 ngày đổi 1-1')
      .replace(/\{reason\}/g, 'Tài khoản lỗi không đăng nhập được')
      .replace(/\{deposit_id\}/g, 'DEP-1042')
      .replace(/\{bonus\}/g, '10.000')
      .replace(/\{total\}/g, '110.000')
      .replace(/\{new_balance\}/g, '610.000')
      .replace(/\{apiKey\}/g, 'sk_live_78df8831bfa8291a')
      .replace(/\{statusText\}/g, '✅ Đang hoạt động')
      .replace(/\{quantity\}/g, '50')
      .replace(/\{stock\}/g, '120')
      .replace(/\{description\}/g, 'Tài khoản Premium dùng ổn định, bảo hành trọn thời gian.')
      .replace(/\{(?:emoji_id|emoji|id|tg_emoji)?:?(\d{15,22})\}/gi, '✨');
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-white text-sm font-semibold transition-all transform animate-in fade-in slide-in-from-top-4 ${
          notification.type === 'success' ? 'bg-emerald-600 shadow-emerald-500/30' : 'bg-red-600 shadow-red-500/30'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-zinc-950 via-zinc-900 to-amber-950 p-6 md:p-8 text-white shadow-xl border border-zinc-800">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <Languages className="w-3.5 h-3.5" />
              Tùy biến Đa Ngôn Ngữ (VI / EN / ZH) & Nút Bấm Bot
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <MessageSquare className="w-8 h-8 text-amber-500" />
              QUẢN LÝ NÚT BẤM & NỘI DUNG BOT
            </h1>
            <p className="text-zinc-400 text-sm max-w-2xl font-medium">
              Tùy chỉnh đa ngôn ngữ Tiếng Việt, English, 中文 cho các nút bấm bàn phím menu chính, tin nhắn nạp tiền Binance Pay / VietQR / USDT, và phản hồi của Bot trong thời gian thực.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={fetchData}
              disabled={loading || saving}
              className="border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 font-bold rounded-xl text-xs h-10"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Làm mới
            </Button>
            <Button
              onClick={handleSaveAll}
              disabled={saving || loading}
              className="bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-extrabold shadow-lg shadow-amber-500/25 rounded-xl text-xs h-10 px-5"
            >
              <Save className={`w-4 h-4 mr-2 ${saving ? 'animate-spin' : ''}`} />
              {saving ? 'Đang lưu...' : 'LƯU TOÀN BỘ CẤU HÌNH'}
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <button
          onClick={() => setActiveTab('keyboard')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
            activeTab === 'keyboard'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <Keyboard className="w-4 h-4" />
          📱 BÀN PHÍM MENU CHÍNH
        </button>

        <button
          onClick={() => setActiveTab('start_menu')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
            activeTab === 'start_menu'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          🚀 LỜI NHẮN & NÚT /START
        </button>

        <button
          onClick={() => setActiveTab('inline_buttons')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
            activeTab === 'inline_buttons'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
          🔘 TOÀN BỘ NÚT BẤM BOT (A - G)
        </button>

        <button
          onClick={() => {
            setActiveTab('deposit_templates');
            setSelectedTemplateKey('template_binance_pay');
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
            activeTab === 'deposit_templates'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          💳 MẪU TIN NHẮN NẠP TIỀN
        </button>

        <button
          onClick={() => {
            setActiveTab('order_templates');
            setSelectedTemplateKey('msg_template_purchase');
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
            activeTab === 'order_templates'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          📦 MẪU TIN NHẮN MUA HÀNG
        </button>

        <button
          onClick={() => {
            setActiveTab('service_templates');
            setSelectedTemplateKey('template_wallet_info');
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
            activeTab === 'service_templates'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          🛟 MẪU TIN VÍ, CSKH & API
        </button>

        <button
          onClick={() => {
            setActiveTab('notify_templates');
            setSelectedTemplateKey('template_new_product_notify');
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
            activeTab === 'notify_templates'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <Bell className="w-4 h-4" />
          📢 MẪU THÔNG BÁO SẢN PHẨM & KHO
        </button>
      </div>

      {/* TAB 1: BÀN PHÍM MENU CHÍNH (REPLY KEYBOARD) */}
      {activeTab === 'keyboard' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-zinc-900 dark:text-white flex items-center gap-2">
                    <Keyboard className="w-5 h-5 text-amber-500" />
                    DANH SÁCH NÚT BÀN PHÍM MENU CHÍNH
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Hỗ trợ đầy đủ 3 ngôn ngữ (Tiếng Việt, English, 中文) và tự động hiển thị theo ngôn ngữ của khách hàng.
                  </p>
                </div>
                <Button
                  onClick={handleOpenAddKbModal}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs h-9 px-4"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Thêm Nút Bấm
                </Button>
              </div>

              {/* Multilingual Caption / Title for Main Reply Keyboard */}
              <div className="p-4 rounded-2xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-600 dark:text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
                    <MessageSquare className="w-3.5 h-3.5" />
                    TIÊU ĐỀ GỬI KÈM BÀN PHÍM CHÍNH (ĐA NGÔN NGỮ)
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono">template_main_keyboard_caption</span>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Tin nhắn ngắn gửi đính kèm bàn phím cố định bên dưới (Reply Keyboard) khi khách xem Menu /start hoặc chuyển đổi ngôn ngữ:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                      <span>🇻🇳 Tiếng Việt:</span>
                    </label>
                    <input
                      type="text"
                      value={getTemplateTextForLang('template_main_keyboard_caption', 'vi')}
                      onChange={(e) => setTemplateTextForLang('template_main_keyboard_caption', 'vi', e.target.value)}
                      placeholder="👇 <b>BÀN PHÍM MENU CHÍNH</b>"
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                      <span>🇺🇸 English:</span>
                    </label>
                    <input
                      type="text"
                      value={getTemplateTextForLang('template_main_keyboard_caption', 'en')}
                      onChange={(e) => setTemplateTextForLang('template_main_keyboard_caption', 'en', e.target.value)}
                      placeholder="👇 <b>MAIN MENU KEYBOARD</b>"
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                      <span>🇨🇳 中文:</span>
                    </label>
                    <input
                      type="text"
                      value={getTemplateTextForLang('template_main_keyboard_caption', 'zh')}
                      onChange={(e) => setTemplateTextForLang('template_main_keyboard_caption', 'zh', e.target.value)}
                      placeholder="👇 <b>主菜单键盘</b>"
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Quick Preset Palette for Keyboard */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-black text-amber-600 dark:text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5" />
                    KHO NÚT BÀN PHÍM CÓ SẴN (BẤM ĐỂ THÊM NHANH 1-CLICK)
                  </span>
                  <button
                    type="button"
                    onClick={handleResetKbToDefault}
                    className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Khôi phục 5 nút chuẩn
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Bấm vào bất kỳ nút nào dưới đây để thêm ngay vào bàn phím (tự động điền đầy đủ nhãn 3 thứ tiếng VI / EN / ZH):
                </p>
                <div className="flex flex-wrap gap-2">
                  {KEYBOARD_ACTION_PRESETS.map((preset) => (
                    <button
                      key={preset.code}
                      type="button"
                      onClick={() => handleQuickAddKbPreset(preset)}
                      className="group flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 hover:bg-amber-500 hover:text-white dark:hover:bg-amber-600 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 shadow-xs text-xs font-bold transition-all cursor-pointer"
                      title={`Thêm nút: ${preset.defaultVi} (EN: ${preset.defaultEn} | ZH: ${preset.defaultZh})`}
                    >
                      <Plus className="w-3 h-3 text-amber-500 group-hover:text-white transition-colors" />
                      <span>{preset.defaultVi}</span>
                      <span className="text-[10px] text-zinc-400 group-hover:text-amber-100 font-mono">[{preset.code}]</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Visual Row List */}
              <div className="space-y-4">
                {sortedKbRows.map(rowNum => {
                  const rowBtns = groupedKbButtons[rowNum] || [];
                  return (
                    <div key={rowNum} className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 space-y-3">
                      <div className="flex items-center justify-between text-xs font-bold text-zinc-500">
                        <span className="flex items-center gap-1.5 uppercase tracking-wider text-amber-600">
                          <Layers className="w-3.5 h-3.5" />
                          HÀNG {rowNum} ({rowBtns.length} nút trên hàng này)
                        </span>
                      </div>

                      <div className="space-y-3">
                        {rowBtns.map(btn => {
                          const actionMeta = KEYBOARD_ACTION_PRESETS.find(p => p.code === btn.action);
                          return (
                            <div
                              key={btn.id}
                              className={`p-4 rounded-2xl border transition-all ${
                                btn.is_active !== false
                                  ? 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 shadow-xs'
                                  : 'bg-zinc-100/60 dark:bg-zinc-900/40 border-dashed border-zinc-300 dark:border-zinc-800 opacity-60'
                              }`}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="min-w-0 flex-1 space-y-1.5">
                                  <div className="font-extrabold text-sm text-zinc-900 dark:text-white flex flex-wrap items-center gap-2">
                                    <span className="break-all">{btn.text_vi || btn.text}</span>
                                    {btn.is_active === false && (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-500 font-bold shrink-0">
                                        Đã tắt
                                      </span>
                                    )}
                                  </div>

                                  {/* Multi-language badges */}
                                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                    <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold border border-zinc-200 dark:border-zinc-700 break-all">
                                      🇺🇸 {btn.text_en || btn.text}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold border border-zinc-200 dark:border-zinc-700 break-all">
                                      🇨🇳 {btn.text_zh || btn.text}
                                    </span>
                                  </div>

                                  <div className="text-[11px] text-zinc-500 font-medium flex items-center gap-1 pt-0.5">
                                    <Zap className="w-3 h-3 text-amber-500 shrink-0" />
                                    <span className="truncate">Hành động: <b>{actionMeta?.label || btn.action}</b></span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0 self-end sm:self-center bg-zinc-50 dark:bg-zinc-800/80 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700">
                                  <button
                                    onClick={() => handleToggleKbBtn(btn.id)}
                                    title={btn.is_active !== false ? 'Tạm tắt nút' : 'Bật nút'}
                                    className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-600 hover:bg-zinc-200/60 dark:hover:bg-zinc-700 cursor-pointer"
                                  >
                                    {btn.is_active !== false ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4 text-zinc-400" />}
                                  </button>
                                  <button
                                    onClick={() => handleMoveKbRow(btn.id, -1)}
                                    title="Chuyển lên hàng trên"
                                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-700 cursor-pointer"
                                  >
                                    <MoveUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleMoveKbRow(btn.id, 1)}
                                    title="Chuyển xuống hàng dưới"
                                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-700 cursor-pointer"
                                  >
                                    <MoveDown className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleOpenEditKbModal(btn)}
                                    title="Sửa nút"
                                    className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-600 hover:bg-zinc-200/60 dark:hover:bg-zinc-700 cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteKbBtn(btn.id)}
                                    title="Xoá nút"
                                    className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-zinc-200/60 dark:hover:bg-zinc-700 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Telegram Keyboard Live Simulation with Language Switcher */}
          <div className="lg:col-span-5">
            <div className="sticky top-6 bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-black text-zinc-900 dark:text-white">
                  <Smartphone className="w-4 h-4 text-amber-500" />
                  MÔ PHỎNG BÀN PHÍM BOT
                </div>

                {/* Preview Language Switcher */}
                <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
                  <button
                    onClick={() => setPreviewLang('vi')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      previewLang === 'vi'
                        ? 'bg-white dark:bg-zinc-900 text-amber-600 shadow-xs'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    🇻🇳 VI
                  </button>
                  <button
                    onClick={() => setPreviewLang('en')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      previewLang === 'en'
                        ? 'bg-white dark:bg-zinc-900 text-amber-600 shadow-xs'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    🇺🇸 EN
                  </button>
                  <button
                    onClick={() => setPreviewLang('zh')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      previewLang === 'zh'
                        ? 'bg-white dark:bg-zinc-900 text-amber-600 shadow-xs'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    🇨🇳 ZH
                  </button>
                </div>
              </div>

              <p className="text-xs text-zinc-500">
                Hiển thị chính xác các nút bấm theo ngôn ngữ ({previewLang.toUpperCase()}) người dùng đang chọn.
              </p>

              {/* Phone Frame Mockup */}
              <div className="w-full rounded-3xl bg-zinc-950 p-4 border border-zinc-800 shadow-2xl space-y-4">
                {/* Chat Area Mockup */}
                <div className="min-h-[160px] rounded-2xl bg-zinc-900/80 p-4 flex flex-col justify-end space-y-2 text-xs">
                  <div className="self-start max-w-[85%] rounded-2xl rounded-tl-xs bg-zinc-800 p-3 text-zinc-300 space-y-1">
                    <p className="font-bold text-amber-400">🤖 DUCVIETSTORE Bot</p>
                    <div className="text-zinc-200">
                      {renderSimulatedText(getTemplateTextForLang('template_main_keyboard_caption', previewLang) || (previewLang === 'vi' ? '👇 <b>BÀN PHÍM MENU CHÍNH</b>' : previewLang === 'en' ? '👇 <b>MAIN MENU KEYBOARD</b>' : '👇 <b>主菜单键盘</b>'))}
                    </div>
                  </div>
                </div>

                {/* Simulated Bottom Keyboard Buttons */}
                <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                  {sortedKbRows.map(rowNum => {
                    const rowBtns = (groupedKbButtons[rowNum] || []).filter(b => b.is_active !== false);
                    if (rowBtns.length === 0) return null;
                    return (
                      <div key={rowNum} className="flex gap-2">
                        {rowBtns.map(b => (
                          <div
                            key={b.id}
                            className="flex-1 py-3 px-2 text-center rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-extrabold text-xs shadow-md border border-zinc-700/60 truncate cursor-pointer transition-all active:scale-95"
                          >
                            {getButtonLabelForLang(b, previewLang)}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LỜI NHẮN & NÚT /START */}
      {activeTab === 'start_menu' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-6">
            {/* Start Welcome Message */}
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-zinc-900 dark:text-white flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-amber-500" />
                    LỜI NHẮN CHÀO MỪNG KHI GÕ /START
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Tin nhắn tự động gửi cho khách hàng khi họ bắt đầu bot hoặc bấm lệnh /start.
                  </p>
                </div>

                <label className="flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-400 cursor-pointer">
                  <span>Kích hoạt:</span>
                  <input
                    type="checkbox"
                    checked={startConfig.enabled}
                    onChange={(e) => setStartConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                    className="w-4 h-4 accent-amber-600 rounded"
                  />
                </label>
              </div>

              {/* Language Switcher Tabs for /start Message */}
              <div className="flex items-center justify-between gap-2 p-1.5 rounded-2xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                <span className="text-xs font-bold text-zinc-500 px-2 flex items-center gap-1.5">
                  <Languages className="w-3.5 h-3.5 text-amber-500" />
                  Ngôn ngữ soạn thảo:
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setStartTextLang('vi')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      startTextLang === 'vi'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    🇻🇳 Tiếng Việt
                  </button>
                  <button
                    type="button"
                    onClick={() => setStartTextLang('en')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      startTextLang === 'en'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    🇺🇸 English
                  </button>
                  <button
                    type="button"
                    onClick={() => setStartTextLang('zh')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      startTextLang === 'zh'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    🇨🇳 中文
                  </button>
                </div>
              </div>

              {/* Variable Chips */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-zinc-500">Bấm để chèn biến tự động:</span>
                <div className="flex flex-wrap gap-1.5">
                  {START_VARIABLE_CHIPS.map(chip => (
                    <button
                      key={chip.code}
                      type="button"
                      onClick={() => {
                        const cur = getStartTextForLang(startTextLang);
                        setStartTextForLang(startTextLang, cur + chip.code);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-amber-100 dark:hover:bg-amber-950/50 text-zinc-700 dark:text-zinc-300 hover:text-amber-700 text-xs font-semibold transition-all border border-zinc-200 dark:border-zinc-700"
                    >
                      {chip.code} <span className="text-[10px] text-zinc-400">({chip.label})</span>
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={getStartTextForLang(startTextLang)}
                onChange={(e) => setStartTextForLang(startTextLang, e.target.value)}
                rows={7}
                className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm font-mono text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                placeholder={`Nhập nội dung lời nhắn chào mừng (${startTextLang.toUpperCase()})...`}
              />

              {/* Image URL */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-amber-500" />
                  Link Ảnh Banner / Ảnh Chào Mừng (Tuỳ chọn)
                </label>
                <input
                  type="text"
                  value={startConfig.image_url || ''}
                  onChange={(e) => setStartConfig(prev => ({ ...prev, image_url: e.target.value }))}
                  placeholder="https://example.com/banner.jpg"
                  className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Inline Buttons attached to /start */}
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-zinc-900 dark:text-white flex items-center gap-2">
                    <Layers className="w-5 h-5 text-amber-500" />
                    NÚT BẤM INLINE ĐÍNH KÈM TIN NHẮN /START
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Nút bấm đính kèm ngay bên dưới ảnh/tin nhắn /start (Link website, nhóm hỗ trợ hoặc mở tính năng).
                  </p>
                </div>
                <Button
                  onClick={() => handleOpenAddStartModal()}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs h-9 px-4"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Thêm Nút Inline
                </Button>
              </div>

              {/* Quick Preset Palette for Start Menu Inline Buttons */}
              <div className="p-4 rounded-2xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-black text-amber-600 dark:text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5" />
                    KHO NÚT INLINE /START CÓ SẴN (BẤM ĐỂ THÊM NHANH 1-CLICK)
                  </span>
                  <button
                    type="button"
                    onClick={handleResetStartButtonsToDefault}
                    className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Khôi phục dàn nút chuẩn
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Bấm vào bất kỳ nút tính năng nào dưới đây để đính kèm vào tin nhắn /start (tự động có đầy đủ 3 thứ tiếng VI / EN / ZH):
                </p>
                <div className="flex flex-wrap gap-2">
                  {CALLBACK_PRESETS.map((preset) => (
                    <button
                      key={preset.code}
                      type="button"
                      onClick={() => handleQuickAddStartPreset(preset)}
                      className="group flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 hover:bg-amber-500 hover:text-white dark:hover:bg-amber-600 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 shadow-xs text-xs font-bold transition-all cursor-pointer"
                      title={`Thêm nút: ${preset.defaultText} (EN: ${preset.defaultTextEn} | ZH: ${preset.defaultTextZh})`}
                    >
                      <Plus className="w-3 h-3 text-amber-500 group-hover:text-white transition-colors" />
                      <span>{preset.defaultText}</span>
                      <span className="text-[10px] text-zinc-400 group-hover:text-amber-100 font-mono">[{preset.code}]</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleOpenAddStartModal({
                      text: '📢 Kênh Telegram Update',
                      text_en: '📢 Telegram Channel',
                      text_zh: '📢 官方更新频道',
                      url: 'https://t.me',
                      type: 'url'
                    })}
                    className="group flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 hover:bg-blue-600 hover:text-white text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 shadow-xs text-xs font-bold transition-all cursor-pointer"
                  >
                    <Plus className="w-3 h-3 text-blue-500 group-hover:text-white" />
                    <span>📢 Link Kênh Telegram</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenAddStartModal({
                      text: '🌐 Website Bán Hàng',
                      text_en: '🌐 Web Store',
                      text_zh: '🌐 官方商城',
                      url: 'https://example.com',
                      type: 'url'
                    })}
                    className="group flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 hover:bg-blue-600 hover:text-white text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 shadow-xs text-xs font-bold transition-all cursor-pointer"
                  >
                    <Plus className="w-3 h-3 text-blue-500 group-hover:text-white" />
                    <span>🌐 Link Website</span>
                  </button>
                </div>
              </div>

              {/* Rows List */}
              <div className="space-y-4">
                {sortedStartRows.map(rowNum => {
                  const rowBtns = groupedStartButtons[rowNum] || [];
                  return (
                    <div key={rowNum} className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 space-y-3">
                      <span className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5" />
                        HÀNG {rowNum} ({rowBtns.length} nút)
                      </span>
                      <div className="space-y-3">
                        {rowBtns.map(btn => (
                          <div
                            key={btn.id}
                            className={`p-4 rounded-2xl border transition-all ${
                              btn.is_active
                                ? 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 shadow-xs'
                                : 'bg-zinc-100/60 dark:bg-zinc-900/40 border-dashed border-zinc-300 dark:border-zinc-800 opacity-60'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="min-w-0 flex-1 space-y-1.5">
                                <div className="font-extrabold text-sm text-zinc-900 dark:text-white flex flex-wrap items-center gap-2">
                                  <span className="break-all">{btn.text_vi || btn.text}</span>
                                  {!btn.is_active && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-500 font-bold shrink-0">
                                      Đã tắt
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                  <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold border border-zinc-200 dark:border-zinc-700 break-all">
                                    🇺🇸 {btn.text_en || btn.text}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold border border-zinc-200 dark:border-zinc-700 break-all">
                                    🇨🇳 {btn.text_zh || btn.text}
                                  </span>
                                </div>
                                <div className="text-[11px] text-zinc-500 font-mono break-all pt-0.5">
                                  {btn.type === 'url' ? `🔗 ${btn.url}` : `⚡ Callback: ${btn.callback_data || btn.url}`}
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0 self-end sm:self-center bg-zinc-50 dark:bg-zinc-800/80 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700">
                                <button
                                  onClick={() => handleToggleStartBtn(btn.id)}
                                  title={btn.is_active ? 'Tạm tắt nút' : 'Bật nút'}
                                  className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-600 hover:bg-zinc-200/60 dark:hover:bg-zinc-700 cursor-pointer"
                                >
                                  {btn.is_active ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4 text-zinc-400" />}
                                </button>
                                <button
                                  onClick={() => handleMoveStartRow(btn.id, -1)}
                                  title="Chuyển lên hàng trên"
                                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-700 cursor-pointer"
                                >
                                  <MoveUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleMoveStartRow(btn.id, 1)}
                                  title="Chuyển xuống hàng dưới"
                                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-700 cursor-pointer"
                                >
                                  <MoveDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleOpenEditStartModal(btn)}
                                  title="Sửa nút"
                                  className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-600 hover:bg-zinc-200/60 dark:hover:bg-zinc-700 cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteStartBtn(btn.id)}
                                  title="Xoá nút"
                                  className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-zinc-200/60 dark:hover:bg-zinc-700 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Preview Simulator */}
          <div className="lg:col-span-5">
            <div className="sticky top-6 bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-black text-zinc-900 dark:text-white">
                  <Smartphone className="w-4 h-4 text-amber-500" />
                  MÔ PHỎNG TIN NHẮN /START
                </div>

                <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
                  <button
                    onClick={() => setStartTextLang('vi')}
                    className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all ${
                      startTextLang === 'vi'
                        ? 'bg-white dark:bg-zinc-900 text-amber-600 shadow-xs'
                        : 'text-zinc-500 hover:text-zinc-900'
                    }`}
                  >
                    🇻🇳 VI
                  </button>
                  <button
                    onClick={() => setStartTextLang('en')}
                    className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all ${
                      startTextLang === 'en'
                        ? 'bg-white dark:bg-zinc-900 text-amber-600 shadow-xs'
                        : 'text-zinc-500 hover:text-zinc-900'
                    }`}
                  >
                    🇺🇸 EN
                  </button>
                  <button
                    onClick={() => setStartTextLang('zh')}
                    className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all ${
                      startTextLang === 'zh'
                        ? 'bg-white dark:bg-zinc-900 text-amber-600 shadow-xs'
                        : 'text-zinc-500 hover:text-zinc-900'
                    }`}
                  >
                    🇨🇳 ZH
                  </button>
                </div>
              </div>

              <div className="w-full rounded-3xl bg-zinc-950 p-4 border border-zinc-800 shadow-2xl space-y-4">
                <div className="rounded-2xl bg-zinc-900 p-4 space-y-3">
                  {startConfig.image_url && (
                    <img
                      src={startConfig.image_url}
                      alt="Banner"
                      className="w-full h-36 object-cover rounded-xl border border-zinc-800"
                      onError={(e) => { (e.target as any).style.display = 'none'; }}
                    />
                  )}
                  <div className="text-xs text-zinc-200 whitespace-pre-wrap font-sans leading-relaxed">
                    {renderSimulatedText(getStartTextForLang(startTextLang))}
                  </div>
                </div>

                {/* Inline Buttons Preview */}
                <div className="space-y-2">
                  {sortedStartRows.map(rowNum => {
                    const rowBtns = (groupedStartButtons[rowNum] || []).filter(b => b.is_active);
                    if (rowBtns.length === 0) return null;
                    return (
                      <div key={rowNum} className="flex gap-2">
                        {rowBtns.map(b => (
                          <div
                            key={b.id}
                            className="flex-1 py-2.5 px-3 text-center rounded-xl bg-zinc-800 text-amber-400 font-bold text-xs shadow-md border border-zinc-700 truncate"
                          >
                            {getStartButtonLabelForLang(b, startTextLang)}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: QUẢN LÝ TOÀN BỘ NÚT BẤM BOT (NHÓM A - G) */}
      {activeTab === 'inline_buttons' && (
        <div className="space-y-6">
          {/* Group Filter Navigation Bar */}
          <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
            {[
              { id: 'all', label: '🌟 TẤT CẢ NHÓM (A - G)' },
              { id: 'start', label: '🚀 NHÓM A: Nút /start' },
              { id: 'wallet', label: '👛 NHÓM B: Nút Ví & Số Dư' },
              { id: 'deposit', label: '💳 NHÓM C: Cổng Nạp Tiền' },
              { id: 'deposit_flow', label: '⚡ NHÓM D: Quy Trình Nạp' },
              { id: 'shop_flow', label: '🛍️ NHÓM E: Mua Hàng & Danh Mục' },
              { id: 'order_download', label: '📦 NHÓM F: Tải Đơn Hàng' },
              { id: 'service_other', label: '🛟 NHÓM G: Dịch Vụ & Khác' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setInlineGroupFilter(tab.id as any)}
                className={`px-3 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  inlineGroupFilter === tab.id
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-6">
              {/* === NHÓM A: NÚT INLINE TIN NHẮN /START === */}
              {(inlineGroupFilter === 'all' || inlineGroupFilter === 'start') && (
                <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-black text-zinc-900 dark:text-white flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-amber-500" />
                        NHÓM A: NÚT BẤM INLINE ĐÍNH KÈM TIN NHẮN /START
                      </h2>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Nút hiển thị ngay dưới lời nhắn chào mừng /start (Sản phẩm, Ví & Nạp tiền, CSKH, Bảo hành, Đổi ngôn ngữ, Link Kênh...).
                      </p>
                    </div>
                    <Button
                      onClick={() => handleOpenAddInlineModal('start')}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs h-9 px-4 shrink-0"
                    >
                      <Plus className="w-4 h-4 mr-1.5" />
                      Thêm Nút /start
                    </Button>
                  </div>

                  {/* Presets for Start */}
                  <div className="p-4 rounded-2xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-black text-amber-600 dark:text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
                        <Sparkles className="w-3.5 h-3.5" />
                        KHO NÚT /START CÓ SẴN (1-CLICK)
                      </span>
                      <button
                        type="button"
                        onClick={handleResetStartButtonsToDefault}
                        className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Khôi phục nút chuẩn
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {CALLBACK_PRESETS.map((preset) => (
                        <button
                          key={preset.code}
                          type="button"
                          onClick={() => handleQuickAddStartPreset(preset)}
                          className="group flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 hover:bg-amber-500 hover:text-white dark:hover:bg-amber-600 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 shadow-xs text-xs font-bold transition-all cursor-pointer"
                        >
                          <Plus className="w-3 h-3 text-amber-500 group-hover:text-white" />
                          <span>{preset.defaultText}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Start Buttons Rows */}
                  <div className="space-y-3">
                    {sortedStartRows.map(rowNum => {
                      const rowBtns = groupedStartButtons[rowNum] || [];
                      return (
                        <div key={rowNum} className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 space-y-3">
                          <span className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5" />
                            HÀNG {rowNum} ({rowBtns.length} nút)
                          </span>
                          <div className="space-y-2.5">
                            {rowBtns.map(btn => (
                              <div
                                key={btn.id}
                                className={`p-3.5 rounded-2xl border transition-all ${
                                  btn.is_active !== false
                                    ? 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 shadow-xs'
                                    : 'bg-zinc-100/60 dark:bg-zinc-900/40 border-dashed border-zinc-300 dark:border-zinc-800 opacity-60'
                                }`}
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  <div className="min-w-0 flex-1 space-y-1">
                                    <div className="font-extrabold text-sm text-zinc-900 dark:text-white flex flex-wrap items-center gap-2">
                                      <span className="break-all">{btn.text_vi || btn.text}</span>
                                      {btn.is_active === false && (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-500 font-bold shrink-0">
                                          Đã tắt
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                      <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold border border-zinc-200 dark:border-zinc-700">
                                        🇺🇸 {btn.text_en || btn.text}
                                      </span>
                                      <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold border border-zinc-200 dark:border-zinc-700">
                                        🇨🇳 {btn.text_zh || btn.text}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-zinc-500 font-mono break-all pt-0.5">
                                      {btn.type === 'url' ? `🔗 ${btn.url}` : `⚡ Callback: ${btn.callback_data || btn.url}`}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0 self-end sm:self-center bg-zinc-50 dark:bg-zinc-800/80 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700">
                                    <button
                                      onClick={() => handleToggleInlineBtn('start', btn.id)}
                                      title={btn.is_active !== false ? 'Tạm tắt' : 'Bật nút'}
                                      className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-600 hover:bg-zinc-200/60 dark:hover:bg-zinc-700 cursor-pointer"
                                    >
                                      {btn.is_active !== false ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4 text-zinc-400" />}
                                    </button>
                                    <button
                                      onClick={() => handleMoveInlineRow('start', btn.id, -1)}
                                      title="Lên hàng trên"
                                      className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-700 cursor-pointer"
                                    >
                                      <MoveUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleMoveInlineRow('start', btn.id, 1)}
                                      title="Xuống hàng dưới"
                                      className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-700 cursor-pointer"
                                    >
                                      <MoveDown className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleOpenEditInlineModal('start', btn)}
                                      title="Sửa nút"
                                      className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-600 hover:bg-zinc-200/60 dark:hover:bg-zinc-700 cursor-pointer"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteInlineBtn('start', btn.id)}
                                      title="Xoá nút"
                                      className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-zinc-200/60 dark:hover:bg-zinc-700 cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* === NHÓM B: NÚT INLINE VÍ & SỐ DƯ === */}
              {(inlineGroupFilter === 'all' || inlineGroupFilter === 'wallet') && (
                <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-black text-zinc-900 dark:text-white flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-amber-500" />
                        NHÓM B: NÚT BẤM ĐÍNH KÈM TIN NHẮN VÍ & SỐ DƯ
                      </h2>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Nút hiển thị ngay dưới tin nhắn Ví & Số Dư (Nạp tiền vào ví, Lịch sử nạp tiền, Danh mục sản phẩm, Lấy API Key...).
                      </p>
                    </div>
                    <Button
                      onClick={() => handleOpenAddInlineModal('wallet')}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs h-9 px-4 shrink-0"
                    >
                      <Plus className="w-4 h-4 mr-1.5" />
                      Thêm Nút Ví
                    </Button>
                  </div>

                  {/* Presets for Wallet */}
                  <div className="p-4 rounded-2xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-black text-amber-600 dark:text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
                        <Sparkles className="w-3.5 h-3.5" />
                        KHO NÚT VÍ CÓ SẴN (1-CLICK)
                      </span>
                      <button
                        type="button"
                        onClick={handleResetWalletButtonsToDefault}
                        className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Khôi phục 3 nút chuẩn
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {WALLET_CALLBACK_PRESETS.map((preset) => (
                        <button
                          key={preset.code}
                          type="button"
                          onClick={() => handleQuickAddWalletPreset(preset)}
                          className="group flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 hover:bg-amber-500 hover:text-white dark:hover:bg-amber-600 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 shadow-xs text-xs font-bold transition-all cursor-pointer"
                        >
                          <Plus className="w-3 h-3 text-amber-500 group-hover:text-white" />
                          <span>{preset.defaultText}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Wallet Buttons Rows List */}
                  <div className="space-y-3">
                    {sortedWalletRows.map(rowNum => {
                      const rowBtns = groupedWalletButtons[rowNum] || [];
                      return (
                        <div key={rowNum} className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 space-y-3">
                          <span className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5" />
                            HÀNG {rowNum} ({rowBtns.length} nút trên hàng)
                          </span>
                          <div className="space-y-2.5">
                            {rowBtns.map(btn => (
                              <div
                                key={btn.id}
                                className={`p-3.5 rounded-2xl border transition-all ${
                                  btn.is_active
                                    ? 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 shadow-xs'
                                    : 'bg-zinc-100/60 dark:bg-zinc-900/40 border-dashed border-zinc-300 dark:border-zinc-800 opacity-60'
                                }`}
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  <div className="min-w-0 flex-1 space-y-1">
                                    <div className="font-extrabold text-sm text-zinc-900 dark:text-white flex flex-wrap items-center gap-2">
                                      <span className="break-all">{btn.text_vi || btn.text}</span>
                                      {!btn.is_active && (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-500 font-bold shrink-0">
                                          Đã tắt
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                      <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold border border-zinc-200 dark:border-zinc-700 break-all">
                                        🇺🇸 {btn.text_en || btn.text}
                                      </span>
                                      <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold border border-zinc-200 dark:border-zinc-700 break-all">
                                        🇨🇳 {btn.text_zh || btn.text}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-zinc-500 font-mono break-all pt-0.5">
                                      {btn.type === 'url' ? `🔗 ${btn.url}` : `⚡ Callback: ${btn.callback_data || btn.url}`}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0 self-end sm:self-center bg-zinc-50 dark:bg-zinc-800/80 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700">
                                    <button
                                      onClick={() => handleToggleInlineBtn('wallet', btn.id)}
                                      title={btn.is_active ? 'Tạm tắt nút' : 'Bật nút'}
                                      className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-600 hover:bg-zinc-200/60 dark:hover:bg-zinc-700 cursor-pointer"
                                    >
                                      {btn.is_active ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4 text-zinc-400" />}
                                    </button>
                                    <button
                                      onClick={() => handleMoveInlineRow('wallet', btn.id, -1)}
                                      title="Chuyển lên hàng trên"
                                      className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-700 cursor-pointer"
                                    >
                                      <MoveUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleMoveInlineRow('wallet', btn.id, 1)}
                                      title="Chuyển xuống hàng dưới"
                                      className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-700 cursor-pointer"
                                    >
                                      <MoveDown className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleOpenEditInlineModal('wallet', btn)}
                                      title="Sửa nút"
                                      className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-600 hover:bg-zinc-200/60 dark:hover:bg-zinc-700 cursor-pointer"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteInlineBtn('wallet', btn.id)}
                                      title="Xoá nút"
                                      className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-zinc-200/60 dark:hover:bg-zinc-700 cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* === NHÓM C: NÚT CHỌN CỔNG NẠP TIỀN === */}
              {(inlineGroupFilter === 'all' || inlineGroupFilter === 'deposit') && (
                <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-black text-zinc-900 dark:text-white flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-amber-500" />
                        NHÓM C: NÚT CHỌN PHƯƠNG THỨC NẠP TIỀN
                      </h2>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Nút bấm chọn nạp (Ngân hàng, Binance Pay, USDT TRC20...) hiển thị khi khách bấm nút Nạp tiền.
                      </p>
                    </div>
                    <Button
                      onClick={() => handleOpenAddInlineModal('deposit')}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs h-9 px-4 shrink-0"
                    >
                      <Plus className="w-4 h-4 mr-1.5" />
                      Thêm Nút Nạp Tiền
                    </Button>
                  </div>

                  {/* Presets for Deposit */}
                  <div className="p-4 rounded-2xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-black text-amber-600 dark:text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
                        <Sparkles className="w-3.5 h-3.5" />
                        KHO NÚT NẠP TIỀN CÓ SẴN (1-CLICK)
                      </span>
                      <button
                        type="button"
                        onClick={handleResetDepositButtonsToDefault}
                        className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Khôi phục 3 nút chuẩn
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {DEPOSIT_CALLBACK_PRESETS.map((preset) => (
                        <button
                          key={preset.code}
                          type="button"
                          onClick={() => handleQuickAddDepositPreset(preset)}
                          className="group flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 hover:bg-amber-500 hover:text-white dark:hover:bg-amber-600 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 shadow-xs text-xs font-bold transition-all cursor-pointer"
                        >
                          <Plus className="w-3 h-3 text-amber-500 group-hover:text-white" />
                          <span>{preset.defaultText}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Deposit Buttons Rows List */}
                  <div className="space-y-3">
                    {sortedDepositRows.map(rowNum => {
                      const rowBtns = groupedDepositButtons[rowNum] || [];
                      return (
                        <div key={rowNum} className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 space-y-3">
                          <span className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5" />
                            HÀNG {rowNum} ({rowBtns.length} nút trên hàng)
                          </span>
                          <div className="space-y-2.5">
                            {rowBtns.map(btn => (
                              <div
                                key={btn.id}
                                className={`p-3.5 rounded-2xl border transition-all ${
                                  btn.is_active
                                    ? 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 shadow-xs'
                                    : 'bg-zinc-100/60 dark:bg-zinc-900/40 border-dashed border-zinc-300 dark:border-zinc-800 opacity-60'
                                }`}
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  <div className="min-w-0 flex-1 space-y-1">
                                    <div className="font-extrabold text-sm text-zinc-900 dark:text-white flex flex-wrap items-center gap-2">
                                      <span className="break-all">{btn.text_vi || btn.text}</span>
                                      {!btn.is_active && (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-500 font-bold shrink-0">
                                          Đã tắt
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                      <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold border border-zinc-200 dark:border-zinc-700 break-all">
                                        🇺🇸 {btn.text_en || btn.text}
                                      </span>
                                      <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold border border-zinc-200 dark:border-zinc-700 break-all">
                                        🇨🇳 {btn.text_zh || btn.text}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-zinc-500 font-mono break-all pt-0.5">
                                      {btn.type === 'url' ? `🔗 ${btn.url}` : `⚡ Callback: ${btn.callback_data || btn.url}`}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0 self-end sm:self-center bg-zinc-50 dark:bg-zinc-800/80 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700">
                                    <button
                                      onClick={() => handleToggleInlineBtn('deposit', btn.id)}
                                      title={btn.is_active ? 'Tạm tắt nút' : 'Bật nút'}
                                      className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-600 hover:bg-zinc-200/60 dark:hover:bg-zinc-700 cursor-pointer"
                                    >
                                      {btn.is_active ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4 text-zinc-400" />}
                                    </button>
                                    <button
                                      onClick={() => handleMoveInlineRow('deposit', btn.id, -1)}
                                      title="Chuyển lên hàng trên"
                                      className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-700 cursor-pointer"
                                    >
                                      <MoveUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleMoveInlineRow('deposit', btn.id, 1)}
                                      title="Chuyển xuống hàng dưới"
                                      className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-700 cursor-pointer"
                                    >
                                      <MoveDown className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleOpenEditInlineModal('deposit', btn)}
                                      title="Sửa nút"
                                      className="p-1.5 rounded-lg text-zinc-400 hover:text-blue-600 hover:bg-zinc-200/60 dark:hover:bg-zinc-700 cursor-pointer"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteInlineBtn('deposit', btn.id)}
                                      title="Xoá nút"
                                      className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-zinc-200/60 dark:hover:bg-zinc-700 cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* === NHÓM D: NÚT QUY TRÌNH NẠP TIỀN & THANH TOÁN === */}
              {(inlineGroupFilter === 'all' || inlineGroupFilter === 'deposit_flow') && (
                <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
                  <div>
                    <h2 className="text-base font-black text-zinc-900 dark:text-white flex items-center gap-2">
                      <Zap className="w-5 h-5 text-amber-500" />
                      NHÓM D: NÚT TRONG QUY TRÌNH NẠP TIỀN & THANH TOÁN
                    </h2>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Chỉnh sửa tên hiển thị đa ngôn ngữ cho các nút trong lúc khách đang quét mã QR hoặc nạp tiền.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {[
                      { key: 'btn_check_payment', label: '🔍 Kiểm tra thanh toán ngay', desc: 'Nút kiểm tra giao dịch nạp tiền tức thì', code: 'check_payment' },
                      { key: 'btn_reload_qr', label: '🔄 Tải lại QR (1 lần)', desc: 'Nút tạo lại mã VietQR khi hết hạn', code: 'reload_qr' },
                      { key: 'btn_cancel_qr', label: '❌ Huỷ mã QR', desc: 'Nút hủy bỏ phiên nạp tiền hiện tại', code: 'cancel_qr' },
                      { key: 'btn_back_deposit_options', label: '↩️ Quay lại Menu Nạp', desc: 'Nút quay về bảng chọn cổng thanh toán', code: 'back_to_deposit_options' },
                      { key: 'btn_admin_approve_deposit', label: '✅ Duyệt Nạp (Admin)', desc: 'Nút duyệt cộng tiền gửi riêng cho Admin', code: 'approve_usdt_deposit' },
                      { key: 'btn_admin_reject_deposit', label: '❌ Từ chối Nạp (Admin)', desc: 'Nút từ chối nạp tiền gửi riêng cho Admin', code: 'reject_usdt_deposit' }
                    ].map(btnItem => (
                      <div key={btnItem.key} className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-xs font-black text-zinc-900 dark:text-white">{btnItem.label}</div>
                            <div className="text-[11px] text-zinc-400">{btnItem.desc}</div>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-200 dark:bg-zinc-800 text-amber-600 font-bold border border-zinc-300 dark:border-zinc-700">
                            {btnItem.code}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">🇻🇳 Tiếng Việt:</label>
                            <input
                              type="text"
                              value={getTemplateTextForLang(btnItem.key, 'vi')}
                              onChange={(e) => setTemplateTextForLang(btnItem.key, 'vi', e.target.value)}
                              className="w-full p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500"
                              placeholder="Tên nút tiếng Việt..."
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">🇺🇸 English:</label>
                            <input
                              type="text"
                              value={getTemplateTextForLang(btnItem.key, 'en')}
                              onChange={(e) => setTemplateTextForLang(btnItem.key, 'en', e.target.value)}
                              className="w-full p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500"
                              placeholder="English label..."
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">🇨🇳 中文:</label>
                            <input
                              type="text"
                              value={getTemplateTextForLang(btnItem.key, 'zh')}
                              onChange={(e) => setTemplateTextForLang(btnItem.key, 'zh', e.target.value)}
                              className="w-full p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500"
                              placeholder="中文名称..."
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* === NHÓM E: NÚT MUA HÀNG & DANH MỤC SẢN PHẨM === */}
              {(inlineGroupFilter === 'all' || inlineGroupFilter === 'shop_flow') && (
                <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
                  <div>
                    <h2 className="text-base font-black text-zinc-900 dark:text-white flex items-center gap-2">
                      <ShoppingBag className="w-5 h-5 text-amber-500" />
                      NHÓM E: NÚT MUA HÀNG & DANH MỤC SẢN PHẨM
                    </h2>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Chỉnh sửa tên hiển thị đa ngôn ngữ cho các nút trong quá trình chọn mua sản phẩm.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {[
                      { key: 'btn_buy_now', label: '🛍️ Mua ngay', desc: 'Nút bấm bắt đầu mua sản phẩm', code: 'buy_now' },
                      { key: 'btn_confirm_buy', label: '✅ Xác nhận mua', desc: 'Nút xác nhận thanh toán trừ tiền ví', code: 'confirm_buy' },
                      { key: 'btn_cancel_buy', label: '❌ Hủy bỏ', desc: 'Nút hủy bỏ quy trình mua', code: 'cancel_buy' },
                      { key: 'btn_qty_all', label: '📦 Mua tất cả', desc: 'Nút mua toàn bộ tồn kho của sản phẩm', code: 'qty_all' },
                      { key: 'btn_qty_custom', label: '✏️ Tự nhập số lượng', desc: 'Nút tự nhập số lượng muốn mua', code: 'qty_custom' },
                      { key: 'btn_back_to_categories', label: '↩️ Quay lại danh mục', desc: 'Nút quay lại danh mục sản phẩm', code: 'back_to_categories' },
                      { key: 'btn_prev_page', label: '⬅️ Trang trước', desc: 'Nút phân trang lùi', code: 'prev_page' },
                      { key: 'btn_next_page', label: '➡️ Trang sau', desc: 'Nút phân trang tới', code: 'next_page' }
                    ].map(btnItem => (
                      <div key={btnItem.key} className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-xs font-black text-zinc-900 dark:text-white">{btnItem.label}</div>
                            <div className="text-[11px] text-zinc-400">{btnItem.desc}</div>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-200 dark:bg-zinc-800 text-amber-600 font-bold border border-zinc-300 dark:border-zinc-700">
                            {btnItem.code}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">🇻🇳 Tiếng Việt:</label>
                            <input
                              type="text"
                              value={getTemplateTextForLang(btnItem.key, 'vi')}
                              onChange={(e) => setTemplateTextForLang(btnItem.key, 'vi', e.target.value)}
                              className="w-full p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500"
                              placeholder="Tên nút tiếng Việt..."
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">🇺🇸 English:</label>
                            <input
                              type="text"
                              value={getTemplateTextForLang(btnItem.key, 'en')}
                              onChange={(e) => setTemplateTextForLang(btnItem.key, 'en', e.target.value)}
                              className="w-full p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500"
                              placeholder="English label..."
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">🇨🇳 中文:</label>
                            <input
                              type="text"
                              value={getTemplateTextForLang(btnItem.key, 'zh')}
                              onChange={(e) => setTemplateTextForLang(btnItem.key, 'zh', e.target.value)}
                              className="w-full p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500"
                              placeholder="中文名称..."
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* === NHÓM F: NÚT SAU KHI MUA & ĐƠN HÀNG === */}
              {(inlineGroupFilter === 'all' || inlineGroupFilter === 'order_download') && (
                <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
                  <div>
                    <h2 className="text-base font-black text-zinc-900 dark:text-white flex items-center gap-2">
                      <FileText className="w-5 h-5 text-amber-500" />
                      NHÓM F: NÚT SAU KHI MUA & ĐƠN HÀNG
                    </h2>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Chỉnh sửa tên hiển thị các nút tải file tài khoản và tra cứu chi tiết đơn hàng.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {[
                      { key: 'btn_download_txt', label: '📥 Tải file txt', desc: 'Nút gửi file .txt tài khoản về Telegram', code: 'dl' },
                      { key: 'btn_download_all', label: '📥 Tải toàn bộ', desc: 'Nút tải tất cả tài khoản đơn hàng', code: 'dla' },
                      { key: 'btn_download_combo', label: '📥 Tải định dạng combo', desc: 'Nút tải theo định dạng combo User|Pass|Cookie|2FA', code: 'dlc' },
                      { key: 'btn_view_order_detail', label: '🧾 Xem chi tiết đơn hàng', desc: 'Nút tra cứu thông tin chi tiết đơn hàng', code: 'view_order' }
                    ].map(btnItem => (
                      <div key={btnItem.key} className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-xs font-black text-zinc-900 dark:text-white">{btnItem.label}</div>
                            <div className="text-[11px] text-zinc-400">{btnItem.desc}</div>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-200 dark:bg-zinc-800 text-amber-600 font-bold border border-zinc-300 dark:border-zinc-700">
                            {btnItem.code}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">🇻🇳 Tiếng Việt:</label>
                            <input
                              type="text"
                              value={getTemplateTextForLang(btnItem.key, 'vi')}
                              onChange={(e) => setTemplateTextForLang(btnItem.key, 'vi', e.target.value)}
                              className="w-full p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500"
                              placeholder="Tên nút tiếng Việt..."
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">🇺🇸 English:</label>
                            <input
                              type="text"
                              value={getTemplateTextForLang(btnItem.key, 'en')}
                              onChange={(e) => setTemplateTextForLang(btnItem.key, 'en', e.target.value)}
                              className="w-full p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500"
                              placeholder="English label..."
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">🇨🇳 中文:</label>
                            <input
                              type="text"
                              value={getTemplateTextForLang(btnItem.key, 'zh')}
                              onChange={(e) => setTemplateTextForLang(btnItem.key, 'zh', e.target.value)}
                              className="w-full p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500"
                              placeholder="中文名称..."
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* === NHÓM G: NÚT DỊCH VỤ, CSKH & KHÁC === */}
              {(inlineGroupFilter === 'all' || inlineGroupFilter === 'service_other') && (
                <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
                  <div>
                    <h2 className="text-base font-black text-zinc-900 dark:text-white flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-amber-500" />
                      NHÓM G: NÚT DỊCH VỤ, CSKH & KHÁC
                    </h2>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Chỉnh sửa tên hiển thị các nút bảo hành, tạo lại API key và chọn ngôn ngữ.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {[
                      { key: 'btn_start_warranty', label: '🛡️ Gửi yêu cầu bảo hành', desc: 'Nút gửi ticket bảo hành đơn lỗi', code: 'start_warranty' },
                      { key: 'btn_order_history', label: '🧾 Xem tất cả đơn hàng', desc: 'Nút tra cứu lịch sử mua hàng của khách', code: 'order_history' },
                      { key: 'btn_regenerate_api_key', label: '🔄 Tạo lại API Key', desc: 'Nút cấp lại API Key cho đại lý', code: 'regenerate_api_key' },
                      { key: 'btn_lang_vi', label: '🇻🇳 Tiếng Việt', desc: 'Nút chọn ngôn ngữ Tiếng Việt', code: 'select_lang_vi' },
                      { key: 'btn_lang_en', label: '🇺🇸 English', desc: 'Nút chọn ngôn ngữ English', code: 'select_lang_en' },
                      { key: 'btn_lang_zh', label: '🇨🇳 中文', desc: 'Nút chọn ngôn ngữ 中文', code: 'select_lang_zh' }
                    ].map(btnItem => (
                      <div key={btnItem.key} className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-xs font-black text-zinc-900 dark:text-white">{btnItem.label}</div>
                            <div className="text-[11px] text-zinc-400">{btnItem.desc}</div>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-200 dark:bg-zinc-800 text-amber-600 font-bold border border-zinc-300 dark:border-zinc-700">
                            {btnItem.code}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">🇻🇳 Tiếng Việt:</label>
                            <input
                              type="text"
                              value={getTemplateTextForLang(btnItem.key, 'vi')}
                              onChange={(e) => setTemplateTextForLang(btnItem.key, 'vi', e.target.value)}
                              className="w-full p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500"
                              placeholder="Tên nút tiếng Việt..."
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">🇺🇸 English:</label>
                            <input
                              type="text"
                              value={getTemplateTextForLang(btnItem.key, 'en')}
                              onChange={(e) => setTemplateTextForLang(btnItem.key, 'en', e.target.value)}
                              className="w-full p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500"
                              placeholder="English label..."
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500">🇨🇳 中文:</label>
                            <input
                              type="text"
                              value={getTemplateTextForLang(btnItem.key, 'zh')}
                              onChange={(e) => setTemplateTextForLang(btnItem.key, 'zh', e.target.value)}
                              className="w-full p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500"
                              placeholder="中文名称..."
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Live Phone Mockup Preview for All Scenes */}
            <div className="lg:col-span-5 space-y-4">
              <div className="sticky top-6">
                {/* Preview controls: Lang + Scene */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-3.5 border border-zinc-200 dark:border-zinc-800 shadow-xs mb-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-amber-500" />
                      MÔ PHỎNG GIAO DIỆN TELEGRAM
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPreviewLang('vi')}
                        className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                          previewLang === 'vi' ? 'bg-amber-600 text-white shadow-xs' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                        }`}
                      >
                        🇻🇳 VI
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewLang('en')}
                        className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                          previewLang === 'en' ? 'bg-amber-600 text-white shadow-xs' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                        }`}
                      >
                        🇺🇸 EN
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewLang('zh')}
                        className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                          previewLang === 'zh' ? 'bg-amber-600 text-white shadow-xs' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                        }`}
                      >
                        🇨🇳 ZH
                      </button>
                    </div>
                  </div>

                  {/* Scene Selector */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-zinc-400">Chọn màn hình xem thử:</span>
                    <div className="grid grid-cols-3 gap-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 p-1">
                      {[
                        { id: 'start', label: '🚀 /start' },
                        { id: 'wallet', label: '👛 Ví & Số Dư' },
                        { id: 'deposit', label: '💳 Cổng Nạp' },
                        { id: 'deposit_flow', label: '⚡ Nạp QR' },
                        { id: 'shop_flow', label: '🛍️ Mua Hàng' },
                        { id: 'delivery_flow', label: '📦 Tải Đơn' }
                      ].map(scene => (
                        <button
                          key={scene.id}
                          type="button"
                          onClick={() => setInlinePreviewTab(scene.id as any)}
                          className={`py-1.5 px-1 rounded-lg text-[11px] font-extrabold transition-all truncate text-center ${
                            inlinePreviewTab === scene.id
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                          }`}
                        >
                          {scene.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Telegram Phone Frame */}
                <div className="w-full max-w-[370px] mx-auto rounded-[36px] bg-zinc-950 p-3 shadow-2xl border-4 border-zinc-800">
                  {/* Phone Speaker */}
                  <div className="h-4 flex items-center justify-center mb-1">
                    <div className="w-16 h-1 bg-zinc-800 rounded-full" />
                  </div>

                  {/* Telegram Header */}
                  <div className="flex items-center gap-2.5 px-3 py-2 bg-zinc-900/90 rounded-2xl border border-zinc-800/60 mb-3">
                    <div className="w-7 h-7 rounded-full bg-linear-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white text-[11px] font-black shrink-0 shadow-xs">
                      BOT
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-black text-zinc-100 truncate">Shop Automation Bot</div>
                      <div className="text-[10px] text-amber-500 font-medium">bot • online</div>
                    </div>
                  </div>

                  {/* Telegram Chat Message Body */}
                  <div className="p-3 bg-zinc-900/80 rounded-2xl border border-zinc-800 text-zinc-200 text-xs whitespace-pre-wrap leading-relaxed space-y-2">
                    {inlinePreviewTab === 'start' && (
                      <div>
                        {renderSimulatedText(
                          getStartTextForLang(previewLang) ||
                          (previewLang === 'en' ? 'Welcome to our bot!' : previewLang === 'zh' ? '欢迎使用机器人！' : 'Chào mừng bạn đến với shop!')
                        )}
                        <div className="pt-2 space-y-1.5">
                          {sortedStartRows.map(rowNum => {
                            const rowBtns = (groupedStartButtons[rowNum] || []).filter(b => b.is_active !== false);
                            if (rowBtns.length === 0) return null;
                            return (
                              <div key={rowNum} className="flex gap-1.5">
                                {rowBtns.map(b => (
                                  <div
                                    key={b.id}
                                    className="flex-1 py-2 px-2 text-center rounded-xl bg-zinc-800 text-amber-400 font-bold text-xs shadow-md border border-zinc-700 truncate"
                                  >
                                    {getStartButtonLabelForLang(b, previewLang)}
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {inlinePreviewTab === 'wallet' && (
                      <div>
                        {renderSimulatedText(
                          getTemplateTextForLang('template_wallet_info', previewLang) ||
                          '👛 <b>THÔNG TIN VÍ & SỐ DƯ TÀI KHOẢN</b>\n👤 Khách hàng: <b>@ducdz</b>\n🆔 ID: <code>8202830305</code>\n💰 Số dư: <b>500.000 ₫</b>\n\n👇 Vui lòng chọn thao tác bên dưới:'
                        )}
                        <div className="pt-2 space-y-1.5">
                          {sortedWalletRows.map(rowNum => {
                            const rowBtns = (groupedWalletButtons[rowNum] || []).filter(b => b.is_active !== false);
                            if (rowBtns.length === 0) return null;
                            return (
                              <div key={rowNum} className="flex gap-1.5">
                                {rowBtns.map(b => (
                                  <div
                                    key={b.id}
                                    className="flex-1 py-2 px-2 text-center rounded-xl bg-zinc-800 text-amber-400 font-bold text-xs shadow-md border border-zinc-700 truncate"
                                  >
                                    {getStartButtonLabelForLang(b, previewLang)}
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {inlinePreviewTab === 'deposit' && (
                      <div>
                        <div>
                          {previewLang === 'en'
                            ? '💳 <b>TOP UP YOUR WALLET</b>\n\n⚡ Please select your preferred payment method below:'
                            : previewLang === 'zh'
                            ? '💳 <b>钱包充值</b>\n\n⚡ 请在下方选择充值方式:'
                            : '💳 <b>NẠP TIỀN VÀO VÍ</b>\n\n⚡ Vui lòng chọn phương thức nạp tiền bên dưới:'}
                        </div>
                        <div className="pt-2 space-y-1.5">
                          {sortedDepositRows.map(rowNum => {
                            const rowBtns = (groupedDepositButtons[rowNum] || []).filter(b => b.is_active !== false);
                            if (rowBtns.length === 0) return null;
                            return (
                              <div key={rowNum} className="flex gap-1.5">
                                {rowBtns.map(b => (
                                  <div
                                    key={b.id}
                                    className="flex-1 py-2 px-2 text-center rounded-xl bg-zinc-800 text-amber-400 font-bold text-xs shadow-md border border-zinc-700 truncate"
                                  >
                                    {getStartButtonLabelForLang(b, previewLang)}
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {inlinePreviewTab === 'deposit_flow' && (
                      <div>
                        {renderSimulatedText(
                          getTemplateTextForLang('template_bank_deposit', previewLang) ||
                          '🏦 <b>THÔNG TIN CHUYỂN KHOẢN</b>\n💳 Số TK: <code>1029384756</code>\n📝 Nội dung: <code>NAP 8202830305</code>'
                        )}
                        <div className="pt-2 space-y-1.5">
                          <div className="flex gap-1.5">
                            <div className="flex-1 py-2 px-2 text-center rounded-xl bg-zinc-800 text-amber-400 font-bold text-xs shadow-md border border-zinc-700 truncate">
                              {getTemplateTextForLang('btn_check_payment', previewLang) || '🔍 Kiểm tra thanh toán ngay'}
                            </div>
                          </div>
                          <div className="flex gap-1.5">
                            <div className="flex-1 py-2 px-2 text-center rounded-xl bg-zinc-800 text-amber-400 font-bold text-xs shadow-md border border-zinc-700 truncate">
                              {getTemplateTextForLang('btn_reload_qr', previewLang) || '🔄 Tải lại QR (1 lần)'}
                            </div>
                            <div className="flex-1 py-2 px-2 text-center rounded-xl bg-zinc-800 text-amber-400 font-bold text-xs shadow-md border border-zinc-700 truncate">
                              {getTemplateTextForLang('btn_cancel_qr', previewLang) || '❌ Huỷ mã QR'}
                            </div>
                          </div>
                          <div className="flex gap-1.5">
                            <div className="flex-1 py-2 px-2 text-center rounded-xl bg-zinc-800 text-amber-400 font-bold text-xs shadow-md border border-zinc-700 truncate">
                              {getTemplateTextForLang('btn_back_deposit_options', previewLang) || '↩️ Quay lại Menu Nạp'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {inlinePreviewTab === 'shop_flow' && (
                      <div>
                        <div>
                          🛍️ <b>Netflix Premium 4K UHD (1 Tháng)</b>\n💰 Giá: <b>65.000 ₫</b>\n📦 Tồn kho: <b>42 tài khoản</b>\n\n👇 Chọn số lượng hoặc bấm mua ngay:
                        </div>
                        <div className="pt-2 space-y-1.5">
                          <div className="flex gap-1.5">
                            <div className="flex-1 py-1.5 text-center rounded-xl bg-zinc-800 text-zinc-100 font-bold text-xs border border-zinc-700">1</div>
                            <div className="flex-1 py-1.5 text-center rounded-xl bg-zinc-800 text-zinc-100 font-bold text-xs border border-zinc-700">2</div>
                            <div className="flex-1 py-1.5 text-center rounded-xl bg-zinc-800 text-zinc-100 font-bold text-xs border border-zinc-700">5</div>
                            <div className="flex-1 py-1.5 text-center rounded-xl bg-zinc-800 text-zinc-100 font-bold text-xs border border-zinc-700">10</div>
                          </div>
                          <div className="flex gap-1.5">
                            <div className="flex-1 py-2 px-2 text-center rounded-xl bg-zinc-800 text-amber-400 font-bold text-xs shadow-md border border-zinc-700 truncate">
                              {getTemplateTextForLang('btn_qty_all', previewLang) || '📦 Mua tất cả'}
                            </div>
                            <div className="flex-1 py-2 px-2 text-center rounded-xl bg-zinc-800 text-amber-400 font-bold text-xs shadow-md border border-zinc-700 truncate">
                              {getTemplateTextForLang('btn_qty_custom', previewLang) || '✏️ Tự nhập số lượng'}
                            </div>
                          </div>
                          <div className="flex gap-1.5">
                            <div className="flex-1 py-2 px-2 text-center rounded-xl bg-zinc-800 text-emerald-400 font-bold text-xs shadow-md border border-zinc-700 truncate">
                              {getTemplateTextForLang('btn_confirm_buy', previewLang) || '✅ Xác nhận mua'}
                            </div>
                            <div className="flex-1 py-2 px-2 text-center rounded-xl bg-zinc-800 text-rose-400 font-bold text-xs shadow-md border border-zinc-700 truncate">
                              {getTemplateTextForLang('btn_cancel_buy', previewLang) || '❌ Hủy bỏ'}
                            </div>
                          </div>
                          <div className="flex gap-1.5">
                            <div className="flex-1 py-2 px-2 text-center rounded-xl bg-zinc-800 text-amber-400 font-bold text-xs shadow-md border border-zinc-700 truncate">
                              {getTemplateTextForLang('btn_back_to_categories', previewLang) || '↩️ Quay lại danh mục'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {inlinePreviewTab === 'delivery_flow' && (
                      <div>
                        {renderSimulatedText(
                          getTemplateTextForLang('msg_template_purchase', previewLang) ||
                          '🎉 <b>MUA HÀNG THÀNH CÔNG!</b>\n🧾 Mã đơn: <code>#OD98273</code>\n🎁 Sản phẩm: Netflix Premium 4K'
                        )}
                        <div className="pt-2 space-y-1.5">
                          <div className="flex gap-1.5">
                            <div className="flex-1 py-2 px-2 text-center rounded-xl bg-zinc-800 text-amber-400 font-bold text-xs shadow-md border border-zinc-700 truncate">
                              {getTemplateTextForLang('btn_download_txt', previewLang) || '📥 Tải file txt'}
                            </div>
                            <div className="flex-1 py-2 px-2 text-center rounded-xl bg-zinc-800 text-amber-400 font-bold text-xs shadow-md border border-zinc-700 truncate">
                              {getTemplateTextForLang('btn_download_all', previewLang) || '📥 Tải toàn bộ'}
                            </div>
                          </div>
                          <div className="flex gap-1.5">
                            <div className="flex-1 py-2 px-2 text-center rounded-xl bg-zinc-800 text-amber-400 font-bold text-xs shadow-md border border-zinc-700 truncate">
                              {getTemplateTextForLang('btn_download_combo', previewLang) || '📥 Tải định dạng combo'}
                            </div>
                            <div className="flex-1 py-2 px-2 text-center rounded-xl bg-zinc-800 text-amber-400 font-bold text-xs shadow-md border border-zinc-700 truncate">
                              {getTemplateTextForLang('btn_view_order_detail', previewLang) || '🧾 Xem chi tiết đơn hàng'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: MẪU TIN NHẮN NẠP TIỀN (BINANCE PAY, BANK VIETQR, USDT, DUYỆT NẠP) */}
      {activeTab === 'deposit_templates' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 px-1">
              CHỌN MẪU TIN NHẮN NẠP TIỀN
            </h3>
            {['template_binance_pay', 'template_bank_deposit', 'template_usdt_deposit', 'msg_template_deposit', 'msg_template_deposit_reject'].map(k => {
              const item = templates[k];
              if (!item) return null;
              return (
                <button
                  key={k}
                  onClick={() => setSelectedTemplateKey(k)}
                  className={`w-full p-4 rounded-2xl text-left border transition-all ${
                    selectedTemplateKey === k
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500/80 shadow-md text-amber-900 dark:text-amber-100 font-black'
                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold hover:bg-zinc-50'
                  }`}
                >
                  <div className="text-sm flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-amber-500" />
                    {item.label}
                  </div>
                  <div className="text-[11px] text-zinc-500 font-normal mt-1 line-clamp-2">
                    {item.description}
                  </div>
                </button>
              );
            })}

            {/* Animated Emoji Reference Box */}
            <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-2">
              <span className="text-xs font-extrabold text-amber-500 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                MÃ EMOJI ĐỘNG (TELEGRAM PREMIUM)
              </span>
              <p className="text-[11px] text-zinc-500">
                Bấm vào các nút bên dưới để chèn emoji động Telegram vào vị trí con trỏ:
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {ANIMATED_EMOJIS.map(em => (
                  <button
                    key={em.id}
                    type="button"
                    onClick={() => insertTagToTemplate(`{emoji:${em.id}} `)}
                    className="px-2 py-1 rounded-lg bg-white dark:bg-zinc-900 hover:bg-amber-100 dark:hover:bg-amber-950 text-[11px] font-bold text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 shadow-2xs"
                  >
                    {em.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-6">
            {selectedTemplateKey && templates[selectedTemplateKey] && (
              <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-black text-zinc-900 dark:text-white flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-amber-500" />
                      {templates[selectedTemplateKey].label}
                    </h2>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {templates[selectedTemplateKey].description}
                    </p>
                  </div>
                </div>

                {/* Multilingual Switcher Tabs */}
                <div className="flex items-center justify-between gap-2 p-1.5 rounded-2xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                  <span className="text-xs font-bold text-zinc-500 px-2 flex items-center gap-1.5">
                    <Languages className="w-3.5 h-3.5 text-amber-500" />
                    Ngôn ngữ soạn thảo mẫu:
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setTemplateEditLang('vi')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        templateEditLang === 'vi'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      🇻🇳 Tiếng Việt
                    </button>
                    <button
                      type="button"
                      onClick={() => setTemplateEditLang('en')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        templateEditLang === 'en'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      🇺🇸 English
                    </button>
                    <button
                      type="button"
                      onClick={() => setTemplateEditLang('zh')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        templateEditLang === 'zh'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      🇨🇳 中文
                    </button>
                  </div>
                </div>

                {/* Variable Chips */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-zinc-500">Chèn nhanh biến giá trị:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {templates[selectedTemplateKey].vars?.map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => insertTagToTemplate(v)}
                        className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-amber-100 dark:hover:bg-amber-950 text-xs font-mono font-bold text-amber-700 dark:text-amber-400 border border-zinc-200 dark:border-zinc-700"
                      >
                        {v}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => insertTagToTemplate('<code>{userId}</code>')}
                      className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-amber-100 dark:hover:bg-amber-950 text-xs font-mono font-bold text-blue-600 dark:text-blue-400 border border-zinc-200 dark:border-zinc-700"
                    >
                      &lt;code&gt;...&lt;/code&gt; (Click để copy)
                    </button>
                  </div>
                </div>

                <textarea
                  value={getTemplateTextForLang(selectedTemplateKey, templateEditLang)}
                  onChange={(e) => setTemplateTextForLang(selectedTemplateKey, templateEditLang, e.target.value)}
                  rows={12}
                  className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500 leading-relaxed"
                  placeholder={`Nhập mẫu tin nhắn ${templates[selectedTemplateKey].label} (${templateEditLang.toUpperCase()})...`}
                />

                {/* Live Preview Box */}
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" />
                    XEM TRƯỚC TIN NHẮN THỰC TẾ ({templateEditLang.toUpperCase()})
                  </span>
                  <div className="p-4 rounded-2xl bg-zinc-950 text-zinc-100 border border-zinc-800 text-xs font-sans whitespace-pre-wrap leading-relaxed">
                    {renderSimulatedText(getTemplateTextForLang(selectedTemplateKey, templateEditLang))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: MẪU TIN NHẮN ĐƠN HÀNG & MUA HÀNG */}
      {activeTab === 'order_templates' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 px-1">
              CHỌN MẪU TIN NHẮN ĐƠN HÀNG
            </h3>
            {['msg_template_purchase', 'msg_template_delivery', 'msg_template_order_placed', 'msg_template_order_refund', 'msg_template_new_order_admin'].map(k => {
              const item = templates[k];
              if (!item) return null;
              return (
                <button
                  key={k}
                  onClick={() => setSelectedTemplateKey(k)}
                  className={`w-full p-3.5 rounded-2xl text-left border transition-all ${
                    selectedTemplateKey === k
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500/80 shadow-md text-amber-900 dark:text-amber-100 font-black'
                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold hover:bg-zinc-50'
                  }`}
                >
                  <div className="text-xs flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-amber-500" />
                    {item.label}
                  </div>
                  <div className="text-[11px] text-zinc-500 font-normal mt-1 line-clamp-2">
                    {item.description}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-8 space-y-6">
            {selectedTemplateKey && templates[selectedTemplateKey] && (
              <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
                <div>
                  <h2 className="text-base font-black text-zinc-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-amber-500" />
                    {templates[selectedTemplateKey].label}
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {templates[selectedTemplateKey].description}
                  </p>
                </div>

                {/* Multilingual Switcher Tabs for Order Template */}
                <div className="flex items-center justify-between gap-2 p-1.5 rounded-2xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                  <span className="text-xs font-bold text-zinc-500 px-2 flex items-center gap-1.5">
                    <Languages className="w-3.5 h-3.5 text-amber-500" />
                    Ngôn ngữ soạn thảo mẫu:
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setTemplateEditLang('vi')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        templateEditLang === 'vi'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      🇻🇳 Tiếng Việt
                    </button>
                    <button
                      type="button"
                      onClick={() => setTemplateEditLang('en')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        templateEditLang === 'en'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      🇺🇸 English
                    </button>
                    <button
                      type="button"
                      onClick={() => setTemplateEditLang('zh')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        templateEditLang === 'zh'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      🇨🇳 中文
                    </button>
                  </div>
                </div>

                {/* Variable Chips */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-zinc-500">Chèn nhanh biến:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {templates[selectedTemplateKey].vars?.map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => insertTagToTemplate(v)}
                        className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-amber-100 dark:hover:bg-amber-950 text-xs font-mono font-bold text-amber-700 dark:text-amber-400 border border-zinc-200 dark:border-zinc-700"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  value={getTemplateTextForLang(selectedTemplateKey, templateEditLang)}
                  onChange={(e) => setTemplateTextForLang(selectedTemplateKey, templateEditLang, e.target.value)}
                  rows={10}
                  className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500 leading-relaxed"
                  placeholder={`Nhập mẫu tin nhắn ${templates[selectedTemplateKey].label} (${templateEditLang.toUpperCase()})...`}
                />

                {/* Live Preview Box */}
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" />
                    XEM TRƯỚC TIN NHẮN THỰC TẾ ({templateEditLang.toUpperCase()})
                  </span>
                  <div className="p-4 rounded-2xl bg-zinc-950 text-zinc-100 border border-zinc-800 text-xs font-sans whitespace-pre-wrap leading-relaxed">
                    {renderSimulatedText(getTemplateTextForLang(selectedTemplateKey, templateEditLang))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: MẪU TIN NHẮN VÍ, CSKH HỖ TRỢ, BẢO HÀNH & API */}
      {activeTab === 'service_templates' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 px-1">
              CHỌN MẪU DỊCH VỤ & HỖ TRỢ
            </h3>
            {['template_wallet_info', 'template_support_info', 'msg_support_received', 'msg_template_support', 'template_warranty_info', 'msg_template_warranty_request', 'template_api_info', 'template_checkin_info', 'template_deposit_history', 'msg_template_welcome'].map(k => {
              const item = templates[k];
              if (!item) return null;
              return (
                <button
                  key={k}
                  onClick={() => setSelectedTemplateKey(k)}
                  className={`w-full p-3.5 rounded-2xl text-left border transition-all ${
                    selectedTemplateKey === k
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500/80 shadow-md text-amber-900 dark:text-amber-100 font-black'
                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold hover:bg-zinc-50'
                  }`}
                >
                  <div className="text-xs flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-500" />
                    {item.label}
                  </div>
                  <div className="text-[11px] text-zinc-500 font-normal mt-1 line-clamp-2">
                    {item.description}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-8 space-y-6">
            {selectedTemplateKey && templates[selectedTemplateKey] && (
              <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
                <div>
                  <h2 className="text-base font-black text-zinc-900 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-amber-500" />
                    {templates[selectedTemplateKey].label}
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {templates[selectedTemplateKey].description}
                  </p>
                </div>

                {/* Multilingual Switcher Tabs */}
                <div className="flex items-center justify-between gap-2 p-1.5 rounded-2xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                  <span className="text-xs font-bold text-zinc-500 px-2 flex items-center gap-1.5">
                    <Languages className="w-3.5 h-3.5 text-amber-500" />
                    Ngôn ngữ soạn thảo mẫu:
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setTemplateEditLang('vi')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        templateEditLang === 'vi'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      🇻🇳 Tiếng Việt
                    </button>
                    <button
                      type="button"
                      onClick={() => setTemplateEditLang('en')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        templateEditLang === 'en'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      🇺🇸 English
                    </button>
                    <button
                      type="button"
                      onClick={() => setTemplateEditLang('zh')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        templateEditLang === 'zh'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      🇨🇳 中文
                    </button>
                  </div>
                </div>

                {/* Variable Chips */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-zinc-500">Chèn nhanh biến:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {templates[selectedTemplateKey].vars?.map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => insertTagToTemplate(v)}
                        className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-amber-100 dark:hover:bg-amber-950 text-xs font-mono font-bold text-amber-700 dark:text-amber-400 border border-zinc-200 dark:border-zinc-700"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  value={getTemplateTextForLang(selectedTemplateKey, templateEditLang)}
                  onChange={(e) => setTemplateTextForLang(selectedTemplateKey, templateEditLang, e.target.value)}
                  rows={10}
                  className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500 leading-relaxed"
                  placeholder={`Nhập mẫu tin nhắn ${templates[selectedTemplateKey].label} (${templateEditLang.toUpperCase()})...`}
                />

                {/* Live Preview Box */}
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" />
                    XEM TRƯỚC TIN NHẮN THỰC TẾ ({templateEditLang.toUpperCase()})
                  </span>
                  <div className="p-4 rounded-2xl bg-zinc-950 text-zinc-100 border border-zinc-800 text-xs font-sans whitespace-pre-wrap leading-relaxed">
                    {renderSimulatedText(getTemplateTextForLang(selectedTemplateKey, templateEditLang))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: MẪU TIN NHẮN THÔNG BÁO SẢN PHẨM MỚI & NẠP DATA / BỔ SUNG KHO */}
      {activeTab === 'notify_templates' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 px-1">
              CHỌN MẪU THÔNG BÁO SẢN PHẨM & KHO
            </h3>
            {['template_new_product_notify', 'template_restock_notify', 'btn_view_and_buy'].map(k => {
              const item = templates[k];
              if (!item) return null;
              return (
                <button
                  key={k}
                  onClick={() => setSelectedTemplateKey(k)}
                  className={`w-full p-3.5 rounded-2xl text-left border transition-all ${
                    selectedTemplateKey === k
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500/80 shadow-md text-amber-900 dark:text-amber-100 font-black'
                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold hover:bg-zinc-50'
                  }`}
                >
                  <div className="text-xs flex items-center gap-2">
                    <Bell className="w-4 h-4 text-amber-500" />
                    {item.label}
                  </div>
                  <div className="text-[11px] text-zinc-500 font-normal mt-1 line-clamp-2">
                    {item.description}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-8 space-y-6">
            {selectedTemplateKey && templates[selectedTemplateKey] && (
              <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
                <div>
                  <h2 className="text-base font-black text-zinc-900 dark:text-white flex items-center gap-2">
                    <Bell className="w-5 h-5 text-amber-500" />
                    {templates[selectedTemplateKey].label}
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {templates[selectedTemplateKey].description}
                  </p>
                </div>

                {/* Multilingual Switcher Tabs */}
                <div className="flex items-center justify-between gap-2 p-1.5 rounded-2xl bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                  <span className="text-xs font-bold text-zinc-500 px-2 flex items-center gap-1.5">
                    <Languages className="w-3.5 h-3.5 text-amber-500" />
                    Ngôn ngữ soạn thảo mẫu:
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setTemplateEditLang('vi')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        templateEditLang === 'vi'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      🇻🇳 Tiếng Việt
                    </button>
                    <button
                      type="button"
                      onClick={() => setTemplateEditLang('en')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        templateEditLang === 'en'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      🇺🇸 English
                    </button>
                    <button
                      type="button"
                      onClick={() => setTemplateEditLang('zh')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        templateEditLang === 'zh'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      🇨🇳 中文
                    </button>
                  </div>
                </div>

                {/* Variable Chips */}
                {templates[selectedTemplateKey].vars && templates[selectedTemplateKey].vars.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-zinc-500">Chèn nhanh biến:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {templates[selectedTemplateKey].vars?.map(v => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => insertTagToTemplate(v)}
                          className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-amber-100 dark:hover:bg-amber-950 text-xs font-mono font-bold text-amber-700 dark:text-amber-400 border border-zinc-200 dark:border-zinc-700"
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Telegram Custom Animated Emojis */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-zinc-500">Gắn Emoji Động Telegram:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {ANIMATED_EMOJIS.map(em => (
                      <button
                        key={em.id}
                        type="button"
                        onClick={() => insertTagToTemplate(`{emoji:${em.id}}`)}
                        className="px-2.5 py-1 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-xs font-semibold text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
                      >
                        {em.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Textarea */}
                <textarea
                  value={getTemplateTextForLang(selectedTemplateKey, templateEditLang)}
                  onChange={(e) => setTemplateTextForLang(selectedTemplateKey, templateEditLang, e.target.value)}
                  rows={selectedTemplateKey.startsWith('btn_') ? 2 : 7}
                  className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  placeholder={`Nhập mẫu tin nhắn ${templates[selectedTemplateKey].label} (${templateEditLang.toUpperCase()})...`}
                />

                {/* Live Preview Box */}
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" />
                    {selectedTemplateKey.startsWith('btn_')
                      ? `XEM TRƯỚC NÚT BẤM TELEGRAM (${templateEditLang.toUpperCase()})`
                      : `XEM TRƯỚC TIN NHẮN THỰC TẾ (${templateEditLang.toUpperCase()})`}
                  </span>
                  {selectedTemplateKey.startsWith('btn_') ? (
                    <div className="p-4 rounded-2xl bg-zinc-950 text-zinc-100 border border-zinc-800 flex flex-col items-center justify-center gap-2">
                      <div className="w-full max-w-sm py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm text-center">
                        <span>{renderSimulatedText(getTemplateTextForLang(selectedTemplateKey, templateEditLang))}</span>
                      </div>
                      <span className="text-[11px] text-zinc-500 italic">
                        (Mô phỏng nút bấm Inline Keyboard trên Telegram kèm Animated Custom Emoji)
                      </span>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-zinc-950 text-zinc-100 border border-zinc-800 text-xs font-sans whitespace-pre-wrap leading-relaxed">
                      {renderSimulatedText(getTemplateTextForLang(selectedTemplateKey, templateEditLang))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Add/Edit Reply Keyboard Button with Multilingual Fields */}
      {isKbModalOpen && mounted && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-4 my-auto animate-in fade-in zoom-in-95">
            <h3 className="text-base font-black text-zinc-900 dark:text-white flex items-center gap-2">
              <Keyboard className="w-5 h-5 text-amber-500" />
              {editingKbBtn ? 'SỬA NÚT BÀN PHÍM CHÍNH' : 'THÊM NÚT BÀN PHÍM CHÍNH'}
            </h3>

            <form onSubmit={handleSaveKbButton} className="space-y-4">
              {/* Multilingual Name Inputs */}
              <div className="space-y-3 p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                <span className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Languages className="w-3.5 h-3.5" />
                  TÊN NÚT BẤM THEO NGÔN NGỮ
                </span>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <span>🇻🇳 Tiếng Việt (Mặc định)</span>
                  </label>
                  <input
                    type="text"
                    value={kbBtnTextVi}
                    onChange={(e) => setKbBtnTextVi(e.target.value)}
                    placeholder="Ví dụ: Sản phẩm, Hỗ trợ, Ví..."
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm font-bold text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                      <span>🇺🇸 English</span>
                    </label>
                    <input
                      type="text"
                      value={kbBtnTextEn}
                      onChange={(e) => setKbBtnTextEn(e.target.value)}
                      placeholder="e.g. Products, Support..."
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                      <span>🇨🇳 中文</span>
                    </label>
                    <input
                      type="text"
                      value={kbBtnTextZh}
                      onChange={(e) => setKbBtnTextZh(e.target.value)}
                      placeholder="例: 产品, 客服支持..."
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Hành động thực hiện khi người dùng bấm nút
                </label>
                <select
                  value={kbBtnAction}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setKbBtnAction(val);
                    const found = KEYBOARD_ACTION_PRESETS.find(p => p.code === val);
                    if (found && !editingKbBtn) {
                      setKbBtnTextVi(found.defaultVi);
                      setKbBtnTextEn(found.defaultEn);
                      setKbBtnTextZh(found.defaultZh);
                    }
                  }}
                  className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                >
                  {KEYBOARD_ACTION_PRESETS.map(preset => (
                    <option key={preset.code} value={preset.code}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>

              {kbBtnAction === 'custom_text' && (
                <div className="space-y-3 p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                  <span className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    NỘI DUNG TIN NHẮN PHẢN HỒI (ĐA NGÔN NGỮ)
                  </span>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      🇻🇳 Tiếng Việt:
                    </label>
                    <textarea
                      value={kbBtnCustomTextVi}
                      onChange={(e) => {
                        setKbBtnCustomTextVi(e.target.value);
                        setKbBtnCustomText(e.target.value);
                      }}
                      rows={2}
                      placeholder="Nhập nội dung tin nhắn tiếng Việt gửi khách..."
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      🇺🇸 English:
                    </label>
                    <textarea
                      value={kbBtnCustomTextEn}
                      onChange={(e) => setKbBtnCustomTextEn(e.target.value)}
                      rows={2}
                      placeholder="English message sent to user..."
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      🇨🇳 中文:
                    </label>
                    <textarea
                      value={kbBtnCustomTextZh}
                      onChange={(e) => setKbBtnCustomTextZh(e.target.value)}
                      rows={2}
                      placeholder="发送给用户的中文消息..."
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              )}

              {kbBtnAction !== 'custom_text' && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2">
                  <span className="leading-tight">
                    💡 Chức năng <b>{KEYBOARD_ACTION_PRESETS.find(p => p.code === kbBtnAction)?.label}</b> có mẫu tin nhắn riêng biệt.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsKbModalOpen(false);
                      if (kbBtnAction === 'wallet') {
                        setActiveTab('service_templates');
                        setSelectedTemplateKey('template_wallet_info');
                      } else if (kbBtnAction === 'support') {
                        setActiveTab('service_templates');
                        setSelectedTemplateKey('template_support_info');
                      } else if (kbBtnAction === 'api') {
                        setActiveTab('service_templates');
                        setSelectedTemplateKey('template_api_info');
                      } else if (kbBtnAction === 'warranty') {
                        setActiveTab('service_templates');
                        setSelectedTemplateKey('template_warranty_info');
                      } else if (kbBtnAction === 'checkin') {
                        setActiveTab('service_templates');
                        setSelectedTemplateKey('template_checkin_info');
                      } else if (kbBtnAction === 'deposit') {
                        setActiveTab('deposit_templates');
                        setSelectedTemplateKey('template_binance_pay');
                      } else if (kbBtnAction === 'history') {
                        setActiveTab('service_templates');
                        setSelectedTemplateKey('template_deposit_history');
                      } else if (kbBtnAction === 'start') {
                        setActiveTab('start_menu');
                      }
                    }}
                    className="shrink-0 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] transition-colors cursor-pointer"
                  >
                    👉 Sửa mẫu tin nhắn
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Vị trí Hàng (Row)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={kbBtnRow}
                    onChange={(e) => setKbBtnRow(Number(e.target.value))}
                    className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Trạng thái
                  </label>
                  <button
                    type="button"
                    onClick={() => setKbBtnActive(!kbBtnActive)}
                    className={`w-full p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border ${
                      kbBtnActive
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border-emerald-500/30'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-zinc-300 dark:border-zinc-700'
                    }`}
                  >
                    {kbBtnActive ? '✅ Đang bật' : '❌ Đang tắt'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsKbModalOpen(false)}
                  className="rounded-xl text-xs font-bold"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs px-5"
                >
                  {editingKbBtn ? 'Cập Nhật Nút' : 'Thêm Nút'}
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Add/Edit Inline Button with Multilingual Fields */}
      {isStartModalOpen && mounted && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-4 my-auto animate-in fade-in zoom-in-95">
            <h3 className="text-base font-black text-zinc-900 dark:text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-500" />
              {editingStartBtn
                ? (inlineModalTarget === 'wallet' ? 'SỬA NÚT VÍ & SỐ DƯ' : inlineModalTarget === 'deposit' ? 'SỬA NÚT CHỌN NẠP TIỀN' : 'SỬA NÚT INLINE /START')
                : (inlineModalTarget === 'wallet' ? 'THÊM NÚT VÍ & SỐ DƯ' : inlineModalTarget === 'deposit' ? 'THÊM NÚT CHỌN NẠP TIỀN' : 'THÊM NÚT INLINE /START')}
            </h3>

            <form onSubmit={handleSaveStartButton} className="space-y-4">
              {/* Multilingual Name Inputs */}
              <div className="space-y-3 p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                <span className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Languages className="w-3.5 h-3.5" />
                  TÊN NÚT BẤM THEO NGÔN NGỮ
                </span>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <span>🇻🇳 Tiếng Việt (Mặc định)</span>
                  </label>
                  <input
                    type="text"
                    value={startBtnTextVi}
                    onChange={(e) => setStartBtnTextVi(e.target.value)}
                    placeholder="Ví dụ: 🏦 Ngân hàng (Bank), ➕ Nạp tiền vào ví..."
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm font-bold text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                      <span>🇺🇸 English</span>
                    </label>
                    <input
                      type="text"
                      value={startBtnTextEn}
                      onChange={(e) => setStartBtnTextEn(e.target.value)}
                      placeholder="e.g. 🏦 Bank Transfer..."
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                      <span>🇨🇳 中文</span>
                    </label>
                    <input
                      type="text"
                      value={startBtnTextZh}
                      onChange={(e) => setStartBtnTextZh(e.target.value)}
                      placeholder="例: 🏦 银行转账..."
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Loại nút bấm
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStartBtnType('url')}
                    className={`p-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border ${
                      startBtnType === 'url'
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    🔗 Mở Link URL Web
                  </button>
                  <button
                    type="button"
                    onClick={() => setStartBtnType('callback')}
                    className={`p-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border ${
                      startBtnType === 'callback'
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    ⚡ Lệnh Bot (Callback)
                  </button>
                </div>
              </div>

              {startBtnType === 'url' ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Đường Link URL (https://...)
                  </label>
                  <input
                    type="url"
                    value={startBtnUrl}
                    onChange={(e) => setStartBtnUrl(e.target.value)}
                    placeholder="https://t.me/..."
                    className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Chọn chức năng Bot có sẵn
                  </label>
                  <select
                    value={isCustomCallback ? 'custom' : startBtnUrl}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'custom') {
                        setIsCustomCallback(true);
                        setStartBtnUrl('');
                      } else {
                        setIsCustomCallback(false);
                        setStartBtnUrl(val);

                        // Tự động gợi ý tên nút bấm đa ngôn ngữ
                        const foundPreset = (inlineModalTarget === 'deposit' ? DEPOSIT_CALLBACK_PRESETS : inlineModalTarget === 'wallet' ? WALLET_CALLBACK_PRESETS : []).find(p => p.code === val) || CALLBACK_PRESETS.find(p => p.code === val);
                        if (foundPreset) {
                          setStartBtnTextVi(foundPreset.defaultText);
                          if (foundPreset.defaultTextEn) setStartBtnTextEn(foundPreset.defaultTextEn);
                          if (foundPreset.defaultTextZh) setStartBtnTextZh(foundPreset.defaultTextZh);
                        } else if (val.startsWith('category_products:')) {
                          const catId = Number(val.replace('category_products:', ''));
                          const cat = categories.find(c => c.id === catId);
                          if (cat) {
                            setStartBtnTextVi(`📁 ${cat.name}`);
                            setStartBtnTextEn(`📁 ${cat.name}`);
                            setStartBtnTextZh(`📁 ${cat.name}`);
                          }
                        } else if (val.startsWith('view_product:')) {
                          const prodId = Number(val.replace('view_product:', ''));
                          const prod = products.find(p => p.id === prodId);
                          if (prod) {
                            setStartBtnTextVi(`📦 ${prod.name}`);
                            setStartBtnTextEn(`📦 ${prod.name}`);
                            setStartBtnTextZh(`📦 ${prod.name}`);
                          }
                        }
                      }
                    }}
                    className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  >
                    {inlineModalTarget === 'deposit' && (
                      <optgroup label="💳 Chức Năng Nạp Tiền & Thanh Toán">
                        {DEPOSIT_CALLBACK_PRESETS.map(preset => (
                          <option key={`dep_${preset.code}`} value={preset.code}>
                            {preset.label}
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {inlineModalTarget === 'wallet' && (
                      <optgroup label="👛 Chức Năng Ví & Dịch Vụ">
                        {WALLET_CALLBACK_PRESETS.map(preset => (
                          <option key={`wal_${preset.code}`} value={preset.code}>
                            {preset.label}
                          </option>
                        ))}
                      </optgroup>
                    )}

                    <optgroup label="🌟 Tất Cả Chức Năng Hệ Thống">
                      {CALLBACK_PRESETS.map(preset => (
                        <option key={preset.code} value={preset.code}>
                          {preset.label}
                        </option>
                      ))}
                    </optgroup>

                    {categories.length > 0 && (
                      <optgroup label="📁 Mở Trực Tiếp Danh Mục Sản Phẩm">
                        {categories.map(cat => (
                          <option key={`cat_${cat.id}`} value={`category_products:${cat.id}`}>
                            📁 Danh Mục: {cat.emoji ? `${cat.emoji} ` : ''}{cat.name}
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {products.length > 0 && (
                      <optgroup label="📦 Mở Trực Tiếp Sản Phẩm Cụ Thể">
                        {products.map(p => (
                          <option key={`prod_${p.id}`} value={`view_product:${p.id}`}>
                            📦 Sản Phẩm: {p.name}
                          </option>
                        ))}
                      </optgroup>
                    )}

                    <optgroup label="⚙️ Tùy Chỉnh Nâng Cao">
                      <option value="custom">✏️ Nhập Callback Data thủ công...</option>
                    </optgroup>
                  </select>

                  {isCustomCallback && (
                    <input
                      type="text"
                      value={startBtnUrl}
                      onChange={(e) => setStartBtnUrl(e.target.value)}
                      placeholder="Nhập callback_data..."
                      className="w-full p-3 mt-2 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Vị trí Hàng (Row)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={startBtnRow}
                    onChange={(e) => setStartBtnRow(Number(e.target.value))}
                    className="w-full p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Trạng thái
                  </label>
                  <button
                    type="button"
                    onClick={() => setStartBtnActive(!startBtnActive)}
                    className={`w-full p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border ${
                      startBtnActive
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border-emerald-500/30'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-zinc-300 dark:border-zinc-700'
                    }`}
                  >
                    {startBtnActive ? '✅ Đang bật' : '❌ Đang tắt'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsStartModalOpen(false)}
                  className="rounded-xl text-xs font-bold"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs px-5"
                >
                  {editingStartBtn ? 'Cập Nhật' : 'Thêm Nút'}
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
