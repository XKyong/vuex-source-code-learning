export default function (Vue) {
  const version = Number(Vue.version.split('.')[0])

  if (version >= 2) {
    // 合并选项后 beforeCreate 是数组里函数的形式  [ƒ,  ƒ]
    // 最后调用循环遍历这个数组，调用这些函数，这是一种函数与函数合并的解决方案。
    Vue.mixin({ beforeCreate: vuexInit })
  } else {
    // override init and inject vuex init procedure
    // for 1.x backwards compatibility.
    const _init = Vue.prototype._init
    Vue.prototype._init = function (options = {}) {
      options.init = options.init
        ? [vuexInit].concat(options.init)
        : vuexInit
      _init.call(this, options)
    }
  }

  /**
   * Vuex init hook, injected into each instances init hooks list.
   * vuexInit 后续被执行时，将使得最终每个Vue的实例对象，都有一个$store属性。且是同一个Store实例
   */

  function vuexInit () {
    const options = this.$options
    // store injection
    // store 注入到每一个Vue的实例中
    if (options.store) {
      /* 存在store其实代表的就是Root节点，直接执行store（function时）或者使用store（非function）*/
      this.$store = typeof options.store === 'function'
        ? options.store()
        : options.store
    } else if (options.parent && options.parent.$store) {
      /* 子组件直接从父组件中获取$store，这样就保证了所有组件都公用了全局的同一份store */
      this.$store = options.parent.$store
    }
  }
}
