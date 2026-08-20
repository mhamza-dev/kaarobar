import { defineConfig, loadEnv } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@shared': path.resolve(__dirname, 'shared'),
      },
    },
    plugins: [
      react(),
      electron({
        main: {
          entry: 'electron/main.ts',
          vite: {
            define: {
              'process.env.KAAROBAR_SUPABASE_URL': JSON.stringify(
                env.KAAROBAR_SUPABASE_URL ?? '',
              ),
              'process.env.KAAROBAR_SUPABASE_ANON_KEY': JSON.stringify(
                env.KAAROBAR_SUPABASE_ANON_KEY ?? '',
              ),
              'process.env.KAAROBAR_LICENSE_SECRET': JSON.stringify(
                env.KAAROBAR_LICENSE_SECRET ?? '',
              ),
            },
            build: {
              rollupOptions: {
                // Keep native/CJS modules external so ESM main bundle
                // does not inline `require(...)` code paths.
                external: [
                  'better-sqlite3',
                  'electron-store',
                  'bcryptjs',
                  // Loads its own renderer HTML from the package directory at
                  // runtime, so it must not be inlined into the main bundle.
                  'electron-pos-printer',
                ],
              },
            },
          },
        },
        preload: {
          input: path.join(__dirname, 'electron/preload.ts'),
        },
        renderer: process.env.NODE_ENV === 'test' ? undefined : {},
      }),
    ],
  }
})
