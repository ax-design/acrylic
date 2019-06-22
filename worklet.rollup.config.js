import typescript from 'rollup-plugin-typescript2';
import babelminify from 'rollup-plugin-babel-minify';

const config = {
  input: ['./src/acrylicPaintWorklet.ts'],
  output: {
    format: 'esm',
    file: './build/acrylic-worklet.js.txt',
  },
  plugins: [babelminify(), typescript()]
};

export default config;
