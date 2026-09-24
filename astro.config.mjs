import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({ output: 'server', adapter: vercel({ maxDuration: 60 }), vite: { plugins: [tailwindcss()] } });
