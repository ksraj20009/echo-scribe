import crypto from 'crypto';

const MASTER_KEY = process.env.MASTER_KEY || '';
if (!MASTER_KEY) {
  console.warn('MASTER_KEY not set — encryption will not be secure. Set MASTER_KEY in environment.');
}

function getKey() {
  // Derive a 32 byte key from MASTER_KEY using SHA256
  return crypto.createHash('sha256').update(MASTER_KEY).digest();
}

export function encrypt(text: string) {
  const iv = crypto.randomBytes(12);
  const key = getKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decrypt(blob: string) {
  const data = Buffer.from(blob, 'base64');
  const iv = data.slice(0, 12);
  const tag = data.slice(12, 28);
  const encrypted = data.slice(28);
  const key = getKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
