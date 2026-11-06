import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Tipografia auto-hospedada (determinística, sem depender da rede):
// Inter (corpo) + Plus Jakarta Sans (display: títulos e valores).
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
import App from '@/App';
import '@/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
