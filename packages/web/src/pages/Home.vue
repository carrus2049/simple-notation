<template>
  <div class="min-h-screen flex flex-col bg-gradient-to-br from-gray-100 to-gray-300">
    <!-- 顶部导航 -->
    <nav class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <h1 class="text-xl font-bold bg-gradient-to-r from-[#ff6b3d] to-[#7b5aff] bg-clip-text text-transparent">
          melody_jianpu_notation_gen
        </h1>
        <div class="flex gap-4">
          <router-link
            to="/"
            class="px-3 py-1.5 rounded-md text-gray-700 font-medium bg-gray-100"
          >
            首页
          </router-link>
          <router-link
            to="/demo"
            class="px-3 py-1.5 rounded-md text-[#7b5aff] font-medium hover:bg-purple-50"
          >
            Demo
          </router-link>
        </div>
      </div>
    </nav>

    <!-- 主体：仅 Demo 入口 -->
    <main class="flex-1 flex items-center justify-center p-8">
      <router-link
        to="/demo"
        class="inline-flex items-center gap-3 px-8 py-4 bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow border border-gray-200 hover:border-[#7b5aff]/50"
      >
        <span class="text-2xl">🎵</span>
        <span class="text-lg font-medium text-gray-800">谱面 Demo</span>
      </router-link>
    </main>
  </div>
</template>

<script setup lang="ts">
defineOptions({
  name: 'Home',
});
</script>
