import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'akuto-wallet-dev';

initializeApp({
  credential: applicationDefault(),
  projectId,
});

const db = getFirestore();

const organizationId = 'org_demo';
const officeId = 'office_demo';
const basePath = `organizations/${organizationId}/offices/${officeId}`;

async function main() {
  const transactionsSnap = await db.collection(`${basePath}/transactions`).get();

  let updated = 0;
  let skipped = 0;

  for (const txDoc of transactionsSnap.docs) {
    const tx = txDoc.data();

    if (tx.customerAuthUid) {
      skipped += 1;
      continue;
    }

    if (!tx.customerId) {
      skipped += 1;
      continue;
    }

    const customerSnap = await db.doc(`${basePath}/customers/${tx.customerId}`).get();

    if (!customerSnap.exists) {
      skipped += 1;
      continue;
    }

    const customer = customerSnap.data();

    if (!customer.authUid) {
      skipped += 1;
      continue;
    }

    await txDoc.ref.set(
      {
        customerAuthUid: customer.authUid,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    updated += 1;
    console.log(`updated ${txDoc.id} customerAuthUid=${customer.authUid}`);
  }

  console.log('');
  console.log('Backfill completed.');
  console.log(`projectId: ${projectId}`);
  console.log(`updated: ${updated}`);
  console.log(`skipped: ${skipped}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
