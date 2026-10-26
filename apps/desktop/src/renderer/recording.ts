export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const size = 0x8000;
  for (let index = 0; index < bytes.length; index += size) {
    const slice = bytes.subarray(index, index + size);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export function extensionFor(blob: Blob): string {
  if (blob.type.includes('mp4')) {
    return '.mp4';
  }
  if (blob.type.includes('ogg')) {
    return '.ogg';
  }
  return '.webm';
}
