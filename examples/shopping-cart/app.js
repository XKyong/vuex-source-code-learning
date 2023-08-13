import Vue from 'vue'
import App from './components/App.vue'
import store from './store'
import { currency } from './currency'

Vue.filter('currency', currency)

const vm = new Vue({
  el: '#app',
  store,
  render: h => h(App)
})

// 以下结果都是true，验证，所有组件实例中的 $store 是同一个 Store 实例
console.log('vm.$store === vm.$children[0].$store', vm.$store === vm.$children[0].$store)
console.log('vm.$store === vm.$children[0].$children[0].$store', vm.$store === vm.$children[0].$children[0].$store)
console.log('vm.$store === vm.$children[0].$children[1].$store', vm.$store === vm.$children[0].$children[1].$store)
