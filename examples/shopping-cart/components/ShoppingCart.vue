<template>
  <div class="cart">
    <h2>Your Cart</h2>
    <p v-show="!products.length">
      <i>Please add some products to cart.</i>
    </p>
    <ul>
      <li v-for="product in products" :key="product.id">
        {{ product.title }} - {{ product.price | currency }} x {{ product.quantity }}
      </li>
    </ul>
    <p>Total: {{ total | currency }}</p>
    <p><button :disabled="!products.length" @click="checkout(products)">Checkout</button></p>
    <p v-show="checkoutStatus">Checkout {{ checkoutStatus }}.</p>
  </div>
</template>

<script>
import { mapGetters, mapState } from 'vuex'

export default {
  computed: {
    // 没有命名空间的情况下，mapState 最终会转换成这样：
    // ...{
    //   checkoutStatus: function mappedState () {
    //     return this.$store.state.cart.checkoutStatus
    //   }
    // },
    // ...mapState({
    //   checkoutStatus: state => state.cart.checkoutStatus
    // }),

    // 使用命名空间 'cart' 的情况下，即 mapState 最终会变成：
    // ...{
    //   checkoutStatus: function mappedState () {
    //     return this.$store._modulesNamespaceMap['cart/'].context.state.checkoutStatus
    //   }
    // },
    ...mapState('cart', {
      checkoutStatus: state => state.checkoutStatus
    }),
    // --------------------------------------------
    ...mapGetters('cart', {
      products: 'cartProducts',
      total: 'cartTotalPrice'
    })
    // 上边 mapGetters 代码最终转换变为：
    // ...{
    //   products: function mappedGetter () {
    //     return this.$store.getters['cart/cartProducts']
    //   },
    //   total: function mappedGetter () {
    //     return this.$store.getters['cart/cartTotalPrice']
    //   }
    // }
  },
  methods: {
    checkout (products) {
      this.$store.dispatch('cart/checkout', products)
    }
  }
}
</script>
