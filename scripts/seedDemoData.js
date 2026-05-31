import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'akuto-wallet-dev';

initializeApp({
  credential: applicationDefault(),
  projectId,
});

const db = getFirestore();

const organizationId = 'org_demo';
const officeId = 'office_demo';
const customerId = 'customer_tanaka';

const now = FieldValue.serverTimestamp();

async function setDoc(path, data) {
  await db.doc(path).set(
    {
      ...data,
      updatedAt: now,
    },
    { merge: true }
  );
  console.log(`set ${path}`);
}

async function main() {
  await setDoc(`organizations/${organizationId}`, {
    name: 'デモ法人',
    displayName: 'デモ法人',
    status: 'active',
    planId: 'trial',
    createdAt: now,
  });

  await setDoc(`organizations/${organizationId}/offices/${officeId}`, {
    name: 'デモ事業所',
    displayName: 'デモ事業所',
    status: 'active',
    paymentMode: 'prepaid',
    createdAt: now,
  });

  await setDoc(`organizations/${organizationId}/offices/${officeId}/settings/basic`, {
    paymentMode: 'prepaid',
    allowCustomerPaymentModeOverride: true,
    requireStaffVisualCheck: true,
    visualCheckSeconds: 30,
    currency: 'jpy',
    createdAt: now,
  });

  await setDoc(`organizations/${organizationId}/offices/${officeId}/customers/${customerId}`, {
    name: '田中 太郎',
    kana: 'たなか たろう',
    phone: '+819012345678',
    status: 'active',
    paymentModeOverride: null,
    balance: 3000,
    currentInvoiceAmount: 0,
    createdAt: now,
  });

  const products = [
    {
      id: 'product_lunch',
      name: '昼食',
      price: 500,
      category: '食事',
      icon: 'utensils',
      sortOrder: 10,
    },
    {
      id: 'product_drink',
      name: 'ドリンク',
      price: 120,
      category: '飲料',
      icon: 'coffee',
      sortOrder: 20,
    },
    {
      id: 'product_event',
      name: 'イベント参加費',
      price: 1000,
      category: 'イベント',
      icon: 'ticket',
      sortOrder: 30,
    },
  ];

  for (const product of products) {
    const { id, ...data } = product;
    await setDoc(`organizations/${organizationId}/offices/${officeId}/products/${id}`, {
      ...data,
      status: 'active',
      isActive: true,
      createdAt: now,
    });
  }

  await setDoc(`organizations/${organizationId}/offices/${officeId}/transactions/demo_initial_charge`, {
    customerId,
    customerName: '田中 太郎',
    type: 'charge',
    amount: 3000,
    balanceAfter: 3000,
    note: '初期デモチャージ',
    createdAt: now,
  });

  console.log('');
  console.log('Seed completed.');
  console.log(`projectId: ${projectId}`);
  console.log(`organizationId: ${organizationId}`);
  console.log(`officeId: ${officeId}`);
  console.log(`customerId: ${customerId}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
