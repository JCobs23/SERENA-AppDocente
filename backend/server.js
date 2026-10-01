const express = require('express')
const http = require('http')
const cors = require('cors')
const { Server } = require('socket.io')

const app = express()
const server = http.createServer(app)
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173'
const allowedOrigins = [clientOrigin, 'http://127.0.0.1:5173']

app.use(cors({ origin: allowedOrigins }))
app.use(express.json())
app.get('/health', (_request, response) => response.json({ status: 'ok' }))

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
