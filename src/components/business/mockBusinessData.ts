export interface BusinessData {
  business_name: string;
  business_category: string;
  logo_url: string;
  cover_image_url: string;
  is_verified: boolean;
  phone: string;
  email: string;
  website: string;
  full_address: string;
  opening_hours: {
    [key: string]: { open: string; close: string } | { closed: true };
  };
  social_links: {
    instagram?: string;
    facebook?: string;
    tiktok?: string;
  };
  promo_title: string;
  promo_description: string;
  promo_code: string;
  promo_expires_at: string;
  booking_url: string;
  images: { url: string; caption: string }[];
  rating: number;
  reviews_count: number;
}

export const MOCK_BUSINESS_DATA: BusinessData = {
  business_name: "Stołówka Gdańska",
  business_category: "Restauracja",
  logo_url: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=100&h=100&fit=crop",
  cover_image_url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=300&fit=crop",
  is_verified: true,
  
  phone: "+48 58 123 45 67",
  email: "kontakt@stolowkagdanska.pl",
  website: "https://stolowkagdanska.pl",
  full_address: "ul. Długa 45, 80-831 Gdańsk",
  
  opening_hours: {
    mon: { open: "11:00", close: "22:00" },
    tue: { open: "11:00", close: "22:00" },
    wed: { open: "11:00", close: "22:00" },
    thu: { open: "11:00", close: "22:00" },
    fri: { open: "11:00", close: "23:00" },
    sat: { open: "12:00", close: "23:00" },
    sun: { closed: true }
  },
  
  social_links: {
    instagram: "https://instagram.com/stolowkagdanska",
    facebook: "https://facebook.com/stolowkagdanska",
    tiktok: "https://tiktok.com/@stolowkagdanska"
  },
  
  promo_title: "-20% na lunch w dni powszednie",
  promo_description: "Przy zamówieniu dania dnia otrzymasz rabat 20%",
  promo_code: "TRASA20",
  promo_expires_at: "2026-02-28",
  
  booking_url: "https://stolowkagdanska.pl/rezerwacja",
  
  images: [
    { url: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400", caption: "Wnętrze restauracji" },
    { url: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400", caption: "Danie dnia" },
    { url: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400", caption: "Bar" },
    { url: "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=400", caption: "Taras" }
  ],
  
  rating: 4.6,
  reviews_count: 127
};

// ID of the pin we'll use for testing premium view (Stołówka Gdańska)
export const MOCK_PREMIUM_PIN_ID = "fe266c93-57dc-436b-a37a-2b02b4fa2016";
