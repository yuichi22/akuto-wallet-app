import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {
  Building2,
  Users,
  Package,
  ReceiptText,
  Settings,
  Loader2,
  AlertCircle,
  Wallet,
  CreditCard,
  Coffee,
  Utensils,
  Ticket,
  X,
  Plus,
  Pencil,
  Save,
  Link,
  Copy,
  LogOut,
} from 'lucide-react';

import { auth, db } from '../../shared/api/firebase/client';
import PhoneLogin from '../customer/PhoneLogin';

const DEMO_ORGANIZATION_ID = 'org_demo';
const DEMO_OFFICE_ID = 'office_demo';

const iconMap = {
  utensils: Utensils,
  coffee: Coffee,
  ticket: Ticket,
};

const formatYen = (value) => `${Number(value || 0).toLocaleString()}円`;

const toDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  return null;
};

const formatDateTime = (value) => {
  const date = toDate(value);

  if (!date) return '日時不明';

  return date.toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const makeTransactionId = () => {
  const random = Math.random().toString(36).slice(2, 8);
  return `tx_${Date.now()}_${random}`;
};

function ChargeModal({
  customer,
  amount,
  note,
  processing,
  errorMessage,
  onChangeAmount,
  onChangeNote,
  onClose,
  onConfirm,
}) {
  if (!customer) return null;

  const quickAmounts = [500, 1000, 3000, 5000];
  const normalizedAmount = Math.max(Number(amount || 0), 0);
  const balanceAfter = Number(customer.balance || 0) + normalizedAmount;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 px-4 pb-4 backdrop-blur-sm sm:items-center sm:pb-0">
      <section className="w-full max-w-md rounded-[2rem] bg-white p-5 text-slate-900 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              Charge
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-900">
              チャージ
            </h2>
            <p className="mt-2 text-sm font-bold text-slate-500">
              {customer.name} さんの残高に加算します。
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-5 rounded-[1.5rem] bg-slate-50 p-4">
          <p className="text-xs font-black text-slate-400">
            現在の残高
          </p>
          <p className="mt-1 text-3xl font-black text-slate-900">
            {formatYen(customer.balance)}
          </p>
        </div>

        <div className="mt-5">
          <label className="mb-2 block text-xs font-black text-slate-400">
            チャージ金額
          </label>
          <input
            type="number"
            min="1"
            inputMode="numeric"
            value={amount}
            onChange={(event) => onChangeAmount(event.target.value)}
            className="h-14 w-full rounded-2xl border-2 border-slate-100 px-4 text-right text-2xl font-black outline-none focus:border-slate-900"
            placeholder="0"
            disabled={processing}
          />
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2">
          {quickAmounts.map((quickAmount) => (
            <button
              key={quickAmount}
              type="button"
              onClick={() => onChangeAmount(String(quickAmount))}
              disabled={processing}
              className="h-11 rounded-2xl bg-slate-100 text-xs font-black text-slate-700 disabled:opacity-50"
            >
              {quickAmount.toLocaleString()}
            </button>
          ))}
        </div>

        <div className="mt-5 rounded-[1.5rem] bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-500">
              チャージ後の残高
            </p>
            <p className="text-2xl font-black text-slate-900">
              {formatYen(balanceAfter)}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <label className="mb-2 block text-xs font-black text-slate-400">
            メモ
          </label>
          <input
            value={note}
            onChange={(event) => onChangeNote(event.target.value)}
            className="h-12 w-full rounded-2xl border-2 border-slate-100 px-4 text-sm font-bold outline-none focus:border-slate-900"
            placeholder="例：現金預かり"
            disabled={processing}
          />
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold leading-6 text-red-600">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="flex h-14 items-center justify-center rounded-2xl bg-slate-100 text-sm font-black text-slate-600 disabled:opacity-50"
          >
            キャンセル
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={processing || normalizedAmount <= 0}
            className="flex h-14 items-center justify-center rounded-2xl bg-slate-900 text-sm font-black text-white shadow-lg shadow-slate-200 disabled:opacity-60"
          >
            {processing ? (
              <span className="flex items-center gap-2">
                <Loader2 className="animate-spin" size={18} />
                処理中
              </span>
            ) : (
              'チャージする'
            )}
          </button>
        </div>
      </section>
    </div>
  );
}


const createProductId = () => {
  const random = Math.random().toString(36).slice(2, 8);
  return `product_${Date.now()}_${random}`;
};

const emptyProductForm = {
  name: '',
  price: '',
  category: '',
  icon: 'ticket',
  sortOrder: '100',
  isActive: true,
};

function ProductModal({
  product,
  form,
  processing,
  errorMessage,
  onChange,
  onClose,
  onConfirm,
}) {
  if (!form) return null;

  const isEdit = Boolean(product?.id);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 px-4 pb-4 backdrop-blur-sm sm:items-center sm:pb-0">
      <section className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[2rem] bg-white p-5 text-slate-900 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              Product
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-900">
              {isEdit ? '商品編集' : '商品追加'}
            </h2>
            <p className="mt-2 text-sm font-bold text-slate-500">
              食事・飲料・イベント参加費などを登録します。
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <div>
            <label className="mb-2 block text-xs font-black text-slate-400">
              商品名
            </label>
            <input
              value={form.name}
              onChange={(event) => onChange({ ...form, name: event.target.value })}
              className="h-12 w-full rounded-2xl border-2 border-slate-100 px-4 text-sm font-bold outline-none focus:border-slate-900"
              placeholder="例：昼食"
              disabled={processing}
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-black text-slate-400">
              価格
            </label>
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={form.price}
              onChange={(event) => onChange({ ...form, price: event.target.value })}
              className="h-12 w-full rounded-2xl border-2 border-slate-100 px-4 text-right text-lg font-black outline-none focus:border-slate-900"
              placeholder="0"
              disabled={processing}
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-black text-slate-400">
              カテゴリ
            </label>
            <input
              value={form.category}
              onChange={(event) => onChange({ ...form, category: event.target.value })}
              className="h-12 w-full rounded-2xl border-2 border-slate-100 px-4 text-sm font-bold outline-none focus:border-slate-900"
              placeholder="例：食事"
              disabled={processing}
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-black text-slate-400">
              アイコン
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'utensils', label: '食事' },
                { value: 'coffee', label: '飲料' },
                { value: 'ticket', label: 'イベント' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onChange({ ...form, icon: option.value })}
                  disabled={processing}
                  className={`h-12 rounded-2xl text-xs font-black ${
                    form.icon === option.value
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-black text-slate-400">
              並び順
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={form.sortOrder}
              onChange={(event) => onChange({ ...form, sortOrder: event.target.value })}
              className="h-12 w-full rounded-2xl border-2 border-slate-100 px-4 text-right text-sm font-bold outline-none focus:border-slate-900"
              placeholder="100"
              disabled={processing}
            />
          </div>

          <button
            type="button"
            onClick={() => onChange({ ...form, isActive: !form.isActive })}
            disabled={processing}
            className={`flex h-14 items-center justify-between rounded-2xl px-4 text-sm font-black ${
              form.isActive
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-red-50 text-red-600'
            }`}
          >
            <span>利用者画面に表示</span>
            <span>{form.isActive ? '表示中' : '非表示'}</span>
          </button>
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold leading-6 text-red-600">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="flex h-14 items-center justify-center rounded-2xl bg-slate-100 text-sm font-black text-slate-600 disabled:opacity-50"
          >
            キャンセル
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={processing}
            className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-slate-900 text-sm font-black text-white shadow-lg shadow-slate-200 disabled:opacity-60"
          >
            {processing ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                保存中
              </>
            ) : (
              <>
                <Save size={17} />
                保存
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}


const createCustomerId = () => {
  const random = Math.random().toString(36).slice(2, 8);
  return `customer_${Date.now()}_${random}`;
};

const emptyCustomerForm = {
  name: '',
  kana: '',
  phone: '',
  balance: '0',
  currentInvoiceAmount: '0',
  paymentModeOverride: '',
  status: 'active',
};

const emptyStaffForm = {
  displayName: '',
  phoneNumber: '',
  role: 'staff',
  status: 'active',
};


function CustomerModal({
  customer,
  form,
  processing,
  errorMessage,
  onChange,
  onClose,
  onConfirm,
}) {
  if (!form) return null;

  const isEdit = Boolean(customer?.id);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 px-4 pb-4 backdrop-blur-sm sm:items-center sm:pb-0">
      <section className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[2rem] bg-white p-5 text-slate-900 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              Customer
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-900">
              {isEdit ? '利用者編集' : '利用者追加'}
            </h2>
            <p className="mt-2 text-sm font-bold text-slate-500">
              事業所を利用する方の情報を登録します。
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <div>
            <label className="mb-2 block text-xs font-black text-slate-400">
              氏名
            </label>
            <input
              value={form.name}
              onChange={(event) => onChange({ ...form, name: event.target.value })}
              className="h-12 w-full rounded-2xl border-2 border-slate-100 px-4 text-sm font-bold outline-none focus:border-slate-900"
              placeholder="例：田中 太郎"
              disabled={processing}
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-black text-slate-400">
              ふりがな
            </label>
            <input
              value={form.kana}
              onChange={(event) => onChange({ ...form, kana: event.target.value })}
              className="h-12 w-full rounded-2xl border-2 border-slate-100 px-4 text-sm font-bold outline-none focus:border-slate-900"
              placeholder="例：たなか たろう"
              disabled={processing}
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-black text-slate-400">
              電話番号
            </label>
            <input
              value={form.phone}
              onChange={(event) => onChange({ ...form, phone: event.target.value })}
              className="h-12 w-full rounded-2xl border-2 border-slate-100 px-4 text-sm font-bold outline-none focus:border-slate-900"
              placeholder="例：+819012345678"
              disabled={processing}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-xs font-black text-slate-400">
                残高
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={form.balance}
                onChange={(event) => onChange({ ...form, balance: event.target.value })}
                className="h-12 w-full rounded-2xl border-2 border-slate-100 px-4 text-right text-sm font-black outline-none focus:border-slate-900"
                placeholder="0"
                disabled={processing}
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-black text-slate-400">
                請求額
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={form.currentInvoiceAmount}
                onChange={(event) => onChange({ ...form, currentInvoiceAmount: event.target.value })}
                className="h-12 w-full rounded-2xl border-2 border-slate-100 px-4 text-right text-sm font-black outline-none focus:border-slate-900"
                placeholder="0"
                disabled={processing}
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-black text-slate-400">
              支払い方式
            </label>
            <div className="grid gap-2">
              {[
                { value: '', label: '事業所設定に従う' },
                { value: 'prepaid', label: '先払いチャージ式' },
                { value: 'postpaid', label: '後払い式' },
              ].map((option) => (
                <button
                  key={option.value || 'default'}
                  type="button"
                  onClick={() => onChange({ ...form, paymentModeOverride: option.value })}
                  disabled={processing}
                  className={`h-12 rounded-2xl text-sm font-black ${
                    form.paymentModeOverride === option.value
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onChange({ ...form, status: form.status === 'active' ? 'inactive' : 'active' })}
            disabled={processing}
            className={`flex h-14 items-center justify-between rounded-2xl px-4 text-sm font-black ${
              form.status === 'active'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-red-50 text-red-600'
            }`}
          >
            <span>利用状態</span>
            <span>{form.status === 'active' ? '利用中' : '停止中'}</span>
          </button>
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold leading-6 text-red-600">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="flex h-14 items-center justify-center rounded-2xl bg-slate-100 text-sm font-black text-slate-600 disabled:opacity-50"
          >
            キャンセル
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={processing}
            className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-slate-900 text-sm font-black text-white shadow-lg shadow-slate-200 disabled:opacity-60"
          >
            {processing ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                保存中
              </>
            ) : (
              <>
                <Save size={17} />
                保存
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}


function OfficeSettingsModal({
  office,
  settings,
  form,
  processing,
  errorMessage,
  onChange,
  onClose,
  onConfirm,
}) {
  if (!form) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 px-4 pb-4 backdrop-blur-sm sm:items-center sm:pb-0">
      <section className="w-full max-w-md rounded-[2rem] bg-white p-5 text-slate-900 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              Office Settings
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-900">
              事業所設定
            </h2>
            <p className="mt-2 text-sm font-bold text-slate-500">
              {office?.displayName || office?.name || '事業所'} の支払い方式を設定します。
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-5 grid gap-3">
          <button
            type="button"
            onClick={() => onChange({ ...form, paymentMode: 'prepaid' })}
            disabled={processing}
            className={`rounded-[1.5rem] p-4 text-left ring-2 ${
              form.paymentMode === 'prepaid'
                ? 'bg-slate-900 text-white ring-slate-900'
                : 'bg-slate-50 text-slate-900 ring-slate-100'
            }`}
          >
            <div className="flex items-start gap-3">
              <Wallet size={24} />
              <div>
                <p className="text-base font-black">
                  先払いチャージ式
                </p>
                <p className={`mt-1 text-sm font-bold leading-6 ${
                  form.paymentMode === 'prepaid' ? 'text-white/70' : 'text-slate-500'
                }`}>
                  利用者ごとの残高から、商品購入時に金額を差し引きます。
                </p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onChange({ ...form, paymentMode: 'postpaid' })}
            disabled={processing}
            className={`rounded-[1.5rem] p-4 text-left ring-2 ${
              form.paymentMode === 'postpaid'
                ? 'bg-slate-900 text-white ring-slate-900'
                : 'bg-slate-50 text-slate-900 ring-slate-100'
            }`}
          >
            <div className="flex items-start gap-3">
              <CreditCard size={24} />
              <div>
                <p className="text-base font-black">
                  後払い式
                </p>
                <p className={`mt-1 text-sm font-bold leading-6 ${
                  form.paymentMode === 'postpaid' ? 'text-white/70' : 'text-slate-500'
                }`}>
                  商品購入時に請求額を積み上げます。月末精算や給与控除型の運用に向いています。
                </p>
              </div>
            </div>
          </button>
        </div>

        <div className="mt-5 rounded-[1.5rem] bg-amber-50 p-4 text-amber-800">
          <p className="text-sm font-black">
            注意
          </p>
          <p className="mt-1 text-xs font-bold leading-5">
            切替後も既存の残高・請求額はそのまま残します。必要に応じて利用者編集で調整してください。
          </p>
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold leading-6 text-red-600">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="flex h-14 items-center justify-center rounded-2xl bg-slate-100 text-sm font-black text-slate-600 disabled:opacity-50"
          >
            キャンセル
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={processing}
            className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-slate-900 text-sm font-black text-white shadow-lg shadow-slate-200 disabled:opacity-60"
          >
            {processing ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                保存中
              </>
            ) : (
              <>
                <Save size={17} />
                保存
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}


function StatCard({ title, value, description, icon: Icon }) {
  return (
    <div className="rounded-[2rem] bg-white p-5 text-slate-900 shadow-sm ring-1 ring-slate-100">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
        <Icon size={22} />
      </div>
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
        {title}
      </p>
      <p className="mt-2 text-3xl font-black text-slate-900">
        {value}
      </p>
      <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}

function StaffModal({
  staffMember,
  form,
  processing,
  errorMessage,
  onChange,
  onClose,
  onConfirm,
}) {
  if (!form) return null;

  const isEdit = Boolean(staffMember?.id);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 px-4 pb-4 backdrop-blur-sm sm:items-center sm:pb-0">
      <section className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[2rem] bg-white p-5 text-slate-900 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              Staff
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-900">
              {isEdit ? 'スタッフ編集' : 'スタッフ追加'}
            </h2>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
              管理画面を利用できるスタッフを登録します。電話番号は +81 形式で入力します。
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <div>
            <label className="mb-2 block text-xs font-black text-slate-400">
              表示名
            </label>
            <input
              value={form.displayName}
              onChange={(event) => onChange({ ...form, displayName: event.target.value })}
              className="h-12 w-full rounded-2xl border-2 border-slate-100 px-4 text-sm font-bold outline-none focus:border-slate-900"
              placeholder="例：管理スタッフ"
              disabled={processing}
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-black text-slate-400">
              電話番号
            </label>
            <input
              value={form.phoneNumber}
              onChange={(event) => onChange({ ...form, phoneNumber: event.target.value })}
              className="h-12 w-full rounded-2xl border-2 border-slate-100 px-4 text-sm font-bold outline-none focus:border-slate-900"
              placeholder="例：+819012345678"
              disabled={processing}
            />
            <p className="mt-2 text-xs font-bold leading-5 text-slate-400">
              090-1234-5678 → +819012345678 の形式で登録してください。
            </p>
          </div>

          <div>
            <label className="mb-2 block text-xs font-black text-slate-400">
              権限
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'owner', label: 'オーナー' },
                { value: 'staff', label: 'スタッフ' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onChange({ ...form, role: option.value })}
                  disabled={processing}
                  className={`h-12 rounded-2xl text-sm font-black ${
                    form.role === option.value
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onChange({
              ...form,
              status: form.status === 'active' ? 'inactive' : 'active',
            })}
            disabled={processing}
            className={`flex h-14 items-center justify-between rounded-2xl px-4 text-sm font-black ${
              form.status === 'active'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-red-50 text-red-600'
            }`}
          >
            <span>利用状態</span>
            <span>{form.status === 'active' ? '有効' : '停止中'}</span>
          </button>
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold leading-6 text-red-600">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="flex h-14 items-center justify-center rounded-2xl bg-slate-100 text-sm font-black text-slate-600 disabled:opacity-50"
          >
            キャンセル
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={processing}
            className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-slate-900 text-sm font-black text-white shadow-lg shadow-slate-200 disabled:opacity-60"
          >
            {processing ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                保存中
              </>
            ) : (
              <>
                <Save size={17} />
                保存
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}

function SectionCard({ title, description, icon: Icon, children }) {
  return (
    <section className="rounded-[2rem] bg-white p-5 text-slate-900 shadow-sm ring-1 ring-slate-100">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
          <Icon size={21} />
        </div>
        <div>
          <h2 className="text-lg font-black text-slate-900">
            {title}
          </h2>
          <p className="mt-1 text-sm font-bold text-slate-400">
            {description}
          </p>
        </div>
      </div>

      {children}
    </section>
  );
}

export default function AdminApp() {
  const [office, setOffice] = useState(null);
  const [settings, setSettings] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [authChecking, setAuthChecking] = useState(true);
  const [adminUser, setAdminUser] = useState(null);
  const [staffMember, setStaffMember] = useState(null);
  const [staffChecking, setStaffChecking] = useState(false);
  const [staffError, setStaffError] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [chargeCustomer, setChargeCustomer] = useState(null);
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeNote, setChargeNote] = useState('現金チャージ');
  const [chargeProcessing, setChargeProcessing] = useState(false);
  const [chargeError, setChargeError] = useState('');
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState(null);
  const [productProcessing, setProductProcessing] = useState(false);
  const [productError, setProductError] = useState('');
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [customerForm, setCustomerForm] = useState(null);
  const [customerProcessing, setCustomerProcessing] = useState(false);
  const [customerError, setCustomerError] = useState('');
  const [editingManagedStaff, setEditingManagedStaff] = useState(null);
  const [managedStaffForm, setManagedStaffForm] = useState(null);
  const [managedStaffProcessing, setManagedStaffProcessing] = useState(false);
  const [managedStaffError, setManagedStaffError] = useState('');
  const [settingsForm, setSettingsForm] = useState(null);
  const [settingsProcessing, setSettingsProcessing] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [copiedCustomerId, setCopiedCustomerId] = useState('');

  const basePath = useMemo(
    () => `organizations/${DEMO_ORGANIZATION_ID}/offices/${DEMO_OFFICE_ID}`,
    []
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAdminUser(user || null);
      setStaffMember(null);
      setStaffError('');
      setAuthChecking(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (authChecking || !adminUser) {
      setStaffChecking(false);
      return undefined;
    }

    setStaffChecking(true);
    setStaffError('');

    const staffDocId = adminUser.phoneNumber || adminUser.uid;
    const staffRef = doc(
      db,
      `${basePath}/staffMembers/${staffDocId}`
    );

    const unsubscribe = onSnapshot(
      staffRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setStaffMember(null);
          setStaffError('このアカウントには管理画面の利用権限がありません。');
          setStaffChecking(false);
          return;
        }

        const data = snapshot.data();

        if (data.status !== 'active') {
          setStaffMember(null);
          setStaffError('このスタッフアカウントは停止中です。');
          setStaffChecking(false);
          return;
        }

        setStaffMember({
          id: snapshot.id,
          ...data,
        });
        setStaffChecking(false);
      },
      (error) => {
        console.error(error);
        setStaffMember(null);
        setStaffError('スタッフ権限の確認に失敗しました。');
        setStaffChecking(false);
      }
    );

    return () => unsubscribe();
  }, [authChecking, adminUser, basePath]);

  useEffect(() => {
    if (authChecking || !adminUser || staffChecking || !staffMember) {
      return undefined;
    }

    let unsubscribeCustomers = null;
    let unsubscribeProducts = null;
    let unsubscribeTransactions = null;
    let unsubscribeStaffMembers = null;
    let mounted = true;

    async function loadInitialData() {
      try {
        setLoading(true);
        setErrorMessage('');

        const officeRef = doc(db, `organizations/${DEMO_ORGANIZATION_ID}/offices/${DEMO_OFFICE_ID}`);
        const settingsRef = doc(db, `${basePath}/settings/basic`);

        const [officeSnap, settingsSnap] = await Promise.all([
          getDoc(officeRef),
          getDoc(settingsRef),
        ]);

        if (!mounted) return;

        if (!officeSnap.exists()) {
          throw new Error('事業所データが見つかりません。');
        }

        setOffice({
          id: officeSnap.id,
          ...officeSnap.data(),
        });

        setSettings(settingsSnap.exists()
          ? {
              id: settingsSnap.id,
              ...settingsSnap.data(),
            }
          : null);

        unsubscribeCustomers = onSnapshot(
          query(collection(db, `${basePath}/customers`)),
          (snapshot) => {
            const nextCustomers = snapshot.docs
              .map((customerDoc) => ({
                id: customerDoc.id,
                ...customerDoc.data(),
              }))
              .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ja'));

            setCustomers(nextCustomers);
            setLoading(false);
          },
          (error) => {
            console.error(error);
            setErrorMessage('利用者データの読み込みに失敗しました。');
            setLoading(false);
          }
        );

        unsubscribeProducts = onSnapshot(
          query(collection(db, `${basePath}/products`)),
          (snapshot) => {
            const nextProducts = snapshot.docs
              .map((productDoc) => ({
                id: productDoc.id,
                ...productDoc.data(),
              }))
              .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));

            setProducts(nextProducts);
          },
          (error) => {
            console.error(error);
            setErrorMessage('商品データの読み込みに失敗しました。');
          }
        );

        unsubscribeTransactions = onSnapshot(
          query(collection(db, `${basePath}/transactions`)),
          (snapshot) => {
            const nextTransactions = snapshot.docs
              .map((transactionDoc) => ({
                id: transactionDoc.id,
                ...transactionDoc.data(),
              }))
              .sort((a, b) => {
                const dateA = toDate(a.createdAt)?.getTime() || 0;
                const dateB = toDate(b.createdAt)?.getTime() || 0;
                return dateB - dateA;
              });

            setTransactions(nextTransactions);
          },
          (error) => {
            console.error(error);
            setErrorMessage('履歴データの読み込みに失敗しました。');
          }
        );

        unsubscribeStaffMembers = onSnapshot(
          query(collection(db, `${basePath}/staffMembers`)),
          (snapshot) => {
            const nextStaffMembers = snapshot.docs
              .map((staffDoc) => ({
                id: staffDoc.id,
                ...staffDoc.data(),
              }))
              .sort((a, b) => String(a.displayName || '').localeCompare(String(b.displayName || ''), 'ja'));

            setStaffMembers(nextStaffMembers);
          },
          (error) => {
            console.error(error);
            setErrorMessage('スタッフデータの読み込みに失敗しました。');
          }
        );
      } catch (error) {
        console.error(error);
        if (!mounted) return;
        setErrorMessage(error.message || '管理画面データの読み込みに失敗しました。');
        setLoading(false);
      }
    }

    loadInitialData();

    return () => {
      mounted = false;

      if (unsubscribeCustomers) {
        unsubscribeCustomers();
      }

      if (unsubscribeProducts) {
        unsubscribeProducts();
      }

      if (unsubscribeTransactions) {
        unsubscribeTransactions();
      }

      if (unsubscribeStaffMembers) {
        unsubscribeStaffMembers();
      }
    };
  }, [basePath, authChecking, adminUser, staffChecking, staffMember]);

  const paymentMode = settings?.paymentMode || office?.paymentMode || 'prepaid';
  const isPostpaid = paymentMode === 'postpaid';

  const resolveCustomerPaymentMode = (customer) => {
    if (customer?.paymentModeOverride === 'prepaid') return 'prepaid';
    if (customer?.paymentModeOverride === 'postpaid') return 'postpaid';
    return paymentMode;
  };

  const getPaymentModeLabel = (mode) => (
    mode === 'postpaid' ? '後払い式' : '先払い式'
  );

  const getCustomerOverrideLabel = (customer) => {
    if (customer?.paymentModeOverride === 'prepaid') return '個別：先払い';
    if (customer?.paymentModeOverride === 'postpaid') return '個別：後払い';
    return '事業所設定';
  };

  const activeProducts = products.filter((product) => product.isActive !== false);
  const latestTransactions = transactions.slice(0, 8);
  const totalBalance = customers.reduce((sum, customer) => sum + Number(customer.balance || 0), 0);
  const totalInvoice = customers.reduce((sum, customer) => sum + Number(customer.currentInvoiceAmount || 0), 0);

  const getCustomerUrl = (customerId) => {
    const origin = window.location.origin;
    return `${origin}/u/${encodeURIComponent(customerId)}`;
  };

  const copyCustomerUrl = async (customer) => {
    const url = getCustomerUrl(customer.id);

    try {
      await navigator.clipboard.writeText(url);
      setCopiedCustomerId(customer.id);

      window.setTimeout(() => {
        setCopiedCustomerId((current) => (
          current === customer.id ? '' : current
        ));
      }, 1800);
    } catch (error) {
      console.error(error);
      window.prompt('利用者URLをコピーしてください', url);
    }
  };

  const openChargeModal = (customer) => {
    setChargeCustomer(customer);
    setChargeAmount('');
    setChargeNote('現金チャージ');
    setChargeError('');
  };

  const closeChargeModal = () => {
    if (chargeProcessing) return;

    setChargeCustomer(null);
    setChargeAmount('');
    setChargeNote('現金チャージ');
    setChargeError('');
  };

  const handleCharge = async () => {
    if (!chargeCustomer || chargeProcessing) return;

    const amount = Math.round(Number(chargeAmount || 0));

    if (!Number.isFinite(amount) || amount <= 0) {
      setChargeError('1円以上のチャージ金額を入力してください。');
      return;
    }

    setChargeProcessing(true);
    setChargeError('');

    const transactionId = makeTransactionId();

    try {
      const customerRef = doc(db, `${basePath}/customers/${chargeCustomer.id}`);
      const transactionRef = doc(db, `${basePath}/transactions/${transactionId}`);

      await runTransaction(db, async (transaction) => {
        const customerSnap = await transaction.get(customerRef);

        if (!customerSnap.exists()) {
          throw new Error('利用者データが見つかりません。');
        }

        const currentCustomer = customerSnap.data();
        const currentBalance = Number(currentCustomer.balance || 0);
        const balanceAfter = currentBalance + amount;

        transaction.update(customerRef, {
          balance: balanceAfter,
          updatedAt: serverTimestamp(),
        });

        transaction.set(transactionRef, {
          customerId: chargeCustomer.id,
          customerName: currentCustomer.name || chargeCustomer.name || '',
          type: 'charge',
          amount,
          balanceAfter,
          note: chargeNote || 'チャージ',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      closeChargeModal();
    } catch (error) {
      console.error(error);
      setChargeError(error.message || 'チャージ処理に失敗しました。');
    } finally {
      setChargeProcessing(false);
    }
  };

  const openCreateProductModal = () => {
    setEditingProduct(null);
    setProductForm({ ...emptyProductForm });
    setProductError('');
  };

  const openEditProductModal = (product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name || '',
      price: String(product.price ?? ''),
      category: product.category || '',
      icon: product.icon || 'ticket',
      sortOrder: String(product.sortOrder ?? 100),
      isActive: product.isActive !== false,
    });
    setProductError('');
  };

  const closeProductModal = () => {
    if (productProcessing) return;

    setEditingProduct(null);
    setProductForm(null);
    setProductError('');
  };

  const handleSaveProduct = async () => {
    if (!productForm || productProcessing) return;

    const name = String(productForm.name || '').trim();
    const category = String(productForm.category || '').trim();
    const icon = String(productForm.icon || 'ticket');
    const price = Math.round(Number(productForm.price || 0));
    const sortOrder = Math.round(Number(productForm.sortOrder || 0));

    if (!name) {
      setProductError('商品名を入力してください。');
      return;
    }

    if (!Number.isFinite(price) || price < 0) {
      setProductError('価格は0円以上で入力してください。');
      return;
    }

    setProductProcessing(true);
    setProductError('');

    try {
      const productId = editingProduct?.id || createProductId();
      const productRef = doc(db, `${basePath}/products/${productId}`);

      await setDoc(
        productRef,
        {
          name,
          price,
          category,
          icon,
          sortOrder: Number.isFinite(sortOrder) ? sortOrder : 100,
          isActive: Boolean(productForm.isActive),
          status: Boolean(productForm.isActive) ? 'active' : 'inactive',
          updatedAt: serverTimestamp(),
          ...(editingProduct?.id ? {} : { createdAt: serverTimestamp() }),
        },
        { merge: true }
      );

      closeProductModal();
    } catch (error) {
      console.error(error);
      setProductError(error.message || '商品の保存に失敗しました。');
    } finally {
      setProductProcessing(false);
    }
  };

  const openCreateCustomerModal = () => {
    setEditingCustomer(null);
    setCustomerForm({ ...emptyCustomerForm });
    setCustomerError('');
  };

  const openEditCustomerModal = (customer) => {
    setEditingCustomer(customer);
    setCustomerForm({
      name: customer.name || '',
      kana: customer.kana || '',
      phone: customer.phone || '',
      balance: String(customer.balance ?? 0),
      currentInvoiceAmount: String(customer.currentInvoiceAmount ?? 0),
      paymentModeOverride: customer.paymentModeOverride || '',
      status: customer.status || 'active',
    });
    setCustomerError('');
  };

  const closeCustomerModal = () => {
    if (customerProcessing) return;

    setEditingCustomer(null);
    setCustomerForm(null);
    setCustomerError('');
  };

  const handleSaveCustomer = async () => {
    if (!customerForm || customerProcessing) return;

    const name = String(customerForm.name || '').trim();
    const kana = String(customerForm.kana || '').trim();
    const phone = String(customerForm.phone || '').trim();
    const balance = Math.round(Number(customerForm.balance || 0));
    const currentInvoiceAmount = Math.round(Number(customerForm.currentInvoiceAmount || 0));
    const paymentModeOverride = ['prepaid', 'postpaid'].includes(customerForm.paymentModeOverride)
      ? customerForm.paymentModeOverride
      : null;
    const status = customerForm.status === 'inactive' ? 'inactive' : 'active';

    if (!name) {
      setCustomerError('氏名を入力してください。');
      return;
    }

    if (!Number.isFinite(balance) || balance < 0) {
      setCustomerError('残高は0円以上で入力してください。');
      return;
    }

    if (!Number.isFinite(currentInvoiceAmount) || currentInvoiceAmount < 0) {
      setCustomerError('請求額は0円以上で入力してください。');
      return;
    }

    setCustomerProcessing(true);
    setCustomerError('');

    try {
      const customerId = editingCustomer?.id || createCustomerId();
      const customerRef = doc(db, `${basePath}/customers/${customerId}`);

      await setDoc(
        customerRef,
        {
          name,
          kana,
          phone,
          balance,
          currentInvoiceAmount,
          paymentModeOverride,
          status,
          updatedAt: serverTimestamp(),
          ...(editingCustomer?.id ? {} : { createdAt: serverTimestamp(), paymentModeOverride: null }),
        },
        { merge: true }
      );

      closeCustomerModal();
    } catch (error) {
      console.error(error);
      setCustomerError(error.message || '利用者の保存に失敗しました。');
    } finally {
      setCustomerProcessing(false);
    }
  };

  const openCreateStaffModal = () => {
    setEditingManagedStaff(null);
    setManagedStaffForm({ ...emptyStaffForm });
    setManagedStaffError('');
  };

  const openEditStaffModal = (member) => {
    setEditingManagedStaff(member);
    setManagedStaffForm({
      displayName: member.displayName || '',
      phoneNumber: member.phoneNumber || member.id || '',
      role: member.role || 'staff',
      status: member.status || 'active',
    });
    setManagedStaffError('');
  };

  const closeStaffModal = () => {
    if (managedStaffProcessing) return;
    setEditingManagedStaff(null);
    setManagedStaffForm(null);
    setManagedStaffError('');
  };

  const handleSaveStaffMember = async () => {
    if (!managedStaffForm || managedStaffProcessing) return;

    const displayName = String(managedStaffForm.displayName || '').trim();
    const phoneNumber = String(managedStaffForm.phoneNumber || '').trim();
    const role = managedStaffForm.role === 'owner' ? 'owner' : 'staff';
    const status = managedStaffForm.status === 'inactive' ? 'inactive' : 'active';

    if (!displayName) {
      setManagedStaffError('表示名を入力してください。');
      return;
    }

    if (!phoneNumber || !phoneNumber.startsWith('+')) {
      setManagedStaffError('電話番号は +81 形式で入力してください。');
      return;
    }

    setManagedStaffProcessing(true);
    setManagedStaffError('');

    try {
      await setDoc(
        doc(db, `${basePath}/staffMembers/${phoneNumber}`),
        {
          displayName,
          phoneNumber,
          role,
          status,
          updatedAt: serverTimestamp(),
          ...(editingManagedStaff?.id ? {} : { createdAt: serverTimestamp() }),
        },
        { merge: true }
      );

      closeStaffModal();
    } catch (error) {
      console.error(error);
      setManagedStaffError(error.message || 'スタッフの保存に失敗しました。');
    } finally {
      setManagedStaffProcessing(false);
    }
  };

  const openSettingsModal = () => {
    setSettingsForm({
      paymentMode: settings?.paymentMode || office?.paymentMode || 'prepaid',
    });
    setSettingsError('');
  };

  const closeSettingsModal = () => {
    if (settingsProcessing) return;

    setSettingsForm(null);
    setSettingsError('');
  };

  const handleSaveSettings = async () => {
    if (!settingsForm || settingsProcessing) return;

    const nextPaymentMode = settingsForm.paymentMode === 'postpaid' ? 'postpaid' : 'prepaid';

    setSettingsProcessing(true);
    setSettingsError('');

    try {
      const officeRef = doc(db, `organizations/${DEMO_ORGANIZATION_ID}/offices/${DEMO_OFFICE_ID}`);
      const settingsRef = doc(db, `${basePath}/settings/basic`);

      await Promise.all([
        setDoc(
          officeRef,
          {
            paymentMode: nextPaymentMode,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ),
        setDoc(
          settingsRef,
          {
            paymentMode: nextPaymentMode,
            allowCustomerPaymentModeOverride: true,
            requireStaffVisualCheck: true,
            visualCheckSeconds: 30,
            currency: 'jpy',
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ),
      ]);

      setOffice((current) => current ? { ...current, paymentMode: nextPaymentMode } : current);
      setSettings((current) => ({
        ...(current || { id: 'basic' }),
        paymentMode: nextPaymentMode,
      }));

      closeSettingsModal();
    } catch (error) {
      console.error(error);
      setSettingsError(error.message || '事業所設定の保存に失敗しました。');
    } finally {
      setSettingsProcessing(false);
    }
  };

  const handleAdminLogout = async () => {
    await signOut(auth);
    setAdminUser(null);
    window.location.href = '/admin';
  };

  if (authChecking) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
        <div className="mx-auto max-w-md rounded-[2rem] bg-white/10 p-8 text-center ring-1 ring-white/10">
          <Loader2 className="mx-auto animate-spin text-slate-400" size={28} />
          <p className="mt-3 text-sm font-bold text-slate-400">
            ログイン状態を確認しています
          </p>
        </div>
      </main>
    );
  }

  if (!adminUser) {
    return (
      <PhoneLogin
        onLoggedIn={(user) => {
          setAdminUser(user);
        }}
      />
    );
  }

  if (staffChecking) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
        <div className="mx-auto max-w-md rounded-[2rem] bg-white/10 p-8 text-center ring-1 ring-white/10">
          <Loader2 className="mx-auto animate-spin text-slate-400" size={28} />
          <p className="mt-3 text-sm font-bold text-slate-400">
            管理権限を確認しています
          </p>
        </div>
      </main>
    );
  }

  if (staffError || !staffMember) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
        <div className="mx-auto max-w-md rounded-[2rem] bg-white p-6 text-slate-900 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-1 text-red-500" size={22} />
            <div>
              <p className="text-base font-black text-red-600">
                管理権限エラー
              </p>
              <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
                {staffError || '管理画面の利用権限がありません。'}
              </p>
              <button
                type="button"
                onClick={handleAdminLogout}
                className="mt-5 rounded-full bg-slate-900 px-5 py-3 text-sm font-black text-white"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">
                Akuto Wallet Admin
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight">
                まいウォレット 管理画面
              </h1>
              <p className="mt-2 text-sm font-medium text-slate-400">
                法人・事業所・利用者・商品・取引履歴を管理します。
              </p>
              <p className="mt-2 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-black text-slate-300 ring-1 ring-white/10">
                {staffMember?.displayName || 'スタッフ'} / {staffMember?.role || 'staff'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleAdminLogout}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-slate-300 ring-1 ring-white/10"
              aria-label="ログアウト"
            >
              <LogOut size={19} />
            </button>
          </div>
        </header>

        {loading ? (
          <section className="rounded-[2rem] bg-white/10 p-8 text-center ring-1 ring-white/10">
            <Loader2 className="mx-auto animate-spin text-slate-400" size={28} />
            <p className="mt-3 text-sm font-bold text-slate-400">
              管理画面データを読み込んでいます
            </p>
          </section>
        ) : errorMessage ? (
          <section className="rounded-[2rem] bg-white p-6 text-slate-900 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-1 text-red-500" size={22} />
              <div>
                <p className="text-base font-black text-red-600">
                  読み込みエラー
                </p>
                <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
                  {errorMessage}
                </p>
              </div>
            </div>
          </section>
        ) : (
          <>
            <section className="mb-4 rounded-[2rem] bg-emerald-500/15 p-5 ring-1 ring-emerald-400/20">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200">
                Staff Access
              </p>
              <p className="mt-2 text-xl font-black text-white">
                {staffMember?.displayName || 'スタッフ'} / {staffMember?.role || 'staff'}
              </p>
              <p className="mt-1 text-xs font-bold text-emerald-100/80">
                UID: {adminUser?.uid}
              </p>
            </section>

            <section className="rounded-[2rem] bg-white/10 p-5 ring-1 ring-white/10">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-950">
                    <Building2 size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-400">
                      現在の事業所
                    </p>
                    <p className="text-xl font-black">
                      {office?.displayName || office?.name}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950">
                    {isPostpaid ? '後払い式' : '先払いチャージ式'}
                  </div>

                  <button
                    type="button"
                    onClick={openSettingsModal}
                    className="rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white ring-1 ring-white/15"
                  >
                    設定変更
                  </button>
                </div>
              </div>
            </section>

            <section className="mt-6 grid gap-4 md:grid-cols-4">
              <StatCard
                title="Users"
                value={`${customers.length}名`}
                description="登録されている利用者数"
                icon={Users}
              />
              <StatCard
                title="Products"
                value={`${activeProducts.length}件`}
                description="表示中の商品数"
                icon={Package}
              />
              <StatCard
                title={isPostpaid ? 'Invoice' : 'Balance'}
                value={isPostpaid ? formatYen(totalInvoice) : formatYen(totalBalance)}
                description={isPostpaid ? '現在の請求合計' : '現在の残高合計'}
                icon={isPostpaid ? CreditCard : Wallet}
              />
              <StatCard
                title="History"
                value={`${transactions.length}件`}
                description="取引履歴の件数"
                icon={ReceiptText}
              />
            </section>

            <section className="mt-6 grid gap-4 lg:grid-cols-2">
              <SectionCard
                title="利用者管理"
                description="残高・請求額を管理します。"
                icon={Users}
              >
                <button
                  type="button"
                  onClick={openCreateCustomerModal}
                  className="mb-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 text-sm font-black text-white"
                >
                  <Plus size={17} />
                  利用者追加
                </button>

                <div className="grid gap-3">
                  {customers.map((customer) => (
                    <div
                      key={customer.id}
                      className="rounded-[1.5rem] bg-slate-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-black text-slate-900">
                            {customer.name}
                          </p>
                          <p className="mt-1 text-xs font-bold text-slate-400">
                            {customer.phone || '電話番号未設定'}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <p className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${
                              customer.status === 'inactive'
                                ? 'bg-red-50 text-red-600'
                                : 'bg-emerald-50 text-emerald-700'
                            }`}>
                              {customer.status === 'inactive' ? '停止中' : '利用中'}
                            </p>
                            <p className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
                              {getCustomerOverrideLabel(customer)}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-xs font-bold text-slate-400">
                            {resolveCustomerPaymentMode(customer) === 'postpaid' ? '請求額' : '残高'}
                          </p>
                          <p className="mt-1 text-lg font-black text-slate-900">
                            {resolveCustomerPaymentMode(customer) === 'postpaid'
                              ? formatYen(customer.currentInvoiceAmount)
                              : formatYen(customer.balance)}
                          </p>
                          <p className="mt-1 text-xs font-black text-slate-400">
                            {getPaymentModeLabel(resolveCustomerPaymentMode(customer))}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl bg-white px-3 py-2 ring-1 ring-slate-100">
                        <div className="flex items-center gap-2 text-slate-400">
                          <Link size={14} />
                          <p className="truncate text-xs font-bold">
                            {getCustomerUrl(customer.id)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => copyCustomerUrl(customer)}
                          className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-200"
                        >
                          <Copy size={14} />
                          {copiedCustomerId === customer.id ? 'コピー済み' : 'URLコピー'}
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditCustomerModal(customer)}
                          className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-200"
                        >
                          <Pencil size={14} />
                          編集
                        </button>

                        <button
                          type="button"
                          onClick={() => openChargeModal(customer)}
                          className="flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-black text-white"
                        >
                          <Plus size={14} />
                          チャージ
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                title="商品管理"
                description="食事・飲料・イベント参加費を管理します。"
                icon={Package}
              >
                <button
                  type="button"
                  onClick={openCreateProductModal}
                  className="mb-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 text-sm font-black text-white"
                >
                  <Plus size={17} />
                  商品追加
                </button>

                <div className="grid gap-3">
                  {products.map((product) => {
                    const Icon = iconMap[product.icon] || Ticket;

                    return (
                      <div
                        key={product.id}
                        className="rounded-[1.5rem] bg-slate-50 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-700 ring-1 ring-slate-100">
                              <Icon size={21} />
                            </div>
                            <div>
                              <p className="text-base font-black text-slate-900">
                                {product.name}
                              </p>
                              <p className="mt-1 text-xs font-bold text-slate-400">
                                {product.category || 'カテゴリ未設定'}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <p className="text-lg font-black text-slate-900">
                              {formatYen(product.price)}
                            </p>
                            <p className={`mt-1 text-xs font-black ${product.isActive === false ? 'text-red-500' : 'text-emerald-600'}`}>
                              {product.isActive === false ? '非表示' : '表示中'}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            onClick={() => openEditProductModal(product)}
                            className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-200"
                          >
                            <Pencil size={14} />
                            編集
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            </section>

            <section className="mt-4">
              <SectionCard
                title="スタッフ管理"
                description="管理画面に入れるスタッフを管理します。"
                icon={Users}
              >
                <button
                  type="button"
                  onClick={openCreateStaffModal}
                  className="mb-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 text-sm font-black text-white"
                >
                  <Plus size={17} />
                  スタッフ追加
                </button>

                <div className="grid gap-3 md:grid-cols-2">
                  {staffMembers.map((member) => (
                    <div
                      key={member.id}
                      className="rounded-[1.5rem] bg-slate-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-black text-slate-900">
                            {member.displayName || 'スタッフ'}
                          </p>
                          <p className="mt-1 text-xs font-bold text-slate-400">
                            {member.phoneNumber || member.id || '電話番号未設定'}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <p className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${
                              member.status === 'inactive'
                                ? 'bg-red-50 text-red-600'
                                : 'bg-emerald-50 text-emerald-700'
                            }`}>
                              {member.status === 'inactive' ? '停止中' : '有効'}
                            </p>
                            <p className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
                              {member.role === 'owner' ? 'オーナー' : 'スタッフ'}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => openEditStaffModal(member)}
                          className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-slate-700 ring-1 ring-slate-200"
                        >
                          <Pencil size={14} />
                          編集
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </section>

            <section className="mt-4">
              <SectionCard
                title="最新の利用履歴"
                description="購入・チャージ・精算履歴を確認します。"
                icon={ReceiptText}
              >
                <div className="grid gap-3">
                  {latestTransactions.length === 0 ? (
                    <div className="rounded-[1.5rem] bg-slate-50 p-5 text-center">
                      <p className="text-sm font-bold text-slate-500">
                        まだ履歴がありません。
                      </p>
                    </div>
                  ) : (
                    latestTransactions.map((transaction) => {
                      const isCharge = transaction.type === 'charge';
                      const isPurchase = transaction.type === 'purchase';

                      return (
                        <div
                          key={transaction.id}
                          className="rounded-[1.5rem] bg-slate-50 p-4"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="text-base font-black text-slate-900">
                                {isCharge
                                  ? 'チャージ'
                                  : transaction.productName || transaction.note || '利用'}
                              </p>
                              <p className="mt-1 text-xs font-bold text-slate-400">
                                {transaction.customerName || '利用者不明'} / {formatDateTime(transaction.createdAt)}
                              </p>
                            </div>

                            <div className="text-left md:text-right">
                              <p className={`text-lg font-black ${isCharge ? 'text-emerald-600' : 'text-slate-900'}`}>
                                {isCharge ? '+' : isPurchase ? '-' : ''}
                                {formatYen(transaction.amount)}
                              </p>
                              {transaction.visualCheck?.code ? (
                                <p className="mt-1 text-xs font-black text-slate-400">
                                  確認コード {transaction.visualCheck.code}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </SectionCard>
            </section>

            <section className="mt-4 rounded-[2rem] bg-white/10 p-5 ring-1 ring-white/10">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white">
                  <Settings size={21} />
                </div>
                <div>
                  <p className="text-base font-black text-white">
                    事業所設定
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-400">
                    現在は {isPostpaid ? '後払い式' : '先払いチャージ式'} です。上部の「設定変更」から切り替えできます。
                  </p>
                </div>
              </div>
            </section>
          </>
        )}
      </div>

      <ChargeModal
        customer={chargeCustomer}
        amount={chargeAmount}
        note={chargeNote}
        processing={chargeProcessing}
        errorMessage={chargeError}
        onChangeAmount={setChargeAmount}
        onChangeNote={setChargeNote}
        onClose={closeChargeModal}
        onConfirm={handleCharge}
      />

      <ProductModal
        product={editingProduct}
        form={productForm}
        processing={productProcessing}
        errorMessage={productError}
        onChange={setProductForm}
        onClose={closeProductModal}
        onConfirm={handleSaveProduct}
      />

      <CustomerModal
        customer={editingCustomer}
        form={customerForm}
        processing={customerProcessing}
        errorMessage={customerError}
        onChange={setCustomerForm}
        onClose={closeCustomerModal}
        onConfirm={handleSaveCustomer}
      />

      <StaffModal
        staffMember={editingManagedStaff}
        form={managedStaffForm}
        processing={managedStaffProcessing}
        errorMessage={managedStaffError}
        onChange={setManagedStaffForm}
        onClose={closeStaffModal}
        onConfirm={handleSaveStaffMember}
      />

      <OfficeSettingsModal
        office={office}
        settings={settings}
        form={settingsForm}
        processing={settingsProcessing}
        errorMessage={settingsError}
        onChange={setSettingsForm}
        onClose={closeSettingsModal}
        onConfirm={handleSaveSettings}
      />
    </main>
  );
}
