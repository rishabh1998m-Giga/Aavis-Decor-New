import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useImageUpload = () => {
  const [uploading, setUploading] = useState(false);

  const uploadImage = async (file: File, productId: string): Promise<string | null> => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `${productId}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(fileName, file, { cacheControl: "3600", upsert: false });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("product-images").getPublicUrl(fileName);
      return data.publicUrl;
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
