import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'DenkenAI — Academic Performance Intelligence',
    short_name: 'DenkenAI',
    description: 'AI-powered adaptive learning platform for JEE, NEET, and CBSE students.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0B0E14',
    theme_color: '#8762F7',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
