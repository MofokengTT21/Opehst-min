/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain NativeWind classes
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ophest: {
          DEFAULT: '#0071e3', // Apple Action Blue
          muted: '#0071e333', 
        },
        surface: {
          background: 'rgba(var(--surface-background), <alpha-value>)',
          card: 'rgba(var(--surface-card), <alpha-value>)',
          border: 'rgba(var(--surface-border), <alpha-value>)',
        },
        text: {
          primary: 'rgba(var(--text-primary), <alpha-value>)',
          secondary: 'rgba(var(--text-secondary), <alpha-value>)',
          brand: '#ffffff', // Always white on top of the Ophest brand color
        },
        semantic: {
          breakdown: '#ef4444', 
          jobcard: '#3b82f6',   
          audit: '#22c55e',     
          kaizen: '#f59e0b',    
        }
      }
    },
  },
  plugins: [],
}
