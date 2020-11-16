<template>
  <v-card
    class="d-flex flex-nowrap align-center pa-1 timeline"
    color="grey lighten-3"
    style="height: 100px"
  >
    <v-card
      v-for="(animation, index) in animations"
      v-bind:key="index"
      flat
      class="flex-grow-0 flex-shrink-0 d-flex flex-column justify-center mr-1"
      @click="$emit('jump-to-animation', index)"
      v-bind:style="{
        overflowY: 'hidden',
        width: (animation.duration * animationWidth) + 'px',
        height: animationWidth + 'px',
      }"
    >
      <v-card-title class="d-flex justify-center headline px-2">
        <div class="text-subtitle-1">{{ animation.name }}</div>
      </v-card-title>
    </v-card>
    <div id="position-indicator" :style="timelineOffset" />
  </v-card>
</template>

<script>
export default {
  name: "Timeline",
  props: {
    index: Number,
    offset: Number,
    animations: Array,
  },
  created() {
    this.animationWidth = 100;
  },
  computed: {
    timelineOffset() {
      if (this.animations.length === 0) {
        return "0px";
      }
      // The default padding on the card representing the background.
      let cursorOffset = 4;
      for (let i = 0; i < this.index; i++) {
        cursorOffset += this.animations[i].duration * this.animationWidth + 4;
      }
      if (this.index < this.animations.length) {
        cursorOffset += this.offset * this.animationWidth;
      }
      return { left: cursorOffset + "px" };
    },
  },
};
</script>

<style>
#position-indicator {
  background-color: black;
  height: 100%;
  width: 3px;
  position: absolute;
  border-radius: 2px;
}
.timeline {
  height: 155px;
  position: relative;
  overflow-x: auto;
  overflow-y: hidden;
}
</style>
