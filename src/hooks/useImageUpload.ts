import { useState } from "react";
import { apiUpload } from "@/lib/api";

export const useImageUpload = () => {
  const [uploading, setUploading] = useState(false);

  const uploadImage = async (file: File, productId: string): Promise<string | null> => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const sp = new URLSearchParams({ productId });
      const { url } = await apiUpload(`/api/admin/upload?${sp.toString()}`, form);
      return url;
    } catch (error) {
      console.error("Upload failed:", error);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const uploadMultiple = async (files: File[], productId: string): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of files) {
      const url = await uploadImage(file, productId);
      if (url) urls.push(url);
    }
    return urls;
  };

  return { uploadImage, uploadMultiple, uploading };
};
