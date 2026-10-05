const express = require('express')
const http = require('http')
const cors = require('cors')
const { Server } = require('socket.io')
const fs = require('fs/promises')
const path = require('path')

const app = express()
const server = http.createServer(app)
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173'
const allowedOrigins = [clientOrigin, 'http://127.0.0.1:5173']
const coversRoot = path.resolve(__dirname, '..', 'frontend', 'public', 'ImagenesCapitulos')
const imageExtensions = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.webp'])

app.use(cors({ origin: allowedOrigins }))
app.use(express.json())
app.get('/health', (_request, response) => response.json({ status: 'ok' }))
app.use('/covers', express.static(coversRoot))

app.get('/covers-manifest', async (request, response) => {
  try {
    const folders = await fs.readdir(coversRoot, { withFileTypes: true })
    const covers = {}

    for (const folder of folders) {
      const match = /^Capitulo\s+(\d+)$/i.exec(folder.name)
      if (!folder.isDirectory() || !match) continue

      const files = await fs.readdir(path.join(coversRoot, folder.name), { withFileTypes: true })
      const image = files
        .filter((file) => file.isFile() && imageExtensions.has(path.extname(file.name).toLowerCase()))
        .map((file) => file.name)
        .sort((first, second) => first.localeCompare(second, 'es'))[0]

      if (image) {
        const origin = `${request.protocol}://${request.get('host')}`
        covers[match[1]] = `${origin}/covers/${encodeURIComponent(folder.name)}/${encodeURIComponent(image)}`
      }
    }

    response.json({ covers })
  } catch (error) {
    console.error('No se pudieron leer las portadas:', error)
    response.status(500).json({ message: 'No se pudieron leer las portadas.' })
  }
})

const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
})

io.on('connection', (socket) => {
  console.log(`Cliente conectado: ${socket.id}`)
  socket.on('docente:continuar_sesion', () => {
    console.log('El docente avanzó en la sesión.')
    socket.emit('docente:continuar_confirmado', {
      message: 'El docente avanzó en la sesión.',
    })
  })
  socket.on('disconnect', () => console.log(`Cliente desconectado: ${socket.id}`))
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => console.log(`Servidor disponible en http://localhost:${PORT}`))
