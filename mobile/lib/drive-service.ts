const DRIVE_BASE = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";

export interface DriveFile {
  id: string; name: string; mimeType: string;
  modifiedTime: string; size?: string; webViewLink?: string;
}

function driveHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, Accept: "application/json" };
}

export async function listDriveFiles(
  token: string, folderId?: string, pageToken?: string,
): Promise<{ files: DriveFile[]; nextPageToken?: string }> {
  const parts = ["trashed=false"];
  if (folderId) parts.push(`'${folderId}' in parents`);
  const q = encodeURIComponent(parts.join(" and "));
  const fields = encodeURIComponent("nextPageToken,files(id,name,mimeType,modifiedTime,size,webViewLink)");
  const pt = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
  const url = `${DRIVE_BASE}/files?q=${q}&fields=${fields}&orderBy=modifiedTime%20desc&pageSize=50${pt}`;
  const res = await fetch(url, { headers: driveHeaders(token) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
    throw new Error(err?.error?.message ?? `Erro Drive: HTTP ${res.status}`);
  }
  return res.json();
}

export async function uploadDriveFile(
  token: string, fileName: string, content: string, mimeType = "text/plain", folderId?: string,
): Promise<DriveFile> {
  const metadata: Record<string, unknown> = { name: fileName, mimeType };
  if (folderId) metadata.parents = [folderId];
  const blob = new Blob([content], { type: mimeType });
  const body = new FormData();
  body.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  body.append("file", blob);
  const res = await fetch(`${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime,webViewLink`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
    throw new Error(err?.error?.message ?? `Falha no upload: HTTP ${res.status}`);
  }
  return res.json();
}

export async function downloadDriveFile(token: string, fileId: string): Promise<string> {
  const res = await fetch(`${DRIVE_BASE}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Erro ao baixar arquivo: HTTP ${res.status}`);
  return res.text();
}

export async function deleteDriveFile(token: string, fileId: string): Promise<void> {
  const res = await fetch(`${DRIVE_BASE}/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 204) throw new Error(`Erro ao excluir: HTTP ${res.status}`);
}

export async function createDriveFolder(token: string, name: string, parentId?: string): Promise<DriveFile> {
  const metadata: Record<string, unknown> = { name, mimeType: "application/vnd.google-apps.folder" };
  if (parentId) metadata.parents = [parentId];
  const res = await fetch(`${DRIVE_BASE}/files?fields=id,name,mimeType,modifiedTime`, {
    method: "POST",
    headers: { ...driveHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  });
  if (!res.ok) throw new Error(`Erro ao criar pasta: HTTP ${res.status}`);
  return res.json();
}

export async function backupToNeonText(data: unknown[], tableName: string): Promise<string> {
  return JSON.stringify({ table: tableName, exportedAt: new Date().toISOString(), rows: data }, null, 2);
}
