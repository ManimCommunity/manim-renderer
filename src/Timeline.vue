<template>
  <v-card
    class="d-flex flex-nowrap align-center pa-1 timeline"
    color="grey lighten-3"
    style="height: 100px"
  >
    <v-menu
      offset-y
      class="d-flex"
      v-for="(animation, index) in animations"
      :key="index"
      :open-on-hover="true"
      max-width="120px"
    >
      <template v-slot:activator="{ on, attrs }">
        <v-card
          flat
          class="flex-grow-0 flex-shrink-0 d-flex flex-row justify-center align-center mr-1 px-2"
          @click="$emit('jump-to-animation', index)"
          :style="{
            width: animation.duration * animationWidth + 'px',
            height: animationWidth + 'px',
          }"
          v-bind="attrs"
          v-on="on"
        >
          <div
            class="text-subtitle-1"
            style="
              overflow: hidden;
              white-space: nowrap;
              text-overflow: ellipsis;
            "
            :style="{
              color:
                (animationRange[0] <= index && index < animationRange[1]) ||
                (animationRange[0] === index && animationRange[1] === index)
                  ? 'black'
                  : 'gray',
            }"
          >
            {{ animation.name }}
          </div>
        </v-card>
      </template>
      <v-card class="d-flex justify-space-around py-1">
        <v-tooltip bottom>
          <template v-slot:activator="{ on, attrs }">
            <v-btn
              icon
              v-bind="attrs"
              v-on="on"
              v-on:click="$emit('set-preview-start', index)"
              ><v-icon color="black">mdi-step-forward</v-icon></v-btn
            >
          </template>
          <span>set preview start</span>
        </v-tooltip>
        <v-tooltip bottom>
          <template v-slot:activator="{ on, attrs }">
            <v-btn
              icon
              v-bind="attrs"
              v-on="on"
              v-on:click="$emit('set-preview-image', index)"
              ><v-icon color="black">mdi-image</v-icon></v-btn
            >
          </template>
          <span>preview start frame</span>
        </v-tooltip>
        <v-tooltip bottom>
          <template v-slot:activator="{ on, attrs }">
            <v-btn
              icon
              v-bind="attrs"
              v-on="on"
              v-on:click="$emit('set-preview-end', index + 1)"
              ><v-icon color="black">mdi-step-backward</v-icon></v-btn
            >
          </template>
          <span>set preview end</span>
        </v-tooltip>
      </v-card>
    </v-menu>
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
    animationRange: Array,
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
