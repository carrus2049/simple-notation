import { type RouteRecordRaw } from 'vue-router';
import Home from './pages/Home.vue';
import PianoRoll from './pages/PianoRoll.vue';
import Demo from './pages/Demo.vue';

export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'Home', component: Home },
  { path: '/piano-roll', name: 'PianoRoll', component: PianoRoll },
  { path: '/demo', name: 'Demo', component: Demo },
];
