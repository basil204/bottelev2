'use client';

import { useEffect, useState, useMemo } from 'react';
import { useCurrency } from '@/hooks/useCurrency';
import {
  Package, Plus, Search, RefreshCw, Folder, Star, ArrowUp, ArrowDown,
  GripVertical, Database, MoreHorizontal, Edit, Trash2, X, Upload, Sparkles,
  HelpCircle, AlertCircle, ShoppingBag, Tag, Layers, FileText, MessageSquareText
} from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';

interface Product {
  id: number;
  name: string;
  name_vi?: string;
  name_en?: string;
  name_zh?: string;
  code: string | null;
  price: number;
  cost_price?: number;
  description: string;
  description_vi?: string;
  description_en?: string;
  description_zh?: string;
  note_vi?: string;
  note_en?: string;
  note_zh?: string;
  stock: number;
  low_stock_threshold: number;
  sold_count: number;
  type: 'stock' | 'order';
  require_email?: boolean | number;
  delivery_type?: string;
  min_quantity?: number;
  priority: number;
  is_active?: boolean | number;
  show_sold_count?: boolean | number;
  check_live: number;
  category_id?: number | null;
  category_name?: string | null;
  emoji?: string;
  custom_emoji_id?: string;
  image_url?: string;
  item_structure?: string;
  account_prefix?: string;
  file_delivery_mode?: string;
  telegram_file_id?: string;
  telegram_file_unique_id?: string;
  prompt_message?: string;
  prompt_message_vi?: string;
  prompt_message_en?: string;
  prompt_message_zh?: string;
  access_duration_enabled?: boolean;
  access_duration_days?: number;
  preorder_enabled?: boolean;
  preorder_fee_vnd?: number;
  preorder_fee_usdt?: number;
  preorder_max_per_user?: number;
  preorder_total_limit?: number;
  notify_telegram?: boolean;
}

interface Category {
  id: number;
  name: string;
}

interface Account {
  id: number;
  username: string;
  password?: string | null;
  extra_data?: string | null;
  twofa?: string | null;
  status: string;
  created_at: string;
}

interface CustomPrice {
  id: number;
  user_identifier: string;
  product_id: number;
  product_name: string;
  plan_label: string;
  scope: 'all_orders' | 'client_api';
  custom_price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface SoldItem {
  id: number;
  order_code: string;
  product_id: number;
  item_data: string;
  user_id: number;
  buyer_username: string;
  price: number;
  sold_at: string;
}

export default function ProductsPage() {
  const { formatPrice } = useCurrency();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Drag and drop / Reordering State
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const handleReorderSave = async (newList: Product[]) => {
    const maxPriority = newList.length * 10;
    const reorderPayload = newList.map((item, idx) => ({
      id: item.id,
      priority: maxPriority - idx * 10
    }));

    setProducts(prev => {
      const map = new Map(newList.map((item, idx) => [item.id, maxPriority - idx * 10]));
      const updated = prev.map(p => ({
        ...p,
        priority: map.has(p.id) ? map.get(p.id)! : p.priority
      }));
      return [...updated].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    });

    try {
      await fetch('/api/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reorder: reorderPayload })
      });
    } catch (err) {
      console.error('Failed to save reorder:', err);
    }
  };

  const handleMoveProduct = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= filteredProducts.length) return;

    const newList = [...filteredProducts];
    const temp = newList[index];
    newList[index] = newList[targetIndex];
    newList[targetIndex] = temp;

    handleReorderSave(newList);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIdx !== index) {
      setDragOverIdx(index);
    }
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === dropIndex) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }

    const newList = [...filteredProducts];
    const [draggedItem] = newList.splice(draggedIdx, 1);
    newList.splice(dropIndex, 0, draggedItem);

    setDraggedIdx(null);
    setDragOverIdx(null);
    handleReorderSave(newList);
  };

  // 1. Edit / New Product Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'general' | 'delivery' | 'translation'>('general');
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [productFormError, setProductFormError] = useState('');
  const [savingProduct, setSavingProduct] = useState(false);

  // Active Multilingual Tabs for Form
  const [descLang, setDescLang] = useState<'vi' | 'en' | 'zh'>('vi');
  const [nameLang, setNameLang] = useState<'vi' | 'en' | 'zh'>('vi');
  const [promptLang, setPromptLang] = useState<'vi' | 'en' | 'zh'>('vi');

  // Translation Tab state
  const [transLang, setTransLang] = useState<'vi' | 'en' | 'zh'>('en');

  // Multilingual field accessors
  const getProductDescForLang = (lang: 'vi' | 'en' | 'zh') => {
    if (!editingProduct) return '';
    if (lang === 'en') return editingProduct.description_en !== undefined ? editingProduct.description_en : (editingProduct.note_en || '');
    if (lang === 'zh') return editingProduct.description_zh !== undefined ? editingProduct.description_zh : (editingProduct.note_zh || '');
    return editingProduct.description_vi !== undefined ? editingProduct.description_vi : (editingProduct.description || '');
  };

  const setProductDescForLang = (lang: 'vi' | 'en' | 'zh', val: string) => {
    setEditingProduct(prev => {
      if (!prev) return prev;
      if (lang === 'en') return { ...prev, description_en: val, note_en: val };
      if (lang === 'zh') return { ...prev, description_zh: val, note_zh: val };
      return { ...prev, description_vi: val, note_vi: val, description: val };
    });
  };

  const getProductNameForLang = (lang: 'vi' | 'en' | 'zh') => {
    if (!editingProduct) return '';
    if (lang === 'en') return editingProduct.name_en || '';
    if (lang === 'zh') return editingProduct.name_zh || '';
    return editingProduct.name_vi || editingProduct.name || '';
  };

  const setProductNameForLang = (lang: 'vi' | 'en' | 'zh', val: string) => {
    setEditingProduct(prev => {
      if (!prev) return prev;
      if (lang === 'en') return { ...prev, name_en: val };
      if (lang === 'zh') return { ...prev, name_zh: val };
      return { ...prev, name_vi: val, name: val };
    });
  };

  const getProductPromptForLang = (lang: 'vi' | 'en' | 'zh') => {
    if (!editingProduct) return '';
    if (lang === 'en') return editingProduct.prompt_message_en || '';
    if (lang === 'zh') return editingProduct.prompt_message_zh || '';
    return editingProduct.prompt_message_vi || editingProduct.prompt_message || '';
  };

  const setProductPromptForLang = (lang: 'vi' | 'en' | 'zh', val: string) => {
    setEditingProduct(prev => {
      if (!prev) return prev;
      if (lang === 'en') return { ...prev, prompt_message_en: val };
      if (lang === 'zh') return { ...prev, prompt_message_zh: val };
      return { ...prev, prompt_message_vi: val, prompt_message: val };
    });
  };

  // Fixed Position Action Menu State
  const [actionMenuState, setActionMenuState] = useState<{ product: Product; top: number; left: number } | null>(null);

  // 2. KHO HÀNG (CHƯA BÁN) Modal State
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [stockModalView, setStockModalView] = useState<'list' | 'add'>('list');
  const [stockInputFormat, setStockInputFormat] = useState<'line' | 'block'>('line');
  const [stockData, setStockData] = useState('');
  const [notifyStockTelegram, setNotifyStockTelegram] = useState(true);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [stockAccounts, setStockAccounts] = useState<Account[]>([]);

  // 3. LỊCH SỬ SẢN PHẨM ĐÃ BÁN Modal State
  const [isSoldModalOpen, setIsSoldModalOpen] = useState(false);
  const [soldSearchQuery, setSoldSearchQuery] = useState('');
  const [soldList, setSoldList] = useState<SoldItem[]>([]);

  // 4. GIÁ RIÊNG THEO KHÁCH Modal State
  const [isCustomPriceModalOpen, setIsCustomPriceModalOpen] = useState(false);
  const [customPrices, setCustomPrices] = useState<CustomPrice[]>([]);
  const [newCustomUser, setNewCustomUser] = useState('');
  const [newCustomPrice, setNewCustomPrice] = useState<number | ''>('');
  const [newCustomPlan, setNewCustomPlan] = useState('Không áp dụng gói');
  const [newCustomScope, setNewCustomScope] = useState<'all_orders' | 'client_api'>('all_orders');
  const [newCustomStatus, setNewCustomStatus] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setEditingProduct(prev => ({ ...prev!, image_url: data.url }));
      } else {
        alert(data.error || 'Lỗi khi tải ảnh lên');
      }
    } catch {
      alert('Lỗi kết nối khi tải ảnh');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch {
      setCategories([]);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const filteredProducts = products.filter(p => {
    if (selectedCategoryId !== null && p.category_id !== selectedCategoryId) {
      return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = (p.name || '').toLowerCase().includes(q);
      const matchCode = (p.code || '').toLowerCase().includes(q);
      const matchDesc = (p.description || '').toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchDesc) return false;
    }
    return true;
  });

  const handleOpenActionMenu = (e: React.MouseEvent<HTMLButtonElement>, product: Product) => {
    e.stopPropagation();
    if (actionMenuState?.product.id === product.id) {
      setActionMenuState(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuWidth = 160; // w-40 = 10rem = 160px
    const menuHeight = 170; // 4 item menu height

    const left = Math.max(10, rect.right - menuWidth);
    let top = rect.bottom + 6;

    // If near the bottom of viewport and enough space above, open upwards
    if (spaceBelow < menuHeight && rect.top > menuHeight) {
      top = rect.top - menuHeight - 6;
    }

    setActionMenuState({
      product,
      top,
      left,
    });
  };

  // Modal Open Handlers
  const openNewProductModal = () => {
    setEditingProduct({
      name: '',
      price: 0,
      cost_price: 0,
      category_id: categories.length > 0 ? categories[0].id : null,
      is_active: 1,
      require_email: 0,
      show_sold_count: 0,
      delivery_type: 'Dữ liệu kho (Giao từng dòng hàng)',
      min_quantity: 1,
      emoji: '',
      custom_emoji_id: '',
      description: '',
      type: 'stock',
      priority: 0,
      notify_telegram: true,
    });
    setModalTab('general');
    setProductFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct({
      ...product,
      type: product.type || 'stock',
      require_email: product.require_email || 0,
      emoji: product.emoji || '',
      custom_emoji_id: product.custom_emoji_id || ''
    });
    setModalTab('general');
    setProductFormError('');
    setIsModalOpen(true);
  };

  const handleSaveProduct = async () => {
    if (!editingProduct?.name?.trim()) {
      setProductFormError('Tên sản phẩm không được bỏ trống.');
      return;
    }

    setSavingProduct(true);
    setProductFormError('');
    const isNew = !editingProduct.id;
    const method = isNew ? 'POST' : 'PUT';

    try {
      const res = await fetch('/api/products', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingProduct),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        setProductFormError(errorData.error || 'Không thể lưu sản phẩm.');
        setSavingProduct(false);
        return;
      }

      const resData = await res.json().catch(() => ({}));
      if (resData.broadcastStats) {
        alert(`Lưu sản phẩm thành công!\nĐã phát sóng thông báo sản phẩm mới đến ${resData.broadcastStats.sent}/${resData.broadcastStats.total} users Telegram.`);
      }

      setIsModalOpen(false);
      setEditingProduct(null);
      fetchProducts();
    } catch {
      setProductFormError('Lỗi khi lưu sản phẩm.');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleToggleStatus = async (product: Product) => {
    const nextStatus = product.is_active ? 0 : 1;
    setProducts(current => current.map(p => p.id === product.id ? { ...p, is_active: nextStatus } : p));
    try {
      await fetch('/api/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: product.id, is_active: nextStatus }),
      });
    } catch {
      fetchProducts();
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa sản phẩm này?')) return;
    try {
      const res = await fetch(`/api/products?id=${id}&reason=DeletedByAdmin`, { method: 'DELETE' });
      if (res.ok) fetchProducts();
    } catch (e) {
      console.error(e);
    }
  };

  // Open Stock Modal
  const openStockModal = async (product: Product) => {
    setCurrentProduct(product);
    setStockModalView('list');
    setStockData('');
    setIsStockModalOpen(true);

    try {
      const res = await fetch(`/api/inventory?productId=${product.id}&page=1&limit=50`);
      const data = await res.json();
      setStockAccounts(data.accounts || []);
    } catch {
      setStockAccounts([]);
    }
  };

  const handleAddStock = async () => {
    if (!currentProduct || !stockData.trim()) return;
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: currentProduct.id,
          data: stockData,
          notify_telegram: notifyStockTelegram
        }),
      });
      if (res.ok) {
        const result = await res.json();
        let msg = `Đã nạp thành công ${result.count || 0} tài khoản!`;
        if (result.broadcastStats) {
          msg += `\nĐã phát sóng thông báo bổ sung kho đến ${result.broadcastStats.sent}/${result.broadcastStats.total} users Telegram.`;
        }
        alert(msg);
        setStockModalView('list');
        setStockData('');
        // Refresh inventory
        const invRes = await fetch(`/api/inventory?productId=${currentProduct.id}&page=1&limit=50`);
        const invData = await invRes.json();
        setStockAccounts(invData.accounts || []);
        fetchProducts();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Open Sold History Modal
  const openSoldModal = async (product: Product) => {
    setCurrentProduct(product);
    setSoldSearchQuery('');
    setIsSoldModalOpen(true);
    try {
      const res = await fetch(`/api/sold-inventory?productId=${product.id}&limit=30`);
      const data = await res.json();
      setSoldList(data.data || []);
    } catch {
      setSoldList([]);
    }
  };

  // Open Custom Price Modal
  const openCustomPriceModal = async (product: Product) => {
    setCurrentProduct(product);
    setNewCustomUser('');
    setNewCustomPrice('');
    setNewCustomScope('all_orders');
    setNewCustomStatus(true);
    setIsCustomPriceModalOpen(true);

    try {
      const res = await fetch(`/api/custom-pricing?productId=${product.id}`);
      const data = await res.json();
      const list = Array.isArray(data.data) ? data.data : [];
      setCustomPrices(list.map((cp: any) => ({
        id: cp.id,
        user_identifier: cp.username ? `@${cp.username}` : (cp.telegram_id ? `ID: ${cp.telegram_id}` : `User #${cp.user_id}`),
        product_id: cp.product_id,
        product_name: cp.product_name,
        plan_label: cp.plan_id || 'Không áp dụng',
        scope: cp.scope || 'all_orders',
        custom_price: Number(cp.custom_price) || 0,
        is_active: Boolean(cp.is_active),
        created_at: new Date(cp.created_at).toLocaleString('vi-VN'),
        updated_at: new Date(cp.created_at).toLocaleString('vi-VN')
      })));
    } catch {
      setCustomPrices([]);
    }
  };

  const handleCreateCustomPrice = async () => {
    if (!newCustomUser.trim() || newCustomPrice === '' || !currentProduct) return;
    try {
      const res = await fetch('/api/custom-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: newCustomUser.trim(),
          productId: currentProduct.id,
          customPrice: Number(newCustomPrice),
          scope: newCustomScope === 'client_api' ? 'CLIENT_API' : 'ALL_ORDERS',
          isActive: newCustomStatus
        })
      });

      if (res.ok) {
        alert('Đã lưu giá riêng thành công!');
        setNewCustomUser('');
        setNewCustomPrice('');
        openCustomPriceModal(currentProduct);
      } else {
        const err = await res.json();
        alert(err.error || 'Lỗi khi lưu giá riêng');
      }
    } catch {
      alert('Lỗi kết nối máy chủ');
    }
  };

  const detectedLineCount = useMemo(() => {
    return stockData.split('\n').filter(l => l.trim()).length;
  }, [stockData]);

  return (
    <div className="space-y-6 pb-12 text-zinc-900">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
              <Package className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-zinc-950 uppercase">
              SẢN PHẨM
            </h1>
          </div>
          <p className="mt-1 text-xs text-zinc-500 font-medium">
            Xem danh sách, thêm mới và quản lý kho hàng
          </p>
        </div>

        <button
          onClick={openNewProductModal}
          className="flex items-center gap-2 rounded-2xl bg-orange-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-md shadow-orange-500/25 transition-all hover:bg-orange-700 active:scale-95 shrink-0 cursor-pointer"
        >
          <Plus className="h-4 w-4 stroke-[3]" />
          <span>SẢN PHẨM MỚI</span>
        </button>
      </div>

      {/* Main Container Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Panel: Category Sidebar */}
        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-900 flex items-center gap-2">
                <Folder className="h-4 w-4 text-orange-500" />
                DANH MỤC SẢN PHẨM
              </span>
            </div>

            <div className="space-y-1">
              <button
                onClick={() => setSelectedCategoryId(null)}
                className={`w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                  selectedCategoryId === null
                    ? 'bg-orange-600 text-white shadow-md shadow-orange-500/20'
                    : 'text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                <Star className="h-3.5 w-3.5 fill-current" />
                <span>Tất cả danh mục</span>
              </button>

              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                    selectedCategoryId === cat.id
                      ? 'bg-orange-600 text-white font-bold shadow-md shadow-orange-500/20'
                      : 'text-zinc-600 hover:bg-zinc-100'
                  }`}
                >
                  <Folder className="h-3.5 w-3.5 text-zinc-400" />
                  <span className="truncate">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel: Product Table */}
        <div className="lg:col-span-9 space-y-4">
          {/* Top Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200/90 bg-white p-3 shadow-sm">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm sản phẩm (tên, mã, mô tả...)"
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50/50 pl-10 pr-4 text-xs font-medium text-zinc-800 placeholder:text-zinc-400 focus:border-orange-500 focus:bg-white outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <select className="h-10 rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 text-xs font-medium text-zinc-700 outline-none">
                <option value="all">Tất cả</option>
                <option value="active">Đang hoạt động</option>
                <option value="inactive">Tắt</option>
              </select>
              <button
                onClick={fetchProducts}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 shadow-sm hover:bg-zinc-50"
                title="Làm mới"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Product Table */}
          <div className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-medium text-zinc-700">
                <thead className="border-b border-zinc-100 bg-zinc-50/80 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  <tr>
                    <th className="px-4 py-3.5 w-8">
                      <input type="checkbox" className="rounded" />
                    </th>
                    <th className="px-4 py-3.5 text-center">THỨ TỰ</th>
                    <th className="px-4 py-3.5">SẢN PHẨM</th>
                    <th className="px-4 py-3.5">GIÁ</th>
                    <th className="px-4 py-3.5 text-center">KHO/TỒN</th>
                    <th className="px-4 py-3.5">LOẠI</th>
                    <th className="px-4 py-3.5 text-center">TRẠNG THÁI</th>
                    <th className="px-4 py-3.5 text-center">HÀNH ĐỘNG</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-xs text-zinc-400 font-medium">
                        Đang tải danh sách sản phẩm...
                      </td>
                    </tr>
                  ) : filteredProducts.length > 0 ? (
                    filteredProducts.map((p, index) => (
                      <tr
                        key={p.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDrop={(e) => handleDrop(e, index)}
                        onDragEnd={() => { setDraggedIdx(null); setDragOverIdx(null); }}
                        className={`hover:bg-zinc-50/60 transition-colors ${
                          draggedIdx === index ? 'opacity-40 bg-orange-50' : ''
                        } ${
                          dragOverIdx === index ? 'border-b-2 border-orange-500 bg-orange-50/50' : ''
                        }`}
                      >
                        <td className="px-4 py-4">
                          <input type="checkbox" className="rounded" />
                        </td>

                        {/* Order Handle */}
                        <td className="px-4 py-4 text-center select-none">
                          <div className="flex items-center justify-center gap-1 text-zinc-400">
                            <GripVertical className="h-4 w-4 cursor-grab active:cursor-grabbing hover:text-orange-600 transition" />
                            <div className="flex flex-col text-[10px]">
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={() => handleMoveProduct(index, 'up')}
                                className="hover:text-orange-600 disabled:opacity-20 disabled:hover:text-zinc-400 p-0.5 transition"
                                title="Di chuyển lên"
                              >
                                <ArrowUp className="h-3.5 w-3.5 stroke-[2.5]" />
                              </button>
                              <button
                                type="button"
                                disabled={index === filteredProducts.length - 1}
                                onClick={() => handleMoveProduct(index, 'down')}
                                className="hover:text-orange-600 disabled:opacity-20 disabled:hover:text-zinc-400 p-0.5 transition"
                                title="Di chuyển xuống"
                              >
                                <ArrowDown className="h-3.5 w-3.5 stroke-[2.5]" />
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* Sản phẩm */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 border border-zinc-200 text-zinc-600 shrink-0 font-bold text-sm">
                              {p.emoji || (p.custom_emoji_id ? '✨' : <Package className="h-5 w-5 text-zinc-400" />)}
                            </div>
                            <div>
                              <div className="font-extrabold text-zinc-900 flex items-center gap-1.5 flex-wrap">
                                <span>{p.name}</span>
                                {p.custom_emoji_id && (
                                  <span className="text-[9px] font-mono font-bold bg-orange-50 text-orange-600 border border-orange-200 px-1.5 py-0.5 rounded-md" title={`Custom Emoji ID: ${p.custom_emoji_id}`}>
                                    ID: {p.custom_emoji_id}
                                  </span>
                                )}
                                {Boolean(p.require_email) && (
                                  <span className="text-[9px] font-bold bg-sky-50 text-sky-700 border border-sky-200 px-1.5 py-0.5 rounded-md" title="Yêu cầu nhập email khi mua">
                                    📧 Cần Email
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] font-semibold text-zinc-400">ID: {p.id}</div>
                            </div>
                          </div>
                        </td>

                        {/* Giá */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="font-extrabold text-zinc-900">{formatPrice(p.price)}</span>
                        </td>

                        {/* Kho / Tồn */}
                        <td className="px-4 py-4 text-center whitespace-nowrap">
                          {(p.type === 'order' || (p.delivery_type && p.delivery_type.includes('Nhập tay'))) ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200" title="Sản phẩm bán Order - Không cần nhập kho tài khoản">
                              Order (∞)
                            </span>
                          ) : (
                            <span
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                                Number(p.stock) === 0
                                  ? 'bg-rose-100 text-rose-600'
                                  : 'bg-teal-100 text-teal-700'
                              }`}
                            >
                              {p.stock}
                            </span>
                          )}
                        </td>

                        {/* Loại */}
                        <td className="px-4 py-4 whitespace-nowrap text-zinc-500 font-medium">
                          {(p.type === 'order' || (p.delivery_type && p.delivery_type.includes('Nhập tay'))) ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              🛒 Hàng Order (Nhập tay)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              📦 Hàng Sẵn
                            </span>
                          )}
                        </td>

                        {/* Trạng thái */}
                        <td className="px-4 py-4 text-center whitespace-nowrap">
                          <Switch
                            checked={Boolean(p.is_active ?? 1)}
                            onCheckedChange={() => handleToggleStatus(p)}
                          />
                        </td>

                        {/* Hành động */}
                        <td className="px-4 py-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Nút Kho hàng */}
                            <button
                              onClick={() => openStockModal(p)}
                              className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-800 shadow-xs hover:bg-zinc-50 active:scale-95 cursor-pointer"
                              title="Kho hàng (chưa bán)"
                            >
                              <Layers className="h-3.5 w-3.5 text-orange-500" />
                              <span>KHO HÀNG</span>
                            </button>

                            {/* Nút Cấu hình SP (Edit) */}
                            <button
                              onClick={() => openEditModal(p)}
                              className="flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600 transition-all active:scale-95 cursor-pointer"
                              title="Cấu hình SP"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>

                            {/* Nút Đã bán (Sold history) */}
                            <button
                              onClick={() => openSoldModal(p)}
                              className="flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600 transition-all active:scale-95 cursor-pointer"
                              title="Lịch sử sản phẩm đã bán"
                            >
                              <ShoppingBag className="h-3.5 w-3.5" />
                            </button>

                            {/* Nút Giá riêng (Custom price) */}
                            <button
                              onClick={() => openCustomPriceModal(p)}
                              className="flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600 transition-all active:scale-95 cursor-pointer"
                              title="Cấu hình giá riêng theo khách"
                            >
                              <Tag className="h-3.5 w-3.5" />
                            </button>

                            {/* Nút Xóa (Delete) */}
                            <button
                              onClick={() => handleDeleteProduct(p.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-xl border border-rose-200 bg-rose-50/60 text-rose-600 hover:bg-rose-100 transition-all active:scale-95 cursor-pointer"
                              title="Xóa sản phẩm"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-xs font-semibold text-zinc-400">
                        Chưa có sản phẩm nào
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* 0. MODAL: SẢN PHẨM MỚI / CHỈNH SỬA SẢN PHẨM */}
      {/* ========================================== */}
      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => {
          if (!savingProduct) setIsModalOpen(open);
        }}
        className="max-w-xl p-0 overflow-hidden rounded-3xl"
      >
        <div className="bg-white text-zinc-900">
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                <Package className="h-5 w-5" />
              </div>
              <h2 className="text-base font-black uppercase text-zinc-900 tracking-tight">
                {editingProduct?.id ? 'CHỈNH SỬA SẢN PHẨM' : 'SẢN PHẨM MỚI'}
              </h2>
            </div>
            <button
              onClick={() => setIsModalOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Modal Tabs Header */}
          <div className="flex border-b border-zinc-100 bg-zinc-50/50 px-6">
            <button
              onClick={() => setModalTab('general')}
              className={`py-3 px-4 text-xs font-extrabold transition-all border-b-2 cursor-pointer ${
                modalTab === 'general'
                  ? 'border-orange-600 text-orange-600'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Thông tin chung
            </button>
            <button
              onClick={() => setModalTab('delivery')}
              className={`py-3 px-4 text-xs font-extrabold transition-all border-b-2 cursor-pointer ${
                modalTab === 'delivery'
                  ? 'border-orange-600 text-orange-600'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Cấu hình giao hàng
            </button>
            <button
              onClick={() => setModalTab('translation')}
              className={`py-3 px-4 text-xs font-extrabold transition-all border-b-2 cursor-pointer ${
                modalTab === 'translation'
                  ? 'border-orange-600 text-orange-600'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Bản dịch
            </button>
          </div>

          {/* Modal Body Container */}
          <div className="max-h-[65vh] overflow-y-auto p-6 space-y-5">
            {/* Top Help Validation Box */}
            {(!editingProduct?.name || !editingProduct?.description) && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs space-y-1 text-amber-900 font-medium">
                <div className="font-bold text-amber-950 uppercase tracking-wider text-[11px] mb-1">
                  KIỂM TRA TÍNH HỢP LỆ:
                </div>
                {!editingProduct?.name && (
                  <div className="flex items-center gap-1.5 text-rose-600">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>Tên sản phẩm không được bỏ trống.</span>
                  </div>
                )}
                {!editingProduct?.description && (
                  <div className="flex items-center gap-1.5 text-amber-700">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>Mô tả sản phẩm đang trống. Khuyến nghị nhập mô tả để hiển thị rõ ràng trên Bot Telegram.</span>
                  </div>
                )}
              </div>
            )}

            {/* TAB 1: THÔNG TIN CHUNG */}
            {modalTab === 'general' && (
              <div className="space-y-4">
                {/* Tên sản phẩm đa ngôn ngữ */}
                <div className="space-y-2 p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
                      <span>TÊN SẢN PHẨM</span>
                      <span className="text-orange-600">*</span>
                    </label>

                    {/* Language Switcher for Name */}
                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-zinc-200 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setNameLang('vi')}
                        className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition ${nameLang === 'vi' ? 'bg-orange-600 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'}`}
                      >
                        🇻🇳 VI
                      </button>
                      <button
                        type="button"
                        onClick={() => setNameLang('en')}
                        className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition ${nameLang === 'en' ? 'bg-orange-600 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'}`}
                      >
                        🇺🇸 EN
                      </button>
                      <button
                        type="button"
                        onClick={() => setNameLang('zh')}
                        className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition ${nameLang === 'zh' ? 'bg-orange-600 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'}`}
                      >
                        🇨🇳 ZH
                      </button>
                    </div>
                  </div>

                  <input
                    type="text"
                    value={getProductNameForLang(nameLang)}
                    onChange={(e) => setProductNameForLang(nameLang, e.target.value)}
                    placeholder={nameLang === 'vi' ? 'Ví dụ: Netflix Premium 1 tháng' : (nameLang === 'en' ? 'e.g. Netflix Premium 1 Month' : '例: Netflix Premium 1 个月')}
                    className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-xs font-bold text-zinc-900 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none"
                  />
                </div>

                {/* Price, Cost Price, Category & Type Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-700">
                      GIÁ BÁN (₫) <span className="text-orange-600">*</span>
                    </label>
                    <input
                      type="number"
                      value={editingProduct?.price ?? 0}
                      onChange={(e) => setEditingProduct(prev => ({ ...prev!, price: Number(e.target.value) }))}
                      className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-xs font-medium text-zinc-900 focus:border-orange-500 outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-700">
                      GIÁ VỐN (₫)
                    </label>
                    <input
                      type="number"
                      value={editingProduct?.cost_price ?? 0}
                      onChange={(e) => setEditingProduct(prev => ({ ...prev!, cost_price: Number(e.target.value) }))}
                      className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-xs font-medium text-zinc-900 focus:border-orange-500 outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-700">
                      LOẠI HÀNG
                    </label>
                    <select
                      value={editingProduct?.type || 'stock'}
                      onChange={(e) => setEditingProduct(prev => ({ ...prev!, type: e.target.value as 'stock' | 'order' }))}
                      className="h-11 w-full rounded-2xl border border-orange-500 bg-white px-3 text-xs font-bold text-zinc-900 focus:border-orange-600 outline-none"
                    >
                      <option value="stock">📦 Hàng có sẵn (Stock)</option>
                      <option value="order">🛒 Hàng Order / Bán Order</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-700">
                      DANH MỤC
                    </label>
                    <select
                      value={editingProduct?.category_id || ''}
                      onChange={(e) => setEditingProduct(prev => ({ ...prev!, category_id: Number(e.target.value) || null }))}
                      className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-900 focus:border-orange-500 outline-none"
                    >
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Checkboxes */}
                <div className="flex flex-wrap items-center gap-6 pt-1">
                  <label className="flex items-center gap-2 text-xs font-bold text-zinc-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editingProduct?.is_active ?? 1)}
                      onChange={(e) => setEditingProduct(prev => ({ ...prev!, is_active: e.target.checked ? 1 : 0 }))}
                      className="h-4 w-4 rounded accent-orange-600"
                    />
                    <span>Đang hoạt động (Active)</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-bold text-sky-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editingProduct?.require_email ?? 0)}
                      onChange={(e) => setEditingProduct(prev => ({ ...prev!, require_email: e.target.checked ? 1 : 0 }))}
                      className="h-4 w-4 rounded accent-sky-600"
                    />
                    <span>📧 Yêu cầu nhập Email khi mua</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-medium text-zinc-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editingProduct?.show_sold_count ?? 0)}
                      onChange={(e) => setEditingProduct(prev => ({ ...prev!, show_sold_count: e.target.checked ? 1 : 0 }))}
                      className="h-4 w-4 rounded accent-orange-600"
                    />
                    <span>Hiện số lượt đã bán</span>
                  </label>
                </div>

                {/* Telegram Customization Box (Chỉ chọn 1 trong 2) */}
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-800">
                      <Sparkles className="h-4 w-4 text-orange-500" />
                      <span>TÙY CHỈNH NÚT BẤM TƯƠNG TÁC (CHỈ CHỌN 1 TRONG 2)</span>
                    </div>
                    {(editingProduct?.emoji || editingProduct?.custom_emoji_id) && (
                      <button
                        type="button"
                        onClick={() => setEditingProduct(prev => ({ ...prev!, emoji: '', custom_emoji_id: '' }))}
                        className="text-[10px] text-zinc-400 hover:text-red-600 font-bold transition"
                      >
                        Đặt lại mặc định
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className={`space-y-1 rounded-xl p-2.5 transition border ${editingProduct?.emoji ? 'border-orange-500 bg-white shadow-xs' : 'border-zinc-200/80 bg-white/60'}`}>
                      <label className="text-[10px] font-bold uppercase text-zinc-600 flex items-center justify-between">
                        <span>1. EMOJI THƯỜNG</span>
                        {editingProduct?.emoji && <span className="text-[9px] text-orange-600 font-extrabold">ĐANG CHỌN</span>}
                      </label>
                      <input
                        type="text"
                        value={editingProduct?.emoji || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditingProduct(prev => ({
                            ...prev!,
                            emoji: val,
                            custom_emoji_id: val ? '' : prev?.custom_emoji_id
                          }));
                        }}
                        placeholder="VD: 🔥, ⭐, 🎁..."
                        className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-xs outline-none focus:border-orange-500"
                      />
                    </div>

                    <div className={`space-y-1 rounded-xl p-2.5 transition border ${editingProduct?.custom_emoji_id ? 'border-orange-500 bg-white shadow-xs' : 'border-zinc-200/80 bg-white/60'}`}>
                      <label className="text-[10px] font-bold uppercase text-zinc-600 flex items-center justify-between">
                        <span>2. CUSTOM EMOJI ID ĐỘNG</span>
                        {editingProduct?.custom_emoji_id && <span className="text-[9px] text-orange-600 font-extrabold">ĐANG CHỌN</span>}
                      </label>
                      <input
                        type="text"
                        value={editingProduct?.custom_emoji_id || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditingProduct(prev => ({
                            ...prev!,
                            custom_emoji_id: val,
                            emoji: val ? '' : prev?.emoji
                          }));
                        }}
                        placeholder="VD: 6138847041649906237"
                        className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-mono outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-400 font-medium">
                    💡 Nhập một trong 2 loại trên. Khi bạn gõ vào ô nào, ô còn lại sẽ tự động được xóa để tránh trùng lặp.
                  </p>
                </div>

                {/* Product Image & Upload */}
                <div className="space-y-1.5 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-3.5">
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-700 block">
                    ẢNH ĐẠI DIỆN SẢN PHẨM (WEB & BOT TELEGRAM)
                  </label>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-2xs">
                      {editingProduct?.image_url ? (
                        <img src={editingProduct.image_url} alt="Preview" className="h-full w-full object-cover" />
                      ) : (
                        <Package className="h-6 w-6 text-zinc-400" />
                      )}
                    </div>
                    <div className="flex-1 w-full space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white px-3.5 py-2 text-xs font-bold shadow-xs cursor-pointer active:scale-95 transition">
                          <Upload className="h-3.5 w-3.5" />
                          <span>{uploadingImage ? 'Đang tải lên...' : 'Tải ảnh từ máy tính'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            disabled={uploadingImage}
                            className="hidden"
                          />
                        </label>
                        {editingProduct?.image_url && (
                          <button
                            type="button"
                            onClick={() => setEditingProduct(prev => ({ ...prev!, image_url: '' }))}
                            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 transition"
                          >
                            Xóa ảnh
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={editingProduct?.image_url || ''}
                        onChange={(e) => setEditingProduct(prev => ({ ...prev!, image_url: e.target.value }))}
                        placeholder="Hoặc dán URL ảnh trực tiếp (https://...)"
                        className="h-9 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs text-zinc-800 outline-none focus:border-orange-500 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Multilingual Description & Note Box */}
                <div className="space-y-2 p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-700">
                        MÔ TẢ / GHI CHÚ SẢN PHẨM (NOTE)
                      </label>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-bold uppercase">
                        {descLang.toUpperCase()}
                      </span>
                    </div>

                    {/* Language Switcher Tabs for Note / Description */}
                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-zinc-200 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setDescLang('vi')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${descLang === 'vi' ? 'bg-orange-600 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'}`}
                      >
                        🇻🇳 Tiếng Việt
                      </button>
                      <button
                        type="button"
                        onClick={() => setDescLang('en')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${descLang === 'en' ? 'bg-orange-600 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'}`}
                      >
                        🇺🇸 English
                      </button>
                      <button
                        type="button"
                        onClick={() => setDescLang('zh')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${descLang === 'zh' ? 'bg-orange-600 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'}`}
                      >
                        🇨🇳 中文
                      </button>
                    </div>
                  </div>

                  {/* Formatting Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const cur = getProductDescForLang(descLang);
                        setProductDescForLang(descLang, cur + '<blockquote>Nội dung trích dẫn...</blockquote>');
                      }}
                      className="rounded-lg border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 hover:bg-sky-100 transition"
                      title="Khung trích dẫn vạch xanh Telegram"
                    >
                      ❝ Trích dẫn &lt;blockquote&gt;
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const cur = getProductDescForLang(descLang);
                        setProductDescForLang(descLang, cur + '<b>In đậm</b>');
                      }}
                      className="rounded-lg border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-bold text-zinc-700 hover:bg-zinc-100 transition shadow-2xs"
                    >
                      &lt;b&gt;
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const cur = getProductDescForLang(descLang);
                        setProductDescForLang(descLang, cur + '<i>In nghiêng</i>');
                      }}
                      className="rounded-lg border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-bold text-zinc-700 hover:bg-zinc-100 transition shadow-2xs"
                    >
                      &lt;i&gt;
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const cur = getProductDescForLang(descLang);
                        setProductDescForLang(descLang, cur + '<code>Code</code>');
                      }}
                      className="rounded-lg border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-bold text-zinc-700 hover:bg-zinc-100 transition shadow-2xs"
                    >
                      &lt;code&gt;
                    </button>
                  </div>

                  <textarea
                    rows={4}
                    value={getProductDescForLang(descLang)}
                    onChange={(e) => setProductDescForLang(descLang, e.target.value)}
                    placeholder={
                      descLang === 'vi'
                        ? "Nhập mô tả / ghi chú Tiếng Việt... Ví dụ: <blockquote>Bảo hành 30 ngày đổi mới 1-1</blockquote>"
                        : (descLang === 'en'
                            ? "Enter English description / note... e.g.: <blockquote>30-day warranty 1-to-1 replacement</blockquote>"
                            : "输入中文商品描述 / 售后备注... 例如: <blockquote>30天质保 1对1换新</blockquote>")
                    }
                    className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-xs font-medium text-zinc-900 focus:border-orange-500 outline-none font-mono"
                  />
                  <p className="text-[10px] text-zinc-400 font-medium">
                    💡 Khách hàng đổi ngôn ngữ nào trên Bot thì Bot sẽ tự động hiển thị mô tả / note theo đúng ngôn ngữ đó.
                  </p>
                </div>
              </div>
            )}

            {/* TAB 2: CẤU HÌNH GIAO HÀNG */}
            {modalTab === 'delivery' && (
              <div className="space-y-4">
                {/* Chọn LOẠI GIAO HÀNG */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-700">
                    LOẠI GIAO HÀNG
                  </label>
                  <select
                    value={editingProduct?.delivery_type || 'Kho có cấu trúc (Định dạng tài khoản)'}
                    onChange={(e) => {
                      const val = e.target.value;
                      const isManual = val === 'Nhập tay (Hỏi đáp, giao thủ công)';
                      setEditingProduct(prev => ({
                        ...prev!,
                        delivery_type: val,
                        type: isManual ? 'order' : prev?.type || 'stock'
                      }));
                    }}
                    className="h-11 w-full rounded-2xl border border-orange-500 bg-white px-4 text-xs font-bold text-zinc-900 focus:border-orange-600 outline-none"
                  >
                    <option value="Kho có cấu trúc (Định dạng tài khoản)">Kho có cấu trúc (Định dạng tài khoản)</option>
                    <option value="Tải file lên (Giao file/phần mềm)">Tải file lên (Giao file/phần mềm)</option>
                    <option value="Dữ liệu kho (Giao từng dòng hàng)">Dữ liệu kho (Giao từng dòng hàng)</option>
                    <option value="Nhập tay (Hỏi đáp, giao thủ công)">Nhập tay (Hỏi đáp, giao thủ công)</option>
                  </select>
                </div>

                {/* OPTION 1: KHO CÓ CẤU TRÚC (ĐỊNH DẠNG TÀI KHOẢN) */}
                {editingProduct?.delivery_type === 'Kho có cấu trúc (Định dạng tài khoản)' && (
                  <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 space-y-3 shadow-xs">
                    {/* CẤU TRÚC TÀI KHOẢN KHO (ITEM STRUCTURE) */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-orange-500" />
                        <span>CẤU TRÚC TÀI KHOẢN KHO (ITEM STRUCTURE)</span>
                      </label>
                      <input
                        type="text"
                        value={editingProduct?.item_structure || ''}
                        onChange={(e) => setEditingProduct(prev => ({ ...prev!, item_structure: e.target.value }))}
                        placeholder="Ví dụ: Email|Mật khẩu|Mã 2FA"
                        className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs outline-none focus:border-orange-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* TIỀN TỐ TÀI KHOẢN (PREFIX) */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-700">
                          TIỀN TỐ TÀI KHOẢN (PREFIX)
                        </label>
                        <input
                          type="text"
                          value={editingProduct?.account_prefix || ''}
                          onChange={(e) => setEditingProduct(prev => ({ ...prev!, account_prefix: e.target.value }))}
                          placeholder="Ví dụ: netflix_"
                          className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs outline-none focus:border-orange-500"
                        />
                      </div>

                      {/* MUA TỐI THIỂU */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-700">
                          MUA TỐI THIỂU
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={editingProduct?.min_quantity ?? 1}
                          onChange={(e) => setEditingProduct(prev => ({ ...prev!, min_quantity: Math.max(1, Number(e.target.value)) }))}
                          className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs font-bold outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* OPTION 2: TẢI FILE LÊN (GIAO FILE/PHẦN MỀM) */}
                {editingProduct?.delivery_type === 'Tải file lên (Giao file/phần mềm)' && (
                  <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 space-y-3 shadow-xs">
                    <div className="grid grid-cols-2 gap-3">
                      {/* CHẾ ĐỘ GIAO FILE */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-700">
                          CHẾ ĐỘ GIAO FILE
                        </label>
                        <select
                          value={editingProduct?.file_delivery_mode || 'Mỗi khách 1 file khác nhau (Stock file)'}
                          onChange={(e) => setEditingProduct(prev => ({ ...prev!, file_delivery_mode: e.target.value }))}
                          className="h-10 w-full rounded-xl border border-orange-300 bg-white px-2 text-xs font-medium outline-none focus:border-orange-500"
                        >
                          <option value="Mỗi khách 1 file khác nhau (Stock file)">Mỗi khách 1 file khác nhau (Stock file)</option>
                          <option value="Giao 1 file cố định cho tất cả (Static file)">Giao 1 file cố định cho tất cả (Static file)</option>
                        </select>
                      </div>

                      {/* 📤 CHỌN FILE NẠP KHO */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-700 flex items-center gap-1">
                          <Upload className="h-3.5 w-3.5 text-orange-500" />
                          <span>CHỌN FILE NẠP KHO</span>
                        </label>
                        <button
                          type="button"
                          className="h-10 w-full rounded-xl border border-zinc-200 bg-white text-xs font-bold text-zinc-800 shadow-xs hover:bg-zinc-50 cursor-pointer uppercase"
                        >
                          CHỌN FILE...
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* TELEGRAM FILE ID */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-700">
                          TELEGRAM FILE ID
                        </label>
                        <input
                          type="text"
                          value={editingProduct?.telegram_file_id || ''}
                          onChange={(e) => setEditingProduct(prev => ({ ...prev!, telegram_file_id: e.target.value }))}
                          placeholder="Telegram file_id..."
                          className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs outline-none focus:border-orange-500"
                        />
                      </div>

                      {/* TELEGRAM FILE UNIQUE ID */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-700">
                          TELEGRAM FILE UNIQUE ID
                        </label>
                        <input
                          type="text"
                          value={editingProduct?.telegram_file_unique_id || ''}
                          onChange={(e) => setEditingProduct(prev => ({ ...prev!, telegram_file_unique_id: e.target.value }))}
                          placeholder="file_unique_id..."
                          className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* OPTION 4: NHẬP TAY (HỎI ĐÁP, GIAO THỦ CÔNG) */}
                {editingProduct?.delivery_type === 'Nhập tay (Hỏi đáp, giao thủ công)' && (
                  <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 space-y-3 shadow-xs">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
                          <MessageSquareText className="h-3.5 w-3.5 text-orange-500" />
                          <span>TIN NHẮN NHẮC KHÁCH NHẬP THÔNG TIN (ĐA NGÔN NGỮ)</span>
                        </label>

                        {/* Language Switcher for Prompt Message */}
                        <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl border border-zinc-200 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => setPromptLang('vi')}
                            className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition ${promptLang === 'vi' ? 'bg-orange-600 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'}`}
                          >
                            🇻🇳 VI
                          </button>
                          <button
                            type="button"
                            onClick={() => setPromptLang('en')}
                            className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition ${promptLang === 'en' ? 'bg-orange-600 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'}`}
                          >
                            🇺🇸 EN
                          </button>
                          <button
                            type="button"
                            onClick={() => setPromptLang('zh')}
                            className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition ${promptLang === 'zh' ? 'bg-orange-600 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'}`}
                          >
                            🇨🇳 ZH
                          </button>
                        </div>
                      </div>

                      <textarea
                        rows={3}
                        value={getProductPromptForLang(promptLang)}
                        onChange={(e) => setProductPromptForLang(promptLang, e.target.value)}
                        placeholder={
                          promptLang === 'vi'
                            ? "Ví dụ: Vui lòng nhập ID tài khoản cần nâng cấp hoặc email đăng ký..."
                            : (promptLang === 'en'
                                ? "e.g. Please enter your account ID or registered email to upgrade..."
                                : "例如: 请输入需要升级的账号 ID 或注册邮箱...")
                        }
                        className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-xs font-medium text-zinc-900 focus:border-orange-500 outline-none"
                      />
                      <p className="text-[10px] text-zinc-400 font-medium">
                        Tin nhắn này sẽ hiển thị trên Telegram khi khách thanh toán theo ngôn ngữ ({promptLang.toUpperCase()}) của khách hàng.
                      </p>
                    </div>
                  </div>
                )}

                {/* OPTION 3: DỮ LIỆU KHO (GIAO TỪNG DÒNG HÀNG) */}
                {editingProduct?.delivery_type === 'Dữ liệu kho (Giao từng dòng hàng)' && (
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-2">
                    <label className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-700">
                      SỐ LƯỢNG ĐẶT MUA TỐI THIỂU
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={editingProduct?.min_quantity ?? 1}
                      onChange={(e) => setEditingProduct(prev => ({ ...prev!, min_quantity: Math.max(1, Number(e.target.value)) }))}
                      className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-xs font-bold text-zinc-900 outline-none"
                    />
                    <p className="text-[10px] text-zinc-400 font-medium">
                      Số lượng item tối thiểu mà khách hàng phải chọn trong một đơn hàng.
                    </p>
                  </div>
                )}

                {/* CHECKBOX 1: GIỚI HẠN THỜI HẠN SỬ DỤNG (ACCESS DURATION) */}
                <div className="rounded-2xl border border-zinc-200/90 p-4 space-y-3">
                  <label className="flex items-center gap-2 text-xs font-bold text-zinc-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editingProduct?.access_duration_enabled)}
                      onChange={(e) => setEditingProduct(prev => ({ ...prev!, access_duration_enabled: e.target.checked }))}
                      className="h-4 w-4 rounded accent-orange-600"
                    />
                    <span>GIỚI HẠN THỜI HẠN SỬ DỤNG (ACCESS DURATION)</span>
                  </label>

                  {Boolean(editingProduct?.access_duration_enabled) && (
                    <div className="space-y-1.5 pt-2 border-t border-zinc-100">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-700">
                        SỐ NGÀY HẾT HẠN (KỂ TỪ LÚC MUA)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={editingProduct?.access_duration_days ?? 30}
                        onChange={(e) => setEditingProduct(prev => ({ ...prev!, access_duration_days: Math.max(1, Number(e.target.value)) }))}
                        className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs font-bold outline-none focus:border-orange-500"
                      />
                    </div>
                  )}
                </div>

                {/* CHECKBOX 2: 📦 BẬT HỆ THỐNG ĐẶT TRƯỚC KHI HẾT HÀNG (PRE-ORDER SYSTEM) */}
                <div className="rounded-2xl border border-zinc-200/90 p-4 space-y-3">
                  <label className="flex items-center gap-2 text-xs font-bold text-zinc-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editingProduct?.preorder_enabled)}
                      onChange={(e) => setEditingProduct(prev => ({ ...prev!, preorder_enabled: e.target.checked }))}
                      className="h-4 w-4 rounded accent-orange-600"
                    />
                    <span>📦 BẬT HỆ THỐNG ĐẶT TRƯỚC KHI HẾT HÀNG (PRE-ORDER SYSTEM)</span>
                  </label>

                  {Boolean(editingProduct?.preorder_enabled) && (
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-100">
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold uppercase text-zinc-700">
                          PHÍ ĐẶT TRƯỚC MỖI SP (VND)
                        </label>
                        <input
                          type="number"
                          value={editingProduct?.preorder_fee_vnd ?? 0}
                          onChange={(e) => setEditingProduct(prev => ({ ...prev!, preorder_fee_vnd: Number(e.target.value) }))}
                          className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs font-bold outline-none focus:border-orange-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold uppercase text-zinc-700">
                          PHÍ ĐẶT TRƯỚC MỖI SP (USDT)
                        </label>
                        <input
                          type="number"
                          value={editingProduct?.preorder_fee_usdt ?? 0}
                          onChange={(e) => setEditingProduct(prev => ({ ...prev!, preorder_fee_usdt: Number(e.target.value) }))}
                          className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs font-bold outline-none focus:border-orange-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold uppercase text-zinc-700">
                          TỐI ĐA MỖI KHÁCH (SP)
                        </label>
                        <input
                          type="number"
                          value={editingProduct?.preorder_max_per_user ?? 5}
                          onChange={(e) => setEditingProduct(prev => ({ ...prev!, preorder_max_per_user: Number(e.target.value) }))}
                          className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs font-bold outline-none focus:border-orange-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold uppercase text-zinc-700">
                          TỔNG SHOP NHẬN TỐI ĐA (SP)
                        </label>
                        <input
                          type="number"
                          value={editingProduct?.preorder_total_limit ?? 100}
                          onChange={(e) => setEditingProduct(prev => ({ ...prev!, preorder_total_limit: Number(e.target.value) }))}
                          className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs font-bold outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* CHECKBOX 3: 📢 PHÁT SÓNG THÔNG BÁO SẢN PHẨM MỚI CHO USER TELEGRAM */}
                <div className="rounded-2xl border border-zinc-200/90 p-4 space-y-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-zinc-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editingProduct?.notify_telegram)}
                      onChange={(e) => setEditingProduct(prev => ({ ...prev!, notify_telegram: e.target.checked }))}
                      className="h-4 w-4 rounded accent-orange-600 cursor-pointer"
                    />
                    <span>📢 PHÁT SÓNG THÔNG BÁO SẢN PHẨM MỚI ĐẾN TOÀN BỘ USER TELEGRAM</span>
                  </label>
                  <p className="text-[11px] text-zinc-500 font-medium pl-6">
                    Khi tạo sản phẩm mới, bot sẽ tự động gửi thông điệp giới thiệu sản phẩm kèm giá, ảnh và nút đặt mua ngay đến toàn bộ người dùng.
                  </p>
                </div>
              </div>
            )}

            {/* TAB 3: BẢN DỊCH CHI TIẾT */}
            {modalTab === 'translation' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-orange-50 border border-orange-200">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-orange-950">CHỌN NGÔN NGỮ ĐÍCH CẦN SOẠN:</span>
                    <p className="text-[10px] text-orange-800 font-medium">Hệ thống sẽ lưu trực tiếp vào CSDL theo từng phiên bản ngôn ngữ.</p>
                  </div>
                  <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-orange-200">
                    <button
                      type="button"
                      onClick={() => setTransLang('vi')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition ${transLang === 'vi' ? 'bg-orange-600 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'}`}
                    >
                      🇻🇳 Tiếng Việt
                    </button>
                    <button
                      type="button"
                      onClick={() => setTransLang('en')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition ${transLang === 'en' ? 'bg-orange-600 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'}`}
                    >
                      🇺🇸 English
                    </button>
                    <button
                      type="button"
                      onClick={() => setTransLang('zh')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition ${transLang === 'zh' ? 'bg-orange-600 text-white shadow-xs' : 'text-zinc-600 hover:text-zinc-900'}`}
                    >
                      🇨🇳 中文
                    </button>
                  </div>
                </div>

                {/* Tên dịch thuật */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-700">
                      TÊN SẢN PHẨM ({transLang.toUpperCase()})
                    </label>
                    <button
                      type="button"
                      onClick={() => setProductNameForLang(transLang, editingProduct?.name || '')}
                      className="flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:underline cursor-pointer"
                    >
                      <Sparkles className="h-3 w-3" />
                      <span>SAO CHÉP TỪ TÊN GỐC</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={getProductNameForLang(transLang)}
                    onChange={(e) => setProductNameForLang(transLang, e.target.value)}
                    placeholder="Để trống sẽ dùng tên gốc"
                    className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-xs font-medium text-zinc-900 outline-none focus:border-orange-500"
                  />
                </div>

                {/* Mô tả / Note dịch thuật */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-700">
                      MÔ TẢ / GHI CHÚ NOTE ({transLang.toUpperCase()})
                    </label>
                    <button
                      type="button"
                      onClick={() => setProductDescForLang(transLang, editingProduct?.description || '')}
                      className="flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:underline cursor-pointer"
                    >
                      <Sparkles className="h-3 w-3" />
                      <span>SAO CHÉP TỪ MÔ TẢ GỐC</span>
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    value={getProductDescForLang(transLang)}
                    onChange={(e) => setProductDescForLang(transLang, e.target.value)}
                    placeholder="Để trống sẽ dùng mô tả gốc"
                    className="w-full rounded-2xl border border-zinc-200 bg-white p-3 text-xs font-medium text-zinc-900 outline-none focus:border-orange-500 font-mono"
                  />
                </div>

                {/* Prompt Message dịch thuật */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-700">
                      TIN NHẮN NHẮC THÔNG TIN ORDER ({transLang.toUpperCase()})
                    </label>
                    <button
                      type="button"
                      onClick={() => setProductPromptForLang(transLang, editingProduct?.prompt_message || '')}
                      className="flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:underline cursor-pointer"
                    >
                      <Sparkles className="h-3 w-3" />
                      <span>SAO CHÉP TỪ BẢN GỐC</span>
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={getProductPromptForLang(transLang)}
                    onChange={(e) => setProductPromptForLang(transLang, e.target.value)}
                    placeholder="Để trống sẽ dùng bản gốc"
                    className="w-full rounded-2xl border border-zinc-200 bg-white p-3 text-xs font-medium text-zinc-900 outline-none focus:border-orange-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-zinc-100 bg-zinc-50/50 px-6 py-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="rounded-2xl border border-zinc-200 bg-white px-5 py-2.5 text-xs font-bold text-zinc-700 shadow-xs hover:bg-zinc-100 active:scale-95 cursor-pointer"
            >
              HỦY BỎ
            </button>
            <button
              type="button"
              onClick={handleSaveProduct}
              disabled={savingProduct}
              className="rounded-2xl bg-orange-600 px-6 py-2.5 text-xs font-extrabold text-white shadow-md shadow-orange-500/25 hover:bg-orange-700 active:scale-95 disabled:opacity-60 cursor-pointer"
            >
              {savingProduct ? 'ĐANG LƯU...' : editingProduct?.id ? 'LƯU SẢN PHẨM' : 'TẠO SẢN PHẨM'}
            </button>
          </div>
        </div>
      </Dialog>

      {/* ========================================== */}
      {/* 1. MODAL: KHO HÀNG (CHƯA BÁN) */}
      {/* ========================================== */}
      <Dialog
        open={isStockModalOpen}
        onOpenChange={setIsStockModalOpen}
        className="max-w-xl p-0 overflow-hidden rounded-3xl"
      >
        <div className="bg-white text-zinc-900">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
            <div className="flex items-center gap-2.5">
              <Layers className="h-5 w-5 text-orange-600" />
              <div>
                <h2 className="text-base font-black uppercase text-zinc-900 tracking-tight">
                  KHO HÀNG (CHƯA BÁN)
                </h2>
                <p className="text-[11px] font-semibold text-zinc-400">
                  {currentProduct?.name} (ID: {currentProduct?.id})
                </p>
              </div>
            </div>
            <button onClick={() => setIsStockModalOpen(false)} className="text-zinc-400 hover:text-zinc-700 cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 space-y-4">
            {stockModalView === 'list' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-700">
                    DANH SÁCH ITEM CÒN TRONG KHO ({stockAccounts.length})
                  </span>
                  <button
                    onClick={() => setStockModalView('add')}
                    className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-bold text-zinc-800 shadow-xs hover:bg-zinc-50 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 text-orange-500" />
                    <span>NẠP THÊM KHO</span>
                  </button>
                </div>

                {stockAccounts.length > 0 ? (
                  <div className="max-h-[260px] overflow-y-auto rounded-2xl border border-zinc-200 bg-zinc-50/50 p-3 space-y-1 font-mono text-xs">
                    {stockAccounts.map((acc, idx) => (
                      <div key={acc.id ? `acc-${acc.id}-${idx}` : `acc-idx-${idx}`} className="flex items-center justify-between rounded-lg bg-white p-2 border border-zinc-100">
                        <span className="truncate">{acc.username} {acc.password ? `| ${acc.password}` : ''}</span>
                        <span className="text-[10px] text-teal-600 font-bold px-2 py-0.5 rounded bg-teal-50">Sẵn sàng</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border-2 border-dashed border-zinc-200/80 bg-zinc-50/50 p-12 text-center">
                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                      KHO HÀNG ĐANG TRỐNG. VUI LÒNG BẤM NẠP THÊM KHO.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* NẠP THÊM HÀNG VÀO KHO View */
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4">
                <div className="border-b border-zinc-100 pb-2">
                  <span className="text-xs font-black uppercase text-orange-600 flex items-center gap-1.5">
                    <Plus className="h-4 w-4" /> NẠP THÊM HÀNG VÀO KHO
                  </span>
                </div>

                {/* Input Format Switch */}
                <div className="flex gap-2 border-b border-zinc-100 pb-3">
                  <button
                    type="button"
                    onClick={() => setStockInputFormat('line')}
                    className={`rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                      stockInputFormat === 'line'
                        ? 'bg-orange-600 text-white shadow-md shadow-orange-500/20'
                        : 'bg-zinc-100 text-zinc-600'
                    }`}
                  >
                    MỖI DÒNG 1 ITEM
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockInputFormat('block')}
                    className={`rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                      stockInputFormat === 'block'
                        ? 'bg-orange-600 text-white shadow-md shadow-orange-500/20'
                        : 'bg-zinc-100 text-zinc-600'
                    }`}
                  >
                    DẠNG KHỐI (PHÂN TÁCH BẰNG DẤU |)
                  </button>
                </div>

                {/* Textarea */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-700">
                    NHẬP NỘI DUNG ITEMS (MỖI DÒNG 1 ITEM) <span className="text-orange-600">*</span>
                  </label>
                  <textarea
                    rows={6}
                    value={stockData}
                    onChange={(e) => setStockData(e.target.value)}
                    placeholder={'Mỗi dòng đại diện cho 1 item giao cho khách.\nVí dụ:\nacc1|pass1\nacc2|pass2'}
                    className="w-full rounded-2xl border border-zinc-200 bg-white p-3 font-mono text-xs text-zinc-900 focus:border-orange-500 outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="stockNotifyTg"
                    checked={notifyStockTelegram}
                    onChange={(e) => setNotifyStockTelegram(e.target.checked)}
                    className="h-4 w-4 rounded accent-orange-600 cursor-pointer"
                  />
                  <label htmlFor="stockNotifyTg" className="text-xs font-bold text-zinc-800 cursor-pointer">
                    📢 Tự động phát sóng thông báo bổ sung hàng (Restock) đến toàn bộ User Telegram
                  </label>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs font-semibold text-zinc-500">
                    Số dòng phát hiện: <span className="font-bold text-zinc-900">{detectedLineCount}</span>
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setStockModalView('list')}
                      className="rounded-xl border border-zinc-200 bg-zinc-100 px-4 py-2 text-xs font-bold text-zinc-700 cursor-pointer"
                    >
                      QUAY LẠI
                    </button>
                    <button
                      type="button"
                      onClick={handleAddStock}
                      className="rounded-xl bg-orange-600 px-5 py-2 text-xs font-extrabold text-white shadow-md shadow-orange-500/20 hover:bg-orange-700 cursor-pointer"
                    >
                      NẠP KHO
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex justify-end border-t border-zinc-100 bg-zinc-50/50 px-6 py-3">
            <button
              onClick={() => setIsStockModalOpen(false)}
              className="rounded-xl border border-zinc-200 bg-white px-5 py-2 text-xs font-bold text-zinc-700 shadow-xs cursor-pointer"
            >
              ĐÓNG
            </button>
          </div>
        </div>
      </Dialog>

      {/* ========================================== */}
      {/* 2. MODAL: LỊCH SỬ SẢN PHẨM ĐÃ BÁN */}
      {/* ========================================== */}
      <Dialog
        open={isSoldModalOpen}
        onOpenChange={setIsSoldModalOpen}
        className="max-w-xl p-0 overflow-hidden rounded-3xl"
      >
        <div className="bg-white text-zinc-900">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
            <div className="flex items-center gap-2.5">
              <ShoppingBag className="h-5 w-5 text-orange-600" />
              <div>
                <h2 className="text-base font-black uppercase text-zinc-900 tracking-tight">
                  LỊCH SỬ SẢN PHẨM ĐÃ BÁN
                </h2>
                <p className="text-[11px] font-semibold text-zinc-400">
                  {currentProduct?.name} (ID: {currentProduct?.id})
                </p>
              </div>
            </div>
            <button onClick={() => setIsSoldModalOpen(false)} className="text-zinc-400 hover:text-zinc-700 cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            {/* Search Input */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <input
                  type="text"
                  value={soldSearchQuery}
                  onChange={(e) => setSoldSearchQuery(e.target.value)}
                  placeholder="Tìm mã đơn, nội dung item, user ID, chat ID, username..."
                  className="h-11 w-full rounded-2xl border border-zinc-200 bg-white pl-10 pr-4 text-xs font-medium text-zinc-900 focus:border-orange-500 outline-none"
                />
              </div>
              <button
                type="button"
                className="rounded-2xl bg-orange-600 px-5 text-xs font-extrabold text-white shadow-md shadow-orange-500/20 hover:bg-orange-700 cursor-pointer"
              >
                TÌM KIẾM
              </button>
            </div>

            {/* List / Empty State */}
            {soldList.length > 0 ? (
              <div className="max-h-[300px] overflow-y-auto rounded-2xl border border-zinc-200 bg-zinc-50/50 p-3 space-y-2 font-mono text-xs">
                {soldList.map((item, idx) => (
                  <div key={item.id ? `sold-${item.id}-${idx}` : `sold-idx-${idx}`} className="flex items-center justify-between rounded-xl bg-white p-3 border border-zinc-100">
                    <div>
                      <span className="font-bold text-zinc-900">{item.item_data}</span>
                      <div className="text-[10px] text-zinc-400">{item.buyer_username} · {item.order_code}</div>
                    </div>
                    <span className="font-bold text-emerald-600">{formatPrice(item.price)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-zinc-200/80 bg-zinc-50/50 p-12 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  CHƯA BÁN ĐƯỢC SẢN PHẨM NÀO.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end border-t border-zinc-100 bg-zinc-50/50 px-6 py-3">
            <button
              onClick={() => setIsSoldModalOpen(false)}
              className="rounded-xl border border-zinc-200 bg-white px-5 py-2 text-xs font-bold text-zinc-700 shadow-xs cursor-pointer"
            >
              ĐÓNG
            </button>
          </div>
        </div>
      </Dialog>

      {/* ========================================== */}
      {/* 3. MODAL: GIÁ RIÊNG THEO KHÁCH */}
      {/* ========================================== */}
      <Dialog
        open={isCustomPriceModalOpen}
        onOpenChange={setIsCustomPriceModalOpen}
        className="max-w-3xl p-0 overflow-hidden rounded-3xl"
      >
        <div className="bg-white text-zinc-900">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
            <div className="flex items-center gap-2.5">
              <Tag className="h-5 w-5 text-orange-600" />
              <div>
                <h2 className="text-base font-black uppercase text-zinc-900 tracking-tight">
                  GIÁ RIÊNG THEO KHÁCH
                </h2>
                <p className="text-[11px] font-semibold text-zinc-400">
                  {currentProduct?.name} (ID: {currentProduct?.id})
                </p>
              </div>
            </div>
            <button onClick={() => setIsCustomPriceModalOpen(false)} className="text-zinc-400 hover:text-zinc-700 cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            {/* Top Form Container (+ TẠO GIÁ RIÊNG) */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <span className="text-xs font-extrabold uppercase text-orange-600 flex items-center gap-1.5">
                  <Plus className="h-4 w-4" /> TẠO GIÁ RIÊNG
                </span>
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> LÀM MỚI
                </button>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase text-zinc-700">
                    ĐỊNH DANH USER <span className="text-orange-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={newCustomUser}
                    onChange={(e) => setNewCustomUser(e.target.value)}
                    placeholder="VD: 123456"
                    className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs font-medium outline-none focus:border-orange-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase text-zinc-700">
                    TÊN SẢN PHẨM <span className="text-orange-600">*</span>
                  </label>
                  <input
                    type="text"
                    disabled
                    value={`${currentProduct?.name || ''} (ID: ${currentProduct?.id || ''})`}
                    className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-100 px-3 text-xs font-semibold text-zinc-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase text-zinc-700">
                    PLAN_ID / NHÃN GÓI
                  </label>
                  <select
                    value={newCustomPlan}
                    onChange={(e) => setNewCustomPlan(e.target.value)}
                    className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-2 text-xs font-bold text-zinc-900 outline-none"
                  >
                    <option value="Không áp dụng gói">Không áp dụng gói</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase text-zinc-700">
                    GIÁ RIÊNG (VND) <span className="text-orange-600">*</span>
                  </label>
                  <input
                    type="number"
                    value={newCustomPrice}
                    onChange={(e) => setNewCustomPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="VD: 50000"
                    className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs font-medium outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Scope & Checkbox Row */}
              <div className="flex items-center justify-between pt-2">
                <div className="space-y-1">
                  <span className="text-[10px] font-extrabold uppercase text-zinc-700 block">
                    PHẠM VI ÁP DỤNG
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setNewCustomScope('all_orders')}
                      className={`rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                        newCustomScope === 'all_orders'
                          ? 'bg-orange-600 text-white shadow-md shadow-orange-500/20'
                          : 'bg-zinc-100 text-zinc-600'
                      }`}
                    >
                      ALL_ORDERS
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewCustomScope('client_api')}
                      className={`rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                        newCustomScope === 'client_api'
                          ? 'bg-orange-600 text-white shadow-md shadow-orange-500/20'
                          : 'bg-zinc-100 text-zinc-600'
                      }`}
                    >
                      CLIENT_API
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs font-bold text-zinc-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newCustomStatus}
                      onChange={(e) => setNewCustomStatus(e.target.checked)}
                      className="h-4 w-4 rounded accent-orange-600"
                    />
                    <span>TRẠNG THÁI: ĐANG BẬT</span>
                  </label>

                  <button
                    type="button"
                    onClick={handleCreateCustomPrice}
                    className="flex items-center gap-1.5 rounded-xl bg-orange-600 px-6 py-2 text-xs font-extrabold text-white shadow-md shadow-orange-500/25 hover:bg-orange-700 cursor-pointer"
                  >
                    <Tag className="h-4 w-4" />
                    <span>TẠO</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Table (DANH SÁCH GIÁ RIÊNG) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase text-zinc-900">
                  DANH SÁCH GIÁ RIÊNG ({customPrices.length})
                </span>
                <span className="text-xs text-zinc-400 font-medium">{currentProduct?.name}</span>
              </div>

              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                <table className="w-full text-left text-xs font-medium text-zinc-700">
                  <thead className="border-b border-zinc-100 bg-zinc-50 text-[10px] font-bold uppercase text-zinc-400">
                    <tr>
                      <th className="px-4 py-3">ĐỊNH DANH USER</th>
                      <th className="px-4 py-3">TÊN SẢN PHẨM</th>
                      <th className="px-4 py-3">NHÃN GÓI</th>
                      <th className="px-4 py-3">PHẠM VI</th>
                      <th className="px-4 py-3">GIÁ RIÊNG</th>
                      <th className="px-4 py-3">TRẠNG THÁI</th>
                      <th className="px-4 py-3">NGÀY TẠO</th>
                      <th className="px-4 py-3">CẬP NHẬT</th>
                      <th className="px-4 py-3 text-center">THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {customPrices.map((cp, idx) => (
                      <tr key={cp.id ? `cp-${cp.id}-${idx}` : `cp-idx-${idx}`} className="hover:bg-zinc-50/60">
                        <td className="px-4 py-3 font-bold text-zinc-900">{cp.user_identifier}</td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-zinc-900">{cp.product_name}</div>
                          <div className="text-[10px] text-zinc-400">ID: {cp.product_id}</div>
                        </td>
                        <td className="px-4 py-3 text-zinc-500">{cp.plan_label}</td>
                        <td className="px-4 py-3 font-mono text-zinc-600">{cp.scope}</td>
                        <td className="px-4 py-3 font-bold text-orange-600">{formatPrice(cp.custom_price)}</td>
                        <td className="px-4 py-3">
                          <span className="inline-block rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600">
                            ĐANG BẬT
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[10px] text-zinc-500">{cp.created_at}</td>
                        <td className="px-4 py-3 text-[10px] text-zinc-500">{cp.updated_at}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1 text-zinc-400">
                            <button
                              type="button"
                              onClick={async () => {
                                if (!confirm('Xóa cấu hình giá riêng này?')) return;
                                try {
                                  const res = await fetch(`/api/custom-pricing?id=${cp.id}`, { method: 'DELETE' });
                                  if (res.ok && currentProduct) {
                                    openCustomPriceModal(currentProduct);
                                  }
                                } catch (e) {
                                  alert('Lỗi kết nối');
                                }
                              }}
                              className="p-1 hover:text-rose-600 cursor-pointer"
                              title="Xóa giá riêng"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end border-t border-zinc-100 bg-zinc-50/50 px-6 py-3">
            <button
              onClick={() => setIsCustomPriceModalOpen(false)}
              className="rounded-xl border border-zinc-200 bg-white px-5 py-2 text-xs font-bold text-zinc-700 shadow-xs cursor-pointer"
            >
              ĐÓNG
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
