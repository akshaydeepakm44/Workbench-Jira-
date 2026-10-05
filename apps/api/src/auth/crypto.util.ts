import * as crypto from 'crypto';

function getKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret || 'workdesk-aes-256-key-default-32').digest();
}

export function encryptToken(text: string, keyString: string): string {
  try {
    const iv = crypto.randomBytes(12);
    const key = getKey(keyString);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${tag}:${encrypted}`;
  } catch (err) {
    console.error('Token encryption error:', err);
    return text;
  }
}

export function decryptToken(encryptedText: string, keyString: string): string {
  try {
    const [ivHex, tagHex, contentHex] = encryptedText.split(':');
    if (!ivHex || !tagHex || !contentHex) return encryptedText;
    const key = getKey(keyString);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    let decrypted = decipher.update(contentHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Token decryption error:', err);
    return encryptedText;
  }
}
