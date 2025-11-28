import type { Preview } from '@storybook/react-vite'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo'
    },

    viewport: {
      viewports: {
        iphoneSE: {
          name: 'iPhone SE',
          styles: { width: '375px', height: '667px' },
        },
        iphone14: {
          name: 'iPhone 14',
          styles: { width: '390px', height: '844px' },
        },
        iphone14ProMax: {
          name: 'iPhone 14 Pro Max',
          styles: { width: '430px', height: '932px' },
        },
        pixel7: {
          name: 'Pixel 7',
          styles: { width: '412px', height: '915px' },
        },
        galaxyS21: {
          name: 'Galaxy S21',
          styles: { width: '360px', height: '800px' },
        },
        ipadMini: {
          name: 'iPad Mini',
          styles: { width: '768px', height: '1024px' },
        },
        ipadPro: {
          name: 'iPad Pro 12.9"',
          styles: { width: '1024px', height: '1366px' },
        },
        desktop: {
          name: 'Desktop',
          styles: { width: '1728px', height: '900px' },
        },
      },
    },
  },
};

export default preview;