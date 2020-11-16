<template>
  <v-card class="px-2" style="height: 300px; width: 300px">
    <v-card-title class="text-h5">Debug</v-card-title>
    <div class="text-h5 mt-3">animationIndex = {{animationIndex}}</div>
    <div class="text-h5 mt-3">animationOffset = {{animationOffset}}</div>
    <div class="text-h5 mt-3">animationName = {{animationName}}</div>
    <div class="text-h5 mt-3">playing = {{playing}}</div>
  </v-card>
</template>

<script>
export default {
  name: "DebugCard",
  props: {
    animationName: String,
    animationIndex: Number,
    animationOffset: Number,
    playing: Boolean,
  },
};
</script>

<style>
</style>
