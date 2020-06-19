<template>
  <v-app>
    <div class="d-flex flex-column align-start">
      <canvas class="renderer-element" ref="renderer" />
      <v-btn @click="()=>controls.reset()">reset camera</v-btn>
      <v-btn @click="()=>startAnimation()">animate</v-btn>
    </div>
  </v-app>
</template>

<script>
/* eslint-disable */
import * as THREE from "three";
import { Mobject } from "./Mobject.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as utils from "./utils.js";

const path = require("path");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");

const PROTO_DIR = __static + "/proto";
const LOAD_OPTIONS = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
};

export default {
  name: "App",
  components: {},
  data() {
    return {};
  },
  created() {
    this.fps = 15;
    this.aspectRatio = 16 / 9;
    this.rendererHeight = 480; // Set to 720 for 720p
    this.sceneHeight = 8;
    this.cameraNear = 1; // z = 10
    this.cameraFar = 21; // z = -10
    this.cameraZPosition = 11;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;

    this.frameData = [];

    // Maps Mobject IDs from Python to their respective Mobjects in
    // Javascript.
    this.mobjectDict = new Map();

    this.renderServer = this.getRenderServer();

    // This will be instantiated when rendering is begun.
    this.frameClient = null;
    this.animationStartTime = null;
    this.waitStopTime = null;
  },
  computed: {
    sceneWidth() {
      return this.sceneHeight * this.aspectRatio;
    },
    rendererWidth() {
      return this.rendererHeight * this.aspectRatio;
    }
  },
  mounted() {
    // Scene
    this.scene = new THREE.Scene();

    // Camera
    this.camera = new THREE.OrthographicCamera(
      /*left=*/ -this.sceneWidth / 2,
      /*right=*/ this.sceneWidth / 2,
      /*top=*/ this.sceneHeight / 2,
      /*bottom=*/ -this.sceneHeight / 2,
      /*near=*/ this.cameraNear,
      /*far=*/ this.cameraFar
    );
    this.camera.position.z = this.cameraZPosition;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.$refs.renderer,
      antialias: true
    });
    this.renderer.setSize(
      this.rendererHeight * this.aspectRatio,
      this.rendererHeight,
      false
    );

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    // Start render loop.
    this.idleRender();
  },
  methods: {
    idleRender() {
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(this.idleRender);
    },
    animate(currentTime) {
      if (this.waitStopTime !== null) {
        if (currentTime < this.waitStopTime) {
          this.renderer.render(this.scene, this.camera);
          requestAnimationFrame(this.animate);
          return;
        } else {
          this.waitStopTime = null;
        }
      }
      this.frameClient.getFrameAtTime(
        { time: (currentTime - this.animationStartTime) / 1000 },
        (err, response) => {
          if (err) {
            console.error(err);
            return;
          }
          if (!response.animation_finished) {
            if (response.duration != 0) {
              this.waitStopTime = currentTime + response.duration * 1000;
            }
            this.updateSceneWithFrameResponse(response);
            this.renderer.render(this.scene, this.camera);
            requestAnimationFrame(this.animate);
          } else {
            requestAnimationFrame(this.idleRender);
          }
        }
      );
    },
    startAnimation() {
      if (this.frameClient === null) {
        this.frameClient = this.getFrameClient();
      }
      requestAnimationFrame(timeStamp => {
        this.animationStartTime = timeStamp;
        this.animate(timeStamp);
      });
    },
    updateSceneWithFrameResponse(response) {
      this.scene.children = [];
      for (let mobject_proto of response.mobjects) {
        let [id, points, style, needsRedraw] = utils.extractMobjectProto(
          mobject_proto
        );
        let mobject_mesh;
        if (id in this.mobjectDict) {
          this.mobjectDict[id].update(points, style, needsRedraw);
          mobject_mesh = this.mobjectDict[id];
        } else {
          mobject_mesh = new Mobject(id, points, style);
          this.mobjectDict[id] = mobject_mesh;
        }
        this.scene.add(mobject_mesh);
      }
    },
    getRenderServer() {
      const packageDefinition = protoLoader.loadSync(
        path.join(PROTO_DIR, "renderserver.proto"),
        LOAD_OPTIONS
      );
      const renderProto = grpc.loadPackageDefinition(packageDefinition)
        .renderserver;
      const renderServer = new grpc.Server();
      renderServer.addService(renderProto.RenderServer.service, {
        animationStatus: (call, callback) => {
          callback(null, {});
          this.startAnimation();
        },
        ack: (call, callback) => {
          callback(null, {});
        }
      });
      renderServer.bindAsync(
        "localhost:50052",
        grpc.ServerCredentials.createInsecure(),
        (err, port) => {
          if (err) {
            console.error(err);
            return;
          }
          renderServer.start();
        }
      );
      return renderServer;
    },
    getFrameClient() {
      const packageDefinition = protoLoader.loadSync(
        path.join(PROTO_DIR, "frameserver.proto"),
        LOAD_OPTIONS
      );
      const frameProto = grpc.loadPackageDefinition(packageDefinition)
        .frameserver;
      return new frameProto.FrameServer(
        "localhost:50051",
        grpc.credentials.createInsecure()
      );
    }
  }
};
</script>

<style>
body {
  margin: 0;
}
</style>
