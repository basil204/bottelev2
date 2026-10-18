'use client';

import React, { useEffect, useState } from 'react';
import {
  Plug, Plus, Play, Edit3, Trash2, CheckCircle2, AlertCircle, RefreshCw,
  Code, Send, ArrowRight, Eye, ShieldAlert, Sparkles, Layers, Sliders,
  HelpCircle, Copy, ExternalLink, Check, ChevronDown, ChevronUp,
  LayoutGrid, Activity, Compass, Cpu, ArrowDownRight, Globe, Smartphone,
  CreditCard, Key, Mail, ShieldCheck, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { VisualFlowBuilder, WorkflowConfig } from '@/components/api-workflows/VisualFlowBuilder';

interface InputField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'url';
  placeholder?: string;
  description?: string;
  required: boolean;
}

interface ApiWorkflow {
  id: number;
  name: string;
  code: string;
  icon: string;
  category_id: number | null;
  description: string;
  price_vnd: number;
  price_usdt: number;
  api_url: string;
  http_method: string;
  headers_json: string;
  body_template: string;
  input_fields_json: string | InputField[];
  response_type: string;
  response_data_path: string;
  response_success_condition: string;
  success_message_template: string;
  show_in_menu: number;
  menu_row: number;
  is_active: number;
  created_at: string;
}

export default function ApiWorkflowsPage() {
  const [workflows, setWorkflows] = useState<ApiWorkflow[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // View Mode: 'list' | 'canvas' | 'marketplace'
  const [viewMode, setViewMode] = useState<'list' | 'canvas' | 'marketplace'>('list');

  // Modal / Editor State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'api' | 'inputs' | 'output' | 'test'>('general');
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    icon: '⚡',
    category_id: '' as string | number,
    description: '',
    price_vnd: 10000,
    price_usdt: 0.5,
    api_url: '',
    http_method: 'POST',
    headers_json: '{\n  "Content-Type": "application/json"\n}',
    body_template: '{\n  "userId": "{user_id}",\n  "customInput": "{input_1}"\n}',
    input_fields: [] as InputField[],
    response_type: 'json',
    response_data_path: 'data',
    response_success_condition: 'status == 200 || success == true',
    success_message_template: '✅ **GIAO DỊCH QUA API THÀNH CÔNG!**\n\n📦 **Dịch vụ:** {name}\n🧾 **Mã đơn:** `{invoice_code}`\n💰 **Đã thanh toán:** `{price_formatted}`\n\n📋 **Kết quả nhận được:**\n```\n{data}\n```\n\nCảm ơn quý khách đã tin tưởng sử dụng dịch vụ!',
    show_in_menu: 1,
    menu_row: 1,
    is_active: 1
  });

  // Test Runner State
  const [testVariables, setTestVariables] = useState<Record<string, string>>({
    user_id: '999999999',
    invoice_code: 'WF-TEST-123456',
    price_formatted: '10.000 đ'
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  // Live Inspector State
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [inspectorCurl, setInspectorCurl] = useState('');
  const [inspecting, setInspecting] = useState(false);
  const [inspectorResult, setInspectorResult] = useState<any>(null);

  // Visual Builder Modal State
  const [isVisualBuilderOpen, setIsVisualBuilderOpen] = useState(false);

  // AI Auto-Builder State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGeneratedConfig, setAiGeneratedConfig] = useState<any>(null);
  const [aiSource, setAiSource] = useState<'gemini-ai' | 'smart-heuristic-parser' | null>(null);

  // 1-Click Provider Marketplace Templates
  const MARKETPLACE_TEMPLATES = [
    {
      id: 'viotp_sim',
      title: '📱 ViOTP / ChoThueSimCode (Thuê SIM OTP)',
      icon: '📱',
      description: 'Tự động lấy số điện thoại thuê sim và trả mã OTP cho khách hàng',
      category: 'Sim & OTP',
      config: {
        name: 'Thuê SIM Nhận Mã OTP (ViOTP)',
        code: 'viotp_rent_sim',
        icon: '📱',
        price_vnd: 5000,
        price_usdt: 0.25,
        api_url: 'https://api.viotp.com/request/getv2?token=YOUR_VIOTP_API_KEY&serviceId={service_id}',
        http_method: 'GET',
        headers_json: '{\n  "Content-Type": "application/json"\n}',
        body_template: '{}',
        input_fields: [
          { name: 'service_id', label: 'Mã Dịch Vụ Cần Lấy OTP (1: Telegram, 2: Gmail, 3: Facebook, 11: Zalo, 43: TikTok)', type: 'number', placeholder: '1', description: 'Xem ID tại bảng giá ViOTP', required: true }
        ],
        response_data_path: 'data',
        response_success_condition: 'status_code == 200',
        success_message_template: '📱 **THUÊ SỐ NHẬN MÃ OTP THÀNH CÔNG!**\n\n🧾 **Mã đơn:** `{invoice_code}`\n💰 **Thanh toán:** `{price_formatted}`\n\n📞 **Số điện thoại nhận:** `{data.phone_number}`\n🆔 **Request ID:** `{data.request_id}`\n\n_Vui lòng dùng số này để gửi yêu cầu mã. Bot sẽ tự cập nhật khi có tin nhắn!_',
        show_in_menu: 1,
        menu_row: 1,
        is_active: 1
      }
    },
    {
      id: 'proxy_residential',
      title: '🌐 ProxyAZ / Proxy Xoay Dân Cư',
      icon: '🌐',
      description: 'Mua Proxy xoay tự động theo quốc gia bàn giao IP:PORT:USER:PASS',
      category: 'Proxy & Mạng',
      config: {
        name: 'Mua Proxy Xoay Dân Cư HTTP/SOCKS5',
        code: 'buy_proxy_residential',
        icon: '🌐',
        price_vnd: 15000,
        price_usdt: 0.7,
        api_url: 'https://api.proxyprovider.com/v1/buy_proxy',
        http_method: 'POST',
        headers_json: '{\n  "Content-Type": "application/json",\n  "Authorization": "Bearer YOUR_PROXY_API_KEY"\n}',
        body_template: '{\n  "country": "{country}",\n  "protocol": "http",\n  "quantity": {quantity},\n  "customer_id": "{user_id}"\n}',
        input_fields: [
          { name: 'country', label: 'Quốc gia Proxy (VD: vn, us, sg, jp)', type: 'text', placeholder: 'vn', description: 'Mã quốc gia 2 ký tự', required: true },
          { name: 'quantity', label: 'Số lượng Proxy cần mua', type: 'number', placeholder: '1', description: 'Tối thiểu 1', required: true }
        ],
        response_data_path: 'data.proxies',
        response_success_condition: 'status == 200 || success == true',
        success_message_template: '🌐 **BÀN GIAO PROXY DÂN CƯ THÀNH CÔNG!**\n\n🧾 **Mã đơn:** `{invoice_code}`\n🌍 **Quốc gia:** `{country}`\n💰 **Thanh toán:** `{price_formatted}`\n\n📋 **Danh sách Proxy (IP:PORT:USER:PASS):**\n```\n{data}\n```\n\n_Lưu ý: Proxy có thời hạn xoay 30 phút/lần._',
        show_in_menu: 1,
        menu_row: 1,
        is_active: 1
      }
    },
    {
      id: 'thesieure_card',
      title: '💳 TheSieuRe (Gạch Thẻ Cào Tự Động)',
      icon: '💳',
      description: 'Nạp thẻ cào Viettel, Vina, Mobi tự động qua cổng gạch thẻ TheSieuRe',
      category: 'Thẻ Cào & Topup',
      config: {
        name: 'Nạp Thẻ Cào Điện Thoại Tự Động',
        code: 'thesieure_topup_card',
        icon: '💳',
        price_vnd: 0,
        price_usdt: 0,
        api_url: 'https://thesieure.com/chargingws/v2',
        http_method: 'POST',
        headers_json: '{\n  "Content-Type": "application/json"\n}',
        body_template: '{\n  "partner_id": "YOUR_PARTNER_ID",\n  "telco": "{telco}",\n  "code": "{card_code}",\n  "serial": "{card_serial}",\n  "amount": {card_amount},\n  "request_id": "{invoice_code}"\n}',
        input_fields: [
          { name: 'telco', label: 'Nhà mạng (VIETTEL, VINAPHONE, MOBIFONE)', type: 'text', placeholder: 'VIETTEL', required: true },
          { name: 'card_amount', label: 'Mệnh giá thẻ (10000, 20000, 50000, 100000, 200000, 500000)', type: 'number', placeholder: '50000', required: true },
          { name: 'card_serial', label: 'Số Serial thẻ', type: 'text', placeholder: '1000123456789', required: true },
          { name: 'card_code', label: 'Mã số thẻ cào (Mã PIN)', type: 'text', placeholder: '12345678901234', required: true }
        ],
        response_data_path: 'data',
        response_success_condition: 'status == 200 || status == 99',
        success_message_template: '💳 **ĐÃ GỬI THẺ CÀO LÊN HỆ THỐNG XỬ LÝ!**\n\n🧾 **Mã giao dịch:** `{invoice_code}`\n📱 **Nhà mạng:** `{telco}`\n💵 **Mệnh giá:** `{card_amount} VNĐ`\n\n⏳ Hệ thống đang kiểm tra và nạp tiền vào ví của bạn trong 10 - 60 giây!',
        show_in_menu: 1,
        menu_row: 2,
        is_active: 1
      }
    },
    {
      id: 'smm_panel',
      title: '🚀 SMM Panel (Buff Sub / Like / View MXH)',
      icon: '🚀',
      description: 'Tăng tương tác Facebook, TikTok, Instagram, YouTube qua API SMM',
      category: 'Social Media',
      config: {
        name: 'Buff Tương Tác MXH (Like / Sub / View)',
        code: 'smm_order_social',
        icon: '🚀',
        price_vnd: 20000,
        price_usdt: 1.0,
        api_url: 'https://smmpanel.com/api/v2',
        http_method: 'POST',
        headers_json: '{\n  "Content-Type": "application/json"\n}',
        body_template: '{\n  "key": "YOUR_SMM_API_KEY",\n  "action": "add",\n  "service": {service_id},\n  "link": "{target_link}",\n  "quantity": {quantity}\n}',
        input_fields: [
          { name: 'service_id', label: 'Mã gói dịch vụ SMM (VD: 101 cho Like, 102 cho Follow)', type: 'number', placeholder: '101', required: true },
          { name: 'target_link', label: 'Đường dẫn bài viết / Profile cần tăng', type: 'url', placeholder: 'https://facebook.com/...', required: true },
          { name: 'quantity', label: 'Số lượng tương tác', type: 'number', placeholder: '500', required: true }
        ],
        response_data_path: 'order',
        response_success_condition: 'status == 200 || order > 0',
        success_message_template: '🚀 **ĐÃ TẠO ĐƠN BUFF TƯƠNG TÁC THÀNH CÔNG!**\n\n🧾 **Mã đơn:** `{invoice_code}`\n🆔 **Order SMM:** `#{data}`\n🔗 **Mục tiêu:** `{target_link}`\n📊 **Số lượng:** `{quantity}`\n💰 **Thanh toán:** `{price_formatted}`\n\nĐơn hàng sẽ bắt đầu chạy sau 1 - 5 phút!',
        show_in_menu: 1,
        menu_row: 2,
        is_active: 1
      }
    },
    {
      id: 'netflix_key',
      title: '🎬 Key Bản Quyền / Tài Khoản VIP Tự Động',
      icon: '🎬',
      description: 'Mua tài khoản Netflix, Spotify, ChatGPT Plus, Canva Pro hoặc Key Windows',
      category: 'Tài Khoản & Key',
      config: {
        name: 'Mua Gói VIP Tài Khoản / Key Bản Quyền',
        code: 'buy_license_vip',
        icon: '🎬',
        price_vnd: 69000,
        price_usdt: 3.0,
        api_url: 'https://license-api.com/v1/order',
        http_method: 'POST',
        headers_json: '{\n  "Content-Type": "application/json",\n  "X-API-Key": "YOUR_LICENSE_KEY"\n}',
        body_template: '{\n  "package_id": "{package_id}",\n  "customer_id": "{user_id}",\n  "customer_email": "{customer_email}"\n}',
        input_fields: [
          { name: 'package_id', label: 'Mã gói tài khoản (VD: NETFLIX_1M, SPOTIFY_1Y, CANVA_PRO)', type: 'text', placeholder: 'NETFLIX_1M', required: true },
          { name: 'customer_email', label: 'Email cá nhân nhận tài khoản / thông tin bảo hành', type: 'text', placeholder: 'user@gmail.com', required: true }
        ],
        response_data_path: 'data.account',
        response_success_condition: 'status == 200 || success == true',
        success_message_template: '🎬 **BÀN GIAO TÀI KHOẢN VIP THÀNH CÔNG!**\n\n🧾 **Mã đơn:** `{invoice_code}`\n📦 **Gói:** `{package_id}`\n💰 **Thanh toán:** `{price_formatted}`\n\n🔑 **Thông tin đăng nhập:**\n```\n{data}\n```\n\n_Vui lòng không đổi mật khẩu để được bảo hành trọn thời hạn!_',
        show_in_menu: 1,
        menu_row: 1,
        is_active: 1
      }
    },
    {
      id: 'mail_accounts',
      title: '📧 API Mua Mail Cổ / Hotmail / Gmail Tự Động',
      icon: '📧',
      description: 'Kết nối kho mail tự động bên ngoài, lấy danh sách email|pass|2fa',
      category: 'Tài Khoản Mail',
      config: {
        name: 'Mua Mail Tự Động (Hotmail / Outlook / Gmail)',
        code: 'buy_mail_external_api',
        icon: '📧',
        price_vnd: 2000,
        price_usdt: 0.1,
        api_url: 'https://mailprovider.com/api/buy',
        http_method: 'POST',
        headers_json: '{\n  "Content-Type": "application/json",\n  "Authorization": "Bearer YOUR_MAIL_TOKEN"\n}',
        body_template: '{\n  "type": "{mail_type}",\n  "amount": {quantity}\n}',
        input_fields: [
          { name: 'mail_type', label: 'Loại Mail (HOTMAIL_NEW, GMAIL_2FA, OUTLOOK_TRUST)', type: 'text', placeholder: 'HOTMAIL_NEW', required: true },
          { name: 'quantity', label: 'Số lượng mail muốn mua', type: 'number', placeholder: '5', required: true }
        ],
        response_data_path: 'data.list',
        response_success_condition: 'status == 200 || success == true',
        success_message_template: '📧 **BÀN GIAO DANH SÁCH MAIL THÀNH CÔNG!**\n\n🧾 **Mã đơn:** `{invoice_code}`\n📦 **Số lượng:** `{quantity}` mail\n💰 **Thanh toán:** `{price_formatted}`\n\n📋 **Danh sách tài khoản:**\n```\n{data}\n```\n\nCảm ơn bạn đã mua hàng!',
        show_in_menu: 1,
        menu_row: 1,
        is_active: 1
      }
    }
  ];

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/api-workflows');
      const data = await res.json();
      if (data.success) {
        setWorkflows(data.workflows || []);
      }
    } catch (err: any) {
      console.error('Error fetching workflows:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      if (data.success || Array.isArray(data)) {
        setCategories(Array.isArray(data) ? data : data.categories || []);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  useEffect(() => {
    fetchWorkflows();
    fetchCategories();
  }, []);

  const openNewModal = () => {
    setEditingId(null);
    setFormData({
      name: '',
      code: 'api_flow_' + Date.now().toString().slice(-4),
      icon: '⚡',
      category_id: '',
      description: '',
      price_vnd: 10000,
      price_usdt: 0.5,
      api_url: 'https://api.example.com/v1/order',
      http_method: 'POST',
      headers_json: '{\n  "Content-Type": "application/json",\n  "Authorization": "Bearer YOUR_API_KEY"\n}',
      body_template: '{\n  "user_id": "{user_id}",\n  "target": "{target}",\n  "quantity": "{quantity}"\n}',
      input_fields: [
        { name: 'target', label: 'Link hoặc UID nhận', type: 'text', placeholder: 'https://...', description: 'Nhập đường dẫn tài khoản', required: true },
        { name: 'quantity', label: 'Số lượng mua', type: 'number', placeholder: '100', description: 'Tối thiểu 10', required: true }
      ],
      response_type: 'json',
      response_data_path: 'data',
      response_success_condition: 'status == 200 || success == true',
      success_message_template: '✅ **GIAO DỊCH QUA API THÀNH CÔNG!**\n\n📦 **Dịch vụ:** {name}\n🧾 **Mã đơn:** `{invoice_code}`\n💰 **Đã thanh toán:** `{price_formatted}`\n\n📋 **Dữ liệu bàn giao:**\n```\n{data}\n```\n\nCảm ơn bạn đã mua hàng!',
      show_in_menu: 1,
      menu_row: 1,
      is_active: 1
    });
    setTestVariables({
      user_id: '999999999',
      invoice_code: 'WF-TEST-123456',
      price_formatted: '10.000 đ',
      target: 'https://example.com/user123',
      quantity: '1'
    });
    setTestResult(null);
    setActiveTab('general');
    setIsModalOpen(true);
  };

  const openEditModal = (wf: ApiWorkflow) => {
    setEditingId(wf.id);
    let parsedInputs: InputField[] = [];
    try {
      parsedInputs = typeof wf.input_fields_json === 'string' ? JSON.parse(wf.input_fields_json || '[]') : wf.input_fields_json;
    } catch {}

    setFormData({
      name: wf.name,
      code: wf.code,
      icon: wf.icon || '⚡',
      category_id: wf.category_id || '',
      description: wf.description || '',
      price_vnd: Number(wf.price_vnd || 0),
      price_usdt: Number(wf.price_usdt || 0),
      api_url: wf.api_url,
      http_method: wf.http_method || 'POST',
      headers_json: typeof wf.headers_json === 'string' ? wf.headers_json : JSON.stringify(wf.headers_json, null, 2),
      body_template: typeof wf.body_template === 'string' ? wf.body_template : JSON.stringify(wf.body_template, null, 2),
      input_fields: parsedInputs,
      response_type: wf.response_type || 'json',
      response_data_path: wf.response_data_path || 'data',
      response_success_condition: wf.response_success_condition || '',
      success_message_template: wf.success_message_template || '',
      show_in_menu: wf.show_in_menu,
      menu_row: wf.menu_row || 1,
      is_active: wf.is_active
    });

    const initTestVars: Record<string, string> = {
      user_id: '999999999',
      invoice_code: 'WF-TEST-123456',
      price_formatted: Number(wf.price_vnd).toLocaleString('vi-VN') + ' đ'
    };
    parsedInputs.forEach(f => {
      initTestVars[f.name] = f.placeholder || (f.type === 'number' ? '1' : 'sample_value');
    });
    setTestVariables(initTestVars);
    setTestResult(null);
    setActiveTab('general');
    setIsModalOpen(true);
  };

  const openVisualBuilder = (wf?: ApiWorkflow) => {
    if (wf) {
      setEditingId(wf.id);
      let parsedInputs: InputField[] = [];
      try {
        parsedInputs = typeof wf.input_fields_json === 'string' ? JSON.parse(wf.input_fields_json || '[]') : wf.input_fields_json;
      } catch {}

      setFormData({
        name: wf.name,
        code: wf.code,
        icon: wf.icon || '⚡',
        category_id: wf.category_id || '',
        description: wf.description || '',
        price_vnd: Number(wf.price_vnd || 0),
        price_usdt: Number(wf.price_usdt || 0),
        api_url: wf.api_url,
        http_method: wf.http_method || 'POST',
        headers_json: typeof wf.headers_json === 'string' ? wf.headers_json : JSON.stringify(wf.headers_json, null, 2),
        body_template: typeof wf.body_template === 'string' ? wf.body_template : JSON.stringify(wf.body_template, null, 2),
        input_fields: parsedInputs,
        response_type: wf.response_type || 'json',
        response_data_path: wf.response_data_path || 'data',
        response_success_condition: wf.response_success_condition || '',
        success_message_template: wf.success_message_template || '',
        show_in_menu: wf.show_in_menu,
        menu_row: wf.menu_row || 1,
        is_active: wf.is_active
      });
    } else {
      openNewModal();
      setIsModalOpen(false);
    }
    setIsVisualBuilderOpen(true);
  };

  const handleApplyTemplate = (tpl: any) => {
    setEditingId(null);
    setFormData({
      name: tpl.config.name,
      code: tpl.config.code + '_' + Date.now().toString().slice(-4),
      icon: tpl.config.icon || '⚡',
      category_id: '',
      description: tpl.description || '',
      price_vnd: Number(tpl.config.price_vnd || 10000),
      price_usdt: Number(tpl.config.price_usdt || 0.5),
      api_url: tpl.config.api_url,
      http_method: tpl.config.http_method || 'POST',
      headers_json: tpl.config.headers_json,
      body_template: tpl.config.body_template,
      input_fields: tpl.config.input_fields || [],
      response_type: 'json',
      response_data_path: tpl.config.response_data_path || 'data',
      response_success_condition: tpl.config.response_success_condition || '',
      success_message_template: tpl.config.success_message_template || '',
      show_in_menu: 1,
      menu_row: tpl.config.menu_row || 1,
      is_active: 1
    });

    const initTestVars: Record<string, string> = {
      user_id: '999999999',
      invoice_code: 'WF-TEST-123456',
      price_formatted: Number(tpl.config.price_vnd || 10000).toLocaleString('vi-VN') + ' đ'
    };
    (tpl.config.input_fields || []).forEach((f: any) => {
      initTestVars[f.name] = f.placeholder || (f.type === 'number' ? '1' : 'sample_val');
    });
    setTestVariables(initTestVars);
    setTestResult(null);
    setIsModalOpen(true);
    setStatusMsg({ type: 'success', text: `Đã nạp mẫu "${tpl.title}". Vui lòng điền API Key của bạn rồi bấm Lưu!` });
  };

  const handleSaveWorkflow = async () => {
    if (!formData.name.trim() || !formData.code.trim() || !formData.api_url.trim()) {
      setStatusMsg({ type: 'error', text: 'Vui lòng điền đầy đủ Tên luồng, Mã code và URL API!' });
      return;
    }

    try {
      setSaving(true);
      const payload = {
        ...formData,
        input_fields_json: JSON.stringify(formData.input_fields)
      };

      const url = editingId ? `/api/api-workflows/${editingId}` : '/api/api-workflows';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        setStatusMsg({ type: 'success', text: data.message || 'Lưu luồng API thành công!' });
        setIsModalOpen(false);
        fetchWorkflows();
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Có lỗi xảy ra khi lưu!' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFromVisualBuilder = async (cfg: WorkflowConfig) => {
    if (!cfg.name.trim() || !cfg.code.trim() || !cfg.api_url.trim()) {
      setStatusMsg({ type: 'error', text: 'Vui lòng điền đầy đủ Tên luồng, Mã code và URL API trong sơ đồ!' });
      return;
    }

    try {
      setSaving(true);
      const payload = {
        ...cfg,
        input_fields_json: JSON.stringify(cfg.input_fields)
      };

      const url = editingId ? `/api/api-workflows/${editingId}` : '/api/api-workflows';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        setStatusMsg({ type: 'success', text: data.message || 'Lưu luồng API thành công từ Sơ Đồ Khối!' });
        setIsVisualBuilderOpen(false);
        fetchWorkflows();
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Có lỗi xảy ra khi lưu sơ đồ!' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWorkflow = async (id: number, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa luồng "${name}"?`)) return;
    try {
      const res = await fetch(`/api/api-workflows/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: 'success', text: 'Đã xóa luồng thành công!' });
        fetchWorkflows();
      } else {
        setStatusMsg({ type: 'error', text: data.error || 'Xóa thất bại!' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  const handleToggleActive = async (wf: ApiWorkflow) => {
    try {
      const res = await fetch(`/api/api-workflows/${wf.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...wf,
          is_active: wf.is_active ? 0 : 1
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchWorkflows();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRunTest = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      const res = await fetch('/api/api-workflows/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_url: formData.api_url,
          http_method: formData.http_method,
          headers_json: formData.headers_json,
          body_template: formData.body_template,
          response_data_path: formData.response_data_path,
          success_message_template: formData.success_message_template,
          test_variables: testVariables
        })
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleRunLiveInspect = async () => {
    if (!inspectorCurl.trim()) {
      alert('Vui lòng dán mã cURL hoặc URL API cần kiểm tra!');
      return;
    }

    try {
      setInspecting(true);
      setInspectorResult(null);
      const res = await fetch('/api/api-workflows/live-inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_curl: inspectorCurl })
      });
      const data = await res.json();
      setInspectorResult(data);
    } catch (e: any) {
      setInspectorResult({ success: false, error: e.message });
    } finally {
      setInspecting(false);
    }
  };

  const handleApplyInspectorResult = () => {
    if (!inspectorResult?.suggestedConfig) return;
    const cfg = inspectorResult.suggestedConfig;
    setFormData({
      name: cfg.name,
      code: cfg.code,
      icon: cfg.icon || '⚡',
      category_id: '',
      description: `Kết nối tự động tới API ${cfg.api_url}`,
      price_vnd: Number(cfg.price_vnd || 10000),
      price_usdt: Number(cfg.price_usdt || 0.5),
      api_url: cfg.api_url,
      http_method: cfg.http_method,
      headers_json: cfg.headers_json,
      body_template: cfg.body_template,
      input_fields: cfg.input_fields || [],
      response_type: 'json',
      response_data_path: cfg.response_data_path,
      response_success_condition: cfg.response_success_condition,
      success_message_template: cfg.success_message_template,
      show_in_menu: 1,
      menu_row: 1,
      is_active: 1
    });

    const initTestVars: Record<string, string> = {
      user_id: '999999999',
      invoice_code: 'WF-TEST-123456',
      price_formatted: '10.000 đ'
    };
    (cfg.input_fields || []).forEach((f: any) => {
      initTestVars[f.name] = f.placeholder || (f.type === 'number' ? '1' : 'sample_val');
    });
    setTestVariables(initTestVars);
    setTestResult(null);
    setIsInspectorOpen(false);
    setEditingId(null);
    setIsModalOpen(true);
    setStatusMsg({ type: 'success', text: `✨ Đã tự động đọc cURL và tạo luồng hoàn chỉnh cho "${cfg.name}"!` });
  };

  const addInputField = () => {
    const newIdx = formData.input_fields.length + 1;
    setFormData({
      ...formData,
      input_fields: [
        ...formData.input_fields,
        {
          name: `field_${newIdx}`,
          label: `Thông tin ${newIdx}`,
          type: 'text',
          placeholder: 'Nhập dữ liệu...',
          description: '',
          required: true
        }
      ]
    });
  };

  const removeInputField = (index: number) => {
    const updated = formData.input_fields.filter((_, idx) => idx !== index);
    setFormData({ ...formData, input_fields: updated });
  };

  const updateInputField = (index: number, key: keyof InputField, value: any) => {
    const updated = [...formData.input_fields];
    updated[index] = { ...updated[index], [key]: value };
    setFormData({ ...formData, input_fields: updated });
  };

  const insertVariableToBody = (varName: string) => {
    setFormData({
      ...formData,
      body_template: formData.body_template + `\n  "${varName}": "{${varName}}",`
    });
  };

  const AI_PROMPT_PRESETS = [
    {
      title: '🌐 API Proxy Xoay Dân Cư',
      prompt: `curl -X POST https://api.proxyprovider.com/v1/buy_proxy \\
  -H "Authorization: Bearer SECRET_TOKEN_XYZ" \\
  -H "Content-Type: application/json" \\
  -d '{"country": "vn", "protocol": "http", "quantity": 1, "duration_days": 30}'`
    },
    {
      title: '📱 API Thuê Sim / OTP Tự Động',
      prompt: `Tôi muốn làm luồng thuê số nhận mã OTP tự động qua API viotp.com:
- URL: https://api.viotp.com/request/getv2?token=API_KEY&serviceId={service_id}
- Khách cần nhập: service_id (Mã dịch vụ, ví dụ 1 cho Telegram, 2 cho Gmail, 3 cho Facebook).
- Giá bán: 5.000 VNĐ / số.
- Khi thành công API trả về JSON: {"status_code": 200, "data": {"request_id": 12345, "phone_number": "0987654321"}}.
- Bàn giao số điện thoại cho khách để khách lấy mã.`
    },
    {
      title: '💳 API Nạp Thẻ Cào (Gạch Thẻ Tự Động)',
      prompt: `curl -X POST https://thesieure.com/chargingws/v2 \\
  -H "Content-Type: application/json" \\
  -d '{"partner_id": "12345", "telco": "VIETTEL", "code": "12345678901234", "serial": "1000123456789", "amount": 50000}'`
    },
    {
      title: '🎬 API Mua Gói VIP Netflix / Spotify / Key',
      prompt: `Tạo luồng mua key bản quyền hoặc tài khoản tự động:
- URL: https://partner-shop.com/api/v2/license/create
- Method: POST
- Headers: {"X-Partner-Key": "SEC_KEY_888"}
- Body: {"product_code": "NETFLIX_1M", "customer_email": "{customer_email}"}
- Khách cần nhập: customer_email (Email nhận tài khoản/key).
- Giá bán: 69.000 VNĐ.
- API trả về: {"success": true, "data": {"account": "user@gmail.com|password123", "expire_date": "2026-10-18"}}`
    }
  ];

  const handleGenerateWithAi = async () => {
    if (!aiPrompt.trim()) {
      alert('Vui lòng nhập mô tả hoặc dán lệnh cURL / tài liệu API!');
      return;
    }

    try {
      setAiGenerating(true);
      setAiGeneratedConfig(null);
      setAiSource(null);

      const res = await fetch('/api/api-workflows/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt,
          api_key: aiApiKey
        })
      });
      const data = await res.json();

      if (data.success && data.config) {
        setAiGeneratedConfig(data.config);
        setAiSource(data.source);
      } else {
        alert('Lỗi khi AI phân tích: ' + (data.error || 'Vui lòng kiểm tra lại prompt'));
      }
    } catch (e: any) {
      alert('Lỗi kết nối AI: ' + e.message);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleApplyAiConfig = (config: any) => {
    setFormData({
      name: config.name || 'Dịch Vụ Mới',
      code: config.code || ('wf_' + Date.now().toString().slice(-4)),
      icon: config.icon || '⚡',
      category_id: '',
      description: config.description || '',
      price_vnd: Number(config.price_vnd || 10000),
      price_usdt: Number(config.price_usdt || 0.5),
      api_url: config.api_url || '',
      http_method: config.http_method || 'POST',
      headers_json: typeof config.headers_json === 'string' ? config.headers_json : JSON.stringify(config.headers_json, null, 2),
      body_template: typeof config.body_template === 'string' ? config.body_template : JSON.stringify(config.body_template, null, 2),
      input_fields: Array.isArray(config.input_fields) ? config.input_fields : [],
      response_type: 'json',
      response_data_path: config.response_data_path || 'data',
      response_success_condition: config.response_success_condition || 'status == 200 || success == true',
      success_message_template: config.success_message_template || '✅ Mua thành công:\n{data}',
      show_in_menu: config.show_in_menu ?? 1,
      menu_row: config.menu_row ?? 1,
      is_active: config.is_active ?? 1
    });

    const initTestVars: Record<string, string> = {
      user_id: '999999999',
      invoice_code: 'WF-TEST-123456',
      price_formatted: Number(config.price_vnd || 10000).toLocaleString('vi-VN') + ' đ'
    };
    if (Array.isArray(config.input_fields)) {
      config.input_fields.forEach((f: any) => {
        initTestVars[f.name] = f.placeholder || (f.type === 'number' ? '1' : 'sample_val');
      });
    }
    setTestVariables(initTestVars);
    setTestResult(null);
    setIsAiModalOpen(false);
    setEditingId(null);
    setIsModalOpen(true);
    setStatusMsg({ type: 'success', text: `✨ AI đã tự động điền toàn bộ cấu hình cho "${config.name}"!` });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-zinc-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-600">
              <Plug size={22} className="animate-pulse" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
                LUỒNG MUA HÀNG QUA API (NO-CODE WORKFLOW)
              </h1>
              <p className="text-sm text-zinc-500">
                Tạo nút mua hàng tự động kết nối API bên thứ 3 (Thả cURL, tự động phân tích & map trường, tự động trừ tiền & bàn giao)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => openVisualBuilder()}
            className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold shadow-md shadow-indigo-500/20"
          >
            <Compass size={16} className="mr-1.5" />
            🎨 Kéo Thả Sơ Đồ (Flow Builder)
          </Button>

          <Button
            onClick={() => {
              setInspectorCurl('');
              setInspectorResult(null);
              setIsInspectorOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-500/20"
          >
            <Activity size={16} className="mr-1.5" />
            ⚡ Test & Nhận Diện cURL Thật
          </Button>

          <Button
            onClick={() => {
              setAiPrompt('');
              setAiGeneratedConfig(null);
              setIsAiModalOpen(true);
            }}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md shadow-purple-500/20 font-bold"
          >
            <Sparkles size={16} className="mr-1.5 animate-spin" />
            ✨ AI Tự Động Tạo Luồng
          </Button>

          <Button
            onClick={openNewModal}
            variant="outline"
            className="border-zinc-300 text-zinc-800 hover:bg-zinc-100 font-semibold"
          >
            <Plus size={16} className="mr-1.5" />
            Tạo Thủ Công
          </Button>
        </div>
      </div>

      {/* Notification banner */}
      {statusMsg && (
        <div
          className={`flex items-center justify-between rounded-xl border p-4 text-sm ${
            statusMsg.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-zinc-400 hover:text-zinc-600">
            &times;
          </button>
        </div>
      )}

      {/* View Mode Switcher Tabs */}
      <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              viewMode === 'list'
                ? 'bg-zinc-900 text-white shadow-sm'
                : 'bg-zinc-100 text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <LayoutGrid size={15} />
            📋 Danh Sách Dạng Bảng ({workflows.length})
          </button>

          <button
            onClick={() => setViewMode('canvas')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              viewMode === 'canvas'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'bg-zinc-100 text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Compass size={15} />
            🗺️ Sơ Đồ Khối Trực Quan (Visual Flow Canvas)
          </button>

          <button
            onClick={() => setViewMode('marketplace')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              viewMode === 'marketplace'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                : 'bg-zinc-100 text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Zap size={15} />
            🏪 Kho Mẫu Có Sẵn 1-Click ({MARKETPLACE_TEMPLATES.length})
          </button>
        </div>

        <Button
          onClick={fetchWorkflows}
          variant="ghost"
          size="sm"
          className="text-zinc-500 hover:text-zinc-800 text-xs"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin mr-1' : 'mr-1'} /> Làm mới
        </Button>
      </div>

      {/* MODE 1: VISUAL FLOWCHART CANVAS VIEW */}
      {viewMode === 'canvas' && (
        <div className="space-y-6">
          {workflows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 p-12 text-center bg-white">
              <p className="text-zinc-500 text-sm">Chưa có luồng API nào. Hãy bấm "✨ AI Tự Động Tạo Luồng" hoặc chọn từ "Kho Mẫu"!</p>
            </div>
          ) : (
            workflows.map((wf) => {
              let parsedInputs: InputField[] = [];
              try {
                parsedInputs = typeof wf.input_fields_json === 'string' ? JSON.parse(wf.input_fields_json || '[]') : wf.input_fields_json;
              } catch {}

              return (
                <div key={wf.id} className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50/40 via-white to-purple-50/20 p-6 shadow-sm space-y-4">
                  {/* Pipeline Header */}
                  <div className="flex items-center justify-between border-b border-zinc-200/70 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white text-xl font-bold">
                        {wf.icon || '⚡'}
                      </span>
                      <div>
                        <h3 className="text-base font-bold text-zinc-900">{wf.name}</h3>
                        <span className="text-xs font-mono text-zinc-500">Mã: {wf.code} • Giá: {Number(wf.price_vnd).toLocaleString('vi-VN')} đ</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleActive(wf)}
                        className={`px-3 py-1 text-xs font-bold rounded-lg border ${
                          wf.is_active
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-zinc-200 bg-zinc-100 text-zinc-500'
                        }`}
                      >
                        {wf.is_active ? '● Đang Mở Bán' : '○ Tạm Dừng'}
                      </button>
                      <Button
                        onClick={() => openVisualBuilder(wf)}
                        size="sm"
                        className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-sm"
                      >
                        <Compass size={13} className="mr-1" /> Sơ Đồ Kéo Thả
                      </Button>
                      <Button onClick={() => openEditModal(wf)} size="sm" variant="outline" className="h-8">
                        <Edit3 size={13} className="mr-1" /> Chỉnh Sửa
                      </Button>
                    </div>
                  </div>

                  {/* Visual Node Flow Pipeline */}
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-center pt-2">
                    {/* Block 1: User Trigger */}
                    <div className="rounded-2xl border border-blue-200 bg-white p-3.5 shadow-sm space-y-1 relative">
                      <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">1. Nút Bấm Khách</span>
                      <p className="text-xs font-bold text-zinc-800 truncate">{wf.name}</p>
                      <span className="inline-block rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                        Giá: {Number(wf.price_vnd).toLocaleString('vi-VN')} đ
                      </span>
                    </div>

                    {/* Block 2: Inputs */}
                    <div className="rounded-2xl border border-amber-200 bg-white p-3.5 shadow-sm space-y-1">
                      <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">2. Thu Thập Dữ Liệu</span>
                      <p className="text-xs font-bold text-zinc-800">{parsedInputs.length} Câu Hỏi</p>
                      <p className="text-[10px] text-zinc-500 truncate">
                        {parsedInputs.map(f => f.name).join(', ') || 'Không cần nhập'}
                      </p>
                    </div>

                    {/* Block 3: Wallet Auth & Protection */}
                    <div className="rounded-2xl border border-emerald-200 bg-white p-3.5 shadow-sm space-y-1">
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">3. Ví & Bảo Vệ</span>
                      <p className="text-xs font-bold text-zinc-800">Trừ Số Dư</p>
                      <span className="inline-block rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                        100% Tự Hoàn Tiền
                      </span>
                    </div>

                    {/* Block 4: HTTP Request Engine */}
                    <div className="rounded-2xl border border-purple-200 bg-white p-3.5 shadow-sm space-y-1">
                      <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">4. Gọi API Đối Tác</span>
                      <p className="text-xs font-bold text-zinc-800 font-mono">{wf.http_method}</p>
                      <p className="text-[10px] text-zinc-500 font-mono truncate">{wf.api_url}</p>
                    </div>

                    {/* Block 5: Response Extractor */}
                    <div className="rounded-2xl border border-cyan-200 bg-white p-3.5 shadow-sm space-y-1">
                      <span className="text-[10px] font-bold text-cyan-600 uppercase tracking-wider">5. Trích Xuất JSON</span>
                      <p className="text-xs font-bold text-zinc-800 font-mono truncate">{wf.response_data_path || 'data'}</p>
                      <span className="inline-block rounded-md bg-cyan-50 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-700">
                        Auto Filter
                      </span>
                    </div>

                    {/* Block 6: Delivery */}
                    <div className="rounded-2xl border border-rose-200 bg-white p-3.5 shadow-sm space-y-1">
                      <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">6. Bàn Giao Telegram</span>
                      <p className="text-xs font-bold text-zinc-800">Markdown + Nút</p>
                      <p className="text-[10px] text-zinc-500 truncate">Kèm Mã Đơn & Data</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* MODE 2: 1-CLICK MARKETPLACE TEMPLATES */}
      {viewMode === 'marketplace' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-purple-200 bg-gradient-to-r from-purple-50 via-indigo-50 to-white p-5">
            <h3 className="text-base font-extrabold text-purple-950 flex items-center gap-2">
              <Zap className="text-purple-600" /> KHO MẪU LUỒNG MUA HÀNG API CÓ SẴN (1-CLICK NẠP CẤU HÌNH)
            </h3>
            <p className="text-xs text-purple-700 mt-1">
              Các mẫu kết nối API phổ biến nhất tại Việt Nam & Quốc tế. Chọn mẫu bất kỳ để nạp tự động toàn bộ Body, Headers, Form nhập liệu và Mẫu tin bàn giao!
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {MARKETPLACE_TEMPLATES.map((tpl) => (
              <div key={tpl.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl">{tpl.icon}</span>
                    <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-bold text-purple-700">
                      {tpl.category}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-zinc-900">{tpl.title}</h4>
                  <p className="text-xs text-zinc-500">{tpl.description}</p>
                </div>

                <div className="space-y-3 pt-2 border-t border-zinc-100">
                  <div className="flex items-center justify-between text-xs text-zinc-600">
                    <span>Giá đề xuất:</span>
                    <span className="font-bold text-emerald-600">
                      {Number(tpl.config.price_vnd).toLocaleString('vi-VN')} đ
                    </span>
                  </div>

                  <Button
                    onClick={() => handleApplyTemplate(tpl)}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
                  >
                    <Plus size={14} className="mr-1.5" /> Dùng Mẫu Này Ngay
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODE 3: STANDARD LIST VIEW */}
      {viewMode === 'list' && (
        <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm">
          <div className="border-b border-zinc-100 p-5 flex items-center justify-between">
            <h2 className="text-base font-bold text-zinc-800 flex items-center gap-2">
              <Sparkles size={18} className="text-indigo-600" />
              Danh Sách Các Luồng Mua Hàng API
            </h2>
            <span className="text-xs text-zinc-500">
              Tự động xuất hiện trên menu bot hoặc danh mục tương ứng
            </span>
          </div>

          {loading ? (
            <div className="flex h-48 items-center justify-center text-zinc-400">
              <RefreshCw size={24} className="animate-spin" />
              <span className="ml-2 text-sm font-medium">Đang tải danh sách luồng...</span>
            </div>
          ) : workflows.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 text-indigo-500 mb-4">
                <Plug size={32} />
              </div>
              <h3 className="text-base font-bold text-zinc-800">Chưa có luồng mua hàng API nào</h3>
              <p className="text-sm text-zinc-500 max-w-md mt-1 mb-6">
                Bạn có thể tạo nút mua hàng liên kết API của bất kỳ bên thứ 3 nào (API thẻ cào, API proxy, clone, tài khoản, VPS...) không cần viết code.
              </p>
              <div className="flex items-center gap-3">
                <Button onClick={() => setIsInspectorOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Activity size={16} className="mr-1.5" /> Dán cURL Test Thật
                </Button>
                <Button onClick={openNewModal} variant="outline">
                  <Plus size={16} className="mr-1.5" /> Tạo Thủ Công
                </Button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {workflows.map((wf) => {
                let fieldsCount = 0;
                try {
                  const parsed = typeof wf.input_fields_json === 'string' ? JSON.parse(wf.input_fields_json || '[]') : wf.input_fields_json;
                  fieldsCount = Array.isArray(parsed) ? parsed.length : 0;
                } catch {}

                return (
                  <div key={wf.id} className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:bg-zinc-50/70 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-indigo-50 border border-indigo-200/50 text-2xl shadow-sm">
                        {wf.icon || '⚡'}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-zinc-900">{wf.name}</h3>
                          <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-mono font-medium text-zinc-700">
                            {wf.code}
                          </span>
                          <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                            wf.http_method === 'GET' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {wf.http_method || 'POST'}
                          </span>
                          {wf.show_in_menu ? (
                            <span className="rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                              Hiện Menu (Hàng {wf.menu_row || 1})
                            </span>
                          ) : null}
                        </div>

                        <p className="text-xs text-zinc-500 font-mono truncate max-w-xl">
                          URL: {wf.api_url}
                        </p>

                        <div className="flex items-center gap-4 text-xs text-zinc-600 pt-1">
                          <span className="font-semibold text-emerald-600">
                            {Number(wf.price_vnd).toLocaleString('vi-VN')} đ
                            {Number(wf.price_usdt) > 0 ? ` / ${wf.price_usdt} USDT` : ''}
                          </span>
                          <span>•</span>
                          <span>{fieldsCount} trường nhập liệu</span>
                          <span>•</span>
                          <span>JSON Path: <code className="bg-zinc-100 px-1 py-0.5 rounded text-zinc-800">{wf.response_data_path || 'data'}</code></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      <button
                        onClick={() => handleToggleActive(wf)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                          wf.is_active
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'border-zinc-200 bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                        }`}
                      >
                        {wf.is_active ? '● Đang mở bán' : '○ Đang tạm dừng'}
                      </button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openVisualBuilder(wf)}
                        className="border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 font-bold"
                      >
                        <Compass size={14} className="mr-1" /> Sơ Đồ Kéo Thả
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditModal(wf)}
                        className="border-zinc-200 text-zinc-700 hover:bg-zinc-100"
                      >
                        <Edit3 size={14} className="mr-1" /> Cấu hình & Test
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteWorkflow(wf.id, wf.name)}
                        className="border-rose-200 text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* LIVE INSPECTOR MODAL */}
      {isInspectorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden border border-emerald-200">
            <div className="flex items-center justify-between border-b border-emerald-100 px-6 py-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-white">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-500/30 font-bold">
                  <Activity size={20} />
                </span>
                <div>
                  <h2 className="text-base font-extrabold text-zinc-900">
                    TEST & NHẬN DIỆN cURL API THẬT (LIVE INSPECTOR)
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Dán lệnh cURL → Hệ thống gửi request thật tới API đối tác → Tự động trích xuất JSON Path
                  </p>
                </div>
              </div>

              <button onClick={() => setIsInspectorOpen(false)} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100">
                &times;
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-zinc-800">Dán lệnh cURL từ API đối tác hoặc F12 Network: *</Label>
                <textarea
                  rows={6}
                  value={inspectorCurl}
                  onChange={(e) => setInspectorCurl(e.target.value)}
                  placeholder={`curl -X POST https://api.viotp.com/request/getv2 \\\n  -H "Content-Type: application/json" \\\n  -d '{"serviceId": 1}'`}
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-900 p-4 font-mono text-xs text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <Button
                onClick={handleRunLiveInspect}
                disabled={inspecting || !inspectorCurl.trim()}
                className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md shadow-emerald-500/20"
              >
                {inspecting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin mr-2" /> Đang gửi request test tới API đối tác...
                  </>
                ) : (
                  <>
                    <Play size={16} className="mr-2" /> 🚀 Gửi Request Thật & Tự Động Phân Tích JSON
                  </>
                )}
              </Button>

              {inspectorResult && (
                <div className="space-y-4 pt-3 border-t border-zinc-200">
                  {inspectorResult.success ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                          <CheckCircle2 size={16} /> Kết nối thành công (HTTP {inspectorResult.response?.status} - {inspectorResult.executionTimeMs}ms)
                        </span>
                        <span className="text-xs font-mono text-zinc-500">
                          JSON Path phát hiện: <strong>{inspectorResult.response?.detectedDataPath}</strong>
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-[11px] font-semibold text-zinc-600">Response JSON Thô Từ Đối Tác:</Label>
                          <pre className="rounded-xl border bg-zinc-950 p-3 font-mono text-[11px] text-emerald-400 max-h-48 overflow-auto">
                            {JSON.stringify(inspectorResult.response?.raw, null, 2)}
                          </pre>
                        </div>

                        <div>
                          <Label className="text-[11px] font-semibold text-zinc-600">Mẫu Tin Nhắn Telegram Tự Động Sinh:</Label>
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 font-mono text-xs text-zinc-800 whitespace-pre-wrap max-h-48 overflow-auto">
                            {inspectorResult.suggestedConfig?.success_message_template}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end pt-2">
                        <Button
                          onClick={handleApplyInspectorResult}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 shadow-md"
                        >
                          <Check size={16} className="mr-1.5" /> Áp Dụng Kết Quả & Mở Form Mở Bán
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
                      <strong>Lỗi kết nối:</strong> {inspectorResult.error}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIT / CREATE WORKFLOW */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-zinc-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 bg-zinc-50/50">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-lg">
                  {formData.icon || '⚡'}
                </span>
                <div>
                  <h2 className="text-lg font-bold text-zinc-900">
                    {editingId ? `Chỉnh sửa Luồng: ${formData.name || 'API Workflow'}` : 'Tạo Luồng Mua Hàng Qua API Mới'}
                  </h2>
                  <p className="text-xs text-zinc-500 font-mono">
                    Mã code: {formData.code || 'chưa đặt'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
              >
                &times;
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-zinc-200 bg-white px-6 overflow-x-auto">
              {[
                { id: 'general', label: '1. Thông Tin & Giá', icon: Sliders },
                { id: 'api', label: '2. Cấu Hình API & Body', icon: Code },
                { id: 'inputs', label: `3. Form Khách Nhập (${formData.input_fields.length})`, icon: Layers },
                { id: 'output', label: '4. Kết Quả & Tin Nhắn', icon: Send },
                { id: 'test', label: '5. Test Thử Nghiệm API', icon: Play }
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-bold whitespace-nowrap transition-colors ${
                      isActive
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-zinc-500 hover:text-zinc-900'
                    }`}
                  >
                    <Icon size={14} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Tab 1: General Info */}
              {activeTab === 'general' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5 md:col-span-2">
                      <Label className="text-xs font-semibold text-zinc-700">Tên dịch vụ hiển thị *</Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="VD: Mua Gói VIP Netflix, Nạp Thẻ Cào, Buff View..."
                        className="bg-zinc-50"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-zinc-700">Icon Emoji</Label>
                      <Input
                        value={formData.icon}
                        onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                        placeholder="⚡, 🎬, 🚀, 💎"
                        className="bg-zinc-50 text-center text-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-zinc-700">Mã Code định danh (Duy nhất) *</Label>
                      <Input
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        placeholder="VD: buy_netflix_api"
                        className="font-mono text-xs bg-zinc-50"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-zinc-700">Gán vào Danh Mục (Tùy chọn)</Label>
                      <select
                        value={formData.category_id}
                        onChange={(e) => setFormData({ ...formData, category_id: e.target.value ? Number(e.target.value) : '' })}
                        className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">-- Cấp 1 (Hiện chung cùng Danh Mục) --</option>
                        {categories.map((c: any) => (
                          <option key={c.id} value={c.id}>
                            {c.emoji || '📁'} {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-zinc-700">Giá bán (VNĐ) *</Label>
                      <Input
                        type="number"
                        value={formData.price_vnd}
                        onChange={(e) => setFormData({ ...formData, price_vnd: Number(e.target.value) })}
                        className="bg-zinc-50 font-bold text-emerald-600"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-zinc-700">Giá bán (USDT)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.price_usdt}
                        onChange={(e) => setFormData({ ...formData, price_usdt: Number(e.target.value) })}
                        className="bg-zinc-50 font-bold text-emerald-600"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-700">Mô tả giới thiệu dịch vụ</Label>
                    <textarea
                      rows={3}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Mô tả quyền lợi, thời hạn, lưu ý cho khách hàng khi mua..."
                      className="w-full rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    <div className="flex items-center gap-2 rounded-xl border border-zinc-200 p-3 bg-zinc-50/50">
                      <input
                        type="checkbox"
                        id="is_active"
                        checked={Boolean(formData.is_active)}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked ? 1 : 0 })}
                        className="h-4 w-4 rounded border-zinc-300 text-indigo-600"
                      />
                      <label htmlFor="is_active" className="text-xs font-semibold text-zinc-800 cursor-pointer">
                        Mở bán dịch vụ này
                      </label>
                    </div>

                    <div className="flex items-center gap-2 rounded-xl border border-zinc-200 p-3 bg-zinc-50/50">
                      <input
                        type="checkbox"
                        id="show_in_menu"
                        checked={Boolean(formData.show_in_menu)}
                        onChange={(e) => setFormData({ ...formData, show_in_menu: e.target.checked ? 1 : 0 })}
                        className="h-4 w-4 rounded border-zinc-300 text-indigo-600"
                      />
                      <label htmlFor="show_in_menu" className="text-xs font-semibold text-zinc-800 cursor-pointer">
                        Hiện nút trên Bot
                      </label>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-zinc-600">Thứ tự hàng nút</Label>
                      <Input
                        type="number"
                        min="1"
                        max="10"
                        value={formData.menu_row}
                        onChange={(e) => setFormData({ ...formData, menu_row: Number(e.target.value) })}
                        className="h-9 bg-zinc-50"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: API & Body */}
              {activeTab === 'api' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-3">
                    <div className="space-y-1.5 col-span-1">
                      <Label className="text-xs font-semibold text-zinc-700">HTTP Method</Label>
                      <select
                        value={formData.http_method}
                        onChange={(e) => setFormData({ ...formData, http_method: e.target.value })}
                        className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-bold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="POST">POST</option>
                        <option value="GET">GET</option>
                        <option value="PUT">PUT</option>
                        <option value="PATCH">PATCH</option>
                      </select>
                    </div>

                    <div className="space-y-1.5 col-span-3">
                      <Label className="text-xs font-semibold text-zinc-700">API Endpoint URL *</Label>
                      <Input
                        value={formData.api_url}
                        onChange={(e) => setFormData({ ...formData, api_url: e.target.value })}
                        placeholder="https://api.partner.com/v1/orders"
                        className="font-mono text-xs bg-zinc-50"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-zinc-700">Headers (JSON)</Label>
                      <span className="text-[11px] text-zinc-500">Authorization, Content-Type, API Keys...</span>
                    </div>
                    <textarea
                      rows={4}
                      value={formData.headers_json}
                      onChange={(e) => setFormData({ ...formData, headers_json: e.target.value })}
                      placeholder='{ "Content-Type": "application/json", "Authorization": "Bearer KEY" }'
                      className="w-full rounded-md border border-zinc-200 bg-zinc-900 p-3 font-mono text-xs text-emerald-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-zinc-700">Request Body Template (JSON)</Label>
                      <span className="text-[11px] text-zinc-500">
                        Chèn biến động dạng <code className="text-indigo-600 bg-indigo-50 px-1 rounded">{'{tên_biến}'}</code>
                      </span>
                    </div>

                    {/* Quick Variable Insert Pills */}
                    <div className="flex flex-wrap items-center gap-1.5 py-1">
                      <span className="text-[11px] font-semibold text-zinc-500">Chèn biến nhanh:</span>
                      {['user_id', 'invoice_code', 'price', ...formData.input_fields.map(f => f.name)].map((vName) => (
                        <button
                          key={vName}
                          type="button"
                          onClick={() => insertVariableToBody(vName)}
                          className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-mono text-indigo-700 hover:bg-indigo-100"
                        >
                          +{`{${vName}}`}
                        </button>
                      ))}
                    </div>

                    <textarea
                      rows={6}
                      value={formData.body_template}
                      onChange={(e) => setFormData({ ...formData, body_template: e.target.value })}
                      placeholder='{ "account": "{user_id}", "custom_data": "{target}" }'
                      className="w-full rounded-md border border-zinc-200 bg-zinc-900 p-3 font-mono text-xs text-emerald-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}

              {/* Tab 3: User Input Fields */}
              {activeTab === 'inputs' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-zinc-900">Các Bước Khách Hàng Cần Nhập</h4>
                      <p className="text-xs text-zinc-500">
                        Bot sẽ lần lượt hỏi khách hàng từng trường này trước khi trừ tiền và gọi API
                      </p>
                    </div>
                    <Button onClick={addInputField} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                      <Plus size={14} className="mr-1" /> Thêm Trường Nhập
                    </Button>
                  </div>

                  {formData.input_fields.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center">
                      <p className="text-xs text-zinc-500">
                        Chưa có trường nhập liệu nào. Nếu không thêm trường, đơn hàng sẽ được kích hoạt ngay lập tức khi khách bấm Mua.
                      </p>
                      <Button onClick={addInputField} variant="outline" size="sm" className="mt-3">
                        <Plus size={14} className="mr-1" /> Thêm trường đầu tiên
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {formData.input_fields.map((field, idx) => (
                        <div key={idx} className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-700">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-200 text-indigo-800 text-[10px]">
                                {idx + 1}
                              </span>
                              Bước {idx + 1}: {field.label || field.name}
                            </span>

                            <button
                              type="button"
                              onClick={() => removeInputField(idx)}
                              className="text-rose-500 hover:text-rose-700 text-xs font-semibold flex items-center gap-1"
                            >
                              <Trash2 size={13} /> Xóa bước này
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-[11px] font-semibold text-zinc-600">Tên biến (Key) *</Label>
                              <Input
                                value={field.name}
                                onChange={(e) => updateInputField(idx, 'name', e.target.value)}
                                placeholder="VD: target_uid, email, qty"
                                className="h-8 font-mono text-xs bg-white"
                              />
                            </div>

                            <div className="space-y-1 md:col-span-2">
                              <Label className="text-[11px] font-semibold text-zinc-600">Câu hỏi hiển thị cho khách *</Label>
                              <Input
                                value={field.label}
                                onChange={(e) => updateInputField(idx, 'label', e.target.value)}
                                placeholder="VD: Vui lòng nhập link bài viết cần buff..."
                                className="h-8 text-xs bg-white"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-[11px] font-semibold text-zinc-600">Kiểu dữ liệu</Label>
                              <select
                                value={field.type}
                                onChange={(e) => updateInputField(idx, 'type', e.target.value as any)}
                                className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-800 h-8"
                              >
                                <option value="text">Văn bản (Text)</option>
                                <option value="number">Số lượng (Number)</option>
                                <option value="url">Đường link (URL)</option>
                              </select>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-[11px] font-semibold text-zinc-600">Placeholder gợi ý</Label>
                              <Input
                                value={field.placeholder || ''}
                                onChange={(e) => updateInputField(idx, 'placeholder', e.target.value)}
                                placeholder="VD: 100 hoặc https://..."
                                className="h-8 text-xs bg-white"
                              />
                            </div>

                            <div className="flex items-center gap-2 pt-4">
                              <input
                                type="checkbox"
                                id={`req_${idx}`}
                                checked={field.required}
                                onChange={(e) => updateInputField(idx, 'required', e.target.checked)}
                                className="h-4 w-4 rounded border-zinc-300 text-indigo-600"
                              />
                              <label htmlFor={`req_${idx}`} className="text-xs font-semibold text-zinc-700 cursor-pointer">
                                Bắt buộc nhập
                              </label>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: Response & Output */}
              {activeTab === 'output' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-zinc-700">Trích xuất dữ liệu (JSON Path)</Label>
                      <Input
                        value={formData.response_data_path}
                        onChange={(e) => setFormData({ ...formData, response_data_path: e.target.value })}
                        placeholder="VD: data, result.accounts, data.key"
                        className="font-mono text-xs bg-zinc-50"
                      />
                      <p className="text-[11px] text-zinc-500">
                        Ví dụ API trả về <code className="bg-zinc-100 px-1 rounded">{'{ data: { key: "XYZ" } }'}</code> thì điền <code className="bg-zinc-100 px-1 rounded">data.key</code> để lấy giá trị gán vào biến <code className="bg-zinc-100 px-1 rounded">{'{data}'}</code>.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-zinc-700">Điều kiện thành công</Label>
                      <Input
                        value={formData.response_success_condition}
                        onChange={(e) => setFormData({ ...formData, response_success_condition: e.target.value })}
                        placeholder="HTTP Status 200 - 299"
                        className="font-mono text-xs bg-zinc-50"
                      />
                      <p className="text-[11px] text-zinc-500">
                        Mặc định mã HTTP 2xx là thành công, khác 2xx sẽ tự hoàn tiền.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-zinc-700">
                        Mẫu tin nhắn Telegram gửi khách khi Mua Thành Công *
                      </Label>
                      <span className="text-[11px] text-zinc-500">Hỗ trợ Markdown Telegram</span>
                    </div>

                    <textarea
                      rows={8}
                      value={formData.success_message_template}
                      onChange={(e) => setFormData({ ...formData, success_message_template: e.target.value })}
                      placeholder="Nội dung thông báo kèm thông tin bàn giao..."
                      className="w-full rounded-md border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />

                    <div className="rounded-lg bg-zinc-100 p-2 text-[11px] text-zinc-600">
                      <strong>Các biến hỗ trợ:</strong> <code className="text-indigo-600">{'{data}'}</code> (dữ liệu trích xuất từ API), <code className="text-indigo-600">{'{invoice_code}'}</code> (mã đơn), <code className="text-indigo-600">{'{price_formatted}'}</code> (số tiền), <code className="text-indigo-600">{'{name}'}</code> (tên gói), và tất cả biến người dùng nhập.
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 5: Test Runner */}
              {activeTab === 'test' && (
                <div className="space-y-5">
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
                    <h4 className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                      <Play size={14} /> Sandbox Kiểm Tra Kết Nối & Gọi Thử API
                    </h4>
                    <p className="text-xs text-indigo-700 mt-0.5">
                      Kiểm tra thực tế request, headers, body và xem trước tin nhắn mà khách hàng sẽ nhận được.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <h5 className="text-xs font-bold text-zinc-800">Dữ liệu giả lập biến Test:</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {Object.keys(testVariables).map((key) => (
                        <div key={key} className="space-y-1">
                          <Label className="text-[11px] font-mono font-semibold text-zinc-600">{key}</Label>
                          <Input
                            value={testVariables[key]}
                            onChange={(e) => setTestVariables({ ...testVariables, [key]: e.target.value })}
                            className="h-8 text-xs font-mono bg-white"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="pt-2">
                      <Button
                        onClick={handleRunTest}
                        disabled={testing}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"
                      >
                        {testing ? (
                          <>
                            <RefreshCw size={14} className="animate-spin mr-1.5" /> Đang gửi request test...
                          </>
                        ) : (
                          <>
                            <Play size={14} className="mr-1.5" /> Bắt Đầu Chạy Thử Nghiệm API
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Test Result Output */}
                  {testResult && (
                    <div className="space-y-4 pt-4 border-t border-zinc-200">
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-bold text-zinc-800 flex items-center gap-2">
                          Kết quả phản hồi
                          {testResult.success ? (
                            <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                              HTTP {testResult.response?.status || 200} ({testResult.executionTimeMs}ms)
                            </span>
                          ) : (
                            <span className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
                              LỖI: {testResult.error}
                            </span>
                          )}
                        </h5>
                      </div>

                      {testResult.success ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Raw API Response */}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-zinc-700">Phản hồi thô từ API (Raw Response)</Label>
                            <pre className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 font-mono text-[11px] text-emerald-400 overflow-x-auto max-h-56">
                              {JSON.stringify(testResult.response?.raw, null, 2)}
                            </pre>
                          </div>

                          {/* Extracted Data & Preview */}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-zinc-700">Tin nhắn Telegram thực tế gửi cho khách</Label>
                            <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4 font-mono text-xs text-zinc-800 whitespace-pre-wrap max-h-56 overflow-y-auto">
                              {testResult.renderedMessage}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50/50 px-6 py-4">
              <Button
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="border-zinc-200 text-zinc-600"
              >
                Hủy bỏ
              </Button>

              <Button
                onClick={handleSaveWorkflow}
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20"
              >
                {saving ? (
                  <>
                    <RefreshCw size={14} className="animate-spin mr-1.5" /> Đang lưu...
                  </>
                ) : (
                  <>
                    <Check size={16} className="mr-1.5" /> {editingId ? 'Cập Nhật Luồng API' : 'Tạo & Mở Bán Luồng API'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* AI AUTO-BUILDER ASSISTANT MODAL */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden border border-purple-200">
            {/* AI Modal Header */}
            <div className="flex items-center justify-between border-b border-purple-100 px-6 py-4 bg-gradient-to-r from-purple-50 via-indigo-50 to-white">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/30">
                  <Sparkles size={20} className="animate-pulse" />
                </span>
                <div>
                  <h2 className="text-base font-extrabold text-zinc-900 flex items-center gap-2">
                    TRỢ LÝ AI THIẾT KẾ LUỒNG MUA HÀNG TỰ ĐỘNG
                    <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-bold text-purple-700 uppercase">
                      Gemini AI Engine
                    </span>
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Chỉ cần dán lệnh cURL, tài liệu API hoặc viết yêu cầu bằng tiếng Việt
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsAiModalOpen(false)}
                className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
              >
                &times;
              </button>
            </div>

            {/* AI Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Presets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-zinc-700">Mẫu API mẫu có sẵn (Click để thử ngay):</Label>
                </div>
                <div className="flex flex-wrap gap-2">
                  {AI_PROMPT_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setAiPrompt(preset.prompt)}
                      className="rounded-xl border border-purple-100 bg-purple-50/60 px-3 py-1.5 text-xs font-semibold text-purple-800 hover:bg-purple-100 hover:border-purple-200 transition-all text-left"
                    >
                      {preset.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input Area */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-zinc-800">
                    Dán cURL / API Docs / Yêu cầu của bạn: *
                  </Label>
                  <span className="text-[11px] text-zinc-500">Hỗ trợ tiếng Việt, JSON, cURL, OpenAPI</span>
                </div>

                <textarea
                  rows={7}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Ví dụ: curl -X POST https://api.viotp.com/request/getv2?token=MY_TOKEN&serviceId=1...&#10;Hoặc: Tôi muốn làm nút mua proxy xoay dân cư, hỏi user chọn quốc gia (vn/us) và số lượng, giá 15k, trả về IP:PORT..."
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-900 p-4 font-mono text-xs text-emerald-300 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-inner"
                />
              </div>

              {/* Gemini API Key optional override */}
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-semibold text-zinc-700">
                    Google Gemini API Key (Tùy chọn nếu muốn dùng key riêng):
                  </Label>
                  <span className="text-[10px] text-zinc-400">Nếu để trống, hệ thống sẽ dùng key mặc định / bộ phân tích thông minh</span>
                </div>
                <Input
                  type="password"
                  value={aiApiKey}
                  onChange={(e) => setAiApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="h-8 text-xs font-mono bg-white"
                />
              </div>

              {/* Action Button */}
              <div>
                <Button
                  onClick={handleGenerateWithAi}
                  disabled={aiGenerating || !aiPrompt.trim()}
                  className="w-full h-11 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-purple-500/25 transition-all text-sm"
                >
                  {aiGenerating ? (
                    <>
                      <RefreshCw size={16} className="animate-spin mr-2" />
                      AI Đang Phân Tích cURL & Xây Dựng Luồng...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} className="mr-2" />
                      ✨ AI Phân Tích & Tự Động Sinh Toàn Bộ Luồng Mua Hàng
                    </>
                  )}
                </Button>
              </div>

              {/* AI Generated Result Preview */}
              {aiGeneratedConfig && (
                <div className="rounded-2xl border-2 border-emerald-400/80 bg-emerald-50/40 p-5 space-y-4 animate-in fade-in zoom-in duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{aiGeneratedConfig.icon || '⚡'}</span>
                      <div>
                        <h4 className="text-sm font-extrabold text-zinc-900">{aiGeneratedConfig.name}</h4>
                        <span className="text-xs font-mono text-zinc-500">Mã: {aiGeneratedConfig.code} • Method: {aiGeneratedConfig.http_method}</span>
                      </div>
                    </div>

                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                      ✨ Sinh thành công ({aiSource === 'gemini-ai' ? 'Gemini AI' : 'Smart Parser'})
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl bg-white p-3 border border-emerald-100 shadow-sm">
                      <span className="text-zinc-500 font-medium">Giá bán đề xuất:</span>
                      <p className="font-bold text-emerald-700 mt-0.5">
                        {Number(aiGeneratedConfig.price_vnd || 10000).toLocaleString('vi-VN')} VNĐ
                        {aiGeneratedConfig.price_usdt ? ` (${aiGeneratedConfig.price_usdt} USDT)` : ''}
                      </p>
                    </div>

                    <div className="rounded-xl bg-white p-3 border border-emerald-100 shadow-sm">
                      <span className="text-zinc-500 font-medium">Form câu hỏi bot sẽ hỏi khách:</span>
                      <p className="font-bold text-indigo-700 mt-0.5">
                        {Array.isArray(aiGeneratedConfig.input_fields) ? aiGeneratedConfig.input_fields.length : 0} câu hỏi (
                        {Array.isArray(aiGeneratedConfig.input_fields) ? aiGeneratedConfig.input_fields.map((f: any) => f.name).join(', ') : ''}
                        )
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-zinc-700">Mẫu tin nhắn Telegram bàn giao AI đã tạo:</span>
                    <div className="rounded-xl bg-white border border-emerald-200 p-3 text-xs font-mono text-zinc-800 whitespace-pre-wrap max-h-36 overflow-y-auto">
                      {aiGeneratedConfig.success_message_template}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <Button
                      onClick={() => handleApplyAiConfig(aiGeneratedConfig)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 shadow-md shadow-emerald-500/20"
                    >
                      <Check size={16} className="mr-1.5" />
                      Áp Dụng Vào Form & Xem Chi Tiết
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VISUAL DRAG-AND-DROP FLOW BUILDER MODAL */}
      {isVisualBuilderOpen && (
        <VisualFlowBuilder
          initialConfig={formData}
          categories={categories}
          onSave={handleSaveFromVisualBuilder}
          onRunTest={(cfg) => {
            setFormData(cfg);
            setIsVisualBuilderOpen(false);
            setActiveTab('test');
            setIsModalOpen(true);
          }}
          onClose={() => setIsVisualBuilderOpen(false)}
        />
      )}
    </div>
  );
}
