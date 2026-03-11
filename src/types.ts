export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  images: string[];
  sku: string;
  is_sale?: boolean;
  old_price?: number;
  views: number;
  radius?: string;
  created_at: string;
}

export interface Stats {
  totalVisits: number;
  totalViews: number;
  mostViewed: { id: number; name: string; views: number; sku?: string }[];
  onlineUsers: number;
  clicks?: { [key: string]: number };
}

export interface Review {
  id: number;
  user_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

export interface Ad {
  id: number;
  title: string;
  description: string;
  price: number;
  phone: string;
  images: string[];
  is_placeholder: boolean;
  product_id?: number;
  created_at: string;
}

export interface SiteSettings {
  id: string;
  banner_url?: string;
  catalog_header_image?: string;
  ads_header_image?: string;
  maintenance_mode?: boolean;
  updated_at: string;
}
