const { merge } = require('webpack-merge');
const common = require('./webpack.common.config');

module.exports = merge(common, {
    mode: 'production', // Because WASM is slow in development.
    devtool: 'inline-source-map',
    devServer: {
        contentBase: common.output.path,
    },
});
