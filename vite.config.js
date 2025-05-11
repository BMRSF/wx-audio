import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";
import autoprefixer from "autoprefixer";
import { ViteMinifyPlugin } from "vite-plugin-minify";
import magiskPlugin from './vite-plugin-magisk.js';

export default defineConfig({
  root: "./src",
  plugins: [
    ViteMinifyPlugin({}),
    mkcert(),
    magiskPlugin({
      zipName: "wx-audio.zip",
    }),
  ],
  server: {
    host: "0.0.0.0",
    port: 3000,
    https: true,
  },
  css: {
    postcss: {
      plugins: [autoprefixer],
    },
  },
  build: {
    outDir: "../dist",
  },
});
