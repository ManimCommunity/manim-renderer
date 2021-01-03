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
          @jump-to-animation="(index) => jumpToAnimation(index)"
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
        <div>
          <div class="text-h5">
            <!-- <v-checkbox v-model="previewMode" label="play range" class="large" /> -->
            <v-radio-group v-model="previewMode">
              <v-radio
                v-for="x in ['ALL', 'ANIMATION_RANGE', 'IMAGE']"
                :key="x"
                :label="`${x}`"
                :value="x"
              ></v-radio>
            </v-radio-group>
          </div>
          <div style="width: 50%">
            <v-range-slider
              :min="0"
              :max="animations.length"
              v-model="animationRange"
              v-if="previewMode === 'ANIMATION_RANGE'"
            >
              <template v-slot:prepend>
                <span style="width: max-content"
                  >({{ animationRange[0] }}, {{ animationRange[1] }})</span
                >
              </template>
            </v-range-slider>
            <v-slider
              :min="0"
              :max="animations.length"
              v-model="imagePreviewIndex"
              v-if="previewMode === 'IMAGE'"
            >
              <template v-slot:prepend>
                <span style="width: max-content"
                  >({{ imagePreviewIndex }})</span
                >
              </template>
            </v-slider>
          </div>
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
          :animation-name="animationName"
          :animation-index="animationIndex"
          :animation-offset="animationOffset"
          :playing="playing"
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
import { rootCertificates } from "tls";

const path = require("path");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");

const ASSETS_SERVER_URL = "http://localhost:8000/";
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
      animationName: "",
      animations: [],
      playing: false,
      previewMode: "ALL",
      animationRange: [0, 0],
      imagePreviewIndex: 0,
    };
  },
  created() {
    this.fps = 15;
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

    this.frameData = [];

    // Maps Mobject IDs from Python to their respective Mobjects in
    // Javascript.
    this.mobjectDict = new Map();

    this.renderServer = this.getRenderServer();

    this.frameClient = null;
    this.playStartTimestamp = null;
    this.waitingUntilTimestamp = null;
    this.animationWidth = 45;

    this.tweenDict = new Map();
    this.tweenMobjectIds = [];
    this.allAnimationsTweened = false;
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
    this.frameClient = this.getFrameClient();
    this.frameClient.fetchSceneData({}, (err, response) => {
      if (err) {
        console.error(err);
        return;
      }
      this.updateSceneData(response);
    });
  },
  methods: {
    play() {
      this.playing = true;
      let animationStartTime = null;
      requestAnimationFrame((timeStamp) => {
        this.playStartTimestamp = timeStamp;
        let renderLoop = (timeStamp) => {
          this.timeOffset = (timeStamp - this.playStartTimestamp) / 1000;
          if (!this.allAnimationsTweened) {
            this.frameClient.getFrameAtTime(
              {
                start_index: this.animationRange[0],
                end_index: this.animationRange[1],
                image_index: this.imagePreviewIndex,
                time_offset: this.timeOffset,
                preview_mode: this.previewMode,
              },
              (err, response) => {
                if (err) {
                  console.error(err);
                  return;
                }

                // Update information.
                let startingNewAnimation =
                  animationStartTime === null ||
                  response.animation_index > this.animationIndex;
                this.animationIndex = response.animation_index;
                this.animationOffset = response.animation_offset;
                this.animationName = response.animations[0].name;
                if (response.animations.length > 1) {
                  this.animationName += "...";
                }
                this.$set(this.animations, this.animationIndex, {
                  name: this.animationName,
                  duration: response.duration,
                });

                // Update the scene.
                this.updateSceneWithFrameResponse(response);

                // If starting a new scene, add tween data if present.
                if (startingNewAnimation) {
                  this.allAnimationsTweened = true;
                  animationStartTime = timeStamp;
                  for (let animation of response.animations) {
                    if (animation.tween_data.length > 0) {
                      for (let id of animation.mobject_ids) {
                        this.tweenDict[id] = animation;
                        this.tweenMobjectIds.push(id);
                      }
                    } else {
                      this.allAnimationsTweened = false;
                    }
                  }
                  if (this.allAnimationsTweened) {
                    // Each animated mobject in the scene has tween data.
                    console.warn(
                      "Tweening mobjects without RPCs to manim. This isn't correct for",
                      "some scenes with updaters."
                    );
                  }
                }

                if (!response.scene_finished) {
                  requestAnimationFrame(renderLoop);
                } else {
                  this.resetAnimationData();
                  requestAnimationFrame(this.idleRender);
                }
              }
            );
          } else {
            this.animationOffset = (timeStamp - animationStartTime) / 1000;
            if (
              this.animationOffset >
              this.animations[this.animationIndex].duration
            ) {
              this.resetAnimationData();
              requestAnimationFrame(renderLoop);
              return;
            }

            for (let mobjectId of this.tweenMobjectIds) {
              let obj = this.mobjectDict[mobjectId];
              let animation = this.tweenDict[mobjectId];
              for (let tweenData of animation.tween_data) {
                this.updateMeshWithTweenData(obj, animation, tweenData);
              }
            }
            requestAnimationFrame(renderLoop);
          }
        };
        requestAnimationFrame(renderLoop);
      });
    },
    resetAnimationData() {
      this.animationName = "";
      this.playing = false;
      this.tweenDict = new Map();
      this.tweenMobjectIds = [];
      this.allAnimationsTweened = false;
      for (let id of this.mobjectDict) {
        this.mobjectDict[id].dispose();
      }
      this.mobjectDict = new Map();
    },
    idleRender() {
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(this.idleRender);
    },
    updateMeshWithTweenData(mesh, animation, tweenData) {
      if (tweenData.attribute === "position") {
        // Get eased offset.
        let t = utils[animation.easing_function](
          this.animationOffset / animation.duration
        );

        // Get mobject center at the given offset.
        let position = new THREE.Vector3(...tweenData.start_data)
          .lerp(new THREE.Vector3(...tweenData.end_data), t)
          .add(mesh.rootMobjectOffset);

        // Get mesh center.
        let boundingBoxCenter = new THREE.Vector3();
        mesh.strokeMesh.geometry.computeBoundingBox();
        mesh.strokeMesh.geometry.boundingBox.getCenter(boundingBoxCenter);
        mesh.localToWorld(boundingBoxCenter);

        // Update mesh center to mobject center.
        mesh.position.add(position).sub(boundingBoxCenter);
      }
    },
    updateSceneWithFrameResponse(response) {
      this.scene.children = [];
      for (let mobjectProto of response.mobjects) {
        let mobjectId = mobjectProto.id;
        if (mobjectId in this.mobjectDict) {
          this.updateObjectFromMobjectProto(
            this.mobjectDict[mobjectId],
            mobjectProto,
            response
          );
          this.scene.add(this.mobjectDict[mobjectId]);
        } else {
          let meshOrSprite = this.createObjectFromMobjectProto(mobjectProto);
          this.mobjectDict[mobjectId] = meshOrSprite;
          this.scene.add(meshOrSprite);
        }
      }
    },
    createObjectFromMobjectProto(mobjectProto) {
      if (mobjectProto.type === "VMOBJECT") {
        let [
          id,
          points,
          style,
          needsRedraw,
          rootOffset,
        ] = utils.extractMobjectProto(mobjectProto);
        return new Mobject(id, points, style, new THREE.Vector3(...rootOffset));
      } else if (mobjectProto.type === "IMAGE_MOBJECT") {
        return this.spriteFromImageMobjectProto(mobjectProto);
      } else {
        console.error(
          `Can't create object of unknown type {mobjectProto.type}.`
        );
      }
    },
    updateObjectFromMobjectProto(obj, mobjectProto, frameResponse) {
      if (mobjectProto.type === "VMOBJECT") {
        let mesh = obj;
        let id = mobjectProto.id;

        let updatedWithTween = false;
        for (let animation of frameResponse.animations) {
          if (
            animation.tween_data.length > 0 &&
            animation.mobject_ids.includes(id)
          ) {
            for (let singleTweenData of animation.tween_data) {
              this.updateMeshWithTweenData(mesh, animation, singleTweenData);
            }
            updatedWithTween = true;
          }
        }

        if (!updatedWithTween) {
          let [id, points, style, needsRedraw] = utils.extractMobjectProto(
            mobjectProto
          );
          mesh.update(points, style, needsRedraw);
        }
      } else if (mobjectProto.type === "IMAGE_MOBJECT") {
        let sprite = obj;
        this.updateSpriteProperties(sprite, mobjectProto);
      } else {
        console.error(
          `Can't update object of unknown type {mobjectProto.type}.`
        );
      }
    },
    spriteFromImageMobjectProto(mobjectProto) {
      // TODO: Use a texture loader rather than a sprite
      // (https://threejs.org/examples/?q=texture#webgl_loader_texture_exr).
      const map = new THREE.TextureLoader().load(
        ASSETS_SERVER_URL + mobjectProto.image_mobject_data.path,
        undefined,
        undefined,
        (err) => {
          console.error("error loading image:", err);
        }
      );
      const material = new THREE.SpriteMaterial({ map: map });
      let sprite = new THREE.Sprite(material);
      this.updateSpriteProperties(sprite, mobjectProto);
      return sprite;
    },
    updateSpriteProperties(sprite, mobjectProto) {
      sprite.material.opacity = mobjectProto.style.fill_opacity;
      sprite.position.x = mobjectProto.image_mobject_data.center.x;
      sprite.position.y = mobjectProto.image_mobject_data.center.y;
      sprite.position.z = mobjectProto.image_mobject_data.center.z;
      sprite.scale.set(
        mobjectProto.image_mobject_data.width,
        mobjectProto.image_mobject_data.height,
        1
      );
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
      this.animationIndex = 0;
      this.animationOffset = 0;
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
    jumpToAnimation(animationIndex) {
      this.timeOffset = this.animations
        .slice(0, animationIndex)
        .reduce((total, anim) => {
          return total + anim.duration;
        }, 0);
      this.requestAndDisplayCurrentFrame();
    },
    requestAndDisplayCurrentFrame() {
      this.frameClient.getFrameAtTime(
        { time_offset: this.timeOffset },
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
