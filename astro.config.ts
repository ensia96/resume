import { defineConfig } from 'astro/config';
import { siteConfig } from './src/config/site';

export default defineConfig({
  site: siteConfig.siteURL,
  base: siteConfig.basePath,
  trailingSlash: 'always',
  output: 'static',
});
