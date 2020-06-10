module.exports = {
  transpileDependencies: ["vuetify"],
  pluginOptions: {
    electronBuilder: {
      nodeIntegration: true,
      externals: ["@grpc/proto-loader"],
      chainWebpackRendererProcess: (config) => {
        config.externals({
          "@grpc/proto-loader": "commonjs @grpc/proto-loader",
        });
      },
    },
  },
};
