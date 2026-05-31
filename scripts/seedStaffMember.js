import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'akuto-wallet-dev';
const phoneNumber = process.env.STAFF_PHONE || '+819012345678';

initializeApp({
  credential: applicationDefault(),
  projectId,
});

const db = getFirestore();
const auth = getAuth();

const organizationId = 'org_demo';
const officeId = 'office_demo';

async function main() {
  const user = await auth.getUserByPhoneNumber(phoneNumber);
  const uid = user.uid;

  const staffRef = db.doc(
    `organizations/${organizationId}/offices/${officeId}/staffMembers/${uid}`
  );

  await staffRef.set(
    {
      uid,
      phoneNumber,
      role: 'owner',
      status: 'active',
      displayName: 'デモ管理者',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log('Staff member seeded.');
  console.log(`projectId: ${projectId}`);
  console.log(`phoneNumber: ${phoneNumber}`);
  console.log(`uid: ${uid}`);
  console.log(`path: organizations/${organizationId}/offices/${officeId}/staffMembers/${uid}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
