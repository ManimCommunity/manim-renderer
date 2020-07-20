<template>
  <v-app>
    <div class="d-flex flex-column align-start">
      <v-toolbar :width="rendererWidth">
        <div class="full-width d-flex justify-space-between">
          <div>{{ this.sceneName }}</div>
          <span>
            <v-icon :color="pythonReady ? 'black' : 'gray'">mdi-language-python</v-icon>
            <v-icon :color="pythonReady ? 'green' : 'gray'" class="text-caption">mdi-circle</v-icon>
          </span>
        </div>
      </v-toolbar>
      <div style="max-width: 853px">
        <canvas class="renderer-element" ref="renderer" />
        <Timeline :animations="animations" :index="animationIndex" :offset="animationOffset" />
      </div>
      <div class="d-flex my-2">
        <v-btn
          class="ml-2"
          @click="()=>stepBackward()"
          :disabled="animationIndex === 0 && animationOffset === 0"
          fab
          small
        >
          <v-icon dark>mdi-skip-previous</v-icon>
        </v-btn>
        <v-btn
          v-if="animations.length > 0 && !playing && animationIndex === animations.length - 1 && animationOffset === 1"
          class="ml-2"
          @click="()=>startAnimation(/*resetAnimations=*/true)"
          :disabled="!pythonReady"
          fab
          small
        >
          <v-icon dark>mdi-replay</v-icon>
        </v-btn>
        <v-btn
          v-else
          class="ml-2"
          @click="()=>startAnimation(/*resetAnimations=*/false)"
          :disabled="!pythonReady"
          fab
          small
        >
          <v-icon dark>mdi-play</v-icon>
        </v-btn>
        <v-btn
          class="ml-2"
          @click="()=>stepForward()"
          :disabled="animations.length === 0 || animationIndex === animations.length - 1 && animationOffset === 1"
          fab
          small
        >
          <v-icon dark>mdi-skip-next</v-icon>
        </v-btn>
      </div>
      <v-btn @click="()=>controls.reset(animationIndex + 1)">reset camera</v-btn>
      <div class="text-h4 mt-3">{{currentAnimation ? currentAnimation.className : ""}}</div>
      <div class="text-h4 mt-3">{{animationOffset}}</div>
      <div class="text-h4 mt-3">this.playing = {{playing}}</div>
    </div>
  </v-app>
</template>

<script>
/* eslint-disable */
import * as THREE from "three";
import { Mobject } from "./Mobject.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as utils from "./utils.js";
import Timeline from "./Timeline.vue";

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
  components: { Timeline },
  data() {
    return {
      pythonReady: false,
      sceneName: null,
      animationOffset: 0,
      animationIndex: 0,
      animations: [],
      playing: false,
      newAnimation: false
    };
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

    this.frameClient = null;
    this.playStartTimestamp = null;
    this.waitStopTimestamp = null;
    this.animationWidth = 45;
  },
  computed: {
    sceneWidth() {
      return this.sceneHeight * this.aspectRatio;
    },
    rendererWidth() {
      return this.rendererHeight * this.aspectRatio;
    },
    currentAnimation() {
      return this.animations[this.animationIndex];
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

    this.frameClient = this.getFrameClient();
    this.frameClient.rendererStatus({}, (err, response) => {
      if (!err) {
        this.pythonReady = true;
        this.sceneName = response.scene_name;
      }
    });
  },
  methods: {
    idleRender() {
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(this.idleRender);
    },
    animate(currentTimestamp) {
      this.animationOffset =
        (currentTimestamp - this.playStartTimestamp) / 1000;
      if (this.waitStopTimestamp !== null) {
        if (currentTimestamp < this.waitStopTimestamp) {
          this.renderer.render(this.scene, this.camera);
          requestAnimationFrame(this.animate);
          return;
        } else {
          this.waitStopTimestamp = null;
        }
      }
      this.frameClient.getFrameAtTime(
        {
          animation_index: this.animationIndex,
          animation_offset: this.animationOffset
        },
        (err, response) => {
          if (err) {
            console.error(err);
            return;
          }
          if (
            response.animation_name !== "" &&
            (this.animations.length === 0 || this.newAnimation)
          ) {
            this.newAnimation = false;
            this.animations.push({
              runtime: response.duration,
              className: response.animation_name
            });
          }
          if (!response.frame_pending) {
            if (response.animation_finished) {
              this.animationIndex += 1;
              this.playStartTimestamp = currentTimestamp;
            }
            if (response.animation_name === "Wait" && response.duration != 0) {
              this.waitStopTimestamp =
                currentTimestamp + response.duration * 1000;
            }
            this.updateSceneWithFrameResponse(response);
            this.renderer.render(this.scene, this.camera);
            requestAnimationFrame(this.animate);
          } else {
            this.animationOffset = this.currentAnimation.runtime;
            requestAnimationFrame(this.idleRender);
          }
        }
      );
    },
    startAnimation(resetAnimations = false) {
      requestAnimationFrame(timeStamp => {
        if (resetAnimations) {
          this.animationIndex = 0;
          this.animations = [];
        }
        this.playing = true;
        this.animationOffset = 0;
        this.playStartTimestamp = timeStamp;
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
          this.animationIndex += 1;
          this.startAnimation();
          this.newAnimation = true;
        },
        manimStatus: (call, callback) => {
          if (call.request.scene_finished) {
            this.playing = false;
          } else {
            this.pythonReady = true;
            this.sceneName = call.request.scene_name;
            this.scene.children = [];
            this.animations = [];
            this.animationIndex = 0;
            this.animationOffset = 0;
          }
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
    },
    stepBackward() {
      if (this.animationOffset !== 0) {
        this.animationOffset = 0;
      } else {
        this.animationIndex -= 1;
        this.animationOffset = 1;
      }
      this.requestAndDisplayCurrentFrame();
    },
    stepForward() {
      if (this.animationOffset !== 1) {
        this.animationOffset = 1;
      } else {
        this.animationIndex += 1;
        this.animationOffset = 0;
      }
      this.requestAndDisplayCurrentFrame();
    },
    requestAndDisplayCurrentFrame() {
      this.frameClient.getFrameAtTime(
        {
          animation_index: this.animationIndex,
          animation_offset: this.animationOffset
        },
        (err, response) => {
          this.updateSceneWithFrameResponse(response);
          this.renderer.render(this.scene, this.camera);
        }
      );
    }
  }
};
</script>

<style>
.full-width {
  width: 100%;
}
body {
  margin: 0;
}
</style>
