const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const WasmPackPlugin = require('@wasm-tool/wasm-pack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const outPath = path.resolve(__dirname, 'public');

module.exports = {
    entry: {
        index: './src/index.ts',
    },
    output: {
        path: outPath,
        filename: '[name].js',
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                },
            },
        ],
    },
    resolve: {
        extensions: ['.ts', '.js', '.json'],
    },
    plugins: [
        new CopyPlugin({
            patterns: [{ from: 'static', to: outPath }],
        }),
        new WasmPackPlugin({
            crateDirectory: path.resolve(__dirname, 'crate'),
        }),
        new HtmlWebpackPlugin({
            template: 'src/index.html',
        }),
    ],
    experiments: {
        asyncWebAssembly: true,
    },
};
