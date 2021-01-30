<template>
  <v-app>
    <div class="d-flex flex-column pa-2">
      <div class="d-flex flex-column">
        <v-toolbar class="rounded-t">
          <div class="full-width d-flex justify-space-between">
            <div class="text-h5">{{ this.sceneName }}</div>
            <span>
              <v-icon :color="pythonReady ? 'black' : 'gray'">
                mdi-language-python
              </v-icon>
              <v-icon
                :color="pythonReady ? 'green' : 'gray'"
                class="text-caption"
                >mdi-circle</v-icon
              >
            </span>
          </div>
        </v-toolbar>
        <canvas class="full-width" ref="renderer" />
        <Timeline
          :animations="animations"
          :index="animationIndex"
          :offset="animationOffset"
          :animationRange="animationRange"
          @jump-to-animation="(index) => jumpToAnimation(index)"
          @set-preview-start="(index) => animationRange.splice(0, 1, index)"
          @set-preview-end="(index) => animationRange.splice(1, 1, index)"
          @set-preview-image="
            (index) => animationRange.splice(0, 2, index, index) && play()
          "
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
            <v-btn v-if="!playing" class="ml-2" @click="() => play()">
              <v-icon dark>mdi-play</v-icon>
            </v-btn>
            <v-btn
              v-else
              class="ml-2"
              @click="
                () => {
                  console.log('not implemented');
                }
              "
            >
              <v-icon dark>mdi-pause</v-icon>
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
          <v-btn @click="() => controls.reset(animationIndex + 1)"
            >reset camera</v-btn
          >
        </div>
      </div>
      <!--
      <div class="d-flex">
        <AnimationCard
          :animation="currentAnimation"
          :animation-offset="animationOffset"
          @step-backward="stepBackward"
          @step-forward="stepForward"
          @play-animation="()=>startAnimation(/*resetAnimations=*/false, /*singleAnimation=*/true)"
        />
        <DebugCard
          class="ml-2"
          :animation-name="animationName"
          :animation-index="animationIndex"
          :animation-offset="animationOffset"
          :playing="playing"
        />
      </div>
      -->
    </div>
  </v-app>
</template>

<script>
/* eslint-disable */
/* global __static */
import * as THREE from "three";
import { Mobject, ImageMobject } from "./Mobject.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as utils from "./utils.js";
import Timeline from "./Timeline.vue";
import DebugCard from "./DebugCard.vue";

const fs = require("fs");
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
  components: { Timeline, DebugCard },
  data() {
    return {
      pythonReady: false,
      sceneName: null,
      animationOffset: 0,
      animationIndex: 0,
      animationName: "",
      animations: [],
      playing: false,
      animationRange: [0, 0],
    };
  },
  created() {
    this.aspectRatio = 16 / 9;
    this.rendererHeight = 720; // Set to 720 for 720p
    this.sceneHeight = 8;
    this.cameraNear = 1; // z = 10
    this.cameraFar = 21; // z = -10
    this.cameraZPosition = 11;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;

    // Maps Mobject IDs from Python to their respective Mobjects in
    // Javascript.
    this.mobjectDict = new Map();

    this.renderServer = this.getRenderServer();
    this.frameClient = this.getFrameClient();

    this.tweenAnimations = [];
    this.allAnimationsTweened = false;

    this.animationStartTime = 0;
    this.startingNewAnimation = false;
  },
  computed: {
    console: () => console,
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
    this.controls.screenSpacePanning = true;

    // Start render loop.
    this.idleRender();

    // Request startup information from Manim.
    this.frameClient.fetchSceneData({}, (error, response) => {
      if (error) {
        console.error(error);
        return;
      }
      fs.watchFile(response.path, {interval: 1000}, () => {
        this.frameClient.scriptUpdated({}, (err, res) => {
          if (err) {
            console.error(err);
            // return;
          }
        });
      });
      this.updateSceneData(response);
    });
  },
  methods: {
    play() {
      this.playing = true;
      this.firstRequest = true;
      this.animationIndex = this.animationRange[0];
      this.startingNewAnimation = true;
      requestAnimationFrame(this.renderLoop);
    },
    renderLoop(timeStamp) {
      if (this.startingNewAnimation) {
        this.animationStartTime = timeStamp;
        this.startingNewAnimation = false;
      }
      this.animationOffset = (timeStamp - this.animationStartTime) / 1000;
      if (!this.allAnimationsTweened) {
        this.frameClient.getFrameAtTime(
          {
            end_index: this.animationRange[1],
            first_request: this.firstRequest,
            animation_index: this.animationIndex,
            animation_offset: this.animationOffset,
          },
          (err, response) => {
            this.handleFrameResponse(err, response, timeStamp);
          }
        );
      } else {
        this.tweenAnimatedMobjects();
      }
    },
    handleFrameResponse(err, response, timeStamp) {
      if (err) {
        console.error(err);
        return;
      }

      // Update information.
      this.startingNewAnimation =
        this.firstRequest || response.animation_index > this.animationIndex;
      this.firstRequest = false;
      this.animationOffset = response.animation_offset;
      this.animationIndex = response.animation_index;
      this.animationName = this.currentAnimation.name;
      if (response.animations.length > 1) {
        this.animationName += "...";
      }
      this.allAnimationsTweened = response.all_animations_tweened;

      // Update the scene.
      this.updateSceneWithFrameResponse(response);

      // Save tween data after first render so that all mobjects are drawn at first.
      if (this.startingNewAnimation) {
        this.tweenAnimations = response.animations;
      }

      if (!response.scene_finished) {
        requestAnimationFrame(this.renderLoop);
      } else {
        this.resetAnimationData();
        requestAnimationFrame(this.idleRender);
      }
    },
    tweenAnimatedMobjects() {
      if (this.animationOffset > this.currentAnimation.duration) {
        this.allAnimationsTweened = false;
        requestAnimationFrame(this.renderLoop);
        return;
      }

      for (let animation of this.tweenAnimations) {
        for (let mobjectTweenData of animation.mobject_tween_data) {
          this.doAnimationTween(animation, mobjectTweenData);
        }
      }
      requestAnimationFrame(this.renderLoop);
    },
    resetAnimationData() {
      this.animationName = "";
      this.playing = false;
      this.tweenAnimations = [];
      this.allAnimationsTweened = false;
      for (let id of this.mobjectDict.keys()) {
        this.mobjectDict.get(id).dispose();
      }
      this.mobjectDict = new Map();
    },
    idleRender() {
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(this.idleRender);
    },
    doAnimationTween(animation, mobjectTweenData) {
      let mobject = this.mobjectDict.get(mobjectTweenData.id);
      let alpha = utils[animation.easing_function](
        this.animationOffset / animation.duration
      );

      for (let attributeTweenData of animation.attribute_tween_data) {
        let { attribute, start_data, end_data } = attributeTweenData;
        if (attribute === "position") {
          mobject.position.copy(
            new THREE.Vector3(...start_data)
              .lerp(new THREE.Vector3(...end_data), alpha)
              .add(new THREE.Vector3(...mobjectTweenData.root_mobject_offset))
          );
        } else if (attributeTweenData.attribute === "stroke_opacity") {
          mobject.setStrokeOpacity(
            utils.interpolate(start_data[0], end_data[0], alpha)
          );
        } else if (attributeTweenData.attribute === "fill_opacity") {
          mobject.setFillOpacity(
            utils.interpolate(start_data[0], end_data[0], alpha)
          );
        } else {
          console.error(`Unable to tween unknown attribute ${attribute}.`);
        }
      }
    },
    updateSceneWithFrameResponse(response) {
      // Remove.
      this.removeIdsFromScene(response.frame_data.remove);

      // Add.
      for (let mobjectProto of response.frame_data.add) {
        let mobjectId = mobjectProto.id;
        if (this.mobjectDict.has(mobjectId)) {
          this.mobjectDict.get(mobjectId).updateFromMobjectProto(mobjectProto);
        } else {
          this.mobjectDict.set(
            mobjectId,
            this.createMeshFromMobjectProto(mobjectProto)
          );
        }
        this.scene.add(this.mobjectDict.get(mobjectId));
      }

      // Update flickered Mobjects.
      this.updateFlickeredMobjects(response);

      // Update tweened Mobjects.
      for (let animation of this.tweenAnimations) {
        for (let mobjectTweenData of animation.mobject_tween_data) {
          this.doAnimationTween(animation, mobjectTweenData);
        }
      }
    },
    updateFlickeredMobjects(response) {
      // Remove Mobjects that were flickered on the last frame.
      this.removeIdsFromScene(this.lastFrameFlickeredIds);

      // Update this.lastFrameFlickeredIds.
      if (this.startingNewAnimation) {
        this.lastFrameFlickeredIds = response.animations
          .concat(response.updaters)
          .map((proto) => proto.flickered_mobject_ids)
          .reduce((fullIdList, idList) => fullIdList.concat(idList), []);
      } else {
        this.lastFrameFlickeredIds = response.frame_data.update.map(
          (mobjectProto) => mobjectProto.id
        );
      }

      // Add Mobjects being flickered on this frame.
      for (let mobjectProto of response.frame_data.update) {
        if (this.mobjectDict.has(mobjectProto.id)) {
          this.mobjectDict
            .get(mobjectProto.id)
            .updateFromMobjectProto(mobjectProto);
        } else {
          this.mobjectDict.set(
            mobjectProto.id,
            this.createMeshFromMobjectProto(mobjectProto)
          );
        }
        this.scene.add(this.mobjectDict.get(mobjectProto.id));
      }
    },
    removeIdsFromScene(idList) {
      let idsToRemove = new Set(idList);
      this.scene.children = this.scene.children.filter(
        (mesh) => !idsToRemove.has(mesh.mobjectId)
      );
    },
    createMeshFromMobjectProto(mobjectProto) {
      if (mobjectProto.type === "VMOBJECT") {
        return new Mobject(mobjectProto);
      } else if (mobjectProto.type === "IMAGE_MOBJECT") {
        return new ImageMobject(mobjectProto);
      } else {
        console.error(
          `Can't create object of unknown type {mobjectProto.type}.`
        );
      }
    },
    updateSceneData(data) {
      if (data.has_exception) {
        console.error(data.exception);
        return;
      }
      this.sceneName = data.scene.name;
      this.backgroundColor = data.scene.background_color;
      this.pythonReady = true;
      this.scene.children = [];
      this.mobjectDict = new Map();
      this.animationOffset = 0;
      if (
        this.animationRange[0] === 0 &&
        this.animationRange[1] === this.animations.length
      ) {
        this.animationRange[1] = data.scene.animations.length;
      }
      this.animations.splice(data.scene.animations.length);
      for (let i = 0; i < data.scene.animations.length; i++) {
        this.$set(this.animations, i, {
          name: data.scene.animations[i].name,
          duration: data.scene.animations[i].duration,
        });
      }
      this.renderer.setClearColor(
        new THREE.Color(parseInt(data.scene.background_color.substring(1), 16))
      );
      this.play();
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
        updateSceneData: (call, callback) => {
          callback(null, {});
          this.updateSceneData(call.request);
        },
      });
      renderServer.bindAsync(
        "localhost:50052",
        grpc.ServerCredentials.createInsecure(),
        (err) => {
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
    jumpToAnimation(animationIndex) {
      this.frameClient.getFrameAtTime(
        {
          first_request: true,
          animation_index: animationIndex,
          animation_offset: 0,
        },
        (err, response) => {
          if (err) {
            console.error(err);
            return;
          }
          this.animationIndex = response.animation_index;
          this.animationOffset = response.animation_offset;
          this.updateSceneWithFrameResponse(response);
        }
      );
    },
  },
};
</script>

<style>
.display-none {
  display: none;
}
.full-width {
  width: 100%;
}
body {
  margin: 0;
}
</style>
