export async function getJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const json = await response.json();
  if (!response.ok) {
    const detail = json.detail;
    throw new Error(typeof detail === 'string' ? detail : Array.isArray(detail) ? detail[0]?.msg ?? 'Input tidak valid.' : 'Permintaan gagal.');
  }
  return json as T;
}

export function tokenCount(text: string) {
  return text.toLowerCase().trim().replace(/([.,!?])/g, ' $1 ').split(/\s+/).filter(Boolean).length;
}

export async function copyText(text: string) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  const input = document.createElement('textarea');
  input.value = text; input.style.position = 'fixed'; input.style.opacity = '0';
  document.body.append(input); input.select();
  const success = document.execCommand('copy'); input.remove();
  if (!success) throw new Error('Salin teks secara manual.');
}
