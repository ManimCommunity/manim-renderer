/* global __static */

var PROTO_PATH = __static + "/proto/frameserver.proto";

var grpc = require("@grpc/grpc-js");
var protoLoader = require("@grpc/proto-loader");
var packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
var frame_proto = grpc.loadPackageDefinition(packageDefinition).frameserver;

var frameClient = new frame_proto.FrameServer(
  "localhost:50051",
  grpc.credentials.createInsecure()
);

export default frameClient;
