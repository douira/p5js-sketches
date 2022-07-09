const chunkSize = 60
const chunks = new Map()
let isActive = false
let maxColoringSortCount = 0
let maxSortCount = 0
let totalSorts = 0
let sortsPerSecond = 0
let sortsPerSecondAcc = 0
let lastSecondReset = Date.now()
const maxAngle = 10
const triggerFade = 1000 //ms
const useCorners = true
const useLogColoring = true
const coloring = useLogColoring ? count => log(count) + 1 : count => count
const frustumCulling = true
const frustumViewAngle = 90
const furstumAngleOffset = 90

function setup() {
  defaultColor = color(255)
  sortColor = color(0, 150, 0)
  triggerColor = color(150, 150, 255)

  createCanvas(windowWidth, windowHeight)
  angleMode(DEGREES)
}

const maxCornerAngle = (xPrev, yPrev, xNow, yNow, x, y) => {
  const anglePrev = atan2(yPrev - y, xPrev - x)
  const angleNow = atan2(yNow - y, xNow - x)
  return [wrappedAngleDist(angleNow, anglePrev), angleNow]
}

const wrappedAngleDist = (a, b) =>
  min(abs(a - b), abs(a + 360 - b), abs(a - (b + 360)))

class Chunk {
  constructor(x, y) {
    this.x = x
    this.y = y

    this.sortCount = 0
    this.angle = 0
    this.lastSortPlayerX = 0
    this.lastSortPlayerY = 0
    this.sortTime = -100
    this.needsRender = true
    this.culled = false
  }

  draw() {
    var triggerLerp = constrain(
      (triggerFade - (Date.now() - this.sortTime)) / triggerFade,
      0,
      1
    )
    if (triggerLerp > 0) {
      this.needsRender = true
    }
    if (!this.needsRender) {
      return
    }
    this.needsRender = false

    const lerpTriggerColor = lerpColor(defaultColor, triggerColor, triggerLerp)
    const lerpSortColor = lerpColor(
      defaultColor,
      sortColor,
      coloring(this.sortCount) / maxColoringSortCount
    )
    fill(lerpColor(lerpSortColor, lerpTriggerColor, 0.5))
    if (this.culled) {
      strokeWeight(2)
      stroke(255, 0, 0)
    } else {
      strokeWeight(1)
      stroke(0)
    }
    rect(this.x, this.y, chunkSize, chunkSize)
    noStroke()
    fill(0)
    text(`${this.x}, ${this.y}`, this.x, this.y - 15, chunkSize, chunkSize)
    text(this.sortCount, this.x, this.y - 5, chunkSize, chunkSize)
    text(`${floor(this.angle)}°`, this.x, this.y + 5, chunkSize, chunkSize)
    text(
      `${this.lastSortPlayerX}, ${this.lastSortPlayerY}`,
      this.x,
      this.y + 15,
      chunkSize,
      chunkSize
    )
  }

  reset(playerX, playerY) {
    this.sortCount = 0
    this.lastSortPlayerX = playerX
    this.lastSortPlayerY = playerY
    this.sortTime = -100
    this.needsRender = true
    this.culled = false
  }

  //sort if the angle relative to this chunk between the last and current position is more than maxAngle
  testSort(playerX, playerY) {
    let [angle, angleNow] = maxCornerAngle(
      this.lastSortPlayerX,
      this.lastSortPlayerY,
      playerX,
      playerY,
      this.x,
      this.y
    )
    let angle10, angle01, angle11, angleNow10, angleNow01, angleNow11
    if (useCorners) {
      ;[angle10, angleNow10] = maxCornerAngle(
        this.lastSortPlayerX,
        this.lastSortPlayerY,
        playerX,
        playerY,
        this.x + chunkSize,
        this.y
      )
      ;[angle01, angleNow01] = maxCornerAngle(
        this.lastSortPlayerX,
        this.lastSortPlayerY,
        playerX,
        playerY,
        this.x,
        this.y + chunkSize
      )
      ;[angle11, angleNow11] = maxCornerAngle(
        this.lastSortPlayerX,
        this.lastSortPlayerY,
        playerX,
        playerY,
        this.x + chunkSize,
        this.y + chunkSize
      )
      angle = max(angle, angle10, angle01, angle11)
    }
    const culled =
      frustumCulling &&
      min(
        wrappedAngleDist(furstumAngleOffset, angleNow),
        wrappedAngleDist(furstumAngleOffset, angleNow01),
        wrappedAngleDist(furstumAngleOffset, angleNow10),
        wrappedAngleDist(furstumAngleOffset, angleNow11)
      ) >
        frustumViewAngle / 2 &&
      !(
        playerX > this.x &&
        playerX < this.x + chunkSize &&
        playerY > this.y &&
        playerY < this.y + chunkSize
      )
    if (floor(angle) != floor(this.angle) || this.culled != culled) {
      this.needsRender = true
      this.angle = angle
      this.culled = culled
    }
    if (angle > maxAngle && !this.culled) {
      this.sortCount++
      this.lastSortPlayerX = playerX
      this.lastSortPlayerY = playerY
      this.sortTime = Date.now()
      totalSorts++
      sortsPerSecondAcc++
      this.needsRender = true
    }
  }
}

function draw() {
  translate(width / 2, height / 2)

  const cheight = height / chunkSize
  const cwidth = width / chunkSize
  const playerX = floor(mouseX - width / 2)
  const playerY = floor(mouseY - height / 2)
  if (isActive) {
    if (Date.now() - lastSecondReset > 1000) {
      lastSecondReset = Date.now()
      sortsPerSecond = sortsPerSecondAcc
      sortsPerSecondAcc = 0
    }
    maxColoringSortCount = 1
    maxSortCount = 1
    for (const chunk of chunks.values()) {
      chunk.testSort(playerX, playerY)
      maxColoringSortCount = max(
        maxColoringSortCount,
        coloring(chunk.sortCount)
      )
      maxSortCount = max(maxSortCount, chunk.sortCount)
    }
  }
  strokeWeight(1)
  textSize(10)
  textAlign(CENTER, CENTER)
  for (let cx = -ceil(cwidth / 2); cx < cwidth; cx++) {
    for (let cy = -ceil(cheight / 2); cy < cheight; cy++) {
      const x = cx * chunkSize
      const y = cy * chunkSize
      const key = x + "-" + y
      let chunk = chunks.get(key)
      if (!chunk) {
        chunk = new Chunk(x, y)
        chunks.set(key, chunk)
      }
      chunk.draw()
    }
  }

  resetMatrix()
  if (isActive) {
    fill(255, 0, 0)
    noStroke()
    circle(mouseX, mouseY, 15)
  }
  textSize(14)
  textAlign(LEFT, TOP)
  fill(255)
  stroke(150)
  strokeWeight(2)
  rect(0, 0, 200, 200)
  fill(0)
  noStroke()
  text(
    `
Max Sorts: ${maxSortCount}
Total Sorts: ${totalSorts}
Max Angle: ${maxAngle}°
Corner Angles: ${useCorners}
Sorts per Second: ${sortsPerSecond}
FPS: ${round(frameRate())}
Coloring: ${useLogColoring ? "logarithmic" : "linear"}
Frustum Culling: ${frustumCulling}
Frustum Angle: ${frustumViewAngle}`.trim(),
    10,
    10
  )
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight)
}

function mousePressed() {
  const playerX = floor(mouseX - width / 2)
  const playerY = floor(mouseY - height / 2)
  for (const chunk of chunks.values()) {
    chunk.reset(playerX, playerY)
  }
  isActive = true
}

function mouseReleased() {
  isActive = false
}
