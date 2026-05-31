import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

initializeApp();

const REGION = 'asia-northeast1';

const db = getFirestore();
const auth = getAuth();

const DEMO_ORGANIZATION_ID = 'org_demo';
const DEMO_OFFICE_ID = 'office_demo';

const sendJson = (res, status, payload) => {
  res.status(status).json(payload);
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

const verifyBearerToken = async (req) => {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer (.+)$/);

  if (!match) {
    throw new Error('auth/missing-token');
  }

  return auth.verifyIdToken(match[1]);
};

export const health = onRequest({ region: REGION, cors: true }, async (req, res) => {
  sendJson(res, 200, {
    ok: true,
    service: 'akuto-wallet',
    message: 'Akuto Wallet Functions are running.',
  });
});

export const createPurchase = onRequest({ region: REGION, cors: true }, async (req, res) => {
  try {
    if (req.method !== 'POST') {
      return sendJson(res, 405, {
        ok: false,
        error: 'method-not-allowed',
      });
    }

    const decodedToken = await verifyBearerToken(req);
    const uid = decodedToken.uid;

    const {
      organizationId = DEMO_ORGANIZATION_ID,
      officeId = DEMO_OFFICE_ID,
      customerId,
      productId,
    } = req.body || {};

    if (organizationId !== DEMO_ORGANIZATION_ID || officeId !== DEMO_OFFICE_ID) {
      return sendJson(res, 403, {
        ok: false,
        error: 'office-not-allowed',
      });
    }

    if (!customerId || !productId) {
      return sendJson(res, 400, {
        ok: false,
        error: 'missing-params',
      });
    }

    const basePath = `organizations/${organizationId}/offices/${officeId}`;
    const officeRef = db.doc(`organizations/${organizationId}/offices/${officeId}`);
    const settingsRef = db.doc(`${basePath}/settings/basic`);
    const customerRef = db.doc(`${basePath}/customers/${customerId}`);
    const productRef = db.doc(`${basePath}/products/${productId}`);

    const transactionId = makeTransactionId();
    const transactionRef = db.doc(`${basePath}/transactions/${transactionId}`);

    const checkCode = makeCheckCode();
    const visualCheckSeconds = 30;
    const expiresAtMs = Date.now() + visualCheckSeconds * 1000;

    const result = await db.runTransaction(async (transaction) => {
      const [officeSnap, settingsSnap, customerSnap, productSnap] = await Promise.all([
        transaction.get(officeRef),
        transaction.get(settingsRef),
        transaction.get(customerRef),
        transaction.get(productRef),
      ]);

      if (!officeSnap.exists) {
        throw new Error('office-not-found');
      }

      if (!customerSnap.exists) {
        throw new Error('customer-not-found');
      }

      if (!productSnap.exists) {
        throw new Error('product-not-found');
      }

      const office = officeSnap.data() || {};
      const settings = settingsSnap.exists ? settingsSnap.data() || {} : {};
      const customer = customerSnap.data() || {};
      const product = productSnap.data() || {};

      if (customer.status === 'inactive') {
        throw new Error('customer-inactive');
      }

      if (customer.authUid !== uid) {
        throw new Error('customer-auth-mismatch');
      }

      if (product.isActive === false || product.status === 'inactive') {
        throw new Error('product-inactive');
      }

      const amount = Math.max(Math.round(Number(product.price || 0)), 0);
      const paymentMode = customer.paymentModeOverride || settings.paymentMode || office.paymentMode || 'prepaid';

      const currentBalance = Number(customer.balance || 0);
      const currentInvoiceAmount = Number(customer.currentInvoiceAmount || 0);

      if (paymentMode === 'prepaid' && currentBalance < amount) {
        throw new Error('insufficient-balance');
      }

      const balanceAfter = paymentMode === 'prepaid'
        ? currentBalance - amount
        : currentBalance;

      const invoiceAfter = paymentMode === 'postpaid'
        ? currentInvoiceAmount + amount
        : currentInvoiceAmount;

      transaction.update(customerRef, {
        balance: balanceAfter,
        currentInvoiceAmount: invoiceAfter,
        updatedAt: FieldValue.serverTimestamp(),
      });

      transaction.set(transactionRef, {
        customerId,
        customerName: customer.name || '',
        productId,
        productName: product.name || '',
        amount,
        type: 'purchase',
        paymentMode,
        balanceAfter,
        invoiceAfter,
        createdByUid: uid,
        customerAuthUid: uid,
        visualCheck: {
          code: checkCode,
          seconds: visualCheckSeconds,
          expiresAtMs,
          status: 'shown',
        },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      return {
        transactionId,
        productName: product.name || '',
        amount,
        paymentMode,
        balanceAfter,
        invoiceAfter,
        checkCode,
        expiresAtMs,
      };
    });

    return sendJson(res, 200, {
      ok: true,
      purchase: result,
    });
  } catch (error) {
    console.error(error);

    const message = error?.message || 'internal-error';

    const status = {
      'auth/missing-token': 401,
      'office-not-allowed': 403,
      'customer-auth-mismatch': 403,
      'customer-inactive': 403,
      'product-inactive': 400,
      'customer-not-found': 404,
      'product-not-found': 404,
      'office-not-found': 404,
      'insufficient-balance': 400,
      'missing-params': 400,
    }[message] || 500;

    return sendJson(res, status, {
      ok: false,
      error: message,
    });
  }
});
