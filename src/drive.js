// Minimal Google Drive client for the photo library, using a service account.
// Set GOOGLE_SERVICE_ACCOUNT_JSON to the full JSON key (a GitHub secret).
import { GoogleAuth } from 'google-auth-library';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const SHARED = 'supportsAllDrives=true&includeItemsFromAllDrives=true';
export const FOLDER = 'application/vnd.google-apps.folder';

let authClient;
export const driveConfigured = () => Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

async function token() {
  if (!authClient) {
    const auth = new GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    authClient = await auth.getClient();
  }
  return (await authClient.getAccessToken()).token;
}

async function call(url, init = {}) {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${await token()}`, ...(init.headers || {}) } });
  if (!res.ok) throw new Error(`Drive ${init.method || 'GET'} failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return res;
}

const q = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

export async function listChildren(folderId, { foldersOnly = false } = {}) {
  const out = [];
  let pageToken = '';
  const query = `'${folderId}' in parents and trashed = false${foldersOnly ? ` and mimeType = '${FOLDER}'` : ''}`;
  const fields = 'nextPageToken,files(id,name,mimeType,description,modifiedTime,imageMediaMetadata(width,height))';
  do {
    const url = `${API}/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&pageSize=1000&${SHARED}${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const data = await (await call(url)).json();
    out.push(...data.files);
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return out;
}

export async function findChild(folderId, name) {
  const query = `'${folderId}' in parents and name = '${q(name)}' and trashed = false`;
  const url = `${API}/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType)&${SHARED}`;
  return (await (await call(url)).json()).files[0] || null;
}

export async function ensureFolder(parentId, name) {
  const existing = await findChild(parentId, name);
  if (existing) return existing.id;
  const res = await call(`${API}/files?${SHARED}&fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER, parents: [parentId] }),
  });
  return (await res.json()).id;
}

// Walk a slash-separated path from a root folder, creating folders as needed.
export async function ensurePath(rootId, path) {
  let id = rootId;
  for (const part of path.split('/').filter(Boolean)) id = await ensureFolder(id, part);
  return id;
}

export async function download(fileId) {
  return Buffer.from(await (await call(`${API}/files/${fileId}?alt=media&supportsAllDrives=true`)).arrayBuffer());
}

// Create a file, or replace the contents of an existing one with the same name.
export async function upsertFile(parentId, name, buffer, mimeType) {
  const existing = await findChild(parentId, name);
  if (existing) {
    await call(`${UPLOAD}/files/${existing.id}?uploadType=media&supportsAllDrives=true`, {
      method: 'PATCH', headers: { 'Content-Type': mimeType }, body: buffer,
    });
    return existing.id;
  }
  const boundary = 'oldlions' + Date.now();
  const meta = JSON.stringify({ name, parents: [parentId] });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    buffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const res = await call(`${UPLOAD}/files?uploadType=multipart&${SHARED}&fields=id`, {
    method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body,
  });
  return (await res.json()).id;
}

export async function readJson(parentId, name) {
  const f = await findChild(parentId, name);
  return f ? JSON.parse((await download(f.id)).toString('utf8')) : null;
}

export const writeJson = (parentId, name, data) =>
  upsertFile(parentId, name, Buffer.from(JSON.stringify(data, null, 2)), 'application/json');

// Export a Google Docs/Sheets file, e.g. a Sheet as text/csv.
export async function exportFile(fileId, mimeType) {
  return Buffer.from(await (await call(`${API}/files/${fileId}/export?mimeType=${encodeURIComponent(mimeType)}`)).arrayBuffer());
}
