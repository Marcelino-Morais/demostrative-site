import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({envDir:false,base:'./',plugins:[react(),tailwindcss()],define:{'import.meta.env.VITE_API':JSON.stringify('on'),'import.meta.env.VITE_API_TOKEN':JSON.stringify('demonstracao-sem-acesso'),'import.meta.env.VITE_API_URL':JSON.stringify('')},server:{host:'127.0.0.1',port:5293,strictPort:true}});
