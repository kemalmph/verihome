export interface PropertyMedia {
  id: string;
  property_id: string;
  photos_exterior: string[];
  photos_common_area: string[];
  photos_unit: string[];
  photos_bathroom: string[];
  total_photo_count: number;
  video_url: string | null;
  media_status: "pending" | "uploaded" | "approved";
  uploaded_at: string | null;
  survey_id: string | null;
}

export type PhotoCategory = "exterior" | "common_area" | "unit" | "bathroom";

export interface UploadResult {
  success: boolean;
  url: string;
  category: PhotoCategory;
  totalCount: number;
}

export interface CompressionResult {
  original: File;
  compressed: File;
  originalSize: number;
  compressedSize: number;
  ratio: number;
}
