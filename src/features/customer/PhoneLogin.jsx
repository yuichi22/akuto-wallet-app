import { useEffect, useRef, useState } from 'react';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from 'firebase/auth';
import { Loader2, Phone, ShieldCheck } from 'lucide-react';

import { auth } from '../../shared/api/firebase/client';

export default function PhoneLogin({ resolving = false, resolveError = '', onLoggedIn }) {
  const recaptchaRef = useRef(null);
  const verifierRef = useRef(null);

  const [phone, setPhone] = useState('+819012345678');
  const [code, setCode] = useState('123456');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    return () => {
      if (verifierRef.current) {
        verifierRef.current.clear();
        verifierRef.current = null;
      }
    };
  }, []);

  const setupRecaptcha = () => {
    if (verifierRef.current) {
      return verifierRef.current;
    }

    verifierRef.current = new RecaptchaVerifier(auth, recaptchaRef.current, {
      size: 'invisible',
    });

    return verifierRef.current;
  };

  const handleSendCode = async () => {
    try {
      setSending(true);
      setErrorMessage('');

      const verifier = setupRecaptcha();
      const result = await signInWithPhoneNumber(auth, phone, verifier);

      setConfirmationResult(result);
    } catch (error) {
      console.error(error);
      setErrorMessage(error.message || '確認コードの送信に失敗しました。');

      if (verifierRef.current) {
        verifierRef.current.clear();
        verifierRef.current = null;
      }
    } finally {
      setSending(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!confirmationResult) {
      setErrorMessage('先に確認コードを送信してください。');
      return;
    }

    try {
      setVerifying(true);
      setErrorMessage('');

      const credential = await confirmationResult.confirm(code);

      onLoggedIn?.(credential.user);
    } catch (error) {
      console.error(error);
      setErrorMessage(error.message || '確認コードの確認に失敗しました。');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-md">
        <header className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-slate-400">
            Akuto
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
            まいウォレット
          </h1>
          <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
            電話番号でログインします。
          </p>
        </header>

        <section className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <Phone size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400">
                Phone Login
              </p>
              <p className="text-xl font-black text-slate-900">
                電話番号ログイン
              </p>
            </div>
          </div>

          <div className="mt-5">
            <label className="mb-2 block text-xs font-black text-slate-400">
              電話番号
            </label>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="h-14 w-full rounded-2xl border-2 border-slate-100 px-4 text-base font-black outline-none focus:border-slate-900"
              placeholder="+819012345678"
              disabled={sending || verifying}
            />
            <p className="mt-2 text-xs font-bold leading-5 text-slate-400">
              日本番号は +81 形式で入力します。例：090-1234-5678 → +819012345678
            </p>
          </div>

          <button
            type="button"
            onClick={handleSendCode}
            disabled={sending || verifying}
            className="mt-4 flex h-14 w-full items-center justify-center rounded-2xl bg-slate-900 text-sm font-black text-white disabled:opacity-60"
          >
            {sending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="animate-spin" size={18} />
                送信中
              </span>
            ) : (
              '確認コードを送信'
            )}
          </button>

          <div className="mt-6">
            <label className="mb-2 block text-xs font-black text-slate-400">
              確認コード
            </label>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="h-14 w-full rounded-2xl border-2 border-slate-100 px-4 text-center text-2xl font-black tracking-[0.35em] outline-none focus:border-slate-900"
              placeholder="123456"
              disabled={sending || verifying}
            />
          </div>

          <button
            type="button"
            onClick={handleVerifyCode}
            disabled={sending || verifying || !confirmationResult}
            className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-sm font-black text-white disabled:opacity-60"
          >
            {verifying ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                確認中
              </>
            ) : (
              <>
                <ShieldCheck size={18} />
                ログイン
              </>
            )}
          </button>

          {resolving ? (
            <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold leading-6 text-slate-500">
              利用者情報を確認しています。
            </div>
          ) : null}

          {resolveError ? (
            <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold leading-6 text-red-600">
              {resolveError}
            </div>
          ) : null}

          {errorMessage ? (
            <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold leading-6 text-red-600">
              {errorMessage}
            </div>
          ) : null}

          <div ref={recaptchaRef} />
        </section>
      </div>
    </main>
  );
}
