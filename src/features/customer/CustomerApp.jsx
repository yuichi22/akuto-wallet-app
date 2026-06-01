import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import {
  Wallet,
  Coffee,
  Utensils,
  Ticket,
  History,
  Loader2,
  AlertCircle,
  X,
  CheckCircle2,
  Sparkles,
  LogOut,
} from 'lucide-react';

import { auth, db } from '../../shared/api/firebase/client';
import { APP_CONFIG } from '../../shared/config/appConfig';
import PhoneLogin from './PhoneLogin';

const DEMO_ORGANIZATION_ID = 'org_demo';
const DEMO_OFFICE_ID = 'office_demo';
const FALLBACK_DEMO_CUSTOMER_ID = 'customer_tanaka';

const resolveCustomerIdFromPath = () => {
  const segments = window.location.pathname.split('/').filter(Boolean);

  if (segments[0] === 'u' && segments[1]) {
    return decodeURIComponent(segments[1]);
  }

  return FALLBACK_DEMO_CUSTOMER_ID;
};

const VISUAL_CHECK_SECONDS = 30;

const iconMap = {
  utensils: Utensils,
  coffee: Coffee,
  ticket: Ticket,
};

const formatYen = (value) => `${Number(value || 0).toLocaleString()}円`;

const normalizePhoneNumber = (value) => {
  const raw = String(value || '').trim();

  if (!raw) return '';

  const compact = raw.replace(/[\s\-ー−()（）]/g, '');

  if (compact.startsWith('+')) {
    return `+${compact.slice(1).replace(/\D/g, '')}`;
  }

  const digits = compact.replace(/\D/g, '');

  if (digits.startsWith('81')) {
    return `+${digits}`;
  }

  if (digits.startsWith('0')) {
    return `+81${digits.slice(1)}`;
  }

  return digits ? `+${digits}` : '';
};

const makeCheckCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';

  for (let index = 0; index < 4; index += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  return code;
};

const makeTransactionId = () => {
  const random = Math.random().toString(36).slice(2, 8);
  return `tx_${Date.now()}_${random}`;
};

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

function HistoryModal({ isOpen, transactions, onClose }) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-40 flex items-end justify-center bg-gradient-to-b from-emerald-900 via-teal-900 to-slate-950/40 px-4 pb-4 backdrop-blur-sm sm:items-center sm:pb-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.section
          className="max-h-[82vh] w-full max-w-md overflow-hidden rounded-[2rem] bg-white shadow-2xl"
          initial={{ y: 40, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 40, opacity: 0, scale: 0.98 }}
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                History
              </p>
              <h2 className="mt-2 text-2xl font-black text-slate-900">
                利用履歴
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500"
            >
              <X size={20} />
            </button>
          </div>

          <div className="max-h-[62vh] overflow-y-auto p-4">
            {transactions.length === 0 ? (
              <div className="rounded-[1.5rem] bg-slate-50 p-6 text-center">
                <p className="text-sm font-bold text-slate-500">
                  まだ履歴がありません。
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {transactions.map((transaction) => {
                  const isCharge = transaction.type === 'charge';
                  const isPurchase = transaction.type === 'purchase';

                  return (
                    <div
                      key={transaction.id}
                      className="rounded-[1.5rem] bg-slate-50 p-4 ring-1 ring-slate-100"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-black text-slate-900">
                            {isCharge
                              ? 'チャージ'
                              : transaction.productName || transaction.note || '利用'}
                          </p>
                          <p className="mt-1 text-xs font-bold text-slate-400">
                            {formatDateTime(transaction.createdAt)}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className={`text-lg font-black ${isCharge ? 'text-emerald-600' : 'text-slate-900'}`}>
                            {isCharge ? '+' : isPurchase ? '-' : ''}
                            {formatYen(transaction.amount)}
                          </p>
                          {typeof transaction.balanceAfter === 'number' ? (
                            <p className="mt-1 text-xs font-bold text-slate-400">
                              残高 {formatYen(transaction.balanceAfter)}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      {transaction.visualCheck?.code ? (
                        <div className="mt-3 rounded-2xl bg-white px-3 py-2">
                          <p className="text-xs font-black text-slate-400">
                            確認コード
                            <span className="ml-2 text-slate-900">
                              {transaction.visualCheck.code}
                            </span>
                          </p>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.section>
      </motion.div>
    </AnimatePresence>
  );
}


function PurchaseConfirmModal({
  product,
  customer,
  paymentMode,
  purchasing,
  errorMessage,
  onClose,
  onConfirm,
}) {
  if (!product) return null;

  const isPostpaid = paymentMode === 'postpaid';
  const balanceAfter = Number(customer?.balance || 0) - Number(product.price || 0);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-40 flex items-end justify-center bg-gradient-to-b from-emerald-900 via-teal-900 to-slate-950/40 px-4 pb-4 backdrop-blur-sm sm:items-center sm:pb-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.section
          className="w-full max-w-md rounded-[2rem] bg-white p-5 shadow-2xl"
          initial={{ y: 40, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 40, opacity: 0, scale: 0.98 }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                確認
              </p>
              <h2 className="mt-2 text-2xl font-black text-slate-900">
                {product.name}を使いますか？
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={purchasing}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500"
            >
              <X size={20} />
            </button>
          </div>

          <div className="mt-5 rounded-[1.5rem] bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-slate-700">金額</span>
              <span className="text-2xl font-black text-slate-950">
                {formatYen(product.price)}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
              <span className="text-sm font-black text-slate-700">
                {isPostpaid ? '購入後の請求額' : '購入後の残高'}
              </span>
              <span className="text-lg font-black text-slate-950">
                {isPostpaid
                  ? formatYen(Number(customer?.currentInvoiceAmount || 0) + Number(product.price || 0))
                  : formatYen(balanceAfter)}
              </span>
            </div>
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
              disabled={purchasing}
              className="flex h-14 items-center justify-center rounded-2xl bg-slate-100 text-sm font-black text-slate-600"
            >
              キャンセル
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={purchasing}
              className="flex h-14 items-center justify-center rounded-2xl bg-slate-900 text-sm font-black text-white shadow-lg shadow-slate-200 disabled:opacity-60"
            >
              {purchasing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="animate-spin" size={18} />
                  処理中
                </span>
              ) : (
                '購入する'
              )}
            </button>
          </div>
        </motion.section>
      </motion.div>
    </AnimatePresence>
  );
}

function PurchaseLiveScreen({ purchase, onClose }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  if (!purchase) return null;

  const expiresAtMs = purchase.expiresAtMs || Date.now();
  const remainingSeconds = Math.max(Math.ceil((expiresAtMs - now.getTime()) / 1000), 0);
  const progress = Math.max(Math.min(remainingSeconds / VISUAL_CHECK_SECONDS, 1), 0);
  const timeText = now.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 overflow-hidden bg-white text-slate-950"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="absolute inset-[-20%] bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.55),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.55),_transparent_34%)]"
          animate={{
            x: [0, 18, -18, 0],
            y: [0, -14, 14, 0],
            scale: [1, 1.04, 1],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        <div className="relative flex min-h-screen flex-col px-5 py-6">
          <div className="flex items-center justify-between">
            <div className="rounded-full bg-emerald-50 px-4 py-2 text-xs font-black tracking-[0.25em] text-emerald-700 ring-1 ring-emerald-100">
              LIVE
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500 ring-1 ring-slate-200"
            >
              <X size={22} />
            </button>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <motion.div
              className="relative mb-8 flex h-40 w-40 items-center justify-center rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              style={{
                background: `conic-gradient(rgb(5,150,105) ${progress * 360}deg, rgba(5,150,105,0.12) 0deg)`,
              }}
            >
              <div className="flex h-32 w-32 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xl shadow-emerald-100">
                <CheckCircle2 size={58} />
              </div>
            </motion.div>

            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 240, damping: 18 }}
            >
              <p className="text-lg font-black text-emerald-600">
                購入しました
              </p>
              <h2 className="mt-3 text-5xl font-black tracking-tight">
                {purchase.productName}
              </h2>
              <p className="mt-4 text-6xl font-black tracking-tight">
                {formatYen(purchase.amount)}
              </p>
            </motion.div>

            <div className="mt-8 grid w-full max-w-sm grid-cols-2 gap-3">
              <div className="rounded-[1.5rem] bg-emerald-600 p-4 text-white shadow-lg shadow-emerald-100">
                <p className="text-xs font-black text-emerald-100">
                  現在時刻
                </p>
                <p className="mt-1 text-2xl font-black">
                  {timeText}
                </p>
              </div>

              <div className="rounded-[1.5rem] bg-emerald-600 p-4 text-white shadow-lg shadow-emerald-100">
                <p className="text-xs font-black text-emerald-100">
                  確認コード
                </p>
                <p className="mt-1 text-3xl font-black tracking-[0.18em]">
                  {purchase.checkCode}
                </p>
              </div>
            </div>

            <div className="mt-4 w-full max-w-sm rounded-[1.5rem] bg-emerald-50 p-4 text-slate-950 ring-1 ring-emerald-100">
              <div className="flex items-center justify-center gap-2">
                <Sparkles size={18} />
                <p className="text-sm font-black">
                  スタッフ確認用画面
                </p>
              </div>
              <p className="mt-2 text-sm font-bold text-slate-500">
                有効期限まであと {remainingSeconds} 秒
              </p>
            </div>

            {remainingSeconds <= 0 ? (
              <div className="mt-4 rounded-2xl bg-red-500 px-5 py-3 text-sm font-black text-white">
                確認期限が切れました
              </div>
            ) : null}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function CustomerApp() {
  // 利用者画面は常にログイン必須。
  // Firestore rules も request.auth 前提なので、Auth復元前に読み込ませない。
  const shouldShowLogin = true;
  const routeCustomerId = useMemo(() => resolveCustomerIdFromPath(), []);
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(shouldShowLogin);
  const [resolvedCustomerId, setResolvedCustomerId] = useState(routeCustomerId);
  const [loginResolving, setLoginResolving] = useState(false);
  const [loginResolveError, setLoginResolveError] = useState('');
  const [customer, setCustomer] = useState(null);
  const [products, setProducts] = useState([]);
  const [office, setOffice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [purchaseError, setPurchaseError] = useState('');
  const [purchasing, setPurchasing] = useState(false);
  const [livePurchase, setLivePurchase] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const basePath = useMemo(
    () => `organizations/${DEMO_ORGANIZATION_ID}/offices/${DEMO_OFFICE_ID}`,
    []
  );

  useEffect(() => {
    if (!shouldShowLogin) {
      setAuthChecking(false);
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoggedInUser(user || null);

      if (user) {
        await resolveCustomerForLoggedInUser(user);
      }

      setAuthChecking(false);
    });

    return () => unsubscribe();
  }, [shouldShowLogin, basePath]);

  useEffect(() => {
    let unsubscribeProducts = null;
    let unsubscribeCustomer = null;
    let unsubscribeTransactions = null;
    let mounted = true;

    // Firestore rules require request.auth.
    // Do not read any customer app data until Firebase Auth has fully resolved
    // and a logged-in user is available.
    if (authChecking || !loggedInUser || loginResolving) {
      setLoading(true);
      return () => {
        mounted = false;
      };
    }

    async function loadInitialData() {
      try {
        setLoading(true);
        setErrorMessage('');

        const officeRef = doc(db, `organizations/${DEMO_ORGANIZATION_ID}/offices/${DEMO_OFFICE_ID}`);
        let officeSnap;

        try {
          officeSnap = await getDoc(officeRef);
        } catch (error) {
          console.error('office read failed', error);
          throw new Error(`事業所データの読み込みに失敗しました: ${error.message}`);
        }

        if (!mounted) return;

        if (!officeSnap.exists()) {
          throw new Error('事業所データが見つかりません。');
        }

        setOffice({
          id: officeSnap.id,
          ...officeSnap.data(),
        });

        const customerRef = doc(db, `${basePath}/customers/${resolvedCustomerId}`);

        unsubscribeCustomer = onSnapshot(
          customerRef,
          (snapshot) => {
            if (!snapshot.exists()) {
              setErrorMessage('利用者データが見つかりません。');
              setLoading(false);
              return;
            }

            setCustomer({
              id: snapshot.id,
              ...snapshot.data(),
            });
          },
          (error) => {
            console.error('customer read failed', error);
            setErrorMessage(`利用者データの読み込みに失敗しました: ${error.message}`);
            setLoading(false);
          }
        );


        const currentUid = auth.currentUser?.uid;

        if (currentUid) {
          const transactionsQuery = query(
            collection(db, `${basePath}/transactions`),
            where('customerAuthUid', '==', currentUid),
            limit(50)
          );

          unsubscribeTransactions = onSnapshot(
            transactionsQuery,
            (snapshot) => {
              const nextTransactions = snapshot.docs
                .map((transactionDoc) => ({
                  id: transactionDoc.id,
                  ...transactionDoc.data(),
                }))
                .filter((transaction) => transaction.customerId === resolvedCustomerId)
                .sort((a, b) => {
                  const dateA = toDate(a.createdAt)?.getTime() || 0;
                  const dateB = toDate(b.createdAt)?.getTime() || 0;
                  return dateB - dateA;
                });

              setTransactions(nextTransactions);
            },
            (error) => {
              console.error('transactions read failed', error);
              setErrorMessage(`履歴データの読み込みに失敗しました: ${error.message}`);
            }
          );
        } else {
          setTransactions([]);
        }

        const productsQuery = query(
          collection(db, `${basePath}/products`)
        );

        unsubscribeProducts = onSnapshot(
          productsQuery,
          (snapshot) => {
            const nextProducts = snapshot.docs
              .map((productDoc) => ({
                id: productDoc.id,
                ...productDoc.data(),
              }))
              .filter((product) => product.isActive !== false)
              .sort((a, b) => {
                const sortA = Number(a.sortOrder || 0);
                const sortB = Number(b.sortOrder || 0);
                return sortA - sortB;
              });

            setProducts(nextProducts);
            setLoading(false);
          },
          (error) => {
            console.error('products read failed', error);
            setErrorMessage(`商品データの読み込みに失敗しました: ${error.message}`);
            setLoading(false);
          }
        );
      } catch (error) {
        console.error(error);
        if (!mounted) return;
        setErrorMessage(error.message || 'データの読み込みに失敗しました。');
        setLoading(false);
      }
    }

    loadInitialData();

    return () => {
      mounted = false;
      if (unsubscribeProducts) {
        unsubscribeProducts();
      }
      if (unsubscribeCustomer) {
        unsubscribeCustomer();
      }
      if (unsubscribeTransactions) {
        unsubscribeTransactions();
      }
    };
  }, [basePath, resolvedCustomerId, authChecking, loggedInUser, loginResolving]);

  const paymentMode = customer?.paymentModeOverride || office?.paymentMode || 'prepaid';
  const isPostpaid = paymentMode === 'postpaid';
  const isCustomerInactive = customer?.status === 'inactive';

  const handleOpenProduct = (product) => {
    setPurchaseError('');

    if (isCustomerInactive) {
      setPurchaseError('現在このアカウントは利用停止中です。スタッフに確認してください。');
      return;
    }

    setSelectedProduct(product);
  };

  const handlePurchase = async () => {
    if (!selectedProduct || purchasing) return;

    setPurchasing(true);
    setPurchaseError('');

    const product = selectedProduct;

    try {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        throw new Error('ログイン状態を確認できません。もう一度ログインしてください。');
      }

      const idToken = await currentUser.getIdToken();

      const response = await fetch(import.meta.env.VITE_CREATE_PURCHASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          organizationId: DEMO_ORGANIZATION_ID,
          officeId: DEMO_OFFICE_ID,
          customerId: resolvedCustomerId,
          productId: product.id,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        const errorCode = data?.error || 'purchase-failed';

        const messageMap = {
          'insufficient-balance': '残高が不足しています。',
          'customer-inactive': '現在このアカウントは利用停止中です。スタッフに確認してください。',
          'customer-auth-mismatch': 'ログイン中の電話番号と利用者情報が一致しません。',
          'product-inactive': 'この商品は現在利用できません。',
          'customer-not-found': '利用者データが見つかりません。',
          'product-not-found': '商品データが見つかりません。',
          'auth/missing-token': 'ログイン状態を確認できません。もう一度ログインしてください。',
        };

        throw new Error(messageMap[errorCode] || `購入処理に失敗しました。(${errorCode})`);
      }

      const purchase = data.purchase;

      setSelectedProduct(null);
      setLivePurchase({
        transactionId: purchase.transactionId,
        productName: purchase.productName,
        amount: purchase.amount,
        checkCode: purchase.checkCode,
        expiresAtMs: purchase.expiresAtMs,
      });
    } catch (error) {
      console.error(error);
      setPurchaseError(error.message || '購入処理に失敗しました。');
    } finally {
      setPurchasing(false);
    }
  };

  const resolveCustomerForLoggedInUser = async (user) => {
    const phoneNumber = normalizePhoneNumber(user?.phoneNumber);

    if (!phoneNumber) {
      setLoginResolveError('ログインした電話番号を取得できませんでした。');
      return;
    }

    try {
      setLoginResolving(true);
      setLoginResolveError('');

      // /u/{customerId} から開いた場合は、collection query を使わず
      // URL上の利用者ドキュメントを直接読む。
      // Firestore rules は resource.data.phone と request.auth.token.phone_number の一致で許可する。
      if (routeCustomerId) {
        const routeCustomerRef = doc(db, `${basePath}/customers/${routeCustomerId}`);
        const routeCustomerSnap = await getDoc(routeCustomerRef);

        if (!routeCustomerSnap.exists()) {
          setLoginResolveError('利用者データが見つかりません。スタッフに確認してください。');
          return;
        }

        const routeCustomer = routeCustomerSnap.data();
        const routeCustomerPhone = normalizePhoneNumber(routeCustomer.phone);

        if (routeCustomerPhone !== phoneNumber) {
          setLoginResolveError('ログインした電話番号と利用者情報の電話番号が一致しません。ログアウトして別の電話番号でログインしてください。');
          return;
        }

        await setDoc(
          routeCustomerRef,
          {
            authUid: user.uid,
            phone: phoneNumber,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        setResolvedCustomerId(routeCustomerId);
        return;
      }

      // /login から入った場合のみ検索で利用者を探す。
      const customersRef = collection(db, `${basePath}/customers`);

      const authUidQuery = query(
        customersRef,
        where('authUid', '==', user.uid)
      );

      const authUidSnapshot = await getDocs(authUidQuery);
      let matchedDoc = authUidSnapshot.docs[0] || null;

      if (!matchedDoc) {
        const phoneQuery = query(
          customersRef,
          where('phone', '==', phoneNumber)
        );

        const phoneSnapshot = await getDocs(phoneQuery);
        matchedDoc = phoneSnapshot.docs[0] || null;
      }

      if (!matchedDoc) {
        setLoginResolveError(`電話番号 ${phoneNumber} に紐づく利用者が見つかりません。スタッフに確認してください。`);
        return;
      }

      await setDoc(
        doc(db, `${basePath}/customers/${matchedDoc.id}`),
        {
          authUid: user.uid,
          phone: phoneNumber,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setResolvedCustomerId(matchedDoc.id);

      if (window.location.pathname === '/login') {
        window.history.replaceState({}, '', `/u/${encodeURIComponent(matchedDoc.id)}`);
      }
    } catch (error) {
      console.error(error);
      setLoginResolveError(error.message || '利用者の確認に失敗しました。');
    } finally {
      setLoginResolving(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setLoggedInUser(null);
    setResolvedCustomerId(routeCustomerId);
    window.location.href = '/login';
  };

  if (shouldShowLogin && authChecking) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-emerald-900 via-teal-900 to-slate-950 px-4 py-6 text-white">
        <div className="mx-auto max-w-md rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-100">
          <Loader2 className="mx-auto animate-spin text-slate-400" size={28} />
          <p className="mt-3 text-sm font-bold text-slate-500">
            ログイン状態を確認しています
          </p>
        </div>
      </main>
    );
  }

  if (shouldShowLogin && !loggedInUser) {
    return (
      <PhoneLogin
        resolving={loginResolving}
        resolveError={loginResolveError}
        onLoggedIn={async (user) => {
          setLoggedInUser(user);
          await resolveCustomerForLoggedInUser(user);
        }}
      />
    );
  }

  if (shouldShowLogin && loggedInUser && loginResolving) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-emerald-900 via-teal-900 to-slate-950 px-4 py-6 text-white">
        <div className="mx-auto max-w-md rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-100">
          <Loader2 className="mx-auto animate-spin text-slate-400" size={28} />
          <p className="mt-3 text-sm font-bold text-slate-500">
            利用者情報を確認しています
          </p>
        </div>
      </main>
    );
  }

  if (shouldShowLogin && loggedInUser && loginResolveError) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-emerald-900 via-teal-900 to-slate-950 px-4 py-6 text-white">
        <div className="mx-auto max-w-md rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-red-100">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-1 text-red-500" size={22} />
            <div className="flex-1">
              <p className="text-base font-black text-red-600">
                利用者確認エラー
              </p>
              <p className="mt-2 text-sm font-bold leading-6 text-emerald-100/85">
                {loginResolveError}
              </p>

              <button
                type="button"
                onClick={async () => {
                  await signOut(auth);
                  setLoggedInUser(null);
                  setLoginResolveError('');
                  setLoginResolving(false);
                  setCustomer(null);
                  setTransactions([]);
                  setResolvedCustomerId(routeCustomerId);
                  window.location.reload();
                }}
                className="mt-5 flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-black text-white"
              >
                ログアウトして別の電話番号でログイン
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-900 via-teal-900 to-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-md">
        <header className="mb-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">
                {APP_CONFIG.brandName}
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-white">
                {APP_CONFIG.appName}
              </h1>
              <p className="mt-2 text-sm font-bold leading-6 text-emerald-100/85">
                事業所で使える、わたしのお財布。
              </p>
            </div>

            {loggedInUser ? (
              <button
                type="button"
                onClick={handleLogout}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-100"
                aria-label="ログアウト"
              >
                <LogOut size={18} />
              </button>
            ) : null}
          </div>
        </header>

        {loading ? (
          <section className="rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-slate-100">
            <Loader2 className="mx-auto animate-spin text-slate-400" size={28} />
            <p className="mt-3 text-sm font-bold text-slate-500">
              データを読み込んでいます
            </p>
          </section>
        ) : errorMessage ? (
          <section className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-red-100">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-1 text-red-500" size={22} />
              <div>
                <p className="text-base font-black text-red-600">
                  読み込みエラー
                </p>
                <p className="mt-2 text-sm font-bold leading-6 text-emerald-100/85">
                  {errorMessage}
                </p>
              </div>
            </div>
          </section>
        ) : (
          <>
            <section className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
                  <Wallet size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400">
                    {isPostpaid ? '現在の請求額' : '現在の残高'}
                  </p>
                  <p className="text-3xl font-black text-slate-900">
                    {isPostpaid
                      ? formatYen(customer?.currentInvoiceAmount)
                      : formatYen(customer?.balance)}
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-bold text-slate-400">
                  利用者
                </p>
                <p className="mt-1 text-base font-black text-slate-800">
                  {customer?.name}
                </p>
                <p className="mt-1 text-xs font-bold text-slate-400">
                  {office?.displayName || office?.name}
                </p>
                <p className="mt-1 text-[11px] font-bold text-slate-300">
                  ID: {resolvedCustomerId}
                </p>
              </div>

              {isCustomerInactive ? (
                <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3">
                  <p className="text-sm font-black text-red-600">
                    現在利用停止中です
                  </p>
                  <p className="mt-1 text-xs font-bold leading-5 text-red-500">
                    商品を利用する場合は、スタッフに確認してください。
                  </p>
                </div>
              ) : null}
            </section>

            <section className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-black text-white">
                  商品を選ぶ
                </h2>
                <button
                  type="button"
                  onClick={() => setIsHistoryOpen(true)}
                  className="flex items-center gap-1 rounded-full bg-white px-3 py-2 text-xs font-bold text-slate-500 shadow-sm ring-1 ring-slate-100"
                >
                  <History size={14} />
                  履歴
                </button>
              </div>

              <div className="grid gap-3">
                {products.map((product) => {
                  const Icon = iconMap[product.icon] || Ticket;

                  return (
                    <motion.button
                      key={product.id}
                      whileTap={isCustomerInactive ? undefined : { scale: 0.98 }}
                      onClick={() => handleOpenProduct(product)}
                      disabled={isCustomerInactive}
                      className={`flex items-center justify-between rounded-[1.75rem] bg-white p-4 text-left shadow-sm ring-1 ring-slate-100 ${
                        isCustomerInactive ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                          <Icon size={22} />
                        </div>
                        <div>
                          <p className="text-base font-black text-slate-900">
                            {product.name}
                          </p>
                          <p className="text-sm font-black text-slate-900">
                            {formatYen(product.price)}
                          </p>
                        </div>
                      </div>

                      <span className={`rounded-full px-4 py-2 text-sm font-black ${
                        isCustomerInactive
                          ? 'bg-slate-200 text-slate-400'
                          : 'bg-slate-900 text-white'
                      }`}>
                        {isCustomerInactive ? '停止中' : '使う'}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>

      <HistoryModal
        isOpen={isHistoryOpen}
        transactions={transactions}
        onClose={() => setIsHistoryOpen(false)}
      />

      {!selectedProduct && purchaseError ? (
        <div className="fixed inset-x-4 bottom-4 z-30 mx-auto max-w-md rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-2xl">
          {purchaseError}
        </div>
      ) : null}

      <PurchaseConfirmModal
        product={selectedProduct}
        customer={customer}
        paymentMode={paymentMode}
        purchasing={purchasing}
        errorMessage={purchaseError}
        onClose={() => {
          if (!purchasing) {
            setSelectedProduct(null);
            setPurchaseError('');
          }
        }}
        onConfirm={handlePurchase}
      />

      <PurchaseLiveScreen
        purchase={livePurchase}
        onClose={() => setLivePurchase(null)}
      />
    </main>
  );
}
