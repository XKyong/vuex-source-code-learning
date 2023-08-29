<template>
  <ul>
    <li
      v-for="product in products"
      :key="product.id">
      {{ product.title }} - {{ product.price | currency }}
      <br>
      <button
        :disabled="!product.inventory"
        @click="addProductToCart(product)">
        Add to cart
      </button>
    </li>
  </ul>
</template>

<script>
import { mapState, mapActions } from 'vuex'

export default {
  computed: mapState({
    products: state => state.products.all
  }),
  // 经过辅助函数 mapActions 调试！
  methods: mapActions('cart', [
    'addProductToCart'
  ]),
  async created () {
    // 不经过辅助函数 mapActions 调试！
    const res = this.$store.dispatch('products/getAllProducts')
    res.then(result => console.log('ProductList---', result))
  }
}
</script>
