<template>
  <ul>
    <button @click="clearProducts">赋值直接清空products</button>
    <li v-for="product in products" :key="product.id">
      {{ product.title }} - {{ product.price | currency }}
      <br>
      <button :disabled="!product.inventory" @click="addProductToCart(product)">
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
  methods: {
    // 当我企图直接通过赋值的方式修改vuex中的state，会发生什么？
    clearProducts () {
      // 错误使用，因为设置了 strict 为 true，如果不设置 strict 为 true，则直接赋值修改是不会报错的！
      // 源码详细见：src/store.js 中的 enableStrictMode 函数
      this.$store.state.products.all = []
      // 报错 => Error: [vuex] do not mutate vuex store state outside mutation handlers.

      // 正确使用
      // this.$store.commit({
      //   type: 'products/clearProducts',
      //   data: []
      // })
    },
    // 经过辅助函数 mapActions 调试！
    // 经过辅助函数 mapActions 处理，dispatch 触发时，先后经过：
    // makeLocalContext 方法中的 local.dispatch -> Store 构造函数中的 boundDispatch -> Store 实例 dispatch 方法
    ...mapActions('cart', [
      'addProductToCart'
    ])
    // 以上 mapActions 方法等价于：
    // ...{
    //   addProductToCart: function mappedAction (product) {
    //     return this.$store._modulesNamespaceMap['cart/'].context.dispatch.apply(this.$store, ['addProductToCart'].concat(product))
    //   }
    // },
    // addProductToCart (product) {
    //   return this.$store._modulesNamespaceMap['cart/'].context.dispatch.apply(this.$store, ['addProductToCart'].concat(product))
    // }
    // 举多几个例子：
    // ...mapMutations(['inc']),
    // ...mapMutations('kai', ['dec']),
    // ...mapActions(['actionA'])
    // ...mapActions('kai', ['actionB'])
    // 上述这 4 个分别等价于：
    //  inc: function mappedMutation (...args){
    //   return this.$store.commit.apply(this.$store, ['inc'].concat(args))
    // },
    // dec: function mappedMutation (...args){
    //   return this.$store._modulesNamespaceMap['kai/'].context.commit.apply(this.$store, ['dec'].concat(args))
    // },
    // actionA: function mappedAction (...args){
    //   return this.$store.dispatch.apply(this.$store, ['actionA'].concat(args))
    // }
    // actionB: function mappedAction (...args){
    //   return this.$store._modulesNamespaceMap['kai/'].context.dispatch.apply(this.$store, ['actionB'].concat(args))
    // }
  },
  async created () {
    // 不经过辅助函数 mapActions 调试，dispatch 触发时，也是先后经过：
    // makeLocalContext 方法中的 local.dispatch -> Store 构造函数中的 boundDispatch -> Store 实例 dispatch 方法
    const res = this.$store.dispatch('products/getAllProducts')
    res.then(result => console.log('ProductList---', result))
  }
}

// 这里也提一下，对于 mutation，源码途径路径类似，不管经没经过 mapMutations 辅助函数，commit 提交时，也是先后经过：
// makeLocalContext 方法中的 local.commit -> Store 构造函数中的 boundCommit -> Store 实例 commit 方法
</script>
