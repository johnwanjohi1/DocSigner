const webpack = require("@nativescript/webpack");
const path = require("path");

module.exports = (env) => {
	webpack.init(env);

	// Learn how to customize:
	// https://docs.nativescript.org/webpack

	// JSZip's default entry targets Node (streams/buffer). Use its self-contained browser build.
	webpack.chainWebpack((config) => {
		config.resolve.alias.set(
			"jszip$",
			path.resolve(__dirname, "node_modules/jszip/dist/jszip.min.js")
		);
	});

	return webpack.resolveConfig();
};
