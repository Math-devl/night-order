import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Night Order',
    short_name: 'Night Order',
    description: 'Gestion des commandes fournisseurs',
    start_url: '/mobile',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FFF0F5',
    theme_color: '#596643',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon-maskable.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
