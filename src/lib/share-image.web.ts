import html2canvas from 'html2canvas';
import { RefObject } from 'react';
import { View } from 'react-native';

export async function shareViewAsImage(ref: RefObject<View | null>, filename: string) {
  const node = ref.current as unknown as HTMLElement | null;
  if (!node) return;

  const canvas = await html2canvas(node);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return;

  const file = new File([blob], filename, { type: 'image/png' });

  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: filename });
    return;
  }

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
