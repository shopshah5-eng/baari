import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/login', '/signup', '/status'],
      disallow: ['/admin', '/desk', '/cabin', '/patients', '/api/'],
    },
    sitemap: 'https://baari-inky.vercel.app/sitemap.xml',
  };
}

