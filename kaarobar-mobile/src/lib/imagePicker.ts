import { launchImageLibrary, type Asset } from "react-native-image-picker";

export type PickedImage = {
  uri: string;
  fileName?: string | null;
  type?: string | null;
};

/** Pick an image from the device library (react-native-image-picker). */
export async function pickImageFromLibrary(): Promise<PickedImage | null> {
  const res = await launchImageLibrary({
    mediaType: "photo",
    quality: 0.8,
    selectionLimit: 1,
  });
  if (res.didCancel || !res.assets?.[0]?.uri) return null;
  const asset: Asset = res.assets[0];
  return {
    uri: asset.uri!,
    fileName: asset.fileName,
    type: asset.type,
  };
}
