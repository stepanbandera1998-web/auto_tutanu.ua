import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';

// Passive event listeners for touch and wheel to improve scroll performance
(function() {
  const originalAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) {
    let newOptions = options;
    if (['touchstart', 'touchmove', 'wheel'].includes(type)) {
      if (typeof options === 'boolean') {
        newOptions = { capture: options, passive: true };
      } else if (typeof options === 'object' && options !== null) {
        newOptions = { ...options, passive: options.passive !== undefined ? options.passive : true };
      } else {
        newOptions = { passive: true };
      }
    }
    return originalAddEventListener.call(this, type, listener, newOptions);
  };
})();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
