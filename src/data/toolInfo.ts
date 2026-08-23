export interface ToolInfo {
  id: string;
  name: string;
  icon: string;
  titleTR: string;
  titleEN: string;
  descriptionTR: string;
  descriptionEN: string;
  buttonTR: string;
  buttonEN: string;
  preferredSize?: { width: number; height: number };
}

export const toolInfoData: Record<string, ToolInfo> = {
  photoshop: {
    id: "photoshop",
    name: "Adobe Photoshop",
    icon: "/assets/apps/photoshop.svg",
    titleTR: "Adobe Photoshop",
    titleEN: "Adobe Photoshop",
    descriptionTR: "Yeterli hafıza yok. Evet, işe başlamadan önce her şeyi temizlediğini biliyorum.",
    descriptionEN: "There's not enough memory. Yes, I know you cleaned everything before starting.",
    buttonTR: "Sıfırdan başla",
    buttonEN: "Start from scratch",
    preferredSize: { width: 400, height: 175 }
  },
  illustrator: {
    id: "illustrator",
    name: "Adobe Illustrator",
    icon: "/assets/apps/illustrator.svg",
    titleTR: "Adobe Illustrator",
    titleEN: "Adobe Illustrator",
    descriptionTR: "Hayır, bu şekilleri istediğin gibi birleştirmeyeceğim. Nedenini de açıklamayacağım.",
    descriptionEN: "No, I will not connect these shapes the way you want, and neither will I explain why.",
    buttonTR: "Merhamet dile",
    buttonEN: "Plead for mercy",
    preferredSize: { width: 400, height: 175 }
  },
  figma: {
    id: "figma",
    name: "Figma",
    icon: "/assets/icons/apps/figma.svg",
    titleTR: "Figma",
    titleEN: "Figma",
    descriptionTR: "Auto Layout çalışıyor. Şimdilik. Bir şeye dokunmamayı deneyelim.",
    descriptionEN: "Auto Layout is working. For now. Let's try not to touch anything.",
    buttonTR: "Dokunma",
    buttonEN: "Don't touch it",
    preferredSize: { width: 400, height: 155 }
  },
  canva: {
    id: "canva",
    name: "Canva",
    icon: "/assets/icons/apps/canva.svg",
    titleTR: "Canva",
    titleEN: "Canva",
    descriptionTR: "Bu sefer şablon değil. Sadece işi biraz hızlandırıyoruz.",
    descriptionEN: "Not a template this time. Just making the workflow a little faster.",
    buttonTR: "Devam Et",
    buttonEN: "Continue",
    preferredSize: { width: 400, height: 160 }
  },
  wordpress: {
    id: "wordpress",
    name: "WordPress",
    icon: "/assets/icons/apps/wordpress.svg",
    titleTR: "WordPress",
    titleEN: "WordPress",
    descriptionTR: "Eklenti güncellemesi var. Site çalışıyor. İkisini aynı anda düşünmemek daha iyi olabilir.",
    descriptionEN: "There's a plugin update. The site works. It may be better not to think about both at the same time.",
    buttonTR: "Sonra güncelle",
    buttonEN: "Update later",
    preferredSize: { width: 400, height: 185 }
  },
  vscode: {
    id: "vscode",
    name: "Visual Studio Code",
    icon: "/assets/icons/apps/vscode.svg",
    titleTR: "Visual Studio Code",
    titleEN: "Visual Studio Code",
    descriptionTR: "Çalışıyor. Neden çalıştığını anlamaya çalışarak bozmayalım.",
    descriptionEN: "It works. Let's not break it by figuring out why.",
    buttonTR: "Commit et",
    buttonEN: "Commit it",
    preferredSize: { width: 400, height: 155 }
  },
  antigravity: {
    id: "antigravity",
    name: "Antigravity",
    icon: "/assets/icons/apps/antigravity.svg",
    titleTR: "Antigravity",
    titleEN: "Antigravity",
    descriptionTR: "Plan hazır. Kod yazılıyor. Şimdi sadece tek bir şey kaldı: 'küçük bir revizyon daha.'",
    descriptionEN: "The plan is ready. The code is being written. Only one thing remains: 'one small revision.'",
    buttonTR: "Devam et",
    buttonEN: "Continue",
    preferredSize: { width: 400, height: 175 }
  },
  premiere: {
    id: "premiere",
    name: "Adobe Premiere Pro",
    icon: "/assets/apps/premiere.svg",
    titleTR: "Adobe Premiere Pro",
    titleEN: "Adobe Premiere Pro",
    descriptionTR: "Medya çevrimdışı değil. Premiere bugün dosyaların nerede olduğunu yeniden düşünmeye karar verdi.",
    descriptionEN: "The media isn't offline. Premiere just decided to reconsider where your files are today.",
    buttonTR: "Tekrar bağla",
    buttonEN: "Relink",
    preferredSize: { width: 400, height: 185 }
  },
  aftereffects: {
    id: "aftereffects",
    name: "Adobe After Effects",
    icon: "/assets/apps/after-effects.svg",
    titleTR: "Adobe After Effects",
    titleEN: "Adobe After Effects",
    descriptionTR: "Footage klasörünü temizledin mi? Harika. Şimdi bütün bağlantıları yeniden bulabiliriz.",
    descriptionEN: "Cleaned the footage folder? Great. Now we can find all those links again.",
    buttonTR: "Bu kadarı fazla",
    buttonEN: "This is too much",
    preferredSize: { width: 400, height: 175 }
  },
  capcut: {
    id: "capcut",
    name: "CapCut",
    icon: "/assets/icons/apps/capcut.svg",
    titleTR: "CapCut",
    titleEN: "CapCut",
    descriptionTR: "Video 9:16. Süre kısa. Revizyon sayısı uzun. Gayet normal.",
    descriptionEN: "Video: 9:16. Runtime: short. Revision list: long. Perfectly normal.",
    buttonTR: "Bir kez daha kes",
    buttonEN: "Cut it again",
    preferredSize: { width: 400, height: 170 }
  },
  higgsfield: {
    id: "higgsfield",
    name: "Higgsfield",
    icon: "/assets/icons/apps/higgsfield.svg",
    titleTR: "Higgsfield",
    titleEN: "Higgsfield",
    descriptionTR: "Son render neredeyse istediğin gibi. 'Neredeyse' kelimesine fazla takılmayalım.",
    descriptionEN: "The last render is almost what you wanted. Let's not focus too much on the word 'almost'.",
    buttonTR: "Tekrar üret",
    buttonEN: "Generate again",
    preferredSize: { width: 400, height: 175 }
  }
};
