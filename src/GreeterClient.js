/* global __static */

var PROTO_PATH = __static + "/proto/helloworld.proto";

var grpc = require("@grpc/grpc-js");
var protoLoader = require("@grpc/proto-loader");
var packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
var hello_proto = grpc.loadPackageDefinition(packageDefinition).helloworld;

var greeterClient = new hello_proto.Greeter(
  "localhost:50051",
  grpc.credentials.createInsecure()
);

export default greeterClient;
