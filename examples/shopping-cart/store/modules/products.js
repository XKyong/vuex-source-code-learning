import shop from '../../api/shop'

// initial state
const state = () => ({
  all: []
})

// getters
const getters = {}

// actions
const actions = {
  // 1.这里的参数 context 拿的是 vuex 源码 store 文件中 makeLocalContext 方法返回的 local 对象
  // 2.commit 先后经过：makeLocalContext 方法中的 local.commit -> Store 构造函数中的 boundCommit -> Store 实例 commit 方法
  getAllProducts ({ commit }) {
    shop.getProducts(products => {
      commit('setProducts', products)
    })

    // 验证 action 函数在 dispatch 执行后的返回值是 Promise 对象！
    return 'getAllProducts-action'
  }
}

// mutations
const mutations = {
  setProducts (state, products) {
    state.all = products
  },

  decrementProductInventory (state, { id }) {
    const product = state.all.find(product => product.id === id)
    product.inventory--
  },

  clearProducts (state, { type, data }) {
    console.log('vuex clearProducts---', type, data)
    state.all = []
  }
}

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
}
