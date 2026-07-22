import type { MetadataRoute } from 'next'

// Next's manifest file convention (app/manifest.ts) — auto-served at
// /manifest.webmanifest with the <link rel="manifest"> tag injected
// automatically, no changes needed in app/layout.tsx for that part.
//
// icons here point at static files in public/ (not the app/icon.png file
// convention) because the manifest needs stable, explicitly-sized URLs for
// the OS to fetch when installing to a home screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TenaTimmy',
    short_name: 'TenaTimmy',
    description: 'AI-powered tenant communication management',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#2a225c',
    theme_color: '#2a225c',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
