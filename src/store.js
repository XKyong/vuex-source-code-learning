import applyMixin from './mixin'
import devtoolPlugin from './plugins/devtool'
import ModuleCollection from './module/module-collection'
import { forEachValue, isObject, isPromise, assert, partial } from './util'

let Vue // bind on install

export class Store {
  constructor(options = {}) {
    // 如果是 cdn script 方式引入vuex插件，则自动安装vuex插件，不需要用Vue.use(Vuex)来安装
    // Auto install if it is not done yet and `window` has `Vue`.
    // To allow users to avoid auto-installation in some cases,
    // this code should be placed here. See #731
    if (!Vue && typeof window !== 'undefined' && window.Vue) {
      install(window.Vue)
    }

    if (__DEV__) {
      // 这里不用 console.assert，因为 console.assert 函数报错不会阻止后续代码执行！
      assert(Vue, `must call Vue.use(Vuex) before creating a store instance.`)
      assert(typeof Promise !== 'undefined', `vuex requires a Promise polyfill in this browser.`)
      assert(this instanceof Store, `store must be called with the new operator.`)
    }

    const {
      plugins = [],
      strict = false
    } = options

    // store internal state
    // store 实例对象 内部的 state
    this._committing = false
    // 用来存放处理后的用户自定义的 actions
    this._actions = Object.create(null)
    // 用来存放 actions 订阅
    this._actionSubscribers = []
    // 用来存放处理后的用户自定义的mutations
    this._mutations = Object.create(null)
    // 用来存放处理后的用户自定义的 getters
    this._wrappedGetters = Object.create(null)
    // 模块收集器，构造模块树形结构
    // 除了这里的 _modules（包含 root 属性即Module实例 的对象） 是 ModuleCollection 实例外，代码中涉及的 module 对象基本都是 Module 实例！
    this._modules = new ModuleCollection(options)
    // 用于存储模块命名空间的关系
    this._modulesNamespaceMap = Object.create(null)
    // 用来存放 commit 订阅
    this._subscribers = []
    // 用于使用 $watch 观测 getters
    this._watcherVM = new Vue()
    // 用来存放生成的本地 getters 的缓存
    this._makeLocalGettersCache = Object.create(null)

    // 为何要这样绑定 ?
    // 说明调用 commit 和 dispatch 的 this 不一定是 store 实例
    // 这是确保这两个函数里的 this 是 store 实例
    /* 将dispatch与commit调用的this绑定为store对象本身，否则在组件内部this.dispatch时的this会指向组件的vm */
    // bind commit and dispatch to self
    const store = this
    // 这里能拿到 dispatch 和 commit，主要是因为 new 操作符执行过程中，在构造函数被执行前，dispatch 和 commit 方法已经被挂载到 Store.prototype 上了
    const { dispatch, commit } = this
    this.dispatch = function boundDispatch (type, payload) {
      return dispatch.call(store, type, payload)
    }
    this.commit = function boundCommit (type, payload, options) {
      return commit.call(store, type, payload, options)
    }

    // 经过 boundDispatch 和 boundCommit 处理后，
    // 业务代码中调用的 this.$store.dispatch 即为这里的 boundDispatch
    // 业务代码中调用的 this.$store.commit 即为这里的 boundCommit

    // strict mode
    this.strict = strict

    // 根模块的state
    const state = this._modules.root.state

    // 初始化 根模块。
    // 并且也递归的注册所有子模块。
    // 并且收集所有模块的 getters 放在 this._wrappedGetters 里面。
    // init root module.
    // this also recursively registers all sub-modules
    // and collects all module getters inside this._wrappedGetters
    installModule(this, state, [], this._modules.root)

    // 经过 installModule 方法之后：
    // （1）如果 module.namespaced 为 true 的话，_modulesNamespaceMap 对象会存入命名空间字符串（例如 `cart/` 和 `products/`）和对应模块（Module实例）
    // （2）各个 module 都会加上 context 属性，通过 makeLocalContext 函数处理，context 对象包含本地化的 dispatch/commit/getters/state
    //    即此时，Module 实例包含了如下几个属性：runtime、_children、_rawModule、state、namespaced和 context
    // （3）_modules.root.state 会存入业务代码中传入的 modules 对象中的 state，比如：
    //     _modules.root.state = { cart: { checkoutStatus: null, items: [] }, products: { all: [] } }
    // （4）通过 registerMutation 函数，业务代码传入的 mutations 会被处理完放到 _mutations 对象中，每个 key 对应的 value 都是数组，数组项是 wrappedMutationHandler 函数；
    // （5）通过 registerAction 函数，业务代码传入的 actions 会被处理完放到 _actions 对象中，每个 key 对应的 value 都是数组，数组项是 wrappedActionHandler 函数；
    // （6）通过 registerGetter 函数，业务代码传入的 getters 会被处理完放到 _wrappedGetters 对象中，每个 key 对应的 value 是下边的 wrappedGetter 函数；

    // 初始化 store._vm 响应式的
    // 并且注册 _wrappedGetters 作为 computed 的属性
    // initialize the store vm, which is responsible for the reactivity
    // (also registers _wrappedGetters as computed properties)
    resetStoreVM(this, state)

    // 经过 resetStoreVM 方法之后：
    // （1）store实例多了个 getters 属性，key 为 store._wrappedGetters 对象的key，value 为 () => store._vm[key]
    // （2）store实例多了个 _vm 属性，值为 Vue 实例，store._vm._data.$$state 即为传入的 state 对象，且经过响应式处理
    // （3）将 _wrappedGetters 对象中的内容进行处理后放到 computed 对象中，然后将该 computed 对象作为 store._vm.computed

    // apply plugins
    plugins.forEach(plugin => plugin(this))

    const useDevtools = options.devtools !== undefined ? options.devtools : Vue.config.devtools
    if (useDevtools) {
      // 经过如下函数处理，如果启动了 vue devtools：
      // 1.则 store实例会多个 _devtoolHook 属性
      // 2._subscribers 和 _actionSubscribers 数组中都有了一个订阅者（回调函数）
      devtoolPlugin(this)
    }
  }

  get state () {
    // 业务代码中使用的 this.$store.state[key] 就是从这里返回值的！
    return this._vm._data.$$state
  }

  set state (v) {
    if (__DEV__) {
      assert(false, `use store.replaceState() to explicit replace store state.`)
    }
  }

  commit (_type, _payload, _options) {
    // check object-style commit
    // 统一成对象风格
    // commit 支持多种方式
    // (1) type 为字符串
    // store.commit('increment', {
    //   count: 10
    // })
    // (2) type为对象，且包含 type 属性
    // store.commit({
    //   type: 'increment',
    //   count: 10
    // })

    const {
      type,
      payload,
      options
    } = unifyObjectStyle(_type, _payload, _options)

    const mutation = { type, payload }
    // 取出处理后的用户定义 mutation
    const entry = this._mutations[type]
    if (!entry) {
      if (__DEV__) {
        console.error(`[vuex] unknown mutation type: ${type}`)
      }
      return
    }
    this._withCommit(() => {
      // 遍历执行
      entry.forEach(function commitIterator (handler) {
        handler(payload)
      })
    })

    // 订阅 mutation 执行
    // _subscribers 中的 sub 会在上述的所有 mutation 完成后调用，接收 mutation 和经过 mutation 后的状态 state 作为参数
    this._subscribers
      .slice() // shallow copy to prevent iterator invalidation if subscriber synchronously calls unsubscribe
      .forEach(sub => sub(mutation, this.state))

    if (
      __DEV__ &&
      options && options.silent
    ) {
      console.warn(
        `[vuex] mutation type: ${type}. Silent option has been removed. ` +
        'Use the filter functionality in the vue-devtools'
      )
    }
  }

  dispatch (_type, _payload) {
    // check object-style dispatch
    const {
      type,
      payload
    } = unifyObjectStyle(_type, _payload)

    const action = { type, payload }
    const entry = this._actions[type]
    if (!entry) {
      if (__DEV__) {
        console.error(`[vuex] unknown action type: ${type}`)
      }
      return
    }

    // 从 3.1.0 起，subscribeAction 也可以指定订阅处理函数的被调用时机应该在一个 action 分发之前还是之后 (默认行为是之前)：
    try {
      this._actionSubscribers
        .slice() // shallow copy to prevent iterator invalidation if subscriber synchronously calls unsubscribe
        .filter(sub => sub.before)
        .forEach(sub => sub.before(action, this.state))
    } catch (e) {
      if (__DEV__) {
        console.warn(`[vuex] error in before action subscribers: `)
        console.error(e)
      }
    }

    const result = entry.length > 1
      ? Promise.all(entry.map(handler => handler(payload)))
      : entry[0](payload)

    return new Promise((resolve, reject) => {
      result.then(res => {
        try {
          this._actionSubscribers
            .filter(sub => sub.after)
            .forEach(sub => sub.after(action, this.state))
        } catch (e) {
          if (__DEV__) {
            console.warn(`[vuex] error in after action subscribers: `)
            console.error(e)
          }
        }
        resolve(res)
      }, error => {
        try {
          // 自 3.4.0 起，subscribeAction 也可以指定一个 error 处理函数以捕获分发 action 的时候被抛出的错误。该函数第三个参数会接收到一个 error 对象。
          this._actionSubscribers
            .filter(sub => sub.error)
            .forEach(sub => sub.error(action, this.state, error))
        } catch (e) {
          if (__DEV__) {
            console.warn(`[vuex] error in error action subscribers: `)
            console.error(e)
          }
        }
        reject(error)
      })
    })
  }

  // 订阅 store 的 mutation，常用于 vuex 插件
  subscribe (fn, options) {
    return genericSubscribe(fn, this._subscribers, options)
  }

  // 订阅 store 的 action，常用于 vuex 插件
  subscribeAction (fn, options) {
    const subs = typeof fn === 'function' ? { before: fn } : fn
    return genericSubscribe(subs, this._actionSubscribers, options)
  }

  // 响应式地侦听 fn 的返回值，当值改变时调用回调函数。
  watch (getter, cb, options) {
    if (__DEV__) {
      assert(typeof getter === 'function', `store.watch only accepts a function.`)
    }
    return this._watcherVM.$watch(() => getter(this.state, this.getters), cb, options)
  }

  // 替换 store 的根状态，仅用状态合并或时光旅行调试。
  // 做数据持久化处理（存入localStorage 或者 sessionStorage）的时候会用到，详见：https://github.com/boenfu/vuex-along
  replaceState (state) {
    this._withCommit(() => {
      this._vm._data.$$state = state
    })
  }

  /**
   * 动态注册模块，用于服务端渲染
   * @param {Array|String} path 路径
   * @param {Object} rawModule 原始未加工的模块
   * @param {Object} options 参数选项
   */
  registerModule (path, rawModule, options = {}) {
    if (typeof path === 'string') path = [path]

    if (__DEV__) {
      assert(Array.isArray(path), `module path must be a string or an Array.`)
      assert(path.length > 0, 'cannot register the root module by using registerModule.')
    }

    // 手动调用 模块注册的方法
    this._modules.register(path, rawModule)
    // 安装模块
    installModule(this, this.state, path, this._modules.get(path), options.preserveState)
    // reset store to update getters...
    resetStoreVM(this, this.state)
  }

  /**
   * 注销模块，用于服务端渲染
   * @param {Array|String} path 路径
   */
  unregisterModule (path) {
    if (typeof path === 'string') path = [path]

    if (__DEV__) {
      assert(Array.isArray(path), `module path must be a string or an Array.`)
    }

    this._modules.unregister(path)
    this._withCommit(() => {
      const parentState = getNestedState(this.state, path.slice(0, -1))
      Vue.delete(parentState, path[path.length - 1])
    })
    resetStore(this)
  }

  // 检查该模块的名字是否已经被注册，用于服务端渲染
  hasModule (path) {
    if (typeof path === 'string') path = [path]

    if (__DEV__) {
      assert(Array.isArray(path), `module path must be a string or an Array.`)
    }

    return this._modules.isRegistered(path)
  }

  // 热替换新的 action 和 mutation
  hotUpdate (newOptions) {
    // 调用的是 ModuleCollection 的 update 方法，最终调用对应的是每个 Module 的 update
    this._modules.update(newOptions)
    resetStore(this, true)
  }

  // 包裹 commit 提交，handler 回调函数的执行
  _withCommit (fn) {
    const committing = this._committing
    this._committing = true
    fn()
    this._committing = committing
  }
}

// 往订阅数组 subs 中添加订阅回调函数 fn
function genericSubscribe (fn, subs, options) {
  // 往订阅数组中添加 fn，如果指定 prepend，则加到数组最前面
  if (subs.indexOf(fn) < 0) {
    options && options.prepend
      ? subs.unshift(fn)
      : subs.push(fn)
  }

  // 如果要停止订阅，则执行如下的回调，这样，对应的 fn 就会从 subs 数组中移除
  return () => {
    const i = subs.indexOf(fn)
    if (i > -1) {
      subs.splice(i, 1)
    }
  }
}

// 重置 Store 实例属性
function resetStore (store, hot) {
  store._actions = Object.create(null)
  store._mutations = Object.create(null)
  store._wrappedGetters = Object.create(null)
  store._modulesNamespaceMap = Object.create(null)
  const state = store.state
  // init all modules
  installModule(store, state, [], store._modules.root, true)
  // reset vm
  resetStoreVM(store, state, hot)
}

// 重置 Store 实例 _vm 实例属性
function resetStoreVM (store, state, hot) {
  // 存储一份老的Vue实例对象 _vm
  const oldVm = store._vm

  // bind store public getters
  store.getters = {}
  // reset local getters cache
  store._makeLocalGettersCache = Object.create(null)
  // 注册时收集的处理后的用户自定义的 wrappedGetters
  const wrappedGetters = store._wrappedGetters
  // 声明 计算属性 computed 对象
  const computed = {}
  // 遍历 wrappedGetters 赋值到 computed 上
  forEachValue(wrappedGetters, (fn, key) => {
    // use computed to leverage its lazy-caching mechanism
    // direct inline function use will lead to closure preserving oldVm.
    // using partial to return function with only arguments preserved in closure environment.
    /**
     * partial 函数
     * 执行函数 返回一个新函数
        export function partial (fn, arg) {
          return function () {
            return fn(arg)
          }
        }
     */
    // 这里的 fn 是 wrappedGetter(store)，即经过 registerGetter 函数处理的
    computed[key] = partial(fn, store)
    // getter 赋值 keys
    // 业务代码中使用的 this.$store.getters[key] 就是从这里返回值的！
    Object.defineProperty(store.getters, key, {
      // 这里等价于获取下边 store._vm.computed 对象中的 [key] 属性
      get: () => store._vm[key],
      enumerable: true // for local getters
    })
  })

  // use a Vue instance to store the state tree
  // suppress warnings just in case the user has added
  // some funky global mixins
  /* Vue.config.silent暂时设置为true的目的是在new一个Vue实例的过程中不会报出一切警告 */
  const silent = Vue.config.silent
  // 声明变量 silent 存储用户设置的静默模式配置
  Vue.config.silent = true
  /*  这里new了一个Vue对象，运用Vue内部的响应式实现注册state以及computed */
  store._vm = new Vue({
    data: {
      $$state: state
    },
    computed
  })

  // 如此使用后，对 store._vm.$$state 的修改，会反应到 store._vm.$data.$$state 上，然后会再反应到 store._vm._data.$$state 上！

  // 把存储的静默模式配置赋值回来
  Vue.config.silent = silent

  // enable strict mode for new vm
  // 开启严格模式 执行这句
  // 用 $watch 观测 state，只能使用 mutation 修改 也就是store实例的 _withCommit 方法
  if (store.strict) {
    enableStrictMode(store)
  }

  /* 解除旧vm的state的引用，以及销毁旧的Vue对象 */
  if (oldVm) {
    if (hot) {
      // dispatch changes in all subscribed watchers
      // to force getter re-evaluation for hot reloading.
      store._withCommit(() => {
        oldVm._data.$$state = null
      })
    }
    // 实例销毁
    Vue.nextTick(() => oldVm.$destroy())
  }
}

function installModule (store, rootState, path, module, hot) {
  const isRoot = !path.length
  const namespace = store._modules.getNamespace(path)

  // register in namespace map
  if (module.namespaced) {
    // 模块命名空间map对象中已经有了，开发环境报错提示重复
    if (store._modulesNamespaceMap[namespace] && __DEV__) {
      console.error(`[vuex] duplicate namespace ${namespace} for the namespaced module ${path.join('/')}`)
    }
    // namespace = ''， 也是可以往 _modulesNamespaceMap 注册属性
    store._modulesNamespaceMap[namespace] = module
  }

  // set state 响应式注册往父模块上 state 注册子模块
  if (!isRoot && !hot) {
    // path.slice(0, -1) 处理可以理解为 拿当前模块的父模块
    // 比如当 path 为 ['cart'] 时，则 path.slice(0, -1) 为 []，经过 getNestedState 处理后，拿到的是 cart 父模块 root 的 state，即 this._modules.root.state
    const parentState = getNestedState(rootState, path.slice(0, -1))
    // 当前模块名，比如 'cart'
    const moduleName = path[path.length - 1]
    store._withCommit(() => {
      if (__DEV__) {
        if (moduleName in parentState) {
          console.warn(
            `[vuex] state field "${moduleName}" was overridden by a module with the same name at "${path.join('.')}"`
          )
        }
      }

      // 给父模块添加上当前 moduleName，并且值是响应式的，如此处理后，就可以通过父模块的 moduleName 属性拿到对应子模块的 state 对象
      // 比如当前例子中，经过处理后， parentState 即 _modules.root.state 的内容为：
      // _modules.root.state = { cart: { checkoutStatus: null, items: [] }, products: { all: [] } }
      // 其中 cart 和 products 属性对应的对象均是响应式的！
      Vue.set(parentState, moduleName, module.state)
    })
  }

  // 模块的 context 属性在这里才被注册
  // module.context 这个赋值主要是给 helpers 中 mapState、mapGetters、mapMutations、mapActions四个辅助函数使用的。
  // 生成本地的dispatch、commit、getters和state。
  // 主要作用就是抹平差异化，不需要用户再传模块参数。
  // namespace 才会是 'cart/'（当 module.namespaced 为 true 时），而 path 永远是 'cart'
  const local = module.context = makeLocalContext(store, namespace, path)

  // 遍历注册 mutation
  // 这里的 mutation 参数是业务代码传入的函数
  module.forEachMutation((mutation, key) => {
    const namespacedType = namespace + key
    registerMutation(store, namespacedType, mutation, local)
  })

  // 遍历注册 action
  // 这里的 action 参数是业务代码传入的函数或者包含 handler 函数的对象
  module.forEachAction((action, key) => {
    const type = action.root ? key : namespace + key
    const handler = action.handler || action
    registerAction(store, type, handler, local)
  })

  // 遍历注册 getter
  // 这里的 getter 参数是业务代码传入的函数
  module.forEachGetter((getter, key) => {
    const namespacedType = namespace + key
    registerGetter(store, namespacedType, getter, local)
  })

  // 递归遍历注册 子模块
  module.forEachChild((child, key) => {
    installModule(store, rootState, path.concat(key), child, hot)
  })
}

/**
 * make localized dispatch, commit, getters and state
 * if there is no namespace, just use root ones
 */
function makeLocalContext (store, namespace, path) {
  const noNamespace = namespace === ''

  // 注意下，这里的 store.dispatch 是 boundDispatch
  // noNamespace 为 true 时，说明不需要携带命名空间前缀调用
  // 否则可以携带命名空间调用，或者通过 options 对象传入的 root 属性设置为 true 以达到不区分命名空间的 action 函数调用
  // 官网示例：https://vuex.vuejs.org/zh/guide/modules.html#%E5%9C%A8%E5%B8%A6%E5%91%BD%E5%90%8D%E7%A9%BA%E9%97%B4%E7%9A%84%E6%A8%A1%E5%9D%97%E5%86%85%E8%AE%BF%E9%97%AE%E5%85%A8%E5%B1%80%E5%86%85%E5%AE%B9%EF%BC%88global-assets%EF%BC%89
  // 下边的 commit 处理类似
  const local = {
    dispatch: noNamespace ? store.dispatch : (_type, _payload, _options) => {
      const args = unifyObjectStyle(_type, _payload, _options)
      const { payload, options } = args
      let { type } = args

      if (!options || !options.root) {
        type = namespace + type
        if (__DEV__ && !store._actions[type]) {
          console.error(`[vuex] unknown local action type: ${args.type}, global type: ${type}`)
          return
        }
      }

      return store.dispatch(type, payload)
    },

    // 注意下，这里的 store.commit 是 boundCommit
    commit: noNamespace ? store.commit : (_type, _payload, _options) => {
      const args = unifyObjectStyle(_type, _payload, _options)
      const { payload, options } = args
      let { type } = args

      if (!options || !options.root) {
        type = namespace + type
        if (__DEV__ && !store._mutations[type]) {
          console.error(`[vuex] unknown local mutation type: ${args.type}, global type: ${type}`)
          return
        }
      }

      store.commit(type, payload, options)
    }
  }

  // getters and state object must be gotten lazily
  // because they will be changed by vm update
  Object.defineProperties(local, {
    getters: {
      get: noNamespace
        ? () => store.getters
        : () => makeLocalGetters(store, namespace)
    },
    state: {
      get: () => getNestedState(store.state, path)
    }
  })

  return local
}

function makeLocalGetters (store, namespace) {
  if (!store._makeLocalGettersCache[namespace]) {
    const gettersProxy = {}
    const splitPos = namespace.length
    Object.keys(store.getters).forEach(type => {
      // skip if the target getter is not match this namespace
      if (type.slice(0, splitPos) !== namespace) return

      // extract local getter type
      const localType = type.slice(splitPos)

      // Add a port to the getters proxy.
      // Define as getter property because
      // we do not want to evaluate the getters in this time.
      Object.defineProperty(gettersProxy, localType, {
        get: () => store.getters[type],
        enumerable: true
      })
    })
    store._makeLocalGettersCache[namespace] = gettersProxy
  }

  return store._makeLocalGettersCache[namespace]
}

/**
 * 注册 mutation
 * @param {Object} store 对象
 * @param {String} type 类型
 * @param {Function} handler 用户自定义的函数
 * @param {Object} local local 对象
 */
function registerMutation (store, type, handler, local) {
  // 收集的所有的mutations找对应的mutation函数，没有就赋值空数组
  /* 所有的mutation会被push进一个数组中，这样相同的mutation就可以调用不同module中的同名的mutation了 */
  const entry = store._mutations[type] || (store._mutations[type] = [])
  entry.push(function wrappedMutationHandler (payload) {
    /**
     * mutations: {
     *    pushProductToCart (state, { id }) {
     *        console.log(state);
     *    }
     * }
     * 也就是为什么用户定义的 mutation 第一个参数是state的原因，第二个参数是payload参数
     *
     * 这里 local.state 最终是作用到 store._vm._data.$$state 上的数据！
     */
    handler.call(store, local.state, payload)
  })
}

/**
* 注册 action
* @param {Object} store 对象
* @param {String} type 类型
* @param {Function} handler 用户自定义的函数
* @param {Object} local local 对象
*/
function registerAction (store, type, handler, local) {
  const entry = store._actions[type] || (store._actions[type] = [])
  // payload 是actions函数的第二个参数
  entry.push(function wrappedActionHandler (payload) {
    /**
    * 也就是为什么用户定义的actions中的函数第一个参数有
    *  { dispatch, commit, getters, state, rootGetters, rootState } 的原因
    * actions: {
    *    checkout ({ commit, state }, products) {
    *        console.log(commit, state);
    *    }
    * }
    */
    let res = handler.call(store, {
      dispatch: local.dispatch,
      commit: local.commit,
      getters: local.getters,
      state: local.state,
      rootGetters: store.getters,
      rootState: store.state
    }, payload)

    /**
    * export function isPromise (val) {
       return val && typeof val.then === 'function'
     }
    * 判断如果不是Promise 则 Promise 化，这也就是为啥 actions 中能够处理异步函数的原因
       也就是为什么构造函数中断言不支持promise报错的原因
       vuex需要Promise polyfill
       assert(typeof Promise !== 'undefined', `vuex requires a Promise polyfill in this browser.`)
    */
    if (!isPromise(res)) {
      res = Promise.resolve(res)
    }
    // devtool 工具触发 vuex:error
    if (store._devtoolHook) {
      return res.catch(err => {
        store._devtoolHook.emit('vuex:error', err)
        throw err
      })
    } else {
      return res
    }
  })
}

/**
 * 注册 getter
 * @param {Object} store  Store实例
 * @param {String} type 类型
 * @param {Object} rawGetter  原始未加工的 getter 也就是用户定义的 getter 函数
 * @examples  比如 cartProducts: (state, getters, rootState, rootGetters) => {}
 * @param {Object} local 本地 local 对象
 */
function registerGetter (store, type, rawGetter, local) {
  // 类型如果已经存在，报错：已经存在
  if (store._wrappedGetters[type]) {
    if (__DEV__) {
      console.error(`[vuex] duplicate getter key: ${type}`)
    }
    return
  }
  store._wrappedGetters[type] = function wrappedGetter (store) {
    /**
     * 这也就是为啥 getters 中能获取到  (state, getters, rootState, rootGetters)  这些值的原因
     * getters = {
     *      cartProducts: (state, getters, rootState, rootGetters) => {
     *        console.log(state, getters, rootState, rootGetters);
     *      }
     * }
     */
    return rawGetter(
      local.state, // local state
      local.getters, // local getters
      store.state, // root state
      store.getters // root getters
    )
  }
}

// 启用严格模式，如果业务代码中，在 `new Vuex.Store` 时候设置了 `strict: true`，如果直接通过赋值的形式修改 state 中的状态，则开发环境会报错！
function enableStrictMode (store) {
  store._vm.$watch(function () { return this._data.$$state }, () => {
    if (__DEV__) {
      /* 检测store中的_committing的值，如果是false代表不是通过mutation的方法修改的，因为没经过 _withcommit 方法 */
      assert(store._committing, `do not mutate vuex store state outside mutation handlers.`)
    }
  }, { deep: true, sync: true })
}

// 把 path 数组最右边的 key 对应的 state 对象拿出来
function getNestedState (state, path) {
  return path.reduce((state, key) => state[key], state)
}

// dispatch actions 或者 commit mutations 时，
// 兼容 (type: string, payload?: any, options?: Object) => any 和 ({ type: string, ... }, payload?: any) => any 这2种函数签名形式！
// 最终返回 { type, payload, options }
function unifyObjectStyle (type, payload, options) {
  if (isObject(type) && type.type) {
    options = payload
    payload = type
    type = type.type
  }

  if (__DEV__) {
    assert(typeof type === 'string', `expects string as the type, but found ${typeof type}.`)
  }

  return { type, payload, options }
}

export function install (_Vue) {
  if (Vue && _Vue === Vue) {
    if (__DEV__) {
      console.error(
        '[vuex] already installed. Vue.use(Vuex) should be called only once.'
      )
    }
    return
  }
  Vue = _Vue
  applyMixin(Vue)
}
