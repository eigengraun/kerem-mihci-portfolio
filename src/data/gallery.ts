export interface GalleryItem {
  id: string;
  src: string;
  alt: {
    tr: string;
    en: string;
  };
  caption?: {
    tr: string;
    en: string;
  };
  year?: string;
  location?: string;
}

/**
 * PERSONAL GALLERY DATA ARCHITECTURE
 * Add personal photography items here by dropping files into public/assets/gallery/
 * and adding a corresponding GalleryItem object below.
 */
export const galleryItems: GalleryItem[] = [];
