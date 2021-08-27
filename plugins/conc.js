async function conc(limit, tasks, exec) {
  tasks = tasks instanceof Array ? tasks : [tasks]
  const ret = []
  const executing = []
  for (const task of tasks) {
    const p = Promise.resolve().then(() => exec(task, tasks))
    ret.push(p)
    if (limit <= tasks.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1))
      executing.push(e)
      if (executing.length >= limit) {
        await Promise.race(executing)
      }
    }
  }
  return Promise.all(ret)
}

module.exports = conc