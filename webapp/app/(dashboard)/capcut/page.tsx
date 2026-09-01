'use client';

import { useEffect, useState } from 'react';
import {
  Sparkles, Video, RefreshCw, CheckCircle, XCircle, Clock, Copy, Download,
  Trash2, ShieldCheck, Cpu, Zap, Key, Layers, Database, ArrowRight, UserCheck,
  Plus, AlertTriangle, DollarSign, Search, Calendar, Users, Settings, UserMinus,
  UserPlus, Shield, Edit2, Link2, ExternalLink, X, Mail, Check, AlertCircle
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';

interface AccountResult {
  index: number;
  email: string;
  password: string;
  userId?: string;
  code?: string;
  status: 'success' | 'failed' | 'timeout';
  message?: string;
  savedToDb?: boolean;
}

interface AccountType {
  id: number;
  name: string;
}

interface AdminWorkspace {
  id: number;
  admin_email: string;
  admin_password?: string;
  workspace_id: string;
  workspace_name: string;
  member_limit: number;
  member_cnt: number;
  team_vip_end: number;
  status: 'active' | 'full' | 'expired' | 'disabled';
  created_at?: string;
}

interface UserWarranty {
  id: number;
  telegram_id: string;
  user_capcut_email: string;
  user_capcut_uid?: string;
  workspace_id: string;
  workspace_name?: string;
  admin_email?: string;
  price_paid: number;
  joined_at: string;
  expires_at?: string;
  status: 'active' | 'expired' | 'refunded';
}

export default function CapCutManagementPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'generator' | 'admin_workspaces' | 'warranties'>('admin_workspaces');

  // Generator states
  const [count, setCount] = useState<number>(1);
  const [domain, setDomain] = useState<string>('capcut.lienmanhgroup.io.vn');
  const [password, setPassword] = useState<string>('CapCut@2026');
  const [useRandomPass, setUseRandomPass] = useState<boolean>(true);
  const [saveToStorage, setSaveToStorage] = useState<boolean>(false);
  const [selectedAccountTypeId, setSelectedAccountTypeId] = useState<number | ''>('');
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [generating, setGenerating] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [results, setResults] = useState<AccountResult[]>([]);
  const [stats, setStats] = useState({ total: 0, success: 0, failed: 0 });

  // Admin Workspaces & Sales Config states
  const [adminWorkspaces, setAdminWorkspaces] = useState<AdminWorkspace[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState<boolean>(false);
  const [newAdminEmail, setNewAdminEmail] = useState<string>('');
  const [newAdminPassword, setNewAdminPassword] = useState<string>('');
  const [addingAdmin, setAddingAdmin] = useState<boolean>(false);
  const [capcutPrice, setCapcutPrice] = useState<number>(50000);
  const [capcutEnabled, setCapcutEnabled] = useState<boolean>(true);
  const [savingSettings, setSavingSettings] = useState<boolean>(false);

  // Warranties states
  const [warranties, setWarranties] = useState<UserWarranty[]>([]);
  const [loadingWarranties, setLoadingWarranties] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Workspace CRUD Modal State
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [workspaceDetail, setWorkspaceDetail] = useState<any>(null);
  const [workspaceMembers, setWorkspaceMembers] = useState<any[]>([]);
  const [inviteLink, setInviteLink] = useState<string>('');
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Modal form states
  const [editWsName, setEditWsName] = useState<string>('');
  const [inviteEmail, setInviteEmail] = useState<string>('');
  const [inviteRole, setInviteRole] = useState<number>(2); // 1: Admin, 2: Member, 3: Editor
  const [processingAction, setProcessingAction] = useState<boolean>(false);
  const [modalTab, setModalTab] = useState<'members' | 'add_member' | 'rename'>('members');

  useEffect(() => {
    fetchAccountTypes();
    fetchAdminWorkspaces();
    fetchWarranties();
  }, []);

  const fetchAccountTypes = async () => {
    try {
      const res = await fetch('/api/account-types');
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.data || []);
      if (Array.isArray(list)) {
        setAccountTypes(list);
        const capcutType = list.find((t: any) => t.name.toLowerCase().includes('capcut'));
        if (capcutType) {
          setSelectedAccountTypeId(capcutType.id);
        } else if (list.length > 0) {
          setSelectedAccountTypeId(list[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching account types:', err);
    }
  };

  const fetchAdminWorkspaces = async () => {
    setLoadingWorkspaces(true);
    try {
      const res = await fetch('/api/capcut/admin-workspaces');
      const data = await res.json();
      if (data.success) {
        setAdminWorkspaces(data.data || []);
        if (data.settings) {
          setCapcutPrice(data.settings.price || 50000);
          setCapcutEnabled(data.settings.enabled !== false);
        }
      }
    } catch (err) {
      console.error('Error fetching admin workspaces:', err);
    } finally {
      setLoadingWorkspaces(false);
    }
  };

  const fetchWarranties = async () => {
    setLoadingWarranties(true);
    try {
      const res = await fetch('/api/capcut/warranties');
      const data = await res.json();
      if (data.success) {
        setWarranties(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching warranties:', err);
    } finally {
      setLoadingWarranties(false);
    }
  };

  // Open Workspace CRUD Modal & Fetch Realtime Data from CapCut
  const openWorkspaceModal = async (wsId: string) => {
    setSelectedWorkspaceId(wsId);
    setLoadingDetail(true);
    setWorkspaceDetail(null);
    setWorkspaceMembers([]);
    setInviteLink('');
    setModalTab('members');

    try {
      const res = await fetch(`/api/capcut/workspace-details?workspace_id=${wsId}`);
      const data = await res.json();

      if (data.success) {
        setWorkspaceDetail(data.workspace);
        setWorkspaceMembers(Array.isArray(data.members) ? data.members : []);
        setInviteLink(data.invite_link || '');
        setEditWsName(data.workspace?.workspace_name || '');
      } else {
        alert(data.error || 'Không thể tải thông tin chi tiết Workspace.');
        setSelectedWorkspaceId(null);
      }
    } catch (err: any) {
      alert('Lỗi kết nối khi tải chi tiết Workspace CapCut');
      setSelectedWorkspaceId(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Update Workspace Name
  const handleUpdateWsName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editWsName.trim()) {
      alert('Vui lòng nhập tên Workspace mới!');
      return;
    }

    setProcessingAction(true);
    try {
      const res = await fetch('/api/capcut/workspace-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_name',
          workspace_id: selectedWorkspaceId,
          name: editWsName.trim()
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        alert(data.message || 'Đã đổi tên Workspace thành công!');
        fetchAdminWorkspaces();
        openWorkspaceModal(selectedWorkspaceId!);
      } else {
        alert(data.error || 'Lỗi đổi tên Workspace');
      }
    } catch (err) {
      alert('Lỗi mạng khi đổi tên Workspace');
    } finally {
      setProcessingAction(false);
    }
  };

  // Refresh Invitation Link
  const handleRefreshInviteLink = async () => {
    setProcessingAction(true);
    try {
      const res = await fetch('/api/capcut/workspace-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'refresh_link',
          workspace_id: selectedWorkspaceId
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setInviteLink(data.invite_link || '');
        alert('Đã làm mới & tạo link mời Workspace mới thành công!');
      } else {
        alert(data.error || 'Lỗi làm mới link mời');
      }
    } catch (err) {
      alert('Lỗi mạng khi làm mới link mời');
    } finally {
      setProcessingAction(false);
    }
  };

  // Add Member by Email
  const handleAddMemberByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      alert('Vui lòng nhập Email thành viên cần mời!');
      return;
    }

    setProcessingAction(true);
    try {
      const res = await fetch('/api/capcut/workspace-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_member',
          workspace_id: selectedWorkspaceId,
          email: inviteEmail.trim(),
          role: inviteRole
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        alert(data.message || `Đã gửi lời mời thành công tới ${inviteEmail}!`);
        setInviteEmail('');
        openWorkspaceModal(selectedWorkspaceId!);
      } else {
        alert(data.error || 'Không thể gửi lời mời thành viên.');
      }
    } catch (err) {
      alert('Lỗi mạng khi gửi lời mời');
    } finally {
      setProcessingAction(false);
    }
  };

  // Remove / Kick Member from Workspace
  const handleRemoveMember = async (memberRoleId: string, memberName: string) => {
    if (!confirm(`Bạn có chắc muốn XÓA/KICK thành viên "${memberName || memberRoleId}" khỏi Workspace?`)) return;

    setProcessingAction(true);
    try {
      const res = await fetch('/api/capcut/workspace-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove_member',
          workspace_id: selectedWorkspaceId,
          role_id: memberRoleId
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        alert(data.message || 'Đã xóa thành viên khỏi Workspace!');
        fetchAdminWorkspaces();
        openWorkspaceModal(selectedWorkspaceId!);
      } else {
        alert(data.error || 'Lỗi khi xóa thành viên');
      }
    } catch (err) {
      alert('Lỗi mạng khi xóa thành viên');
    } finally {
      setProcessingAction(false);
    }
  };

  // Change Member Role
  const handleChangeRole = async (memberRoleId: string, newRole: number) => {
    setProcessingAction(true);
    try {
      const res = await fetch('/api/capcut/workspace-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_role',
          workspace_id: selectedWorkspaceId,
          role_id: memberRoleId,
          role: newRole
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        alert('Đã cập nhật vai trò thành viên thành công!');
        openWorkspaceModal(selectedWorkspaceId!);
      } else {
        alert(data.error || 'Lỗi phân quyền thành viên');
      }
    } catch (err) {
      alert('Lỗi mạng khi cập nhật vai trò');
    } finally {
      setProcessingAction(false);
    }
  };

  // Delete Workspace Record from DB
  const handleDeleteWorkspace = async () => {
    if (!confirm('⚠️ BẠN CÓ CHẮC MUỐN XÓA WORKSPACE NÀY KHỎI CSDL? Hành động này không thể hoàn tác.')) return;

    setProcessingAction(true);
    try {
      const res = await fetch('/api/capcut/workspace-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_workspace',
          workspace_id: selectedWorkspaceId
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        alert('Đã xóa Workspace khỏi hệ thống CSDL!');
        setSelectedWorkspaceId(null);
        fetchAdminWorkspaces();
      } else {
        alert(data.error || 'Lỗi khi xóa Workspace');
      }
    } catch (err) {
      alert('Lỗi mạng khi xóa Workspace');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleAddAdminAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail || !newAdminPassword) {
      alert('Vui lòng nhập Email và Mật khẩu tài khoản Admin CapCut');
      return;
    }

    setAddingAdmin(true);
    try {
      const res = await fetch('/api/capcut/admin-workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newAdminEmail.trim(), password: newAdminPassword.trim() })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        alert(data.message || 'Đồng bộ tài khoản CapCut Admin thành công!');
        setNewAdminEmail('');
        setNewAdminPassword('');
        fetchAdminWorkspaces();
      } else {
        alert(data.error || 'Thêm tài khoản Admin thất bại.');
      }
    } catch (err) {
      alert('Lỗi kết nối tới server khi đồng bộ tài khoản Admin.');
    } finally {
      setAddingAdmin(false);
    }
  };

  const handleSaveSalesConfig = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch('/api/capcut/admin-workspaces', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: capcutPrice, enabled: capcutEnabled })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        alert('Đã cập nhật giá bán & trạng thái CapCut thành công!');
      } else {
        alert(data.error || 'Lỗi cập nhật cấu hình');
      }
    } catch (err) {
      alert('Không thể lưu cấu hình bán hàng');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleStartGenerate = async () => {
    if (count < 1 || count > 50) {
      alert('Vui lòng chọn số lượng từ 1 đến 50 tài khoản');
      return;
    }

    setGenerating(true);
    setProgressMsg(`Đang khởi động tiến trình tạo ${count} tài khoản CapCut...`);
    setResults([]);

    try {
      const res = await fetch('/api/capcut/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count,
          domain: domain.trim(),
          password: useRandomPass ? '' : password.trim(),
          saveToStorage,
          accountTypeId: saveToStorage ? selectedAccountTypeId : null
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResults(data.data || []);
        setStats(prev => ({
          total: prev.total + (data.total || 0),
          success: prev.success + (data.successCount || 0),
          failed: prev.failed + ((data.total || 0) - (data.successCount || 0))
        }));
        setProgressMsg(`✅ Đã hoàn tất tạo ${data.successCount}/${data.total} tài khoản CapCut!`);
      } else {
        alert(data.error || 'Lỗi khi tạo tài khoản CapCut');
        setProgressMsg('❌ Xảy ra lỗi trong quá trình tạo tài khoản.');
      }
    } catch (err: any) {
      alert('Lỗi kết nối máy chủ khi tạo tài khoản');
      setProgressMsg('❌ Không thể kết nối tới máy chủ API.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyAll = () => {
    const successAccs = results
      .filter(r => r.status === 'success')
      .map(r => r.userId ? `${r.email}|${r.password}|${r.userId}` : `${r.email}|${r.password}`)
      .join('\n');

    if (!successAccs) {
      alert('Chưa có tài khoản nào tạo thành công để sao chép.');
      return;
    }

    navigator.clipboard.writeText(successAccs);
    alert(`Đã sao chép ${results.filter(r => r.status === 'success').length} tài khoản vào khay nhớ tạm!`);
  };

  const handleDownloadTxt = () => {
    const successAccs = results
      .filter(r => r.status === 'success')
      .map(r => r.userId ? `${r.email}|${r.password}|${r.userId}` : `${r.email}|${r.password}`)
      .join('\n');

    if (!successAccs) {
      alert('Chưa có tài khoản nào tạo thành công để tải về.');
      return;
    }

    const blob = new Blob([successAccs], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `capcut_accounts_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDaysRemaining = (timestamp: number) => {
    if (!timestamp || timestamp === 0) return 'Vĩnh viễn / N/A';
    const now = Math.floor(Date.now() / 1000);
    const diffSec = timestamp - now;
    if (diffSec <= 0) return 'Hết hạn VIP';
    const days = Math.floor(diffSec / 86400);
    return `${days} ngày nữa`;
  };

  const filteredWarranties = warranties.filter((w) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      w.telegram_id.toLowerCase().includes(q) ||
      w.user_capcut_email.toLowerCase().includes(q) ||
      w.workspace_id.toLowerCase().includes(q) ||
      (w.user_capcut_uid && w.user_capcut_uid.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-2 sm:p-4 text-xs">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-600 p-6 rounded-3xl text-white shadow-xl shadow-orange-500/10">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md font-bold text-white shadow-inner">
            <Zap className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight flex items-center gap-2">
              HỆ THỐNG CAPCUT PRO TỰ ĐỘNG
            </h1>
            <p className="text-xs text-orange-100 font-medium mt-0.5">
              Tạo TK Mail Tạm, Quản lý Workspace Admin, Tự động Nâng cấp VIP & Bảo Hành Khách Hàng
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20">
          <Cpu className="h-4 w-4 text-yellow-300 animate-pulse" />
          <span className="font-extrabold text-xs tracking-wider uppercase">CAPCUT FAMILY ENGINE v2.0</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-zinc-200 gap-2 bg-white p-2 rounded-2xl border border-zinc-200">
        <button
          onClick={() => setActiveTab('admin_workspaces')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-extrabold text-xs uppercase transition cursor-pointer ${
            activeTab === 'admin_workspaces'
              ? 'bg-orange-600 text-white shadow-md shadow-orange-500/20'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>👑 WORKSPACE ADMIN & HẠN VIP</span>
        </button>

        <button
          onClick={() => setActiveTab('warranties')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-extrabold text-xs uppercase transition cursor-pointer ${
            activeTab === 'warranties'
              ? 'bg-orange-600 text-white shadow-md shadow-orange-500/20'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          <span>🛡 BẢO HÀNH KHI MUA CAPCUT</span>
        </button>

        <button
          onClick={() => setActiveTab('generator')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-extrabold text-xs uppercase transition cursor-pointer ${
            activeTab === 'generator'
              ? 'bg-orange-600 text-white shadow-md shadow-orange-500/20'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span>⚡ TẠO TK CAPCUT HÀNG LOẠT</span>
        </button>
      </div>

      {/* TAB 1: ADMIN WORKSPACES & SALES CONFIG */}
      {activeTab === 'admin_workspaces' && (
        <div className="space-y-6">
          {/* Sales Config Section */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs">
            <div className="border-b border-zinc-100 pb-3 mb-4 flex items-center justify-between">
              <h2 className="font-black text-xs uppercase text-zinc-800 tracking-wider flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-orange-600" />
                <span>CẤU HÌNH GIÁ BÁN & TRẠNG THÁI BÁN HÀNG TỰ ĐỘNG</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div className="space-y-1.5">
                <label className="font-extrabold uppercase text-zinc-700 text-[11px]">GIÁ 1 LẦN NÂNG CẤP CAPCUT PRO (VNĐ) *</label>
                <input
                  type="number"
                  value={capcutPrice}
                  onChange={(e) => setCapcutPrice(Number(e.target.value))}
                  className="w-full rounded-xl border border-zinc-200 p-3 font-extrabold text-zinc-900 text-sm outline-none focus:border-orange-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-extrabold uppercase text-zinc-700 text-[11px]">TRẠNG THÁI BÁN TRÊN BOT TELEGRAM</label>
                <select
                  value={capcutEnabled ? 'true' : 'false'}
                  onChange={(e) => setCapcutEnabled(e.target.value === 'true')}
                  className="w-full rounded-xl border border-zinc-200 p-3 font-extrabold text-zinc-900 text-sm outline-none focus:border-orange-500"
                >
                  <option value="true">🟢 Đang Cho Phép Khách Mua (Bật)</option>
                  <option value="false">🔴 Đang Tạm Dừng Bán (Tắt)</option>
                </select>
              </div>

              <div>
                <button
                  onClick={handleSaveSalesConfig}
                  disabled={savingSettings}
                  className="w-full rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs uppercase px-6 py-3.5 shadow-md transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {savingSettings ? 'ĐANG LƯU...' : '💾 LƯU CẤU HÌNH BÁN HÀNG'}
                </button>
              </div>
            </div>
          </div>

          {/* Add Admin Account Form */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs">
            <div className="border-b border-zinc-100 pb-3 mb-4">
              <h2 className="font-black text-xs uppercase text-zinc-800 tracking-wider flex items-center gap-2">
                <Plus className="h-4 w-4 text-orange-600" />
                <span>THÊM TÀI KHOẢN ADMIN CAPCUT (FAMILY WORKSPACE)</span>
              </h2>
              <p className="text-[11px] text-zinc-500 mt-1">
                Nhập Email & Mật khẩu CapCut Admin có VIP. Hệ thống sẽ tự động đăng nhập, lưu Cookie và thu thập danh sách Workspace Admin để bán hàng.
              </p>
            </div>

            <form onSubmit={handleAddAdminAccount} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div className="space-y-1.5">
                <label className="font-extrabold uppercase text-zinc-700 text-[11px]">EMAIL ADMIN CAPCUT *</label>
                <input
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="admin_family@hotmail.com"
                  className="w-full rounded-xl border border-zinc-200 p-3 font-semibold text-zinc-900 outline-none focus:border-orange-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-extrabold uppercase text-zinc-700 text-[11px]">MẬT KHẨU ADMIN CAPCUT *</label>
                <input
                  type="text"
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  placeholder="Password123"
                  className="w-full rounded-xl border border-zinc-200 p-3 font-mono text-zinc-900 outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={addingAdmin}
                  className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase px-6 py-3.5 shadow-md transition active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${addingAdmin ? 'animate-spin' : ''}`} />
                  <span>{addingAdmin ? 'ĐANG ĐỒNG BỘ COOKIE...' : '⚡ ĐỒNG BỘ TÀI KHOẢN ADMIN'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Admin Workspaces Table */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs">
            <div className="border-b border-zinc-100 pb-3 mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-black text-xs uppercase text-zinc-800 tracking-wider flex items-center gap-2">
                  <Users className="h-4 w-4 text-orange-600" />
                  <span>DANH SÁCH WORKSPACE ADMIN HẠN VIP</span>
                </h2>
                <p className="text-[11px] text-zinc-500 mt-0.5">Nhấp vào bất kỳ dòng Workspace nào để xem danh sách thành viên và quản lý CRUD toàn bộ tính năng CapCut.</p>
              </div>

              <button
                onClick={fetchAdminWorkspaces}
                className="text-orange-600 font-extrabold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>LÀM MỚI</span>
              </button>
            </div>

            {loadingWorkspaces ? (
              <div className="py-12 text-center text-zinc-400 font-bold">Đang tải danh sách Workspace Admin...</div>
            ) : adminWorkspaces.length === 0 ? (
              <div className="py-12 text-center text-zinc-400 font-bold">Chưa có tài khoản Admin Workspace nào. Hãy thêm tài khoản ở form phía trên!</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 text-[10px] uppercase font-black text-zinc-600">
                      <th className="p-3">EMAIL ADMIN</th>
                      <th className="p-3">TÊN WORKSPACE</th>
                      <th className="p-3">WORKSPACE ID</th>
                      <th className="p-3 text-center">SLOT THÀNH VIÊN</th>
                      <th className="p-3">HẠN VIP PRO</th>
                      <th className="p-3 text-center">TRẠNG THÁI</th>
                      <th className="p-3 text-center">THAO TÁC (CRUD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {adminWorkspaces.map((ws) => {
                      const daysLeftText = formatDaysRemaining(ws.team_vip_end);
                      const isNearExpiry = ws.team_vip_end > 0 && (ws.team_vip_end - Math.floor(Date.now() / 1000)) < 7 * 86400;

                      return (
                        <tr
                          key={ws.workspace_id}
                          className="hover:bg-orange-50/40 font-medium transition-colors cursor-pointer group"
                          onClick={() => openWorkspaceModal(ws.workspace_id)}
                        >
                          <td className="p-3 font-extrabold text-zinc-900">{ws.admin_email}</td>
                          <td className="p-3 font-bold text-zinc-800 flex items-center gap-1.5">
                            <span className="group-hover:text-orange-600 transition-colors">{ws.workspace_name}</span>
                          </td>
                          <td className="p-3 font-mono text-zinc-500">{ws.workspace_id}</td>
                          <td className="p-3 text-center font-extrabold">
                            <span className={ws.member_cnt >= ws.member_limit ? 'text-red-600' : 'text-emerald-600'}>
                              {ws.member_cnt} / {ws.member_limit}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5">
                              {isNearExpiry && <AlertTriangle className="h-4 w-4 text-amber-500 animate-bounce" />}
                              <span className={`font-bold ${isNearExpiry ? 'text-amber-600' : 'text-zinc-900'}`}>
                                {ws.team_vip_end > 0 ? new Date(ws.team_vip_end * 1000).toLocaleDateString('vi-VN') : 'N/A'}
                              </span>
                              <span className="text-[10px] text-zinc-400">({daysLeftText})</span>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            {ws.status === 'active' && (
                              <span className="bg-emerald-100 text-emerald-800 font-extrabold text-[10px] px-2.5 py-1 rounded-full uppercase">Sẵn sàng (Active)</span>
                            )}
                            {ws.status === 'full' && (
                              <span className="bg-red-100 text-red-800 font-extrabold text-[10px] px-2.5 py-1 rounded-full uppercase">Đã Đầy Slot</span>
                            )}
                            {ws.status === 'expired' && (
                              <span className="bg-amber-100 text-amber-800 font-extrabold text-[10px] px-2.5 py-1 rounded-full uppercase">Hết Hạn VIP</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openWorkspaceModal(ws.workspace_id);
                              }}
                              className="inline-flex items-center gap-1 bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-[11px] px-3 py-1.5 rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
                            >
                              <Settings className="h-3.5 w-3.5" />
                              <span>QUẢN LÝ (CRUD)</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: WARRANTIES */}
      {activeTab === 'warranties' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs">
            <div className="border-b border-zinc-100 pb-3 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="font-black text-xs uppercase text-zinc-800 tracking-wider flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-orange-600" />
                <span>DANH SÁCH BẢO HÀNH KHI KHÁCH MUA CAPCUT</span>
              </h2>

              <div className="relative min-w-[260px]">
                <Search className="h-4 w-4 absolute left-3 top-3 text-zinc-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm Telegram ID, Email, Workspace ID..."
                  className="w-full rounded-xl border border-zinc-200 pl-9 pr-3 py-2 text-xs outline-none focus:border-orange-500"
                />
              </div>
            </div>

            {loadingWarranties ? (
              <div className="py-12 text-center text-zinc-400 font-bold">Đang tải danh sách bảo hành...</div>
            ) : filteredWarranties.length === 0 ? (
              <div className="py-12 text-center text-zinc-400 font-bold">Chưa tìm thấy lịch sử mua hàng nào.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 text-[10px] uppercase font-black text-zinc-600">
                      <th className="p-3">TELEGRAM ID</th>
                      <th className="p-3">EMAIL KHÁCH CAPCUT</th>
                      <th className="p-3">CAPCUT UID</th>
                      <th className="p-3">WORKSPACE ID</th>
                      <th className="p-3">EMAIL ADMIN JOINED</th>
                      <th className="p-3">NGÀY THAM GIA</th>
                      <th className="p-3">HẠN BẢO HÀNH</th>
                      <th className="p-3 text-center">TRẠNG THÁI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredWarranties.map((w) => (
                      <tr key={w.id} className="hover:bg-zinc-50/50 font-medium">
                        <td className="p-3 font-extrabold text-orange-600">{w.telegram_id}</td>
                        <td className="p-3 font-bold text-zinc-900">{w.user_capcut_email}</td>
                        <td className="p-3 font-mono text-zinc-500">{w.user_capcut_uid || 'N/A'}</td>
                        <td className="p-3 font-mono text-zinc-500">{w.workspace_id}</td>
                        <td className="p-3 font-bold text-emerald-700 font-mono">{w.admin_email || 'N/A'}</td>
                        <td className="p-3 text-zinc-600">
                          {new Date(w.joined_at).toLocaleDateString('vi-VN')}
                        </td>
                        <td className="p-3 font-bold text-emerald-600">
                          {w.expires_at ? new Date(w.expires_at).toLocaleDateString('vi-VN') : 'N/A'}
                        </td>
                        <td className="p-3 text-center">
                          <span className="bg-emerald-100 text-emerald-800 font-extrabold text-[10px] px-2.5 py-1 rounded-full uppercase">
                            Bảo Hành Vĩnh Viễn / VIP
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: GENERATOR */}
      {activeTab === 'generator' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">TỔNG TÀI KHOẢN ĐÃ TẠO</span>
              <div className="text-2xl font-black text-zinc-900 mt-1">{stats.total} tài khoản</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">THÀNH CÔNG</span>
              <div className="text-2xl font-black text-emerald-600 mt-1 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                <span>{stats.success}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">TỶ LỆ THÀNH CÔNG</span>
              <div className="text-2xl font-black text-orange-600 mt-1 font-mono">
                {stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 100}%
              </div>
            </div>
          </div>

          {/* Configuration Form */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-5 shadow-2xs">
            <div className="border-b border-zinc-100 pb-3 flex items-center justify-between">
              <h2 className="font-black text-xs uppercase text-zinc-800 tracking-wider flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-orange-600" />
                <span>CẤU HÌNH THÔNG SỐ TẠO TÀI KHOẢN CAPCUT</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-1.5">
                <label className="font-extrabold uppercase text-zinc-700 text-[11px]">SỐ LƯỢNG CẦN TẠO (1 - 50) *</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={count}
                  onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value))))}
                  className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-extrabold text-zinc-900 outline-none focus:border-orange-500 transition text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-extrabold uppercase text-zinc-700 text-[11px]">DOMAIN MAIL TẠM *</label>
                <select
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-semibold text-zinc-900 outline-none focus:border-orange-500 transition"
                >
                  <option value="capcut.lienmanhgroup.io.vn">capcut.lienmanhgroup.io.vn (Chuyên CapCut)</option>
                  <option value="lienmanhgroup.io.vn">lienmanhgroup.io.vn</option>
                  <option value="sugtbt.com">sugtbt.com</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-extrabold uppercase text-zinc-700 text-[11px]">CẤU HÌNH MẬT KHẨU *</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-zinc-700 text-xs">
                    <input
                      type="checkbox"
                      checked={useRandomPass}
                      onChange={(e) => setUseRandomPass(e.target.checked)}
                      className="h-4 w-4 rounded accent-orange-600 cursor-pointer"
                    />
                    <span>Mật khẩu ngẫu nhiên an toàn</span>
                  </label>

                  {!useRandomPass && (
                    <input
                      type="text"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Nhập mật khẩu cố định..."
                      className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 font-mono text-zinc-900 text-xs outline-none"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Auto Save to Database Option */}
            <div className="pt-3 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-50 p-4 rounded-xl border border-zinc-200">
              <div className="space-y-1">
                <label className="flex items-center gap-2 cursor-pointer font-black text-xs text-zinc-900 uppercase">
                  <input
                    type="checkbox"
                    checked={saveToStorage}
                    onChange={(e) => setSaveToStorage(e.target.checked)}
                    className="h-4 w-4 rounded accent-orange-600 cursor-pointer"
                  />
                  <span>TỰ ĐỘNG LƯU TÀI KHOẢN VÀO KHO LƯU TÀI KHOẢN TỰ ĐỘNG</span>
                </label>
                <p className="text-[11px] text-zinc-500 pl-6">
                  Tài khoản tạo thành công sẽ tự động được thêm vào kho lưu trữ (tự động xuất cho đơn hàng CapCut nếu cần).
                </p>
              </div>

              {saveToStorage && (
                <div className="min-w-[200px] space-y-1">
                  <label className="font-extrabold uppercase text-zinc-700 text-[10px]">CHỌN LOẠI TÀI KHOẢN KHO *</label>
                  <select
                    value={selectedAccountTypeId}
                    onChange={(e) => setSelectedAccountTypeId(Number(e.target.value))}
                    className="w-full rounded-xl border border-zinc-200 bg-white p-2 font-bold text-zinc-900 text-xs outline-none focus:border-orange-500"
                  >
                    {accountTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                onClick={handleStartGenerate}
                disabled={generating}
                className="w-full sm:w-auto rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black text-sm uppercase px-8 py-3.5 shadow-lg shadow-orange-500/20 transition active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
                <span>{generating ? 'ĐANG KHỞI TẠO TÀI KHOẢN...' : `⚡ BẮT ĐẦU TẠO ${count} TK CAPCUT`}</span>
              </button>
            </div>
          </div>

          {/* Progress Message */}
          {progressMsg && (
            <div className="p-4 rounded-xl bg-zinc-900 text-white font-mono text-xs flex items-center justify-between">
              <span>{progressMsg}</span>
              {generating && <RefreshCw className="h-4 w-4 animate-spin text-orange-400" />}
            </div>
          )}

          {/* Results Table */}
          {results.length > 0 && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 space-y-4 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-3">
                <h2 className="font-black text-xs uppercase text-zinc-800 tracking-wider flex items-center gap-2">
                  <Database className="h-4 w-4 text-orange-600" />
                  <span>KẾT QUẢ KHO TÀI KHOẢN CAPCUT TẠO MỚI</span>
                </h2>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyAll}
                    className="rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-800 font-extrabold text-xs px-4 py-2 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>SAO CHÉP TẤT CẢ (TX|MK|UID)</span>
                  </button>

                  <button
                    onClick={handleDownloadTxt}
                    className="rounded-xl bg-zinc-900 hover:bg-black text-white font-extrabold text-xs px-4 py-2 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>TẢI FILE .TXT</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 text-[10px] uppercase font-black text-zinc-600">
                      <th className="p-3">#</th>
                      <th className="p-3">EMAIL CAPCUT</th>
                      <th className="p-3">MẬT KHẨU</th>
                      <th className="p-3">CAPCUT USER ID (UID)</th>
                      <th className="p-3 text-center">TRẠNG THÁI</th>
                      <th className="p-3 text-center">KHO LƯU TRỮ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 font-mono">
                    {results.map((r, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50/50">
                        <td className="p-3 font-bold text-zinc-400">{r.index || idx + 1}</td>
                        <td className="p-3 font-extrabold text-zinc-900">{r.email}</td>
                        <td className="p-3 font-bold text-orange-600">{r.password}</td>
                        <td className="p-3 text-zinc-500">{r.userId || 'N/A'}</td>
                        <td className="p-3 text-center">
                          {r.status === 'success' && (
                            <span className="bg-emerald-100 text-emerald-800 font-extrabold text-[10px] px-2.5 py-1 rounded-full uppercase">Thành công</span>
                          )}
                          {r.status === 'failed' && (
                            <span className="bg-red-100 text-red-800 font-extrabold text-[10px] px-2.5 py-1 rounded-full uppercase">Thất bại</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {r.savedToDb ? (
                            <span className="text-emerald-600 font-bold">✓ Đã lưu kho</span>
                          ) : (
                            <span className="text-zinc-400">Tạo chay</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* FULL CRUD MODAL FOR SELECTED WORKSPACE */}
      {selectedWorkspaceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl space-y-6 border border-zinc-200 animate-in fade-in zoom-in duration-150">

            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600 font-bold">
                  <Settings size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-zinc-900 flex items-center gap-2">
                    {workspaceDetail?.workspace_name || 'Chi Tiết Workspace CapCut'}
                    <span className="text-xs font-mono text-zinc-400 font-normal">({selectedWorkspaceId})</span>
                  </h3>
                  <p className="text-xs text-zinc-500 font-medium mt-0.5">
                    Admin: <span className="font-bold text-zinc-800">{workspaceDetail?.admin_email || 'N/A'}</span> • Hạn VIP: <span className="font-bold text-orange-600">{formatDaysRemaining(workspaceDetail?.team_vip_end || 0)}</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedWorkspaceId(null)}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 hover:bg-zinc-200 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {loadingDetail ? (
              <div className="py-20 text-center space-y-3">
                <RefreshCw className="animate-spin h-8 w-8 text-orange-600 mx-auto" />
                <p className="font-extrabold text-sm text-zinc-700">Đang đồng bộ dữ liệu trực tiếp từ CapCut API...</p>
              </div>
            ) : (
              <div className="space-y-6">

                {/* Invite Link Card */}
                <div className="rounded-2xl bg-orange-50/60 border border-orange-200/80 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-orange-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Link2 size={14} className="text-orange-600" /> Link Mời Tham Gia Workspace Mới Nhất
                    </span>
                    <button
                      onClick={handleRefreshInviteLink}
                      disabled={processingAction}
                      className="text-xs font-bold text-orange-700 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw size={12} className={processingAction ? 'animate-spin' : ''} />
                      Tạo & Làm mới Link mới
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={inviteLink || 'Không lấy được link mời'}
                      className="w-full rounded-xl border border-orange-200 bg-white p-2.5 font-mono text-xs text-zinc-900 outline-none"
                    />
                    <button
                      onClick={() => {
                        if (inviteLink) {
                          navigator.clipboard.writeText(inviteLink);
                          alert('Đã sao chép link mời CapCut!');
                        }
                      }}
                      disabled={!inviteLink}
                      className="rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs px-4 py-2.5 shrink-0 transition cursor-pointer flex items-center gap-1"
                    >
                      <Copy size={13} /> Sao Chép
                    </button>
                  </div>
                </div>

                {/* Sub Navigation Tabs */}
                <div className="flex border-b border-zinc-200 gap-2">
                  <button
                    onClick={() => setModalTab('members')}
                    className={`px-4 py-2.5 font-extrabold text-xs border-b-2 transition ${
                      modalTab === 'members' ? 'border-orange-600 text-orange-600' : 'border-transparent text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    👥 DANH SÁCH THÀNH VIÊN ({workspaceMembers.length} / {workspaceDetail?.member_limit || 7})
                  </button>

                  <button
                    onClick={() => setModalTab('add_member')}
                    className={`px-4 py-2.5 font-extrabold text-xs border-b-2 transition ${
                      modalTab === 'add_member' ? 'border-orange-600 text-orange-600' : 'border-transparent text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    ➕ MỜI THÀNH VIÊN QUA EMAIL
                  </button>

                  <button
                    onClick={() => setModalTab('rename')}
                    className={`px-4 py-2.5 font-extrabold text-xs border-b-2 transition ${
                      modalTab === 'rename' ? 'border-orange-600 text-orange-600' : 'border-transparent text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    ✏️ ĐỔI TÊN WORKSPACE
                  </button>
                </div>

                {/* TAB 1: MEMBERS LIST */}
                {modalTab === 'members' && (
                  <div className="space-y-4">
                    {workspaceMembers.length === 0 ? (
                      <div className="py-10 text-center text-zinc-400 font-semibold">Chưa có thành viên nào trong Workspace này.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-zinc-200 bg-zinc-50 text-[10px] uppercase font-black text-zinc-600">
                              <th className="p-3">THÀNH VIÊN</th>
                              <th className="p-3">EMAIL / UID</th>
                              <th className="p-3">VAI TRÒ</th>
                              <th className="p-3 text-center">THAO TÁC CRUD</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100">
                            {workspaceMembers.map((m: any, idx: number) => {
                              const mName = m.nickname || m.name || m.user_id_str || `User ${idx + 1}`;
                              const mEmail = m.email || m.user_id_str || m.user_id || 'N/A';
                              const mRoleId = m.role_id || m.user_id || m.user_id_str;
                              const currentRole = Number(m.role) || 2;

                              return (
                                <tr key={idx} className="hover:bg-zinc-50/50 font-medium">
                                  <td className="p-3 flex items-center gap-2.5">
                                    {m.avatar_url ? (
                                      <img src={m.avatar_url} alt="Avatar" className="h-8 w-8 rounded-full border" />
                                    ) : (
                                      <div className="h-8 w-8 rounded-full bg-orange-100 text-orange-700 font-bold flex items-center justify-center text-xs">
                                        {mName.charAt(0).toUpperCase()}
                                      </div>
                                    )}
                                    <span className="font-extrabold text-zinc-900">{mName}</span>
                                  </td>

                                  <td className="p-3 font-mono text-zinc-600">{mEmail}</td>

                                  <td className="p-3">
                                    <select
                                      value={currentRole}
                                      onChange={(e) => handleChangeRole(mRoleId, Number(e.target.value))}
                                      disabled={processingAction}
                                      className="rounded-lg border border-zinc-200 bg-white px-2 py-1 font-bold text-xs outline-none"
                                    >
                                      <option value={1}>Chủ sở hữu / Admin (Role 1)</option>
                                      <option value={2}>Thành viên (Member - Role 2)</option>
                                      <option value={3}>Biên tập viên (Editor - Role 3)</option>
                                    </select>
                                  </td>

                                  <td className="p-3 text-center">
                                    <button
                                      onClick={() => handleRemoveMember(mRoleId, mName)}
                                      disabled={processingAction}
                                      className="inline-flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-[11px] px-3 py-1.5 rounded-xl transition cursor-pointer"
                                    >
                                      <UserMinus size={13} />
                                      <span>Xóa / Kick</span>
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: ADD MEMBER */}
                {modalTab === 'add_member' && (
                  <form onSubmit={handleAddMemberByEmail} className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-5 space-y-4">
                    <h4 className="font-bold text-xs uppercase text-zinc-800">Mời thành viên mới vào Workspace này qua Email CapCut</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                      <div className="sm:col-span-2 space-y-1">
                        <label className="font-bold text-[11px] text-zinc-700 uppercase">Email CapCut Khách Hàng *</label>
                        <input
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="khachhang_capcut@gmail.com"
                          className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 text-xs text-zinc-900 outline-none"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-[11px] text-zinc-700 uppercase">Chọn Vai Trò *</label>
                        <select
                          value={inviteRole}
                          onChange={(e) => setInviteRole(Number(e.target.value))}
                          className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 text-xs text-zinc-900 outline-none"
                        >
                          <option value={2}>Thành viên (Member)</option>
                          <option value={1}>Administrator</option>
                          <option value={3}>Editor</option>
                        </select>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={processingAction}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                    >
                      <UserPlus size={14} className="mr-1" />
                      {processingAction ? 'Đang gửi...' : 'Gửi Lời Mời Trực Tiếp'}
                    </Button>
                  </form>
                )}

                {/* TAB 3: RENAME WORKSPACE */}
                {modalTab === 'rename' && (
                  <form onSubmit={handleUpdateWsName} className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-5 space-y-4">
                    <h4 className="font-bold text-xs uppercase text-zinc-800">Đổi tên Workspace CapCut Pro</h4>
                    <div className="space-y-1">
                      <label className="font-bold text-[11px] text-zinc-700 uppercase">Tên Workspace Mới *</label>
                      <input
                        type="text"
                        value={editWsName}
                        onChange={(e) => setEditWsName(e.target.value)}
                        placeholder="VD: DUCVIET PRO SPACE"
                        className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 text-xs text-zinc-900 outline-none"
                        required
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={processingAction}
                      className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs"
                    >
                      <Edit2 size={14} className="mr-1" />
                      {processingAction ? 'Đang cập nhật...' : 'Cập Nhật Tên Workspace'}
                    </Button>
                  </form>
                )}

                {/* Footer System Actions */}
                <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
                  <button
                    onClick={() => openWorkspaceModal(selectedWorkspaceId!)}
                    className="text-xs font-bold text-zinc-600 hover:text-zinc-900 flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw size={13} /> Tải lại dữ liệu CapCut API
                  </button>

                  <button
                    onClick={handleDeleteWorkspace}
                    disabled={processingAction}
                    className="text-xs font-bold text-red-600 hover:text-red-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 size={13} /> Xóa Workspace khỏi CSDL
                  </button>
                </div>

              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
