export interface SocialPlatformItem {
  id: string;
  label: string;
  icon: string;
  url: string;
}

export interface SocialLink {
  label: string;
  url: string;
}

export interface SocialsConfig {
  instagram: SocialLink;
  github: SocialLink;
  twitter: SocialLink;
  linkedin: SocialLink;
}

export const socialsConfig: SocialsConfig = {
  instagram: {
    label: "Instagram",
    url: "https://www.instagram.com/kerem.mhc/"
  },
  github: {
    label: "GitHub",
    url: "https://github.com/eigengraun"
  },
  twitter: {
    label: "X",
    url: "https://x.com/keremmihci"
  },
  linkedin: {
    label: "LinkedIn",
    url: "https://www.linkedin.com/in/kerem-mihci/"
  }
};

export const socialPlatformList: SocialPlatformItem[] = [
  {
    id: "instagram",
    label: "Instagram",
    icon: "/assets/icons/social/instagram.svg",
    url: socialsConfig.instagram.url
  },
  {
    id: "github",
    label: "GitHub",
    icon: "/assets/icons/social/github.svg",
    url: socialsConfig.github.url
  },
  {
    id: "x",
    label: "X",
    icon: "/assets/icons/social/x.svg",
    url: socialsConfig.twitter.url
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    icon: "/assets/icons/social/linkedin.svg",
    url: socialsConfig.linkedin.url
  }
];

