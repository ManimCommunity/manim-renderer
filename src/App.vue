<template>
  <v-app>
    <div class="d-flex flex-column align-start pa-2">
      <div style="max-width: 853px">
        <v-toolbar>
          <div class="full-width d-flex justify-space-between">
            <div>{{ this.sceneName }}</div>
            <span>
              <v-icon :color="pythonReady ? 'black' : 'gray'">mdi-language-python</v-icon>
              <v-icon :color="pythonReady ? 'green' : 'gray'" class="text-caption">mdi-circle</v-icon>
            </span>
          </div>
        </v-toolbar>
        <canvas class="renderer-element" ref="renderer" />
        <Timeline
          :animations="animations"
          :index="animationIndex"
          :offset="animationOffset"
          @jump-to-animation="(index)=>jumpToAnimation(index)"
        />
        <div class="d-flex justify-space-between my-2">
          <div>
            <!--
            <v-btn
              @click="()=>jumpBackward()"
              :disabled="animationIndex === 0 && animationOffset === 0"
            >
              <v-icon dark>mdi-step-backward</v-icon>
            </v-btn>
            -->
            <!-- <v-btn class="ml-2" @click="()=>play()" :disabled="!pythonReady"> -->
            <v-btn class="ml-2" @click="()=>play()">
              <v-icon dark>mdi-play</v-icon>
            </v-btn>
            <!--
            <v-btn
              class="ml-2"
              @click="()=>jumpForward()"
              :disabled="animations.length === 0 || animationIndex === animations.length - 1 && animationOffset === 1"
            >
              <v-icon dark>mdi-step-forward</v-icon>
            </v-btn>
            -->
          </div>
          <v-btn @click="()=>controls.reset(animationIndex + 1)">reset camera</v-btn>
        </div>
      </div>
      <div class="d-flex">
        <!--
        <AnimationCard
          :animation="currentAnimation"
          :animation-offset="animationOffset"
          @step-backward="stepBackward"
          @step-forward="stepForward"
          @play-animation="()=>startAnimation(/*resetAnimations=*/false, /*singleAnimation=*/true)"
        />
        -->
        <DebugCard
          class="ml-2"
          :animation-index="animationIndex"
          :animation-offset="animationOffset"
          :playing="playing"
          :starting-new-animation="startingNewAnimation"
        />
      </div>
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
import AnimationCard from "./AnimationCard.vue";
import DebugCard from "./DebugCard.vue";

const path = require("path");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");

const PROTO_DIR = __static + "/proto";
const LOAD_OPTIONS = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
};

export default {
  name: "App",
  components: { Timeline, AnimationCard, DebugCard },
  data() {
    return {
      pythonReady: false,
      sceneName: null,
      animationOffset: 0,
      animationIndex: 0,
      animations: [],
      playing: false,
      startingNewAnimation: true,
      playSingleAnimation: false,
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
    this.waitingUntilTimestamp = null;
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
      if (
        0 <= this.animationIndex &&
        this.animationIndex < this.animations.length
      ) {
        return this.animations[this.animationIndex];
      } else {
        return { className: "No animation" };
      }
    },
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
      antialias: true,
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

    // Request startup information from Manim.
    this.frameClient = this.getFrameClient();
    this.frameClient.rendererStatus({}, (err, response) => {
      if (!err) {
        this.pythonReady = true;
        this.sceneName = response.scene_name;
      }
    });
  },
  methods: {
    play() {
      this.playing = true;
      requestAnimationFrame((timeStamp) => {
        this.playStartTimestamp = timeStamp;
        let renderLoop = (timeStamp) => {
          this.sceneOffset = (timeStamp - this.playStartTimestamp) / 1000;
          this.frameClient.getFrameAtTime(
            { scene_offset: this.sceneOffset },
            (err, response) => {
              if (err) {
                console.error(err);
                return;
              }
              this.updateSceneWithFrameResponse(response);
              if (!response.scene_finished) {
                requestAnimationFrame(renderLoop);
              } else {
                console.log("done");
                requestAnimationFrame(this.idleRender);
              }
            }
          );
        };
        requestAnimationFrame(renderLoop);
      });
    },
    idleRender() {
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(this.idleRender);
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
        newScene: (call, callback) => {
          callback(null, {});
          this.sceneName = call.request.name;
          this.pythonReady = true;
          this.scene.children = [];
          this.animationOffset = 0;
          this.animationIndex = 0;
        },
        animationStatus: (call, callback) => {
          callback(null, {});
          if (this.playing) {
            this.animationIndex += 1;
            this.animationOffset = 0;
            this.play();
          }
        },
        sceneFinished: (call, callback) => {
          callback(null, {});
          this.animationOffset = Math.round(this.animationOffset * 10) / 10;
          this.playing = false;
        },
        manimStatus: (call, callback) => {
          if (call.request.scene_finished) {
            this.playing = false;
          } else {
            for (let i = 0; i < call.request.animations.length; i++) {
              let anim = call.request.animations[i];
              this.$set(this.animations, i, {
                runtime: anim.duration,
                className: anim.name,
              });
            }
            this.animations.splice(call.request.animations.length);

            this.animationIndex = Math.min(
              this.animationIndex,
              this.animations.length - 1
            );
            this.animationOffset = 0;

            this.sceneName = call.request.scene_name;
            this.pythonReady = true;
            this.scene.children = [];
            this.startingNewAnimation = false;
          }
          callback(null, {});
        },
        updateScene: (call, callback) => {
          // Pass list of animations.
          // Request the frame.
          callback(null, {});
        },
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
    jumpBackward() {
      if (this.animationIndex === 0) {
        console.warn(
          "Attempted to step backward when there is no previous animation"
        );
      }
      if (this.animationOffset !== 0) {
        this.animationOffset = 0;
      } else {
        this.animationIndex -= 1;
        this.animationOffset = 0;
      }
      this.requestAndDisplayCurrentFrame();
    },
    jumpForward() {
      if (this.animationIndex === this.animations.length - 1) {
        this.animationOffset = this.animations[this.animationIndex].runtime;
      } else {
        this.animationIndex += 1;
        this.animationOffset = 0;
      }
      this.requestAndDisplayCurrentFrame();
    },
    stepBackward() {
      this.animationOffset = 0;
      this.requestAndDisplayCurrentFrame();
    },
    stepForward() {
      this.animationOffset = this.currentAnimation.runtime;
      this.requestAndDisplayCurrentFrame();
    },
    jumpToAnimation(animationIndex) {
      this.animationIndex = animationIndex;
      this.animationOffset = 0;
      this.requestAndDisplayCurrentFrame();
    },
    requestAndDisplayCurrentFrame() {
      this.frameClient.getFrameAtTime(
        {
          animation_index: this.animationIndex,
          animation_offset: this.animationOffset,
        },
        (err, response) => {
          this.updateSceneWithFrameResponse(response);
          this.renderer.render(this.scene, this.camera);
        }
      );
    },
  },
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
