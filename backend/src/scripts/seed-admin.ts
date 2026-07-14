/**
 * Seed script — creates the initial admin account if none exists.
 *
 * Usage:
 *   CMS_ADMIN_USERNAME=admin CMS_ADMIN_PASSWORD=admin123 npx ts-node -r tsconfig-paths/register src/scripts/seed-admin.ts
 *
 * Environment variables:
 *   MONGODB_URL           — MongoDB connection string
 *   CMS_ADMIN_USERNAME    — admin display name  (default: 'admin')
 *   CMS_ADMIN_PASSWORD    — admin password       (default: 'admin123')
 *   ALL_ORC_SERVICE_URL   — orchestration service URL (for virtualId generation)
 *   JOSE_SECRET           — needed to decrypt the token and extract virtualId
 *   JWT_SIGNIN_PRIVATE_KEY — needed to verify the signed JWT inside the token
 */

import * as mongoose from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import * as jose from 'jose';
import axios from 'axios';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

const CmsUserSchema = new mongoose.Schema(
  {
    virtualId: { type: Number, required: true, unique: true, index: true },
    username: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    email: { type: String, required: false },
    role: { type: String, enum: ['admin', 'curator'], default: 'curator' },
    isActive: { type: Boolean, default: true },
  },
  { collection: 'cms_users', timestamps: true },
);

/**
 * Call orchestration generateVirtualID with the CMS username.
 * This registers the username and returns a JWE token containing the virtualId.
 */
async function getVirtualIdFromOrchestration(cmsUsername: string): Promise<number> {
  const orcUrl = process.env.ALL_ORC_SERVICE_URL;
  if (!orcUrl) {
    throw new Error('ALL_ORC_SERVICE_URL is not set');
  }
  const orcBaseUrl = orcUrl.replace(/\/tokenStatus$/, '');
  const orcResponse = await axios.post(
    `${orcBaseUrl}/generateVirtualID?username=${encodeURIComponent(cmsUsername)}`,
  );
  const token = orcResponse.data?.result?.token;
  if (!token) {
    throw new Error('Orchestration did not return a token');
  }

  // Decrypt the JWE token to extract the virtualId
  const hash = createHash('sha256').update(process.env.JOSE_SECRET || '').digest();
  const decrypted = await jose.jwtDecrypt(token, hash as any);
  const signedJwt = String(decrypted.payload.jwtSignedToken);
  const jwtKey = new TextEncoder().encode(process.env.JWT_SIGNIN_PRIVATE_KEY);
  const verified = await jose.jwtVerify(signedJwt, jwtKey);

  return verified.payload.virtual_id as number;
}

async function main() {
  const mongoUrl = process.env.MONGODB_URL;
  if (!mongoUrl) {
    console.error('✗ MONGODB_URL environment variable is required');
    process.exit(1);
  }

  const username = process.env.CMS_ADMIN_USERNAME || 'admin';
  const password = process.env.CMS_ADMIN_PASSWORD || 'admin123';

  await mongoose.connect(mongoUrl);
  console.log('✓ Connected to MongoDB');

  const CmsUser = mongoose.model('CmsUser', CmsUserSchema);

  const existing = await CmsUser.findOne({ username }).lean();
  if (existing) {
    console.log(`✓ Admin account already exists: username='${(existing as any).username}', virtualId=${(existing as any).virtualId}`);
    await mongoose.disconnect();
    return;
  }

  // Get virtualId from orchestration service
  console.log(`  Registering '${username}' in orchestration service...`);
  let virtualId: number;
  try {
    virtualId = await getVirtualIdFromOrchestration(username);
    console.log(`✓ Got virtualId ${virtualId} from orchestration`);
  } catch (err: any) {
    console.error(`✗ Failed to get virtualId from orchestration: ${err?.message}`);
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  await CmsUser.create({
    virtualId,
    username,
    password: hashedPassword,
    role: 'admin',
    isActive: true,
  });

  console.log(`✓ Admin account created: username='${username}', virtualId=${virtualId}`);

  await mongoose.disconnect();
  console.log('✓ Done');
}

main().catch((err) => {
  console.error('✗ Seed failed:', err);
  process.exit(1);
});
