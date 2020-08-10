<template>
  <v-card class="px-2" style="height: 300px; width: 300px">
    <v-card-title class="text-h5">{{animation ? animation.className : "No animation"}}</v-card-title>
    <v-btn @click="$emit('step-backward')">
      <v-icon dark>mdi-skip-previous</v-icon>
    </v-btn>
    <v-btn @click="$emit('play-animation')" class="ml-2">
      <v-icon v-if="animationOffset === animation.runtime" dark>mdi-replay</v-icon>
      <v-icon v-else dark>mdi-play</v-icon>
    </v-btn>
    <v-btn @click="$emit('step-forward')" class="ml-2">
      <v-icon dark>mdi-skip-next</v-icon>
    </v-btn>
  </v-card>
</template>

<script>
export default {
  name: "AnimationCard",
  props: {
    animation: Object,
    animationOffset: Number
  }
};
</script>

<style>
</style>
