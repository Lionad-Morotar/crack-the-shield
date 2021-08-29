const uuid = () => String(+new Date()) + String(Math.random()).slice(-6)

module.exports = class Crawler {

  constructor(arg) {
    if (!arg.collection) {
      throw new TypeError('Param missing: collection <---> MongoDBCollection')
    }
    this.todoList = []
    this.doingList = []
    this.interval = 0
    this.collection = arg.collection
    this.config = Object.assign({
      force: false,
      maxConcurrenceCount: 5
    })
  }

  // 调度任务并获取任务执行的返回结果
  async exec(tasks, config = {}) {
    Object.assign(this.config, config)
    this.addTask(tasks)
    return Promise.resolve(await this.distributeTask())
  }

  // 添加任务
  addTask(task) {
    const tasks = Array.isArray(task) ? task : [task]
    let newTask = tasks.map(x => ({
      id: uuid(),
      task: x
    }))
    this.todoList.push(...newTask)
    return this
  }
  recordTask(task) {
    this.doingList.push(task)
  }
  removeTask(task) {
    this.doingList.splice(
      this.doingList.findIndex(x => x === task),
      1
    )
  }

  /**
   * 返回剩下的并发数量
   */
  calcRestConcurrenceCount(todoList = this.todoList) {
    const doingListEmpty = this.config.maxConcurrenceCount - this.doingList.length
    return Math.min(doingListEmpty < 0 ? 0 : doingListEmpty, todoList.length)
  }

  /**
   * 开始执行任务，并发控制
   */
  async distributeTask() {
    return new Promise(async resolve => {
      const totalTaskLen = this.doingList.length + this.todoList.length
      const results = []
      let doingBinded = null

      function doing(restConcurrenceCount = this.calcRestConcurrenceCount()) {
        return new Promise(resolve => {
          while (restConcurrenceCount-- > 0) {
            const task = this.todoList.pop()
            const { task: taskDetail } = task
            this.recordTask(task)
            this.run(taskDetail).then(async res => {
              results.push(res)
              if (results.length === totalTaskLen) resolve(results)
              this.removeTask(task)

              // 继续下一个任务
              resolve(await doingBinded())
              // 任务间隙休息片刻
              await new Promise(resolve => setTimeout(resolve, this.interval))
            })
          }
        })
      }
      doingBinded = doing.bind(this)
      await doingBinded()
      resolve(results)
    })
  }

  /**
   * 执行任务
   */
  async run(task) {
    const { id, idtype, run } = task

    const findFn = async () => {
      return await new Promise(resolve => {
        if (!id) resolve(false)
        const ID = { _id: id, idtype }
        this.collection.find(ID).toArray(function (err, res) {
          if (err) throw err
          resolve(res)
        })
      })
    }

    const findRes = this.config.force ? [] : (await findFn())
    const hasFind = findRes.length > 0
    if (hasFind) {
      return findRes
    } else {
      return await run.bind(this)({
        collection: this.collection
      })
    }
  }

}
