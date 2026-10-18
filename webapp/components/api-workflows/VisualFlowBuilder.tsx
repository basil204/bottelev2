'use client';

import React, { useState } from 'react';
import {
  Plug, Plus, Play, Edit3, Trash2, CheckCircle2, AlertCircle, RefreshCw,
  Code, Send, ArrowRight, Eye, ShieldAlert, Sparkles, Layers, Sliders,
  HelpCircle, Copy, ExternalLink, Check, ChevronDown, ChevronUp,
  LayoutGrid, Activity, Compass, Cpu, ArrowDownRight, Globe, Smartphone,
  CreditCard, Key, Mail, ShieldCheck, Zap, GripVertical, MoveDown,
  ArrowDown, Settings, X, PlusCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface InputField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'url';
  placeholder?: string;
  description?: string;
  required: boolean;
}

export interface WorkflowConfig {
  name: string;
  code: string;
  icon: string;
  category_id: string | number;
  description: string;
  price_vnd: number;
  price_usdt: number;
  api_url: string;
  http_method: string;
  headers_json: string;
  body_template: string;
  input_fields: InputField[];
  response_type: string;
  response_data_path: string;
  response_success_condition: string;
  success_message_template: string;
  show_in_menu: number;
  menu_row: number;
  is_active: number;
}

interface VisualFlowBuilderProps {
  initialConfig: WorkflowConfig;
  categories: any[];
  onSave: (config: WorkflowConfig) => void;
  onRunTest: (config: WorkflowConfig) => void;
  onClose?: () => void;
}

export function VisualFlowBuilder({
  initialConfig,
  categories,
  onSave,
  onRunTest,
  onClose
}: VisualFlowBuilderProps) {
  const [config, setConfig] = useState<WorkflowConfig>(initialConfig);
  const [selectedNode, setSelectedNode] = useState<string>('trigger');
  const [draggedFieldIndex, setDraggedFieldIndex] = useState<number | null>(null);

  // Drag-and-Drop for Input Fields reordering
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedFieldIndex(index);
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropField = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedFieldIndex === null || draggedFieldIndex === targetIndex) return;

    const items = [...config.input_fields];
    const [draggedItem] = items.splice(draggedFieldIndex, 1);
    items.splice(targetIndex, 0, draggedItem);

    setConfig({ ...config, input_fields: items });
    setDraggedFieldIndex(null);
  };

  // Add new input field block
  const handleAddNewInput = (type: 'text' | 'number' | 'url' = 'text') => {
    const idx = config.input_fields.length + 1;
    const newField: InputField = {
      name: `field_${idx}`,
      label: `Nhập thông tin bước ${idx}`,
      type,
      placeholder: type === 'number' ? '100' : (type === 'url' ? 'https://...' : 'Nhập dữ liệu...'),
      description: '',
      required: true
    };
    setConfig({
      ...config,
      input_fields: [...config.input_fields, newField]
    });
    setSelectedNode(`input_${config.input_fields.length}`);
  };

  const handleDeleteInput = (idx: number) => {
    const updated = config.input_fields.filter((_, i) => i !== idx);
    setConfig({ ...config, input_fields: updated });
    setSelectedNode('inputs');
  };

  const updateInputField = (index: number, key: keyof InputField, value: any) => {
    const updated = [...config.input_fields];
    updated[index] = { ...updated[index], [key]: value };
    setConfig({ ...config, input_fields: updated });
  };

  return (
    <div className="flex flex-col h-[85vh] rounded-3xl border border-indigo-200 bg-zinc-950 text-white shadow-2xl overflow-hidden">
      {/* Top Canvas Bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/90 px-6 py-3.5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 text-white font-bold text-lg shadow-md shadow-indigo-500/30">
            {config.icon || '⚡'}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-zinc-100">{config.name || 'Luồng Mua Hàng Mới'}</h2>
              <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-mono text-indigo-400 border border-zinc-700">
                {config.code}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">
              Trình kéo thả sơ đồ luồng (Visual Node Pipeline) • Bấm vào từng khối để chỉnh sửa nhanh
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            onClick={() => onRunTest(config)}
            variant="outline"
            size="sm"
            className="border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 text-xs font-semibold"
          >
            <Play size={13} className="mr-1.5 text-emerald-400" />
            Test Sandbox
          </Button>

          <Button
            type="button"
            onClick={() => onSave(config)}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-lg shadow-indigo-500/20"
          >
            <Check size={14} className="mr-1.5" />
            Lưu Toàn Bộ Luồng
          </Button>

          {onClose && (
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Main Canvas Workspace + Inspector Side Panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PALETTE: Quick Add Blocks */}
        <div className="w-56 border-r border-zinc-800 bg-zinc-900/50 p-4 flex flex-col justify-between hidden md:flex">
          <div className="space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Khối chức năng</span>
            
            <button
              type="button"
              onClick={() => handleAddNewInput('text')}
              className="w-full flex items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-800/60 p-2.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:border-amber-500/50 hover:text-white transition-all text-left group"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 group-hover:bg-amber-500 group-hover:text-black">
                +📝
              </span>
              <div>
                <p className="font-bold">Thêm Câu Hỏi (Text)</p>
                <p className="text-[10px] text-zinc-500">Link, UID, Ghi chú</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleAddNewInput('number')}
              className="w-full flex items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-800/60 p-2.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:border-amber-500/50 hover:text-white transition-all text-left group"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 group-hover:bg-amber-500 group-hover:text-black">
                +🔢
              </span>
              <div>
                <p className="font-bold">Thêm Câu Hỏi (Số)</p>
                <p className="text-[10px] text-zinc-500">Số lượng, Ngày, ID</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedNode('api')}
              className="w-full flex items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-800/60 p-2.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:border-purple-500/50 hover:text-white transition-all text-left group"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400 group-hover:bg-purple-500 group-hover:text-white">
                ⚡
              </span>
              <div>
                <p className="font-bold">Cấu Hình API Engine</p>
                <p className="text-[10px] text-zinc-500">URL, Headers, Body</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedNode('output')}
              className="w-full flex items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-800/60 p-2.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:border-rose-500/50 hover:text-white transition-all text-left group"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400 group-hover:bg-rose-500 group-hover:text-white">
                📨
              </span>
              <div>
                <p className="font-bold">Bàn Giao Telegram</p>
                <p className="text-[10px] text-zinc-500">Mẫu tin & Kết quả</p>
              </div>
            </button>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3 text-[11px] text-zinc-400 space-y-1">
            <span className="font-bold text-indigo-400 flex items-center gap-1">
              💡 Mẹo kéo thả:
            </span>
            <p>Nắm vào biểu tượng ⠿ bên cạnh từng bước câu hỏi để đổi thứ tự bot hỏi khách hàng!</p>
          </div>
        </div>

        {/* CENTER FLOW CANVAS */}
        <div className="flex-1 overflow-y-auto p-6 bg-zinc-950 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:16px_16px]">
          <div className="max-w-2xl mx-auto space-y-4">
            {/* NODE 1: TRIGGER & PRICING */}
            <div
              onClick={() => setSelectedNode('trigger')}
              className={`rounded-2xl border-2 p-5 cursor-pointer transition-all ${
                selectedNode === 'trigger'
                  ? 'border-indigo-500 bg-indigo-950/40 shadow-lg shadow-indigo-500/10'
                  : 'border-zinc-800 bg-zinc-900/80 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 font-bold">
                    1
                  </span>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">BƯỚC 1: NÚT KÍCH HOẠT & BẢNG GIÁ</span>
                    <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                      <span>{config.icon || '⚡'}</span> {config.name || 'Tên dịch vụ'}
                    </h3>
                  </div>
                </div>

                <span className="rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 text-xs font-bold text-emerald-400">
                  {Number(config.price_vnd).toLocaleString('vi-VN')} VNĐ
                </span>
              </div>
            </div>

            {/* CONNECTOR ARROW */}
            <div className="flex justify-center">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 text-xs">
                <ArrowDown size={12} />
              </span>
            </div>

            {/* NODE 2: USER INPUT FORM STEPS (DRAG & DROP REORDERABLE) */}
            <div
              onClick={() => setSelectedNode('inputs')}
              className={`rounded-2xl border-2 p-5 cursor-pointer transition-all ${
                selectedNode.startsWith('input')
                  ? 'border-amber-500 bg-amber-950/30 shadow-lg shadow-amber-500/10'
                  : 'border-zinc-800 bg-zinc-900/80 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 font-bold">
                    2
                  </span>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">BƯỚC 2: CÂU HỎI BOT HỎI KHÁCH HÀNG</span>
                    <p className="text-xs text-zinc-300 font-bold">{config.input_fields.length} Bước Nhập Liệu</p>
                  </div>
                </div>

                <Button
                  type="button"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddNewInput('text');
                  }}
                  className="h-7 bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500 hover:text-black text-[11px] font-bold"
                >
                  <Plus size={12} className="mr-1" /> Thêm Câu Hỏi
                </Button>
              </div>

              {/* List of Draggable Inputs */}
              {config.input_fields.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-800 p-4 text-center text-xs text-zinc-500">
                  Không cần khách nhập (Đơn hàng kích hoạt trực tiếp)
                </div>
              ) : (
                <div className="space-y-2">
                  {config.input_fields.map((field, idx) => (
                    <div
                      key={idx}
                      draggable
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDropField(e, idx)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNode(`input_${idx}`);
                      }}
                      className={`flex items-center justify-between rounded-xl border p-2.5 transition-all ${
                        selectedNode === `input_${idx}`
                          ? 'border-amber-400 bg-amber-900/40 text-white'
                          : 'border-zinc-800 bg-zinc-950/80 text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="cursor-grab text-zinc-500 hover:text-zinc-300">
                          <GripVertical size={14} />
                        </span>
                        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="text-xs font-bold">{field.label || field.name}</p>
                          <span className="text-[10px] font-mono text-zinc-400">
                            Biến: <code className="text-amber-300">{`{${field.name}}`}</code> • Kiểu: {field.type}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteInput(idx);
                        }}
                        className="text-zinc-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CONNECTOR ARROW */}
            <div className="flex justify-center">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 text-xs">
                <ArrowDown size={12} />
              </span>
            </div>

            {/* NODE 3: WALLET CHECK & AUTO REFUND */}
            <div
              onClick={() => setSelectedNode('wallet')}
              className={`rounded-2xl border-2 p-5 cursor-pointer transition-all ${
                selectedNode === 'wallet'
                  ? 'border-emerald-500 bg-emerald-950/30 shadow-lg shadow-emerald-500/10'
                  : 'border-zinc-800 bg-zinc-900/80 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 font-bold">
                    3
                  </span>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">BƯỚC 3: KIỂM TRA VÍ & BẢO VỆ TỰ HOÀN TIỀN</span>
                    <h3 className="text-sm font-bold text-zinc-100">Xác Nhận Đơn Hàng & Trừ Số Dư</h3>
                  </div>
                </div>

                <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                  100% Fail-Safe Auto Refund
                </span>
              </div>
            </div>

            {/* CONNECTOR ARROW */}
            <div className="flex justify-center">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 text-xs">
                <ArrowDown size={12} />
              </span>
            </div>

            {/* NODE 4: HTTP API ENGINE */}
            <div
              onClick={() => setSelectedNode('api')}
              className={`rounded-2xl border-2 p-5 cursor-pointer transition-all ${
                selectedNode === 'api'
                  ? 'border-purple-500 bg-purple-950/30 shadow-lg shadow-purple-500/10'
                  : 'border-zinc-800 bg-zinc-900/80 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400 font-bold">
                    4
                  </span>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">BƯỚC 4: GỌI API ĐỐI TÁC</span>
                    <h3 className="text-sm font-bold text-zinc-100 font-mono">
                      <span className="text-purple-400 font-extrabold">{config.http_method}</span> {config.api_url}
                    </h3>
                  </div>
                </div>

                <span className="rounded-md bg-purple-500/20 px-2 py-0.5 text-[10px] font-mono text-purple-300">
                  Headers + Body
                </span>
              </div>
            </div>

            {/* CONNECTOR ARROW */}
            <div className="flex justify-center">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 text-xs">
                <ArrowDown size={12} />
              </span>
            </div>

            {/* NODE 5: RESPONSE PARSER & DELIVERY */}
            <div
              onClick={() => setSelectedNode('output')}
              className={`rounded-2xl border-2 p-5 cursor-pointer transition-all ${
                selectedNode === 'output'
                  ? 'border-rose-500 bg-rose-950/30 shadow-lg shadow-rose-500/10'
                  : 'border-zinc-800 bg-zinc-900/80 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 font-bold">
                    5
                  </span>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">BƯỚC 5: TRÍCH XUẤT JSON & BÀN GIAO TELEGRAM</span>
                    <h3 className="text-sm font-bold text-zinc-100">
                      JSON Path: <code className="text-rose-400 font-mono">{config.response_data_path || 'data'}</code>
                    </h3>
                  </div>
                </div>

                <span className="rounded-md bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                  Markdown Msg
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT INSPECTOR PANEL: Dynamic Node Properties */}
        <div className="w-80 sm:w-96 border-l border-zinc-800 bg-zinc-900/90 p-5 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
              <Settings size={14} /> CẤU HÌNH KHỐI ĐANG CHỌN
            </h4>
            <span className="text-[10px] font-mono text-zinc-500 capitalize">{selectedNode}</span>
          </div>

          {/* INSPECTOR: TRIGGER NODE */}
          {selectedNode === 'trigger' && (
            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <Label className="text-zinc-300">Tên dịch vụ hiển thị *</Label>
                <Input
                  value={config.name}
                  onChange={(e) => setConfig({ ...config, name: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white h-8 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-zinc-300">Icon Emoji</Label>
                  <Input
                    value={config.icon}
                    onChange={(e) => setConfig({ ...config, icon: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white h-8 text-center text-base"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-zinc-300">Mã Code (Slug)</Label>
                  <Input
                    value={config.code}
                    onChange={(e) => setConfig({ ...config, code: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-zinc-300">Giá bán (VNĐ) *</Label>
                  <Input
                    type="number"
                    value={config.price_vnd}
                    onChange={(e) => setConfig({ ...config, price_vnd: Number(e.target.value) })}
                    className="bg-zinc-950 border-zinc-800 text-emerald-400 font-bold h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-zinc-300">Giá bán (USDT)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={config.price_usdt}
                    onChange={(e) => setConfig({ ...config, price_usdt: Number(e.target.value) })}
                    className="bg-zinc-950 border-zinc-800 text-emerald-400 font-bold h-8 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-zinc-300">Mô tả dịch vụ</Label>
                <textarea
                  rows={3}
                  value={config.description}
                  onChange={(e) => setConfig({ ...config, description: e.target.value })}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-2 text-xs text-white"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-zinc-800">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="canvas_active"
                    checked={Boolean(config.is_active)}
                    onChange={(e) => setConfig({ ...config, is_active: e.target.checked ? 1 : 0 })}
                    className="rounded border-zinc-700 bg-zinc-950 text-indigo-600"
                  />
                  <label htmlFor="canvas_active" className="text-xs text-zinc-300 cursor-pointer">
                    Mở bán dịch vụ này trên Bot
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="canvas_menu"
                    checked={Boolean(config.show_in_menu)}
                    onChange={(e) => setConfig({ ...config, show_in_menu: e.target.checked ? 1 : 0 })}
                    className="rounded border-zinc-700 bg-zinc-950 text-indigo-600"
                  />
                  <label htmlFor="canvas_menu" className="text-xs text-zinc-300 cursor-pointer">
                    Hiển thị nút ở Menu Sản Phẩm
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* INSPECTOR: INPUT FIELD NODE */}
          {selectedNode.startsWith('input_') && (() => {
            const fIdx = parseInt(selectedNode.replace('input_', ''), 10);
            const field = config.input_fields[fIdx];
            if (!field) return null;

            return (
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-400">Chỉnh sửa Câu Hỏi #{fIdx + 1}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteInput(fIdx)}
                    className="text-rose-400 hover:text-rose-300 text-[11px]"
                  >
                    Xóa bước này
                  </button>
                </div>

                <div className="space-y-1">
                  <Label className="text-zinc-300">Tên biến (Key) *</Label>
                  <Input
                    value={field.name}
                    onChange={(e) => updateInputField(fIdx, 'name', e.target.value)}
                    className="bg-zinc-950 border-zinc-800 text-amber-300 font-mono h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-zinc-300">Câu hỏi hiển thị cho khách *</Label>
                  <Input
                    value={field.label}
                    onChange={(e) => updateInputField(fIdx, 'label', e.target.value)}
                    className="bg-zinc-950 border-zinc-800 text-white h-8 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-zinc-300">Kiểu dữ liệu</Label>
                    <select
                      value={field.type}
                      onChange={(e) => updateInputField(fIdx, 'type', e.target.value as any)}
                      className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-white h-8"
                    >
                      <option value="text">Văn bản (Text)</option>
                      <option value="number">Số lượng (Number)</option>
                      <option value="url">Đường link (URL)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-zinc-300">Placeholder gợi ý</Label>
                    <Input
                      value={field.placeholder || ''}
                      onChange={(e) => updateInputField(fIdx, 'placeholder', e.target.value)}
                      className="bg-zinc-950 border-zinc-800 text-white h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id={`field_req_${fIdx}`}
                    checked={field.required}
                    onChange={(e) => updateInputField(fIdx, 'required', e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-950 text-indigo-600"
                  />
                  <label htmlFor={`field_req_${fIdx}`} className="text-xs text-zinc-300 cursor-pointer">
                    Bắt buộc khách phải nhập
                  </label>
                </div>
              </div>
            );
          })()}

          {/* INSPECTOR: HTTP API ENGINE */}
          {selectedNode === 'api' && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-zinc-300">Method</Label>
                  <select
                    value={config.http_method}
                    onChange={(e) => setConfig({ ...config, http_method: e.target.value })}
                    className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs font-bold text-purple-400 h-8"
                  >
                    <option value="POST">POST</option>
                    <option value="GET">GET</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                  </select>
                </div>

                <div className="space-y-1 col-span-2">
                  <Label className="text-zinc-300">API Endpoint URL *</Label>
                  <Input
                    value={config.api_url}
                    onChange={(e) => setConfig({ ...config, api_url: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white font-mono h-8 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-zinc-300">Headers (JSON)</Label>
                <textarea
                  rows={3}
                  value={config.headers_json}
                  onChange={(e) => setConfig({ ...config, headers_json: e.target.value })}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-2 font-mono text-[11px] text-emerald-400"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-zinc-300">Request Body Template (JSON)</Label>
                <textarea
                  rows={6}
                  value={config.body_template}
                  onChange={(e) => setConfig({ ...config, body_template: e.target.value })}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-2 font-mono text-[11px] text-emerald-400"
                />
              </div>
            </div>
          )}

          {/* INSPECTOR: OUTPUT NODE */}
          {selectedNode === 'output' && (
            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <Label className="text-zinc-300">Đường dẫn trích xuất JSON Path</Label>
                <Input
                  value={config.response_data_path}
                  onChange={(e) => setConfig({ ...config, response_data_path: e.target.value })}
                  placeholder="data, proxies, key"
                  className="bg-zinc-950 border-zinc-800 text-rose-400 font-mono h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-zinc-300">Mẫu tin nhắn Telegram gửi cho khách *</Label>
                <textarea
                  rows={8}
                  value={config.success_message_template}
                  onChange={(e) => setConfig({ ...config, success_message_template: e.target.value })}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-2 font-mono text-[11px] text-zinc-200"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
