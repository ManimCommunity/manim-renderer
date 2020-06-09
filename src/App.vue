<template>
  <v-app>
    <div class="d-flex flex-column align-start">
      <canvas class="renderer-element" ref="renderer" />
      <v-btn @click="()=>controls.reset()">reset camera</v-btn>
      <v-btn @click="()=>requestFrame()">request frame</v-btn>
    </div>
  </v-app>
</template>

<script>
/* eslint-disable */
import * as THREE from "three";
import { Mobject } from "./Mobject.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import frameServerClient from "./frame_server_client.js";

const SQUARE_DATA = [
  {
    points: [
      [-1.1102230246251565e-16, 1.414213562373095, 0.0],
      [-0.4714045207910317, 0.9428090415820634, 8.164311994315686e-17],
      [-0.9428090415820634, 0.4714045207910317, 1.6328623988631375e-16],
      [-1.414213562373095, -1.1102230246251565e-16, 2.4492935982947064e-16],
      [-1.414213562373095, -1.1102230246251565e-16, 2.4492935982947064e-16],
      [-0.9428090415820634, -0.4714045207910317, 1.6328623988631378e-16],
      [-0.4714045207910317, -0.9428090415820634, 8.164311994315689e-17],
      [1.1102230246251565e-16, -1.414213562373095, 0.0],
      [1.1102230246251565e-16, -1.414213562373095, 0.0],
      [0.4714045207910317, -0.9428090415820634, -8.164311994315686e-17],
      [0.9428090415820634, -0.4714045207910317, -1.6328623988631375e-16],
      [1.414213562373095, 1.1102230246251565e-16, -2.4492935982947064e-16],
      [1.414213562373095, 1.1102230246251565e-16, -2.4492935982947064e-16],
      [0.9428090415820634, 0.4714045207910317, -1.6328623988631378e-16],
      [0.4714045207910317, 0.9428090415820634, -8.164311994315689e-17],
      [-1.1102230246251565e-16, 1.414213562373095, 0.0]
    ],
    style: {
      fill_color: "#fff",
      fill_opacity: 0.0,
      stroke_color: "#fff",
      stroke_width: 4,
      stroke_opacity: 1.0
    },
    id: 140378656248304
  }
];

export default {
  name: "App",
  components: {},
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
    this.mobjectDict = {};
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

    // Add something.
    const { id, points, style } = SQUARE_DATA[0];
    const square1 = new Mobject(id, points, style);
    const square2 = new Mobject(id, points, style);

    square1.position.add(new THREE.Vector3(1, 0, 0));
    square2.position.add(new THREE.Vector3(-1, 0, 0));
    this.scene.add(square1);
    this.scene.add(square2);

    // Animate it.
    const animate = () => {
      requestAnimationFrame(animate);
      square1.rotation.z += 0.01;
      square2.rotation.z += 0.01;
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  },
  methods: {
    requestFrame() {
      frameServerClient.getFrameAtTime({ time: 0.0 }, function(err, response) {
        if (err) {
          console.error(err);
        } else {
          console.log(response);
        }
      });
    }
  }
};
</script>

<style lang="scss">
body {
  margin: 0;
}
</style>
