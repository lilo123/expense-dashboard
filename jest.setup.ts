import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

Object.assign(global, { TextEncoder, TextDecoder });

if (typeof Request === 'undefined') {
  (global as any).Request = class Request {};
}
if (typeof Response === 'undefined') {
  (global as any).Response = class Response {};
}

// 1. JSDOM Layout Engine Mocks & Polyfills (Guarded for Node/Server test compatibility)
if (typeof window !== 'undefined') {
  if (window.HTMLElement && window.HTMLElement.prototype) {
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
    window.HTMLElement.prototype.scrollTo = jest.fn();
  }

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // Deprecated
      removeListener: jest.fn(), // Deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

if (typeof global !== 'undefined') {
  class ResizeObserverMock {
    observe = jest.fn();
    unobserve = jest.fn();
    disconnect = jest.fn();
  }
  global.ResizeObserver = ResizeObserverMock;

  class IntersectionObserverMock {
    observe = jest.fn();
    unobserve = jest.fn();
    disconnect = jest.fn();
  }
  global.IntersectionObserver = IntersectionObserverMock as any;
}

// 2. Strict React Warning/Error Console Guard
const FORBIDDEN_PATTERNS = [
  /not wrapped in act/i,
  /Each child in a list should have a unique "key" prop/i,
  /React does not recognize the.*prop on a DOM element/i,
  /Text content did not match|Hydration failed/i,
  /Can't perform a React state update on an unmounted component/i,
  /React.hydration/i,
];

const originalWarn = console.warn;
const originalError = console.error;

console.warn = (...args: any[]) => {
  const message = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : arg)).join(' ');
  if (FORBIDDEN_PATTERNS.some(pattern => pattern.test(message))) {
    throw new Error(`[TEST FAILURE - React Warning Detected]: ${message}`);
  }
  originalWarn(...args);
};

console.error = (...args: any[]) => {
  const message = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : arg)).join(' ');
  if (FORBIDDEN_PATTERNS.some(pattern => pattern.test(message))) {
    throw new Error(`[TEST FAILURE - React Error Detected]: ${message}`);
  }
  originalError(...args);
};


