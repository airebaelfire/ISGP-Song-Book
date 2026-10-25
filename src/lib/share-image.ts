import * as Sharing from 'expo-sharing';
import { RefObject } from 'react';
import { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

export async function shareViewAsImage(ref: RefObject<View | null>, _filename: string) {
  const uri = await captureRef(ref, { format: 'png', quality: 1 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'image/png' });
  }
}
