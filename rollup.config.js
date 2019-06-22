import typescript from 'rollup-plugin-typescript2';
import babelminify from 'rollup-plugin-babel-minify';
import { string } from "rollup-plugin-string";

const config = {
    input: ['./src/index.ts'],
    output: {
        file: './build/main.js',
        format: 'umd',
        name: 'AxAcrylic'
    },
    plugins: [babelminify(), typescript(), string(
        {
            include: './build/acrylic-worklet.js.txt'
        }
    )]
};

export default config;
