import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { JetBrains_Mono, Outfit } from 'next/font/google';
import '@/src/index.css';
import { APP_NAME_TITLE, APP_SLOGAN } from '@/lib/constants';

const outfit = Outfit({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-outfit',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
});

export const metadata: Metadata = {
  title: APP_NAME_TITLE,
  description: `${APP_NAME_TITLE} — ${APP_SLOGAN}`,
  icons: { icon: '/pumangol-logo-oficial.png' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: o script abaixo aplica a classe `dark` antes da hidratação
    <html lang="pt-AO" className={`${outfit.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Emblema do loader global: carregado cedo para aparecer logo no primeiro ecrã */}
        <link rel="preload" as="image" href="/people-connect-emblema.png" />
      </head>
      <body className={outfit.className}>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('pumangol-tema')==='escuro')document.documentElement.classList.add('dark')}catch(e){}})();`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
