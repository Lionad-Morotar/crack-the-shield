/**
 * Tasker
 * 任务队列管理以及任务并发控制
 */
module.exports = class Tasker {

  constructor(conf) {
    this.results = []
    this.todos = []
    this.doing = []
    this.totalTask = 0
    this.interval = conf.interval || 0
    this.maxConcurrenceCount = conf.maxConcurrenceCount || 1
    this.resolver = null
  }

  async start(tasks) {
    this.addTask(tasks)
    this.execute()
    const curTaskRunner = new Promise(async resolve => {
      this.resolver = resolve
    })
    return curTaskRunner
  }

  /* 任务相关 */
  addTask(task) {
    const tasks = Array.isArray(task) ? task : [task]
    this.totalTask += tasks.length
    this.todos.push(...tasks)
    return this
  }
  recordTask(task) {
    this.doing.push(task)
  }
  removeTask(task) {
    this.doing.splice(
      this.doing.findIndex(x => x === task),
      1
    )
  }
  pushResult(res) {
    this.results.push(res)
    if (this.results.length === this.totalTask) {
      this.resolver(this.results)
    }
  }

  /**
   * 计算并发富余量
   */
  calcRestConcurrenceCount() {
    const doingEmpty = this.maxConcurrenceCount - this.doing.length
    const restCons = Math.min(
      doingEmpty <= 0 ? 0 : doingEmpty,
      this.todos.length
    )
    return restCons
  }

  /**
   * 开始执行任务
   */
  async execute() {
    const restConCount = this.calcRestConcurrenceCount()
    Array(restConCount).fill('').map(async _ => {
      const task = this.todos.shift()
      if (!task) {
        throw new Error('[ERR] 任务不存在')
      }
      
      // FIXME
      const artifactMaybe = this.results[this.results.length - 1]
      this.recordTask(task)
      const res = await this.run(task, artifactMaybe)
      this.removeTask(task)
      
      // 任务间隙休息片刻
      const interval = this.interval instanceof Function ? this.interval(task) : this.interval
      await new Promise(resolve => setTimeout(resolve, interval))
      this.pushResult(res)

      this.execute()
    })
  }

  /**
   * 执行任务
   * @param {object} task 任务配置
   * @param {any|null} artifactMaybe 上一个任务执行完返回的产物
   */
  async run(task, artifactMaybe) {
    const { id, run } = task
    return await run.bind(this)({
      artifact: artifactMaybe
    })
  }

}
