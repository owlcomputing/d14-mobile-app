import daisyui from "daisyui";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      fontFamily: {
        mersad: "Mersad",
        satoshi: "Satoshi",
      },
    },
  },
  plugins: [
    daisyui,
    function ({ addComponents }) {
      addComponents({
        ".modal": {
          "@apply backdrop-blur-sm bg-opacity-50": {}, // Applies blur and transparency
        },
      });
    },
  ],
  daisyui: {
    themes: [
      {
        d14theme: {
          // Using black for background elements
          primary: "#ffffff", // White for primary text and elements
          "primary-focus": "#e0e0e0", // Slightly darker white for hover/focus
          "primary-content": "#000000", // Black text on primary elements

          // White text content on dark backgrounds
          secondary: "#ffffff", // White for content text
          "secondary-focus": "#e0e0e0", // Slightly darker white for hover/focus
          "secondary-content": "#1a1a1a", // Dark gray text on secondary elements

          // Accent colors for subtle highlights
          accent: "#ff0000", // Red for accents
          "accent-focus": "#e60000", // Darker red for hover/focus states
          "accent-content": "#ffffff", // White text on accent elements

          // Another accent color for variety
          neutral: "#1a1a1a", // Dark gray/black for neutral backgrounds
          "neutral-focus": "#333333", // Slightly lighter gray for hover/focus
          "neutral-content": "#ffffff", // White text on neutral backgrounds

          // Base colors for background and content areas
          "base-100": "#000000", // Black for primary background
          "base-200": "#1a1a1a", // Slightly lighter black for secondary background
          "base-300": "#333333", // Dark gray for borders, etc.
          "base-content": "#ffffff", // White text on base backgrounds

          // Informational colors for status messages
          info: "#3abff8", // Light blue for information messages
          success: "#36d399", // Green for success messages
          warning: "#fbbd23", // Yellow for warnings
          error: "#f87272", // Red for errors
        },
      },
      "dark",
    ],
  },
};
