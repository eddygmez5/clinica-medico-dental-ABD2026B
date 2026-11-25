//node npm run dev (en modo desarrollo)
//node npm run start (en modo produccion)

const express = require('express');
const path = require('path');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

const db = require('./config/db');

const authRoutes = require('./routes/auth');
const verificarSesion = require('./middleware/verificarSesion');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración del almacén de sesiones en MySQL
const sessionStore = new MySQLStore({}, db);

app.use(session({
    key: 'sesion_clinica',
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 } // La sesión dura 8 horas
}));

// Configuración de EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares para formularios y archivos estáticos
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ruta principal ahora muestra el login
app.get('/', (req, res) => {
    res.render('auth/login');
});

app.use('/', authRoutes);

// Ruta principal (Login)
app.get('/', (req, res) => {
    // Si ya inició sesión, lo mandamos directo al dashboard sin pedir clave otra vez
    if (req.session.usuario) {
        return res.redirect('/dashboard');
    }
    res.render('auth/login');
});

// Ruta protegida del Dashboard
app.get('/dashboard', verificarSesion, (req, res) => {
    res.send(`
        <h1>¡Bienvenido, ${req.session.usuario.nombre}!</h1>
        <p>Tu rol es: ${req.session.usuario.rol}</p>
        <a href="/logout">Cerrar Sesión</a>
    `);
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});