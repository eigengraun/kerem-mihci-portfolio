export interface ExperienceItem {
  id: string;
  roleTR: string;
  roleEN: string;
  organization: string;
  startDate: string;
  endDateTR: string;
  endDateEN: string;
  locationTR?: string;
  locationEN?: string;
  typeTR?: string;
  typeEN?: string;
  descriptionTR: string;
  descriptionEN: string;
  skills?: string[];
  category?: "work" | "freelance" | "ai" | "creative" | "volunteer";
}

export interface EducationItem {
  id: string;
  institutionTR: string;
  institutionEN: string;
  programTR: string;
  programEN: string;
  startYear?: string;
  endYearTR?: string;
  endYearEN?: string;
  descriptionTR?: string;
  descriptionEN?: string;
  statusTR?: string;
  statusEN?: string;
}

export interface ProfileStat {
  value: string;
  labelTR: string;
  labelEN: string;
}

export interface SkillItem {
  tr: string;
  en: string;
}

export interface ProfileSkills {
  design: SkillItem[];
  web: SkillItem[];
  production: SkillItem[];
  ai: SkillItem[];
  strategy: SkillItem[];
  tools: string[];
}

export interface ProfileData {
  name: string;
  headlineTR: string;
  headlineEN: string;
  locationTR: string;
  locationEN: string;
  email: string;
  image: string;
  avatar: string;
  altTR: string;
  altEN: string;
  summaryTR: string[];
  summaryEN: string[];
  stats: ProfileStat[];
  focusAreasTR: string[];
  focusAreasEN: string[];
  notes: {
    titleTR: string;
    titleEN: string;
    filename: string;
    itemsTR: string[];
    itemsEN: string[];
  };
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: ProfileSkills;
  cv: {
    trPath: string;
    enPath: string;
    trAvailable: boolean;
    enAvailable: boolean;
  };
}

export const profileData: ProfileData = {
  name: "Kerem Mıhçı",
  headlineTR: "Tasarımcı • Web Tasarımcısı • Dijital Üretici",
  headlineEN: "Designer • Web Designer • Digital Creator",
  locationTR: "İstanbul, Türkiye",
  locationEN: "Istanbul, Türkiye",
  email: "info@keremmihci.com",
  image: "/profile/kerem-mihci-profile.webp",
  avatar: "/profile/kerem-mihci-avatar.webp",
  altTR: "Kerem Mıhçı, fotoğraf makinesiyle portre.",
  altEN: "Portrait of Kerem Mıhçı holding a camera.",
  summaryTR: [
    "Dijital dünyada tasarım, web, marka kimliği ve yaratıcı üretimi bir araya getirerek markalar için amaca hizmet eden görsel ve dijital deneyimler üretiyorum.",
    "İşim yalnızca güzel görünen işler üretmek değil; markanın kimliğine, hedeflerine ve kullanıcı deneyimine uygun sürdürülebilir çözümler geliştirmek.",
    "Çalışmalarımda tasarım ve teknolojiyi birlikte kullanıyor, yapay zekâ araçlarını yaratıcı süreci destekleyen bir üretim aracı olarak değerlendiriyorum."
  ],
  summaryEN: [
    "I combine design, web engineering, brand identity, and creative production to build purposeful visual and digital experiences for brands.",
    "My work is not only about creating visually appealing graphics; I focus on building sustainable solutions aligned with a brand's identity, goals, and user experience.",
    "I combine design and technology throughout my process, leveraging AI capabilities as part of a modern creative workflow."
  ],
  stats: [
    { value: "4+", labelTR: "Yıllık Tecrübe", labelEN: "Years Experience" },
    { value: "140+", labelTR: "Tamamlanan Proje", labelEN: "Completed Projects" },
    { value: "50+", labelTR: "Marka / Firma", labelEN: "Brands & Clients" },
    { value: "3+", labelTR: "Yıldır AI Üretim", labelEN: "Years AI Production" }
  ],
  focusAreasTR: [
    "Grafik Tasarım & Marka Kimliği",
    "Web Tasarımı & Full-Stack Geliştirme",
    "Motion & Reels Prodüksiyonu",
    "AI Destekli Yaratıcı Üretim",
    "Teknik SEO & Dijital Görünürlük"
  ],
  focusAreasEN: [
    "Graphic Design & Brand Identity",
    "Web Design & Full-Stack Development",
    "Motion & Reels Production",
    "AI-Assisted Creative Production",
    "Technical SEO & Digital Visibility"
  ],
  notes: {
    titleTR: "NOTLAR — GENEL",
    titleEN: "NOTES — GENERAL",
    filename: "system.txt",
    itemsTR: [
      "hizalama göze doğru geliyorsa bazen grid'den daha önemlidir",
      "logo küçük boyutta da çalışmalı",
      "ilk frame önemli, son frame de öyle",
      "fazla hareket her zaman daha iyi hareket değildir",
      "yazılar son frame'e kadar okunmalı",
      "iyi tasarım sadece güzel görünmek değildir",
      "export almadan önce son kez kontrol et",
      "bir varyasyon daha al"
    ],
    itemsEN: [
      "if the alignment looks right, sometimes that matters more than the grid",
      "a logo still needs to work small",
      "the first frame matters, so does the last",
      "more movement isn't always better movement",
      "text should remain readable until the last frame",
      "good design is more than just looking good",
      "check everything one last time before export",
      "make one more variation"
    ]
  },
  experience: [
    {
      id: "emix-creative",
      roleTR: "Kreatif Tasarımcı & Dijital İçerik Üreticisi",
      roleEN: "Creative Designer & Digital Content Creator",
      organization: "eMix Creative",
      startDate: "2025",
      endDateTR: "Devam Ediyor",
      endDateEN: "Present",
      descriptionTR: "Marka kimliği, dijital içerik prodüksiyonu, sosyal medya kreatifleri ve responsive web tasarımı süreçlerini yürütüyorum.",
      descriptionEN: "Leading brand identity development, digital content production, social media creatives, and responsive web design workflows.",
      skills: ["Brand Identity", "Web Design", "Digital Content", "AI Production"],
      category: "work"
    },
    {
      id: "freelance",
      roleTR: "Freelance Web & Grafik Tasarımcısı",
      roleEN: "Freelance Web & Graphic Designer",
      organization: "Bağımsız Projeler / Freelance",
      startDate: "2021",
      endDateTR: "Devam Ediyor",
      endDateEN: "Present",
      descriptionTR: "Farklı ölçekteki markalar için kurumsal web siteleri, logo tasarımları, basılı / dijital yayınlar ve SEO optimizasyon projeleri gerçekleştiriyorum.",
      descriptionEN: "Building corporate websites, brand identities, editorial designs, and SEO optimization for diverse clients.",
      skills: ["Web Development", "UI/UX", "Graphic Design", "SEO"],
      category: "freelance"
    },
    {
      id: "ai-trainer",
      roleTR: "AI Model Değerlendirici & Kreatif AI Prodüksiyon",
      roleEN: "AI Model Evaluator & Creative AI Production",
      organization: "AI & Görsel Teknolojiler",
      startDate: "2023",
      endDateTR: "Devam Ediyor",
      endDateEN: "Present",
      descriptionTR: "Yapay zekâ görsel ve metin modellerinin değerlendirilmesi, prompt tasarımı, içerik kalitesi denetimi ve yaratıcı iş akışlarına AI entegrasyonu.",
      descriptionEN: "Evaluating visual and language models, prompt engineering, content quality assessment, and integrating AI into creative pipelines.",
      skills: ["AI Workflows", "Prompt Engineering", "Model Evaluation"],
      category: "ai"
    },
    {
      id: "art-director",
      roleTR: "Grafik Tasarımcı & Sanat Yönetmeni",
      roleEN: "Graphic Designer & Art Director",
      organization: "Tasarım Ajansı",
      startDate: "2022",
      endDateTR: "2024",
      endDateEN: "2024",
      descriptionTR: "Reklam kampanyaları, marka lansman görselleri, ambalaj / katalog tasarımları ve video kurgu projelerinin yürütülmesi.",
      descriptionEN: "Executing advertising campaigns, brand launches, editorial print layouts, and promotional video edits.",
      skills: ["Graphic Design", "Editorial Design", "Video Editing"],
      category: "creative"
    },
    {
      id: "alchemia",
      roleTR: "Kreatif Editör & Yayın Tasarımcısı",
      roleEN: "Creative Editor & Layout Designer",
      organization: "Alchemia E-Dergisi",
      startDate: "2024",
      endDateTR: "2025",
      endDateEN: "2025",
      descriptionTR: "Dijital dergi konsept tasarımı, tipografik mizanpaj, kapak tasarımları ve içerik kurgusu.",
      descriptionEN: "Digital magazine concept design, typographic layout, cover art, and editorial direction.",
      skills: ["Editorial Design", "Typography", "Art Direction"],
      category: "creative"
    }
  ],
  education: [
    {
      id: "iuc-engineering",
      institutionTR: "İstanbul Üniversitesi - Cerrahpaşa",
      institutionEN: "Istanbul University - Cerrahpasa",
      programTR: "Elektrik-Elektronik Mühendisliği",
      programEN: "Electrical & Electronics Engineering",
      startYear: "2020",
      endYearTR: "Devam Ediyor",
      endYearEN: "Present",
      descriptionTR: "Mühendislik altyapısı, algoritmik düşünme, analitik problem çözme ve dijital sistemler eğitimi.",
      descriptionEN: "Engineering fundamentals, algorithmic thinking, analytical problem solving, and digital systems.",
      statusTR: "Lisans Eğitimi",
      statusEN: "Bachelor's Degree"
    },
    {
      id: "duzce-fen-lisesi",
      institutionTR: "Düzce Fen Lisesi",
      institutionEN: "Düzce Fen Lisesi",
      programTR: "Lise",
      programEN: "High School",
      statusTR: "Lise Eğitimi",
      statusEN: "High School Education"
    }
  ],
  skills: {
    design: [
      { tr: "Grafik Tasarım", en: "Graphic Design" },
      { tr: "Marka Kimliği", en: "Brand Identity" },
      { tr: "Logo Tasarımı", en: "Logo Design" },
      { tr: "Tipografi", en: "Typography" },
      { tr: "Sosyal Medya Tasarımı", en: "Social Media Design" },
      { tr: "Reklam Kreatifleri", en: "Advertising Creatives" },
      { tr: "Editorial Tasarım", en: "Editorial Design" }
    ],
    web: [
      { tr: "Web Tasarımı", en: "Web Design" },
      { tr: "Responsive Design", en: "Responsive Design" },
      { tr: "UI / UX", en: "UI / UX" },
      { tr: "WordPress", en: "WordPress" },
      { tr: "SEO", en: "SEO" },
      { tr: "Web Development", en: "Web Development" },
      { tr: "Next.js", en: "Next.js" },
      { tr: "Tailwind CSS", en: "Tailwind CSS" }
    ],
    production: [
      { tr: "Motion Design", en: "Motion Design" },
      { tr: "Video Editing", en: "Video Editing" },
      { tr: "Reels Prodüksiyonu", en: "Reels Production" },
      { tr: "Kreatif Prodüksiyon", en: "Creative Production" },
      { tr: "Görsel Hikaye Anlatıcılığı", en: "Visual Storytelling" }
    ],
    ai: [
      { tr: "AI Destekli Yaratıcı Üretim", en: "AI-Assisted Creative Production" },
      { tr: "AI Video", en: "AI Video" },
      { tr: "Prompt Tasarımı & İş Akışları", en: "Prompt Engineering & Workflows" },
      { tr: "Model Değerlendirme & Eğitimi", en: "Model Evaluation & Training" }
    ],
    strategy: [
      { tr: "Dijital Pazarlama", en: "Digital Marketing" },
      { tr: "İçerik Stratejisi", en: "Content Strategy" },
      { tr: "Marka Konumlandırma", en: "Brand Positioning" },
      { tr: "Teknik SEO", en: "Technical SEO" }
    ],
    tools: [
      "Adobe Photoshop",
      "Adobe Illustrator",
      "Adobe Premiere Pro",
      "Adobe After Effects",
      "Figma",
      "Canva",
      "WordPress",
      "VS Code",
      "Antigravity",
      "CapCut",
      "Higgsfield"
    ]
  },
  cv: {
    trPath: "/cv/kerem-mihci-cv-tr.pdf",
    enPath: "/cv/kerem-mihci-cv-en.pdf",
    trAvailable: false,
    enAvailable: false
  }
};
