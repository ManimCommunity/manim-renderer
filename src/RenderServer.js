/* global __static */
/* eslint-disable */

var PROTO_PATH = __static + "/proto/renderserver.proto";

var grpc = require("@grpc/grpc-js");
var protoLoader = require("@grpc/proto-loader");
var packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
var render_proto = grpc.loadPackageDefinition(packageDefinition).renderserver;

var renderServer = new grpc.Server();
renderServer.addService(render_proto.RenderServer.service, {
  animationStatus: function(call, callback) {
    callback(null, {});
  },
});
renderServer.bindAsync(
  "0.0.0.0:50052",
  grpc.ServerCredentials.createInsecure(),
  (err, port) => {
    renderServer.start();
  }
);

export default renderServer;
