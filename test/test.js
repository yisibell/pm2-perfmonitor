console.log('test', process.pid)

process.on('message', (e) => {
  console.log('>>>>>>>>>>>>>>>', e.data.event)
})
