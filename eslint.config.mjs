// Next.js 16 ships a native ESLint flat config — spread it directly.
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  { ignores: ["node_modules/**", ".next/**", "_video/**", "docs/**", "coverage/**"] },
  ...nextCoreWebVitals,
];

export default eslintConfig;
