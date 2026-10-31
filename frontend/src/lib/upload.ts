/**
 * Reference-image upload.
 *
 * The browser reads the file, encodes it as a base64 data URL, and posts it
 * to the API. The API stores the bytes and returns an absolute URL, which is
 * then passed to the model as the reference image.
 *
 * A data URL is used instead of multipart so the backend needs no extra
 * dependency and no temporary file for the upload.
 */

import { readToken } from "./api";

const MAX_BYTES = 8 * 1024 * 1024;

const toDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });

export const uploadReference = async (file: File): Promise<string> => {
  if (file.size > MAX_BYTES) {
    throw new Error("That image is larger than 8 MB.");
  }
  const dataUrl = await toDataUrl(file);
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  const token = readToken();
  if (token) headers["authorization"] = `Bearer ${token}`;

  const response = await fetch("/api/studio/uploads", {
    method: "POST",
    headers,
    body: JSON.stringify({ dataUrl, filename: file.name }),
  });
  const text = await response.text();
  const payload = text.length > 0 ? JSON.parse(text) : null;
  if (!response.ok) {
    const body = (payload ?? {}) as { message?: string };
    throw new Error(body.message ?? `Upload failed with HTTP ${response.status}.`);
  }
  return (payload as { url: string }).url;
};
