/*
 *
 * Copyright 2015 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

/* eslint-disable */
let PROTO_PATH = __static + "/protos/frame_server.proto";
var grpc = require("@grpc/grpc-js");
let protoLoader = require("@grpc/proto-loader");

let packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
let protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
let frameserver = protoDescriptor.frameserver;
let frameServerClient = new frameserver.FrameServer(
  "localhost:50051",
  grpc.credentials.createInsecure()
);

export default frameServerClient;

function main() {
  // let client = new hello_proto.Greeter(
  //   "localhost:50051",
  //   grpc.credentials.createInsecure()
  // );
  // let user;
  // if (process.argv.length >= 3) {
  //   user = process.argv[2];
  // } else {
  //   user = "world";
  // }
  // client.sayHello({ name: user }, function(err, response) {
  //   console.log("Greeting:", response.message);
  // });
}

main();
