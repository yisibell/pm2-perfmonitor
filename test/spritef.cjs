var printf = require('sprintf-js').sprintf

/* Args :
 *  p : Percent 0 - 100
 *  rgb_ : Array of rgb [255, 255, 255]
 * Return :
 *  Hexa #FFFFFF
 */
function gradient(p, rgb_beginning, rgb_end) {
  var w = (p / 100) * 2 - 1

  var w1 = (w + 1) / 2.0
  var w2 = 1 - w1

  var rgb = [
    parseInt(rgb_beginning[0] * w1 + rgb_end[0] * w2),
    parseInt(rgb_beginning[1] * w1 + rgb_end[1] * w2),
    parseInt(rgb_beginning[2] * w1 + rgb_end[2] * w2),
  ]

  const res =
    '#' +
    ((1 << 24) + (rgb[0] << 16) + (rgb[1] << 8) + rgb[2]).toString(16).slice(1)

  console.log(res) // #aN

  return res
}

const pm_id = 0
const name = 'test'
const memPercent = NaN
const memory = 0
const cpu = NaN

const env_status = 'online'

// Status of process
var status = env_status == 'online' ? '{green-fg}' : '{red-fg}'
status = status + '{bold}' + env_status + '{/}'

var item = printf(
  '[%2s] %s {|} Mem: {bold}{%s-fg}%3d{/} MB    CPU: {bold}{%s-fg}%2d{/} %s  %s',
  pm_id,
  name,
  gradient(memPercent, [255, 0, 0], [0, 255, 0]),
  (memory / 1048576).toFixed(2),
  gradient(cpu, [255, 0, 0], [0, 255, 0]),
  cpu,
  '%',
  status,
)

console.log(item) // [ 0] test {|} Mem: {bold}{#aN-fg}  0{/} MB    CPU: {bold}{#aN-fg}-NaN{/} %  {green-fg}{bold}online{/}
