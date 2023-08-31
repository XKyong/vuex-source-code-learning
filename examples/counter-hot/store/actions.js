export const increment = ({ commit }) => {
  commit('increment')
}
export const decrement = ({ commit }) => {
  commit('decrement')
}

export const incrementIfOdd = ({ commit, state }) => {
  if ((state.count + 1) % 2 === 0) {
    commit('increment')
  }
}

export const incrementAsync = ({ commit }) => {
  // 跟 counter 示例做对比：添加下边这行代码，保存文件，然后点击页面【Increment async】按钮，会发现 console 即会输出下边的log！
  console.log('incrementAsync---')
  setTimeout(() => {
    commit('increment')
  }, 1000)
}
