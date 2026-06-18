import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// 1. Create a container for the widget on the host website
const hostElement = document.createElement('div');
hostElement.id = 'groundeddesk-widget-root';
// Align absolute or fixed position in container
hostElement.style.position = 'fixed';
hostElement.style.bottom = '0';
hostElement.style.right = '0';
hostElement.style.zIndex = '999999';
document.body.appendChild(hostElement);

// 2. Create the Shadow Root to encapsulate styles
const shadowRoot = hostElement.attachShadow({ mode: 'open' });

// 3. Create a div inside shadow root to mount the React app
const reactRoot = document.createElement('div');
reactRoot.id = 'widget-app';
shadowRoot.appendChild(reactRoot);

// 4. Copy styles from document head to shadow root (Vite dynamic style injection fallback)
const copyStyles = () => {
  const styles = document.querySelectorAll('style');
  styles.forEach((style) => {
    // Check if style is already copied or is a Tailwind/Vite style
    const isTailwind = style.textContent?.includes('tailwindcss') || style.textContent?.includes('slate') || style.getAttribute('data-vite-dev-id');
    if (isTailwind) {
      shadowRoot.appendChild(style.cloneNode(true));
    }
  });
};

// Execute immediately and set a small timeout for bundler injection
copyStyles();
setTimeout(copyStyles, 100);

// 5. Mount the React application inside Shadow DOM
createRoot(reactRoot).render(
  <App />
);
