const Tasker = require('../src/tasker')
const { sleep } = require('../utils')

!(async () => {

  let todos

  /**************************************************************************************/

  todos = Array(7).fill('').map((x, idx) => {
    return {
      id: idx,
      async run () {
        console.log(idx, 'start')
        await sleep(idx * 100)
        console.log(idx, 'end')
      }
    }
  })

  await new Tasker({ maxConcurrenceCount: 1 })
    .start(todos)
    .then(() => console.log(`【TASK DONE】`))
    .catch(error => console.error(`【TASK ERROR】 ${error.message}`))


  /**************************************************************************************/

  console.log('\n\n\n')
  todos = Array(10).fill('').map((x, idx) => {
    return {
      id: idx,
      async run() {
        console.log(idx, 'start')
        await sleep(idx * 100)
        console.log(idx, 'end')
        return idx
      }
    }
  })

  await new Tasker({ maxConcurrenceCount: 5 })
    .start(todos)
    .then(results => console.log(`【TASK DONE】`, results))
    .catch(error => console.error(`【TASK ERROR】 ${error.message}`))

  
    /**************************************************************************************/

  console.log('\n\n\n')
  todos = Array(10).fill('').map((x, idx) => {
    return {
      id: idx,
      async run() {
        console.log(idx, 'start')
        await sleep(1000)
        console.log(idx, 'end')
        if (idx < 5) {
          this.addTask({
            id: idx + 10,
            async run() {
              console.log(idx + 10, 'start')
              await sleep(1000)
              console.log(idx + 10, 'end')
              return idx + 10
            }
          })
        }
        if (idx === 8) {
          this.addTask(Array(5).fill('').map((x, i) => {
            const idx = i + 15
            return {
              id: idx,
              async run() {
                console.log(idx, 'start')
                await sleep(1000)
                console.log(idx, 'end')
                return idx
              }
            }
          }))
        }
        return idx
      }
    }
  })

  await new Tasker({ maxConcurrenceCount: 5 })
    .start(todos)
    .then(results => console.log(`【TASK DONE】`, results))
    .catch(error => console.error(`【TASK ERROR】 ${error.message}`))

})()