# Vuex

[![npm](https://img.shields.io/npm/v/vuex.svg)](https://npmjs.com/package/vuex)
[![ci status](https://circleci.com/gh/vuejs/vuex/tree/3.x.png?style=shield)](https://circleci.com/gh/vuejs/vuex)

该版本是Vuex 3.x版本，适配Vue2项目开发。

调试注意事项：

首先，在 `examples/webpack.config.js` 文件中增加 `sourcemap: true` 的配置项：

```js
module.exports = {
  // 省略其他配置项
  // 开启sourcemap才好调试
  devtool: 'sourcemap',
}
```

然后，通过如下命令安装依赖并启动服务：

```bash
$ yarn install
$ yarn dev
```

最后，浏览器打开 http://localhost:8080/ ，然后以 `shopping-cart` 为例子，打开浏览器面板 `source`， 在左侧找到 `webapck://` 下的文件夹（主要是 `src` 和 `examples`），设置断点，过完基本vuex核心的源码操作过程。

调试过程中，做好代码注释工作。

---

🔥 **HEADS UP!** You're currently looking at Vuex 3 branch. If you're looking for Vuex 4, [please check out `main` branch](https://github.com/vuejs/vuex/tree/main).

---

Vuex is a state management pattern + library for Vue.js applications. It serves as a centralized store for all the components in an application, with rules ensuring that the state can only be mutated in a predictable fashion. It also integrates with Vue's official [devtools extension](https://github.com/vuejs/vue-devtools) to provide advanced features such as zero-config time-travel debugging and state snapshot export / import.

Learn more about Vuex at "[What is Vuex?](https://vuex.vuejs.org/)", or get started by looking into [full documentation](http://vuex.vuejs.org/).

## Documentation

To check out docs, visit [vuex.vuejs.org](https://vuex.vuejs.org/).

## Examples

- [Counter](https://github.com/vuejs/vuex/tree/dev/examples/counter)
- [Counter with Hot Reload](https://github.com/vuejs/vuex/tree/dev/examples/counter-hot)
- [TodoMVC](https://github.com/vuejs/vuex/tree/dev/examples/todomvc)
- [Flux Chat](https://github.com/vuejs/vuex/tree/dev/examples/chat)
- [Shopping Cart](https://github.com/vuejs/vuex/tree/dev/examples/shopping-cart)

Running the examples:

```bash
$ npm install
$ npm run dev # serve examples at localhost:8080
```

## Questions

For questions and support please use the [Discord chat server](https://chat.vuejs.org) or [the official forum](http://forum.vuejs.org). The issue list of this repo is **exclusively** for bug reports and feature requests.

## Issues

Please make sure to read the [Issue Reporting Checklist](https://github.com/vuejs/vuex/blob/dev/.github/contributing.md#issue-reporting-guidelines) before opening an issue. Issues not conforming to the guidelines may be closed immediately.

## Changelog

Detailed changes for each release are documented in the [release notes](https://github.com/vuejs/vuex/releases).

## Stay In Touch

For latest releases and announcements, follow on Twitter: [@vuejs](https://twitter.com/vuejs).

## Contribution

Please make sure to read the [Contributing Guide](https://github.com/vuejs/vuex/blob/dev/.github/contributing.md) befor e making a pull request.

## License

[MIT](http://opensource.org/licenses/MIT)

Copyright (c) 2015-present Evan You
