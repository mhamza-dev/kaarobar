import * as ImagePicker from "expo-image-picker";

export type PickedImage = {
  uri: string;
  fileName?: string | null;
  type?: string | null;
};

/** Pick an image from the device library (expo-image-picker). */
export async function pickImageFromLibrary(): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.8,
    allowsMultipleSelection: false,
  });
  if (res.canceled || !res.assets?.[0]?.uri) return null;

  const asset = res.assets[0];
  return {
    uri: asset.uri,
    fileName: asset.fileName,
    type: asset.mimeType,
  };
}
