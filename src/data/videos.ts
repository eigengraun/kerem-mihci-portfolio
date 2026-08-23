export type VideoType = "ai-reel" | "reel" | "video";
export type VideoOrientation = "portrait" | "landscape";
export type ProductionMethod = "traditional" | "ai-assisted" | "hybrid";

export interface PortfolioVideo {
  id: string;
  slug: string;
  type: VideoType;
  orientation?: VideoOrientation;
  aiAssisted?: boolean;
  productionMethod?: ProductionMethod;

  titleTR: string;
  titleEN: string;

  shortTitleTR?: string;
  shortTitleEN?: string;

  descriptionTR?: string;
  descriptionEN?: string;

  fullDescriptionTR?: string;
  fullDescriptionEN?: string;

  client?: string;
  year?: number;

  poster: string;
  thumbnail?: string;
  src?: string;

  duration?: string;

  servicesTR?: string[];
  servicesEN?: string[];
  services?: string[];
  tools?: string[];
  tags?: string[];

  autoplayPreview?: boolean;
  externalUrl?: string;
  projectSlug?: string;

  featured?: boolean;
  sortOrder?: number;
}

/**
 * CENTRALIZED PORTFOLIO VIDEOS ARCHIVE
 * 
 * To add a new portfolio video:
 * 1. Place poster and video in public/videos/<video-slug>/ (e.g. poster.webp and video.mp4)
 * 2. Add an entry to the videosData array below.
 */
export const videosData: PortfolioVideo[] = [
  {
    id: "ai-moda-kombin-reels",
    slug: "ai-moda-kombin-reels",
    type: "ai-reel",
    orientation: "portrait",
    aiAssisted: true,
    productionMethod: "ai-assisted",
    titleTR: "AI Moda Kombin Reels Videosu",
    titleEN: "AI Fashion Outfit Reel",
    shortTitleTR: "AI Moda Kombin Reels",
    shortTitleEN: "AI Fashion Outfit Reel",
    descriptionTR: "Yapay zeka destekli olarak hazırlanan bu kısa moda Reels çalışması; lila triko kombini gerçekçi model kullanımı, modern açık hava alışveriş atmosferi ve ürün odaklı yakın planlarla öne çıkarıyor. Yürüyüş sahnelerinden triko dokusu ve düğme detaylarına uzanan akış, kombinin hem genel görünümünü hem de ürün karakterini kısa ve dinamik bir formatta sunuyor.",
    descriptionEN: "This AI-assisted fashion Reel presents a lilac knit outfit through realistic model imagery, a modern open-air retail setting, and product-focused close-up shots. The sequence moves from walking and medium shots to detailed views of the knit texture and decorative buttons, presenting both the overall styling and the character of the garment in a short, dynamic format.",
    client: "eMix Creative",
    year: 2026,
    poster: "/videos/ai-moda-kombin-reels/poster.webp",
    src: "/videos/ai-moda-kombin-reels/video.mp4",
    duration: "0:05",
    servicesTR: [
      "AI Destekli Video Üretimi",
      "Kreatif Kurgu",
      "Kısa Format Video",
      "Moda İçerik Üretimi"
    ],
    servicesEN: [
      "AI-Assisted Video Production",
      "Creative Editing",
      "Short-Form Video",
      "Fashion Content Production"
    ],
    tools: [],
    featured: true,
    sortOrder: 1
  },
  {
    id: "la-ruota-pizza-artigianale-reels",
    slug: "la-ruota-pizza-artigianale-reels",
    type: "ai-reel",
    orientation: "portrait",
    aiAssisted: true,
    productionMethod: "ai-assisted",
    titleTR: "La Ruota Pizza Artigianale Reels Videosu",
    titleEN: "La Ruota Pizza Artigianale Reel",
    shortTitleTR: "La Ruota Pizza Reels",
    shortTitleEN: "La Ruota Pizza Reel",
    descriptionTR: "La Ruota Pizza Artigianale için hazırlanan bu kısa AI destekli Reels çalışması; pizza sunumu, kesim sahneleri, yakın plan ürün detayları, paketleme ve marka görüntülerini hızlı ve iştah odaklı bir kurgu içinde bir araya getiriyor. Dikey kısa format yapı, ürünün dokusunu ve markanın artizanal pizza kimliğini sosyal medya odaklı dinamik bir anlatımla öne çıkarıyor.",
    descriptionEN: "This short AI-assisted Reel for La Ruota Pizza Artigianale combines pizza presentation, slicing scenes, close-up food details, packaging, and brand imagery in a fast-paced, product-focused edit. The vertical short-form structure highlights the texture of the food and the brand’s artisanal pizza identity through a dynamic social-media presentation.",
    fullDescriptionTR: "La Ruota Pizza Artigianale için hazırlanan bu kısa Reels çalışmasında marka ve ürün deneyimi; sıcak pizza görüntüleri, yakın plan malzeme detayları, paket sunumu, kesim sahneleri ve restoranın marka unsurları üzerinden kurgulandı.\n\nVideo boyunca ürünün genel sunumundan hamur, malzeme ve kesim detaylarına ilerleyen yakın planlar kullanılırken, La Ruota’ya ait ambalaj ve fiziksel marka görüntüleri çalışmanın ticari kimliğini destekliyor. Kısa ve hızlı akış, artizanal pizza deneyimini sosyal medya için dikkat çekici ve iştah odaklı bir formatta sunmak amacıyla hazırlandı.",
    fullDescriptionEN: "This short-form Reel for La Ruota Pizza Artigianale builds the brand and product experience through warm pizza imagery, close-up ingredient details, packaging, slicing scenes, and visible restaurant branding.\n\nThe sequence moves between broader product presentation and tighter views of the crust, toppings, preparation, and serving details, while La Ruota’s packaging and physical brand elements reinforce the commercial identity of the piece. The fast vertical edit was created to present the artisanal pizza experience in an engaging, food-focused format for social media.",
    client: "La Ruota Pizza Artigianale",
    year: 2026,
    poster: "/videos/la-ruota-pizza-artigianale-reels/poster.webp",
    src: "/videos/la-ruota-pizza-artigianale-reels/video.mp4",
    duration: "0:08",
    servicesTR: [
      "Video Kurgu",
      "Reels Kurgusu",
      "Yemek Videosu",
      "Sosyal Medya İçeriği",
      "Ses Tasarımı",
      "Renk Düzenleme"
    ],
    servicesEN: [
      "Video Editing",
      "Reels Editing",
      "Food Video",
      "Social Media Content",
      "Sound Design",
      "Color Grading"
    ],
    tools: [],
    featured: true,
    sortOrder: 2
  },
  {
    id: "la-ruota-pizza-yapim-reels",
    slug: "la-ruota-pizza-yapim-reels",
    type: "ai-reel",
    orientation: "portrait",
    aiAssisted: true,
    productionMethod: "ai-assisted",
    titleTR: "La Ruota Pizza Yapım Reels Videosu",
    titleEN: "La Ruota Pizza-Making Reel",
    shortTitleTR: "La Ruota Pizza Yapım Reels",
    shortTitleEN: "La Ruota Pizza-Making Reel",
    descriptionTR: "La Ruota Pizza Artigianale için hazırlanan bu kısa AI destekli Reels çalışması; pizza yapım sürecini hamur hazırlığından malzeme eklemeye, odun fırını atmosferinden kesim ve final ürün sunumuna kadar dinamik bir akışla anlatıyor. Yakın plan üretim detayları, marka unsurları ve sıcak yemek görüntüleri, La Ruota’nın artizanal pizza kimliğini kısa format sosyal medya anlatımında öne çıkarıyor.",
    descriptionEN: "This short AI-assisted Reel for La Ruota Pizza Artigianale presents the pizza-making process through dough preparation, ingredient application, a warm wood-fired oven atmosphere, slicing, and final product presentation. Close-up production details and visible brand elements highlight La Ruota’s artisanal pizza identity in a dynamic short-form social media format.",
    fullDescriptionTR: "La Ruota Pizza Artigianale için hazırlanan bu Reels çalışmasında artizanal pizza üretim süreci, ürünün hazırlanmasından final sunumuna kadar kısa ve tempolu bir görsel akışla kurgulandı.\n\nHamurun hazırlanması ve malzemelerin eklenmesiyle başlayan video; odun fırını atmosferi, La Ruota markalı üretim detayları, pizza kesimi, paket sunumu ve final ürün görüntüleriyle devam ediyor. Yakın plan yemek çekimleri ve marka unsurları birlikte kullanılarak hem üretim sürecinin zanaat tarafı hem de ürünün iştah açıcı karakteri öne çıkarıldı.\n\nÇalışma, La Ruota’nın geleneksel ve kaliteli pizza üretim yaklaşımını sosyal medya için sıcak, dinamik ve ürün odaklı bir kısa video formatında sunmak amacıyla hazırlandı.",
    fullDescriptionEN: "This Reel for La Ruota Pizza Artigianale presents the artisanal pizza-making process through a concise, fast-paced visual sequence that moves from preparation to final serving.\n\nThe video begins with dough and ingredient preparation before progressing through the wood-fired oven atmosphere, branded production details, pizza slicing, packaging, and finished product imagery. Close-up food shots are combined with La Ruota brand elements to emphasize both the craft behind the preparation process and the appetizing character of the final product.\n\nThe piece was created to present La Ruota’s traditional, quality-focused approach to pizza production in a warm, dynamic, product-led short-form format for social media.",
    client: "La Ruota Pizza Artigianale",
    year: 2026,
    poster: "/videos/la-ruota-pizza-yapim-reels/poster.webp",
    src: "/videos/la-ruota-pizza-yapim-reels/video.mp4",
    duration: "0:08",
    servicesTR: [
      "Video Kurgu",
      "Reels Kurgusu",
      "Yemek Videosu",
      "Sosyal Medya İçeriği",
      "Ses Tasarımı",
      "Renk Düzenleme"
    ],
    servicesEN: [
      "Video Editing",
      "Reels Editing",
      "Food Video",
      "Social Media Content",
      "Sound Design",
      "Color Grading"
    ],
    tools: [],
    featured: true,
    sortOrder: 3
  },
  {
    id: "it-works-alum-stick-roll-on-reels",
    slug: "it-works-alum-stick-roll-on-reels",
    type: "reel",
    orientation: "portrait",
    aiAssisted: true,
    productionMethod: "ai-assisted",
    titleTR: "IT WORKS Alum Stick Roll-On Reels Videosu",
    titleEN: "IT WORKS Alum Stick Roll-On Reel",
    shortTitleTR: "IT WORKS Alum Stick Roll-On Reels",
    shortTitleEN: "IT WORKS Alum Stick Roll-On Reel",
    descriptionTR: "IT WORKS Alum Stick Roll-On için hazırlanan bu UGC tarzı Reels çalışması; ürünün günlük kullanım sürecini, uygulama adımlarını, ürün yakın planlarını ve 2’li set sunumunu kısa format sosyal medya kurgusuyla bir araya getiriyor. Banyo ortamında ilerleyen kullanım odaklı sahneler, ürünün pratik kullanım biçimini ve sunumunu doğal bir içerik akışı içinde öne çıkarıyor.",
    descriptionEN: "This UGC-style Reel for IT WORKS Alum Stick Roll-On combines the product’s everyday application process, close-up product shots, usage steps, and two-pack presentation in a short-form social media edit. Set in a bathroom environment, the sequence presents the product in a practical, natural-feeling content flow designed around real-world use.",
    fullDescriptionTR: "IT WORKS Alum Stick Roll-On için hazırlanan bu Reels çalışmasında ürün, UGC tarzı bir kullanım senaryosu üzerinden tanıtıldı. Banyo ortamında başlayan video; ürünü suyla ıslatma, günlük uygulama, yakın plan ürün gösterimi ve 2’li set sunumu gibi adımlarla ilerliyor.\n\nKurgu boyunca kullanıcı deneyimi ile ürün odaklı planlar dengelenerek sosyal medya için doğal, anlaşılır ve akıcı bir ürün tanıtım yapısı oluşturuldu. Final sunumunda ürün ambalajı ve 2’li avantaj seti öne çıkarılarak çalışma ticari bir sosyal medya Reels formatında tamamlandı.\n\nBu çalışmanın üretim sürecinde yapay zeka destekli görsel/video üretim tekniklerinden yararlanıldı; final içerik ise kurgu, ses tasarımı, renk düzenleme ve sosyal medya formatına uyarlama süreçleriyle tamamlandı.",
    fullDescriptionEN: "This Reel for IT WORKS Alum Stick Roll-On presents the product through a UGC-style usage scenario. Set in a bathroom environment, the sequence moves through wetting the product, everyday application, close-up product presentation, and a final two-pack showcase.\n\nThe edit balances user-focused scenes with product detail shots to create a clear, natural-feeling social media product presentation. The final sequence emphasizes the packaging and two-product set within a concise promotional Reel format.\n\nAI-assisted visual/video production techniques were used during parts of the production process, while the final piece was completed through editing, sound design, color grading, and adaptation for short-form social media.",
    client: "IT WORKS",
    year: 2026,
    poster: "/videos/it-works-alum-stick-roll-on-reels/poster.webp",
    src: "/videos/it-works-alum-stick-roll-on-reels/video.mp4",
    duration: "0:25",
    servicesTR: [
      "AI Video Üretimi",
      "UGC Video",
      "Ürün Videosu",
      "Reels Kurgusu",
      "Sosyal Medya İçeriği",
      "Ses Tasarımı",
      "Renk Düzenleme"
    ],
    servicesEN: [
      "AI Video Production",
      "UGC Video",
      "Product Video",
      "Reels Editing",
      "Social Media Content",
      "Sound Design",
      "Color Grading"
    ],
    tools: [],
    featured: true,
    sortOrder: 4
  },
  {
    id: "liorwell-kadin-streetwear-ai-reels",
    slug: "liorwell-kadin-streetwear-ai-reels",
    type: "ai-reel",
    orientation: "portrait",
    aiAssisted: true,
    productionMethod: "ai-assisted",
    titleTR: "LIORWELL Kadın Streetwear AI Reels Videosu",
    titleEN: "LIORWELL Women’s Streetwear AI Reel",
    shortTitleTR: "LIORWELL Streetwear AI Reels",
    shortTitleEN: "LIORWELL Streetwear AI Reel",
    descriptionTR: "LIORWELL için hazırlanan bu AI Reels çalışması; kadın streetwear kombinini siyah sweatpants, kırmızı katmanlı waistband detayı, LIORWELL marka vurguları ve modern kafe atmosferi üzerinden sunuyor. Model hareketleri, tam kombin kadrajları ve yakın plan ürün detayları, markanın premium sokak giyim dilini kısa ve dinamik bir sosyal medya formatında öne çıkarıyor.",
    descriptionEN: "This AI Reel for LIORWELL presents a women’s streetwear look through black sweatpants, a layered red waistband detail, visible LIORWELL branding, and a modern café setting. Model movement, full-outfit framing, and close-up product details highlight the brand’s premium streetwear identity in a short, dynamic social-media format.",
    fullDescriptionTR: "LIORWELL markası için hazırlanan bu AI destekli Reels çalışmasında kadın streetwear kombini; siyah geniş kesim sweatpants, kırmızı boxer katmanı, LIORWELL waistband detayı ve ürün üzerindeki marka logosu üzerinden kurgulandı.\n\nVideo boyunca yürüyüş ve model hareketleriyle kombinin genel silüeti gösterilirken, yakın plan kadrajlarla waistband, logo ve kumaş detayları öne çıkarıldı. Modern kafe atmosferi, ürünün günlük ve premium sokak giyim karakterini destekleyen yaşam tarzı bağlamı olarak kullanıldı.\n\nÇalışma; AI model üretimi, moda odaklı ürün görselleştirme ve kısa format video kurgusunu bir araya getirerek LIORWELL’in sosyal medya için dinamik ve marka odaklı bir streetwear sunumuna dönüştürüldü.",
    fullDescriptionEN: "This AI-assisted Reel for LIORWELL presents a women’s streetwear outfit built around black wide-leg sweatpants, a layered red boxer element, LIORWELL waistband branding, and the logo detail placed on the garment.\n\nThe sequence combines walking and model movement with wider outfit framing and close-up shots of the waistband, logo, and garment details. A modern café setting provides a lifestyle context that supports the premium, everyday streetwear character of the styling.\n\nThe piece combines AI model creation, fashion-focused product visualization, and short-form editing to present LIORWELL through a dynamic, brand-led social media format.",
    client: "LIORWELL",
    year: 2026,
    poster: "/videos/liorwell-kadin-streetwear-ai-reels/poster.webp",
    src: "/videos/liorwell-kadin-streetwear-ai-reels/video.mp4",
    duration: "0:06",
    servicesTR: [
      "AI Video Üretimi",
      "AI Model Oluşturma",
      "Moda Videosu",
      "Ürün Görselleştirme",
      "Reels Kurgusu",
      "Sosyal Medya İçeriği"
    ],
    servicesEN: [
      "AI Video Production",
      "AI Model Creation",
      "Fashion Video",
      "Product Visualization",
      "Reels Editing",
      "Social Media Content"
    ],
    featured: true,
    sortOrder: 5
  },
  {
    id: "yavrumsa-cocuk-giyim-ai-reels",
    slug: "yavrumsa-cocuk-giyim-ai-reels",
    type: "ai-reel",
    orientation: "portrait",
    aiAssisted: true,
    productionMethod: "ai-assisted",
    titleTR: "Yavrumsa Çocuk Giyim AI Reels Videosu",
    titleEN: "Yavrumsa Kidswear AI Reel",
    shortTitleTR: "Yavrumsa Çocuk Giyim AI Reels",
    shortTitleEN: "Yavrumsa Kidswear AI Reel",
    descriptionTR: "Yavrumsa için hazırlanan bu AI Reels çalışması; lacivert çocuk tulumunu gerçekçi model kullanımı, ürün odaklı yakın planlar, hareketli kadrajlar ve marka kapanışıyla sunuyor. Fırfır detayları, kumaş yapısı, ürünün yan ve arka görünümü ile model hareketleri bir araya getirilerek çocuk giyim ürünü kısa ve akıcı bir sosyal medya formatında öne çıkarılıyor.",
    descriptionEN: "This AI Reel for Yavrumsa presents a navy kidswear jumpsuit through realistic model imagery, product-focused close-ups, movement shots, and a branded closing frame. Ruffled details, fabric texture, side and back views of the garment, and model movement are combined in a concise, fluid short-form social media presentation.",
    fullDescriptionTR: "Yavrumsa için hazırlanan bu AI destekli Reels çalışmasında lacivert çocuk tulumu, gerçekçi model kullanımı ve sade iç mekan atmosferi üzerinden ürün odaklı bir anlatımla sunuldu.\n\nVideo boyunca modelin yürüyüş ve doğal hareketleriyle ürünün genel formu gösterilirken; yakın plan kadrajlarla fırfır detayları, kumaş yapısı ve üst bölüm tasarımı öne çıkarıldı. Yan ve arka açılar, tulumun farklı yönlerden görünümünü desteklerken final bölümünde Yavrumsa marka logosuyla çalışma tamamlandı.\n\nÇalışma; AI model üretimi, çocuk giyim odaklı ürün görselleştirme ve kısa format Reels kurgusunu bir araya getirerek markanın ürününü sosyal medya için sade, modern ve ürün merkezli bir formatta sunmak amacıyla hazırlandı.",
    fullDescriptionEN: "This AI-assisted Reel for Yavrumsa presents a navy children’s jumpsuit through realistic model imagery and a clean indoor setting with a strong focus on the garment.\n\nThe sequence uses walking and natural model movement to establish the overall silhouette, while closer shots highlight the ruffled shoulders, fabric texture, neckline, and construction details. Side and back views provide additional perspectives on the garment before the piece closes with Yavrumsa branding.\n\nThe work combines AI model creation, kidswear-focused product visualization, and short-form Reel editing to present the product in a clean, modern, and product-led social media format.",
    client: "Yavrumsa",
    year: 2026,
    poster: "/videos/yavrumsa-cocuk-giyim-ai-reels/poster.webp",
    src: "/videos/yavrumsa-cocuk-giyim-ai-reels/video.mp4",
    duration: "0:08",
    servicesTR: [
      "AI Video Üretimi",
      "AI Model Oluşturma",
      "Çocuk Giyim Videosu",
      "Ürün Görselleştirme",
      "Reels Kurgusu",
      "Sosyal Medya İçeriği"
    ],
    servicesEN: [
      "AI Video Production",
      "AI Model Creation",
      "Kidswear Video",
      "Product Visualization",
      "Reels Editing",
      "Social Media Content"
    ],
    featured: true,
    sortOrder: 6
  },
  {
    id: "bosnak-dilek-boregi-uretim-reels",
    slug: "bosnak-dilek-boregi-uretim-reels",
    type: "ai-reel",
    orientation: "portrait",
    aiAssisted: true,
    productionMethod: "ai-assisted",
    titleTR: "Boşnak Dilek Böreği Üretim Reels Videosu",
    titleEN: "Boşnak Dilek Böreği Production AI Reel",
    shortTitleTR: "Boşnak Dilek Böreği Üretim Reels",
    shortTitleEN: "Boşnak Dilek Böreği Production Reel",
    descriptionTR: "Boşnak Dilek Böreği için hazırlanan bu kısa AI destekli Reels çalışması; el açması börek üretimini hazırlık ve tepsi yerleşiminden pişmiş ürün sunumuna kadar sıcak ve ürün odaklı bir akışla anlatıyor. El emeği üretim sahneleri, yakın plan börek detayları ve farklı tepsi sunumları, markanın geleneksel üretim karakterini kısa format sosyal medya anlatımında öne çıkarıyor.",
    descriptionEN: "This short AI-assisted Reel for Boşnak Dilek Böreği presents the handmade pastry production process from preparation and tray arrangement through to the finished product. Craft-focused production shots, close-up pastry details, and multiple baked tray presentations highlight the brand’s traditional food identity in a warm, product-led short-form social media format.",
    fullDescriptionTR: "Boşnak Dilek Böreği için hazırlanan bu Reels çalışmasında markanın el emeğine dayalı üretim süreci, hazırlık aşamasından final ürün sunumuna uzanan kısa ve sıcak bir görsel akışla kurgulandı.\n\nVideo boyunca böreğin elle hazırlanması ve tepsiye yerleştirilmesi gibi üretim detayları öne çıkarılırken, devam eden sahnelerde pişmiş ürünler ve farklı börek çeşitlerinin yer aldığı tepsi sunumları kullanıldı. Yakın plan yemek görüntüleri, ürünün dokusunu ve el açması üretim karakterini daha görünür hale getiriyor.\n\nFinalde Boşnak Dilek Böreği marka kimliğiyle tamamlanan çalışma, geleneksel üretim yaklaşımını sosyal medya için dinamik, sıcak ve iştah odaklı bir kısa video formatına taşıyor.",
    fullDescriptionEN: "This Reel for Boşnak Dilek Böreği presents the brand’s handmade production process through a concise visual sequence that moves from preparation to final product presentation.\n\nThe video highlights hands-on pastry preparation and tray arrangement before progressing to baked products and multiple trays featuring different pastry styles. Close-up food imagery emphasizes the texture and handmade character of the products while maintaining a warm, traditional visual tone.\n\nThe piece concludes with Boşnak Dilek Böreği branding, presenting the brand’s traditional production approach through a dynamic, appetizing short-form format for social media.",
    client: "Boşnak Dilek Böreği",
    year: 2026,
    poster: "/videos/bosnak-dilek-boregi-uretim-reels/poster.webp",
    src: "/videos/bosnak-dilek-boregi-uretim-reels/video.mp4",
    duration: "0:08",
    servicesTR: [
      "Video Kurgu",
      "Reels Kurgusu",
      "Yemek Videosu",
      "Sosyal Medya İçeriği",
      "Ses Tasarımı",
      "Renk Düzenleme"
    ],
    servicesEN: [
      "Video Editing",
      "Reels Editing",
      "Food Video",
      "Social Media Content",
      "Sound Design",
      "Color Grading"
    ],
    featured: true,
    sortOrder: 7
  },
  {
    id: "liorwell-ai-streetwear-reels",
    slug: "liorwell-ai-streetwear-reels",
    type: "ai-reel",
    orientation: "portrait",
    aiAssisted: true,
    productionMethod: "ai-assisted",
    titleTR: "LIORWELL AI Streetwear Reels Videosu",
    titleEN: "LIORWELL AI Streetwear Reel",
    shortTitleTR: "LIORWELL AI Streetwear Reels",
    shortTitleEN: "LIORWELL AI Streetwear Reel",
    descriptionTR: "LIORWELL için hazırlanan bu AI Reels çalışması; layered boxer ve sweatpants kombinini şehir atmosferi, gerçekçi model kullanımı, dinamik kamera hareketleri ve ürün odaklı yakın planlarla sunuyor. Waistband ve logo detayları, model yürüyüşü ve sokak giyim estetiği bir araya getirilerek markanın premium streetwear dili kısa ve dinamik bir sosyal medya formatında öne çıkarılıyor.",
    descriptionEN: "This AI Reel for LIORWELL presents a layered boxer-and-sweatpants combination through an urban setting, realistic model imagery, dynamic camera movement, and product-focused close-ups. Waistband and logo details are combined with model movement and streetwear styling to highlight the brand’s premium identity in a short, dynamic social-media format.",
    fullDescriptionTR: "LIORWELL için hazırlanan bu AI destekli Reels çalışmasında markanın streetwear kimliği, layered boxer ve sweatpants kombini üzerinden şehir atmosferiyle birlikte kurgulandı.\n\nVideo boyunca model yürüyüşü ve hareketli kamera kadrajlarıyla kombinin genel silüeti gösterilirken, yakın plan sahnelerde LIORWELL waistband detayı, ürün üzerindeki logo ve katmanlı styling öne çıkarıldı. Şehir ortamı, ürünün günlük ve premium sokak giyim karakterini destekleyen görsel bir bağlam olarak kullanıldı.\n\nÇalışma; AI model üretimi, moda odaklı ürün görselleştirme ve kısa format video kurgusunu bir araya getirerek LIORWELL’in sosyal medya için dinamik ve marka merkezli bir streetwear sunumuna dönüştürüldü.",
    fullDescriptionEN: "This AI-assisted Reel for LIORWELL builds the brand’s streetwear identity around a layered boxer-and-sweatpants combination presented within an urban environment.\n\nThe sequence uses model walking and dynamic camera framing to establish the overall silhouette, while closer shots emphasize the LIORWELL waistband, garment logo, and layered styling details. The city setting supports the everyday yet premium character of the streetwear presentation.\n\nThe work combines AI model creation, fashion-focused product visualization, and short-form editing to create a dynamic, brand-led social media presentation for LIORWELL.",
    client: "LIORWELL",
    year: 2026,
    poster: "/videos/liorwell-ai-streetwear-reels/poster.webp",
    src: "/videos/liorwell-ai-streetwear-reels/video.mp4",
    duration: "0:05",
    servicesTR: [
      "AI Video Üretimi",
      "AI Model Oluşturma",
      "Moda Videosu",
      "Ürün Görselleştirme",
      "Reels Kurgusu",
      "Sosyal Medya İçeriği"
    ],
    servicesEN: [
      "AI Video Production",
      "AI Model Creation",
      "Fashion Video",
      "Product Visualization",
      "Reels Editing",
      "Social Media Content"
    ],
    featured: true,
    sortOrder: 8
  },
  {
    id: "ai-oversize-tshirt-reels",
    slug: "ai-oversize-tshirt-reels",
    type: "ai-reel",
    orientation: "portrait",
    aiAssisted: true,
    productionMethod: "ai-assisted",
    titleTR: "AI Oversize T-Shirt Reels Videosu",
    titleEN: "AI Oversized T-Shirt Reel",
    shortTitleTR: "AI Oversize T-Shirt Reels",
    shortTitleEN: "AI Oversized T-Shirt Reel",
    descriptionTR: "eMix Creative için hazırlanan bu AI Reels çalışması; pembe oversize T-shirt ürününü gerçekçi model kullanımı, şehir atmosferi, dinamik kamera açıları ve ürün baskısına odaklanan yakın planlarla sunuyor. Geniş şehir kadrajlarından model yürüyüşüne ve grafik detaylarına ilerleyen kısa akış, ürünün genç ve streetwear odaklı karakterini sosyal medya için dinamik bir formatta öne çıkarıyor.",
    descriptionEN: "This AI Reel for eMix Creative presents a pink oversized T-shirt through realistic model imagery, an urban setting, dynamic camera angles, and close-up views of the garment’s graphic print. The sequence moves from wider city framing and model movement to product-focused details, highlighting the youthful streetwear character of the piece in a short, dynamic social-media format.",
    fullDescriptionTR: "eMix Creative için hazırlanan bu AI destekli Reels çalışmasında pembe oversize T-shirt, modern şehir atmosferi ve gerçekçi model kullanımı üzerinden streetwear odaklı bir moda sunumuyla işlendi.\n\nVideo, çevreyi ve modeli birlikte gösteren geniş şehir kadrajıyla başlayarak model yürüyüşü ve orta plan çekimlere ilerliyor. Devam eden yakın planlarda T-shirt üzerindeki grafik baskı, kumaşın duruşu ve ürünün oversize formu daha görünür hale getiriliyor.\n\nÇalışma; AI model üretimi, moda odaklı ürün görselleştirme ve kısa format video kurgusunu bir araya getirerek moda markaları, butik giyim firmaları ve e-ticaret ürünlerinin sosyal medya sunumlarında kullanılabilecek dinamik bir ürün anlatımı oluşturuyor.",
    fullDescriptionEN: "This AI-assisted Reel for eMix Creative presents a pink oversized T-shirt through a streetwear-focused fashion concept built around a modern urban environment and realistic model imagery.\n\nThe video begins with a wider city composition that establishes both the model and the setting before moving into walking and medium-framed shots. Closer views then highlight the graphic print, garment drape, and oversized silhouette.\n\nThe work combines AI model creation, fashion-focused product visualization, and short-form editing to demonstrate a dynamic social-media presentation approach suitable for fashion brands, boutique clothing businesses, and e-commerce products.",
    client: "eMix Creative",
    year: 2026,
    poster: "/videos/ai-oversize-tshirt-reels/poster.webp",
    src: "/videos/ai-oversize-tshirt-reels/video.mp4",
    duration: "0:05",
    servicesTR: [
      "AI Video Üretimi",
      "AI Model Oluşturma",
      "Moda Videosu",
      "Ürün Görselleştirme",
      "Reels Kurgusu",
      "Sosyal Medya İçeriği"
    ],
    servicesEN: [
      "AI Video Production",
      "AI Model Creation",
      "Fashion Video",
      "Product Visualization",
      "Reels Editing",
      "Social Media Content"
    ],
    featured: true,
    sortOrder: 9
  },
  {
    id: "elara-skincare-ai-urun-reels",
    slug: "elara-skincare-ai-urun-reels",
    type: "ai-reel",
    orientation: "landscape",
    aiAssisted: true,
    productionMethod: "ai-assisted",
    titleTR: "ELARA Skincare AI Ürün Reels Videosu",
    titleEN: "ELARA Skincare AI Product Reel",
    shortTitleTR: "ELARA Skincare AI Ürün Reels",
    shortTitleEN: "ELARA Skincare AI Product Reel",
    descriptionTR: "ELARA Skincare için hazırlanan bu AI destekli ürün videosu; Radiance Serum’u premium kozmetik estetiği, şişe ve damlalık yakın planları, cilt uygulama sahnesi ve temiz ürün sunumlarıyla öne çıkarıyor. Minimal beauty görsel dili ve ürün odaklı kadrajlar, serumun premium karakterini kısa ve estetik bir sosyal medya içeriği içinde sunuyor.",
    descriptionEN: "This AI-assisted product video for ELARA Skincare presents the Radiance Serum through a premium cosmetic aesthetic, close-up bottle and dropper imagery, a skincare application scene, and clean product-focused compositions. The minimal beauty direction and detailed framing highlight the serum’s premium visual identity in a short, polished social-media format.",
    fullDescriptionTR: "ELARA Skincare için hazırlanan bu AI destekli kısa ürün videosunda Radiance Serum, premium ve minimal bir kozmetik görsel dili üzerinden sunuldu.\n\nVideo boyunca serum şişesinin tasarımını ve gold-toned damlalık detayını öne çıkaran ürün yakın planları kullanılırken, devam eden sahnelerde damlalık kullanımı ve serumun cilt üzerindeki uygulaması gösteriliyor. Temiz arka planlar, sıcak nötr tonlar ve kontrollü beauty kadrajları ürünün premium skincare karakterini destekliyor.\n\nFinal ürün sunumuyla tamamlanan çalışma; AI video üretimi, ürün görselleştirme ve kısa format kurgu yaklaşımını bir araya getirerek skincare ve kozmetik markaları için estetik, ürün merkezli bir sosyal medya tanıtım formatı oluşturuyor.",
    fullDescriptionEN: "This AI-assisted short-form product video for ELARA Skincare presents the Radiance Serum through a premium, minimal cosmetic visual language.\n\nThe sequence uses close-up product imagery to highlight the bottle design and gold-toned dropper before moving into product interaction and serum application on the skin. Clean backgrounds, warm neutral tones, and controlled beauty framing support the premium skincare character of the product.\n\nThe piece concludes with a focused product hero presentation, combining AI video production, product visualization, and short-form editing into a polished social-media format for skincare and cosmetic brands.",
    client: "ELARA Skincare",
    year: 2026,
    poster: "/videos/elara-skincare-ai-urun-reels/poster.webp",
    src: "/videos/elara-skincare-ai-urun-reels/video.mp4",
    duration: "0:05",
    servicesTR: [
      "AI Video Üretimi",
      "Ürün Görselleştirme",
      "Skincare İçeriği",
      "Reels Kurgusu",
      "Beauty Videosu",
      "Sosyal Medya İçeriği"
    ],
    servicesEN: [
      "AI Video Production",
      "Product Visualization",
      "Skincare Content",
      "Reels Editing",
      "Beauty Video",
      "Social Media Content"
    ],
    featured: true,
    sortOrder: 10
  },
  {
    id: "thg-yapi-kurumsal-reels",
    slug: "thg-yapi-kurumsal-reels",
    type: "reel",
    orientation: "portrait",
    aiAssisted: false,
    productionMethod: "traditional",
    titleTR: "THG Yapı Kurumsal Reels Videosu",
    titleEN: "THG Yapı Corporate Reel",
    shortTitleTR: "THG Yapı Kurumsal Reels",
    shortTitleEN: "THG Yapı Corporate Reel",
    descriptionTR: "THG Yapı için hazırlanan bu kurumsal Reels çalışması; mağaza cephesi, yapı malzemeleri ve stok alanları, geniş açılı işletme görüntüleri ve marka detaylarını kısa ve dinamik bir kurgu içinde bir araya getiriyor. Yüksek açı ve havadan çekim hissi veren kadrajlar, markanın sahadaki ölçeğini ve kurumsal görünümünü sosyal medya için güçlü bir tanıtım formatında öne çıkarıyor.",
    descriptionEN: "This corporate Reel for THG Yapı combines storefront imagery, building-material and stock areas, wide operational views, and brand details in a short, dynamic edit. High-angle and aerial-style framing emphasize the scale of the business and its professional corporate presence in a concise social-media format.",
    fullDescriptionTR: "THG Yapı için hazırlanan bu kısa Reels çalışmasında markanın yapı ve inşaat malzemeleri alanındaki kurumsal duruşu, işletmenin fiziksel ölçeği ve marka görünürlüğü üzerinden kurgulandı.\n\nVideo boyunca mağaza dış cephesi, ürün ve stok alanları ile işletmenin genel yerleşimini gösteren geniş ve yüksek açılı kadrajlar kullanıldı. Havadan çekim hissi veren geçişler, markanın sahadaki ölçeğini ve operasyonel yapısını daha görünür hale getirirken, yakın plan cephe ve tabela görüntüleri THG Yapı marka kimliğini destekliyor.\n\nÇalışma; kurumsal video kurgusu, sosyal medya odaklı kısa format anlatım ve drone-style editing yaklaşımını bir araya getirerek markanın profesyonel ve güven veren görünümünü kısa, etkili bir Reels formatında sunmak amacıyla hazırlandı.",
    fullDescriptionEN: "This short Reel for THG Yapı presents the company’s corporate presence in the building and construction materials sector through the scale of its physical operation and visible brand identity.\n\nThe sequence combines storefront imagery, product and stock areas, and wider high-angle views of the business environment. Aerial-style transitions help communicate the scale and operational character of the company, while closer facade and signage shots reinforce the THG Yapı brand.\n\nThe piece combines corporate video editing, short-form social media storytelling, and drone-style editing to present the company through a concise, professional, and visually confident Reel format.",
    client: "THG Yapı",
    year: 2026,
    poster: "/videos/thg-yapi-kurumsal-reels/poster.webp",
    src: "/videos/thg-yapi-kurumsal-reels/video.mp4",
    duration: "0:08",
    servicesTR: [
      "Video Kurgu",
      "Reels Kurgusu",
      "Kurumsal Video",
      "Drone Tarzı Kurgu",
      "Sosyal Medya İçeriği",
      "Ses Tasarımı",
      "Renk Düzenleme"
    ],
    servicesEN: [
      "Video Editing",
      "Reels Editing",
      "Corporate Video",
      "Drone Style Editing",
      "Social Media Content",
      "Sound Design",
      "Color Grading"
    ],
    featured: true,
    sortOrder: 11
  },
  {
    id: "chofee-kahve-yapim-reels",
    slug: "chofee-kahve-yapim-reels",
    type: "ai-reel",
    orientation: "portrait",
    aiAssisted: true,
    productionMethod: "ai-assisted",
    titleTR: "CHOFEE Kahve Yapım Reels Videosu",
    titleEN: "CHOFEE Coffee-Making AI Reel",
    shortTitleTR: "CHOFEE Kahve Yapım Reels",
    shortTitleEN: "CHOFEE Coffee-Making Reel",
    descriptionTR: "CHOFEE için hazırlanan bu kısa AI Reels çalışması; kahve hazırlama sürecini süt dökümü, latte art, yakın plan ürün detayları ve final sunumuyla sıcak ve estetik bir görsel akış içinde anlatıyor. CHOFEE markalı ürün sunumu ve kafe atmosferi, kahve deneyimini sosyal medya için kısa, akıcı ve ürün odaklı bir formatta öne çıkarıyor.",
    descriptionEN: "This short AI Reel for CHOFEE presents the coffee-making process through milk pouring, latte art, close-up product details, and final drink presentation. CHOFEE-branded packaging and the café setting combine to present the coffee experience in a warm, fluid, and product-focused short-form social-media format.",
    fullDescriptionTR: "CHOFEE için hazırlanan bu Reels çalışmasında kahve hazırlama süreci, ürünün hazırlanmasından final sunumuna uzanan kısa ve estetik bir görsel akışla kurgulandı.\n\nVideo boyunca CHOFEE markalı bardak, kahve hazırlama ortamı ve süt dökümü yakın planlarla gösterilirken, latte art oluşumu sürecin görsel odağını oluşturuyor. Devam eden sahnelerde tamamlanan kahve, kafe ortamı ve ürün sunumuyla birlikte gösterilerek markanın sıcak ve modern kafe deneyimi destekleniyor.\n\nÇalışma; kısa format Reels kurgusu, renk düzenleme, ses tasarımı ve sosyal medya odaklı ürün anlatımını bir araya getirerek CHOFEE’nin kahve deneyimini dinamik ve estetik bir video formatında sunuyor.",
    fullDescriptionEN: "This Reel for CHOFEE presents the coffee-making process through a concise and visually polished sequence that moves from preparation to final presentation.\n\nThe video uses close-up views of the CHOFEE-branded cup, coffee preparation environment, and milk pouring before focusing on the formation of the latte art. The finished drink is then presented within the café setting alongside complementary product imagery, reinforcing the warm and contemporary character of the CHOFEE experience.\n\nThe piece combines short-form Reel editing, color grading, sound design, and social-media-focused product storytelling to present CHOFEE’s coffee experience through a dynamic and visually refined format.",
    client: "CHOFEE",
    year: 2026,
    poster: "/videos/chofee-kahve-yapim-reels/poster.webp",
    src: "/videos/chofee-kahve-yapim-reels/video.mp4",
    duration: "0:08",
    servicesTR: [
      "Reels Kurgusu",
      "Renk Düzenleme",
      "Ses Tasarımı",
      "Sosyal Medya İçeriği"
    ],
    servicesEN: [
      "Reels Editing",
      "Color Grading",
      "Sound Design",
      "Social Media Content"
    ],
    featured: true,
    sortOrder: 12
  },
  {
    id: "ai-moda-urun-reels",
    slug: "ai-moda-urun-reels",
    type: "ai-reel",
    orientation: "landscape",
    aiAssisted: true,
    productionMethod: "ai-assisted",
    titleTR: "AI Moda Ürün Reels Videosu",
    titleEN: "AI Fashion Product Reel",
    shortTitleTR: "AI Moda Ürün Reels",
    shortTitleEN: "AI Fashion Product Reel",
    descriptionTR: "eMix Creative için hazırlanan bu AI destekli moda videosu; oversize sweatshirt ürününü gerçekçi avatar kullanımı, dış mekan atmosferi, sinematik kamera hareketleri ve ürün baskısına odaklanan yakın planlarla sunuyor. Geniş planlardan model yürüyüşüne ve grafik detaylarına ilerleyen kısa akış, ürünün streetwear karakterini dinamik ve ürün odaklı bir sosyal medya anlatımıyla öne çıkarıyor.",
    descriptionEN: "This AI-assisted fashion video for eMix Creative presents an oversized sweatshirt through realistic avatar imagery, an outdoor architectural setting, cinematic camera movement, and product-focused close-ups. The sequence moves from wider establishing shots and model movement to detailed views of the garment graphic, highlighting the streetwear character of the product in a short, dynamic social-media format.",
    fullDescriptionTR: "eMix Creative için hazırlanan bu AI destekli moda çalışmasında oversize sweatshirt ürünü, gerçekçi bir avatar ve dış mekan hissi veren profesyonel bir sahne kurgusu üzerinden sunuldu.\n\nVideo, modeli ve çevreyi birlikte gösteren geniş planlarla başlayarak yürüyüş ve orta plan moda kadrajlarına ilerliyor. Devam eden yakın çekimlerde sweatshirt üzerindeki grafik baskı, ürün formu ve kumaşın duruşu öne çıkarılarak tasarım detayları daha görünür hale getiriliyor.\n\nÇalışma; AI model üretimi, moda odaklı ürün videosu ve kısa format sosyal medya kurgusunu bir araya getirerek moda markaları, e-ticaret ürünleri ve dijital kampanyalar için yapay zeka destekli ürün sunumunun görsel potansiyelini gösteriyor.",
    fullDescriptionEN: "This AI-assisted fashion piece for eMix Creative presents an oversized sweatshirt through a realistic avatar and a professionally staged outdoor architectural environment.\n\nThe sequence begins with wider framing that establishes both the model and surroundings before progressing into walking and medium fashion shots. Closer views then emphasize the sweatshirt graphic, garment silhouette, and product details.\n\nThe work combines AI model creation, fashion-focused product video production, and short-form social media editing to demonstrate the visual potential of AI-assisted product presentation for fashion brands, e-commerce products, and digital campaigns.",
    client: "eMix Creative",
    year: 2026,
    poster: "/videos/ai-moda-urun-reels/poster.webp",
    src: "/videos/ai-moda-urun-reels/video.mp4",
    duration: "0:05",
    servicesTR: [
      "AI Video Üretimi",
      "AI Model Oluşturma",
      "Ürün Videosu",
      "Reels Kurgusu",
      "Moda İçeriği",
      "Sosyal Medya"
    ],
    servicesEN: [
      "AI Video Production",
      "AI Model Creation",
      "Product Video",
      "Reels Editing",
      "Fashion Content",
      "Social Media"
    ],
    tools: [],
    featured: true,
    sortOrder: 13
  },
  {
    id: "mythic-bastion-ai-game-ad",
    slug: "mythic-bastion-ai-game-ad",
    type: "ai-reel",
    orientation: "portrait",
    aiAssisted: true,
    productionMethod: "ai-assisted",
    titleTR: "Mythic Bastion AI Oyun Reklam Videosu",
    titleEN: "Mythic Bastion AI Game Advertising Video",
    shortTitleTR: "Mythic Bastion AI Oyun Reklamı",
    shortTitleEN: "Mythic Bastion AI Game Ad",
    descriptionTR: "Mythic Bastion için hazırlanan bu AI destekli oyun reklam videosu; fantastik savaş atmosferini, oyun karakterlerini, mor portal efektlerini ve yükselen aksiyon sahnelerini kısa ve dinamik bir kurgu içinde sunuyor. Karakter hareketleri, geniş arena kadrajları, büyü ve meteor efektleri ile büyük ölçekli çatışma görüntüleri bir araya getirilerek oyunun fantastik aksiyon dünyasını sosyal medya odaklı dikkat çekici bir reklam formatında öne çıkarıyor.",
    descriptionEN: "This AI-assisted game advertising video for Mythic Bastion presents a fantasy battle environment through game characters, glowing portals, escalating action, and large-scale combat imagery. Character movement, wide arena compositions, magical effects, meteor impacts, and boss-like encounters combine to introduce the game’s fantasy-action world through a dynamic short-form promotional format.",
    fullDescriptionTR: "Mythic Bastion için hazırlanan bu AI destekli oyun reklam çalışmasında fantastik oyun dünyası, aksiyonu giderek yükselen kısa bir sinematik akış üzerinden sunuldu.\n\nVideo, oyuncu karakterini ve çevredeki fantastik araziyi tanıtan daha kontrollü kadrajlarla başlıyor. Mor enerji portalları, büyü yapıları ve farklı karakterlerin yer aldığı arena ilerleyen sahnelerde daha yoğun bir savaş ortamına dönüşüyor.\n\nKurgu devam ettikçe meteor çarpmaları, enerji efektleri, kalabalık çatışma sahneleri ve büyük düşman/boss hissi veren karakterler kullanılarak görsel tempo yükseltiliyor. Böylece çalışma, Mythic Bastion’ın fantastik aksiyon dünyasını kısa sürede anlatan dikkat çekici bir oyun reklamı yapısına ulaşıyor.\n\nProje; AI video üretimi, oyun reklamı odaklı kreatif kurgu ve sinematik aksiyon görselleştirmesini bir araya getirerek oyun projelerinin sosyal medya ve dijital reklam kampanyalarında kullanılabilecek kısa format tanıtım potansiyelini göstermek amacıyla hazırlandı.",
    fullDescriptionEN: "This AI-assisted advertising piece for Mythic Bastion presents its fantasy game world through a short cinematic sequence with progressively escalating action.\n\nThe video begins with more controlled framing that introduces the player-style character and the surrounding fantasy landscape. Glowing purple portals, magical structures, and multiple characters gradually transform the arena into a larger battle environment.\n\nAs the sequence progresses, meteor impacts, energy effects, crowded combat scenes, and large boss-like enemies increase the visual intensity. The result is a concise promotional piece designed to communicate the fantasy-action character of Mythic Bastion within a highly visual short-form format.\n\nThe project combines AI video production, game-advertising-focused creative direction, and cinematic action visualization to demonstrate the potential of short-form promotional content for gaming projects and digital campaigns.",
    client: "Mythic Bastion",
    year: 2026,
    poster: "/videos/mythic-bastion-ai-game-ad/poster.webp",
    src: "/videos/mythic-bastion-ai-game-ad/video.mp4",
    duration: "0:15",
    servicesTR: [
      "AI Video Üretimi",
      "Oyun Reklam Videosu"
    ],
    servicesEN: [
      "AI Video Production",
      "Game Advertising Video"
    ],
    tags: [
      "gaming",
      "game advertising",
      "fantasy",
      "AI video"
    ],
    tools: [],
    featured: true,
    sortOrder: 14
  },
  {
    id: "cupistan-ai-tatli-urun-reels",
    slug: "cupistan-ai-tatli-urun-reels",
    type: "ai-reel",
    orientation: "portrait",
    aiAssisted: true,
    productionMethod: "ai-assisted",
    titleTR: "Cupistan AI Tatlı Ürün Reels Videosu",
    titleEN: "Cupistan AI Dessert Product Reel",
    shortTitleTR: "Cupistan AI Tatlı Reels",
    shortTitleEN: "Cupistan AI Dessert Reel",
    descriptionTR: "Cupistan için hazırlanan bu AI destekli Reels çalışması; farklı tatlı çeşitlerini marka ambalajları, yakın plan ürün kadrajları ve pastane atmosferi içinde estetik bir ürün sunumuyla öne çıkarıyor. Çikolatalı, kremalı ve meyveli ürünlerin farklı açılardan gösterildiği kısa akış, Cupistan’ın tatlı ürünlerini sosyal medya için iştah odaklı, modern ve dinamik bir formatta sunuyor.",
    descriptionEN: "This AI-assisted Reel for Cupistan presents a range of dessert products through branded packaging, close-up product framing, and a polished pastry-shop setting. Chocolate, cream-based, and fruit-accented desserts are shown from multiple perspectives, creating a modern, appetizing, and dynamic short-form social media presentation for the brand.",
    fullDescriptionTR: "Cupistan için hazırlanan bu AI destekli Reels çalışmasında markanın farklı tatlı ürünleri, ürün odaklı ve iştah açıcı bir görsel anlatımla sunuldu.\n\nVideo boyunca Cupistan logolu şeffaf ambalajlarda sunulan çikolatalı, kremalı ve meyveli tatlı çeşitleri arasında dinamik geçişler kullanılıyor. Yakın plan kadrajlar; katmanlı yapıları, çikolata yüzeylerini, krema dokusunu ve ürünlerin farklı sunum biçimlerini daha görünür hale getirirken pastane/vitrin atmosferi marka deneyimini destekliyor.\n\nÇalışma; AI video üretimi, gıda odaklı ürün görselleştirme ve kısa format sosyal medya anlatımını bir araya getirerek Cupistan ürünlerini modern, iştah odaklı ve dikkat çekici bir dijital tanıtım formatında sunmak amacıyla hazırlandı.",
    fullDescriptionEN: "This AI-assisted Reel for Cupistan presents a selection of the brand’s dessert products through an appetizing, product-led visual sequence.\n\nThe video moves dynamically between chocolate, cream-based, and fruit-accented desserts presented in transparent Cupistan-branded packaging. Close-up framing emphasizes layered textures, chocolate surfaces, cream details, and the different presentation styles of the products, while the pastry-shop environment reinforces the overall brand experience.\n\nThe piece combines AI video production, food-focused product visualization, and short-form social media storytelling to present Cupistan’s products through a modern, appetizing, and visually engaging promotional format.",
    client: "Cupistan",
    year: 2026,
    poster: "/videos/cupistan-ai-tatli-urun-reels/poster.webp",
    src: "/videos/cupistan-ai-tatli-urun-reels/video.mp4",
    duration: "0:08",
    servicesTR: [
      "AI Video Üretimi",
      "Ürün Görselleştirme",
      "Yemek Videosu",
      "Reels Kurgusu",
      "Sosyal Medya İçeriği"
    ],
    servicesEN: [
      "AI Video Production",
      "Product Visualization",
      "Food Video",
      "Reels Editing",
      "Social Media Content"
    ],
    tags: [
      "food",
      "dessert",
      "product",
      "food advertising",
      "product visualization",
      "AI video"
    ],
    tools: [],
    featured: true,
    sortOrder: 15
  },
  {
    id: "emix-creative-website-design-ad-reels",
    slug: "emix-creative-website-design-ad-reels",
    type: "reel",
    orientation: "portrait",
    titleTR: "eMix Creative Kurumsal Website Tasarım Reklam Reels Videosu",
    titleEN: "eMix Creative Corporate Website Design Advertising Reel",
    shortTitleTR: "eMix Creative Website Tasarım Reklamı",
    shortTitleEN: "eMix Creative Website Design Ad",
    descriptionTR: "eMix Creative için hazırlanan bu reklam Reels çalışması; kurumsal website tasarım hizmetini sektöre özel tasarım, domain ve hosting kurulumu, referans çalışmalar ve web sitesi güncelleme başlıkları üzerinden dinamik bir sosyal medya kurgusuyla tanıtıyor. Website arayüzleri, hizmet mesajları ve marka odaklı görsel geçişler bir araya getirilerek eMix Creative’in web tasarım hizmetleri kısa ve dikkat çekici bir reklam formatında sunuluyor.",
    descriptionEN: "This advertising Reel for eMix Creative promotes the brand’s corporate website design services through custom industry-focused design, domain and hosting setup, portfolio references, and website update messaging. Website interfaces, service-focused copy, and branded visual transitions are combined in a concise and dynamic short-form promotional format.",
    fullDescriptionTR: "eMix Creative için hazırlanan bu kısa reklam videosunda markanın kurumsal website tasarım hizmetleri, hizmet avantajlarını adım adım öne çıkaran dikey bir sosyal medya kurgusuyla sunuldu.\n\nVideo; “Kurumsal Website Tasarımı” mesajıyla başlayarak sektöre özel tasarım yaklaşımına, farklı website referanslarına, domain ve hosting kurulum hizmetlerine ve geniş proje deneyimini vurgulayan “200+ Referans Tasarım” bölümüne ilerliyor.\n\nDevam eden sahnelerde mevcut web sitelerinin tasarım, altyapı ve SEO odaklı olarak güncellenebilmesine yönelik hizmet mesajları kullanılırken, çalışma eMix Creative marka kimliği ve güçlü bir marka kapanışıyla tamamlanıyor.\n\nProje; reklam videosu kurgusu, web tasarım hizmetlerinin görsel sunumu, motion-odaklı dijital içerik ve kısa format sosyal medya reklam yaklaşımını bir araya getirerek eMix Creative’in hizmetlerini hızlı, profesyonel ve dikkat çekici biçimde aktarmak amacıyla hazırlandı.",
    fullDescriptionEN: "This short advertising video for eMix Creative presents the brand’s corporate website design services through a vertical social-media sequence structured around key service benefits.\n\nThe Reel opens with corporate website design messaging before progressing through industry-specific design, multiple website references, domain and hosting setup, and a “200+ reference designs” section that reinforces the breadth of the brand’s design experience.\n\nLater scenes introduce website renewal services focused on design, infrastructure, and SEO before the piece concludes with eMix Creative branding.\n\nThe project combines advertising-video editing, visual presentation of web-design services, motion-led digital content, and short-form social-media promotion to communicate eMix Creative’s services in a concise, professional, and visually engaging format.",
    client: "eMix Creative",
    year: 2026,
    poster: "/videos/emix-creative-website-design-ad-reels/poster.webp",
    src: "/videos/emix-creative-website-design-ad-reels/video.mp4",
    duration: "0:19",
    servicesTR: [
      "Reklam Videosu",
      "Reels Kurgusu",
      "Motion Tasarım",
      "Sosyal Medya İçeriği",
      "Hizmet Tanıtımı"
    ],
    servicesEN: [
      "Advertising Video",
      "Reels Editing",
      "Motion Design",
      "Social Media Content",
      "Service Promotion"
    ],
    tags: [
      "advertising",
      "web design",
      "corporate",
      "motion design",
      "reels",
      "service promotion"
    ],
    tools: [],
    featured: true,
    sortOrder: 16
  },
  {
    id: "emix-creative-ai-content-transformation-ad",
    slug: "emix-creative-ai-content-transformation-ad",
    type: "reel",
    orientation: "portrait",
    aiAssisted: true,
    productionMethod: "ai-assisted",
    titleTR: "eMix Creative AI İçerik Dönüşüm Reklam Reels Videosu",
    titleEN: "eMix Creative AI Content Transformation Advertising Reel",
    shortTitleTR: "eMix Creative AI İçerik Dönüşüm Reklamı",
    shortTitleEN: "eMix Creative AI Content Transformation Ad",
    descriptionTR: "eMix Creative için hazırlanan bu reklam Reels çalışması; telefonla çekilen basit ürün ve moda görsellerinin AI destekli üretim süreçleriyle premium ürün görsellerine, model/lifestyle sahnelerine ve hareketli Reels içeriklerine dönüştürülebileceğini anlatıyor. Öncesi-sonrası karşılaştırmaları, farklı kullanım senaryoları ve hızlı görsel geçişlerle eMix Creative’in dijital içerik üretim hizmeti kısa ve dikkat çekici bir sosyal medya reklam formatında sunuluyor.",
    descriptionEN: "This advertising Reel for eMix Creative demonstrates how simple phone-shot fashion and product imagery can be transformed through AI-assisted production into premium product visuals, model and lifestyle scenes, and short-form Reels. Before-and-after comparisons, multiple use cases, and dynamic visual transitions present eMix Creative’s digital content production service in a concise and engaging social-media advertising format.",
    fullDescriptionTR: "eMix Creative için hazırlanan bu reklam çalışmasında temel fikir, telefonla çekilen basit bir ürün veya moda görselinin farklı dijital içerik formatlarına dönüştürülebilmesi üzerine kuruldu.\n\nVideo, ham telefon çekimlerini başlangıç noktası olarak gösterdikten sonra aynı kaynaktan oluşturulan premium moda ve ürün görsellerini karşılaştırmalı biçimde sunuyor. Kombinlerin model üzerinde lifestyle sahnelerine taşınması, ürünlerin daha profesyonel ticari görünümlere dönüştürülmesi ve statik fotoğraflardan hareketli kısa video içerikleri oluşturulması farklı örneklerle gösteriliyor.\n\n“Fotoğraftan reels’e” ve “Stil artık hareketli” gibi mesajlarla statik görselden video üretimine geçiş vurgulanırken, “Dönüşüm tek çekimle başlar” yaklaşımı hizmetin temel yaratıcı fikrini özetliyor.\n\nÇalışma; AI destekli içerik üretimi, ürün görselleştirme, moda/lifestyle içerik üretimi ve reklam kurgusunu bir araya getirerek eMix Creative’in markalar ve e-ticaret ürünleri için sunduğu yaratıcı üretim yaklaşımını kısa format sosyal medya reklamı içinde anlatmak amacıyla hazırlandı.",
    fullDescriptionEN: "This advertising piece for eMix Creative is built around the idea that a simple phone-shot product or fashion image can become the starting point for multiple premium digital-content formats.\n\nThe sequence begins with basic source imagery before demonstrating premium fashion and product outputs created from the same visual input. Different examples show outfits placed into model-led lifestyle environments, products transformed into more polished commercial compositions, and static photographs developed into short-form motion content.\n\nMessaging such as “from photo to Reel” and “style is now in motion” emphasizes the transition from static imagery to video, while the broader concept communicates that a single source capture can become the foundation for multiple pieces of branded content.\n\nThe project combines AI-assisted content production, product visualization, fashion and lifestyle imagery, and advertising-video editing to present eMix Creative’s creative-production service for brands and e-commerce products.",
    client: "eMix Creative",
    year: 2026,
    poster: "/videos/emix-creative-ai-content-transformation-ad/poster.webp",
    src: "/videos/emix-creative-ai-content-transformation-ad/video.mp4",
    duration: "0:23",
    servicesTR: [
      "Reklam Videosu",
      "AI Destekli İçerik Üretimi",
      "Ürün Görselleştirme",
      "Reels Kurgusu",
      "Moda & Lifestyle İçeriği",
      "Sosyal Medya İçeriği"
    ],
    servicesEN: [
      "Advertising Video",
      "AI Content Production",
      "Product Visualization",
      "Reels Editing",
      "Fashion & Lifestyle Content",
      "Social Media Content"
    ],
    tags: [
      "advertising",
      "AI content",
      "product visualization",
      "fashion",
      "lifestyle",
      "reels",
      "transformation"
    ],
    tools: [],
    featured: true,
    sortOrder: 17
  },
  {
    id: "chofee-ai-lifestyle-icecek-reels",
    slug: "chofee-ai-lifestyle-icecek-reels",
    type: "ai-reel",
    orientation: "portrait",
    aiAssisted: true,
    productionMethod: "ai-assisted",
    titleTR: "CHOFEE AI Lifestyle İçecek Reels Videosu",
    titleEN: "CHOFEE AI Lifestyle Beverage Reel",
    shortTitleTR: "CHOFEE AI Lifestyle Reels",
    shortTitleEN: "CHOFEE AI Lifestyle Reel",
    descriptionTR: "CHOFEE için hazırlanan bu AI destekli Reels çalışması; markanın içecek ürünlerini gerçekçi lifestyle model kullanımı, kafe atmosferi ve sosyal yaşam sahneleriyle bir araya getiriyor. Farklı içecek çeşitleri, model odaklı kadrajlar ve ürün yakın planları kullanılarak CHOFEE’nin modern ve sıcak marka deneyimi kısa, estetik ve sosyal medya odaklı bir formatta sunuluyor.",
    descriptionEN: "This AI-assisted Reel for CHOFEE combines the brand’s beverage products with realistic lifestyle model imagery, café-inspired environments, and social moments. Multiple drink varieties, model-led framing, and product-focused compositions present CHOFEE through a modern, warm, and visually polished short-form social-media format.",
    fullDescriptionTR: "CHOFEE için hazırlanan bu AI destekli Reels çalışmasında markanın farklı içecek ürünleri, lifestyle ve sosyal yaşam odaklı bir görsel anlatımla sunuldu.\n\nVideo boyunca CHOFEE markalı içeceklerle yürüyen, kafe ortamında vakit geçiren ve sosyal bir atmosfer içinde ürünleri kullanan gerçekçi model sahneleri kullanılıyor. Kırmızı, yeşil ve kahve bazlı farklı içecek çeşitleri hem model kullanımında hem de ürün odaklı yakın planlarda gösterilerek markanın ürün çeşitliliği görünür hale getiriliyor.\n\nDevam eden sahnelerde iki modelin birlikte yer aldığı sosyal yaşam kurgusu ve farklı CHOFEE ürünlerinin aynı kompozisyon içinde sunulması, çalışmanın lifestyle reklam karakterini güçlendiriyor.\n\nProje; AI video üretimi, lifestyle odaklı ürün görselleştirme ve kısa format sosyal medya anlatımını bir araya getirerek CHOFEE’nin içecek ürünlerini modern, sıcak ve marka odaklı bir dijital reklam formatında sunmak amacıyla hazırlandı.",
    fullDescriptionEN: "This AI-assisted Reel for CHOFEE presents the brand’s beverage range through a lifestyle-led visual narrative.\n\nThe video uses realistic model scenes featuring CHOFEE drinks in walking, café, reading, and social settings. Red, green, and coffee-based beverages are presented through both model interaction and closer product-focused compositions, making the variety of the product range clearly visible.\n\nLater scenes introduce a social interaction between two models and compositions featuring multiple CHOFEE drinks together, reinforcing the lifestyle-advertising character of the piece.\n\nThe project combines AI video production, lifestyle-focused product visualization, and short-form social-media storytelling to present CHOFEE’s beverage range through a modern, warm, and brand-led advertising format.",
    client: "CHOFEE",
    year: 2026,
    poster: "/videos/chofee-ai-lifestyle-icecek-reels/poster.webp",
    src: "/videos/chofee-ai-lifestyle-icecek-reels/video.mp4",
    duration: "0:08",
    servicesTR: [
      "AI Video Üretimi",
      "Ürün Görselleştirme",
      "Lifestyle Video",
      "İçecek İçeriği",
      "Reels Kurgusu",
      "Sosyal Medya İçeriği"
    ],
    servicesEN: [
      "AI Video Production",
      "Product Visualization",
      "Lifestyle Video",
      "Beverage Content",
      "Reels Editing",
      "Social Media Content"
    ],
    tags: [
      "beverage",
      "lifestyle",
      "drinks",
      "cafe",
      "product visualization",
      "AI video",
      "reels"
    ],
    tools: [],
    featured: true,
    sortOrder: 18
  },
  {
    id: "cupistan-ai-ekler-urun-reels",
    slug: "cupistan-ai-ekler-urun-reels",
    type: "ai-reel",
    orientation: "portrait",
    aiAssisted: true,
    productionMethod: "ai-assisted",
    titleTR: "Cupistan AI Ekler Ürün Reels Videosu",
    titleEN: "Cupistan AI Éclair Product Reel",
    shortTitleTR: "Cupistan AI Ekler Reels",
    shortTitleEN: "Cupistan AI Éclair Reel",
    descriptionTR: "Cupistan için hazırlanan bu AI destekli Reels çalışması; farklı ekler çeşitlerini renk, kaplama ve sunum detayları üzerinden ürün odaklı bir görsel akışla öne çıkarıyor. Çikolatalı, renkli glaze ve farklı dokulara sahip ekler ürünleri; temiz stüdyo kadrajları, yakın plan ürün görselleri ve pastane vitrin atmosferiyle bir araya getirilerek sosyal medya için iştah açıcı ve dinamik bir ürün tanıtımına dönüştürülüyor.",
    descriptionEN: "This AI-assisted Reel for Cupistan presents a range of éclairs through different colors, coatings, textures, and product variations. Clean studio-style compositions, close-up food imagery, and a pastry-display setting combine to create a dynamic and appetizing short-form product presentation for social media.",
    fullDescriptionTR: "Cupistan için hazırlanan bu AI destekli Reels çalışmasında markanın ekler ürünleri, farklı renk, kaplama ve sunum alternatifleri üzerinden ürün merkezli bir görsel anlatımla sunuldu.\n\nVideo boyunca pembe, sarı, karamel tonlu ve çikolatalı farklı ekler çeşitleri temiz ürün kadrajlarında gösterilirken; çikolata kaplaması, drizzle detayları, kakao yüzeyleri ve farklı dokular yakın planlarla öne çıkarılıyor.\n\nÜrün odaklı stüdyo görsellerinin ardından pastane/vitrin atmosferinin kullanılması, ürünlerin gerçek satış ve sunum bağlamını destekleyen daha geniş bir görsel dünya oluşturuyor. Finalde marka karakterini destekleyen ilustratif kapanışla video tamamlanıyor.\n\nÇalışma; AI video üretimi, gıda ürün görselleştirmesi ve kısa format sosyal medya anlatımını bir araya getirerek Cupistan’ın ekler çeşitlerini modern, iştah açıcı ve ürün merkezli bir dijital tanıtım formatında sunmak amacıyla hazırlandı.",
    fullDescriptionEN: "This AI-assisted Reel for Cupistan presents the brand’s éclair range through a product-led visual sequence built around different colors, coatings, and presentation styles.\n\nPink, yellow, caramel-toned, and chocolate éclairs are shown through clean product compositions, while closer imagery emphasizes chocolate coatings, drizzle details, cocoa textures, and variation across the range.\n\nThe transition from studio-style product imagery to a pastry-display environment provides a broader commercial context for the products before the video concludes with a branded illustrated closing frame.\n\nThe piece combines AI video production, food-product visualization, and short-form social-media storytelling to present Cupistan’s éclair range through a modern, appetizing, and product-focused promotional format.",
    client: "Cupistan",
    year: 2026,
    poster: "/videos/cupistan-ai-ekler-urun-reels/poster.webp",
    src: "/videos/cupistan-ai-ekler-urun-reels/video.mp4",
    duration: "0:08",
    servicesTR: [
      "AI Video Üretimi",
      "Ürün Görselleştirme",
      "Yemek Videosu",
      "Reels Kurgusu",
      "Sosyal Medya İçeriği"
    ],
    servicesEN: [
      "AI Video Production",
      "Product Visualization",
      "Food Video",
      "Reels Editing",
      "Social Media Content"
    ],
    tags: [
      "dessert",
      "eclair",
      "food visualization",
      "pastry",
      "product visualization",
      "AI video",
      "reels"
    ],
    tools: [],
    featured: true,
    sortOrder: 19
  },
  {
    id: "cupistan-ai-tart-tatli-urun-reels",
    slug: "cupistan-ai-tart-tatli-urun-reels",
    type: "ai-reel",
    orientation: "portrait",
    aiAssisted: true,
    productionMethod: "ai-assisted",
    titleTR: "Cupistan AI Tart ve Tatlı Ürün Reels Videosu",
    titleEN: "Cupistan AI Tart & Dessert Product Reel",
    shortTitleTR: "Cupistan AI Tart Reels",
    shortTitleEN: "Cupistan AI Tart Reel",
    descriptionTR: "Cupistan için hazırlanan bu AI destekli Reels çalışması; tart ve kremalı tatlı ürünlerini çilek, çikolata, krema ve hamur dokularına odaklanan yakın plan kadrajlarla sunuyor. Makro ürün çekimi hissi veren sahneler ve farklı tatlı varyasyonları bir araya getirilerek Cupistan ürünleri sosyal medya için premium, iştah açıcı ve ürün merkezli kısa bir görsel anlatıma dönüştürülüyor.",
    descriptionEN: "This AI-assisted Reel for Cupistan presents tart and cream-based dessert products through close-up imagery focused on strawberry, chocolate, cream, and pastry textures. Macro-style product compositions and multiple dessert variations create a premium, appetizing, and product-led short-form presentation for social media.",
    fullDescriptionTR: "Cupistan için hazırlanan bu AI destekli Reels çalışmasında tart ve kremalı tatlı ürünleri, ürün dokusunu ve görsel iştah etkisini öne çıkaran yakın plan bir anlatımla sunuldu.\n\nVideo, çilekli ve kremalı tartın temiz ürün sunumuyla başlayarak dolgu, hamur ve krema yapısını gösteren daha yakın kadrajlara ilerliyor. Devam eden sahnelerde çikolata kaplaması, kremalı katmanlar ve tart tabanı gibi ürün detayları makro çekim hissi veren kompozisyonlarla öne çıkarılıyor.\n\nFarklı tatlı varyasyonlarının arka planda ve ana üründe birlikte kullanılması, çalışmaya tek ürün yakın planının ötesinde daha zengin bir pastane ürün dünyası kazandırıyor. Finalde ilustratif marka/maskot kapanışıyla çalışma tamamlanıyor.\n\nProje; AI video üretimi, gıda ürün görselleştirmesi ve makro ürün detayına dayalı kısa format sosyal medya anlatımını bir araya getirerek Cupistan’ın tatlı ürünlerini premium ve iştah odaklı bir dijital içerik formatında sunmak amacıyla hazırlandı.",
    fullDescriptionEN: "This AI-assisted Reel for Cupistan presents tart and cream-based dessert products through a close-up visual approach designed to emphasize texture and product appeal.\n\nThe sequence begins with a strawberry-and-cream tart composition before moving closer into pastry, filling, and cream details. Later scenes emphasize chocolate coating, cream layers, and tart-shell textures through macro-style food imagery.\n\nAdditional dessert variations appearing within the compositions create a broader pastry-product context beyond a single isolated item before the video concludes with an illustrated brand/mascot closing.\n\nThe project combines AI video production, food-product visualization, and macro product-detail storytelling to present Cupistan’s dessert range through a premium and appetizing short-form digital format.",
    client: "Cupistan",
    year: 2026,
    poster: "/videos/cupistan-ai-tart-tatli-urun-reels/poster.webp",
    src: "/videos/cupistan-ai-tart-tatli-urun-reels/video.mp4",
    duration: "0:08",
    servicesTR: [
      "AI Video Üretimi",
      "Ürün Görselleştirme",
      "Yemek Videosu",
      "Reels Kurgusu",
      "Sosyal Medya İçeriği"
    ],
    servicesEN: [
      "AI Video Production",
      "Product Visualization",
      "Food Video",
      "Reels Editing",
      "Social Media Content"
    ],
    tags: [
      "dessert",
      "tart",
      "pastry",
      "food visualization",
      "chocolate",
      "product visualization",
      "AI video",
      "reels"
    ],
    tools: [],
    featured: true,
    sortOrder: 20
  },
  {
    id: "cupistan-ai-lifestyle-tatli-reels",
    slug: "cupistan-ai-lifestyle-tatli-reels",
    type: "ai-reel",
    orientation: "portrait",
    aiAssisted: true,
    productionMethod: "ai-assisted",
    titleTR: "Cupistan AI Lifestyle Tatlı Reels Videosu",
    titleEN: "Cupistan AI Dessert Lifestyle Reel",
    shortTitleTR: "Cupistan AI Lifestyle Reels",
    shortTitleEN: "Cupistan AI Lifestyle Reel",
    descriptionTR: "Cupistan için hazırlanan bu AI destekli Reels çalışması; markanın tatlı ürünlerini mağaza atmosferi, gerçekçi lifestyle model kullanımı ve Cupistan markalı ambalajlarla birlikte sunuyor. Vitrinde ürün seçimi, kafe ortamında tatlı deneyimi ve mağaza önündeki lifestyle sahneleri bir araya getirilerek Cupistan’ın ürün ve marka deneyimi sosyal medya için sıcak, modern ve dinamik bir reklam formatında öne çıkarılıyor.",
    descriptionEN: "This AI-assisted Reel for Cupistan presents the brand’s dessert products through a pastry-shop setting, realistic lifestyle model imagery, and Cupistan-branded packaging. Product selection, café-style dessert moments, and storefront lifestyle scenes combine to present the Cupistan brand experience through a warm, modern, and dynamic short-form advertising format.",
    fullDescriptionTR: "Cupistan için hazırlanan bu AI destekli Reels çalışmasında markanın ürünleri yalnızca izole ürün görselleriyle değil, gerçekçi bir mağaza ve müşteri deneyimi içinde sunuldu.\n\nVideo boyunca modelin Cupistan mağazası ve tatlı vitriniyle etkileşimde olduğu sahneler kullanılırken; Cupistan markalı paketler, alışveriş çantası ve farklı tatlı ürünleri lifestyle anlatının doğal parçaları olarak kadraja dahil ediliyor.\n\nModelin vitrinde ürünleri incelemesi, kafe ortamında tatlı tüketmesi ve mağaza önünde Cupistan ürünleriyle birlikte görüntülenmesi, markanın fiziksel mağaza deneyimini ve ürün dünyasını aynı görsel hikâye içinde birleştiriyor.\n\nÇalışma; AI video üretimi, lifestyle reklam yaklaşımı, gıda ürün görselleştirmesi ve kısa format sosyal medya anlatımını bir araya getirerek Cupistan’ı yalnızca ürünler üzerinden değil, marka ve müşteri deneyimi üzerinden de tanıtan dinamik bir dijital içerik oluşturuyor.",
    fullDescriptionEN: "This AI-assisted Reel for Cupistan presents the brand’s products not only as isolated dessert visuals, but within a believable retail and customer-experience environment.\n\nThe sequence places a realistic lifestyle model inside and around the Cupistan store, incorporating branded packaging, shopping bags, pastry displays, and multiple dessert products as natural parts of the visual narrative.\n\nScenes of the model browsing the display, enjoying a dessert in the café environment, and appearing outside the storefront with Cupistan products connect the brand’s physical retail presence with its dessert range.\n\nThe project combines AI video production, lifestyle advertising, food-product visualization, and short-form social-media storytelling to present Cupistan through both its products and the wider brand experience.",
    client: "Cupistan",
    year: 2026,
    poster: "/videos/cupistan-ai-lifestyle-tatli-reels/poster.webp",
    src: "/videos/cupistan-ai-lifestyle-tatli-reels/video.mp4",
    duration: "0:08",
    servicesTR: [
      "AI Video Üretimi",
      "Lifestyle Video",
      "Gıda Ürün Görselleştirme",
      "Reels Kurgusu",
      "Sosyal Medya İçeriği"
    ],
    servicesEN: [
      "AI Video Production",
      "Lifestyle Video",
      "Food Product Visualization",
      "Reels Editing",
      "Social Media Content"
    ],
    tags: [
      "lifestyle",
      "store experience",
      "dessert",
      "food visualization",
      "branding",
      "AI video",
      "reels"
    ],
    tools: [],
    featured: true,
    sortOrder: 21
  }
];

export function getSortedVideos(): PortfolioVideo[] {
  return [...videosData].sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
}

export function getPortraitReels(): PortfolioVideo[] {
  return getSortedVideos().filter((v) => (v.orientation ?? "portrait") === "portrait");
}
